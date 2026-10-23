//! A bounded subset of the Expression Constraint Language (ECL 2.x):
//!
//! ```text
//! 404684003            self
//! << 404684003         descendant or self      < 404684003   descendant
//! >> 404684003         ancestor or self        > 404684003   ancestor
//! ^ 723264001          member of a refset
//! A AND B   A OR B   A MINUS B   ( … )
//! ```
//!
//! An optional `|term|` after an id is accepted and ignored, as ECL allows.
//! As in ECL, different binary operators may not be mixed without brackets.
//! The parsed expression compiles to one SQL set expression over the
//! closure table, so evaluating it is a single query whatever its shape.

use serde::Serialize;
use sqlx::PgPool;

use crate::concept::SnomedConceptSummary;
use crate::sctid::parse_sctid;
use crate::search::MAX_RESULTS;

const MAX_LEN: usize = 1_000;
const MAX_FOCI: usize = 16;
const MAX_NESTING: usize = 8;
/// Counting stops here: the number is for a screen, not a census.
const COUNT_CAP: i64 = 100_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Focus {
    SelfOnly,
    DescendantOrSelf,
    Descendant,
    AncestorOrSelf,
    Ancestor,
    MemberOf,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BinOp {
    And,
    Or,
    Minus,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Ecl {
    Focus(Focus, i64),
    Binary(BinOp, Box<Self>, Box<Self>),
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum EclError {
    #[error("the expression is empty")]
    Empty,
    #[error("the expression is longer than {MAX_LEN} characters")]
    TooLong,
    #[error("the expression has more than {MAX_FOCI} concepts")]
    TooManyConcepts,
    #[error("brackets are nested more than {MAX_NESTING} deep")]
    TooDeep,
    #[error("{0} is not a SNOMED CT identifier")]
    BadId(String),
    #[error("expected {expected} at character {at}")]
    Expected { expected: &'static str, at: usize },
    #[error("use brackets to combine AND, OR and MINUS, e.g. (A AND B) MINUS C")]
    MixedOperators,
}

struct Parser<'a> {
    src: &'a str,
    pos: usize,
    foci: usize,
    depth: usize,
}

pub fn parse(src: &str) -> Result<Ecl, EclError> {
    if src.len() > MAX_LEN {
        return Err(EclError::TooLong);
    }
    if src.trim().is_empty() {
        return Err(EclError::Empty);
    }
    let mut p = Parser {
        src,
        pos: 0,
        foci: 0,
        depth: 0,
    };
    let expr = p.expression()?;
    p.skip_ws();
    if p.pos < src.len() {
        return Err(EclError::Expected {
            expected: "AND, OR, MINUS or the end",
            at: p.pos,
        });
    }
    Ok(expr)
}

impl Parser<'_> {
    fn rest(&self) -> &str {
        &self.src[self.pos..]
    }

    fn skip_ws(&mut self) {
        let trimmed = self.rest().trim_start();
        self.pos = self.src.len() - trimmed.len();
    }

    fn eat(&mut self, token: &str) -> bool {
        self.skip_ws();
        if self.rest().starts_with(token) {
            self.pos += token.len();
            true
        } else {
            false
        }
    }

    fn operator(&mut self) -> Option<BinOp> {
        self.skip_ws();
        for (word, op) in [
            ("AND", BinOp::And),
            ("OR", BinOp::Or),
            ("MINUS", BinOp::Minus),
        ] {
            let rest = self.rest();
            // `get` rather than slicing: the text is untrusted and a slice
            // inside a multi-byte character would panic.
            let matches = rest
                .get(..word.len())
                .is_some_and(|w| w.eq_ignore_ascii_case(word))
                && !rest
                    .get(word.len()..)
                    .is_some_and(|after| after.starts_with(|c: char| c.is_ascii_alphanumeric()));
            if matches {
                self.pos += word.len();
                return Some(op);
            }
        }
        None
    }

    fn expression(&mut self) -> Result<Ecl, EclError> {
        let mut left = self.term()?;
        let mut seen: Option<BinOp> = None;
        while let Some(op) = self.operator() {
            if seen.is_some_and(|s| s != op) {
                return Err(EclError::MixedOperators);
            }
            seen = Some(op);
            let right = self.term()?;
            left = Ecl::Binary(op, Box::new(left), Box::new(right));
        }
        Ok(left)
    }

    fn term(&mut self) -> Result<Ecl, EclError> {
        if self.eat("(") {
            self.depth += 1;
            if self.depth > MAX_NESTING {
                return Err(EclError::TooDeep);
            }
            let inner = self.expression()?;
            if !self.eat(")") {
                return Err(EclError::Expected {
                    expected: ")",
                    at: self.pos,
                });
            }
            self.depth -= 1;
            return Ok(inner);
        }
        let focus = if self.eat("<<") {
            Focus::DescendantOrSelf
        } else if self.eat("<") {
            Focus::Descendant
        } else if self.eat(">>") {
            Focus::AncestorOrSelf
        } else if self.eat(">") {
            Focus::Ancestor
        } else if self.eat("^") {
            Focus::MemberOf
        } else {
            Focus::SelfOnly
        };
        self.skip_ws();
        let digits = self.rest().bytes().take_while(u8::is_ascii_digit).count();
        if digits == 0 {
            return Err(EclError::Expected {
                expected: "a concept id",
                at: self.pos,
            });
        }
        let text = &self.rest()[..digits];
        let id = parse_sctid(text).ok_or_else(|| EclError::BadId(text.to_owned()))?;
        self.pos += digits;
        self.foci += 1;
        if self.foci > MAX_FOCI {
            return Err(EclError::TooManyConcepts);
        }
        if self.eat("|") {
            let Some(end) = self.rest().find('|') else {
                return Err(EclError::Expected {
                    expected: "a closing |",
                    at: self.pos,
                });
            };
            self.pos += end + 1;
        }
        Ok(Ecl::Focus(focus, id))
    }
}

impl Ecl {
    /// A SQL set expression yielding one `id` column. Ids are bound as
    /// parameters, appended to `params` in order.
    pub fn to_sql(&self, params: &mut Vec<i64>) -> String {
        match self {
            Self::Focus(focus, id) => {
                params.push(*id);
                let n = params.len();
                match focus {
                    Focus::SelfOnly => format!("SELECT ${n}::bigint AS id"),
                    Focus::DescendantOrSelf => format!(
                        "SELECT ${n}::bigint AS id UNION SELECT subtype_id FROM snomed_transitive_closure WHERE supertype_id = ${n}"
                    ),
                    Focus::Descendant => format!(
                        "SELECT subtype_id AS id FROM snomed_transitive_closure WHERE supertype_id = ${n}"
                    ),
                    Focus::AncestorOrSelf => format!(
                        "SELECT ${n}::bigint AS id UNION SELECT supertype_id FROM snomed_transitive_closure WHERE subtype_id = ${n}"
                    ),
                    Focus::Ancestor => format!(
                        "SELECT supertype_id AS id FROM snomed_transitive_closure WHERE subtype_id = ${n}"
                    ),
                    Focus::MemberOf => format!(
                        "SELECT referenced_component_id AS id FROM snomed_refset_member WHERE refset_id = ${n} AND active"
                    ),
                }
            }
            Self::Binary(op, left, right) => {
                let l = left.to_sql(params);
                let r = right.to_sql(params);
                let keyword = match op {
                    BinOp::And => "INTERSECT",
                    BinOp::Or => "UNION",
                    BinOp::Minus => "EXCEPT",
                };
                format!("({l}) {keyword} ({r})")
            }
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct SnomedEclResult {
    pub concepts: Vec<SnomedConceptSummary>,
    /// Matching active concepts, counted up to 100,000.
    pub total: i64,
    pub total_capped: bool,
}

/// Evaluate against active concepts, returning at most `limit` (capped at
/// the licence bound) in preferred-term order, plus the count.
pub async fn evaluate(
    pool: &PgPool,
    expr: &Ecl,
    limit: i64,
) -> Result<SnomedEclResult, sqlx::Error> {
    let mut params = Vec::new();
    let set = expr.to_sql(&mut params);
    let n = params.len();
    let rows_sql = format!(
        "SELECT c.id::text AS concept_id, c.preferred_term, c.semantic_tag, c.active \
           FROM snomed_concept c WHERE c.active AND c.id IN ({set}) \
          ORDER BY c.preferred_term, c.id LIMIT ${}",
        n + 1
    );
    let mut rows = sqlx::query_as::<_, SnomedConceptSummary>(&rows_sql);
    for id in &params {
        rows = rows.bind(*id);
    }
    let concepts = rows
        .bind(limit.clamp(1, MAX_RESULTS))
        .fetch_all(pool)
        .await?;

    let count_sql = format!(
        "SELECT count(*) FROM (SELECT 1 FROM snomed_concept c \
           WHERE c.active AND c.id IN ({set}) LIMIT ${}) s",
        n + 1
    );
    let mut count = sqlx::query_scalar::<_, i64>(&count_sql);
    for id in &params {
        count = count.bind(*id);
    }
    let total = count.bind(COUNT_CAP + 1).fetch_one(pool).await?;
    Ok(SnomedEclResult {
        concepts,
        total: total.min(COUNT_CAP),
        total_capped: total > COUNT_CAP,
    })
}

#[cfg(test)]
mod tests {
    use super::{BinOp, Ecl, EclError, Focus, parse};

    const A: i64 = 116_680_003;
    const B: i64 = 900_000_000_000_003_001;

    #[test]
    fn parses_each_focus_operator() {
        assert_eq!(parse("116680003"), Ok(Ecl::Focus(Focus::SelfOnly, A)));
        assert_eq!(
            parse("<< 116680003 |Is a|"),
            Ok(Ecl::Focus(Focus::DescendantOrSelf, A))
        );
        assert_eq!(parse("<116680003"), Ok(Ecl::Focus(Focus::Descendant, A)));
        assert_eq!(
            parse(">>116680003"),
            Ok(Ecl::Focus(Focus::AncestorOrSelf, A))
        );
        assert_eq!(parse("> 116680003"), Ok(Ecl::Focus(Focus::Ancestor, A)));
        assert_eq!(parse("^ 116680003"), Ok(Ecl::Focus(Focus::MemberOf, A)));
    }

    #[test]
    fn binary_operators_and_brackets() {
        let minus = parse("<<116680003 minus <<900000000000003001");
        let expected = Ecl::Binary(
            BinOp::Minus,
            Box::new(Ecl::Focus(Focus::DescendantOrSelf, A)),
            Box::new(Ecl::Focus(Focus::DescendantOrSelf, B)),
        );
        assert_eq!(minus, Ok(expected));
        assert!(parse("(<<116680003 AND ^900000000000003001) MINUS 116680003").is_ok());
        assert_eq!(
            parse("116680003 AND 116680003 OR 116680003"),
            Err(EclError::MixedOperators)
        );
        assert!(
            parse("116680003 ANDX 116680003").is_err(),
            "AND must be a whole word"
        );
    }

    #[test]
    fn refuses_bad_input_with_a_reason() {
        assert_eq!(parse("  "), Err(EclError::Empty));
        assert_eq!(
            parse("<<116680004"),
            Err(EclError::BadId("116680004".to_owned()))
        );
        assert!(matches!(
            parse("<< (116680003"),
            Err(EclError::Expected { .. })
        ));
        assert!(matches!(parse("<<"), Err(EclError::Expected { .. })));
        let deep = format!("{}116680003{}", "(".repeat(9), ")".repeat(9));
        assert_eq!(parse(&deep), Err(EclError::TooDeep));
        let many = vec!["116680003"; 17].join(" OR ");
        assert_eq!(parse(&many), Err(EclError::TooManyConcepts));
        assert_eq!(parse(&"1".repeat(1001)), Err(EclError::TooLong));
        assert!(
            parse("116680003 ééé 116680003").is_err(),
            "multi-byte text does not panic"
        );
    }

    #[test]
    fn compiles_to_one_set_expression_with_bound_ids() {
        let mut params = Vec::new();
        let expr = parse("<<116680003 MINUS ^900000000000003001")
            .unwrap_or(Ecl::Focus(Focus::SelfOnly, 0));
        let sql = expr.to_sql(&mut params);
        assert_eq!(params, vec![A, B]);
        assert!(sql.contains(") EXCEPT ("), "{sql}");
        assert!(
            sql.contains("supertype_id = $1") && sql.contains("refset_id = $2"),
            "{sql}"
        );
    }
}
