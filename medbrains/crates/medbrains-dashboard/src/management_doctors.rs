//! Documentation by doctor, worst first.
//!
//! For the seven days ending on the day read: each doctor's OPD visits, how
//! many carry a coded diagnosis and a complete note, and how many were left
//! open past their day — so the screen leads with what needs a conversation.
//!
//! Visits with no doctor recorded are a row of their own: work nobody is
//! accountable for is a finding, not a rounding error.

use chrono::{Duration, NaiveDate};
use serde_json::{Value, json};

use medbrains_server_core::error::AppError;

/// Rows on the tile; the rest is a report, not a dashboard.
const MAX_ROWS: i64 = 10;
/// The window read, ending on the day: a week evens out a quiet clinic day.
const WINDOW_DAYS: i64 = 7;

/// `{items: [{doctor, visits, coded_pct, note_pct, left_open}]}`.
pub async fn documentation_by_doctor(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    as_of: Option<NaiveDate>,
) -> Result<Value, AppError> {
    let today: NaiveDate = sqlx::query_scalar(
        "SELECT timezone(COALESCE(timezone, 'UTC'), now())::date FROM tenants \
          WHERE id = current_setting('app.tenant_id')::uuid",
    )
    .fetch_one(&mut **tx)
    .await?;
    let to = as_of.unwrap_or(today).min(today);
    let from = to - Duration::days(WINDOW_DAYS - 1);
    let rows: Value = sqlx::query_scalar(
        "SELECT COALESCE(json_agg(r ORDER BY r.coded_pct + r.note_pct, r.visits DESC), '[]'::json) \
         FROM ( \
           SELECT COALESCE(u.full_name, 'No doctor recorded') AS doctor, \
                  COUNT(*)::bigint AS visits, \
                  round(100.0 * COUNT(*) FILTER (WHERE v.coded) / COUNT(*))::int AS coded_pct, \
                  round(100.0 * COUNT(*) FILTER (WHERE v.noted) / COUNT(*))::int AS note_pct, \
                  COUNT(*) FILTER (WHERE v.open AND v.encounter_date < $3)::bigint AS left_open \
             FROM ( \
               SELECT e.doctor_id, e.encounter_date, \
                      e.status::text <> 'completed' AS open, \
                      EXISTS (SELECT 1 FROM diagnoses d WHERE d.encounter_id = e.id \
                                AND d.deleted_at IS NULL AND d.icd_code IS NOT NULL) AS coded, \
                      EXISTS (SELECT 1 FROM consultations c WHERE c.encounter_id = e.id \
                                AND c.deleted_at IS NULL \
                                AND btrim(COALESCE(c.chief_complaint, '')) <> '' \
                                AND (btrim(COALESCE(c.examination, '')) <> '' \
                                     OR COALESCE(c.physical_examination, '{}'::jsonb) \
                                        <> '{}'::jsonb)) AS noted \
                 FROM encounters e \
                WHERE e.encounter_type = 'opd' AND e.deleted_at IS NULL \
                  AND e.status::text <> 'cancelled' \
                  AND e.encounter_date BETWEEN $1 AND $2 \
             ) v \
             LEFT JOIN users u ON u.id = v.doctor_id \
            GROUP BY v.doctor_id, u.full_name \
            ORDER BY round(100.0 * COUNT(*) FILTER (WHERE v.coded) / COUNT(*)) \
                   + round(100.0 * COUNT(*) FILTER (WHERE v.noted) / COUNT(*)), \
                     COUNT(*) DESC \
            LIMIT $4 \
         ) r",
    )
    .bind(from)
    .bind(to)
    .bind(today)
    .bind(MAX_ROWS)
    .fetch_one(&mut **tx)
    .await?;
    Ok(json!({ "items": rows, "from": from, "to": to }))
}
