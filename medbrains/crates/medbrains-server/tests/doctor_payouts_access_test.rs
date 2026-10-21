//! Doctor payouts (#4886): who may see and do what — referral payouts behind
//! their acknowledged switches, every screen's permission, and a doctor's
//! own earnings and nobody else's.

use crate::doctor_payouts_world;

use doctor_payouts_world::{SERIAL, fixed, pay_cash, tag, world};
use reqwest::StatusCode;
use serde_json::json;
use uuid::Uuid;

async fn referral_partner(w: &doctor_payouts_world::World, kind: &str) -> (Uuid, Uuid) {
    let partner: Uuid = sqlx::query_scalar(
        "INSERT INTO lab_referral_doctors (tenant_id, name, hospital_name, commission_pct, partner_kind) \
         VALUES ($1, $2, $3, 10, $4) RETURNING id",
    )
    .bind(w.tenant)
    .bind(format!("Partner {}", tag()))
    .bind(if kind == "organisation" { Some("City Clinic") } else { None })
    .bind(kind)
    .fetch_one(&w.app.db)
    .await
    .expect("partner");
    let patient = w.patient().await;
    let order: Uuid = sqlx::query_scalar(
        "WITH t AS (INSERT INTO lab_test_catalog (tenant_id, code, name) VALUES ($1, $3, 'CBC') RETURNING id), \
              e AS (INSERT INTO encounters (tenant_id, patient_id, encounter_type) VALUES ($1, $2, 'opd') RETURNING id) \
         INSERT INTO lab_orders (tenant_id, encounter_id, patient_id, test_id, ordered_by, referral_doctor_id) \
         SELECT $1, e.id, $2, t.id, (SELECT id FROM users WHERE username = 'admin'), $4 FROM t, e RETURNING id",
    )
    .bind(w.tenant)
    .bind(patient)
    .bind(format!("CBC{}", tag()))
    .bind(partner)
    .fetch_one(&w.app.db)
    .await
    .expect("lab order");
    let bill = w
        .bill_for(patient, &[json!({ "charge_code": "LAB-CBC", "unit_price": "5000", "source": "lab", "source_id": order })])
        .await;
    w.issue(bill).await;
    (partner, order)
}

#[tokio::test]
async fn referral_payouts_stay_off_until_acknowledged_and_organisations_come_first() {
    let _g = SERIAL.lock().await;
    let w = world().await;
    let (org, _) = referral_partner(&w, "organisation").await;
    let (person, _) = referral_partner(&w, "individual").await;
    let today = w.today().await;
    let ask = |partner: Uuid| json!({ "referral_doctor_id": partner, "period_start": "2020-01-01", "period_end": today });

    let (status, _) = w
        .call("POST", "/api/doctor-payouts/referral-statements", ask(org))
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN, "off by default");
    let (status, _) = w
        .call(
            "POST",
            "/api/doctor-payouts/settings/referral",
            json!({ "switch": "referral", "enabled": true }),
        )
        .await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "switching on needs the acknowledgement"
    );
    let settings = w.ok("GET", "/api/doctor-payouts/settings", json!({})).await;
    let ack = settings["acknowledgements"]["referral"]
        .as_str()
        .expect("ack")
        .to_owned();
    w.ok(
        "POST",
        "/api/doctor-payouts/settings/referral",
        json!({ "switch": "referral", "enabled": true, "acknowledgement": ack }),
    )
    .await;
    let audited: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM doctor_payout_policy_events WHERE tenant_id = $1 AND switch = 'referral' AND enabled \
           AND acknowledgement IS NOT NULL",
    )
    .bind(w.tenant)
    .fetch_one(&w.app.db)
    .await
    .expect("events");
    assert!(audited >= 1, "the acknowledgement is recorded");

    let (status, statement) = w
        .call("POST", "/api/doctor-payouts/referral-statements", ask(org))
        .await;
    assert_eq!(status, StatusCode::OK, "{statement}");
    assert_eq!(
        statement["statement"]["incentive_amount"],
        json!("500.00"),
        "10% of 5,000"
    );
    let (status, _) = w
        .call(
            "POST",
            "/api/doctor-payouts/referral-statements",
            ask(person),
        )
        .await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "individual doctors need their own switch"
    );

    let id = statement["statement"]["id"]
        .as_str()
        .expect("id")
        .to_owned();
    let checker = w.approver().await;
    let (status, _) = w
        .as_staff(
            &checker,
            "POST",
            &format!("/api/doctor-payouts/statements/{id}/approve"),
            json!({}),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    pay_cash(&w, &id).await;
    let fy: String =
        sqlx::query_scalar("SELECT financial_year FROM incentive_calculations WHERE id = $1::uuid")
            .bind(&id)
            .fetch_one(&w.app.db)
            .await
            .expect("fy");
    let report = w
        .ok(
            "GET",
            &format!("/api/doctor-payouts/reports/referral-compliance?financial_year={fy}"),
            json!({}),
        )
        .await;
    let listed = report["rows"].as_array().is_some_and(|rows| {
        rows.iter()
            .any(|r| r["statement_id"] == json!(id) && r["status"] == json!("paid"))
    });
    assert!(
        listed,
        "every referral payout is in the compliance report: {report}"
    );
    w.ok(
        "POST",
        "/api/doctor-payouts/settings/referral",
        json!({ "switch": "referral", "enabled": false }),
    )
    .await;
}

#[tokio::test]
async fn every_screen_refuses_a_user_without_its_permission() {
    let _g = SERIAL.lock().await;
    let w = world().await;
    let outsider = w.staff("receptionist").await;
    let today = w.today().await;
    let id = Uuid::new_v4();
    let screens = [
        ("GET", "/api/doctor-payouts/agreements".to_owned()),
        ("GET", "/api/doctor-payouts/rate-cards".to_owned()),
        (
            "GET",
            format!("/api/doctor-payouts/ledger?from=2020-01-01&to={today}"),
        ),
        ("POST", "/api/doctor-payouts/statements".to_owned()),
        (
            "POST",
            format!("/api/doctor-payouts/statements/{id}/approve"),
        ),
        ("GET", "/api/doctor-payouts/payouts".to_owned()),
        (
            "GET",
            format!("/api/doctor-payouts/day?doctor_id={id}&date={today}"),
        ),
        (
            "GET",
            format!("/api/doctor-payouts/reports/summary?from=2020-01-01&to={today}"),
        ),
        ("GET", "/api/doctor-payouts/settings".to_owned()),
        ("GET", "/api/doctor-payouts/me/statements".to_owned()),
    ];
    for (method, path) in &screens {
        let body = json!({ "doctor_id": id, "period_start": "2020-01-01", "period_end": today });
        let (status, _) = w.as_staff(&outsider, method, path, body).await;
        assert_eq!(status, StatusCode::FORBIDDEN, "{method} {path}");
    }
    // A doctor reaches their own earnings and nothing else.
    let doc = w.staff("doctor").await;
    let (status, _) = w
        .as_staff(&doc, "GET", "/api/doctor-payouts/me/statements", json!({}))
        .await;
    assert_eq!(status, StatusCode::OK);
    let (status, _) = w
        .as_staff(&doc, "GET", "/api/doctor-payouts/agreements", json!({}))
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn a_doctor_sees_only_their_own_statements() {
    let _g = SERIAL.lock().await;
    let w = world().await;
    let code = format!("ME{}", tag());
    let card = w.rate_card(&[fixed(&code, "700")]).await;
    let (mine, theirs) = (w.staff("doctor").await, w.staff("doctor").await);
    for doc in [&mine, &theirs] {
        w.agreement(doc.user_id, card, json!({})).await;
        let bill = w
            .bill(&[json!({ "charge_code": code, "unit_price": "900", "performing_doctor_id": doc.user_id })])
            .await;
        w.issue(bill).await;
    }
    let (_, other) = w.prepare(theirs.user_id).await;
    let other_id = other["statement"]["id"].as_str().expect("id").to_owned();
    let (_, own) = w.prepare(mine.user_id).await;
    let own_id = own["statement"]["id"].as_str().expect("id").to_owned();

    let (status, list) = w
        .as_staff(&mine, "GET", "/api/doctor-payouts/me/statements", json!({}))
        .await;
    assert_eq!(status, StatusCode::OK);
    let ids: Vec<&str> = list
        .as_array()
        .map(|a| a.iter().filter_map(|s| s["id"].as_str()).collect())
        .unwrap_or_default();
    assert_eq!(ids, vec![own_id.as_str()]);
    let (status, _) = w
        .as_staff(
            &mine,
            "POST",
            &format!("/api/doctor-payouts/me/statements/{other_id}/dispute"),
            json!({ "reason": "Not my patient" }),
        )
        .await;
    assert_eq!(
        status,
        StatusCode::NOT_FOUND,
        "another doctor's statement does not exist for me"
    );
    let (status, disputed) = w
        .as_staff(
            &mine,
            "POST",
            &format!("/api/doctor-payouts/me/statements/{own_id}/dispute"),
            json!({ "reason": "Missing a follow-up" }),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{disputed}");
    assert_eq!(disputed["status"], json!("disputed"));
}
