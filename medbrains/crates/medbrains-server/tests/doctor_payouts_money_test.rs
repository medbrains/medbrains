//! Doctor payouts (#4886): getting paid — the session minimum, maker-checker
//! approval, TDS on the year's aggregate per PAN, the cash warning, and
//! accrual on money taken through the collect desk.

mod common;
mod doctor_payouts_world;

use doctor_payouts_world::{SERIAL, d, fixed, pan, pay_cash, percent, tag, world};
use reqwest::StatusCode;
use serde_json::json;
use uuid::Uuid;

#[tokio::test]
async fn a_thin_session_is_topped_up_to_the_minimum() {
    let _g = SERIAL.lock().await;
    let w = world().await;
    let code = format!("SM{}", tag());
    let card = w.rate_card(&[fixed(&code, "1000")]).await;
    let doc = w.staff("doctor").await;
    w.agreement(
        doc.user_id,
        card,
        json!({ "engagement_type": "day", "session_minimum": "3000", "settlement_cycle": "same_day" }),
    )
    .await;
    let bill = w
        .bill(&[json!({ "charge_code": code, "unit_price": "1500", "performing_doctor_id": doc.user_id })])
        .await;
    w.issue(bill).await;
    let today = w.today().await;
    let summary = w
        .ok(
            "GET",
            &format!(
                "/api/doctor-payouts/day?doctor_id={}&date={today}",
                doc.user_id
            ),
            json!({}),
        )
        .await;
    assert_eq!(summary["earned"], json!("1000.00"));
    assert_eq!(summary["session_topup"], json!("2000.00"));
    let paid = w
        .ok(
            "POST",
            "/api/doctor-payouts/day/settle",
            json!({ "doctor_id": doc.user_id, "date": today, "mode": "upi", "reference": "UPI123456" }),
        )
        .await;
    assert_eq!(paid["statement"]["status"], json!("paid"));
    assert_eq!(paid["statement"]["incentive_amount"], json!("3000.00"));
}

#[tokio::test]
async fn a_statement_needs_a_second_person_to_approve_it() {
    let _g = SERIAL.lock().await;
    let w = world().await;
    let code = format!("ST{}", tag());
    let card = w.rate_card(&[fixed(&code, "5000")]).await;
    let doc = w.staff("doctor").await;
    w.agreement(doc.user_id, card, json!({ "pan": pan() }))
        .await;
    let bill = w
        .bill(&[json!({ "charge_code": code, "unit_price": "8000", "performing_doctor_id": doc.user_id })])
        .await;
    w.issue(bill).await;
    let (status, prepared) = w.prepare(doc.user_id).await;
    assert_eq!(status, StatusCode::OK, "{prepared}");
    let id = prepared["statement"]["id"].as_str().expect("id").to_owned();
    assert_eq!(prepared["lines"].as_array().map(Vec::len), Some(1));

    let (status, refused) = w
        .call(
            "POST",
            &format!("/api/doctor-payouts/statements/{id}/approve"),
            json!({}),
        )
        .await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "the preparer cannot approve: {refused}"
    );

    let checker = w.approver().await;
    let (status, approved) = w
        .as_staff(
            &checker,
            "POST",
            &format!("/api/doctor-payouts/statements/{id}/approve"),
            json!({}),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{approved}");
    assert_eq!(approved["status"], json!("approved"));

    let (again, _) = w.prepare(doc.user_id).await;
    assert_eq!(
        again,
        StatusCode::CONFLICT,
        "nothing left open to put on a second statement"
    );
}

async fn earn_and_approve(w: &doctor_payouts_world::World, doc: Uuid, code: &str) -> String {
    let bill = w
        .bill(&[json!({ "charge_code": code, "unit_price": "40000", "performing_doctor_id": doc })])
        .await;
    w.issue(bill).await;
    let (status, prepared) = w.prepare(doc).await;
    assert_eq!(status, StatusCode::OK, "{prepared}");
    let id = prepared["statement"]["id"].as_str().expect("id").to_owned();
    let checker = w.approver().await;
    let (status, out) = w
        .as_staff(
            &checker,
            "POST",
            &format!("/api/doctor-payouts/statements/{id}/approve"),
            json!({}),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{out}");
    id
}

async fn tds_of(
    w: &doctor_payouts_world::World,
    statement: &str,
) -> (rust_decimal::Decimal, Option<String>) {
    sqlx::query_as(
        "SELECT s.tds_amount, t.deductee_pan FROM incentive_calculations s \
           LEFT JOIN tds_deductions t ON t.id = s.tds_deduction_id WHERE s.id = $1::uuid",
    )
    .bind(statement)
    .fetch_one(&w.app.db)
    .await
    .expect("tds")
}

#[tokio::test]
async fn payouts_deduct_tds_past_the_threshold_and_twenty_percent_without_a_pan() {
    let _g = SERIAL.lock().await;
    let w = world().await;
    let code = format!("TD{}", tag());
    let card = w.rate_card(&[fixed(&code, "30000")]).await;
    let with_pan = w.staff("doctor").await;
    let p = pan();
    w.agreement(with_pan.user_id, card, json!({ "pan": p }))
        .await;

    let first = earn_and_approve(&w, with_pan.user_id, &code).await;
    pay_cash(&w, &first).await;
    assert_eq!(
        tds_of(&w, &first).await.0,
        d("0"),
        "30,000 is under the 50,000 threshold"
    );

    let second = earn_and_approve(&w, with_pan.user_id, &code).await;
    pay_cash(&w, &second).await;
    let (tds, deductee) = tds_of(&w, &second).await;
    assert_eq!(tds, d("6000"), "10% on the whole 60,000 once it crosses");
    assert_eq!(deductee, Some(p));

    let no_pan = w.staff("doctor").await;
    let card2 = w.rate_card(&[fixed(&code, "60000")]).await;
    w.agreement(no_pan.user_id, card2, json!({})).await;
    let third = earn_and_approve(&w, no_pan.user_id, &code).await;
    pay_cash(&w, &third).await;
    let (tds, deductee) = tds_of(&w, &third).await;
    assert_eq!(tds, d("12000"), "20% without a PAN");
    assert_eq!(deductee.as_deref(), Some("PANNOTAVBL"));
}

#[tokio::test]
async fn cash_above_ten_thousand_a_day_warns_but_pays() {
    let _g = SERIAL.lock().await;
    let w = world().await;
    let code = format!("CS{}", tag());
    let card = w.rate_card(&[fixed(&code, "12000")]).await;
    let doc = w.staff("doctor").await;
    w.agreement(
        doc.user_id,
        card,
        json!({ "engagement_type": "visiting", "settlement_cycle": "same_day" }),
    )
    .await;
    let bill = w
        .bill(&[json!({ "charge_code": code, "unit_price": "15000", "performing_doctor_id": doc.user_id })])
        .await;
    w.issue(bill).await;
    let today = w.today().await;
    let paid = w
        .ok(
            "POST",
            "/api/doctor-payouts/day/settle",
            json!({ "doctor_id": doc.user_id, "date": today, "mode": "cash" }),
        )
        .await;
    assert!(
        paid["warning"]
            .as_str()
            .is_some_and(|m| m.contains("40A(3)")),
        "{paid}"
    );
    assert_eq!(
        paid["statement"]["status"],
        json!("paid"),
        "a warning, never a block"
    );
}

#[tokio::test]
async fn a_payment_through_collect_earns_the_collected_share() {
    let _g = SERIAL.lock().await;
    let w = world().await;
    let code = format!("CL{}", tag());
    let card = w.rate_card(&[percent(&code, "40")]).await;
    let doc = w.staff("doctor").await;
    w.agreement(doc.user_id, card, json!({ "accrual_basis": "collected" }))
        .await;
    let patient = w.patient().await;
    let bill = w
        .bill_for(
            patient,
            &[json!({ "charge_code": code, "unit_price": "1000", "performing_doctor_id": doc.user_id })],
        )
        .await;
    let (status, done) = w
        .call(
            "POST",
            "/api/billing/collect",
            json!({ "patient_id": patient, "scope": "all", "invoice_ids": [bill],
                    "tenders": [{ "mode": "cash", "amount": "1000" }],
                    "idempotency_key": format!("dp-collect-{}", tag()) }),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{done}");
    assert_eq!(
        w.earned(doc.user_id).await,
        d("400"),
        "collect posts through post_payment"
    );
}
