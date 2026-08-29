//! Health camps, as an acquisition channel.
//!
//! # What was disconnected
//!
//! The camp module is substantial — twenty-seven tables, eight thousand lines,
//! rosters and consumables and closure checklists. It does not reference a
//! single `mkt_` table, and nothing in marketing references a camp.
//!
//! So the largest patient-acquisition channel an Indian hospital has was
//! invisible to the report that ranks acquisition channels. A camp's budget
//! did not appear beside a hoarding's; its attendees never entered the enquiry
//! funnel; and "did the Coimbatore camp actually produce OPD visits" could be
//! answered only by opening the camp module and counting by hand.
//!
//! This is the seam between the two, and deliberately nothing more. No camp
//! table is duplicated here and no camp behaviour is reimplemented — the camp
//! module owns camps, and this reads them.
//!
//! # Two conversion numbers, because they disagree
//!
//! `camp_followups.converted_to_patient` is what the camp team recorded when
//! they rang round afterwards. An encounter dated after the camp is what
//! actually happened at the hospital. They are different measurements and the
//! gap between them is the finding: a camp whose team recorded forty
//! conversions and which produced twelve encounters has a follow-up process
//! reporting intent as outcome.
//!
//! # The wall
//!
//! `camp_registrations.chief_complaint` exists and is never read here. It is
//! the reason somebody attended a camp, which is a clinical fact, and the
//! bridge copies a name, a number and a venue — never why they came. A camp
//! attendee list annotated with complaints, sitting in a marketing table, is
//! the wall in `0975_marketing.sql` breached by a convenience.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use medbrains_db::pool::set_tenant_context;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use serde::Serialize;
use uuid::Uuid;

/// How long after a camp an OPD visit still counts as produced by it.
///
/// Matches the default response window on a distribution run, so a camp and a
/// pamphlet run are judged over the same stretch of time and their
/// cost-per-conversion is comparable.
const CONVERSION_WINDOW_DAYS: i32 = 90;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CampAcquisitionRow {
    pub camp_id: Uuid,
    pub camp_code: String,
    pub name: String,
    pub scheduled_date: chrono::NaiveDate,
    pub venue_city: Option<String>,
    pub venue_latitude: Option<rust_decimal::Decimal>,
    pub venue_longitude: Option<rust_decimal::Decimal>,
    pub expected_participants: Option<i32>,
    pub budget_spent: Option<rust_decimal::Decimal>,
    /// Everybody who registered at the camp.
    pub attendees: i64,
    /// Of those, the ones already on the patient register when they arrived.
    /// A camp that draws its own existing patients is running a follow-up
    /// clinic, which is a fine thing to do and a different thing to fund.
    pub already_patients: i64,
    /// Registrations that carry no patient link — the people a camp exists to
    /// reach.
    pub new_faces: i64,
    /// What the camp team recorded on follow-up.
    pub team_reported_conversions: i64,
    /// Attendees with an actual encounter at the hospital after the camp,
    /// inside the window. What happened, rather than what was intended.
    pub attended_hospital: i64,
}

/// `GET /api/marketing/reports/camps`
///
/// Every camp as an acquisition event.
///
/// The counts are lateral subqueries rather than joins because each is over a
/// different table at a different grain — joining registrations, follow-ups
/// and encounters in one pass multiplies the attendee count by the number of
/// follow-ups per attendee, which is the classic way this report comes out
/// three times too big.
///
/// # Errors
/// Returns 403 without `marketing.reports.view`.
pub async fn camp_acquisition(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<CampAcquisitionRow>>, AppError> {
    require_permission(&claims, permissions::marketing::REPORTS_VIEW)?;
    // Aggregate only. No attendee is named, no complaint is selected, and
    // there is no column here that could carry one.

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CampAcquisitionRow>(
        "SELECT c.id AS camp_id, c.camp_code, c.name, c.scheduled_date, \
                c.venue_city, c.venue_latitude, c.venue_longitude, \
                c.expected_participants, c.budget_spent, \
                COALESCE(r.attendees, 0)::bigint AS attendees, \
                COALESCE(r.already_patients, 0)::bigint AS already_patients, \
                COALESCE(r.new_faces, 0)::bigint AS new_faces, \
                COALESCE(f.n, 0)::bigint AS team_reported_conversions, \
                COALESCE(e.n, 0)::bigint AS attended_hospital \
         FROM camps c \
         LEFT JOIN LATERAL ( \
             SELECT count(*) AS attendees, \
                    count(*) FILTER (WHERE reg.patient_id IS NOT NULL) AS already_patients, \
                    count(*) FILTER (WHERE reg.patient_id IS NULL) AS new_faces \
             FROM camp_registrations reg \
             WHERE reg.camp_id = c.id AND reg.tenant_id = c.tenant_id \
               AND reg.deleted_at IS NULL \
         ) r ON true \
         LEFT JOIN LATERAL ( \
             SELECT count(DISTINCT fu.registration_id) AS n \
             FROM camp_followups fu \
             JOIN camp_registrations reg ON reg.id = fu.registration_id \
             WHERE reg.camp_id = c.id AND fu.tenant_id = c.tenant_id \
               AND fu.converted_to_patient AND fu.deleted_at IS NULL \
         ) f ON true \
         LEFT JOIN LATERAL ( \
             SELECT count(DISTINCT reg.id) AS n \
             FROM camp_registrations reg \
             JOIN encounters enc ON enc.patient_id = reg.patient_id \
                                AND enc.tenant_id = reg.tenant_id \
             WHERE reg.camp_id = c.id AND reg.tenant_id = c.tenant_id \
               AND reg.patient_id IS NOT NULL AND reg.deleted_at IS NULL \
               AND enc.encounter_date > c.scheduled_date \
               AND enc.encounter_date <= c.scheduled_date + $2::int \
         ) e ON true \
         WHERE c.tenant_id = $1 AND c.deleted_at IS NULL \
         ORDER BY c.scheduled_date DESC \
         LIMIT 100",
    )
    .bind(claims.tenant_id)
    .bind(CONVERSION_WINDOW_DAYS)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Serialize)]
pub struct BridgeResult {
    pub camp_id: Uuid,
    /// Attendees now carrying a marketing touchpoint for this camp.
    pub linked: i64,
    /// Registrations with no usable phone number. They stay in the camp
    /// module; there is simply no way to follow them up.
    pub unreachable: i64,
}

/// `POST /api/marketing/camps/{id}/link-attendees`
///
/// Brings a camp's attendees into the acquisition funnel.
///
/// Each registration with a usable number becomes a marketing contact and a
/// `camp_walkin` touchpoint dated to the camp, in the camp's own city. From
/// there the attendee is countable in the channel report, comparable against
/// a pamphlet run, and reachable by the callback worklist — none of which the
/// camp module offers, because none of it is a camp's job.
///
/// Idempotent. Run it twice and the second run links nothing: `ON CONFLICT` on
/// the identity, and an existing camp touchpoint is not duplicated. A camp
/// team that clicks it again after late registrations should get the late
/// ones and nothing else.
///
/// What crosses: a name, a number, the camp, the city and the date. What does
/// not: `chief_complaint`, the screening, the referral. Those are why somebody
/// attended, and marketing does not get to hold that.
///
/// # Errors
/// Returns 403 without `marketing.interactions.log`, 404 if the camp is not in
/// this tenant.
pub async fn link_camp_attendees(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(camp_id): Path<Uuid>,
) -> Result<Json<BridgeResult>, AppError> {
    require_permission(&claims, permissions::marketing::interactions::LOG)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let camp: Option<(chrono::NaiveDate, Option<String>, String)> = sqlx::query_as(
        "SELECT scheduled_date, venue_city, name FROM camps \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(camp_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    let Some((scheduled_date, venue_city, camp_name)) = camp else {
        return Err(AppError::NotFound);
    };

    // Registrations whose number cannot be normalised are counted, not
    // guessed at. A camp in a village records numbers the way they were
    // shouted across a table.
    let unreachable: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM camp_registrations \
         WHERE camp_id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
           AND (phone IS NULL OR length(regexp_replace(phone, '\\D', '', 'g')) < 10)",
    )
    .bind(camp_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // One statement per stage rather than a row-by-row loop: a camp is a
    // thousand registrations, and a round trip each is a minute of somebody
    // watching a spinner.
    //
    // The contact carries the attendee's name and number and the camp as its
    // source. It does not carry the complaint.
    sqlx::query(
        "INSERT INTO mkt_contacts \
            (tenant_id, primary_phone, display_name, source, patient_id, first_seen_at) \
         SELECT $1, '+91' || right(regexp_replace(reg.phone, '\\D', '', 'g'), 10), \
                reg.person_name, 'camp', reg.patient_id, $3 \
         FROM camp_registrations reg \
         WHERE reg.camp_id = $2 AND reg.tenant_id = $1 AND reg.deleted_at IS NULL \
           AND reg.phone IS NOT NULL \
           AND length(regexp_replace(reg.phone, '\\D', '', 'g')) >= 10 \
         ON CONFLICT DO NOTHING",
    )
    .bind(claims.tenant_id)
    .bind(camp_id)
    .bind(scheduled_date)
    .execute(&mut *tx)
    .await?;

    // The touchpoint, dated to the camp rather than to now — the attribution
    // report reads occurrence order, and stamping today would put a camp from
    // March after a phone call in August.
    let linked = sqlx::query(
        "INSERT INTO mkt_touchpoints \
            (tenant_id, contact_id, kind, source, medium, area_label, \
             external_ref, occurred_at) \
         SELECT $1, mc.id, 'camp_walkin', 'camp', 'event', $4, $2::uuid::text, $3 \
         FROM camp_registrations reg \
         JOIN mkt_contacts mc \
              ON mc.tenant_id = $1 \
             AND mc.primary_phone = '+91' \
                 || right(regexp_replace(reg.phone, '\\D', '', 'g'), 10) \
         WHERE reg.camp_id = $2 AND reg.tenant_id = $1 AND reg.deleted_at IS NULL \
           AND reg.phone IS NOT NULL \
           AND length(regexp_replace(reg.phone, '\\D', '', 'g')) >= 10 \
           AND NOT EXISTS ( \
               SELECT 1 FROM mkt_touchpoints t \
               WHERE t.contact_id = mc.id AND t.tenant_id = $1 \
                 AND t.kind = 'camp_walkin' AND t.external_ref = $2::uuid::text \
           )",
    )
    .bind(claims.tenant_id)
    .bind(camp_id)
    .bind(scheduled_date)
    .bind(venue_city.as_deref())
    .execute(&mut *tx)
    .await?;

    // Adopt the camp's city into the area master where it is already defined,
    // so the catchment map and the area report see camp attendees without
    // anybody re-typing a locality.
    sqlx::query(
        "UPDATE mkt_touchpoints t SET area_id = a.id \
         FROM mkt_areas a \
         WHERE t.tenant_id = $1 AND a.tenant_id = $1 AND t.area_id IS NULL \
           AND t.external_ref = $2::uuid::text AND t.kind = 'camp_walkin' \
           AND lower(a.name) = lower(t.area_label)",
    )
    .bind(claims.tenant_id)
    .bind(camp_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    #[allow(clippy::cast_possible_wrap)]
    let linked = linked.rows_affected() as i64;
    tracing::info!(camp = %camp_name, linked, unreachable, "camp attendees linked to marketing");

    Ok(Json(BridgeResult {
        camp_id,
        linked,
        unreachable,
    }))
}

#[derive(Debug, Serialize)]
pub struct FollowUpWaveResult {
    pub camp_id: Uuid,
    /// Callbacks raised.
    pub raised: i64,
    /// Attendees skipped because they have already been to the hospital since
    /// the camp. Ringing them to follow up is the same embarrassment as
    /// ringing somebody to offer them what they already have.
    pub already_attended: i64,
    /// Attendees who already had a callback owed. Not duplicated.
    pub already_owed: i64,
}

/// `POST /api/marketing/camps/{id}/follow-up-wave`
///
/// Raises a callback for every camp attendee who has not since come to the
/// hospital.
///
/// The camp module already has follow-up CRUD — list, create, update, counts —
/// so what was missing was never the record, it was the act of deciding who
/// needs one. Somebody had to open a camp and create five hundred rows by
/// hand, which means nobody did.
///
/// These land in the **callback worklist**, not in a second queue of their
/// own. The desk already opens one list every morning; a camp wave arriving
/// somewhere else is a list that gets worked for a week and then forgotten.
/// `camp_followups` remains the camp team's own record of what they said when
/// they rang.
///
/// Attendees who have already been to the hospital are skipped, not raised and
/// closed: raising a callback for somebody who acted on the camp a fortnight
/// ago wastes the call and teaches the desk the list is noise.
///
/// Idempotent by omission — an attendee with a callback already owed is
/// counted and left alone, so running the wave twice after late registrations
/// picks up only the late ones.
///
/// # Errors
/// Returns 403 without `marketing.interactions.log`, 404 if the camp is not in
/// this tenant.
pub async fn camp_follow_up_wave(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(camp_id): Path<Uuid>,
) -> Result<Json<FollowUpWaveResult>, AppError> {
    // Raising a callback is scheduling a call, which is what interactions::LOG
    // already gates on the rest of this module.
    require_permission(&claims, permissions::marketing::interactions::LOG)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let camp: Option<(chrono::NaiveDate, String)> = sqlx::query_as(
        "SELECT scheduled_date, name FROM camps \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(camp_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    let Some((scheduled_date, camp_name)) = camp else {
        return Err(AppError::NotFound);
    };

    // Counted before the insert so the two numbers describe the same moment.
    // A count taken afterwards would exclude the rows just raised and report
    // a smaller skip figure than actually applied.
    let counts: (i64, i64) = sqlx::query_as(
        "SELECT \
            count(*) FILTER (WHERE EXISTS ( \
                SELECT 1 FROM encounters e \
                WHERE e.patient_id = reg.patient_id AND e.tenant_id = reg.tenant_id \
                  AND e.encounter_date > $3))::bigint, \
            count(*) FILTER (WHERE EXISTS ( \
                SELECT 1 FROM mkt_tasks t \
                JOIN mkt_contacts mc ON mc.id = t.contact_id \
                WHERE t.tenant_id = reg.tenant_id AND t.status = 'open' \
                  AND mc.primary_phone = '+91' \
                      || right(regexp_replace(reg.phone, '\\D', '', 'g'), 10)))::bigint \
         FROM camp_registrations reg \
         WHERE reg.camp_id = $1 AND reg.tenant_id = $2 AND reg.deleted_at IS NULL \
           AND reg.phone IS NOT NULL",
    )
    .bind(camp_id)
    .bind(claims.tenant_id)
    .bind(scheduled_date)
    .fetch_one(&mut *tx)
    .await?;

    // One statement. A camp is a thousand registrations and a round trip each
    // is a minute of somebody watching a spinner.
    let raised = sqlx::query(
        "INSERT INTO mkt_tasks (tenant_id, contact_id, due_at, kind, note) \
         SELECT $1, mc.id, now(), 'callback', $4 \
         FROM camp_registrations reg \
         JOIN mkt_contacts mc \
              ON mc.tenant_id = $1 \
             AND mc.primary_phone = '+91' \
                 || right(regexp_replace(reg.phone, '\\D', '', 'g'), 10) \
         WHERE reg.camp_id = $2 AND reg.tenant_id = $1 AND reg.deleted_at IS NULL \
           AND reg.phone IS NOT NULL \
           AND length(regexp_replace(reg.phone, '\\D', '', 'g')) >= 10 \
           AND NOT EXISTS ( \
               SELECT 1 FROM encounters e \
               WHERE e.patient_id = reg.patient_id AND e.tenant_id = reg.tenant_id \
                 AND e.encounter_date > $3) \
           AND NOT EXISTS ( \
               SELECT 1 FROM mkt_tasks t \
               WHERE t.tenant_id = $1 AND t.contact_id = mc.id AND t.status = 'open')",
    )
    .bind(claims.tenant_id)
    .bind(camp_id)
    .bind(scheduled_date)
    .bind(format!("Follow-up after {camp_name}"))
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    #[allow(clippy::cast_possible_wrap)]
    let raised = raised.rows_affected() as i64;
    Ok(Json(FollowUpWaveResult {
        camp_id,
        raised,
        already_attended: counts.0,
        already_owed: counts.1,
    }))
}
