//! Against WHO's and IAP's published reference values.

use chrono::NaiveDate;

use super::assess::{self, Child, normal_cdf};
use super::iap::{self, IapIndicator};
use super::who::{self, WhoTable};
use super::{Measurement, Sex};

fn d(y: i32, m: u32, day: u32) -> NaiveDate {
    NaiveDate::from_ymd_opt(y, m, day).unwrap()
}

fn sd_lines(t: WhoTable, sex: Sex, day: f64) -> Vec<f64> {
    let lms = who::lms(t, sex, day).unwrap();
    [-3.0, -2.0, -1.0, 0.0, 1.0, 2.0, 3.0]
        .iter()
        .map(|z| (lms.value_at(*z) * 10.0).round() / 10.0)
        .collect()
}

#[test]
fn who_weight_for_age_at_12_months_matches_the_published_sd_table() {
    // WHO weight-for-age z-score tables, 12 months.
    assert_eq!(
        sd_lines(WhoTable::WeightForAge, Sex::Male, 365.0),
        [6.9, 7.7, 8.6, 9.6, 10.8, 12.0, 13.3]
    );
    assert_eq!(
        sd_lines(WhoTable::WeightForAge, Sex::Female, 365.0),
        [6.3, 7.0, 7.9, 8.9, 10.1, 11.5, 13.1]
    );
}

#[test]
fn who_length_head_and_weight_for_length_medians() {
    // Length-for-age boys 24 months median 87.8 cm (recumbent).
    assert_eq!(
        sd_lines(WhoTable::LengthHeightForAge, Sex::Male, 730.0)[3],
        87.8
    );
    // Head circumference-for-age girls at birth median 33.9 cm.
    assert_eq!(sd_lines(WhoTable::HeadForAge, Sex::Female, 0.0)[3], 33.9);
    // Weight-for-length boys at 45.0 cm median 2.4 kg; interpolation between rows.
    let a = who::lms(WhoTable::WeightForLength, Sex::Male, 45.0)
        .unwrap()
        .m;
    let b = who::lms(WhoTable::WeightForLength, Sex::Male, 45.1)
        .unwrap()
        .m;
    let mid = who::lms(WhoTable::WeightForLength, Sex::Male, 45.05)
        .unwrap()
        .m;
    assert!((a - 2.441).abs() < 1e-9 && ((a + b) / 2.0 - mid).abs() < 1e-9);
    assert!(
        who::lms(WhoTable::WeightForLength, Sex::Male, 30.0).is_none(),
        "outside the table"
    );
}

#[test]
fn who_median_is_z_zero_and_weight_beyond_3_sd_is_restricted() {
    let lms = who::lms(WhoTable::WeightForAge, Sex::Male, 365.0).unwrap();
    assert!(lms.z(lms.m, true).abs() < 1e-9);
    // WHO's restricted method: beyond +3 SD, distance is measured in units of
    // the 2-3 SD gap, so sd3 + one gap is exactly +4.
    let (sd2, sd3) = (lms.value_at(2.0), lms.value_at(3.0));
    assert!((lms.z(sd3 + (sd3 - sd2), true) - 4.0).abs() < 1e-9);
    let (sd2n, sd3n) = (lms.value_at(-2.0), lms.value_at(-3.0));
    assert!((lms.z(sd3n - (sd2n - sd3n), true) + 4.0).abs() < 1e-9);
}

#[test]
fn iap_reads_the_published_centiles() {
    // Table II, boys 10.0 years: 3rd 123.6, 50th 137.2, 97th 151.4.
    let (z, ext) = iap::z(IapIndicator::Height, Sex::Male, 10.0, 137.2).unwrap();
    assert!(z.abs() < 1e-9 && !ext);
    let (z, _) = iap::z(IapIndicator::Height, Sex::Male, 10.0, 123.6).unwrap();
    assert!((z + 1.880_794).abs() < 1e-6);
    // Halfway between 10.0 (137.2) and 10.5 (139.9) the median is 138.55.
    let (z, _) = iap::z(IapIndicator::Height, Sex::Male, 10.25, 138.55).unwrap();
    assert!(z.abs() < 1e-9);
    // Table V, girls 18 years: 97th 73.5 kg; above it is extrapolated.
    let (z, ext) = iap::z(IapIndicator::Weight, Sex::Female, 18.0, 80.0).unwrap();
    assert!(z > 1.880_794 && ext);
    assert!(iap::z(IapIndicator::Weight, Sex::Female, 4.9, 15.0).is_none());
}

fn child(sex: Sex, dob: NaiveDate, ga: Option<f64>) -> Child {
    Child {
        sex,
        date_of_birth: dob,
        gestation_weeks: ga,
    }
}

fn m(on: NaiveDate, w: Option<f64>, h: Option<f64>) -> Measurement {
    Measurement {
        measured_on: on,
        weight_kg: w,
        height_cm: h,
        head_circumference_cm: None,
    }
}

#[test]
fn iap_bmi_flags_overweight_and_obesity_at_the_adult_equivalent_lines() {
    // Table VII, girls 12.0 years: 23-eq 20.2, 27-eq 24.1.
    let girl = child(Sex::Female, d(2010, 1, 1), None);
    let at12 = d(2022, 1, 1);
    let bmi = |b: f64| m(at12, Some(b * 1.5 * 1.5), Some(150.0));
    let flags = |b: f64| {
        let charts = assess::charts(&girl, &[bmi(b)], at12);
        let c = charts.into_iter().find(|c| c.key == "iap_bmi").unwrap();
        c.points[0].flags.iter().map(|f| f.code).collect::<Vec<_>>()
    };
    assert_eq!(flags(20.3), ["overweight"]);
    assert_eq!(flags(24.2), ["obese"]);
    assert!(flags(17.0).is_empty());
}

#[test]
fn a_preterm_infant_is_judged_at_corrected_age_until_two_years() {
    let baby = child(Sex::Male, d(2026, 1, 1), Some(32.0));
    let early = d(2026, 3, 12); // 70 days old, 8 weeks early: 14 days corrected
    let charts = assess::charts(&baby, &[m(early, Some(4.0), None)], early);
    let p = &charts.iter().find(|c| c.key == "who_wfa").unwrap().points[0];
    assert_eq!((p.age_days, p.corrected), (14, true));
    // At 2 years and beyond, chronological age is used.
    let later = d(2028, 2, 1);
    let charts = assess::charts(&baby, &[m(later, Some(12.0), None)], later);
    let p = &charts.iter().find(|c| c.key == "who_wfa").unwrap().points[0];
    assert!(!p.corrected);
    // A term baby is never corrected.
    let term = child(Sex::Male, d(2026, 1, 1), Some(39.0));
    let charts = assess::charts(&term, &[m(early, Some(4.0), None)], early);
    assert!(!charts.iter().find(|c| c.key == "who_wfa").unwrap().points[0].corrected);
}

#[test]
fn below_minus_two_sd_and_crossing_two_centile_lines_are_flagged() {
    let boy = child(Sex::Male, d(2025, 1, 1), None);
    let lms = who::lms(WhoTable::WeightForAge, Sex::Male, 365.0).unwrap();
    let a = d(2025, 7, 2);
    let b = d(2026, 1, 1); // 365 days
    let first = who::lms(
        WhoTable::WeightForAge,
        Sex::Male,
        (a - d(2025, 1, 1)).num_days() as f64,
    )
    .unwrap();
    let ms = [
        m(a, Some(first.m), None),
        m(b, Some(lms.value_at(-2.5)), None),
    ];
    let charts = assess::charts(&boy, &ms, b);
    let pts = &charts.iter().find(|c| c.key == "who_wfa").unwrap().points;
    assert!(pts[0].flags.is_empty());
    let codes: Vec<&str> = pts[1].flags.iter().map(|f| f.code).collect();
    assert_eq!(codes, ["below_minus2", "crossed_down"]);
    assert!(pts[1].flags[0].label.contains("underweight"));
    assert!((pts[1].z + 2.5).abs() < 0.01);
}

#[test]
fn weight_for_length_switches_to_weight_for_height_at_two_years() {
    let boy = child(Sex::Male, d(2024, 1, 1), None);
    let ms = [
        m(d(2025, 1, 1), Some(9.6), Some(75.0)),
        m(d(2026, 6, 1), Some(13.0), Some(90.0)),
    ];
    let charts = assess::charts(&boy, &ms, d(2026, 6, 1));
    let count = |k: &str| {
        charts
            .iter()
            .find(|c| c.key == k)
            .map_or(0, |c| c.points.len())
    };
    assert_eq!((count("who_wfl"), count("who_wfh")), (1, 1));
    assert_eq!(count("iap_weight"), 0);
}

#[test]
fn centile_comes_from_the_normal_distribution() {
    assert!((normal_cdf(0.0) - 0.5).abs() < 1e-7);
    assert!((normal_cdf(1.959_964) - 0.975).abs() < 1e-6);
    assert!((normal_cdf(-1.880_794) - 0.03).abs() < 1e-6);
}
