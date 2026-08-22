//! Reading the registers to find out when each obligation was last met.
//!
//! Kept apart from [`crate::norms`] so the judgement — what counts as late —
//! stays testable without a database, and this file is only the lookup.

use crate::norms::{Assessment, Norm, assess_all};
use chrono::{DateTime, Utc};
use sqlx::{PgPool, Row};
use uuid::Uuid;

/// Column names that may appear in a generated query.
///
/// The catalogue is compiled in, so these are not user input today. They are
/// checked anyway: a norm loaded from a database later would be, and a table
/// name concatenated into SQL is the kind of thing that stops being safe
/// quietly, one refactor after somebody made the catalogue configurable.
fn is_safe_identifier(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 63
        && value.starts_with(|c: char| c.is_ascii_lowercase() || c == '_')
        && value.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
}

/// When this obligation was last met, according to its register.
///
/// `None` covers both "the register is empty" and "the register does not
/// exist" — a table that has not been created yet means the hospital is not
/// recording this, which is exactly the answer the caller wants.
pub async fn last_met(
    pool: &PgPool,
    tenant_id: Uuid,
    norm: &Norm,
) -> Option<DateTime<Utc>> {
    if !is_safe_identifier(norm.source_table) || !is_safe_identifier(norm.source_date_column) {
        tracing::error!(code = norm.code, "norm names a register that cannot be queried");
        return None;
    }

    // Identifiers cannot be bound as parameters; the tenant can, and is.
    let sql = format!(
        "SELECT max({column}) AS last FROM public.{table} WHERE tenant_id = $1",
        column = norm.source_date_column,
        table = norm.source_table,
    );

    match sqlx::query(&sql).bind(tenant_id).fetch_one(pool).await {
        Ok(row) => row.try_get::<Option<DateTime<Utc>>, _>("last").ok().flatten(),
        Err(error) => {
            tracing::warn!(
                code = norm.code,
                register = norm.source_table,
                %error,
                "could not read a compliance register"
            );
            None
        }
    }
}

/// Where every obligation stands for one hospital, worst first.
///
/// One query per norm rather than one big union: the catalogue is short, the
/// queries are indexed, and a union over tables that may not all exist fails
/// as a whole rather than degrading to "we cannot see that one".
pub async fn assess_tenant(
    pool: &PgPool,
    tenant_id: Uuid,
    catalogue: &[Norm],
    now: DateTime<Utc>,
) -> Vec<Assessment> {
    let mut dates: Vec<(&str, Option<DateTime<Utc>>)> = Vec::with_capacity(catalogue.len());

    // Bounded loop (Power of 10 rule 2): the catalogue is a compiled-in list.
    for norm in catalogue {
        dates.push((norm.code, last_met(pool, tenant_id, norm).await));
    }

    let lookup = |norm: &Norm| {
        dates
            .iter()
            .find(|(code, _)| *code == norm.code)
            .and_then(|(_, when)| *when)
    };

    assess_all(catalogue, &lookup, now)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ordinary_table_names_are_queryable() {
        assert!(is_safe_identifier("nabh_fire_safety_drills"));
        assert!(is_safe_identifier("_internal2"));
    }

    #[test]
    fn anything_that_could_end_the_statement_early_is_refused() {
        // Not reachable from a compiled-in catalogue. Checked because the
        // moment somebody makes the catalogue configurable, it would be.
        for attempt in [
            "patients; DROP TABLE patients",
            "patients WHERE 1=1 --",
            "public.patients",
            "Patients",
            "",
            "tenant_id\"",
        ] {
            assert!(!is_safe_identifier(attempt), "{attempt} was accepted");
        }
    }
}
