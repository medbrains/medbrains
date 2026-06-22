//! On-call roster resolution (audit P1 #206).
//!
//! Answers "who is on call right now?" from the HR duty roster:
//! `duty_rosters.is_on_call` joined to shift windows, evaluated in the
//! tenant's local timezone (overnight shifts span midnight, so
//! yesterday's roster row can still be the active one). Department
//! match preferred, hospital-wide (NULL department) rows as fallback.

use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::error::AppError;

#[derive(Debug)]
pub struct OnCallContact {
    pub user_id: Option<Uuid>,
    pub phone: String,
}

pub async fn current_on_call(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    department_id: Option<Uuid>,
) -> Result<Option<OnCallContact>, AppError> {
    let row: Option<(Option<Uuid>, String)> = sqlx::query_as(
        "WITH local AS ( \
           SELECT timezone(COALESCE((SELECT timezone FROM tenants WHERE id = $1), 'UTC'), \
                  now()) AS ts \
         ) \
         SELECT e.user_id, COALESCE(NULLIF(u.phone, ''), NULLIF(e.phone, '')) AS phone \
         FROM duty_rosters dr \
         JOIN employees e ON e.id = dr.employee_id AND e.tenant_id = dr.tenant_id \
         LEFT JOIN users u ON u.id = e.user_id \
         JOIN shift_definitions sd ON sd.id = dr.shift_id \
         CROSS JOIN local \
         WHERE dr.tenant_id = $1 \
           AND dr.is_on_call = true \
           AND ($2::uuid IS NULL OR dr.department_id = $2 OR dr.department_id IS NULL) \
           AND COALESCE(NULLIF(u.phone, ''), NULLIF(e.phone, '')) IS NOT NULL \
           AND ( \
             (sd.start_time <= sd.end_time \
               AND dr.roster_date = local.ts::date \
               AND local.ts::time BETWEEN sd.start_time AND sd.end_time) \
             OR (sd.start_time > sd.end_time AND ( \
               (dr.roster_date = local.ts::date AND local.ts::time >= sd.start_time) \
               OR (dr.roster_date = local.ts::date - 1 AND local.ts::time <= sd.end_time))) \
           ) \
         ORDER BY (dr.department_id IS NULL), dr.created_at DESC \
         LIMIT 1",
    )
    .bind(tenant_id)
    .bind(department_id)
    .fetch_optional(&mut **tx)
    .await?;

    Ok(row.map(|(user_id, phone)| OnCallContact { user_id, phone }))
}
