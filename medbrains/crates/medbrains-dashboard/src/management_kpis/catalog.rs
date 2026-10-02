//! The management KPIs: what each measures, which way is better, and the one
//! bounded query behind its daily series.
//!
//! Adding a KPI is one entry here and a widget that names its code.

use serde::Serialize;

/// Which way a KPI should move. A colour on the tile follows this, never the
/// raw direction: wait time rising is bad, visits rising is neither.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Better {
    Lower,
    Higher,
    Neutral,
}

pub(super) struct Kpi {
    pub(super) unit: &'static str,
    pub(super) better: Better,
    /// A day with no rows is a true zero (visits), not an unknown (wait time).
    pub(super) zero_fill: bool,
    /// Whether the query takes `$3`, the tenant's time zone — and, for a daily
    /// KPI, `$4`, an optional local clock cut-off to compare today with
    /// earlier days fairly.
    pub(super) clock: bool,
    /// A rate over the seven days ending each day, from `(day, numerator,
    /// denominator)` rows for `$1..=$2` — a day's documentation rate swings
    /// 33 points on a doctor with three visits; a week's does not.
    pub(super) rolling: bool,
    /// `(day date, value float8)` rows for days `$1..=$2`, or for a rolling
    /// KPI `(day date, numerator float8, denominator float8)`.
    pub(super) sql: &'static str,
}

/// OPD visits that count: not cancelled. `$1..=$2`.
/// A macro, not a const, so `concat!` can build each query at compile time.
macro_rules! opd_visits {
    () => {
        " FROM encounters e \
          WHERE e.encounter_type = 'opd' AND e.deleted_at IS NULL \
            AND e.status::text <> 'cancelled' AND e.encounter_date BETWEEN $1 AND $2"
    };
}

pub(super) fn kpi(code: &str) -> Option<Kpi> {
    Some(match code {
        "opd_visits" => Kpi {
            unit: "visits",
            better: Better::Neutral,
            zero_fill: true,
            clock: true,
            rolling: false,
            sql: "SELECT encounter_date AS day, COUNT(*)::float8 AS value \
                  FROM encounters \
                  WHERE encounter_type = 'opd' AND deleted_at IS NULL \
                    AND encounter_date BETWEEN $1 AND $2 \
                    AND ($4::time IS NULL OR timezone($3, created_at)::time <= $4) \
                  GROUP BY encounter_date",
        },
        "opd_wait_minutes" => Kpi {
            unit: "min",
            better: Better::Lower,
            zero_fill: false,
            clock: true,
            rolling: false,
            sql: "SELECT token_date AS day, \
                    (percentile_cont(0.5) WITHIN GROUP \
                      (ORDER BY EXTRACT(EPOCH FROM called_at - created_at)) / 60.0)::float8 \
                      AS value \
                  FROM tokens \
                  WHERE module = 'opd' AND called_at IS NOT NULL \
                    AND token_date BETWEEN $1 AND $2 \
                    AND ($4::time IS NULL OR timezone($3, called_at)::time <= $4) \
                  GROUP BY token_date",
        },
        "opd_consult_minutes" => Kpi {
            unit: "min",
            better: Better::Neutral,
            zero_fill: false,
            clock: true,
            rolling: false,
            sql: "SELECT token_date AS day, \
                    (percentile_cont(0.5) WITHIN GROUP \
                      (ORDER BY EXTRACT(EPOCH FROM completed_at - called_at)) / 60.0)::float8 \
                      AS value \
                  FROM tokens \
                  WHERE module = 'opd' AND called_at IS NOT NULL AND completed_at IS NOT NULL \
                    AND token_date BETWEEN $1 AND $2 \
                    AND ($4::time IS NULL OR timezone($3, completed_at)::time <= $4) \
                  GROUP BY token_date",
        },
        // Of appointments whose outcome is known: one still scheduled for
        // later today is neither kept nor missed yet.
        "appointment_no_show_pct" => Kpi {
            unit: "%",
            better: Better::Lower,
            zero_fill: false,
            clock: false,
            rolling: false,
            sql: "SELECT appointment_date AS day, \
                    (100.0 * COUNT(*) FILTER (WHERE status::text = 'no_show') \
                      / NULLIF(COUNT(*) FILTER (WHERE status::text IN \
                          ('checked_in', 'in_consultation', 'completed', 'no_show')), 0))::float8 \
                      AS value \
                  FROM appointments \
                  WHERE deleted_at IS NULL AND appointment_date BETWEEN $1 AND $2 \
                  GROUP BY appointment_date",
        },
        "coded_diagnosis_pct" => Kpi {
            unit: "%",
            better: Better::Higher,
            zero_fill: false,
            clock: false,
            rolling: true,
            sql: concat!(
                "SELECT e.encounter_date, COUNT(*) FILTER (WHERE EXISTS ( \
                   SELECT 1 FROM diagnoses d WHERE d.encounter_id = e.id \
                     AND d.deleted_at IS NULL AND d.icd_code IS NOT NULL))::float8, \
                 COUNT(*)::float8",
                opd_visits!(),
                " GROUP BY e.encounter_date"
            ),
        },
        // A complete note says why the patient came and what was found.
        "complete_note_pct" => Kpi {
            unit: "%",
            better: Better::Higher,
            zero_fill: false,
            clock: false,
            rolling: true,
            sql: concat!(
                "SELECT e.encounter_date, COUNT(*) FILTER (WHERE EXISTS ( \
                   SELECT 1 FROM consultations c WHERE c.encounter_id = e.id \
                     AND c.deleted_at IS NULL AND btrim(COALESCE(c.chief_complaint, '')) <> '' \
                     AND (btrim(COALESCE(c.examination, '')) <> '' \
                          OR COALESCE(c.physical_examination, '{}'::jsonb) <> '{}'::jsonb)))::float8, \
                 COUNT(*)::float8",
                opd_visits!(),
                " GROUP BY e.encounter_date"
            ),
        },
        // Of visits from days already over: today's are open because the
        // clinic is.
        "visits_left_open_pct" => Kpi {
            unit: "%",
            better: Better::Lower,
            zero_fill: false,
            clock: true,
            rolling: true,
            sql: concat!(
                "SELECT e.encounter_date, \
                 COUNT(*) FILTER (WHERE e.status::text <> 'completed')::float8, COUNT(*)::float8",
                opd_visits!(),
                " AND e.encounter_date < timezone($3, now())::date \
                 GROUP BY e.encounter_date"
            ),
        },
        // ── Non-clinical efficiency ──
        // A visit nobody billed is revenue that never arrives — or a free
        // follow-up; either way management should know the share.
        "opd_unbilled_pct" => Kpi {
            unit: "%",
            better: Better::Lower,
            zero_fill: false,
            clock: true,
            rolling: true,
            sql: concat!(
                "SELECT e.encounter_date, COUNT(*) FILTER (WHERE NOT EXISTS ( \
                   SELECT 1 FROM invoices i WHERE i.encounter_id = e.id \
                     AND i.deleted_at IS NULL AND i.status::text <> 'cancelled'))::float8, \
                 COUNT(*)::float8",
                opd_visits!(),
                " AND e.encounter_date < timezone($3, now())::date GROUP BY e.encounter_date"
            ),
        },
        "billing_lag_hours" => Kpi {
            unit: "h",
            better: Better::Lower,
            zero_fill: false,
            clock: true,
            rolling: false,
            sql: "SELECT timezone($3, i.issued_at)::date AS day, \
                    (percentile_cont(0.5) WITHIN GROUP \
                      (ORDER BY EXTRACT(EPOCH FROM i.issued_at - e.created_at)) / 3600.0)::float8 \
                  FROM invoices i JOIN encounters e ON e.id = i.encounter_id \
                  WHERE i.deleted_at IS NULL AND i.status::text <> 'cancelled' \
                    AND e.encounter_type = 'opd' AND i.issued_at >= e.created_at \
                    AND timezone($3, i.issued_at)::date BETWEEN $1 AND $2 \
                    AND ($4::time IS NULL OR timezone($3, i.issued_at)::time <= $4) \
                  GROUP BY 1",
        },
        "lab_tat_minutes" => Kpi {
            unit: "min",
            better: Better::Lower,
            zero_fill: false,
            clock: true,
            rolling: false,
            sql: "SELECT timezone($3, verified_at)::date AS day, \
                    (percentile_cont(0.5) WITHIN GROUP \
                      (ORDER BY EXTRACT(EPOCH FROM verified_at - collected_at)) / 60.0)::float8 \
                  FROM lab_orders \
                  WHERE deleted_at IS NULL AND verified_at >= collected_at \
                    AND timezone($3, verified_at)::date BETWEEN $1 AND $2 \
                    AND ($4::time IS NULL OR timezone($3, verified_at)::time <= $4) \
                  GROUP BY 1",
        },
        // Against each test's own expected turnaround: a culture is not late
        // at the hour a CBC would be.
        "lab_within_target_pct" => Kpi {
            unit: "%",
            better: Better::Higher,
            zero_fill: false,
            clock: true,
            rolling: true,
            sql: "SELECT timezone($3, verified_at)::date, \
                    COUNT(*) FILTER (WHERE verified_at - collected_at \
                      <= make_interval(mins => expected_tat_minutes))::float8, COUNT(*)::float8 \
                  FROM lab_orders \
                  WHERE deleted_at IS NULL AND verified_at >= collected_at \
                    AND expected_tat_minutes IS NOT NULL \
                    AND timezone($3, verified_at)::date BETWEEN $1 AND $2 \
                  GROUP BY 1",
        },
        "bed_turnaround_minutes" => Kpi {
            unit: "min",
            better: Better::Lower,
            zero_fill: false,
            clock: true,
            rolling: false,
            sql: "SELECT timezone($3, vacated_at)::date AS day, \
                    (percentile_cont(0.5) WITHIN GROUP \
                      (ORDER BY EXTRACT(EPOCH FROM ready_at - vacated_at)) / 60.0)::float8 \
                  FROM bed_turnaround_log \
                  WHERE deleted_at IS NULL AND ready_at >= vacated_at \
                    AND timezone($3, vacated_at)::date BETWEEN $1 AND $2 \
                    AND ($4::time IS NULL OR timezone($3, ready_at)::time <= $4) \
                  GROUP BY 1",
        },
        "pharmacy_wait_minutes" => Kpi {
            unit: "min",
            better: Better::Lower,
            zero_fill: false,
            clock: true,
            rolling: false,
            sql: "SELECT token_date AS day, \
                    (percentile_cont(0.5) WITHIN GROUP \
                      (ORDER BY EXTRACT(EPOCH FROM called_at - created_at)) / 60.0)::float8 \
                  FROM tokens \
                  WHERE module = 'pharmacy' AND called_at IS NOT NULL \
                    AND token_date BETWEEN $1 AND $2 \
                    AND ($4::time IS NULL OR timezone($3, called_at)::time <= $4) \
                  GROUP BY token_date",
        },
        _ => return None,
    })
}

#[cfg(test)]
mod tests {
    use super::kpi;

    const CODES: [&str; 13] = [
        "opd_visits",
        "opd_wait_minutes",
        "opd_consult_minutes",
        "appointment_no_show_pct",
        "coded_diagnosis_pct",
        "complete_note_pct",
        "visits_left_open_pct",
        "opd_unbilled_pct",
        "billing_lag_hours",
        "lab_tat_minutes",
        "lab_within_target_pct",
        "bed_turnaround_minutes",
        "pharmacy_wait_minutes",
    ];

    /// Postgres refuses a statement bound with parameters it does not use, at
    /// run time; the flags decide what is bound, so each query must use
    /// exactly those.
    #[test]
    fn every_query_uses_exactly_the_parameters_it_is_bound() {
        for code in CODES {
            let Some(k) = kpi(code) else {
                unreachable!("{code} is not in the catalogue");
            };
            assert_eq!(k.sql.contains("$3"), k.clock, "{code}: $3 is the time zone");
            assert_eq!(
                k.sql.contains("$4"),
                k.clock && !k.rolling,
                "{code}: $4 is the clock cut-off, daily KPIs only"
            );
        }
    }
}
