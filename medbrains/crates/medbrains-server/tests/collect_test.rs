//! Collect anywhere (#4885): one collection endpoint at every desk.
//!
//! Each test drives the real server and reads the saved rows back: a split
//! tender is one atomic collection, a retry posts nothing, card-machine money
//! is taken over and never posted twice, a desk collects only its own
//! department's bills (the whole request refused otherwise), a draft is
//! issued by collecting it, receipts are split by legal entity with a series
//! each, and the money names its counter, shift and cashier.

mod collect_world;
mod common;
mod payments_world;
mod pos_world;

use axum::http::StatusCode;
use rust_decimal::Decimal;
use serde_json::json;
use uuid::Uuid;

use collect_world::{
    bill, bill_state, collect, collect_body, desk, entity, key, money, patient, payments_in, serial,
};

fn rupees(n: i64) -> Decimal {
    Decimal::from(n)
}

/// Given a ₹500 bill, When the cashier takes ₹300 cash and ₹200 UPI, Then one
/// collection posts both legs and one receipt for ₹500 — and the same request
/// again (a double click, a retry after a timeout) posts nothing more, while
/// the same key on a different request is refused.
#[tokio::test]
async fn a_split_tender_is_one_collection_and_a_retry_posts_nothing() {
    let w = pos_world::world().await;
    let p = patient(&w).await;
    let inv = bill(&w, p, "manual", 500, true).await;
    let k = key();
    let body = collect_body(
        p,
        json!({ "scope": "all", "invoice_ids": [inv] }),
        json!([{ "mode": "cash", "amount": 300 }, { "mode": "upi", "amount": 200, "reference": "UTR-4885" }]),
        &k,
    );
    let (code, first) = collect(&w, body.clone()).await;
    assert_eq!(code, StatusCode::OK, "{first}");
    assert_eq!(first["replayed"], false);
    assert_eq!(payments_in(&w, &first).await, 2);
    assert_eq!(bill_state(&w, inv).await, (rupees(500), "paid".to_owned()));
    let receipts = first["receipts"].as_array().expect("receipts");
    assert_eq!(receipts.len(), 1, "one receipt covers both legs");
    assert_eq!(money(&receipts[0]["amount"]), rupees(500));

    let (code, again) = collect(&w, body.clone()).await;
    assert_eq!(code, StatusCode::OK, "{again}");
    assert_eq!(again["replayed"], true);
    assert_eq!(again["collection_id"], first["collection_id"]);
    assert_eq!(w.payments(inv).await.len(), 2, "the retry posted nothing");

    let mut changed = body;
    changed["tenders"] = json!([{ "mode": "cash", "amount": 100 }]);
    let (code, refused) = collect(&w, changed).await;
    assert_eq!(code, StatusCode::CONFLICT, "{refused}");
}

/// Reprinting one leg of a split gives the collection's receipt, and the
/// printed receipt carries the whole amount and both modes — not the last leg.
#[tokio::test]
async fn the_receipt_of_a_split_covers_every_leg() {
    let w = pos_world::world().await;
    let p = patient(&w).await;
    let inv = bill(&w, p, "manual", 700, true).await;
    let (_, done) = collect(
        &w,
        collect_body(
            p,
            json!({ "scope": "all" }),
            json!([{ "mode": "cash", "amount": 400 }, { "mode": "card", "amount": 300, "reference": "AUTH77" }]),
            &key(),
        ),
    )
    .await;
    let receipt = &done["receipts"][0];
    let last_leg = done["payments"][1]["id"].as_str().expect("leg").to_owned();
    let (code, again) = w
        .call(
            "POST",
            &format!("/api/billing/invoices/{inv}/receipts"),
            json!({ "payment_id": last_leg }),
        )
        .await;
    assert_eq!(code, StatusCode::OK, "{again}");
    assert_eq!(
        again["id"], receipt["id"],
        "no second receipt for money already receipted"
    );

    let anchor = receipt["payment_id"].as_str().expect("anchor");
    let (code, print) = w
        .call(
            "GET",
            &format!("/api/print-data/receipt/{anchor}"),
            json!(null),
        )
        .await;
    assert_eq!(code, StatusCode::OK, "{print}");
    assert_eq!(money(&print["amount"]), rupees(700));
    let modes = print["payment_mode"].as_str().unwrap_or_default();
    assert!(modes.contains("cash") && modes.contains("card"), "{modes}");
}

/// A cash leg and a card payment that is not approved yet: the whole
/// collection is refused and the cash is not posted either.
#[tokio::test]
async fn a_refused_tender_posts_nothing_of_the_collection() {
    let w = pos_world::world().await;
    let p = patient(&w).await;
    let inv = bill(&w, p, "manual", 400, true).await;
    let terminal = pos_world::simulator_machine(&w).await;
    let (_, sale) = pos_world::start(&w, terminal, Some(inv), 300).await;
    let waiting = sale["transaction_id"].as_str().expect("sale");
    let (code, why) = collect(
        &w,
        collect_body(
            p,
            json!({ "scope": "all" }),
            json!([{ "mode": "cash", "amount": 100 }, { "mode": "card", "gateway_transaction_id": waiting }]),
            &key(),
        ),
    )
    .await;
    assert_eq!(code, StatusCode::CONFLICT, "{why}");
    assert!(
        w.payments(inv).await.is_empty(),
        "the cash leg rolled back too"
    );
}

/// Card money the machine already posted is taken over by the collection —
/// never posted a second time — and cannot be counted by another one.
#[tokio::test]
async fn card_machine_money_is_linked_not_posted_again() {
    let w = pos_world::world().await;
    let p = patient(&w).await;
    let inv = bill(&w, p, "manual", 500, true).await;
    let terminal = pos_world::simulator_machine(&w).await;
    let (_, sale) = pos_world::start(&w, terminal, Some(inv), 200).await;
    let sale_id = sale["transaction_id"].as_str().expect("sale").to_owned();
    pos_world::card_does(&w, &sale_id, json!({ "outcome": "approve" })).await;
    // The counter's next look at the sale is what settles it (#4887).
    let approved = pos_world::status(&w, &sale_id).await;
    assert_eq!(approved["stage"], "approved", "{approved}");
    assert_eq!(w.payments(inv).await.len(), 1);

    let tenders = json!([{ "mode": "card", "gateway_transaction_id": sale_id },
                         { "mode": "cash", "amount": 300 }]);
    let (code, done) = collect(
        &w,
        collect_body(p, json!({ "scope": "all" }), tenders.clone(), &key()),
    )
    .await;
    assert_eq!(code, StatusCode::OK, "{done}");
    assert_eq!(
        w.payments(inv).await.len(),
        2,
        "the card was linked, not posted again"
    );
    assert_eq!(payments_in(&w, &done).await, 2);
    assert_eq!(money(&done["total_amount"]), rupees(500));
    assert_eq!(money(&done["receipts"][0]["amount"]), rupees(500));
    assert_eq!(bill_state(&w, inv).await, (rupees(500), "paid".to_owned()));

    let (code, twice) = collect(
        &w,
        collect_body(p, json!({ "scope": "all" }), tenders, &key()),
    )
    .await;
    assert_eq!(code, StatusCode::CONFLICT, "{twice}");
}

/// The lab desk sees every due but may collect only the lab's: the dues say
/// so per bill, "this department" is the lab's figure, and each line names
/// the department that earned it.
#[tokio::test]
async fn dues_break_down_by_department_and_filter_to_the_desk() {
    let w = pos_world::world().await;
    let p = patient(&w).await;
    let lab_bill = bill(&w, p, "lab", 400, true).await;
    let pharmacy_bill = bill(&w, p, "pharmacy", 250, true).await;
    let lab = desk(&w, "lab_technician", &[], &[p]).await;
    let (code, dues) = collect_world::as_staff(
        &w,
        &lab,
        "GET",
        &format!("/api/billing/patients/{p}/dues?lane=lab"),
        json!(null),
    )
    .await;
    assert_eq!(code, StatusCode::OK, "{dues}");
    assert_eq!(money(&dues["total_due"]), rupees(650));
    assert_eq!(money(&dues["collectable_due"]), rupees(400));
    assert_eq!(money(&dues["this_department"]["due"]), rupees(400));
    assert_eq!(dues["this_department"]["can_collect"], true);
    let can = |id: Uuid| {
        dues["bills"]
            .as_array()
            .and_then(|b| b.iter().find(|x| x["invoice_id"] == id.to_string()))
            .map(|x| x["can_collect"].clone())
    };
    assert_eq!(can(lab_bill), Some(json!(true)));
    assert_eq!(can(pharmacy_bill), Some(json!(false)));
    let pathology = collect_world::department(&w, "PATHOLOGY").await;
    let lab_row = dues["by_department"]
        .as_array()
        .and_then(|r| r.iter().find(|x| x["lane"] == "lab"))
        .expect("lab row");
    assert_eq!(money(&lab_row["charged"]), rupees(400));
    assert_eq!(lab_row["department_id"], json!(pathology));
}

/// All dues across lab and pharmacy: the central cashier collects both in
/// one go; a lab-only desk asking for all is refused whole — nothing posted —
/// and may still collect the lab's own bill.
#[tokio::test]
async fn a_cashier_collects_across_departments_a_lab_desk_is_refused_whole() {
    let w = pos_world::world().await;
    let p = patient(&w).await;
    let lab_bill = bill(&w, p, "lab", 400, true).await;
    let pharmacy_bill = bill(&w, p, "pharmacy", 250, true).await;
    let lab = desk(&w, "lab_technician", &[], &[p]).await;
    let all = |amount: i64| {
        collect_body(
            p,
            json!({ "scope": "all" }),
            json!([{ "mode": "cash", "amount": amount }]),
            &key(),
        )
    };
    let (code, why) =
        collect_world::as_staff(&w, &lab, "POST", "/api/billing/collect", all(650)).await;
    assert_eq!(code, StatusCode::FORBIDDEN, "{why}");
    assert!(w.payments(lab_bill).await.is_empty() && w.payments(pharmacy_bill).await.is_empty());

    let cashier = desk(&w, "billing_clerk", &[], &[p]).await;
    let (code, done) =
        collect_world::as_staff(&w, &cashier, "POST", "/api/billing/collect", all(650)).await;
    assert_eq!(code, StatusCode::OK, "{done}");
    assert_eq!(bill_state(&w, lab_bill).await.1, "paid");
    assert_eq!(bill_state(&w, pharmacy_bill).await.1, "paid");

    let q = patient(&w).await;
    let own = bill(&w, q, "lab", 300, true).await;
    bill(&w, q, "pharmacy", 90, true).await;
    collect_world::grant_view(&w, &lab, q).await;
    let (code, done) = collect_world::as_staff(
        &w,
        &lab,
        "POST",
        "/api/billing/collect",
        collect_body(
            q,
            json!({ "scope": "department", "lane": "lab" }),
            json!([{ "mode": "cash", "amount": 300 }]),
            &key(),
        ),
    )
    .await;
    assert_eq!(code, StatusCode::OK, "{done}");
    assert_eq!(bill_state(&w, own).await.1, "paid");
}

/// Collecting a draft issues it: nobody has to find and issue the bill first.
#[tokio::test]
async fn a_draft_is_issued_by_collecting_it() {
    let w = pos_world::world().await;
    let p = patient(&w).await;
    let draft = bill(&w, p, "opd", 300, false).await;
    let (code, done) = collect(
        &w,
        collect_body(
            p,
            json!({ "scope": "all" }),
            json!([{ "mode": "cash", "amount": 300 }]),
            &key(),
        ),
    )
    .await;
    assert_eq!(code, StatusCode::OK, "{done}");
    assert_eq!(done["issued_invoice_ids"], json!([draft]));
    assert_eq!(
        bill_state(&w, draft).await,
        (rupees(300), "paid".to_owned())
    );
    let issued: bool =
        sqlx::query_scalar("SELECT issued_at IS NOT NULL FROM invoices WHERE id = $1")
            .bind(draft)
            .fetch_one(&w.app.db)
            .await
            .expect("issued");
    assert!(issued);
}

/// A hospital bill and a pharmacy bill under the pharmacy's own GSTIN: one
/// collection, one receipt per entity, each from its own series — the next
/// pharmacy receipt is the next number in the pharmacy's series.
#[tokio::test]
async fn receipts_split_by_legal_entity_each_with_its_own_series() {
    let w = pos_world::world().await;
    let (pharmacy, prefix) = entity(&w).await;
    let on_pharmacy = |inv: Uuid| {
        // As the pharmacy lane bills it (lane routing: collect_fees_test).
        sqlx::query("UPDATE invoices SET legal_entity_id = $2 WHERE id = $1")
            .bind(inv)
            .bind(pharmacy)
            .execute(&w.app.db)
    };
    let p = patient(&w).await;
    bill(&w, p, "manual", 200, true).await;
    on_pharmacy(bill(&w, p, "pharmacy", 150, true).await)
        .await
        .expect("entity");
    let (code, done) = collect(
        &w,
        collect_body(
            p,
            json!({ "scope": "all" }),
            json!([{ "mode": "cash", "amount": 350 }]),
            &key(),
        ),
    )
    .await;
    assert_eq!(code, StatusCode::OK, "{done}");
    let receipts = done["receipts"].as_array().expect("receipts");
    assert_eq!(receipts.len(), 2);
    let ours = receipts
        .iter()
        .find(|r| r["legal_entity_id"] == pharmacy.to_string())
        .expect("pharmacy receipt");
    let number = ours["receipt_number"].as_str().expect("number");
    assert!(number.starts_with(&format!("{prefix}/")), "{number}");
    assert_eq!(money(&ours["amount"]), rupees(150));
    let hospital = receipts
        .iter()
        .find(|r| r != &ours)
        .expect("hospital receipt");
    assert!(
        !hospital["receipt_number"]
            .as_str()
            .unwrap_or_default()
            .starts_with(&prefix)
    );
    assert_eq!(money(&hospital["amount"]), rupees(200));

    let q = patient(&w).await;
    on_pharmacy(bill(&w, q, "pharmacy", 60, true).await)
        .await
        .expect("entity");
    let (_, next) = collect(
        &w,
        collect_body(
            q,
            json!({ "scope": "all" }),
            json!([{ "mode": "cash", "amount": 60 }]),
            &key(),
        ),
    )
    .await;
    let next_number = next["receipts"][0]["receipt_number"]
        .as_str()
        .expect("number");
    assert!(
        next_number.starts_with(&format!("{prefix}/")),
        "{next_number}"
    );
    assert_eq!(
        serial(next_number),
        serial(number) + 1,
        "gapless per entity"
    );
}

/// The money names where it was taken: counter, shift and cashier, on the
/// collection and on every payment. An unknown counter is refused.
#[tokio::test]
async fn a_collection_is_attributed_to_its_counter_shift_and_cashier() {
    let w = pos_world::world().await;
    let station = pos_world::counter(&w).await;
    let shift: Uuid = sqlx::query_scalar(
        "INSERT INTO shift_definitions (tenant_id, code, name, start_time, end_time) \
         VALUES ($1, $2, 'Collect test shift', '00:00', '23:59') RETURNING id",
    )
    .bind(w.tenant)
    .bind(format!("CL{}", pos_world::tag()))
    .fetch_one(&w.app.db)
    .await
    .expect("shift");
    let p = patient(&w).await;
    bill(&w, p, "manual", 120, true).await;
    let mut body = collect_body(
        p,
        json!({ "scope": "all" }),
        json!([{ "mode": "cash", "amount": 120 }]),
        &key(),
    );
    body["station_id"] = json!(station);
    body["shift_id"] = json!(shift);
    body["counter_id"] = json!("OPD-1");
    let (code, done) = collect(&w, body.clone()).await;
    assert_eq!(code, StatusCode::OK, "{done}");
    let id: Uuid = done["collection_id"]
        .as_str()
        .expect("id")
        .parse()
        .expect("uuid");
    let rows: Vec<(Option<Uuid>, Option<Uuid>, Option<String>, bool)> = sqlx::query_as(
        "SELECT p.station_id, p.shift_id, p.counter_id, p.received_by = c.collected_by \
           FROM payments p JOIN collections c ON c.id = p.collection_id WHERE c.id = $1",
    )
    .bind(id)
    .fetch_all(&w.app.db)
    .await
    .expect("rows");
    assert_eq!(
        rows,
        vec![(Some(station), Some(shift), Some("OPD-1".to_owned()), true)]
    );

    body["idempotency_key"] = json!(key());
    body["station_id"] = json!(Uuid::new_v4());
    let (code, refused) = collect(&w, body).await;
    assert_eq!(code, StatusCode::BAD_REQUEST, "{refused}");
}
