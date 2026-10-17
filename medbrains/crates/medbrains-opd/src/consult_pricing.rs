//! What an OPD consultation costs (#296), decided by the system rather than
//! the clerk's memory: a repeat visit inside the hospital's free-revisit
//! window costs nothing; otherwise the doctor's own consultation fee applies
//! when one is set, and the charge master's department rate when not.

use chrono::NaiveDate;
use rust_decimal::Decimal;
use serde_json::Value;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use medbrains_server_core::error::AppError;

/// The hospital's free-revisit rule: within `days` of a paid consultation, a
/// repeat consultation is free — with the same doctor, or anyone in the same
/// department when `same_doctor` is off. `days == 0` switches it off.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RevisitPolicy {
    pub days: i64,
    pub same_doctor: bool,
}

/// Reads `billing.opd_revisit` = `{ "days": 7, "same_doctor": true }`.
#[must_use]
pub fn policy_from(value: Option<&Value>) -> RevisitPolicy {
    let days = value
        .and_then(|v| v.get("days"))
        .and_then(Value::as_i64)
        .unwrap_or(0)
        .clamp(0, 90);
    let same_doctor = value
        .and_then(|v| v.get("same_doctor"))
        .and_then(Value::as_bool)
        .unwrap_or(true);
    RevisitPolicy { days, same_doctor }
}

/// The day of the free window this visit falls on, counted from the paid
/// visit; `None` when the window is off or has passed.
#[must_use]
pub fn revisit_day(paid_on: NaiveDate, today: NaiveDate, policy: RevisitPolicy) -> Option<i64> {
    let day = (today - paid_on).num_days();
    (policy.days > 0 && (0..=policy.days).contains(&day)).then_some(day)
}

/// The price and line text for a consultation; `None` price means the
/// charge master decides.
#[derive(Debug, PartialEq, Eq)]
pub struct ConsultPrice {
    pub price: Option<Decimal>,
    pub description: String,
}

#[must_use]
pub fn price(revisit: Option<(i64, i64)>, doctor: Option<(&str, Decimal)>) -> ConsultPrice {
    if let Some((day, of)) = revisit {
        return ConsultPrice {
            price: Some(Decimal::ZERO),
            description: format!("Free revisit (day {day} of {of}) — OPD consultation"),
        };
    }
    match doctor {
        Some((name, fee)) => {
            // Many staff records already carry the title.
            let titled = name.get(..2).is_some_and(|t| t.eq_ignore_ascii_case("dr"));
            ConsultPrice {
                price: Some(fee),
                description: if titled {
                    format!("OPD consultation — {name}")
                } else {
                    format!("OPD consultation — Dr {name}")
                },
            }
        }
        None => ConsultPrice {
            price: None,
            description: "OPD Consultation".to_owned(),
        },
    }
}

/// The consultation's price for this patient, doctor and department today.
pub async fn consult_price(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
    doctor_id: Option<Uuid>,
    department_id: Uuid,
) -> Result<ConsultPrice, AppError> {
    let setting: Option<Value> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings \
          WHERE tenant_id = $1 AND category = 'billing' AND key = 'opd_revisit' \
            AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    let policy = policy_from(setting.as_ref());
    let mut revisit = None;
    if policy.days > 0 {
        // The latest paid, unreversed consultation for this patient — with
        // this doctor, or in this department.
        let paid_on: Option<NaiveDate> = sqlx::query_scalar(
            "SELECT max(ii.created_at)::date FROM invoice_items ii \
               JOIN opd_queues q ON q.id = ii.source_id AND q.tenant_id = ii.tenant_id \
               JOIN encounters e ON e.id = q.encounter_id AND e.tenant_id = q.tenant_id \
              WHERE ii.tenant_id = $1 AND ii.source::text = 'opd' AND ii.total_price > 0 \
                AND ii.deleted_at IS NULL AND NOT ii.is_reversal \
                AND NOT EXISTS (SELECT 1 FROM invoice_items r \
                     WHERE r.tenant_id = ii.tenant_id AND r.reversal_of_id = ii.id) \
                AND e.patient_id = $2 \
                AND ii.created_at >= now() - make_interval(days => $3::int) - interval '1 day' \
                AND CASE WHEN $4 THEN q.doctor_id = $5 ELSE q.department_id = $6 END",
        )
        .bind(tenant_id)
        .bind(patient_id)
        .bind(i32::try_from(policy.days).unwrap_or(90))
        .bind(policy.same_doctor)
        .bind(doctor_id)
        .bind(department_id)
        .fetch_one(&mut **tx)
        .await?;
        let today = chrono::Utc::now().date_naive();
        revisit = paid_on
            .and_then(|d| revisit_day(d, today, policy))
            .map(|day| (day, policy.days));
    }
    let doctor: Option<(String, Option<Decimal>)> =
        match doctor_id {
            Some(id) => sqlx::query_as(
                "SELECT full_name, consultation_fee FROM users WHERE id = $1 AND tenant_id = $2",
            )
            .bind(id)
            .bind(tenant_id)
            .fetch_optional(&mut **tx)
            .await?,
            None => None,
        };
    let fee = doctor.as_ref().and_then(|(name, fee)| {
        fee.filter(|f| *f > Decimal::ZERO)
            .map(|f| (name.as_str(), f))
    });
    Ok(price(revisit, fee))
}

#[cfg(test)]
mod tests {
    use chrono::NaiveDate;
    use rust_decimal::Decimal;
    use serde_json::json;

    use super::{RevisitPolicy, policy_from, price, revisit_day};

    fn d(day: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(2026, 10, day).unwrap_or_default()
    }

    #[test]
    fn the_window_is_off_unless_the_hospital_sets_it() {
        assert_eq!(
            policy_from(None),
            RevisitPolicy {
                days: 0,
                same_doctor: true
            }
        );
        assert_eq!(revisit_day(d(1), d(2), policy_from(None)), None);
        let p = policy_from(Some(&json!({ "days": 7, "same_doctor": false })));
        assert_eq!(
            p,
            RevisitPolicy {
                days: 7,
                same_doctor: false
            }
        );
    }

    #[test]
    fn a_visit_inside_the_window_is_free_and_says_which_day() {
        let p = RevisitPolicy {
            days: 7,
            same_doctor: true,
        };
        assert_eq!(revisit_day(d(1), d(4), p), Some(3));
        assert_eq!(revisit_day(d(1), d(8), p), Some(7));
        assert_eq!(
            revisit_day(d(1), d(9), p),
            None,
            "day 8 of a 7-day window is paid"
        );
        let free = price(Some((3, 7)), Some(("Rao", Decimal::from(500))));
        assert_eq!(free.price, Some(Decimal::ZERO));
        assert_eq!(
            free.description,
            "Free revisit (day 3 of 7) — OPD consultation"
        );
    }

    #[test]
    fn otherwise_the_doctors_own_fee_beats_the_charge_master() {
        let fee = price(None, Some(("Rao", Decimal::from(500))));
        assert_eq!(fee.price, Some(Decimal::from(500)));
        assert_eq!(fee.description, "OPD consultation — Dr Rao");
        let titled = price(None, Some(("Dr. Rao", Decimal::from(500))));
        assert_eq!(titled.description, "OPD consultation — Dr. Rao");
        assert_eq!(
            price(None, None).price,
            None,
            "no fee set: the department rate"
        );
    }
}
