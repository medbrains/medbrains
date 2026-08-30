//! The WHERE clause for `GET /api/lab/orders`, built with its bind values.
//!
//! This lived in `list_orders` as two lists that had to agree by hand, and they
//! did not. The ReBAC scope condition `id = ANY($2)` claimed its placeholder
//! before the filters, while its value was bound *after* them. So a caller who
//! is scoped by ReBAC -- a nurse, a quality officer, anyone who is not a bypass
//! role -- and who also picked a status sent the status string where Postgres
//! expected a uuid array, and got a 500 instead of their worklist.
//!
//! With no filter applied the two orders coincided, which is why every
//! unfiltered list worked and the fault stayed hidden behind the one call
//! nobody makes without a filter.
//!
//! Building each condition together with its value, in one list, makes that
//! class of mismatch unrepresentable rather than merely fixed.

use uuid::Uuid;

use crate::ListOrdersQuery;

/// A value bound to the clause, held in placeholder order.
#[derive(Debug, PartialEq, Eq)]
pub(crate) enum Bind {
    Uuid(Uuid),
    Text(String),
    UuidList(Vec<Uuid>),
}

/// Build the clause and its binds.
///
/// `$1` is always the tenant and is bound by the caller. Returns the clause,
/// the binds for `$2` onward in that exact order, and the next free
/// placeholder index for the caller's LIMIT/OFFSET.
pub(crate) fn build_order_filter(
    params: &ListOrdersQuery,
    visible_ids: Option<&[Uuid]>,
) -> (String, Vec<Bind>, usize) {
    let mut conditions = vec!["tenant_id = $1".to_owned()];
    let mut binds = Vec::new();
    let mut idx = 2_usize;

    // Each arm pushes a condition and the value that fills it, adjacent, so
    // the two orders cannot drift apart again.
    if let Some(ids) = visible_ids {
        conditions.push(format!("id = ANY(${idx}::uuid[])"));
        binds.push(Bind::UuidList(ids.to_vec()));
        idx += 1;
    }
    if let Some(status) = params.status.as_ref() {
        conditions.push(format!("status::text = ${idx}"));
        binds.push(Bind::Text(status.clone()));
        idx += 1;
    }
    if let Some(priority) = params.priority.as_ref() {
        conditions.push(format!("priority::text = ${idx}"));
        binds.push(Bind::Text(priority.clone()));
        idx += 1;
    }
    if let Some(patient_id) = params.patient_id {
        conditions.push(format!("patient_id = ${idx}"));
        binds.push(Bind::Uuid(patient_id));
        idx += 1;
    }
    // One box, four haystacks. Anchored with a trailing wildcard only
    // (`term%`) on the identifier columns so the existing btree indexes are
    // usable; the name is matched anywhere because people are found by their
    // second name as often as their first.
    if let Some(term) = params.q.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
        conditions.push(format!(
            "(sample_barcode ILIKE ${idx} \
              OR EXISTS (SELECT 1 FROM patients p \
                         WHERE p.id = lab_orders.patient_id \
                           AND p.tenant_id = lab_orders.tenant_id \
                           AND (p.uhid ILIKE ${idx} OR p.phone ILIKE ${idx} \
                                OR (p.first_name || ' ' || p.last_name) ILIKE ${wild})) \
              OR EXISTS (SELECT 1 FROM lab_test_catalog tc \
                         WHERE tc.id = lab_orders.test_id \
                           AND (tc.name ILIKE ${wild} OR tc.code ILIKE ${idx})))",
            idx = idx,
            wild = idx + 1
        ));
        binds.push(Bind::Text(format!("{term}%")));
        binds.push(Bind::Text(format!("%{term}%")));
        idx += 2;
    }
    if let Some(encounter_id) = params.encounter_id {
        conditions.push(format!("encounter_id = ${idx}"));
        binds.push(Bind::Uuid(encounter_id));
        idx += 1;
    }

    (conditions.join(" AND "), binds, idx)
}

#[cfg(test)]
mod tests {
    use super::{Bind, build_order_filter};
    use crate::ListOrdersQuery;
    use uuid::Uuid;

    fn query() -> ListOrdersQuery {
        ListOrdersQuery {
            q: None,
            page: None,
            per_page: None,
            status: None,
            priority: None,
            patient_id: None,
            encounter_id: None,
        }
    }

    /// Reads the `$n` out of the clause in the order they appear, so a test
    /// asserts against the numbering Postgres will actually see.
    fn placeholders(clause: &str) -> Vec<usize> {
        clause
            .split('$')
            .skip(1)
            .filter_map(|rest| {
                let digits: String = rest.chars().take_while(char::is_ascii_digit).collect();
                digits.parse().ok()
            })
            .collect()
    }

    #[test]
    fn scope_and_filter_together_bind_in_placeholder_order() {
        // The regression. Before the fix the clause read
        // `id = ANY($2) AND status::text = $3` while the values went out as
        // (status, ids) -- a uuid array arriving at $3 where text was expected.
        let ids = vec![Uuid::from_u128(1), Uuid::from_u128(2)];
        let mut params = query();
        params.status = Some("pending".to_owned());

        let (clause, binds, next) = build_order_filter(&params, Some(&ids));

        assert_eq!(clause, "tenant_id = $1 AND id = ANY($2::uuid[]) AND status::text = $3");
        assert_eq!(binds, vec![Bind::UuidList(ids), Bind::Text("pending".to_owned())]);
        assert_eq!(next, 4, "LIMIT/OFFSET take $4 and $5");
    }

    #[test]
    fn every_placeholder_is_numbered_in_sequence_with_its_bind() {
        // Guards all four filters at once: whatever the caller passes, the nth
        // bind must fill the nth placeholder after the tenant.
        let ids = vec![Uuid::from_u128(9)];
        let params = ListOrdersQuery {
            q: None,
            page: None,
            per_page: None,
            status: Some("verified".to_owned()),
            priority: Some("stat".to_owned()),
            patient_id: Some(Uuid::from_u128(7)),
            encounter_id: Some(Uuid::from_u128(8)),
        };

        let (clause, binds, next) = build_order_filter(&params, Some(&ids));

        assert_eq!(placeholders(&clause), vec![1, 2, 3, 4, 5, 6]);
        assert_eq!(binds.len(), 5, "$1 is the tenant, bound by the caller");
        assert_eq!(next, 7);
        assert_eq!(
            binds,
            vec![
                Bind::UuidList(ids),
                Bind::Text("verified".to_owned()),
                Bind::Text("stat".to_owned()),
                Bind::Uuid(Uuid::from_u128(7)),
                Bind::Uuid(Uuid::from_u128(8)),
            ]
        );
    }

    #[test]
    fn an_unscoped_caller_still_gets_their_filters() {
        // The bypass path, which is the one that always worked.
        let mut params = query();
        params.priority = Some("urgent".to_owned());

        let (clause, binds, next) = build_order_filter(&params, None);

        assert_eq!(clause, "tenant_id = $1 AND priority::text = $2");
        assert_eq!(binds, vec![Bind::Text("urgent".to_owned())]);
        assert_eq!(next, 3);
    }

    #[test]
    fn no_scope_and_no_filter_is_the_tenant_alone() {
        let (clause, binds, next) = build_order_filter(&query(), None);

        assert_eq!(clause, "tenant_id = $1");
        assert!(binds.is_empty());
        assert_eq!(next, 2);
    }

    /// The search term is the only filter that pushes two binds for one
    /// condition — a prefix form for the identifier columns and a wildcard
    /// form for names — so it is the one most likely to desynchronise the
    /// placeholder numbering from the bind list.
    #[test]
    fn a_search_term_binds_both_of_its_forms_in_order() {
        let params = ListOrdersQuery {
            q: Some("  Sundaram  ".to_owned()),
            ..query()
        };
        let (clause, binds, next) = build_order_filter(&params, None);

        assert_eq!(
            binds.len(),
            2,
            "prefix and wildcard forms, and nothing else"
        );
        match (&binds[0], &binds[1]) {
            (Bind::Text(prefix), Bind::Text(wild)) => {
                // Trimmed: a term pasted from a requisition slip carries
                // whitespace, and "Sundaram " would match nothing.
                assert_eq!(prefix, "Sundaram%");
                assert_eq!(wild, "%Sundaram%");
            }
            other => panic!("expected two text binds, got {other:?}"),
        }

        assert!(clause.contains("$2"), "the prefix form fills $2");
        assert!(clause.contains("$3"), "the wildcard form fills $3");
        assert_eq!(next, 4, "the next free placeholder follows both");
    }

    /// Whitespace alone is not a search. Treating it as one would replace the
    /// whole worklist with the orders whose barcode happens to start with a
    /// space, which is none of them.
    #[test]
    fn a_blank_search_term_is_not_a_filter() {
        let params = ListOrdersQuery {
            q: Some("   ".to_owned()),
            ..query()
        };
        let (_, binds, next) = build_order_filter(&params, None);
        assert!(binds.is_empty());
        assert_eq!(next, 2);
    }
}
