//! The front desk's one search box: name, phone, UHID or Aadhaar, the server decides.
//!
//! Both patient searches (`GET /api/patients` and `GET /api/patients/find`)
//! match through the SQL built here, so the desk gets the same answer from
//! the directory and the lookup.
//!
//! - **Name**: every word must appear in the first, middle, last or local name,
//!   so "asha sample", "sample asha" and "ash sam" all find Asha Sample.
//! - **Phone**: a query of mostly digits (at least four) is compared digits
//!   only, without a leading `91` or `0`, against the phone and the second phone.
//! - **UHID**: contains, case-insensitive; an exact UHID ranks first.
//! - **Aadhaar**: twelve digits are fingerprinted exactly as registration does
//!   (`identifier_key::keyed_fingerprint`) and matched against
//!   `patient_identifiers.id_number_hash`. The number itself is never bound,
//!   stored or logged; only the keyed fingerprint reaches the database.
//!
//! - **OPD number**: the hospital's own number (per patient, or a visit's),
//!   compared by the integer after any prefix; exact ranks first, digits
//!   contained rank with the partial matches. Nothing changes for a hospital
//!   that keeps no OPD number: no row has one.
//!
//! Ranking: exact UHID, phone, Aadhaar or OPD number first, then names, then
//! partial UHID / phone / OPD number matches.
//!
//! **Search by** one field (`by`): only that field is matched, and the
//! anti-guessing floors are dropped because the desk said what it typed: a
//! phone from three digits, a UHID or OPD number from one character.

use medbrains_server_core::error::AppError;
use medbrains_server_core::state::AppState;
use uuid::Uuid;

use crate::identifier_key;
use crate::local_name;

/// How many bind parameters [`where_sql`] and [`rank_sql`] use, from the first one.
pub(crate) const BINDS: usize = 7;

/// Longest OPD number searched, so the integer always fits a `bigint`.
const MAX_OPD_DIGITS: usize = 12;

/// Which field the desk searches: all of them (the default), or only one.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum SearchBy {
    #[default]
    All,
    Phone,
    Uhid,
    Name,
    OpdNumber,
}

impl SearchBy {
    /// The `by` query parameter; absent is `All`.
    ///
    /// # Errors
    /// [`AppError::BadRequest`] for anything but all, phone, uhid, name or `opd_number`.
    pub fn from_param(by: Option<&str>) -> Result<Self, AppError> {
        match by.map(str::trim) {
            None | Some("" | "all") => Ok(Self::All),
            Some("phone") => Ok(Self::Phone),
            Some("uhid") => Ok(Self::Uhid),
            Some("name") => Ok(Self::Name),
            Some("opd_number") => Ok(Self::OpdNumber),
            Some(_) => Err(AppError::BadRequest(
                "Search by all, phone, uhid, name or opd_number".into(),
            )),
        }
    }
}

/// A stored phone column as digits only, without a leading `91` (12 digits) or `0` (11 digits).
fn phone_digits(column: &str) -> String {
    format!(
        r"regexp_replace(regexp_replace(COALESCE({column}, ''), '\D', '', 'g'), '^(?:91|0)(\d{{10}})$', '\1')"
    )
}

/// What one search box was given, as the values the SQL binds. No `Debug`:
/// nothing here should be printed, though the raw Aadhaar is already gone.
pub(crate) struct PatientSearch {
    /// The query, words single-spaced, for the exact-UHID rank and fuzzy names.
    exact: String,
    /// The words, LIKE-escaped, space separated.
    words: String,
    /// A query typed in an Indian script, LIKE-escaped; empty otherwise.
    local: String,
    /// Phone digits, normalised like [`phone_digits`]; empty when not a phone.
    digits: String,
    /// The Aadhaar fingerprint; empty when the query is not twelve digits.
    aadhaar: String,
    /// The query LIKE-escaped, for a UHID; empty when UHIDs are not searched.
    uhid: String,
    /// The OPD number's digits; empty when OPD numbers are not searched.
    opd: String,
}

impl PatientSearch {
    /// Parse the request's query for the field `by` names, fetching the
    /// fingerprint key only for an Aadhaar-shaped query searched across all fields.
    pub(crate) async fn for_request(
        state: &AppState,
        tenant_id: Uuid,
        query: Option<&str>,
        by: SearchBy,
    ) -> Result<Option<Self>, AppError> {
        let Some(query) = query else {
            return Ok(None);
        };
        let key = if by == SearchBy::All && aadhaar_digits(query).is_some() {
            Some(identifier_key::identifier_key(state).await?)
        } else {
            None
        };
        Ok(Self::parse(query, key.as_deref(), tenant_id).map(|s| s.only(by, query)))
    }

    /// Keep only what `by` searches; `All` is unchanged. A single field takes
    /// what was typed for it without the floors meant to stop guessing.
    fn only(self, by: SearchBy, query: &str) -> Self {
        let none = Self {
            exact: String::new(),
            words: String::new(),
            local: String::new(),
            digits: String::new(),
            aadhaar: String::new(),
            uhid: String::new(),
            opd: String::new(),
        };
        match by {
            SearchBy::All => self,
            SearchBy::Phone => Self {
                digits: phone_by_digits(query).unwrap_or_default(),
                ..none
            },
            SearchBy::Uhid => Self {
                uhid: like_escape(&self.exact),
                exact: self.exact,
                ..none
            },
            SearchBy::Name => Self {
                exact: self.exact,
                words: self.words,
                local: self.local,
                ..none
            },
            SearchBy::OpdNumber => Self {
                opd: opd_digits(query).unwrap_or_default(),
                ..none
            },
        }
    }

    /// Split a query into what each column is matched with; `None` for a blank one.
    /// `key` is the identifier fingerprint key, needed only for an Aadhaar query.
    pub(crate) fn parse(query: &str, key: Option<&[u8]>, tenant_id: Uuid) -> Option<Self> {
        let (latin, native) = local_name::search_terms(query.trim());
        let exact = latin.split_whitespace().collect::<Vec<_>>().join(" ");
        if exact.is_empty() {
            return None;
        }
        // Twelve bare digits are an Aadhaar number and only that: binding them
        // as a name, UHID or phone would hand the number itself to the
        // database (and to any statement log). A phone with its country code
        // is typed with `+91`, which is not Aadhaar-shaped.
        if let Some(digits) = aadhaar_digits(query) {
            let aadhaar = key.map_or_else(String::new, |key| {
                identifier_key::keyed_fingerprint(key, tenant_id, "aadhaar", &digits)
            });
            return Some(Self {
                exact: String::new(),
                words: String::new(),
                local: String::new(),
                digits: String::new(),
                aadhaar,
                uhid: String::new(),
                opd: String::new(),
            });
        }
        Some(Self {
            words: like_escape(&exact),
            local: native.as_deref().map(like_escape).unwrap_or_default(),
            digits: phone_query_digits(query).unwrap_or_default(),
            aadhaar: String::new(),
            uhid: like_escape(&exact),
            opd: opd_digits(query).unwrap_or_default(),
            exact,
        })
    }

    /// The bind values in placeholder order, [`BINDS`] of them.
    pub(crate) fn binds(&self) -> [String; BINDS] {
        [
            self.exact.clone(),
            self.words.clone(),
            self.local.clone(),
            self.digits.clone(),
            self.aadhaar.clone(),
            self.uhid.clone(),
            self.opd.clone(),
        ]
    }

    /// The query for a fuzzy name match; empty when names are not searched.
    pub(crate) fn exact(&self) -> &str {
        if self.words.is_empty() {
            ""
        } else {
            &self.exact
        }
    }
}

/// Twelve digits, spaces or hyphens allowed between them, is an Aadhaar number.
fn aadhaar_digits(query: &str) -> Option<String> {
    let shaped = query
        .trim()
        .chars()
        .all(|c| c.is_ascii_digit() || c == ' ' || c == '-');
    // Reuses registration's normaliser, so search and registration agree on the digits.
    shaped
        .then(|| crate::normalize_aadhaar_number(query))
        .flatten()
}

/// A phone-shaped query (at least four digits; otherwise only spaces, `+`, `-`,
/// brackets) as digits, without a leading `91` (12 digits) or `0` (11 digits).
fn phone_query_digits(query: &str) -> Option<String> {
    let query = query.trim();
    let shaped = query
        .chars()
        .all(|c| c.is_ascii_digit() || " +-()".contains(c));
    let digits: String = query.chars().filter(char::is_ascii_digit).collect();
    if !shaped || digits.len() < 4 {
        return None;
    }
    let national = match digits.len() {
        12 => digits.strip_prefix("91"),
        11 => digits.strip_prefix('0'),
        _ => None,
    };
    Some(national.unwrap_or(&digits).to_owned())
}

/// A phone typed into "search by phone": any three or more digits, compared
/// like [`phone_query_digits`]. Twelve digits not starting `91` are Aadhaar-shaped
/// and never bound.
fn phone_by_digits(query: &str) -> Option<String> {
    let digits: String = query.chars().filter(char::is_ascii_digit).collect();
    if digits.len() < 3 || (digits.len() == 12 && !digits.starts_with("91")) {
        return None;
    }
    let national = match digits.len() {
        12 => digits.strip_prefix("91"),
        11 => digits.strip_prefix('0'),
        _ => None,
    };
    Some(national.unwrap_or(&digits).to_owned())
}

/// The OPD number in a query: its trailing digits, after an optional prefix of
/// letters, `-` or `/` ("OP-1043", "1043"), leading zeros dropped. `None` for
/// anything else, or a number too long to be one.
fn opd_digits(query: &str) -> Option<String> {
    let query = query.trim();
    let head = query.trim_end_matches(|c: char| c.is_ascii_digit());
    let digits = query.get(head.len()..)?.trim_start_matches('0');
    let prefix_ok = head
        .chars()
        .all(|c| c.is_ascii_alphabetic() || c == '-' || c == '/');
    (prefix_ok && !digits.is_empty() && digits.len() <= MAX_OPD_DIGITS).then(|| digits.to_owned())
}

/// Escape LIKE's wildcards so a typed `%` or `_` matches itself.
fn like_escape(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

/// The three tiers of a match, as SQL over `patients`, binds from `$first`.
struct Tiers {
    strong: String,
    name: String,
    partial: String,
}

/// Build the tiers. Placeholders: exact, words, local, digits, aadhaar, uhid, opd.
fn tiers(first: usize) -> Tiers {
    let (e, w, l, d, a) = (first, first + 1, first + 2, first + 3, first + 4);
    let (u, o) = (first + 5, first + 6);
    let opd = |c: &str| format!("(substring({c} FROM '([0-9]+)$'))::bigint");
    let (phone, phone2) = (phone_digits("phone"), phone_digits("phone_secondary"));
    let strong = format!(
        "((${u} <> '' AND lower(uhid) = lower(${e})) \
          OR (${d} <> '' AND ({phone} = ${d} OR {phone2} = ${d})) \
          OR (${o} <> '' AND ({own} = NULLIF(${o}, '')::bigint \
               OR EXISTS (SELECT 1 FROM encounters oe \
                 WHERE oe.tenant_id = patients.tenant_id AND oe.patient_id = patients.id \
                   AND oe.deleted_at IS NULL AND oe.encounter_number IS NOT NULL \
                   AND {visit} = NULLIF(${o}, '')::bigint))) \
          OR (${a} <> '' AND EXISTS (SELECT 1 FROM patient_identifiers pi \
               WHERE pi.tenant_id = patients.tenant_id AND pi.patient_id = patients.id \
                 AND pi.id_type = 'aadhaar' AND pi.deleted_at IS NULL \
                 AND pi.id_number_hash = ${a})))",
        own = opd("opd_number"),
        visit = opd("oe.encounter_number"),
    );
    // ponytail: per-row word scan, no index; fine at a few lakh patients,
    // a trigram index on the concatenated name if the register outgrows it.
    let name = format!(
        "((${w} <> '' AND NOT EXISTS (SELECT 1 FROM unnest(string_to_array(${w}, ' ')) AS sw(t) \
            WHERE concat_ws(' ', first_name, middle_name, last_name, full_name_local) \
                  NOT ILIKE '%' || sw.t || '%')) \
          OR (${l} <> '' AND full_name_local LIKE '%' || ${l} || '%'))"
    );
    let raw = |c: &str| format!(r"regexp_replace(COALESCE({c}, ''), '\D', '', 'g')");
    let partial = format!(
        "((${u} <> '' AND uhid ILIKE '%' || ${u} || '%') \
          OR (${o} <> '' AND opd_number LIKE '%' || ${o} || '%') \
          OR (${d} <> '' AND ({} LIKE '%' || ${d} || '%' OR {} LIKE '%' || ${d} || '%')))",
        raw("phone"),
        raw("phone_secondary"),
    );
    Tiers {
        strong,
        name,
        partial,
    }
}

/// The search's WHERE predicate over `patients`, binding [`BINDS`] values from `$first`.
pub(crate) fn where_sql(first: usize) -> String {
    let t = tiers(first);
    format!("({} OR {} OR {})", t.strong, t.name, t.partial)
}

/// The search's rank over `patients`: 0 exact UHID / phone / Aadhaar, 1 name,
/// 2 partial UHID / phone, 3 not matched here. Same binds as [`where_sql`].
pub(crate) fn rank_sql(first: usize) -> String {
    let t = tiers(first);
    format!(
        "(CASE WHEN {} THEN 0 WHEN {} THEN 1 WHEN {} THEN 2 ELSE 3 END)",
        t.strong, t.name, t.partial
    )
}

#[cfg(test)]
mod tests {
    #![allow(clippy::panic)]
    use super::{
        PatientSearch, SearchBy, aadhaar_digits, opd_digits, phone_query_digits, where_sql,
    };
    use uuid::Uuid;

    /// Every way the desk types a phone number comes down to the same ten digits.
    #[test]
    fn phone_forms_normalise() {
        for q in [
            "9000012345",
            "90000 12345",
            "+919000012345",
            "+91 90000 12345",
            "09000012345",
        ] {
            assert_eq!(phone_query_digits(q).as_deref(), Some("9000012345"), "{q}");
        }
        assert_eq!(phone_query_digits("12345").as_deref(), Some("12345"));
        assert_eq!(phone_query_digits("123"), None);
        assert_eq!(phone_query_digits("asha 12345"), None);
    }

    /// Only twelve digits (spaces allowed) is an Aadhaar; a `+91` phone is not.
    #[test]
    fn aadhaar_shape() {
        assert!(aadhaar_digits("1234 5678 9012").is_some());
        assert!(aadhaar_digits("123456789012").is_some());
        assert!(aadhaar_digits("+919000012345").is_none());
        // Without the `+`, twelve digits are taken as an Aadhaar number.
        assert!(aadhaar_digits("919000012345").is_some());
        assert!(aadhaar_digits("12345678901").is_none());
        assert!(aadhaar_digits("abcd12345678901").is_none());
    }

    /// Without the key, an Aadhaar-shaped query binds no fingerprint; with it,
    /// the fingerprint is registration's and the digits are never bound.
    #[test]
    fn aadhaar_binds_only_the_fingerprint() {
        let tenant = Uuid::nil();
        let q = "1234 5678 9012";
        let without = PatientSearch::parse(q, None, tenant).map(|s| s.aadhaar);
        assert_eq!(without.as_deref(), Some(""));
        let key = b"search-test-key";
        let Some(with) = PatientSearch::parse(q, Some(key), tenant) else {
            panic!("a twelve-digit query is a search");
        };
        let expected =
            crate::identifier_key::keyed_fingerprint(key, tenant, "aadhaar", "123456789012");
        assert_eq!(with.aadhaar, expected);
        let binds = with.binds();
        assert!(
            binds
                .iter()
                .all(|b| !b.contains("5678") && !b.contains("9012"))
        );
    }

    /// Blank queries are no search; words are single-spaced and LIKE-escaped.
    #[test]
    fn words_and_escapes() {
        assert!(PatientSearch::parse("   ", None, Uuid::nil()).is_none());
        let Some(s) = PatientSearch::parse("  Asha   50%_ ", None, Uuid::nil()) else {
            panic!("a search");
        };
        assert_eq!(s.exact, "Asha 50%_");
        assert_eq!(s.words, "Asha 50\\%\\_");
    }

    /// The predicate uses exactly its seven placeholders, so a caller's bind
    /// count cannot drift from the SQL.
    #[test]
    fn placeholders_are_contiguous() {
        let sql = where_sql(7);
        for n in 7..14 {
            assert!(sql.contains(&format!("${n}")), "${n}");
        }
        assert!(!sql.contains("$6") && !sql.contains("$14"));
    }

    /// An OPD number is its trailing digits after an optional prefix.
    #[test]
    fn opd_number_forms() {
        assert_eq!(opd_digits("1043").as_deref(), Some("1043"));
        assert_eq!(opd_digits(" OP-01043 ").as_deref(), Some("1043"));
        assert_eq!(opd_digits("OPD/7").as_deref(), Some("7"));
        for no in ["", "asha", "12 34", "0", "1234567890123", "a1b2"] {
            assert_eq!(opd_digits(no), None, "{no:?}");
        }
    }

    /// One field searched is only that field; a bad `by` is refused.
    #[test]
    fn search_by_one_field() {
        let tenant = Uuid::nil();
        let only =
            |q: &str, by| PatientSearch::parse(q, None, tenant).map(|s| s.only(by, q).binds());
        let phone = only("123", SearchBy::Phone).unwrap_or_default();
        assert_eq!(phone[3], "123", "phone from three digits");
        assert!(
            phone
                .iter()
                .enumerate()
                .all(|(i, b)| i == 3 || b.is_empty())
        );
        let uhid = only("12345", SearchBy::Uhid).unwrap_or_default();
        assert!(
            uhid[3].is_empty() && uhid[6].is_empty(),
            "UHID never matches phone digits"
        );
        assert_eq!(uhid[5], "12345");
        let opd = only("OP-7", SearchBy::OpdNumber).unwrap_or_default();
        assert_eq!(opd[6], "7");
        let all = PatientSearch::parse("1234", None, tenant)
            .map(|s| s.binds())
            .unwrap_or_default();
        assert_eq!(
            (all[3].as_str(), all[6].as_str()),
            ("1234", "1234"),
            "all: phone and OPD"
        );
        assert!(SearchBy::from_param(Some("email")).is_err());
        assert_eq!(SearchBy::from_param(None).ok(), Some(SearchBy::All));
    }
}

#[cfg(test)]
mod db_tests {
    // The desk's search against a real database, as the request role under RLS:
    // name words, phone forms, UHID, Aadhaar, ranking, tenant wall, soft delete.
    //
    //   `make test-db && cargo test -p medbrains-patients search::db_tests`
    //
    // Patients are planted as the owner; the Aadhaar goes in through
    // registration's own `persist_registration_identifiers` with registration's
    // fingerprint, so search is proved against what registration stores.
    #![allow(clippy::expect_used, clippy::panic)]

    use medbrains_db_migrations::testing::{APP_ROLE, TestDb, add_tenant, fresh_db};
    use uuid::Uuid;

    use crate::identifier_key::keyed_fingerprint;
    use crate::search::{PatientSearch, SearchBy};
    use crate::{MatchResult, find_matches, persist_registration_identifiers};

    /// The fingerprint key for this test; production reads it from the secret store.
    const KEY: &[u8] = b"search-db-test-identifier-key";
    const AADHAAR: &str = "123456789012";

    /// One hospital's planted rows: Asha Sample, plus the patients that test her rank.
    struct Plant {
        tenant: Uuid,
        asha: Uuid,
    }

    /// Insert a patient as the owner and return its id.
    async fn add(
        db: &sqlx::PgPool,
        tenant: Uuid,
        row: (&str, &str, &str, &str),
        deleted: bool,
    ) -> Uuid {
        let (uhid, first, last, phone) = row;
        let id = Uuid::new_v4();
        let deleted_at = if deleted { "now()" } else { "NULL" };
        sqlx::raw_sql(&format!(
            "INSERT INTO patients (id, tenant_id, uhid, first_name, last_name, gender, phone, deleted_at) \
             VALUES ('{id}', '{tenant}', '{uhid}', '{first}', '{last}', 'female', '{phone}', {deleted_at})"
        ))
        .execute(db)
        .await
        .expect("insert patient");
        id
    }

    /// Store the Aadhaar exactly as registration does: masked number, keyed fingerprint.
    async fn add_aadhaar(app: &sqlx::PgPool, tenant: Uuid, patient: Uuid) {
        let mut tx = app.begin().await.expect("tx");
        medbrains_kernel::enter_scope(
            &mut tx,
            &medbrains_kernel::Permit::unattended(tenant, "test"),
            &[],
        )
        .await
        .expect("context");
        let fp = keyed_fingerprint(KEY, tenant, "aadhaar", AADHAAR);
        persist_registration_identifiers(
            &mut tx,
            tenant,
            patient,
            None,
            None,
            Some(AADHAAR),
            Some(&fp),
        )
        .await
        .expect("identifiers");
        tx.commit().await.expect("commit");
    }

    /// A hospital with Asha (with Aadhaar), a deleted Asha twin, and two near misses.
    async fn plant(db: &TestDb, code: &str) -> Plant {
        let owner = db.owner().await.expect("owner");
        let app = db.connect(APP_ROLE).await.expect("app");
        let tenant = add_tenant(&owner, code).await.expect("tenant");
        let asha = add(
            &owner,
            tenant,
            (
                &format!("{code}-000101"),
                "Asha",
                "Sample",
                "+91 90000 12345",
            ),
            false,
        )
        .await;
        add_aadhaar(&app, tenant, asha).await;
        let twin = add(
            &owner,
            tenant,
            (
                &format!("{code}-000102"),
                "Asha",
                "Sample",
                "+91 90000 12345",
            ),
            true,
        )
        .await;
        add_aadhaar(&app, tenant, twin).await;
        // Contains Asha's UHID and her phone digits: a partial match, ranked below her.
        add(
            &owner,
            tenant,
            (&format!("{code}-0001010"), "Ravi", "Kumar", "890000123456"),
            false,
        )
        .await;
        add(
            &owner,
            tenant,
            (&format!("{code}-000200"), "Meena", "Iyer", "9800011111"),
            false,
        )
        .await;
        Plant { tenant, asha }
    }

    /// Run the desk lookup's query as the request role in `tenant`.
    async fn find(db: &TestDb, tenant: Uuid, q: &str) -> Vec<MatchResult> {
        let app = db.connect(APP_ROLE).await.expect("app");
        let mut tx = app.begin().await.expect("tx");
        medbrains_kernel::enter_scope(
            &mut tx,
            &medbrains_kernel::Permit::unattended(tenant, "test"),
            &[],
        )
        .await
        .expect("context");
        let Some(matcher) = PatientSearch::parse(q, Some(KEY), tenant) else {
            return Vec::new();
        };
        find_matches(&mut tx, tenant, &matcher)
            .await
            .expect("search")
    }

    /// [`find`] for one field.
    async fn find_by(db: &TestDb, tenant: Uuid, q: &str, by: SearchBy) -> Vec<MatchResult> {
        let app = db.connect(APP_ROLE).await.expect("app");
        let mut tx = app.begin().await.expect("tx");
        medbrains_kernel::enter_scope(
            &mut tx,
            &medbrains_kernel::Permit::unattended(tenant, "test"),
            &[],
        )
        .await
        .expect("context");
        let Some(matcher) = PatientSearch::parse(q, Some(KEY), tenant).map(|s| s.only(by, q))
        else {
            return Vec::new();
        };
        find_matches(&mut tx, tenant, &matcher)
            .await
            .expect("search")
    }

    /// Give a planted patient an OPD number, as the owner.
    async fn set_opd(db: &TestDb, patient: Uuid, number: &str) {
        let owner = db.owner().await.expect("owner");
        sqlx::query("UPDATE patients SET opd_number = $2, opd_date = CURRENT_DATE WHERE id = $1")
            .bind(patient)
            .bind(number)
            .execute(&owner)
            .await
            .expect("opd number");
    }

    #[tokio::test]
    async fn search_db_opd_number_ranks_exact_first_and_stays_in_its_hospital() {
        let db = fresh_db().await.expect("test database");
        let a = plant(&db, "SOA").await;
        let b = plant(&db, "SOB").await;
        // No OPD numbers yet (mode off): an OPD search finds nobody, and the
        // usual phone search is unchanged.
        assert!(
            find_by(&db, a.tenant, "1043", SearchBy::OpdNumber)
                .await
                .is_empty()
        );
        let before: Vec<Uuid> = find(&db, a.tenant, "12345")
            .await
            .iter()
            .map(|r| r.id)
            .collect();
        set_opd(&db, a.asha, "1043").await;
        set_opd(&db, b.asha, "777").await;
        let ravi = find(&db, a.tenant, "ravi kumar")
            .await
            .first()
            .map(|r| r.id)
            .expect("ravi");
        set_opd(&db, ravi, "21043").await;
        for (q, by) in [
            ("1043", SearchBy::All),
            ("OP-1043", SearchBy::OpdNumber),
            ("1043", SearchBy::OpdNumber),
        ] {
            let rows = find_by(&db, a.tenant, q, by).await;
            assert_eq!(
                rows.first().map(|r| r.id),
                Some(a.asha),
                "{q:?} {by:?}: exact first"
            );
            assert_eq!(
                rows.first().and_then(|r| r.opd_number.clone()).as_deref(),
                Some("1043")
            );
            assert!(
                rows.iter().any(|r| r.id == ravi),
                "{q:?}: 21043 contains it, ranked after"
            );
        }
        assert!(
            find_by(&db, a.tenant, "777", SearchBy::OpdNumber)
                .await
                .is_empty(),
            "another hospital's"
        );
        let after: Vec<Uuid> = find(&db, a.tenant, "12345")
            .await
            .iter()
            .map(|r| r.id)
            .collect();
        assert_eq!(before, after, "a phone search does not move");
    }

    #[tokio::test]
    async fn search_db_by_one_field() {
        let db = fresh_db().await.expect("test database");
        let a = plant(&db, "SBF").await;
        // Three digits find by phone only when the desk says it is a phone.
        assert!(
            find_by(&db, a.tenant, "345", SearchBy::Phone)
                .await
                .iter()
                .any(|r| r.id == a.asha)
        );
        assert!(
            find(&db, a.tenant, "345")
                .await
                .iter()
                .all(|r| r.id != a.asha),
            "all: 4+ digits"
        );
        // A UHID search does not match phone digits, nor a name.
        assert!(
            find_by(&db, a.tenant, "12345", SearchBy::Uhid)
                .await
                .is_empty()
        );
        assert!(
            find_by(&db, a.tenant, "asha", SearchBy::Uhid)
                .await
                .is_empty()
        );
        let uhid = find_by(&db, a.tenant, "sbf-000101", SearchBy::Uhid).await;
        assert_eq!(uhid.first().map(|r| r.id), Some(a.asha));
        // A name search does not match a UHID or phone.
        assert!(
            find_by(&db, a.tenant, "sbf-000101", SearchBy::Name)
                .await
                .is_empty()
        );
        assert_eq!(
            find_by(&db, a.tenant, "asha", SearchBy::Name)
                .await
                .first()
                .map(|r| r.id),
            Some(a.asha)
        );
    }

    #[tokio::test]
    async fn search_db_finds_by_name_phone_uhid_and_aadhaar() {
        let db = fresh_db().await.expect("test database");
        let a = plant(&db, "SRA").await;
        let b = plant(&db, "SRB").await;
        let other_tenant_ids = [b.asha];

        for q in [
            "asha sample",
            "sample asha",
            "ash sam",
            "  ASHA   sample ",
            "9000012345",
            "90000 12345",
            "+919000012345",
            "09000012345",
            "12345",
            "sra-000101",
            "a-00010",
            "1234 5678 9012",
            "1234-5678-9012",
        ] {
            let rows = find(&db, a.tenant, q).await;
            assert!(rows.iter().any(|r| r.id == a.asha), "{q:?} finds Asha");
            assert!(
                rows.iter().all(|r| !other_tenant_ids.contains(&r.id)),
                "{q:?} stays in its hospital"
            );
            assert_eq!(
                rows.iter().filter(|r| r.first_name == "Asha").count(),
                1,
                "{q:?}: deleted twin hidden"
            );
            let body = serde_json::to_string(&rows).expect("json");
            assert!(
                !body.contains(AADHAAR) && !body.contains("5678"),
                "{q:?}: no Aadhaar in the response"
            );
        }
    }

    #[tokio::test]
    async fn search_db_ranks_exact_first_and_refuses_wrong_aadhaar() {
        let db = fresh_db().await.expect("test database");
        let a = plant(&db, "SRC").await;

        // Exact UHID and exact phone beat the patient whose UHID / phone contains them.
        for q in [
            "src-000101",
            "9000012345",
            "+91 90000 12345",
            "1234 5678 9012",
        ] {
            let rows = find(&db, a.tenant, q).await;
            assert_eq!(
                rows.first().map(|r| r.id),
                Some(a.asha),
                "{q:?} ranks Asha first"
            );
            assert!(
                rows.first().is_some_and(|r| (r.score - 1.0).abs() < 1e-9),
                "{q:?} exact"
            );
        }
        let partial = find(&db, a.tenant, "9000012345").await;
        assert!(
            partial.iter().any(|r| r.first_name == "Ravi"),
            "phone digits contained"
        );
        let names = find(&db, a.tenant, "sample asha").await;
        assert_eq!(names.first().map(|r| r.id), Some(a.asha));

        // A wrong Aadhaar, or a right one without the key, finds nobody.
        assert!(
            find(&db, a.tenant, "9999 8888 7777").await.is_empty(),
            "wrong Aadhaar"
        );
        let app = db.connect(APP_ROLE).await.expect("app");
        let mut tx = app.begin().await.expect("tx");
        medbrains_kernel::enter_scope(
            &mut tx,
            &medbrains_kernel::Permit::unattended(a.tenant, "test"),
            &[],
        )
        .await
        .expect("context");
        let keyless = PatientSearch::parse(AADHAAR, None, a.tenant).expect("search");
        let rows = find_matches(&mut tx, a.tenant, &keyless)
            .await
            .expect("search");
        assert!(rows.is_empty(), "no fingerprint, no match");
        // One shared word is not a name match: at most a fuzzy one, ranked below names.
        let mixed = find(&db, a.tenant, "asha kumar").await;
        assert!(mixed.iter().all(|r| r.score < 0.9), "every word must match");
    }
}
