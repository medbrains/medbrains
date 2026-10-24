//! One PC-PNDT Form F, as the Act's register keeps it: the clinic, the woman,
//! who referred her, the scan and its indication and result, and the two
//! declarations. The sex of the fetus is never recorded, so it cannot print.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use medbrains_core::print_data::{
    FormFClinic, FormFDeclarations, FormFProcedure, FormFReferral, FormFWoman, PcpndtFormFPrintData,
};
use medbrains_server_core::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
};
use uuid::Uuid;

const WOMAN_DECLARATION: &str = "I declare that I do not want to know the sex of my foetus, \
     and that undergoing this procedure is not for that purpose.";
const DOCTOR_DECLARATION: &str = "I declare that while conducting this procedure I have \
     neither detected nor disclosed the sex of the foetus to any person in any manner.";

/// `GET /api/print-data/pcpndt-form-f/{id}`
pub async fn get_pcpndt_form_f_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PcpndtFormFPrintData>, AppError> {
    require_permission(&claims, permissions::regulatory::pcpndt::LIST)?;
    let patient: Uuid = sqlx::query_scalar(
        "SELECT patient_id FROM pcpndt_forms WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?)
    .await?
    .ok_or(AppError::NotFound)?;
    // Her name and her pregnancy, on paper: the register's permission is not
    // permission to this woman's record.
    medbrains_authz_gate::require_patient_access(&state, &claims, patient).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let (form_number, woman_at, doctor_at): (String, Option<String>, Option<String>) =
        sqlx::query_as(
            "SELECT form_number, to_char(woman_declared_at, 'DD Mon YYYY HH24:MI'), \
                to_char(doctor_declared_at, 'DD Mon YYYY HH24:MI') \
           FROM pcpndt_forms WHERE id = $1 AND tenant_id = $2",
        )
        .bind(id)
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;
    let clinic: (String, Option<String>, Option<String>) = sqlx::query_as(
        "SELECT name, concat_ws(', ', address_line1, address_line2, city, pincode), \
                pcpndt_registration_number FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    let woman = sqlx::query_as::<_, FormFWoman>(
        "SELECT concat_ws(' ', p.first_name, p.last_name) AS name, p.uhid, \
                date_part('year', age(p.date_of_birth))::int AS age_years, \
                COALESCE(p.spouse_name, p.father_name, p.guardian_name) AS husband_or_father, \
                COALESCE(p.address_line1, p.address::text) AS address, p.phone, \
                f.living_sons, f.living_daughters, \
                to_char(f.lmp_date, 'DD Mon YYYY') AS last_menstrual_period, \
                f.gestational_age_weeks AS weeks_of_pregnancy \
           FROM pcpndt_forms f JOIN patients p ON p.id = f.patient_id AND p.tenant_id = f.tenant_id \
          WHERE f.id = $1 AND f.tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    let referral = sqlx::query_as::<_, FormFReferral>(
        "SELECT f.self_referred, CASE WHEN f.self_referred THEN NULL ELSE u.full_name END AS referred_by, \
                CASE WHEN f.self_referred THEN NULL \
                     ELSE COALESCE(u.medical_registration_number, u.registration_number) END \
                  AS referring_doctor_registration \
           FROM pcpndt_forms f LEFT JOIN users u ON u.id = f.referral_doctor_id \
          WHERE f.id = $1 AND f.tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    let procedure = sqlx::query_as::<_, FormFProcedure>(
        "SELECT f.procedure_type AS procedure, f.indication, u.full_name AS performed_by, \
                COALESCE(u.medical_registration_number, u.registration_number) \
                  AS performing_doctor_registration, \
                to_char(COALESCE(f.form_signed_at, f.created_at), 'DD Mon YYYY') AS performed_on, \
                f.result_summary AS result \
           FROM pcpndt_forms f LEFT JOIN users u ON u.id = f.performing_doctor_id \
          WHERE f.id = $1 AND f.tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(PcpndtFormFPrintData {
        form_number,
        clinic: FormFClinic {
            name: clinic.0,
            address: clinic.1.unwrap_or_default(),
            pcpndt_registration_number: clinic.2.unwrap_or_default(),
        },
        woman,
        referral,
        procedure,
        declarations: FormFDeclarations {
            woman: WOMAN_DECLARATION.to_owned(),
            woman_declared_at: woman_at,
            doctor: DOCTOR_DECLARATION.to_owned(),
            doctor_declared_at: doctor_at,
        },
    }))
}
