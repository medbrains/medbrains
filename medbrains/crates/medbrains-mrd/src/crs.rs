//! Civil registration of births and deaths (CRS), migration 1315.
//!
//! Under the RBD (Amendment) Act 2023 the hospital in-charge is the
//! informant for every birth and death in the hospital, and reports it on
//! the Centre's CRS portal within 21 days. `crs_events` holds one row per
//! event, opened by trigger from the labour room, the birth register, the
//! death summary (MCCD) and the death register. This module lists them by
//! due date, lays each out as the registrar's report (Form 1 for a birth,
//! Form 2 for a death) from what the hospital already recorded, and keeps the
//! registration number the portal gives back.
//!
//! The report is a disclosure to the registrar, recorded in the audit chain
//! both when it is prepared and when it is registered.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{NaiveDate, NaiveTime};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_platform::disclosure::{self, Disclosure, form_date};
use medbrains_server_core::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
};

const RECIPIENT: &str = "CRS (Registrar of Births and Deaths)";
const STATUTE: &str = "Registration of Births and Deaths Act 1969, s.8, as amended 2023";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CrsEvent {
    pub id: Uuid,
    pub event_type: String,
    pub patient_id: Uuid,
    pub uhid: Option<String>,
    /// The mother, for a birth; the deceased, for a death.
    pub patient_name: Option<String>,
    pub event_date: NaiveDate,
    pub baby_sex: Option<String>,
    pub due_on: NaiveDate,
    pub status: String,
    pub crs_registration_number: Option<String>,
    pub registered_on: Option<NaiveDate>,
    pub from_maternity: bool,
    pub in_birth_register: bool,
    /// `form_4` or `form_4a`, when a death summary certified the cause.
    pub mccd_form: Option<String>,
    pub in_death_register: bool,
}

const EVENT_SQL: &str = "\
    SELECT e.id, e.event_type, e.patient_id, p.uhid, \
           NULLIF(concat_ws(' ', p.first_name, p.middle_name, p.last_name), '') AS patient_name, \
           e.event_date, e.baby_sex, e.due_on, e.status, e.crs_registration_number, \
           e.registered_on, e.newborn_id IS NOT NULL AS from_maternity, \
           e.birth_register_id IS NOT NULL AS in_birth_register, \
           ds.form_type::text AS mccd_form, e.death_register_id IS NOT NULL AS in_death_register \
      FROM crs_events e \
      JOIN patients p ON p.id = e.patient_id \
      LEFT JOIN ipd_death_summaries ds ON ds.id = e.death_summary_id \
     WHERE e.tenant_id = $1 AND e.deleted_at IS NULL";

#[derive(Debug, Deserialize)]
pub struct CrsQuery {
    /// `pending`, `overdue` or `registered`; everything when absent.
    pub status: Option<String>,
}

/// GET /api/mrd/crs — births and deaths owed to the registrar, soonest due first.
pub async fn list_events(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<CrsQuery>,
) -> Result<Json<Vec<CrsEvent>>, AppError> {
    require_permission(&claims, permissions::mrd::crs::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let sql = format!(
        "{EVENT_SQL} AND CASE $2::text \
             WHEN 'pending' THEN e.status = 'pending' \
             WHEN 'overdue' THEN e.status = 'pending' \
                  AND e.due_on < (now() AT TIME ZONE 'Asia/Kolkata')::date \
             WHEN 'registered' THEN e.status = 'registered' \
             ELSE true END \
         ORDER BY e.status, e.due_on LIMIT 500"
    );
    let rows = sqlx::query_as::<_, CrsEvent>(&sql)
        .bind(claims.tenant_id)
        .bind(q.status.as_deref())
        .fetch_all(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// One line of the registrar's report; `None` is filled on the portal.
#[derive(Debug, Serialize)]
pub struct FormField {
    pub label: &'static str,
    pub value: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CrsForm {
    pub event_id: Uuid,
    pub form: &'static str,
    pub due_on: NaiveDate,
    pub fields: Vec<FormField>,
}

#[derive(Debug, sqlx::FromRow)]
struct Place {
    name: String,
    address: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct BirthFacts {
    event_date: NaiveDate,
    due_on: NaiveDate,
    baby_sex: Option<String>,
    birth_time: Option<NaiveTime>,
    weight_g: Option<i32>,
    delivery_type: Option<String>,
    father_name: Option<String>,
    mother_name: Option<String>,
    mother_age: Option<i32>,
    address: Option<String>,
    pin: Option<String>,
    gestation_weeks: Option<i32>,
    religion: Option<String>,
    mother_education: Option<String>,
    mother_occupation: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct DeathFacts {
    event_date: NaiveDate,
    due_on: NaiveDate,
    death_time: Option<NaiveTime>,
    deceased_name: Option<String>,
    gender: Option<String>,
    age: Option<i32>,
    guardian: Option<String>,
    mother_name: Option<String>,
    address: Option<String>,
    pin: Option<String>,
    religion: Option<String>,
    occupation: Option<String>,
    mccd_form: Option<String>,
    cause: Option<String>,
}

const BIRTH_SQL: &str = concat!(
    "SELECT e.event_date, e.due_on, e.baby_sex, \
            COALESCE(nb.time_of_birth, (nb.birth_date AT TIME ZONE 'Asia/Kolkata')::time, \
                     br.birth_time) AS birth_time, \
            COALESCE(nb.birth_weight_grams, nb.weight_gm, br.baby_weight_grams) AS weight_g, \
            lr.delivery_type::text AS delivery_type, \
            COALESCE(br.father_name, p.spouse_name) AS father_name, \
            NULLIF(concat_ws(' ', p.first_name, p.middle_name, p.last_name), '') AS mother_name, \
            COALESCE(br.mother_age, date_part('year', age(e.event_date, p.date_of_birth))::int) \
              AS mother_age, ",
    medbrains_platform::patient_address_sql!(),
    ", ((e.event_date - mr.lmp_date) / 7)::int AS gestation_weeks, p.religion, \
            p.education_level AS mother_education, p.occupation AS mother_occupation \
       FROM crs_events e \
       JOIN patients p ON p.id = e.patient_id \
       LEFT JOIN newborn_records nb ON nb.id = e.newborn_id \
       LEFT JOIN mrd_birth_register br ON br.id = e.birth_register_id \
       LEFT JOIN labor_records lr ON lr.id = nb.labor_id \
       LEFT JOIN maternity_registrations mr ON mr.id = lr.registration_id ",
    medbrains_platform::patient_address_join!(),
    " WHERE e.id = $1 AND e.tenant_id = $2 AND e.event_type = 'birth'"
);

const DEATH_SQL: &str = concat!(
    "SELECT e.event_date, e.due_on, COALESCE(ds.time_of_death, dr.death_time) AS death_time, \
            NULLIF(concat_ws(' ', p.first_name, p.middle_name, p.last_name), '') AS deceased_name, \
            p.gender::text AS gender, \
            date_part('year', age(e.event_date, p.date_of_birth))::int AS age, \
            COALESCE(p.father_name, p.spouse_name) AS guardian, p.mother_name, ",
    medbrains_platform::patient_address_sql!(),
    ", p.religion, p.occupation, ds.form_type::text AS mccd_form, \
            COALESCE(ds.cause_of_death_underlying, ds.cause_of_death_primary, \
                     dr.underlying_cause, dr.cause_of_death, dr.immediate_cause) AS cause \
       FROM crs_events e \
       JOIN patients p ON p.id = e.patient_id \
       LEFT JOIN ipd_death_summaries ds ON ds.id = e.death_summary_id \
       LEFT JOIN mrd_death_register dr ON dr.id = e.death_register_id ",
    medbrains_platform::patient_address_join!(),
    " WHERE e.id = $1 AND e.tenant_id = $2 AND e.event_type = 'death'"
);

fn field(label: &'static str, value: Option<String>) -> FormField {
    FormField {
        label,
        value: value.filter(|v| !v.trim().is_empty()),
    }
}

fn delivery_method(delivery_type: Option<&str>) -> Option<String> {
    let method = match delivery_type? {
        "normal_vaginal" | "breech" => "Natural",
        "assisted_vaginal" => "Forceps / vacuum",
        "lscs_elective" | "lscs_emergency" => "Caesarean",
        _ => return None,
    };
    Some(method.to_owned())
}

fn clock(t: NaiveTime) -> String {
    t.format("%H:%M").to_string()
}

fn place(p: &Place) -> String {
    p.address
        .as_ref()
        .map_or_else(|| p.name.clone(), |a| format!("{}, {a}", p.name))
}

/// Form 1 (birth report): the legal part, then the statistical part.
fn birth_form(b: &BirthFacts, hospital: &Place) -> Vec<FormField> {
    vec![
        field("Date of birth", Some(form_date(Some(b.event_date)))),
        field("Time of birth", b.birth_time.map(clock)),
        field("Sex", b.baby_sex.clone()),
        field("Name of the child (if named)", None),
        field("Name of the father", b.father_name.clone()),
        field("Name of the mother", b.mother_name.clone()),
        field(
            "Address of the parents at the time of birth",
            b.address.clone(),
        ),
        field("PIN", b.pin.clone()),
        field(
            "Place of birth",
            Some(format!("Hospital: {}", place(hospital))),
        ),
        field(
            "Informant",
            Some(format!("Medical officer in charge, {}", hospital.name)),
        ),
        field("Religion of the family", b.religion.clone()),
        field("Mother's level of education", b.mother_education.clone()),
        field("Mother's occupation", b.mother_occupation.clone()),
        field("Father's level of education", None),
        field("Father's occupation", None),
        field("Age of the mother at marriage", None),
        field(
            "Age of the mother at delivery",
            b.mother_age.map(|a| a.to_string()),
        ),
        field(
            "Children born alive to the mother, including this one",
            None,
        ),
        field(
            "Type of attention at delivery",
            Some("Institutional".to_owned()),
        ),
        field(
            "Method of delivery",
            delivery_method(b.delivery_type.as_deref()),
        ),
        field(
            "Birth weight (kg)",
            b.weight_g.map(|g| format!("{:.2}", f64::from(g) / 1000.0)),
        ),
        field(
            "Duration of pregnancy (weeks)",
            b.gestation_weeks.map(|w| w.to_string()),
        ),
    ]
}

/// Form 2 (death report): the legal part, then the statistical part.
fn death_form(d: &DeathFacts, hospital: &Place) -> Vec<FormField> {
    let certified = d.mccd_form.as_deref().map(|f| {
        if f == "form_4a" {
            "Yes (MCCD Form 4A)".to_owned()
        } else {
            "Yes (MCCD Form 4)".to_owned()
        }
    });
    vec![
        field("Date of death", Some(form_date(Some(d.event_date)))),
        field("Time of death", d.death_time.map(clock)),
        field("Name of the deceased", d.deceased_name.clone()),
        field("Sex", d.gender.clone()),
        field("Age", d.age.map(|a| a.to_string())),
        field("Name of the father / husband", d.guardian.clone()),
        field("Name of the mother", d.mother_name.clone()),
        field(
            "Address of the deceased at the time of death",
            d.address.clone(),
        ),
        field("PIN", d.pin.clone()),
        field(
            "Place of death",
            Some(format!("Hospital: {}", place(hospital))),
        ),
        field(
            "Informant",
            Some(format!("Medical officer in charge, {}", hospital.name)),
        ),
        field("Religion", d.religion.clone()),
        field("Occupation", d.occupation.clone()),
        field(
            "Type of medical attention before death",
            Some("Institutional".to_owned()),
        ),
        field("Was the cause of death medically certified?", certified),
        field("Name of disease or actual cause of death", d.cause.clone()),
        field(
            "If a woman, did the death occur during pregnancy, at delivery or within 6 weeks?",
            None,
        ),
    ]
}

/// GET /api/mrd/crs/{id}/form — the registrar's report for one event.
pub async fn event_form(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<CrsForm>, AppError> {
    require_permission(&claims, permissions::mrd::crs::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let hospital = sqlx::query_as::<_, Place>(
        "SELECT name, NULLIF(concat_ws(', ', address_line1, address_line2, city, pincode), '') \
                AS address FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    let birth = sqlx::query_as::<_, BirthFacts>(BIRTH_SQL)
        .bind(id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?;
    let form = if let Some(b) = birth {
        CrsForm {
            event_id: id,
            form: "Form 1 — Birth report",
            due_on: b.due_on,
            fields: birth_form(&b, &hospital),
        }
    } else {
        let d = sqlx::query_as::<_, DeathFacts>(DEATH_SQL)
            .bind(id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(AppError::NotFound)?;
        CrsForm {
            event_id: id,
            form: "Form 2 — Death report",
            due_on: d.due_on,
            fields: death_form(&d, &hospital),
        }
    };
    disclosure::record(
        &mut tx,
        &claims,
        &Disclosure {
            stage: "prepared",
            recipient: RECIPIENT,
            statute: STATUTE,
            entity_type: "crs_events",
            record_ids: &[id],
            reference: None,
        },
    )
    .await?;
    tx.commit().await?;
    Ok(Json(form))
}

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub crs_registration_number: String,
    pub registered_on: NaiveDate,
}

/// PUT /api/mrd/crs/{id} — the registration number CRS gave the event.
pub async fn record_registration(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<RegisterRequest>,
) -> Result<Json<CrsEvent>, AppError> {
    require_permission(&claims, permissions::mrd::crs::MANAGE)?;
    let number = body.crs_registration_number.trim();
    if number.is_empty() {
        return Err(AppError::BadRequest(
            "Give the registration number CRS issued.".to_owned(),
        ));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (event_date, today): (NaiveDate, NaiveDate) = sqlx::query_as(
        "SELECT event_date, (now() AT TIME ZONE 'Asia/Kolkata')::date FROM crs_events \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    if body.registered_on < event_date || body.registered_on > today {
        return Err(AppError::BadRequest(
            "The registration date must fall between the event and today.".to_owned(),
        ));
    }
    sqlx::query(
        "UPDATE crs_events SET status = 'registered', crs_registration_number = $3, \
                registered_on = $4, recorded_by = $5, recorded_at = now() \
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(number)
    .bind(body.registered_on)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    // The death register's own "reported to the municipality" says the same.
    sqlx::query(
        "UPDATE mrd_death_register d SET reported_to_municipality = true, \
                municipality_report_date = $3 \
           FROM crs_events e \
          WHERE e.id = $1 AND e.tenant_id = $2 AND d.id = e.death_register_id",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.registered_on)
    .execute(&mut *tx)
    .await?;
    disclosure::record(
        &mut tx,
        &claims,
        &Disclosure {
            stage: "submitted",
            recipient: RECIPIENT,
            statute: STATUTE,
            entity_type: "crs_events",
            record_ids: &[id],
            reference: Some(number),
        },
    )
    .await?;
    let row = sqlx::query_as::<_, CrsEvent>(&format!("{EVENT_SQL} AND e.id = $2"))
        .bind(claims.tenant_id)
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[cfg(test)]
mod tests {
    use super::{BirthFacts, Place, birth_form, delivery_method};
    use chrono::NaiveDate;

    #[test]
    fn the_method_of_delivery_is_named_as_the_form_names_it() {
        assert_eq!(
            delivery_method(Some("lscs_emergency")).as_deref(),
            Some("Caesarean")
        );
        assert_eq!(
            delivery_method(Some("assisted_vaginal")).as_deref(),
            Some("Forceps / vacuum")
        );
        assert_eq!(delivery_method(None), None);
    }

    #[test]
    fn a_birth_report_fills_what_the_hospital_knows_and_leaves_the_rest() {
        let b = BirthFacts {
            event_date: NaiveDate::from_ymd_opt(2026, 10, 20).unwrap_or_default(),
            due_on: NaiveDate::from_ymd_opt(2026, 11, 10).unwrap_or_default(),
            baby_sex: Some("female".to_owned()),
            birth_time: None,
            weight_g: Some(2950),
            delivery_type: Some("normal_vaginal".to_owned()),
            father_name: None,
            mother_name: Some("Asha Rao".to_owned()),
            mother_age: Some(27),
            address: None,
            pin: None,
            gestation_weeks: Some(39),
            religion: None,
            mother_education: None,
            mother_occupation: None,
        };
        let hospital = Place {
            name: "City Hospital".to_owned(),
            address: None,
        };
        let form = birth_form(&b, &hospital);
        let value = |label: &str| {
            form.iter()
                .find(|f| f.label == label)
                .and_then(|f| f.value.clone())
        };
        assert_eq!(value("Date of birth").as_deref(), Some("20/10/2026"));
        assert_eq!(value("Birth weight (kg)").as_deref(), Some("2.95"));
        assert_eq!(
            value("Place of birth").as_deref(),
            Some("Hospital: City Hospital")
        );
        assert_eq!(value("Name of the father"), None);
    }
}
