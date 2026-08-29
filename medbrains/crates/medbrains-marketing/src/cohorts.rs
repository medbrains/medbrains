//! Cohorts — the lists a campaign is sent to.
//!
//! # The wall, and where it actually is
//!
//! A recall campaign is the strongest commercial feature in this module and
//! the one that turns a marketing tool into a processor of health data.
//! "Everybody due for a retinopathy screen" is a list of people with diabetes.
//!
//! The wall is not "marketing code may not read a clinical table". It is
//! **what crosses into the `mkt_*` tables, and under whose authority the
//! crossing happens**:
//!
//! - A clinical cohort is defined under `marketing.cohorts.clinical_define`,
//!   which is held by **doctor** and by nobody in marketing.
//! - What the resolver writes is `mkt_cohort_members` — contact ids and
//!   nothing else. No diagnosis, no ICD code, no date of last visit.
//! - `mkt_cohorts.criteria` stays NULL for a clinical cohort, enforced by a
//!   CHECK constraint in `0975_marketing.sql`, so the criteria cannot be
//!   reconstructed from this schema either.
//! - The campaign shows `criteria_label`, which the clinician writes and which
//!   is deliberately coarse: "annual review due", not "E11.3".
//!
//! So a marketing user with every marketing permission, reading every row in
//! all ten tables, learns that some number of people are worth calling and not
//! one thing about why.
//!
//! # Why v1 has only dormancy
//!
//! The one criterion here is "no encounter in N days, optionally within a
//! department". It is the recall list a hospital actually asks for, and it
//! needs no diagnosis to compute — so the first clinical cohort ships without
//! anybody having to decide how much of a chart a query may touch. Richer
//! criteria are a later conversation, and one worth having deliberately.

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
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Ceiling on a single cohort. A campaign that would dial fifty thousand
/// people is a decision somebody should make on purpose, not a query that
/// happened to match.
const MAX_COHORT_MEMBERS: i64 = 5_000;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Cohort {
    pub id: Uuid,
    pub name: String,
    pub criteria_kind: String,
    /// Present only for an enquiry cohort. A clinical cohort's criteria never
    /// enter this schema.
    pub criteria: Option<serde_json::Value>,
    pub criteria_label: Option<String>,
    pub member_count: i32,
    pub refreshed_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct CreateEnquiryCohortRequest {
    pub name: String,
    /// Enquiry-level filter — source, campaign, stage, last contacted.
    pub criteria: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct CreateClinicalCohortRequest {
    pub name: String,
    /// The coarse, human label the campaign will show. Written by the
    /// clinician defining the cohort, because they are the one who knows what
    /// is safe to say out loud.
    pub criteria_label: String,
    /// Nobody seen in this many days.
    pub dormant_days: i32,
    /// Optionally narrow to one department's patients.
    pub department_id: Option<Uuid>,
}

/// `GET /api/marketing/cohorts`
///
/// # Errors
/// Returns 403 without `marketing.cohorts.view`.
pub async fn list_cohorts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<Cohort>>, AppError> {
    require_permission(&claims, permissions::marketing::cohorts::VIEW)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, Cohort>(
        "SELECT id, name, criteria_kind, criteria, criteria_label, member_count, refreshed_at \
         FROM mkt_cohorts WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 200",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// Resolves an enquiry cohort's stored criteria into member rows and
/// returns how many matched.
///
/// The criteria it understands, all optional and combined with AND:
///
/// | key                  | meaning                                        |
/// |----------------------|------------------------------------------------|
/// | `source`             | how the enquiry was first recorded             |
/// | `stage`              | stage code the enquiry sits in now             |
/// | `area`               | reached us through a touchpoint in this ward   |
/// | `channel`            | reached us through this channel, ever          |
/// | `campaign_id`        | attributable to this campaign                  |
/// | `not_contacted_days` | nobody has rung them in this many days         |
/// | `unconverted_only`   | not yet a patient                              |
///
/// The last two are the ones that turn a list into a worklist. "Everyone from
/// the Gandhipuram pamphlet run who is still not a patient and has not been
/// called in three weeks" is the campaign a hospital actually wants to send,
/// and before these it could not be expressed at all.
///
/// Shared by creation and refresh so the two cannot drift: a cohort whose
/// count came from one code path and whose membership came from another is a
/// list that disagrees with its own label.
///
/// A stage filter excludes contacts sitting in no stage at all, which is the
/// intended reading — "everyone in Contacted" does not mean "everyone,
/// including those we have not filed yet".
///
/// # Errors
/// Propagates the insert failure.
async fn resolve_enquiry_members(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    cohort_id: Uuid,
    criteria: Option<&serde_json::Value>,
) -> Result<i32, AppError> {
    let field = |key: &str| {
        criteria
            .and_then(|c| c.get(key))
            .and_then(serde_json::Value::as_str)
            .map(str::to_owned)
    };

    let number = |key: &str| {
        criteria
            .and_then(|c| c.get(key))
            .and_then(serde_json::Value::as_i64)
            .and_then(|n| i32::try_from(n).ok())
    };

    // Every criterion is a filter on one contact row, so this stays a single
    // pass over `mkt_contacts`. The touchpoint conditions are EXISTS rather
    // than joins: a person who saw three pamphlets has three touchpoints, and
    // joining would put them in the cohort three times over — which
    // ON CONFLICT would swallow, leaving the count right and the query
    // needlessly quadratic.
    let inserted = sqlx::query(
        "INSERT INTO mkt_cohort_members (tenant_id, cohort_id, contact_id) \
         SELECT $1, $2, c.id \
         FROM mkt_contacts c \
         LEFT JOIN mkt_pipeline_stages s \
                ON s.id = c.stage_id AND s.tenant_id = c.tenant_id \
         WHERE c.tenant_id = $1 \
           AND ($3::text IS NULL OR c.source = $3) \
           AND ($4::text IS NULL OR s.code = $4) \
           AND ($6::text IS NULL OR EXISTS ( \
                 SELECT 1 FROM mkt_touchpoints t \
                 WHERE t.contact_id = c.id AND t.tenant_id = c.tenant_id \
                   AND lower(t.area_label) = lower($6))) \
           AND ($7::text IS NULL OR EXISTS ( \
                 SELECT 1 FROM mkt_touchpoints t \
                 WHERE t.contact_id = c.id AND t.tenant_id = c.tenant_id \
                   AND t.kind = $7)) \
           AND ($8::uuid IS NULL OR EXISTS ( \
                 SELECT 1 FROM mkt_touchpoints t \
                 WHERE t.contact_id = c.id AND t.tenant_id = c.tenant_id \
                   AND t.campaign_id = $8)) \
           AND ($9::int IS NULL OR c.last_contacted_at IS NULL \
                OR c.last_contacted_at < now() - make_interval(days => $9)) \
           AND (NOT $10::boolean OR c.patient_id IS NULL) \
         LIMIT $5 \
         ON CONFLICT (tenant_id, cohort_id, contact_id) DO NOTHING",
    )
    .bind(tenant_id)
    .bind(cohort_id)
    .bind(field("source"))
    .bind(field("stage"))
    .bind(MAX_COHORT_MEMBERS)
    .bind(field("area"))
    .bind(field("channel"))
    .bind(
        criteria
            .and_then(|c| c.get("campaign_id"))
            .and_then(serde_json::Value::as_str)
            .and_then(|v| Uuid::parse_str(v).ok()),
    )
    .bind(number("not_contacted_days"))
    .bind(
        criteria
            .and_then(|c| c.get("unconverted_only"))
            .and_then(serde_json::Value::as_bool)
            .unwrap_or(false),
    )
    .execute(&mut **tx)
    .await?;

    #[allow(clippy::cast_possible_truncation, clippy::cast_possible_wrap)]
    Ok(inserted.rows_affected() as i32)
}

/// `POST /api/marketing/cohorts/{id}/refresh`
///
/// Re-resolves an enquiry cohort against the marketing tables as they stand
/// now, and stamps `refreshed_at`.
///
/// A cohort is a query result, and a query result ages. Left alone, "everyone
/// who enquired and was never called back" keeps naming the people who have
/// since been called back, and stops naming the ones who have since been
/// missed — so the list is at its least accurate exactly when somebody is
/// working through it.
///
/// A clinical cohort is refused rather than refreshed, and the refusal is the
/// design working: `mkt_cohorts_clinical_opaque` forbids storing its criteria,
/// so there is nothing here to re-run. Re-defining it is a clinical act that
/// belongs to whoever holds `clinical_define`.
///
/// # Errors
/// Returns 403 without `marketing.cohorts.manage`, 404 if the cohort is not in
/// this tenant, 409 for a clinical cohort.
pub async fn refresh_cohort(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Cohort>, AppError> {
    require_permission(&claims, permissions::marketing::cohorts::MANAGE)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let existing = sqlx::query_as::<_, Cohort>(
        "SELECT id, name, criteria_kind, criteria, criteria_label, member_count, refreshed_at \
         FROM mkt_cohorts WHERE id = $1 AND tenant_id = $2 FOR UPDATE",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if existing.criteria_kind == "clinical" {
        return Err(AppError::Conflict(
            "a clinical cohort cannot be refreshed here — its criteria are \
             deliberately not stored in the marketing schema. Define it again \
             from the clinical side."
                .to_owned(),
        ));
    }

    // Membership is replaced rather than added to. Appending would make the
    // cohort the union of every filter it has ever had, which grows and never
    // shrinks — a contact who has moved out of the stage would stay on the
    // list forever.
    sqlx::query("DELETE FROM mkt_cohort_members WHERE cohort_id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;

    let count =
        resolve_enquiry_members(&mut tx, claims.tenant_id, id, existing.criteria.as_ref()).await?;

    let refreshed = sqlx::query_as::<_, Cohort>(
        "UPDATE mkt_cohorts SET member_count = $3, refreshed_at = now() \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING id, name, criteria_kind, criteria, criteria_label, member_count, refreshed_at",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(count)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(refreshed))
}

/// `POST /api/marketing/cohorts`
///
/// An enquiry cohort: source, campaign, stage. Nothing clinical, so marketing
/// owns it end to end.
///
/// # Errors
/// Returns 403 without `marketing.cohorts.manage`, 400 on an empty name.
pub async fn create_enquiry_cohort(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateEnquiryCohortRequest>,
) -> Result<Json<Cohort>, AppError> {
    require_permission(&claims, permissions::marketing::cohorts::MANAGE)?;

    if body.name.trim().is_empty() {
        return Err(AppError::BadRequest("cohort name is required".to_owned()));
    }

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, Cohort>(
        "INSERT INTO mkt_cohorts \
            (tenant_id, name, criteria_kind, criteria, defined_by) \
         VALUES ($1, $2, 'enquiry', $3, $4) \
         RETURNING id, name, criteria_kind, criteria, criteria_label, member_count, refreshed_at",
    )
    .bind(claims.tenant_id)
    .bind(body.name.trim())
    .bind(&body.criteria)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    // Resolved on creation rather than left at zero. An enquiry cohort used
    // to store its criteria and never run them, so `member_count` was 0 and
    // `refreshed_at` NULL for every one of them, permanently — a list that
    // reported itself as empty on the screen that exists to send to it.
    let count =
        resolve_enquiry_members(&mut tx, claims.tenant_id, row.id, Some(&body.criteria)).await?;

    let resolved = sqlx::query_as::<_, Cohort>(
        "UPDATE mkt_cohorts SET member_count = $3, refreshed_at = now() \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING id, name, criteria_kind, criteria, criteria_label, member_count, refreshed_at",
    )
    .bind(row.id)
    .bind(claims.tenant_id)
    .bind(count)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(resolved))
}

/// `POST /api/marketing/cohorts/clinical`
///
/// Builds a recall list from the clinical record and writes **only contact
/// ids** into the marketing schema. Requires `marketing.cohorts.clinical_define`,
/// which marketing roles do not hold.
///
/// A patient with no marketing contact is skipped rather than invented: this
/// module does not create a contact record for somebody who has never made an
/// enquiry, because that would quietly copy the patient register into the
/// marketing schema one campaign at a time.
///
/// # Errors
/// Returns 403 without `marketing.cohorts.clinical_define`, 400 on an empty
/// name or label.
pub async fn create_clinical_cohort(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateClinicalCohortRequest>,
) -> Result<Json<Cohort>, AppError> {
    require_permission(&claims, permissions::marketing::cohorts::CLINICAL_DEFINE)?;

    if body.name.trim().is_empty() || body.criteria_label.trim().is_empty() {
        return Err(AppError::BadRequest(
            "a clinical cohort needs a name and a label the campaign can show".to_owned(),
        ));
    }
    let dormant_days = body.dormant_days.clamp(1, 3650);

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // `criteria` is left NULL — the CHECK constraint in 0975 requires it for a
    // clinical cohort, so the dormancy window cannot be read back out of this
    // schema even by somebody with every marketing permission.
    let cohort = sqlx::query_as::<_, Cohort>(
        "INSERT INTO mkt_cohorts \
            (tenant_id, name, criteria_kind, criteria_label, defined_by, refreshed_at) \
         VALUES ($1, $2, 'clinical', $3, $4, now()) \
         RETURNING id, name, criteria_kind, criteria, criteria_label, member_count, refreshed_at",
    )
    .bind(claims.tenant_id)
    .bind(body.name.trim())
    .bind(body.criteria_label.trim())
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    // The one statement in this module that reads the clinical record. It
    // returns ids and joins straight to mkt_contacts, so nothing about why a
    // patient qualified is ever selected — not the last encounter date, not
    // the department, not a diagnosis.
    // The department predicate belongs to the JOIN, not the WHERE.
    //
    // In the WHERE it discarded every row where `e` was NULL, which silently
    // turns this outer join into an inner one — so `HAVING max(e.encounter_date)
    // IS NULL`, the branch that catches patients with no qualifying encounter
    // at all, could never fire once a department was named.
    //
    // Those are the people the list is for. "Diabetics not seen in
    // ophthalmology for a year" excluded everyone who has never been to
    // ophthalmology, which is precisely who needs a first retinopathy screen.
    let inserted = sqlx::query(
        "INSERT INTO mkt_cohort_members (tenant_id, cohort_id, contact_id) \
         SELECT $1, $2, c.id \
         FROM patients p \
         JOIN mkt_contacts c ON c.patient_id = p.id AND c.tenant_id = p.tenant_id \
         LEFT JOIN encounters e ON e.patient_id = p.id AND e.tenant_id = p.tenant_id \
                AND ($3::uuid IS NULL OR e.department_id = $3) \
         WHERE p.tenant_id = $1 \
         GROUP BY c.id \
         HAVING max(e.encounter_date) IS NULL \
             OR max(e.encounter_date) < (CURRENT_DATE - $4::int) \
         LIMIT $5 \
         ON CONFLICT (tenant_id, cohort_id, contact_id) DO NOTHING",
    )
    .bind(claims.tenant_id)
    .bind(cohort.id)
    .bind(body.department_id)
    .bind(dormant_days)
    .bind(MAX_COHORT_MEMBERS)
    .execute(&mut *tx)
    .await?;

    #[allow(clippy::cast_possible_truncation, clippy::cast_possible_wrap)]
    let count = inserted.rows_affected() as i32;

    let refreshed = sqlx::query_as::<_, Cohort>(
        "UPDATE mkt_cohorts SET member_count = $3, refreshed_at = now() \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING id, name, criteria_kind, criteria, criteria_label, member_count, refreshed_at",
    )
    .bind(cohort.id)
    .bind(claims.tenant_id)
    .bind(count)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(refreshed))
}

/// `GET /api/marketing/cohorts/{id}/size`
///
/// The size and nothing else. There is deliberately no endpoint that lists a
/// clinical cohort's members alongside why they qualified, because that
/// endpoint is the wall with a door in it.
///
/// # Errors
/// Returns 403 without `marketing.cohorts.view`, 404 if the cohort is not in
/// this tenant.
pub async fn cohort_size(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::marketing::cohorts::VIEW)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let size: Option<i64> = sqlx::query_scalar(
        "SELECT count(m.contact_id) FROM mkt_cohorts c \
         LEFT JOIN mkt_cohort_members m \
                ON m.cohort_id = c.id AND m.tenant_id = c.tenant_id \
         WHERE c.id = $1 AND c.tenant_id = $2 GROUP BY c.id",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;

    let size = size.ok_or(AppError::NotFound)?;
    Ok(Json(serde_json::json!({ "cohort_id": id, "size": size })))
}
