//! Who a transfer's bundles name: the patient, and the campus that is their
//! custodian.

use chrono::NaiveDate;
use medbrains_fhir::mapper::PatientView;
use medbrains_fhir::nrces::Party;
use uuid::Uuid;

use super::bundle_records::Tx;
use crate::error::AppError;

#[derive(sqlx::FromRow)]
struct PatientRow {
    id: Uuid,
    uhid: String,
    abha_id: Option<String>,
    first_name: String,
    last_name: String,
    gender: String,
    date_of_birth: Option<NaiveDate>,
    phone: Option<String>,
    abha_address: Option<String>,
}

/// The patient as the bundles name them, and their ABHA address (which
/// only the printed copy shows).
pub(super) async fn patient(
    tx: Tx<'_, '_>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<(PatientView, Option<String>), AppError> {
    let r = sqlx::query_as::<_, PatientRow>(
        "SELECT p.id, p.uhid, COALESCE(l.abha_number, p.abha_id) AS abha_id, p.first_name, p.last_name, \
                p.gender::text AS gender, p.date_of_birth, p.phone, \
                COALESCE(NULLIF(l.abha_address, ''), NULLIF(p.abha_address, '')) AS abha_address \
           FROM patients p LEFT JOIN LATERAL (SELECT abha_number, abha_address FROM patient_abha_links l \
                WHERE l.tenant_id = p.tenant_id AND l.patient_id = p.id AND l.verified_at IS NOT NULL \
                  AND l.deleted_at IS NULL ORDER BY l.verified_at DESC LIMIT 1) l ON true \
          WHERE p.tenant_id = $1 AND p.id = $2",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let view = PatientView {
        id: r.id,
        uhid: r.uhid,
        abha_id: r.abha_id,
        prefix: None,
        first_name: r.first_name,
        middle_name: None,
        last_name: r.last_name,
        gender: r.gender,
        date_of_birth: r.date_of_birth,
        phone: r.phone,
        email: None,
        is_active: true,
    };
    Ok((view, r.abha_address))
}

/// The campus records are shared as; a hospital with no campus row yet is
/// named by its tenant, so every bundle has a custodian (and an author).
pub(super) async fn custodian(tx: Tx<'_, '_>, tenant_id: Uuid) -> Result<Party, AppError> {
    let row = sqlx::query_as::<_, (Uuid, String, Option<String>)>(
        "SELECT id, name, hfr FROM ( \
            SELECT f.id, f.name, f.hfr_facility_id AS hfr, 0 AS rank, \
                   (f.hfr_facility_id IS NOT NULL) AS has_hfr, (f.facility_type = 'main_hospital') AS main, f.created_at \
              FROM facilities f WHERE f.tenant_id = $1 AND f.deleted_at IS NULL AND f.parent_id IS NULL \
            UNION ALL SELECT t.id, t.name, NULL, 1, false, false, t.created_at FROM tenants t WHERE t.id = $1 \
          ) c ORDER BY rank, has_hfr DESC, main DESC, created_at LIMIT 1",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    Ok(Party {
        id: row.0,
        name: row.1,
        registry_id: row.2,
    })
}
