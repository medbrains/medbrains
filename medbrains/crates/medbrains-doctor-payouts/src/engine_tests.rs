use chrono::NaiveDate;
use rust_decimal::Decimal;
use uuid::Uuid;

use super::{
    Basis, Bearer, BillState, Charity, Line, Rule, TdsInput, Terms, cash_warning, compute_share,
    compute_tds, earned_now, financial_year, pick_rule, session_topup, split_overflow, tds_quarter,
};

fn d(units: i64) -> Decimal {
    Decimal::from(units)
}

fn rule(role: &str, pct: Option<i64>, fixed: Option<i64>) -> Rule {
    Rule {
        id: Uuid::new_v4(),
        charge_code: None,
        category: None,
        department_id: None,
        payer_class: None,
        visit_kind: None,
        role: role.to_owned(),
        is_fixed: fixed.is_some(),
        percentage: pct.map(d),
        fixed_amount: fixed.map(d),
        cap_min: None,
        cap_max: None,
    }
}

fn line(gross: i64, discount: i64) -> Line<'static> {
    Line {
        charge_code: "CON_GEN",
        category: "consultation",
        department_id: None,
        payer_class: "cash",
        visit_kind: Some("first"),
        role: "primary",
        quantity: 1,
        gross: d(gross),
        discount: d(discount),
    }
}

const TERMS: Terms = Terms {
    basis: Basis::Billed,
    share_on_net: true,
    discount_bearer: Bearer::ProRata,
    disallowance_bearer: Bearer::ProRata,
    charity: Charity::Zero,
};

#[test]
fn fixed_and_percent_rates() {
    let pct = compute_share(&rule("primary", Some(40), None), &line(1000, 0), &TERMS);
    assert_eq!(pct.amount, d(400));
    let fixed = compute_share(&rule("primary", None, Some(300)), &line(1000, 0), &TERMS);
    assert_eq!(fixed.amount, d(300));
}

#[test]
fn gross_versus_net_with_a_discount() {
    let r = rule("primary", Some(50), None);
    let net = compute_share(&r, &line(1000, 200), &TERMS);
    assert_eq!(net.amount, d(400), "net of the 200 discount");
    let gross = compute_share(
        &r,
        &line(1000, 200),
        &Terms {
            share_on_net: false,
            ..TERMS
        },
    );
    assert_eq!(gross.amount, d(500), "the hospital absorbs the discount");
}

#[test]
fn fixed_fee_discount_bearers() {
    let r = rule("primary", None, Some(300));
    let l = line(1000, 500);
    let by = |b| {
        compute_share(
            &r,
            &l,
            &Terms {
                discount_bearer: b,
                ..TERMS
            },
        )
        .amount
    };
    assert_eq!(by(Bearer::Hospital), d(300));
    assert_eq!(by(Bearer::ProRata), d(150));
    assert_eq!(
        by(Bearer::Doctor),
        d(0),
        "the 500 discount wipes out a 300 fee"
    );
}

#[test]
fn charity_cases_follow_the_agreement() {
    let r = rule("primary", Some(50), None);
    let free = line(1000, 1000);
    assert_eq!(compute_share(&r, &free, &TERMS).amount, d(0));
    let fixed = Terms {
        charity: Charity::Fixed(d(100)),
        ..TERMS
    };
    assert_eq!(compute_share(&r, &free, &fixed).amount, d(100));
    let full = Terms {
        charity: Charity::Full,
        ..TERMS
    };
    assert_eq!(compute_share(&r, &free, &full).amount, d(500));
}

#[test]
fn caps_bound_the_share() {
    let mut r = rule("primary", Some(10), None);
    r.cap_min = Some(d(150));
    assert_eq!(compute_share(&r, &line(1000, 0), &TERMS).amount, d(150));
    r.cap_min = None;
    r.cap_max = Some(d(50));
    assert_eq!(compute_share(&r, &line(1000, 0), &TERMS).amount, d(50));
}

#[test]
fn the_most_specific_rule_wins() {
    let general = rule("primary", Some(30), None);
    let mut by_code = rule("primary", Some(60), None);
    by_code.charge_code = Some("CON_GEN".to_owned());
    let mut tpa = rule("primary", Some(20), None);
    tpa.payer_class = Some("tpa".to_owned());
    let rules = vec![general, by_code.clone(), tpa];
    assert_eq!(
        pick_rule(&rules, &line(1000, 0)).map(|r| r.id),
        Some(by_code.id)
    );
    let mut assistant = line(1000, 0);
    assistant.role = "assistant";
    assert!(pick_rule(&rules, &assistant).is_none(), "role must match");
}

#[test]
fn follow_up_rates_apply_to_follow_ups() {
    let mut first = rule("primary", None, Some(500));
    first.visit_kind = Some("first".to_owned());
    let mut follow = rule("primary", None, Some(200));
    follow.visit_kind = Some("follow_up".to_owned());
    let rules = vec![first, follow.clone()];
    let mut l = line(800, 0);
    l.visit_kind = Some("follow_up");
    assert_eq!(pick_rule(&rules, &l).map(|r| r.id), Some(follow.id));
}

fn bill(status: &'static str, total: i64, paid: i64) -> BillState<'static> {
    BillState {
        status,
        total: d(total),
        paid: d(paid),
        claim: None,
    }
}

#[test]
fn billed_collected_and_realised() {
    let billed = TERMS;
    assert_eq!(
        earned_now(d(400), d(1000), &bill("draft", 1000, 0), &billed),
        d(0)
    );
    assert_eq!(
        earned_now(d(400), d(1000), &bill("issued", 1000, 0), &billed),
        d(400)
    );
    let collected = Terms {
        basis: Basis::Collected,
        ..TERMS
    };
    assert_eq!(
        earned_now(
            d(400),
            d(1000),
            &bill("partially_paid", 1000, 250),
            &collected
        ),
        d(100)
    );
    let realised = Terms {
        basis: Basis::Realised,
        ..TERMS
    };
    let mut tpa = bill("issued", 10_000, 0);
    tpa.claim = Some((d(10_000), None));
    assert_eq!(
        earned_now(d(4000), d(10_000), &tpa, &realised),
        d(0),
        "awaiting settlement"
    );
    tpa.claim = Some((d(10_000), Some(d(8000))));
    assert_eq!(
        earned_now(d(4000), d(10_000), &tpa, &realised),
        d(3200),
        "pro rata 80%"
    );
    let hospital = Terms {
        disallowance_bearer: Bearer::Hospital,
        ..realised
    };
    assert_eq!(earned_now(d(4000), d(10_000), &tpa, &hospital), d(4000));
    let doctor = Terms {
        disallowance_bearer: Bearer::Doctor,
        ..realised
    };
    assert_eq!(earned_now(d(4000), d(10_000), &tpa, &doctor), d(2000));
}

#[test]
fn a_cancelled_or_refunded_bill_earns_nothing() {
    assert_eq!(
        earned_now(d(400), d(1000), &bill("refunded", 1000, 0), &TERMS),
        d(0)
    );
    assert_eq!(
        earned_now(d(400), d(1000), &bill("cancelled", 1000, 0), &TERMS),
        d(0)
    );
}

#[test]
fn session_minimum_tops_up_a_thin_day() {
    assert_eq!(session_topup(d(3000), d(1200)), d(1800));
    assert_eq!(session_topup(d(3000), d(4500)), d(0));
}

fn tds(amount: i64, before: i64, taxed: i64, has_pan: bool) -> super::Tds {
    compute_tds(&TdsInput {
        amount: d(amount),
        paid_before: d(before),
        taxed_before: d(taxed),
        has_pan,
        rate: d(10),
        no_pan_rate: d(20),
        threshold: d(50_000),
    })
}

#[test]
fn tds_threshold_catch_up_and_no_pan() {
    assert_eq!(tds(30_000, 0, 0, true).amount, d(0), "under the threshold");
    let crossing = tds(30_000, 30_000, 0, true);
    assert_eq!(
        (crossing.base, crossing.amount),
        (d(60_000), d(6000)),
        "catches up the first 30k"
    );
    assert_eq!(tds(10_000, 60_000, 60_000, true).amount, d(1000));
    let no_pan = tds(60_000, 0, 0, false);
    assert_eq!((no_pan.rate, no_pan.amount), (d(20), d(12_000)));
}

#[test]
fn cash_over_the_limit_warns() {
    assert!(cash_warning(d(4000), d(5000), d(10_000)).is_none());
    assert!(cash_warning(d(6000), d(5000), d(10_000)).is_some());
}

#[test]
fn financial_years_and_quarters() {
    let mar = NaiveDate::from_ymd_opt(2027, 3, 31).unwrap_or_default();
    let apr = NaiveDate::from_ymd_opt(2026, 4, 1).unwrap_or_default();
    assert_eq!(financial_year(mar), "2026-27");
    assert_eq!(financial_year(apr), "2026-27");
    assert_eq!((tds_quarter(apr), tds_quarter(mar)), ("Q1", "Q4"));
}

#[test]
fn a_package_split_over_100_percent_is_caught() {
    let mut s = rule("primary", Some(60), None);
    s.category = Some("package".to_owned());
    let mut a = rule("assistant", Some(15), None);
    a.category = Some("package".to_owned());
    let mut an = rule("anaesthetist", Some(20), None);
    an.category = Some("package".to_owned());
    assert!(split_overflow(&[s.clone(), a.clone(), an.clone()]).is_none());
    an.percentage = Some(d(30));
    assert_eq!(split_overflow(&[s, a, an]), Some(d(105)));
}
