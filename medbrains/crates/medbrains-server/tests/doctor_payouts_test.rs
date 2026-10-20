//! Doctor payouts (#4886), end to end through the API: how a doctor's share
//! is priced, when it is earned, how it is reversed, and how a statement is
//! approved (by someone else) and paid with TDS.

mod common;
mod doctor_payouts_world;

use doctor_payouts_world::{SERIAL, d, fixed, pan, pay_cash, percent, tag, world};
use reqwest::StatusCode;
use serde_json::json;
use uuid::Uuid;

#[tokio::test]
async fn fixed_and_percentage_rates_price_each_line() {
    let _g = SERIAL.lock().await;
    let w = world().await;
    let doc = w.staff("doctor").await;
    let (fx, pc) = (format!("FX{}", tag()), format!("PC{}", tag()));
    let card = w.rate_card(&[fixed(&fx, "300"), percent(&pc, "40")]).await;
    w.agreement(doc.user_id, card, json!({})).await;
    let bill = w
        .bill(&[
            json!({ "charge_code": fx, "unit_price": "1000", "performing_doctor_id": doc.user_id }),
            json!({ "charge_code": pc, "unit_price": "2000", "performing_doctor_id": doc.user_id }),
        ])
        .await;
    assert!(
        w.ledger(doc.user_id).await.is_empty(),
        "a draft bill earns nothing"
    );
    w.issue(bill).await;
    let rows = w.ledger(doc.user_id).await;
    let mut amounts: Vec<_> = rows.iter().map(|r| r.2).collect();
    amounts.sort();
    assert_eq!(amounts, vec![d("300"), d("800")]);
    assert!(rows.iter().all(|r| r.0 == "billed"));
}

#[tokio::test]
async fn share_on_gross_versus_net_of_a_discount() {
    let _g = SERIAL.lock().await;
    let w = world().await;
    let code = format!("CN{}", tag());
    let card = w.rate_card(&[percent(&code, "50")]).await;
    let (gross_doc, net_doc) = (w.staff("doctor").await, w.staff("doctor").await);
    w.agreement(gross_doc.user_id, card, json!({ "share_on": "gross" }))
        .await;
    w.agreement(net_doc.user_id, card, json!({ "share_on": "net" }))
        .await;
    for doc in [&gross_doc, &net_doc] {
        let bill = w
            .bill(&[json!({ "charge_code": code, "unit_price": "1000", "performing_doctor_id": doc.user_id })])
            .await;
        sqlx::query("UPDATE invoice_items SET discount_amount = 200 WHERE invoice_id = $1")
            .bind(bill)
            .execute(&w.app.db)
            .await
            .expect("discount");
        w.issue(bill).await;
    }
    assert_eq!(
        w.earned(gross_doc.user_id).await,
        d("500"),
        "the hospital absorbs the discount"
    );
    assert_eq!(
        w.earned(net_doc.user_id).await,
        d("400"),
        "shared on the net"
    );
}

#[tokio::test]
async fn billed_collected_and_insurer_realised_bases() {
    let _g = SERIAL.lock().await;
    let w = world().await;
    let code = format!("BS{}", tag());
    let card = w.rate_card(&[percent(&code, "40")]).await;
    let (billed, collected, realised) = (
        w.staff("doctor").await,
        w.staff("doctor").await,
        w.staff("doctor").await,
    );
    w.agreement(billed.user_id, card, json!({ "accrual_basis": "billed" }))
        .await;
    w.agreement(
        collected.user_id,
        card,
        json!({ "accrual_basis": "collected" }),
    )
    .await;
    w.agreement(
        realised.user_id,
        card,
        json!({ "accrual_basis": "realised" }),
    )
    .await;
    let line = |doc: Uuid, price: &str| json!({ "charge_code": code, "unit_price": price, "performing_doctor_id": doc });

    let b = w.bill(&[line(billed.user_id, "1000")]).await;
    w.issue(b).await;
    assert_eq!(w.earned(billed.user_id).await, d("400"));

    let c = w.bill(&[line(collected.user_id, "1000")]).await;
    w.issue(c).await;
    assert_eq!(
        w.earned(collected.user_id).await,
        d("0"),
        "nothing until the patient pays"
    );
    w.pay(c, "250").await;
    assert_eq!(
        w.earned(collected.user_id).await,
        d("100"),
        "a quarter paid, a quarter earned"
    );
    w.pay(c, "750").await;
    assert_eq!(w.earned(collected.user_id).await, d("400"));

    // A TPA bill: nothing until the insurer settles, then cut pro rata to
    // what it paid (8,000 of 10,000 claimed).
    let patient = w.patient().await;
    let r = w
        .bill_for(patient, &[line(realised.user_id, "10000")])
        .await;
    w.issue(r).await;
    let claim: Uuid = sqlx::query_scalar(
        "INSERT INTO insurance_claims (tenant_id, invoice_id, patient_id, insurance_provider, claim_type, \
         status, claim_amount, scheme_type) \
         VALUES ($1, $2, $3, 'Star Health', 'cashless', 'claim_submitted', 10000, 'private') RETURNING id",
    )
    .bind(w.tenant)
    .bind(r)
    .bind(patient)
    .fetch_one(&w.app.db)
    .await
    .expect("claim");
    assert_eq!(w.earned(realised.user_id).await, d("0"));
    w.ok(
        "PUT",
        &format!("/api/billing/insurance-claims/{claim}"),
        json!({ "status": "partially_settled", "approved_amount": "10000", "settled_amount": "8000" }),
    )
    .await;
    assert_eq!(
        w.earned(realised.user_id).await,
        d("3200"),
        "40% of 10,000 cut to 80%"
    );
    let payer: String =
        sqlx::query_scalar("SELECT payer_class FROM doctor_payout_accruals WHERE doctor_id = $1")
            .bind(realised.user_id)
            .fetch_one(&w.app.db)
            .await
            .expect("payer");
    assert_eq!(payer, "tpa");
}

#[tokio::test]
async fn the_performing_doctor_is_credited_not_the_ordering_one() {
    let _g = SERIAL.lock().await;
    let w = world().await;
    let code = format!("PF{}", tag());
    let card = w.rate_card(&[percent(&code, "50")]).await;
    let (orderer, performer) = (w.staff("doctor").await, w.staff("doctor").await);
    w.agreement(orderer.user_id, card, json!({})).await;
    w.agreement(performer.user_id, card, json!({})).await;
    let bill = w
        .bill(&[json!({ "charge_code": code, "unit_price": "600",
                        "ordering_doctor_id": orderer.user_id, "performing_doctor_id": performer.user_id })])
        .await;
    w.issue(bill).await;
    assert_eq!(w.earned(performer.user_id).await, d("300"));
    assert!(
        w.ledger(orderer.user_id).await.is_empty(),
        "ordering earns nothing"
    );
}

#[tokio::test]
async fn a_refund_appends_a_reversal_and_the_ledger_cannot_be_edited() {
    let _g = SERIAL.lock().await;
    let w = world().await;
    let code = format!("RF{}", tag());
    let card = w.rate_card(&[percent(&code, "40")]).await;
    let doc = w.staff("doctor").await;
    w.agreement(doc.user_id, card, json!({ "accrual_basis": "collected" }))
        .await;
    let bill = w
        .bill(&[json!({ "charge_code": code, "unit_price": "1000", "performing_doctor_id": doc.user_id })])
        .await;
    w.issue(bill).await;
    w.pay(bill, "1000").await;
    assert_eq!(w.earned(doc.user_id).await, d("400"));
    w.ok(
        "POST",
        "/api/billing/refunds",
        json!({ "invoice_id": bill, "amount": "500", "reason": "Procedure not done", "mode": "cash" }),
    )
    .await;
    let rows = w.ledger(doc.user_id).await;
    assert_eq!(
        rows.len(),
        2,
        "the original row stays; a reversal is appended"
    );
    assert_eq!((rows[1].0.as_str(), rows[1].2), ("reversal", d("-200")));
    let edit = sqlx::query("UPDATE doctor_payout_accruals SET amount = 0 WHERE doctor_id = $1")
        .bind(doc.user_id)
        .execute(&w.app.db)
        .await;
    assert!(edit.is_err(), "the ledger is append-only");
}

#[tokio::test]
async fn a_surgery_package_splits_across_the_team_and_excludes_implants() {
    let _g = SERIAL.lock().await;
    let w = world().await;
    let (pkg, implant) = (format!("PKG{}", tag()), format!("IMP{}", tag()));
    for (code, category) in [(&pkg, "package"), (&implant, "implant")] {
        sqlx::query(
            "INSERT INTO charge_master (tenant_id, code, name, category, base_price) VALUES ($1, $2, $2, $3, 0)",
        )
        .bind(w.tenant)
        .bind(code)
        .bind(category)
        .execute(&w.app.db)
        .await
        .expect("charge");
    }
    let rule = |role: &str, pct: &str| json!({ "rule_name": role, "category": "package", "role": role, "calc_kind": "percent", "percentage": pct });
    let card = w
        .rate_card(&[
            rule("primary", "30"),
            rule("assistant", "10"),
            rule("anaesthetist", "15"),
            json!({ "rule_name": "anything else", "role": "primary", "calc_kind": "percent", "percentage": "20" }),
        ])
        .await;
    let (surgeon, assistant, anaesthetist) = (
        w.staff("doctor").await,
        w.staff("doctor").await,
        w.staff("doctor").await,
    );
    for doc in [&surgeon, &assistant, &anaesthetist] {
        w.agreement(doc.user_id, card, json!({})).await;
    }
    let patient = w.patient().await;
    let booking: Uuid = sqlx::query_scalar(
        "WITH room AS (INSERT INTO ot_rooms (tenant_id, name, code) VALUES ($1, 'OT 1', $5) RETURNING id) \
         INSERT INTO ot_bookings (tenant_id, patient_id, ot_room_id, primary_surgeon_id, anesthetist_id, \
           assistant_surgeons, scheduled_date, scheduled_start, scheduled_end, procedure_name) \
         SELECT $1, $2, room.id, $3, $4, $6, CURRENT_DATE, now(), now() + interval '2 hours', 'TKR' FROM room \
         RETURNING id",
    )
    .bind(w.tenant)
    .bind(patient)
    .bind(surgeon.user_id)
    .bind(anaesthetist.user_id)
    .bind(format!("OT{}", tag()))
    .bind(json!([assistant.user_id.to_string(), "Dr Visiting (no account)"]))
    .fetch_one(&w.app.db)
    .await
    .expect("booking");
    let bill = w
        .bill_for(
            patient,
            &[
                json!({ "charge_code": pkg, "unit_price": "100000", "source": "ot", "source_id": booking }),
                json!({ "charge_code": implant, "unit_price": "40000", "source": "ot", "source_id": booking }),
            ],
        )
        .await;
    let filled: Option<Uuid> = sqlx::query_scalar(
        "SELECT performing_doctor_id FROM invoice_items WHERE invoice_id = $1 AND charge_code = $2",
    )
    .bind(bill)
    .bind(&pkg)
    .fetch_one(&w.app.db)
    .await
    .expect("line");
    assert_eq!(
        filled,
        Some(surgeon.user_id),
        "the charge path names the surgeon"
    );
    w.issue(bill).await;
    assert_eq!(w.earned(surgeon.user_id).await, d("30000"));
    assert_eq!(w.earned(assistant.user_id).await, d("10000"));
    assert_eq!(w.earned(anaesthetist.user_id).await, d("15000"));
    assert!(
        w.ledger(surgeon.user_id)
            .await
            .iter()
            .all(|r| r.1 == "primary")
    );

    let over = w
        .call(
            "POST",
            &format!("/api/doctor-payouts/rate-cards/{card}/rules"),
            json!({ "rule_name": "too much", "category": "package", "role": "assistant",
                    "calc_kind": "percent", "percentage": "50" }),
        )
        .await;
    assert_eq!(
        over.0,
        StatusCode::CONFLICT,
        "the card is frozen once used: {}",
        over.1
    );
}

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
