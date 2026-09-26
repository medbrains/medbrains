//! Moving a waiting patient to another department's queue
//! (RFCs/modules/RFC-MODULE-token-queues.md, P2, scenario 33).
//!
//! A patient registered to the wrong department is the hospital's mistake,
//! not theirs: they take the new queue's number but keep their place by the
//! time they arrived, not the back of the line.

use medbrains_server_core::error::AppError;
use uuid::Uuid;

use crate::{place_in_queue, resolve_scope};

/// Move the OPD token of this visit to another department.
///
/// Runs in the caller's transaction. Returns the new number, or the desk's
/// reason it cannot move:
/// already called (then it is a referral, not a transfer), or the new
/// department's queue is closed or full.
pub async fn transfer_visit_token_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    encounter_id: Uuid,
    department_id: Uuid,
) -> Result<Result<Option<String>, String>, AppError> {
    let Some(token) = sqlx::query!(
        r#"SELECT id, status, visit_id, created_at FROM tokens
            WHERE entity_type = 'encounter' AND entity_id = $1 AND module = 'opd'
              AND token_date = CURRENT_DATE
            ORDER BY created_at DESC LIMIT 1
            FOR UPDATE"#,
        encounter_id,
    )
    .fetch_optional(&mut **tx)
    .await?
    else {
        // No token (tokens off, or the queue gave none): the visit still moves.
        return Ok(Ok(None));
    };
    if token.status != "waiting" && token.status != "on_hold" {
        return Ok(Err(format!(
            "The patient is already {} — the doctor can refer them instead",
            token.status.replace('_', " ")
        )));
    }

    // The same lock issuing takes on the new department's queue, so the
    // number and position below cannot race a registration there.
    sqlx::query!(
        "SELECT pg_advisory_xact_lock(hashtextextended(\
           $1::uuid::text || ':' || 'opd' || ':' || 'department' || ':' \
           || $2::uuid::text || ':' || CURRENT_DATE::text, 0))",
        tenant_id,
        department_id,
    )
    .execute(&mut **tx)
    .await?;
    let place = match place_in_queue(
        tx,
        tenant_id,
        ("opd", "department", Some(department_id)),
        token.visit_id,
    )
    .await?
    {
        Ok(place) => place,
        Err(reason) => return Ok(Err(reason)),
    };
    let label = resolve_scope(tx, "department", Some(department_id), None).await?;

    // Their place by arrival: before everyone in the new queue who came later.
    let seq = sqlx::query_scalar!(
        r#"SELECT COALESCE(MIN(seq), $3) AS "seq!" FROM tokens
            WHERE module = 'opd' AND scope = 'department' AND scope_id = $1
              AND token_date = CURRENT_DATE AND status IN ('waiting', 'on_hold')
              AND created_at > $2 AND id <> $4"#,
        department_id,
        token.created_at,
        place.seq,
        token.id,
    )
    .fetch_one(&mut **tx)
    .await?;
    sqlx::query!(
        "UPDATE tokens SET seq = seq + 1 \
          WHERE module = 'opd' AND scope = 'department' AND scope_id = $1 \
            AND token_date = CURRENT_DATE AND seq >= $2 AND id <> $3",
        department_id,
        seq,
        token.id,
    )
    .execute(&mut **tx)
    .await?;
    sqlx::query!(
        "UPDATE tokens SET scope = 'department', scope_id = $2, scope_label = $3, \
           queue_id = $4, period_key = $5, number = $6, seq = $7, counter_label = NULL, \
           updated_at = now() \
         WHERE id = $1",
        token.id,
        department_id,
        label,
        place.queue_id,
        place.period_key,
        place.number,
        seq,
    )
    .execute(&mut **tx)
    .await?;
    Ok(Ok(Some(place.number)))
}
