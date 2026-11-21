//! The hospital OPD number at the desk, over HTTP.
//!
//! The policy screen, the previous and next number the registration form
//! shows, and the number registration gives. The rules live in `medbrains_server_services::opd_number`; this is HTTP.

use axum::extract::State;
use axum::routing::{get, put};
use axum::{Extension, Json};
use chrono::NaiveDate;
use medbrains_core::permissions;
use medbrains_kernel as kernel;
use medbrains_kernel::audit::AuditEntry;
use medbrains_kernel::authz::Outcome;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::state::AppState;
use medbrains_server_services::opd_number::{self, Assigned, Entry, Mode, Policy, Target};
use serde::Serialize;
use uuid::Uuid;

/// The policy and the numbers the form shows beside the field.
#[derive(Debug, Serialize)]
pub struct OpdNumberView {
    #[serde(flatten)]
    pub policy: Policy,
    /// The last number used, formatted; `None` before the first.
    pub previous: Option<String>,
    /// The number to fill in, formatted.
    pub next: String,
}

/// The routes, merged into the patients router.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/registration/opd-number", get(get_opd_number))
        .route("/api/registration/opd-number/policy", put(update_policy))
        .merge(crate::search_settings::router())
}

/// Read the policy and the previous and next number in the caller's
/// transaction: the UHID series' in one-number mode, else the OPD number's.
async fn view(state: &AppState, permit: &kernel::Permit) -> Result<OpdNumberView, AppError> {
    let mut tx = kernel::actor_tx(&state.db, permit, None).await?;
    let policy = opd_number::read_policy(&mut tx, permit.tenant_id()).await?;
    let (previous, next) = if policy.mode == Mode::Uhid {
        opd_number::suggest_uhid(&mut tx, permit.tenant_id()).await?
    } else {
        let s = opd_number::suggest(&mut tx, permit.tenant_id(), &policy).await?;
        (s.previous.map(|n| policy.format(n)), policy.format(s.next))
    };
    tx.commit().await?;
    Ok(OpdNumberView {
        policy,
        previous,
        next,
    })
}

/// `GET /api/registration/opd-number`: whoever registers a patient or starts a
/// visit sees the policy and the previous and next number. Numbers only.
pub async fn get_opd_number(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<OpdNumberView>, AppError> {
    let permit = kernel::authz::permit_any(
        &claims,
        &[
            permissions::patients::CREATE,
            permissions::opd::visit::CREATE,
        ],
    )?;
    Ok(Json(view(&state, &permit).await?))
}

/// `PUT /api/registration/opd-number/policy`: the hospital's own setting.
pub async fn update_policy(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(policy): Json<Policy>,
) -> Result<Json<OpdNumberView>, AppError> {
    let permit = kernel::authz::permit(&claims, permissions::admin::settings::general::MANAGE)?;
    let mut tx = kernel::actor_tx(&state.db, &permit, None).await?;
    opd_number::write_policy(&mut tx, claims.tenant_id, &policy).await?;
    tx.commit().await?;
    Ok(Json(view(&state, &permit).await?))
}

/// Whether the caller may give an OPD date before today. An unknown answer
/// is an error, never a quiet "no".
fn may_backdate(claims: &Claims) -> Result<bool, AppError> {
    match kernel::authz::permission_outcome(claims, permissions::patients::opd_number::BACKDATE) {
        Outcome::Allow => Ok(true),
        Outcome::Deny => Ok(false),
        Outcome::Unknown => Err(AppError::ServiceUnavailable(
            "permissions unavailable".into(),
        )),
    }
}

/// The audit row for a number given or corrected: old and new number and date.
async fn audit(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    action: &'static str,
    (old, new): (&serde_json::Value, &Assigned),
) -> Result<(), AppError> {
    let (entity_type, entity_id) = match new.target {
        Target::Patient(id) => ("patient", id),
        Target::Visit(id) => ("encounter", id),
    };
    let new_values = serde_json::json!({ "opd_number": &new.number, "opd_date": new.opd_date });
    kernel::audit::append(
        tx,
        &AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action,
            entity_type,
            entity_id: Some(entity_id),
            old_values: Some(old),
            new_values: Some(&new_values),
            ip_address: None,
        },
    )
    .await?;
    Ok(())
}

/// A registered patient and the OPD number and date registration gave them,
/// so the desk sees an automatic number at once.
#[derive(Debug, Serialize)]
pub struct CreatedPatient {
    #[serde(flatten)]
    pub patient: medbrains_core::patient::Patient,
    pub opd_number: Option<String>,
    pub opd_date: Option<NaiveDate>,
}

/// The new patient's UHID: in one-number mode the register number the desk
/// typed (none typed: the series' next, as everywhere else), otherwise the
/// series' next. A typed UHID where the hospital gives them automatically is
/// refused, never silently replaced.
pub(crate) async fn uhid_at_registration(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    body: &crate::CreatePatientRequest,
) -> Result<String, AppError> {
    let typed = body
        .uhid
        .as_deref()
        .map(str::trim)
        .filter(|t| !t.is_empty());
    let Some(typed) = typed else {
        return generate_uhid(tx, &tenant_id).await;
    };
    if opd_number::read_policy(tx, tenant_id).await?.mode != Mode::Uhid {
        return Err(AppError::BadRequest(
            "This hospital gives UHIDs automatically. Reload the form".into(),
        ));
    }
    opd_number::take_typed_uhid(tx, tenant_id, typed).await
}

/// The UHID series' next value, as automatic registration gives it: the
/// series row's `UPDATE … RETURNING` is atomic and holds the row lock to the
/// end of the transaction, the same lock a typed UHID takes.
///
/// # Errors
/// No UHID series for the hospital, or a database failure.
pub async fn generate_uhid(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
) -> Result<String, AppError> {
    let seq = sqlx::query!(
        "UPDATE sequences SET current_val = current_val + 1 \
         WHERE tenant_id = $1 AND seq_type = 'UHID' \
         RETURNING current_val, prefix, pad_width",
        tenant_id,
    )
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(|| AppError::Internal("UHID sequence not configured for this tenant".into()))?;
    let pad = usize::try_from(seq.pad_width).unwrap_or(5);
    Ok(format!("{}{:0>pad$}", seq.prefix, seq.current_val))
}

/// In one-number mode: the register date on the new patient, today unless
/// the hospital allows an earlier one and the desk may backdate. A chosen
/// date is audited with the UHID it belongs to.
async fn date_register(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    (patient_id, policy): (Uuid, &Policy),
    entry: &Entry<'_>,
) -> Result<(), AppError> {
    let today =
        medbrains_server_core::hospital_time::tenant_local_today(&mut **tx, claims.tenant_id)
            .await?;
    let date = opd_number::check_date(policy, entry, today)?;
    let uhid = sqlx::query_scalar!(
        "UPDATE patients SET opd_date = $3 WHERE tenant_id = $1 AND id = $2 RETURNING uhid",
        claims.tenant_id,
        patient_id,
        date
    )
    .fetch_one(&mut **tx)
    .await?;
    if entry.opd_date.is_none() {
        return Ok(());
    }
    let new_values = serde_json::json!({ "uhid": uhid, "opd_date": date });
    kernel::audit::append(
        tx,
        &AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "patients.uhid.dated",
            entity_type: "patient",
            entity_id: Some(patient_id),
            old_values: None,
            new_values: Some(&new_values),
            ip_address: None,
        },
    )
    .await?;
    Ok(())
}

/// Give a newly registered patient their OPD number and date when the hospital
/// keeps one per patient, or in one-number mode the register date. A date the
/// desk chose (an old paper record) is audited; `created_at` is untouched and
/// nothing else is created.
pub(crate) async fn assign_at_registration(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    patient_id: Uuid,
    body: &crate::CreatePatientRequest,
) -> Result<Option<Assigned>, AppError> {
    let entry = Entry {
        typed: body.opd_number.as_deref(),
        opd_date: body.opd_date,
        may_backdate: may_backdate(claims)?,
    };
    let policy = opd_number::read_policy(tx, claims.tenant_id).await?;
    if policy.mode == Mode::Uhid {
        date_register(tx, claims, (patient_id, &policy), &entry).await?;
        return Ok(None);
    }
    let ids = (patient_id, None);
    let assigned = opd_number::assign(tx, claims.tenant_id, ids, entry).await?;
    if let Some(new) = assigned.as_ref().filter(|_| body.opd_date.is_some()) {
        let none = serde_json::json!({ "opd_number": null, "opd_date": null });
        audit(tx, claims, "patients.opd_number.dated", (&none, new)).await?;
    }
    Ok(assigned)
}

/// The registration response: the patient as this user may see them, and the
/// number and date registration gave them.
pub(crate) fn created(
    patient: medbrains_core::patient::Patient,
    restricted: &std::collections::HashMap<String, medbrains_core::form::FieldAccessLevel>,
    assigned: Option<Assigned>,
) -> CreatedPatient {
    CreatedPatient {
        patient: crate::filter_patient_response(patient, restricted),
        opd_number: assigned.as_ref().map(|a| a.number.clone()),
        opd_date: assigned.and_then(|a| a.opd_date),
    }
}

/// A patient's OPD number and date as a screen shows them; empty for a
/// hospital that keeps none.
#[derive(Debug, Default, Serialize)]
pub struct OnRow {
    pub opd_number: Option<String>,
    pub opd_date: Option<NaiveDate>,
}

/// One patient's OPD number and date, for the patient header. An identifier
/// like the UHID: empty wherever the UHID is hidden from this user.
pub(crate) async fn of_patient(
    conn: &mut sqlx::PgConnection,
    (tenant_id, patient_id): (Uuid, Uuid),
    restricted: &std::collections::HashMap<String, medbrains_core::form::FieldAccessLevel>,
) -> Result<OnRow, AppError> {
    if crate::patient_field_is_hidden(restricted, crate::PATIENT_UHID_FIELD) {
        return Ok(OnRow::default());
    }
    let row = sqlx::query_as!(
        OnRow,
        "SELECT opd_number, opd_date FROM patients WHERE tenant_id = $1 AND id = $2",
        tenant_id,
        patient_id
    )
    .fetch_optional(&mut *conn)
    .await?;
    Ok(row.unwrap_or_default())
}

/// The OPD numbers of a page of patients, the patient's own else their latest
/// numbered visit's, in one query.
pub(crate) async fn on_rows(
    conn: &mut sqlx::PgConnection,
    tenant_id: Uuid,
    patient_ids: &[Uuid],
) -> Result<std::collections::HashMap<Uuid, OnRow>, AppError> {
    if patient_ids.is_empty() {
        return Ok(std::collections::HashMap::new());
    }
    let rows = sqlx::query!(
        r#"SELECT p.id AS "id!", COALESCE(p.opd_number, v.encounter_number) AS opd_number,
                  CASE WHEN p.opd_number IS NOT NULL THEN p.opd_date ELSE v.encounter_date END
                    AS opd_date
             FROM patients p
             LEFT JOIN LATERAL (
               SELECT e.encounter_number, e.encounter_date FROM encounters e
                WHERE e.tenant_id = p.tenant_id AND e.patient_id = p.id
                  AND e.encounter_number IS NOT NULL AND e.deleted_at IS NULL
                ORDER BY e.encounter_date DESC, e.created_at DESC LIMIT 1
             ) v ON true
            WHERE p.tenant_id = $1 AND p.id = ANY($2)
              AND (p.opd_number IS NOT NULL OR v.encounter_number IS NOT NULL)"#,
        tenant_id,
        patient_ids
    )
    .fetch_all(&mut *conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|r| {
            (
                r.id,
                OnRow {
                    opd_number: r.opd_number,
                    opd_date: r.opd_date,
                },
            )
        })
        .collect())
}

/// A list row's OPD number: an identifier like the UHID, so empty wherever
/// the UHID is hidden from this user.
pub(crate) fn take(
    rows: &mut std::collections::HashMap<Uuid, OnRow>,
    patient_id: Uuid,
    restricted: &std::collections::HashMap<String, medbrains_core::form::FieldAccessLevel>,
) -> OnRow {
    if crate::patient_field_is_hidden(restricted, crate::PATIENT_UHID_FIELD) {
        return OnRow::default();
    }
    rows.remove(&patient_id).unwrap_or_default()
}

#[cfg(test)]
mod db_tests {
    // The list's OPD numbers against a real database, as the request role:
    // the patient's own number, else the latest numbered visit's; nothing for
    // a patient without one or another hospital's patient.
    #![allow(clippy::expect_used)]

    use medbrains_db_migrations::testing::{APP_ROLE, add_tenant, fresh_db};
    use uuid::Uuid;

    /// Insert a patient as the owner, with an optional OPD number.
    async fn patient(db: &sqlx::PgPool, tenant: Uuid, uhid: &str, opd: Option<&str>) -> Uuid {
        sqlx::query_scalar(
            "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone, \
                                   opd_number, opd_date) \
             VALUES ($1, $2, 'Test', 'Patient', 'female', '9000000000', $3, \
                     CASE WHEN $3 IS NULL THEN NULL ELSE DATE '2019-03-04' END) RETURNING id",
        )
        .bind(tenant)
        .bind(uhid)
        .bind(opd)
        .fetch_one(db)
        .await
        .expect("patient")
    }

    #[tokio::test]
    async fn list_rows_carry_the_patient_or_latest_visit_opd_number() {
        let db = fresh_db().await.expect("test database");
        let owner = db.owner().await.expect("owner");
        let tenant = add_tenant(&owner, "OLR").await.expect("tenant");
        let other = add_tenant(&owner, "OLS").await.expect("tenant");
        let own = patient(&owner, tenant, "OLR-1", Some("1043")).await;
        let by_visit = patient(&owner, tenant, "OLR-2", None).await;
        let none = patient(&owner, tenant, "OLR-3", None).await;
        let elsewhere = patient(&owner, other, "OLS-1", Some("1043")).await;
        for (number, date) in [("7", "2026-01-01"), ("9", "2026-02-01")] {
            sqlx::query(
                "INSERT INTO encounters (tenant_id, patient_id, encounter_type, encounter_number, \
                                         encounter_date) VALUES ($1, $2, 'opd', $3, $4::date)",
            )
            .bind(tenant)
            .bind(by_visit)
            .bind(number)
            .bind(date)
            .execute(&owner)
            .await
            .expect("visit");
        }
        let app = db.connect(APP_ROLE).await.expect("app");
        let mut tx = app.begin().await.expect("tx");
        medbrains_kernel::enter_scope(
            &mut tx,
            &medbrains_kernel::Permit::unattended(tenant, "test"),
            &[],
        )
        .await
        .expect("context");
        let rows = super::on_rows(&mut tx, tenant, &[own, by_visit, none, elsewhere])
            .await
            .expect("rows");
        assert_eq!(
            rows.get(&own).and_then(|r| r.opd_number.as_deref()),
            Some("1043")
        );
        assert_eq!(
            rows.get(&own)
                .and_then(|r| r.opd_date)
                .map(|d| d.to_string())
                .as_deref(),
            Some("2019-03-04")
        );
        assert_eq!(
            rows.get(&by_visit).and_then(|r| r.opd_number.as_deref()),
            Some("9")
        );
        assert!(!rows.contains_key(&none), "no number, no entry");
        assert!(!rows.contains_key(&elsewhere), "another hospital's patient");
    }
}
