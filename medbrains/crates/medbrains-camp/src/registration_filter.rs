//! The WHERE clause for `GET /api/camp/registrations`, built with its binds.
//!
//! The screen already had a search box. It filtered in the browser, over the
//! rows the page happened to be holding — and the handler returns
//! `ORDER BY created_at DESC LIMIT 500`. So at a camp that registered more
//! than five hundred people, typing a name searched only the most recent
//! five hundred and reported nothing for anyone earlier in the day. A search
//! that quietly stops looking is worse than no search, because the answer
//! looks the same as "not registered".
//!
//! Built as a pure function returning the clause with its bind values in
//! placeholder order, so the two cannot drift apart, and so the ordering can
//! be tested without a database.

use uuid::Uuid;

use crate::ListRegistrationsQuery;

/// A value bound to the clause, held in placeholder order.
#[derive(Debug, PartialEq, Eq)]
pub(crate) enum Bind {
    Uuid(Uuid),
    Text(String),
}

/// Build the clause and its binds.
///
/// `$1` is always the tenant and is bound by the caller. Returns the clause,
/// the binds for `$2` onward in that exact order, and the next free
/// placeholder index for the caller's LIMIT.
pub(crate) fn build_registration_filter(
    params: &ListRegistrationsQuery,
) -> (String, Vec<Bind>, usize) {
    let mut conditions = vec!["tenant_id = $1".to_owned()];
    let mut binds = Vec::new();
    let mut idx = 2_usize;

    if let Some(camp_id) = params.camp_id {
        conditions.push(format!("camp_id = ${idx}"));
        binds.push(Bind::Uuid(camp_id));
        idx += 1;
    }
    if let Some(status) = params.status.as_ref() {
        conditions.push(format!("status::text = ${idx}"));
        binds.push(Bind::Text(status.clone()));
        idx += 1;
    }
    if let Some(patient_id) = params.patient_id {
        conditions.push(format!("patient_id = ${idx}"));
        binds.push(Bind::Uuid(patient_id));
        idx += 1;
    }
    // One box, five haystacks, matching what the browser filter searched.
    //
    // Identifiers are anchored with a trailing wildcard only (`term%`) so a
    // btree index stays usable and so a partial registration number read off
    // a slip finds its row. The name and the complaint are matched anywhere:
    // people are found by their second name as often as their first, and a
    // complaint is a phrase somebody remembers a word from.
    if let Some(term) = params.q.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
        conditions.push(format!(
            "(registration_number ILIKE ${idx} \
              OR phone ILIKE ${idx} \
              OR id_proof_number ILIKE ${idx} \
              OR person_name ILIKE ${wild} \
              OR chief_complaint ILIKE ${wild})",
            idx = idx,
            wild = idx + 1
        ));
        binds.push(Bind::Text(format!("{term}%")));
        binds.push(Bind::Text(format!("%{term}%")));
        idx += 2;
    }

    (conditions.join(" AND "), binds, idx)
}

#[cfg(test)]
mod tests {
    use super::{Bind, build_registration_filter};
    use crate::ListRegistrationsQuery;
    use uuid::Uuid;

    fn query() -> ListRegistrationsQuery {
        ListRegistrationsQuery {
            camp_id: None,
            status: None,
            patient_id: None,
            q: None,
        }
    }

    /// The search term fills two placeholders, and they must be pushed in the
    /// order the clause names them — prefix first, wildcard second. Swapping
    /// them still runs and still returns rows, so nothing fails loudly; it
    /// just matches the wrong things.
    #[test]
    fn a_search_term_binds_both_of_its_forms_in_order() {
        let params = ListRegistrationsQuery {
            q: Some("  Sundaram  ".to_owned()),
            ..query()
        };
        let (clause, binds, next) = build_registration_filter(&params);

        assert!(clause.contains("registration_number ILIKE $2"));
        assert!(clause.contains("person_name ILIKE $3"));
        assert_eq!(
            binds,
            vec![
                Bind::Text("Sundaram%".to_owned()),
                Bind::Text("%Sundaram%".to_owned()),
            ],
            "the trimmed term is bound prefix-first, then wildcard"
        );
        assert_eq!(next, 4, "the caller's LIMIT takes the next free placeholder");
    }

    /// Every filter ahead of the search shifts its placeholders, which is the
    /// exact arithmetic that went wrong in the lab equivalent.
    #[test]
    fn earlier_filters_shift_the_search_placeholders() {
        let params = ListRegistrationsQuery {
            camp_id: Some(Uuid::nil()),
            status: Some("screened".to_owned()),
            q: Some("REG-42".to_owned()),
            ..query()
        };
        let (clause, binds, next) = build_registration_filter(&params);

        assert!(clause.contains("camp_id = $2"));
        assert!(clause.contains("status::text = $3"));
        assert!(clause.contains("registration_number ILIKE $4"));
        assert!(clause.contains("person_name ILIKE $5"));
        assert_eq!(binds.len(), 4);
        assert_eq!(next, 6);
    }

    /// A blank box is not a filter that matches nothing.
    #[test]
    fn a_blank_search_term_is_not_a_filter() {
        for blank in ["", "   "] {
            let params = ListRegistrationsQuery {
                q: Some(blank.to_owned()),
                ..query()
            };
            let (clause, binds, next) = build_registration_filter(&params);
            assert_eq!(clause, "tenant_id = $1");
            assert!(binds.is_empty());
            assert_eq!(next, 2);
        }
    }
}
