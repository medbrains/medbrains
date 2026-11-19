//! Open consultation slots (online or at the hospital), from the doctors'
//! real weekly schedules, leave days, hospital holidays and bookings — with
//! each slot's fee — and how a slot looks on the wire.
//!
//! A fixed handful of queries for any window (schedules, bookings, leave,
//! holidays, fees), however many doctors and days: no query per doctor, per
//! day or per slot. Everything is bounded: the window to a week, schedule
//! rows and slots to fixed caps.

use std::collections::{HashMap, HashSet};

use chrono::{
    DateTime, Datelike, Duration, FixedOffset, NaiveDate, NaiveDateTime, NaiveTime, Offset, Utc,
};
use rust_decimal::Decimal;
use serde_json::{Value, json};
use uuid::Uuid;

use super::{
    fees::{self, Fee},
    protocol::{
        CONSULTATION_DESCRIPTOR, FULFILMENT_ONLINE, FULFILMENT_PHYSICAL, Service, TAG_SLOT_ID,
    },
    slot_ids,
};
use crate::{error::AppError, routes::appointments::PublicBookingRequest, tenant_config};

/// Schedules are kept in hospital (Indian) time.
const IST_SECONDS: i32 = 19_800;
/// The longest window one search may ask about.
pub const MAX_WINDOW_DAYS: i64 = 7;
/// The most slots one answer carries.
pub const MAX_SLOTS: usize = 100;
/// The most weekly schedule rows read for one answer.
const MAX_SCHEDULE_ROWS: i64 = 200;
/// UHI's timestamps carry no offset (every NHA example).
const TIMESTAMP: &str = "%Y-%m-%dT%H:%M:%S";
/// The tag naming a doctor's HPR ID — verified (NHA Postman).
const TAG_HPR_ID: &str = "@abdm/gov.in/hpr_id";
const TAG_SPECIALITY: &str = "@abdm/gov.in/speciality";

fn ist() -> FixedOffset {
    FixedOffset::east_opt(IST_SECONDS).unwrap_or_else(|| Utc.fix())
}

pub fn now_local() -> NaiveDateTime {
    Utc::now().with_timezone(&ist()).naive_local()
}

/// A UHI timestamp, with or without an offset, in hospital time.
pub fn parse_timestamp(value: &str) -> Option<NaiveDateTime> {
    DateTime::parse_from_rfc3339(value)
        .map(|d| d.with_timezone(&ist()).naive_local())
        .ok()
        .or_else(|| NaiveDateTime::parse_from_str(value, TIMESTAMP).ok())
}

pub fn timestamp(at: NaiveDateTime) -> String {
    at.format(TIMESTAMP).to_string()
}

/// What a search narrows to.
#[derive(Debug, Default)]
pub struct Filter {
    pub from: Option<NaiveDateTime>,
    pub to: Option<NaiveDateTime>,
    pub doctor_name: Option<String>,
    pub hpr_id: Option<String>,
    pub doctor_id: Option<Uuid>,
    /// A visit at the hospital rather than online.
    pub physical: bool,
    /// A speciality by name: a department's name or code, or the doctor's
    /// specialisation, matched whole and case-blind.
    pub speciality: Option<String>,
    /// A category ID from our own catalogue (a department).
    pub department_id: Option<Uuid>,
    /// The transaction asking: its own hold does not take the slot from it.
    pub holder: Option<Uuid>,
}

impl Filter {
    const fn service(&self) -> Service {
        if self.physical {
            Service::PhysicalConsultation
        } else {
            Service::Teleconsultation
        }
    }
}

/// One bookable slot.
#[derive(Debug, Clone)]
pub struct Slot {
    /// Its UUID in `uhi_slot_ids` — the fulfilment id and the
    /// `@abdm/gov.in/slot_id` tag. Nil until [`slot_ids::assign_ids`] names it.
    pub id: Uuid,
    pub doctor_id: Uuid,
    pub department_id: Uuid,
    pub department: String,
    pub doctor_name: String,
    pub hpr_id: String,
    pub date: NaiveDate,
    pub start: NaiveTime,
    pub end: NaiveTime,
    /// `None`: no fee is set; it is paid at the hospital.
    pub fee: Option<Fee>,
    pub physical: bool,
}

impl Slot {
    /// The booking page's request for this slot, in the patient's name and phone.
    pub fn booking_request(
        &self,
        (name, phone): (&str, &str),
        reason: &str,
    ) -> PublicBookingRequest {
        PublicBookingRequest {
            tenant_code: String::new(),
            doctor_id: self.doctor_id,
            department_id: self.department_id,
            appointment_date: self.date,
            slot_start: self.start,
            slot_end: self.end,
            patient_name: name.to_owned(),
            patient_phone: phone.to_owned(),
            patient_dob: None,
            reason: Some(reason.to_owned()),
            otp: None,
            campaign_code: None,
        }
    }

    /// The doctor as a search through the gateway lists them: one fulfilment
    /// per doctor, named by their HPR ID, spanning their first open slot.
    /// The app then asks this hospital directly for that doctor's slots.
    pub fn doctor_fulfillment(&self) -> Value {
        let mut f = self.fulfillment();
        f["id"] = json!(self.hpr_id);
        if let Some(map) = f.as_object_mut() {
            map.remove("tags");
        }
        f
    }

    /// The slot as a fulfilment: its UUID as the id and in the slot tag, the
    /// doctor as the agent, its start and end in hospital time.
    pub fn fulfillment(&self) -> Value {
        json!({
            "id": self.id,
            "type": if self.physical { FULFILMENT_PHYSICAL } else { FULFILMENT_ONLINE },
            "agent": {
                "id": self.hpr_id,
                "name": self.doctor_name,
                "tags": { TAG_HPR_ID: self.hpr_id, TAG_SPECIALITY: self.department },
            },
            "start": { "time": { "timestamp": timestamp(self.date.and_time(self.start)) } },
            "end": { "time": { "timestamp": timestamp(self.date.and_time(self.end)) } },
            "tags": { TAG_SLOT_ID: self.id },
        })
    }

    /// The consultation as an item, priced, pointing at its fulfilment.
    pub fn item(&self) -> Value {
        json!({
            "id": self.id,
            "descriptor": { "name": CONSULTATION_DESCRIPTOR, "code": CONSULTATION_DESCRIPTOR },
            "price": fees::item_price(self.fee.as_ref()),
            "fulfillment_id": self.id,
            "category_id": self.department_id,
        })
    }
}

/// The first open slot of each doctor, in the order given — what a search
/// through the gateway answers with.
pub fn first_per_doctor(open: &[Slot]) -> Vec<&Slot> {
    let mut seen = HashSet::new();
    open.iter().filter(|s| seen.insert(s.doctor_id)).collect()
}

#[derive(Debug, sqlx::FromRow)]
struct ScheduleRow {
    doctor_id: Uuid,
    department_id: Uuid,
    department: String,
    department_code: String,
    consultation_fee: Option<Decimal>,
    day_of_week: i32,
    start_time: NaiveTime,
    end_time: NaiveTime,
    slot_duration_mins: i32,
    max_patients: i32,
    doctor_name: String,
    hpr_id: String,
}

/// Open slots matching `filter`, earliest first. Only doctors with an HPR
/// ID are offered: UHI names a doctor by it.
#[tracing::instrument(skip_all, fields(tenant_id = %tenant_id))]
pub async fn open_slots(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    filter: &Filter,
) -> Result<Vec<Slot>, AppError> {
    let now = now_local();
    let from = filter.from.unwrap_or(now).max(now);
    let to = filter
        .to
        .unwrap_or(from + Duration::days(MAX_WINDOW_DAYS))
        .min(from + Duration::days(MAX_WINDOW_DAYS));
    if to <= from {
        return Ok(Vec::new());
    }
    let schedules = sqlx::query_as::<_, ScheduleRow>(
        "SELECT ds.doctor_id, ds.department_id, d.name AS department, \
                d.code AS department_code, u.consultation_fee, ds.day_of_week, \
                ds.start_time, ds.end_time, ds.slot_duration_mins, ds.max_patients, \
                COALESCE(NULLIF(dp.display_name, ''), u.full_name) AS doctor_name, dp.hpr_id \
           FROM doctor_schedules ds \
           JOIN users u ON u.id = ds.doctor_id AND u.is_active \
           JOIN doctor_profiles dp ON dp.user_id = ds.doctor_id AND dp.tenant_id = ds.tenant_id \
                AND dp.is_active AND dp.deleted_at IS NULL AND dp.hpr_id IS NOT NULL \
           JOIN departments d ON d.id = ds.department_id \
          WHERE ds.tenant_id = $1 AND ds.is_active AND ds.deleted_at IS NULL \
            AND ds.slot_duration_mins > 0 \
            AND ($2::text IS NULL OR COALESCE(dp.display_name, u.full_name) ILIKE '%' || $2 || '%') \
            AND ($3::text IS NULL OR dp.hpr_id = $3) \
            AND ($4::uuid IS NULL OR ds.doctor_id = $4) \
            AND ($6::text IS NULL OR lower(d.name) = lower($6) OR lower(d.code) = lower($6) \
                 OR lower(u.specialization) = lower($6)) \
            AND ($7::uuid IS NULL OR ds.department_id = $7) \
          ORDER BY ds.doctor_id, ds.day_of_week, ds.start_time \
          LIMIT $5",
    )
    .bind(tenant_id)
    .bind(filter.doctor_name.as_deref())
    .bind(filter.hpr_id.as_deref())
    .bind(filter.doctor_id)
    .bind(MAX_SCHEDULE_ROWS)
    .bind(filter.speciality.as_deref())
    .bind(filter.department_id)
    .fetch_all(&mut **tx)
    .await?;
    if schedules.is_empty() {
        return Ok(Vec::new());
    }
    let doctors: Vec<Uuid> = schedules
        .iter()
        .map(|s| s.doctor_id)
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();
    let (first, last) = (from.date(), to.date());
    let booked: HashMap<(Uuid, NaiveDate, NaiveTime), i64> =
        sqlx::query_as::<_, (Uuid, NaiveDate, NaiveTime, i64)>(
            "SELECT doctor_id, appointment_date, slot_start, count(*) FROM appointments \
              WHERE tenant_id = $1 AND doctor_id = ANY($2) \
                AND appointment_date BETWEEN $3 AND $4 \
                AND status NOT IN ('cancelled', 'no_show') AND deleted_at IS NULL \
              GROUP BY 1, 2, 3",
        )
        .bind(tenant_id)
        .bind(&doctors)
        .bind(first)
        .bind(last)
        .fetch_all(&mut **tx)
        .await?
        .into_iter()
        .map(|(d, date, start, n)| ((d, date, start), n))
        .collect();
    // A doctor's own exception wins: away on leave, or in on a holiday.
    let exceptions: HashMap<(Uuid, NaiveDate), bool> =
        sqlx::query_as::<_, (Uuid, NaiveDate, bool)>(
            "SELECT doctor_id, exception_date, is_available FROM doctor_schedule_exceptions \
              WHERE tenant_id = $1 AND doctor_id = ANY($2) \
                AND exception_date BETWEEN $3 AND $4 AND deleted_at IS NULL",
        )
        .bind(tenant_id)
        .bind(&doctors)
        .bind(first)
        .bind(last)
        .fetch_all(&mut **tx)
        .await?
        .into_iter()
        .map(|(d, date, available)| ((d, date), available))
        .collect();
    let holds = slot_ids::held(tx, tenant_id, &doctors, (first, last), filter.holder).await?;
    let holidays = tenant_config::holidays_between(tx, &tenant_id, first, last).await?;
    let service = filter.service();
    let codes: Vec<String> = schedules
        .iter()
        .filter(|s| s.consultation_fee.is_none_or(|f| f <= Decimal::ZERO))
        .map(|s| fees::charge_code(service, &s.department_code))
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();
    let rates = fees::charge_rates(tx, tenant_id, &codes).await?;

    let mut slots = Vec::new();
    for date in first.iter_days().take_while(|d| *d <= last) {
        let weekday = date.weekday().num_days_from_sunday() as i32;
        for s in schedules.iter().filter(|s| s.day_of_week == weekday) {
            let working = exceptions
                .get(&(s.doctor_id, date))
                .copied()
                .unwrap_or(!holidays.contains(&date));
            if !working {
                continue;
            }
            let fee = fees::pick(
                s.consultation_fee,
                rates.get(&fees::charge_code(service, &s.department_code)),
            );
            let step = Duration::minutes(i64::from(s.slot_duration_mins));
            let mut start = s.start_time;
            while start + step <= s.end_time && start + step > start {
                let at = date.and_time(start);
                let taken = slot_ids::taken_at([&booked, &holds], (s.doctor_id, date, start));
                if at >= from && at < to && taken < i64::from(s.max_patients) {
                    slots.push(Slot {
                        id: Uuid::nil(),
                        doctor_id: s.doctor_id,
                        department_id: s.department_id,
                        department: s.department.clone(),
                        doctor_name: s.doctor_name.clone(),
                        hpr_id: s.hpr_id.clone(),
                        date,
                        start,
                        end: start + step,
                        fee,
                        physical: filter.physical,
                    });
                }
                start += step;
            }
        }
    }
    slots.sort_by_key(|s| (s.date, s.start, s.doctor_id));
    slots.truncate(MAX_SLOTS);
    Ok(slots)
}

/// The open slot the UUID `id` names, if it is still open to `holder` (its
/// own hold does not count against it).
///
/// # Errors
/// A database fault.
#[tracing::instrument(skip_all, fields(tenant_id = %tenant_id))]
pub async fn find_slot(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    id: &str,
    physical: bool,
    holder: Uuid,
) -> Result<Option<Slot>, AppError> {
    let Ok(id) = Uuid::parse_str(id) else {
        return Ok(None);
    };
    // allow-raw-sql: compile-checked, on the caller's tenant-scoped (RLS) transaction
    let Some(named) = sqlx::query!(
        "SELECT doctor_id, slot_date, slot_start FROM uhi_slot_ids \
          WHERE tenant_id = $1 AND id = $2",
        tenant_id,
        id,
    )
    .fetch_optional(&mut **tx)
    .await?
    else {
        return Ok(None);
    };
    let at = named.slot_date.and_time(named.slot_start);
    let filter = Filter {
        from: Some(at),
        to: Some(at + Duration::minutes(1)),
        doctor_id: Some(named.doctor_id),
        physical,
        holder: Some(holder),
        ..Filter::default()
    };
    let slot = open_slots(tx, tenant_id, &filter)
        .await?
        .into_iter()
        .find(|s| s.date == named.slot_date && s.start == named.slot_start);
    Ok(slot.map(|s| Slot { id, ..s }))
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::{Slot, first_per_doctor, parse_timestamp, timestamp};
    use chrono::{NaiveDate, NaiveTime};
    use uuid::Uuid;

    fn slot(doctor: Uuid, hour: u32) -> Slot {
        Slot {
            id: Uuid::new_v4(),
            doctor_id: doctor,
            department_id: Uuid::nil(),
            department: "Cardiology".to_owned(),
            doctor_name: "Dr A".to_owned(),
            hpr_id: "a@hpr.abdm".to_owned(),
            date: NaiveDate::from_ymd_opt(2026, 11, 20).unwrap(),
            start: NaiveTime::from_hms_opt(hour, 0, 0).unwrap(),
            end: NaiveTime::from_hms_opt(hour, 30, 0).unwrap(),
            fee: None,
            physical: true,
        }
    }

    #[test]
    fn a_slot_is_named_by_its_uuid_in_the_id_and_the_slot_tag() {
        let s = slot(Uuid::new_v4(), 9);
        let f = s.fulfillment();
        assert_eq!(f["id"], s.id.to_string());
        assert_eq!(f["tags"]["@abdm/gov.in/slot_id"], s.id.to_string());
        assert_eq!(f["type"], "Physical");
        let item = s.item();
        assert_eq!(item["descriptor"]["code"], "Consultation");
        assert_eq!(item["descriptor"]["name"], "Consultation");
        assert_eq!(item["fulfillment_id"], s.id.to_string());
    }

    #[test]
    fn the_gateway_answer_lists_each_doctor_once_without_slot_ids() {
        let (a, b) = (Uuid::new_v4(), Uuid::new_v4());
        let open = [slot(a, 9), slot(b, 9), slot(a, 10)];
        let doctors = first_per_doctor(&open);
        assert_eq!(doctors.len(), 2);
        let f = doctors[0].doctor_fulfillment();
        assert_eq!(f["id"], "a@hpr.abdm");
        assert!(
            f.get("tags").is_none(),
            "no slot is named before the direct search"
        );
    }

    #[test]
    fn timestamps_read_with_or_without_an_offset() {
        let naive = parse_timestamp("2026-10-20T09:00:00").unwrap();
        assert_eq!(timestamp(naive), "2026-10-20T09:00:00");
        let utc = parse_timestamp("2026-10-20T03:30:00Z").unwrap();
        assert_eq!(utc, naive, "UTC is shown in hospital time");
        assert!(parse_timestamp("tomorrow").is_none());
    }
}
