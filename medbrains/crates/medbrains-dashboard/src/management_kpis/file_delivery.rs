//! The paper-file wait (migration 1417): registration to the MRD file
//! delivered at the clinic, median and 90th percentile, by visit date. The
//! wait a patient used to spend while someone walked to the records room.
//! Per OPD via `$5`; per runner on the MRD screen.

use super::catalog::{Better, Kpi, Shape};

/// The delivery-time query at one percentile.
macro_rules! file_delivery_sql {
    ($p:literal) => {
        concat!(
            "SELECT f.visit_date AS day, (percentile_cont(",
            $p,
            ") WITHIN GROUP \
               (ORDER BY EXTRACT(EPOCH FROM f.delivered_at - e.created_at)) / 60.0)::float8 \
               AS value \
             FROM mrd_file_requests f \
             JOIN encounters e ON e.id = f.encounter_id AND e.tenant_id = f.tenant_id \
             WHERE f.status = 'delivered' AND f.deleted_at IS NULL \
               AND f.visit_date BETWEEN $1 AND $2 \
               AND ($4::time IS NULL OR timezone($3, f.delivered_at)::time <= $4) \
               AND ($5::uuid IS NULL OR f.department_id = $5) \
             GROUP BY f.visit_date"
        )
    };
}

/// The file-wait KPIs by code; `None` for any other code.
pub(super) fn kpi(code: &str) -> Option<Kpi> {
    let sql = match code {
        "mrd_file_delivery_minutes" => file_delivery_sql!("0.5"),
        "mrd_file_delivery_p90_minutes" => file_delivery_sql!("0.9"),
        _ => return None,
    };
    Some(Kpi {
        unit: "min",
        better: Better::Lower,
        zero_fill: false,
        clock: true,
        shape: Shape::Daily,
        departmental: true,
        sql,
    })
}

#[cfg(test)]
mod tests {
    use super::kpi;

    /// The catalogue binds `$1..$5` for a clocked, departmental daily KPI;
    /// Postgres refuses a statement that leaves one unused.
    #[test]
    fn both_percentiles_use_every_parameter_they_are_bound() {
        for code in ["mrd_file_delivery_minutes", "mrd_file_delivery_p90_minutes"] {
            let Some(k) = crate::management_kpis::catalog::kpi(code) else {
                unreachable!("{code} is not in the catalogue");
            };
            for p in ["$1", "$2", "$3", "$4", "$5"] {
                assert!(k.sql.contains(p), "{code}: {p} unused");
            }
            assert!(k.departmental && k.clock);
        }
        assert!(kpi("opd_visits").is_none());
    }
}
