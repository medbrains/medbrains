use std::collections::HashMap;

use uuid::Uuid;

use super::{
    CounterQueue, ForecastInput, Readings, TokenRow, ZoneFacts, ZoneMap, alert_cleared,
    alert_level, forecast_people, queue_wait, recommend_counters, service_minutes, why_red,
    zone_minutes,
};

fn token(module: &str, dept: Uuid, counter: Option<&str>, waiting: i64, called: i64) -> TokenRow {
    TokenRow {
        module: module.to_owned(),
        scope: "department".to_owned(),
        scope_id: Some(dept),
        counter_label: counter.map(str::to_owned),
        waiting,
        called_30m: called,
    }
}

struct World {
    billing_zone: Uuid,
    opd_zone: Uuid,
    billing: Uuid,
    opd: Uuid,
    ward: Uuid,
    map: ZoneMap,
}

fn world() -> World {
    let (billing_zone, opd_zone) = (Uuid::new_v4(), Uuid::new_v4());
    let (billing, opd, ward) = (Uuid::new_v4(), Uuid::new_v4(), Uuid::new_v4());
    let map = ZoneMap {
        departments: HashMap::from([(billing, billing_zone), (opd, opd_zone)]),
        queues: HashMap::new(),
        locations: HashMap::from([(ward, opd_zone)]),
    };
    World {
        billing_zone,
        opd_zone,
        billing,
        opd,
        ward,
        map,
    }
}

fn full_readings(w: &World) -> Readings {
    Readings {
        tokens: Some(vec![
            token("billing", w.billing, Some("Counter 1"), 6, 4),
            token("billing", w.billing, Some("Counter 2"), 4, 0),
            token("opd", w.opd, None, 10, 2),
        ]),
        checked_in: Some(vec![(w.opd, 12)]),
        visitors: Some(vec![(w.ward, 3)]),
        staff: Some(vec![(w.billing, 2), (w.opd, 5)]),
    }
}

#[test]
fn people_are_patients_times_the_attendant_factor_plus_visitors_and_staff() {
    let w = world();
    let out = zone_minutes(
        &[(w.opd_zone, 1.8), (w.billing_zone, 1.8)],
        &w.map,
        &full_readings(&w),
    );
    let opd = &out[&w.opd_zone];
    // 12 checked in outranks 10 waiting tokens (the same people): 12 x 1.8 = 21.6 -> 22.
    assert_eq!(opd.patients, Some(12));
    assert_eq!(opd.people_est, Some(22 + 3 + 5));
    let billing = &out[&w.billing_zone];
    assert_eq!(billing.waiting, Some(10));
    assert_eq!(billing.people_est, Some(18 + 2));
    assert!(billing.unknown_sources.is_empty());
}

#[test]
fn a_failed_source_is_unknown_never_zero() {
    let w = world();
    let mut readings = full_readings(&w);
    readings.visitors = None;
    let out = zone_minutes(&[(w.opd_zone, 1.8)], &w.map, &readings);
    let opd = &out[&w.opd_zone];
    assert_eq!(opd.visitors, None);
    // The total cannot be known without its parts.
    assert_eq!(opd.people_est, None);
    assert_eq!(opd.waiting, Some(10));
    assert_eq!(opd.unknown_sources, vec!["visitors"]);
}

#[test]
fn a_zone_nothing_feeds_reads_zero_when_every_source_answered() {
    let w = world();
    let empty = Uuid::new_v4();
    let out = zone_minutes(&[(empty, 1.8)], &w.map, &full_readings(&w));
    assert_eq!(out[&empty].people_est, Some(0));
}

#[test]
fn a_counter_mapping_outranks_the_queue_and_the_department() {
    let mut w = world();
    let pharmacy_zone = Uuid::new_v4();
    w.map.queues.insert(
        ("billing".to_owned(), Some("Counter 2".to_owned())),
        pharmacy_zone,
    );
    let out = zone_minutes(
        &[(w.billing_zone, 1.0), (pharmacy_zone, 1.0)],
        &w.map,
        &full_readings(&w),
    );
    assert_eq!(out[&w.billing_zone].waiting, Some(6));
    assert_eq!(out[&pharmacy_zone].waiting, Some(4));
    assert_eq!(
        out[&w.billing_zone].counters,
        vec![CounterQueue {
            label: "Counter 1".to_owned(),
            waiting: 6
        }]
    );
}

#[test]
fn the_service_rate_is_measured_only_with_enough_calls() {
    // 6 calls in 30 minutes across 2 counters: 10 minutes a token per counter.
    assert!((service_minutes(6, 2) - 10.0).abs() < f64::EPSILON);
    // 2 calls is not a rate.
    assert!((service_minutes(2, 1) - super::DEFAULT_SERVICE_MINUTES).abs() < f64::EPSILON);
}

#[test]
fn the_wait_is_the_queue_shared_across_the_open_counters() {
    assert!((queue_wait(10, 3.0, 2) - 15.0).abs() < f64::EPSILON);
    assert!((queue_wait(0, 3.0, 2)).abs() < f64::EPSILON);
    // No counter open is treated as one, not a division by zero.
    assert!((queue_wait(4, 3.0, 0) - 12.0).abs() < f64::EPSILON);
}

#[test]
fn a_wait_on_target_gets_no_recommendation() {
    assert_eq!(recommend_counters(4, 3.0, 1, 15), None);
}

#[test]
fn one_more_counter_is_recommended_with_its_numbers() {
    // 22 waiting, 2 min a token, 2 counters: 22 min; a third gives 14.7.
    let advice = recommend_counters(22, 2.0, 2, 15).expect("over target");
    assert_eq!(advice.counters_suggested, 3);
    assert!((advice.wait_before - 22.0).abs() < f64::EPSILON);
    assert!((advice.wait_after - 14.7).abs() < 0.05);
}

#[test]
fn the_fewest_counters_that_reach_target_are_asked_for_and_never_more_than_three() {
    let advice = recommend_counters(30, 3.0, 1, 30).expect("over target");
    assert_eq!(advice.counters_suggested, 3);
    let flood = recommend_counters(500, 3.0, 1, 15).expect("over target");
    assert_eq!(flood.counters_suggested, 1 + super::MAX_EXTRA_COUNTERS);
}

#[test]
fn capacity_outranks_comfort_and_an_alert_clears_below_the_band() {
    assert_eq!(alert_level(50, Some(40), Some(60)), Some(("comfort", 40)));
    assert_eq!(alert_level(61, Some(40), Some(60)), Some(("capacity", 60)));
    assert_eq!(alert_level(40, Some(40), Some(60)), None);
    assert_eq!(alert_level(500, None, None), None);
    assert!(!alert_cleared(37, 40));
    assert!(alert_cleared(35, 40));
}

#[test]
fn the_forecast_is_the_usual_crowd_but_never_below_the_booked_patients() {
    let usual = ForecastInput {
        history_avg: Some(40.0),
        booked_next_hour: 10,
    };
    assert_eq!(forecast_people(Some(5), usual, 1.8), Some(40));
    // 30 booked x 0.85 show x 1.8 = 45.9 beats the usual 40.
    let busy = ForecastInput {
        history_avg: Some(40.0),
        booked_next_hour: 30,
    };
    assert_eq!(forecast_people(Some(5), busy, 1.8), Some(46));
}

#[test]
fn with_no_history_the_forecast_holds_now_and_with_nothing_it_is_unknown() {
    let fresh = ForecastInput {
        history_avg: None,
        booked_next_hour: 0,
    };
    assert_eq!(forecast_people(Some(12), fresh, 1.8), Some(12));
    assert_eq!(forecast_people(None, fresh, 1.8), None);
    let booked = ForecastInput {
        history_avg: None,
        booked_next_hour: 10,
    };
    assert_eq!(forecast_people(None, booked, 1.0), Some(9));
}

#[test]
fn a_red_zone_says_why_with_its_numbers() {
    let facts = ZoneFacts {
        people: Some(58),
        comfort_limit: Some(45),
        capacity: Some(60),
        waiting: Some(22),
        wait_minutes: Some(22.0),
        target_minutes: 15,
        open_counters: Some(2),
        served_30m: Some(0),
        staff: Some(2),
        booked_next_hour: Some(41),
        unknown_sources: vec![],
    };
    let reasons = why_red(&facts);
    assert_eq!(reasons[0], "About 58 people, over the comfort limit of 45.");
    assert!(reasons[1].contains("22 waiting for 2 open counter(s)"));
    assert!(reasons.iter().any(|r| r.contains("last 30 minutes")));
    assert!(reasons.iter().any(|r| r.starts_with("41 more patients")));
}

#[test]
fn an_outage_is_named_first_and_a_calm_zone_has_no_reasons() {
    let unknown = ZoneFacts {
        unknown_sources: vec!["visitors".to_owned()],
        ..ZoneFacts::default()
    };
    assert!(why_red(&unknown)[0].contains("Could not read visitors"));
    let calm = ZoneFacts {
        people: Some(5),
        comfort_limit: Some(40),
        target_minutes: 15,
        ..ZoneFacts::default()
    };
    assert!(why_red(&calm).is_empty());
}
