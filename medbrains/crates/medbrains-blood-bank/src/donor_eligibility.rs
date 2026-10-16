//! Who may be bled today (NBTC guidelines 2017 / D&C Rules 2020).
//!
//! Deferral, age 18–65, weight for the bag, haemoglobin, the whole-blood
//! interval (90 days men, 120 women), and for apheresis the platelet count,
//! the 48-hour and 28-day gaps and the 2-a-week / 24-a-year caps. The caller
//! refuses with the reason and audits the refusal.

use chrono::{DateTime, NaiveDate, Utc};
use uuid::Uuid;

use medbrains_server_core::error::AppError;

/// The donor as the collection check needs them.
#[derive(Debug, sqlx::FromRow)]
pub(crate) struct DonorEligibility {
    pub is_deferred: bool,
    pub deferral_until: Option<NaiveDate>,
    pub deferral_reason: Option<String>,
    pub gender: Option<String>,
    pub date_of_birth: Option<NaiveDate>,
    /// Age as recorded at intake, used only when there is no date of birth.
    pub age: Option<i32>,
    /// Latest whole-blood donation on record, ours or declared at intake.
    pub last_whole_blood: Option<NaiveDate>,
    pub last_apheresis: Option<DateTime<Utc>>,
    /// Apheresis donations in the last 7 and 365 days.
    pub apheresis_week: i64,
    pub apheresis_year: i64,
    pub today: NaiveDate,
    pub now: DateTime<Utc>,
}

/// What is being collected today, and the screening measured before it.
#[derive(Debug)]
pub(crate) struct Collection<'a> {
    pub donation_type: &'a str,
    pub volume_ml: i32,
    pub weight_kg: Option<f64>,
    pub hemoglobin_g_dl: Option<f64>,
    /// Pre-apheresis platelet count, ×10⁹/L; required for apheresis only.
    pub platelet_count: Option<f64>,
    pub systolic_bp: Option<i32>,
    pub diastolic_bp: Option<i32>,
    pub pulse: Option<i32>,
    pub temperature_c: Option<f64>,
}

/// NBTC / D&C Rules: donors are 18 to 65.
const MIN_AGE: u32 = 18;
const MAX_AGE: u32 = 65;
/// Haemoglobin floor for any donation, g/dL.
const MIN_HB: f64 = 12.5;
/// Whole blood: 45 kg for a 350 ml bag, 55 kg for 450 ml; apheresis 50 kg.
const MIN_WEIGHT_350: f64 = 45.0;
const MIN_WEIGHT_450: f64 = 55.0;
const MIN_WEIGHT_APHERESIS: f64 = 50.0;
const SMALL_BAG_ML: i32 = 350;
/// Apheresis: 48 hours after another apheresis, 28 days after whole blood.
const APHERESIS_GAP_HOURS: i64 = 48;
const APHERESIS_AFTER_WHOLE_BLOOD_DAYS: i64 = 28;
/// Apheresis: platelet count at least 150 ×10⁹/L; at most 2 a week, 24 a year.
const MIN_PLATELETS: f64 = 150.0;
const MAX_APHERESIS_PER_WEEK: i64 = 2;
const MAX_APHERESIS_PER_YEAR: i64 = 24;
/// D&C Rules (Schedule F Part XII-B): BP 100–180 / 50–100 mmHg, pulse 60–100
/// and regular, afebrile (oral temperature not above 37.5 °C).
const SYSTOLIC_LIMITS: std::ops::RangeInclusive<i32> = 100..=180;
const DIASTOLIC_LIMITS: std::ops::RangeInclusive<i32> = 50..=100;
const PULSE_LIMITS: std::ops::RangeInclusive<i32> = 60..=100;
const MAX_TEMPERATURE_C: f64 = 37.5;

/// Minimum days between whole-blood donations. An unrecorded or other
/// gender gets the longer interval: the safe side for the donor.
#[must_use]
pub fn whole_blood_interval_days(gender: Option<&str>) -> i64 {
    match gender.map(str::to_ascii_lowercase).as_deref() {
        Some("male" | "m") => 90,
        _ => 120,
    }
}

fn deferral_refusal(donor: &DonorEligibility) -> Option<String> {
    if !donor.is_deferred {
        return None;
    }
    let reason = donor
        .deferral_reason
        .as_deref()
        .unwrap_or("no reason recorded");
    match donor.deferral_until {
        None => Some(format!(
            "This donor is permanently deferred ({reason}). Do not collect."
        )),
        Some(until) if until > donor.today => Some(format!(
            "This donor is deferred until {until} ({reason}). Do not collect before then."
        )),
        Some(_) => None,
    }
}

fn age_refusal(donor: &DonorEligibility) -> Option<String> {
    let age = match (donor.date_of_birth, donor.age) {
        (Some(dob), _) => donor.today.years_since(dob),
        (None, Some(age)) => u32::try_from(age).ok(),
        (None, None) => None,
    };
    let Some(age) = age else {
        return Some("Record the donor's date of birth: donors must be 18 to 65.".to_owned());
    };
    (!(MIN_AGE..=MAX_AGE).contains(&age)).then(|| {
        format!("The donor is {age}. Donors must be {MIN_AGE} to {MAX_AGE} (NBTC / D&C Rules).")
    })
}

fn screening_refusal(c: &Collection<'_>) -> Option<String> {
    let (Some(weight), Some(hb)) = (c.weight_kg, c.hemoglobin_g_dl) else {
        return Some(
            "Record the donor's weight and haemoglobin measured today before collecting."
                .to_owned(),
        );
    };
    let (min_weight, bag) = match (c.donation_type, c.volume_ml) {
        ("whole_blood", ml) if ml <= SMALL_BAG_ML => (MIN_WEIGHT_350, "a 350 ml bag"),
        ("whole_blood", _) => (MIN_WEIGHT_450, "a 450 ml bag"),
        _ => (MIN_WEIGHT_APHERESIS, "apheresis"),
    };
    if weight < min_weight {
        return Some(format!(
            "The donor weighs {weight} kg; {bag} needs at least {min_weight} kg."
        ));
    }
    (hb < MIN_HB).then(|| {
        format!("Haemoglobin is {hb} g/dL; at least {MIN_HB} g/dL is needed to donate. Defer.")
    })
}

fn vitals_refusal(c: &Collection<'_>) -> Option<String> {
    let (Some(sys), Some(dia), Some(pulse)) = (c.systolic_bp, c.diastolic_bp, c.pulse) else {
        return Some(
            "Record the donor's blood pressure (systolic and diastolic) and pulse measured \
             today before collecting."
                .to_owned(),
        );
    };
    if !SYSTOLIC_LIMITS.contains(&sys) || !DIASTOLIC_LIMITS.contains(&dia) {
        return Some(format!(
            "Blood pressure is {sys}/{dia} mmHg; donors must be {}–{} / {}–{} mmHg (D&C Rules). \
             Defer.",
            SYSTOLIC_LIMITS.start(),
            SYSTOLIC_LIMITS.end(),
            DIASTOLIC_LIMITS.start(),
            DIASTOLIC_LIMITS.end()
        ));
    }
    if !PULSE_LIMITS.contains(&pulse) {
        return Some(format!(
            "Pulse is {pulse}/min; donors must be {}–{} (D&C Rules). Defer.",
            PULSE_LIMITS.start(),
            PULSE_LIMITS.end()
        ));
    }
    c.temperature_c.filter(|t| *t > MAX_TEMPERATURE_C).map(|t| {
        format!(
            "Temperature is {t} °C; a donor must be afebrile (≤ {MAX_TEMPERATURE_C} °C). Defer."
        )
    })
}

fn interval_refusal(donor: &DonorEligibility, donation_type: &str) -> Option<String> {
    if donation_type == "whole_blood" {
        let last = donor.last_whole_blood?;
        let interval = whole_blood_interval_days(donor.gender.as_deref());
        let eligible_on = last + chrono::Duration::days(interval);
        return (eligible_on > donor.today).then(|| {
            format!(
                "Last whole-blood donation was on {last}. The minimum interval is {interval} \
                 days (NBTC / D&C Rules), so this donor is next eligible on {eligible_on}."
            )
        });
    }
    if let Some(last) = donor.last_whole_blood {
        let eligible_on = last + chrono::Duration::days(APHERESIS_AFTER_WHOLE_BLOOD_DAYS);
        if eligible_on > donor.today {
            return Some(format!(
                "Last whole-blood donation was on {last}; apheresis needs \
                 {APHERESIS_AFTER_WHOLE_BLOOD_DAYS} days after it, so not before {eligible_on}."
            ));
        }
    }
    let last = donor.last_apheresis?;
    let eligible_at = last + chrono::Duration::hours(APHERESIS_GAP_HOURS);
    (eligible_at > donor.now).then(|| {
        format!(
            "The last apheresis was at {}; the next needs {APHERESIS_GAP_HOURS} hours, so not \
             before {}.",
            last.format("%Y-%m-%d %H:%M UTC"),
            eligible_at.format("%Y-%m-%d %H:%M UTC")
        )
    })
}

fn apheresis_refusal(donor: &DonorEligibility, c: &Collection<'_>) -> Option<String> {
    if c.donation_type == "whole_blood" {
        return None;
    }
    let Some(platelets) = c.platelet_count else {
        return Some("Record the pre-apheresis platelet count before collecting.".to_owned());
    };
    if platelets < MIN_PLATELETS {
        return Some(format!(
            "Platelet count is {platelets} ×10⁹/L; apheresis needs at least {MIN_PLATELETS}."
        ));
    }
    if donor.apheresis_week >= MAX_APHERESIS_PER_WEEK {
        return Some(format!(
            "This donor has given {} apheresis donations in the last 7 days; the limit is \
             {MAX_APHERESIS_PER_WEEK} a week (NBTC).",
            donor.apheresis_week
        ));
    }
    (donor.apheresis_year >= MAX_APHERESIS_PER_YEAR).then(|| {
        format!(
            "This donor has given {} apheresis donations in the last year; the limit is \
             {MAX_APHERESIS_PER_YEAR} a year (NBTC).",
            donor.apheresis_year
        )
    })
}

/// Why this donor may not donate today, or `None` if they may.
#[must_use]
pub(crate) fn donation_refusal(donor: &DonorEligibility, c: &Collection<'_>) -> Option<String> {
    deferral_refusal(donor)
        .or_else(|| age_refusal(donor))
        .or_else(|| screening_refusal(c))
        .or_else(|| vitals_refusal(c))
        .or_else(|| apheresis_refusal(donor, c))
        .or_else(|| interval_refusal(donor, c.donation_type))
}

/// Load the donor for the collection check, locking the row so two
/// simultaneous collections cannot both pass the interval.
pub(crate) async fn load_donor_eligibility(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    donor_id: Uuid,
) -> Result<DonorEligibility, AppError> {
    sqlx::query_as::<_, DonorEligibility>(
        "SELECT d.is_deferred, d.deferral_until, d.deferral_reason, d.gender, \
                d.date_of_birth, d.age, \
                GREATEST( \
                  (SELECT max(bd.donated_at)::date FROM blood_donations bd \
                    WHERE bd.tenant_id = d.tenant_id AND bd.donor_id = d.id \
                      AND bd.donation_type = 'whole_blood' AND bd.deleted_at IS NULL), \
                  d.last_donation_date) AS last_whole_blood, \
                (SELECT max(bd.donated_at) FROM blood_donations bd \
                  WHERE bd.tenant_id = d.tenant_id AND bd.donor_id = d.id \
                    AND bd.donation_type <> 'whole_blood' AND bd.deleted_at IS NULL) \
                  AS last_apheresis, \
                (SELECT count(*) FROM blood_donations bd \
                  WHERE bd.tenant_id = d.tenant_id AND bd.donor_id = d.id \
                    AND bd.donation_type <> 'whole_blood' AND bd.deleted_at IS NULL \
                    AND bd.donated_at > now() - interval '7 days') AS apheresis_week, \
                (SELECT count(*) FROM blood_donations bd \
                  WHERE bd.tenant_id = d.tenant_id AND bd.donor_id = d.id \
                    AND bd.donation_type <> 'whole_blood' AND bd.deleted_at IS NULL \
                    AND bd.donated_at > now() - interval '365 days') AS apheresis_year, \
                CURRENT_DATE AS today, now() AS now \
           FROM blood_donors d \
          WHERE d.id = $1 AND d.tenant_id = $2 AND d.deleted_at IS NULL \
          FOR UPDATE OF d",
    )
    .bind(donor_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)
}

#[cfg(test)]
mod tests {
    use super::{Collection, DonorEligibility, donation_refusal, whole_blood_interval_days};
    use chrono::{NaiveDate, TimeZone, Utc};

    fn day(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap_or_default()
    }

    fn donor(gender: Option<&str>, last: Option<&str>) -> DonorEligibility {
        DonorEligibility {
            is_deferred: false,
            deferral_until: None,
            deferral_reason: None,
            gender: gender.map(str::to_owned),
            date_of_birth: Some(day("1990-01-01")),
            age: None,
            last_whole_blood: last.map(day),
            last_apheresis: None,
            apheresis_week: 0,
            apheresis_year: 0,
            today: day("2026-10-12"),
            now: Utc
                .with_ymd_and_hms(2026, 10, 12, 10, 0, 0)
                .single()
                .unwrap_or_default(),
        }
    }

    fn whole(volume_ml: i32, weight: f64, hb: f64) -> Collection<'static> {
        Collection {
            donation_type: "whole_blood",
            volume_ml,
            weight_kg: Some(weight),
            hemoglobin_g_dl: Some(hb),
            platelet_count: None,
            systolic_bp: Some(120),
            diastolic_bp: Some(80),
            pulse: Some(72),
            temperature_c: Some(36.8),
        }
    }

    fn fit() -> Collection<'static> {
        whole(450, 60.0, 13.5)
    }

    #[test]
    fn whole_blood_interval_is_90_for_men_and_120_otherwise() {
        assert_eq!(whole_blood_interval_days(Some("Male")), 90);
        assert_eq!(whole_blood_interval_days(Some("female")), 120);
        assert_eq!(whole_blood_interval_days(None), 120);
        // 89 days for a man: refused; 90: allowed.
        assert!(donation_refusal(&donor(Some("male"), Some("2026-07-15")), &fit()).is_some());
        assert!(donation_refusal(&donor(Some("male"), Some("2026-07-14")), &fit()).is_none());
        // 100 days for a woman: refused.
        assert!(donation_refusal(&donor(Some("female"), Some("2026-07-04")), &fit()).is_some());
        assert!(donation_refusal(&donor(Some("female"), None), &fit()).is_none());
    }

    #[test]
    fn a_deferral_refuses_until_it_ends_and_forever_without_an_end() {
        let mut d = donor(Some("male"), None);
        d.is_deferred = true;
        assert!(donation_refusal(&d, &fit()).is_some(), "permanent");
        d.deferral_until = Some(day("2026-12-01"));
        assert!(
            donation_refusal(&d, &fit()).is_some(),
            "temporary, not over"
        );
        d.deferral_until = Some(day("2026-10-12"));
        assert!(donation_refusal(&d, &fit()).is_none(), "temporary, over");
    }

    #[test]
    fn age_weight_and_haemoglobin_are_checked() {
        let mut d = donor(Some("male"), None);
        d.date_of_birth = Some(day("2009-01-01"));
        assert!(donation_refusal(&d, &fit()).is_some(), "17");
        d.date_of_birth = Some(day("1960-01-01"));
        assert!(donation_refusal(&d, &fit()).is_some(), "66");
        d.date_of_birth = None;
        assert!(donation_refusal(&d, &fit()).is_some(), "age unknown");
        let d = donor(Some("male"), None);
        assert!(
            donation_refusal(&d, &whole(450, 50.0, 13.0)).is_some(),
            "50 kg, 450 ml"
        );
        assert!(
            donation_refusal(&d, &whole(350, 50.0, 13.0)).is_none(),
            "50 kg, 350 ml"
        );
        assert!(
            donation_refusal(&d, &whole(350, 44.0, 13.0)).is_some(),
            "44 kg"
        );
        assert!(
            donation_refusal(&d, &whole(450, 60.0, 12.4)).is_some(),
            "Hb 12.4"
        );
        let unmeasured = Collection {
            weight_kg: None,
            ..fit()
        };
        assert!(donation_refusal(&d, &unmeasured).is_some(), "not measured");
    }

    #[test]
    fn blood_pressure_pulse_and_temperature_follow_the_d_and_c_limits() {
        let d = donor(Some("male"), None);
        let with = |sys: i32, dia: i32, pulse: i32, temp: f64| Collection {
            systolic_bp: Some(sys),
            diastolic_bp: Some(dia),
            pulse: Some(pulse),
            temperature_c: Some(temp),
            ..fit()
        };
        assert!(
            donation_refusal(&d, &with(100, 50, 60, 37.5)).is_none(),
            "lower edges"
        );
        assert!(
            donation_refusal(&d, &with(180, 100, 100, 36.0)).is_none(),
            "upper edges"
        );
        assert!(
            donation_refusal(&d, &with(99, 70, 72, 36.8)).is_some(),
            "systolic 99"
        );
        assert!(
            donation_refusal(&d, &with(181, 90, 72, 36.8)).is_some(),
            "systolic 181"
        );
        assert!(
            donation_refusal(&d, &with(130, 49, 72, 36.8)).is_some(),
            "diastolic 49"
        );
        assert!(
            donation_refusal(&d, &with(130, 101, 72, 36.8)).is_some(),
            "diastolic 101"
        );
        assert!(
            donation_refusal(&d, &with(120, 80, 59, 36.8)).is_some(),
            "pulse 59"
        );
        assert!(
            donation_refusal(&d, &with(120, 80, 101, 36.8)).is_some(),
            "pulse 101"
        );
        assert!(
            donation_refusal(&d, &with(120, 80, 72, 37.6)).is_some(),
            "fever"
        );
        let unmeasured = Collection {
            diastolic_bp: None,
            ..fit()
        };
        assert!(
            donation_refusal(&d, &unmeasured).is_some(),
            "BP not measured"
        );
    }

    #[test]
    fn apheresis_waits_48_hours_and_28_days_after_whole_blood() {
        let plt = Collection {
            donation_type: "apheresis_platelets",
            volume_ml: 250,
            weight_kg: Some(60.0),
            hemoglobin_g_dl: Some(13.0),
            platelet_count: Some(200.0),
            ..fit()
        };
        let mut d = donor(Some("male"), Some("2026-09-20"));
        assert!(
            donation_refusal(&d, &plt).is_some(),
            "22 days after whole blood"
        );
        d.last_whole_blood = Some(day("2026-09-14"));
        assert!(
            donation_refusal(&d, &plt).is_none(),
            "28 days after whole blood"
        );
        d.last_apheresis = Utc.with_ymd_and_hms(2026, 10, 11, 9, 0, 0).single();
        assert!(
            donation_refusal(&d, &plt).is_some(),
            "25 hours after apheresis"
        );
        d.last_apheresis = Utc.with_ymd_and_hms(2026, 10, 10, 9, 0, 0).single();
        assert!(
            donation_refusal(&d, &plt).is_none(),
            "49 hours after apheresis"
        );
    }

    #[test]
    fn apheresis_needs_platelets_and_stays_within_the_caps() {
        let mut plt = Collection {
            donation_type: "apheresis_platelets",
            volume_ml: 250,
            weight_kg: Some(60.0),
            hemoglobin_g_dl: Some(13.0),
            platelet_count: None,
            ..fit()
        };
        let mut d = donor(Some("male"), None);
        assert!(donation_refusal(&d, &plt).is_some(), "no count");
        plt.platelet_count = Some(140.0);
        assert!(donation_refusal(&d, &plt).is_some(), "140");
        plt.platelet_count = Some(150.0);
        assert!(donation_refusal(&d, &plt).is_none(), "150");
        d.apheresis_week = 2;
        assert!(donation_refusal(&d, &plt).is_some(), "third this week");
        d.apheresis_week = 1;
        d.apheresis_year = 24;
        assert!(donation_refusal(&d, &plt).is_some(), "25th this year");
    }
}
