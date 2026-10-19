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
    protocol::{FULFILMENT_ONLINE, FULFILMENT_PHYSICAL, Service},
};
use crate::{error::AppError, tenant_config};

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
    /// `{doctor}|{date}|{HH:MM}` — the fulfilment and item ID the patient app
    /// echoes back on select, init and confirm.
    pub fn id(&self) -> String {
        format!(
            "{}|{}|{}",
            self.doctor_id,
            self.date,
            self.start.format("%H:%M")
        )
    }

    pub fn fulfillment(&self) -> Value {
        json!({
            "id": self.id(),
            "type": if self.physical { FULFILMENT_PHYSICAL } else { FULFILMENT_ONLINE },
            "agent": {
                "id": self.hpr_id,
                "name": self.doctor_name,
                "tags": { TAG_HPR_ID: self.hpr_id, TAG_SPECIALITY: self.department },
            },
            "start": { "time": { "timestamp": timestamp(self.date.and_time(self.start)) } },
            "end": { "time": { "timestamp": timestamp(self.date.and_time(self.end)) } },
        })
    }

    pub fn item(&self) -> Value {
        json!({
            "id": self.id(),
            "descriptor": { "name": "Consultation", "code": "CONSULTATION" },
            "price": fees::item_price(self.fee.as_ref()),
            "fulfillment_id": self.id(),
            "category_id": self.department_id,
        })
    }
}

/// `(doctor, date, start)` of a slot ID.
pub fn parse_slot_id(id: &str) -> Option<(Uuid, NaiveDate, NaiveTime)> {
    let mut parts = id.split('|');
    let doctor = Uuid::parse_str(parts.next()?).ok()?;
    let date = NaiveDate::parse_from_str(parts.next()?, "%Y-%m-%d").ok()?;
    let start = NaiveTime::parse_from_str(parts.next()?, "%H:%M").ok()?;
    parts.next().is_none().then_some((doctor, date, start))
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
                let taken = booked
                    .get(&(s.doctor_id, date, start))
                    .copied()
                    .unwrap_or(0);
                if at >= from && at < to && taken < i64::from(s.max_patients) {
                    slots.push(Slot {
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

/// The open slot `id` names, if it is still open.
pub async fn find_slot(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    id: &str,
    physical: bool,
) -> Result<Option<Slot>, AppError> {
    let Some((doctor_id, date, start)) = parse_slot_id(id) else {
        return Ok(None);
    };
    let at = date.and_time(start);
    let filter = Filter {
        from: Some(at),
        to: Some(at + Duration::minutes(1)),
        doctor_id: Some(doctor_id),
        physical,
        ..Filter::default()
    };
    Ok(open_slots(tx, tenant_id, &filter)
        .await?
        .into_iter()
        .find(|s| s.date == date && s.start == start))
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::{parse_slot_id, parse_timestamp, timestamp};

    #[test]
    fn slot_ids_round_trip_and_junk_is_refused() {
        let id = "6f1c1a52-8a52-4c42-9c76-3a0d3f6f0b11|2026-10-20|09:30";
        let (_, date, start) = parse_slot_id(id).unwrap();
        assert_eq!(date.to_string(), "2026-10-20");
        assert_eq!(start.format("%H:%M").to_string(), "09:30");
        assert!(parse_slot_id("x|2026-10-20|09:30").is_none());
        assert!(parse_slot_id(&format!("{id}|extra")).is_none());
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
