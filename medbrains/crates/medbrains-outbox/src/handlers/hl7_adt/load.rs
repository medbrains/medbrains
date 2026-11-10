//! What an ADT message carries, read at send time. Every query names the
//! tenant: the outbox worker's connection crosses tenants.

use chrono::{DateTime, NaiveDate, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use super::build::{Location, Patient, Visit};

pub(super) struct Destination {
    pub(super) host: String,
    pub(super) port: u16,
    pub(super) sending_facility: String,
    pub(super) receiving_application: String,
    pub(super) receiving_facility: String,
}

/// The ids the trigger put in the event.
pub(super) struct Ids {
    pub(super) patient: Option<Uuid>,
    pub(super) admission: Option<Uuid>,
    pub(super) encounter: Option<Uuid>,
    pub(super) prior_bed: Option<Uuid>,
    pub(super) prior_ward: Option<Uuid>,
}

/// An active destination, with the hospital's code as the sending facility
/// when the destination names none.
pub(super) async fn destination(
    pool: &PgPool,
    tenant_id: Uuid,
    id: Uuid,
) -> Result<Option<Destination>, sqlx::Error> {
    let row: Option<(String, i32, String, String, String)> = sqlx::query_as(
        "SELECT d.host, d.port, COALESCE(NULLIF(d.sending_facility, ''), t.code), \
                d.receiving_application, d.receiving_facility \
           FROM hl7_adt_destinations d JOIN tenants t ON t.id = d.tenant_id \
          WHERE d.id = $1 AND d.tenant_id = $2 AND d.is_active AND d.deleted_at IS NULL",
    )
    .bind(id)
    .bind(tenant_id)
    .fetch_optional(pool)
    .await?;
    Ok(row.and_then(|(host, port, sending, app, fac)| {
        Some(Destination {
            host,
            port: u16::try_from(port).ok()?,
            sending_facility: sending,
            receiving_application: app,
            receiving_facility: fac,
        })
    }))
}

#[derive(sqlx::FromRow)]
struct PatientRow {
    uhid: String,
    first_name: String,
    middle_name: String,
    last_name: String,
    date_of_birth: Option<NaiveDate>,
    gender: String,
    phone: String,
    address_line: String,
    city: String,
    state: String,
    postal_code: String,
}

#[derive(sqlx::FromRow)]
struct VisitRow {
    visit_number: String,
    class: String,
    ward: Option<String>,
    bed: Option<String>,
    attending_id: Option<Uuid>,
    attending_name: Option<String>,
    admitted_at: Option<DateTime<Utc>>,
    discharged_at: Option<DateTime<Utc>>,
}

async fn location(
    pool: &PgPool,
    tenant_id: Uuid,
    (ward, bed): (Option<Uuid>, Option<Uuid>),
) -> Result<Option<Location>, sqlx::Error> {
    if ward.is_none() && bed.is_none() {
        return Ok(None);
    }
    let row: (Option<String>, Option<String>) = sqlx::query_as(
        "SELECT (SELECT COALESCE(w.code, w.name) FROM wards w WHERE w.id = $2 AND w.tenant_id = $1), \
                (SELECT b.code FROM locations b WHERE b.id = $3 AND b.tenant_id = $1)",
    )
    .bind(tenant_id)
    .bind(ward)
    .bind(bed)
    .fetch_one(pool)
    .await?;
    Ok(Some(Location {
        ward: row.0.unwrap_or_default(),
        bed: row.1.unwrap_or_default(),
    }))
}

/// The patient and the visit the event is about; `None` when the patient
/// is gone. A demographic update (A08) with no visit sends PV1 class `N`.
pub(super) async fn record(
    pool: &PgPool,
    tenant_id: Uuid,
    ids: &Ids,
) -> Result<Option<(Patient, Visit)>, sqlx::Error> {
    let Some(patient_id) = ids.patient else {
        return Ok(None);
    };
    let Some(p) = sqlx::query_as::<_, PatientRow>(
        "SELECT uhid, first_name, COALESCE(middle_name, '') AS middle_name, last_name, \
                date_of_birth, gender::text AS gender, COALESCE(phone, '') AS phone, \
                COALESCE(address->>'line1', '') AS address_line, \
                COALESCE(address->>'city', '') AS city, COALESCE(address->>'state', '') AS state, \
                COALESCE(address->>'postal_code', '') AS postal_code \
           FROM patients WHERE id = $1 AND tenant_id = $2",
    )
    .bind(patient_id)
    .bind(tenant_id)
    .fetch_optional(pool)
    .await?
    else {
        return Ok(None);
    };
    let row = if let Some(admission) = ids.admission {
        sqlx::query_as::<_, VisitRow>(
            "SELECT COALESCE(e.encounter_number, a.id::text) AS visit_number, 'I' AS class, \
                    (SELECT COALESCE(w.code, w.name) FROM wards w WHERE w.id = a.ward_id) AS ward, \
                    (SELECT b.code FROM locations b WHERE b.id = a.bed_id) AS bed, \
                    u.id AS attending_id, u.full_name AS attending_name, \
                    a.admitted_at, a.discharged_at \
               FROM admissions a \
               LEFT JOIN encounters e ON e.id = a.encounter_id \
               LEFT JOIN users u ON u.id = COALESCE(a.attending_doctor_id, a.admitting_doctor) \
              WHERE a.id = $1 AND a.tenant_id = $2",
        )
        .bind(admission)
        .bind(tenant_id)
        .fetch_optional(pool)
        .await?
    } else if let Some(encounter) = ids.encounter {
        sqlx::query_as::<_, VisitRow>(
            "SELECT COALESCE(e.encounter_number, e.id::text) AS visit_number, \
                    CASE WHEN e.encounter_type = 'emergency' THEN 'E' ELSE 'O' END AS class, \
                    NULL::text AS ward, NULL::text AS bed, \
                    u.id AS attending_id, u.full_name AS attending_name, \
                    e.created_at AS admitted_at, NULL::timestamptz AS discharged_at \
               FROM encounters e LEFT JOIN users u ON u.id = e.doctor_id \
              WHERE e.id = $1 AND e.tenant_id = $2",
        )
        .bind(encounter)
        .bind(tenant_id)
        .fetch_optional(pool)
        .await?
    } else {
        None
    };
    let mut visit = row.map_or_else(
        || Visit {
            class: "N".to_owned(),
            ..Visit::default()
        },
        |r| Visit {
            class: r.class,
            visit_number: r.visit_number,
            location: (r.ward.is_some() || r.bed.is_some()).then(|| Location {
                ward: r.ward.unwrap_or_default(),
                bed: r.bed.unwrap_or_default(),
            }),
            prior_location: None,
            attending: r
                .attending_id
                .map(|id| (id.to_string(), r.attending_name.unwrap_or_default())),
            admitted_at: r.admitted_at,
            discharged_at: r.discharged_at,
        },
    );
    visit.prior_location = location(pool, tenant_id, (ids.prior_ward, ids.prior_bed)).await?;
    Ok(Some((
        Patient {
            uhid: p.uhid,
            first_name: p.first_name,
            middle_name: p.middle_name,
            last_name: p.last_name,
            date_of_birth: p.date_of_birth,
            gender: p.gender,
            address_line: p.address_line,
            city: p.city,
            state: p.state,
            postal_code: p.postal_code,
            phone: p.phone,
        },
        visit,
    )))
}
