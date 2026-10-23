//! Code Pink — infant abduction prevention (NABH IPSG.1, COP; NABH FMS
//! security). Two server-side rules the tag registry alone did not enforce:
//!
//! 1. **Band match before a baby moves.** At every handover — nursery to
//!    mother, out of the ward, discharge — the nurse scans the infant's band
//!    and the mother's band. A mismatch is refused (409), raised as a
//!    `band_mismatch` tag alert and audited. A match is audited too: the
//!    register of who checked which baby, when, is the evidence NABH asks for.
//! 2. **A tag event is an alert, and an infant leaving is Code Pink.** A tag
//!    leaving its zone, or a band cut or tampered with, becomes a
//!    `security_tag_alerts` row; for an infant tag it also activates Code Pink
//!    (an `er_code_activations` row, which every signed-in screen raises in
//!    the live-activity island) and links the two. A reader that keeps firing
//!    does not open a second alert or a second code.

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use medbrains_core::security::SecurityTagAlert;
use medbrains_db::audit::{AuditEntry, AuditLogger};
use serde::{Deserialize, Serialize};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

/// Events from an infant tag that mean the baby may be leaving with someone.
const CODE_PINK_EVENTS: &[&str] = &["exit_zone", "zone_breach", "tamper", "band_removed"];
const TAG_EVENTS: &[&str] = &[
    "exit_zone",
    "zone_breach",
    "tamper",
    "band_removed",
    "low_battery",
];

#[derive(Debug, Deserialize)]
pub struct VerifyBandMatchRequest {
    /// The infant's band / tag identifier, as scanned.
    pub infant_tag: String,
    /// The mother's band, as scanned — her UHID.
    pub mother_band: String,
    /// handover, `nursery_exit`, discharge, feeding …
    pub purpose: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BandMatchResult {
    pub matched: bool,
    pub tag_id: Uuid,
    pub infant_patient_id: Uuid,
    pub mother_patient_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct TagEventRequest {
    pub tag_identifier: String,
    pub event_type: String,
    pub zone_id: Option<Uuid>,
    pub location_description: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TagEventResult {
    pub alert: SecurityTagAlert,
    pub code_pink_activation_id: Option<Uuid>,
    /// True when an open alert of this type already existed for the tag.
    pub deduplicated: bool,
}

#[derive(Debug, sqlx::FromRow)]
struct ActiveTag {
    id: Uuid,
    patient_id: Uuid,
    mother_id: Option<Uuid>,
    tag_type: String,
    tag_identifier: Option<String>,
}

async fn find_active_tag(
    tx: &mut Transaction<'_, Postgres>,
    identifier: &str,
    infant_only: bool,
) -> Result<Option<ActiveTag>, AppError> {
    Ok(sqlx::query_as::<_, ActiveTag>(
        "SELECT id, patient_id, mother_id, tag_type::text AS tag_type, tag_identifier \
           FROM security_patient_tags \
          WHERE lower(tag_identifier) = lower($1) \
            AND alert_status <> 'deactivated' AND deleted_at IS NULL \
            AND (NOT $2 OR tag_type = 'infant_rfid') \
          ORDER BY activated_at DESC LIMIT 1",
    )
    .bind(identifier)
    .bind(infant_only)
    .fetch_optional(&mut **tx)
    .await?)
}

async fn audit(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    (action, entity): (&str, Option<(&str, Uuid)>),
    values: &serde_json::Value,
) -> Result<(), AppError> {
    AuditLogger::log(
        tx,
        &AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action,
            entity_type: entity.map_or("security_patient_tags", |(kind, _)| kind),
            entity_id: entity.map(|(_, id)| id),
            old_values: None,
            new_values: Some(values),
            ip_address: None,
        },
    )
    .await?;
    Ok(())
}

async fn raise_alert(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    tag_id: Uuid,
    event: (&str, Option<Uuid>, Option<&str>, Option<Uuid>),
) -> Result<SecurityTagAlert, AppError> {
    let (alert_type, zone_id, location, code_activation_id) = event;
    let alert = sqlx::query_as::<_, SecurityTagAlert>(
        "INSERT INTO security_tag_alerts \
         (tenant_id, tag_id, alert_type, zone_id, location_description, code_activation_id) \
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(tag_id)
    .bind(alert_type)
    .bind(zone_id)
    .bind(location)
    .bind(code_activation_id)
    .fetch_one(&mut **tx)
    .await?;
    sqlx::query(
        "UPDATE security_patient_tags SET alert_status = 'alert_triggered'::sec_tag_alert_status \
          WHERE id = $1 AND alert_status = 'active'",
    )
    .bind(tag_id)
    .execute(&mut **tx)
    .await?;
    Ok(alert)
}

const TAG: &str = "security_patient_tags";

/// The baby whose bands are being checked, as the caller found it.
#[derive(Debug)]
pub struct Infant<'a> {
    /// What was checked, for the audit row: (`table`, id).
    pub record: (&'a str, Uuid),
    /// The baby's own patient id — its active infant tag gets the alert.
    pub patient_id: Option<Uuid>,
    pub mother_id: Option<Uuid>,
    /// The band number on record for the baby, if one was issued.
    pub band_on_record: Option<&'a str>,
}

/// What the nurse scanned.
#[derive(Debug, Serialize)]
pub struct BandScan<'a> {
    /// The mother's band — her UHID.
    pub mother_band: &'a str,
    pub infant_band: Option<&'a str>,
    pub purpose: Option<&'a str>,
}

/// A refusal is `Ok(Err(..))`: the audit row and alert are already written
/// into `tx`, so the caller commits first and then returns it. `Err(..)` is a
/// fault and rolls everything back.
pub type BandCheck = Result<Uuid, AppError>;

/// The one mother–baby band check, used by the security handover screen and
/// the maternity newborn screen alike. The mother's band must be the linked
/// mother's UHID; when the baby has a band on record, the scanned baby band
/// must be that band. A mismatch raises a `band_mismatch` alert on the
/// baby's active infant tag (if it has one) and is audited; so is a match.
/// Returns the mother's patient id on a match.
pub async fn check_mother_baby_band(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    infant: &Infant<'_>,
    scan: &BandScan<'_>,
) -> Result<BandCheck, AppError> {
    let Some(mother_id) = infant.mother_id else {
        return Ok(Err(AppError::BadRequest(
            "This baby has no mother linked. Link the mother before handover.".to_owned(),
        )));
    };
    if infant.band_on_record.is_some() && scan.infant_band.is_none() {
        return Ok(Err(AppError::BadRequest(
            "Scan the baby's band too.".to_owned(),
        )));
    }
    let mother_uhid: Option<String> =
        sqlx::query_scalar("SELECT uhid FROM patients WHERE id = $1 AND tenant_id = $2")
            .bind(mother_id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut **tx)
            .await?;
    let mother_matches = mother_uhid
        .as_deref()
        .is_some_and(|u| u.eq_ignore_ascii_case(scan.mother_band.trim()));
    let band_matches = scan.infant_band.is_none_or(|scanned| {
        infant
            .band_on_record
            .is_some_and(|b| b.eq_ignore_ascii_case(scanned.trim()))
    });
    let scanned = serde_json::to_value(scan)
        .map_err(|e| AppError::Internal(format!("band scan serialisation: {e}")))?;

    if mother_matches && band_matches {
        audit(
            tx,
            claims,
            ("security.band_match.verified", Some(infant.record)),
            &scanned,
        )
        .await?;
        return Ok(Ok(mother_id));
    }
    if let Some(tag_id) = infant_tag(tx, infant.patient_id).await? {
        raise_alert(
            tx,
            claims,
            tag_id,
            ("band_mismatch", None, scan.purpose, None),
        )
        .await?;
    }
    audit(
        tx,
        claims,
        ("security.band_match.mismatch", Some(infant.record)),
        &scanned,
    )
    .await?;
    Ok(Err(AppError::Conflict(
        "Band mismatch — do not hand this baby over. The bands do not match. Security has \
         been alerted; recheck both bands with a second nurse."
            .to_owned(),
    )))
}

async fn infant_tag(
    tx: &mut Transaction<'_, Postgres>,
    patient_id: Option<Uuid>,
) -> Result<Option<Uuid>, AppError> {
    let Some(patient_id) = patient_id else {
        return Ok(None);
    };
    Ok(sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM security_patient_tags \
          WHERE patient_id = $1 AND tag_type = 'infant_rfid' \
            AND alert_status <> 'deactivated' AND deleted_at IS NULL \
          ORDER BY activated_at DESC LIMIT 1",
    )
    .bind(patient_id)
    .fetch_optional(&mut **tx)
    .await?)
}

/// `POST /api/security/patient-tags/verify-match` — scan infant + mother bands.
pub async fn verify_band_match(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<VerifyBandMatchRequest>,
) -> Result<Json<BandMatchResult>, AppError> {
    require_permission(&claims, permissions::security::patient_safety::VERIFY_MATCH)?;
    let infant_band = body.infant_tag.trim();
    let mother_band = body.mother_band.trim();
    if infant_band.is_empty() || mother_band.is_empty() {
        return Err(AppError::BadRequest(
            "Scan both bands — the baby's and the mother's.".to_owned(),
        ));
    }
    let scan = BandScan {
        mother_band,
        infant_band: Some(infant_band),
        purpose: body
            .purpose
            .as_deref()
            .map(str::trim)
            .filter(|p| !p.is_empty()),
    };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let Some(tag) = find_active_tag(&mut tx, infant_band, true).await? else {
        let scanned = serde_json::json!({ "infant_band": infant_band, "purpose": scan.purpose });
        audit(
            &mut tx,
            &claims,
            ("security.band_match.unknown_tag", None),
            &scanned,
        )
        .await?;
        tx.commit().await?;
        return Err(AppError::BadRequest(format!(
            "No active infant tag carries band {infant_band}. Do not hand the baby over — \
             recheck the band and call security."
        )));
    };
    let infant = Infant {
        record: (TAG, tag.id),
        patient_id: Some(tag.patient_id),
        mother_id: tag.mother_id,
        band_on_record: tag.tag_identifier.as_deref(),
    };
    let checked = check_mother_baby_band(&mut tx, &claims, &infant, &scan).await?;
    tx.commit().await?;
    let mother_patient_id = checked?;
    Ok(Json(BandMatchResult {
        matched: true,
        tag_id: tag.id,
        infant_patient_id: tag.patient_id,
        mother_patient_id,
    }))
}

/// The open Code Pink already raised for this tag, if any — so a second event
/// (exit after tamper) joins the running code instead of starting another.
async fn running_code_pink(
    tx: &mut Transaction<'_, Postgres>,
    tag_id: Uuid,
) -> Result<Option<Uuid>, AppError> {
    Ok(sqlx::query_scalar::<_, Uuid>(
        "SELECT a.code_activation_id FROM security_tag_alerts a \
           JOIN er_code_activations c ON c.id = a.code_activation_id \
          WHERE a.tag_id = $1 AND NOT a.is_resolved AND a.deleted_at IS NULL \
            AND c.deactivated_at IS NULL AND c.deleted_at IS NULL \
          ORDER BY a.triggered_at DESC LIMIT 1",
    )
    .bind(tag_id)
    .fetch_optional(&mut **tx)
    .await?)
}

async fn activate_code_pink(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    tag: &ActiveTag,
    (event_type, location): (&str, &str),
) -> Result<Uuid, AppError> {
    let notes = format!(
        "Raised automatically: infant tag {} — {}.",
        tag.tag_identifier.as_deref().unwrap_or("unknown"),
        event_type.replace('_', " ")
    );
    let id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO er_code_activations (tenant_id, code_type, location, notes, activated_by) \
         VALUES ($1, 'code_pink', $2, $3, $4) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(location)
    .bind(&notes)
    .bind(claims.sub)
    .fetch_one(&mut **tx)
    .await?;
    let values = serde_json::json!({ "event_type": event_type, "location": location });
    audit(
        tx,
        claims,
        ("security.code_pink.activated", Some((TAG, tag.id))),
        &values,
    )
    .await?;
    Ok(id)
}

async fn zone_location(
    tx: &mut Transaction<'_, Postgres>,
    body: &TagEventRequest,
) -> Result<Option<String>, AppError> {
    let described = body
        .location_description
        .as_deref()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .map(str::to_owned);
    let Some(zone_id) = body.zone_id else {
        return Ok(described);
    };
    let zone: Option<String> =
        sqlx::query_scalar("SELECT name FROM security_zones WHERE id = $1 AND deleted_at IS NULL")
            .bind(zone_id)
            .fetch_optional(&mut **tx)
            .await?;
    Ok(zone.or(described))
}

/// `POST /api/security/tag-events` — a tag reader (or a member of staff)
/// reports an event on a tag.
pub async fn record_tag_event(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<TagEventRequest>,
) -> Result<Json<TagEventResult>, AppError> {
    require_permission(&claims, permissions::security::patient_safety::REPORT_EVENT)?;
    let event_type = body.event_type.trim();
    if !TAG_EVENTS.contains(&event_type) {
        return Err(AppError::BadRequest(format!(
            "Unknown tag event. Use one of: {}.",
            TAG_EVENTS.join(", ")
        )));
    }
    let identifier = body.tag_identifier.trim();

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tag = find_active_tag(&mut tx, identifier, false)
        .await?
        .ok_or_else(|| {
            AppError::BadRequest(format!(
                "No active tag {identifier}. If a baby or patient is wearing it, call security now."
            ))
        })?;

    let open = sqlx::query_as::<_, SecurityTagAlert>(
        "SELECT * FROM security_tag_alerts \
          WHERE tag_id = $1 AND alert_type = $2 AND NOT is_resolved AND deleted_at IS NULL \
          ORDER BY triggered_at DESC LIMIT 1",
    )
    .bind(tag.id)
    .bind(event_type)
    .fetch_optional(&mut *tx)
    .await?;
    if let Some(alert) = open {
        tx.commit().await?;
        let code_pink_activation_id = alert.code_activation_id;
        return Ok(Json(TagEventResult {
            alert,
            code_pink_activation_id,
            deduplicated: true,
        }));
    }

    let location = zone_location(&mut tx, &body).await?;
    let code_pink = if tag.tag_type == "infant_rfid" && CODE_PINK_EVENTS.contains(&event_type) {
        if let Some(id) = running_code_pink(&mut tx, tag.id).await? {
            Some(id)
        } else {
            let at = location.clone().unwrap_or_else(|| {
                format!(
                    "Infant tag {}",
                    tag.tag_identifier.as_deref().unwrap_or(identifier)
                )
            });
            Some(activate_code_pink(&mut tx, &claims, &tag, (event_type, at.as_str())).await?)
        }
    } else {
        None
    };

    let alert = raise_alert(
        &mut tx,
        &claims,
        tag.id,
        (event_type, body.zone_id, location.as_deref(), code_pink),
    )
    .await?;
    tx.commit().await?;
    Ok(Json(TagEventResult {
        alert,
        code_pink_activation_id: code_pink,
        deduplicated: false,
    }))
}
