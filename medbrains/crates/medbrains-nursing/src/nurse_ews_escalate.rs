//! Opening an early-warning escalation and choosing who hears about it.
//!
//! One open escalation per encounter. A new reading in the same or a lower
//! escalating band is added to the open one (the people already told are not
//! told again for every hourly set); a worse band supersedes it and tells
//! everyone afresh. Who is told: the nurse in charge of the ward this shift,
//! the patient's primary nurse, the attending doctor and the duty (on-call)
//! doctor for the department — never the nurse who charted it, who already
//! knows.

use chrono::{Duration, Utc};
use medbrains_clinical_scores::ews::{Band, EwsScore};
use uuid::Uuid;

use medbrains_server_core::error::AppError;

use crate::nurse_ews::{Context, NewNotificationOwned, Outgoing, band_of};

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

#[derive(Debug)]
pub struct Trigger<'a> {
    pub tenant_id: Uuid,
    pub actor: Uuid,
    pub encounter_id: Uuid,
    pub admission_id: Uuid,
    pub vitals_id: Uuid,
    pub ctx: &'a Context,
    pub score: &'a EwsScore,
    pub ack_minutes: i32,
}

/// The ward's nurses in charge this shift and the patient's assigned nurses.
pub async fn ward_nurses(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    (ward_id, patient_id): (Option<Uuid>, Uuid),
) -> Result<Vec<Uuid>, AppError> {
    Ok(sqlx::query_scalar(
        "SELECT DISTINCT u FROM nurse_shift_assignments s, \
                LATERAL unnest(ARRAY[s.charge_nurse_user_id, \
                    CASE WHEN $3 = ANY(s.patient_ids) THEN s.nurse_user_id END]) AS u \
          WHERE s.tenant_id = $1 AND s.deleted_at IS NULL AND u IS NOT NULL \
            AND s.shift_date BETWEEN CURRENT_DATE - 1 AND CURRENT_DATE \
            AND (s.ward_id = $2 OR $3 = ANY(s.patient_ids))",
    )
    .bind(tenant_id)
    .bind(ward_id)
    .bind(patient_id)
    .fetch_all(&mut **tx)
    .await?)
}

/// Everyone to tell when an escalation opens, the actor left out.
async fn recipients(tx: &mut Tx<'_>, t: &Trigger<'_>) -> Result<Vec<Uuid>, AppError> {
    let mut who = ward_nurses(tx, t.tenant_id, (t.ctx.ward_id, t.ctx.patient_id)).await?;
    who.extend(t.ctx.primary_nurse_id);
    who.extend(t.ctx.doctor_id);
    if let Some(on_call) =
        medbrains_notifications::on_call::current_on_call(tx, t.tenant_id, t.ctx.department_id)
            .await?
    {
        who.extend(on_call.user_id);
    }
    who.sort_unstable();
    who.dedup();
    who.retain(|u| *u != t.actor);
    Ok(who)
}

#[must_use]
pub fn headline(band: Band, tool: &str, total: i32, incomplete: bool) -> (&'static str, String) {
    let kind = if band == Band::Emergency {
        "critical"
    } else {
        "warning"
    };
    let what = if band == Band::Emergency {
        "Emergency"
    } else {
        "Urgent"
    };
    let plus = if incomplete { "+ (incomplete set)" } else { "" };
    (
        kind,
        format!(
            "{what} early-warning score: {} {total}{plus}",
            tool.to_uppercase()
        ),
    )
}

/// Open, supersede or update the encounter's escalation. Returns its id and
/// the notifications written for it.
pub async fn open_or_update(
    tx: &mut Tx<'_>,
    t: &Trigger<'_>,
) -> Result<(Uuid, Outgoing), AppError> {
    let open: Option<(Uuid, String)> = sqlx::query_as(
        "SELECT id, band FROM ews_escalations \
          WHERE tenant_id = $1 AND encounter_id = $2 AND status = 'open' AND deleted_at IS NULL \
          FOR UPDATE",
    )
    .bind(t.tenant_id)
    .bind(t.encounter_id)
    .fetch_optional(&mut **tx)
    .await?;
    if let Some((id, band)) = &open
        && band_of(band) >= t.score.band
    {
        sqlx::query(
            "UPDATE ews_escalations SET latest_vitals_id = $1, ews_total = $2, incomplete = $3 \
              WHERE id = $4 AND tenant_id = $5",
        )
        .bind(t.vitals_id)
        .bind(t.score.total)
        .bind(t.score.incomplete)
        .bind(id)
        .bind(t.tenant_id)
        .execute(&mut **tx)
        .await?;
        return Ok((*id, Vec::new()));
    }
    if let Some((old, _)) = &open {
        sqlx::query(
            "UPDATE ews_escalations SET status = 'superseded' WHERE id = $1 AND tenant_id = $2",
        )
        .bind(old)
        .bind(t.tenant_id)
        .execute(&mut **tx)
        .await?;
    }
    let who = recipients(tx, t).await?;
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO ews_escalations (tenant_id, encounter_id, admission_id, patient_id, vitals_id, \
             latest_vitals_id, ews_tool, ews_total, band, incomplete, notified_user_ids, \
             next_escalation_at) \
         VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9, $10, $11) RETURNING id",
    )
    .bind(t.tenant_id)
    .bind(t.encounter_id)
    .bind(t.admission_id)
    .bind(t.ctx.patient_id)
    .bind(t.vitals_id)
    .bind(t.score.tool.as_str())
    .bind(t.score.total)
    .bind(t.score.band.as_str())
    .bind(t.score.incomplete)
    .bind(&who)
    .bind(Utc::now() + Duration::minutes(i64::from(t.ack_minutes)))
    .fetch_one(&mut **tx)
    .await?;
    if let Some((old, _)) = &open {
        sqlx::query(
            "UPDATE ews_escalations SET superseded_by = $1 WHERE id = $2 AND tenant_id = $3",
        )
        .bind(id)
        .bind(old)
        .bind(t.tenant_id)
        .execute(&mut **tx)
        .await?;
    }
    let (kind, title) = headline(
        t.score.band,
        t.score.tool.as_str(),
        t.score.total,
        t.score.incomplete,
    );
    let body = format!(
        "{} — review now and acknowledge with your response. It escalates further in {} minutes.",
        t.ctx.patient_label, t.ack_minutes
    );
    let mut outgoing = Vec::with_capacity(who.len());
    for user_id in who {
        let n = NewNotificationOwned {
            user_id,
            kind,
            title: title.clone(),
            body: body.clone(),
            entity_id: id,
            action_url: format!("/care-view?tab=escalations&escalation={id}"),
        };
        let nid = medbrains_notifications::create_notification(tx, t.tenant_id, n.borrow()).await?;
        outgoing.push((nid, n));
    }
    Ok((id, outgoing))
}
