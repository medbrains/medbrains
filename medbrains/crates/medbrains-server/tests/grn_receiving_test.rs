//! Receiving a supplier bill (#4861): a GRN is a draft until it is posted,
//! posting moves stock exactly once, two batches of one drug keep their own
//! trace, one supplier invoice is entered once, and a bill that does not add
//! up — or carries a near-expiry batch, or MRP below rate — is refused.

mod common;
mod grn_world;

use grn_world::{user, world};
use reqwest::StatusCode;
use serde_json::json;
use uuid::Uuid;

/// Given a GRN saved for 10 + 1 free of a drug, When it is saved, Then no
/// stock and no PO quantity moved; When it is posted, Then 11 enter stock and
/// the PO shows 10 received; When posted again, Then 409 and nothing moves.
#[tokio::test]
async fn a_draft_moves_nothing_and_posting_moves_stock_once() {
    let w = world().await;
    let before = w.pharmacy_stock(0).await;
    let body = w.grn(
        &format!("INV-A{}", w.tag),
        "2026-10-01",
        vec![w.line(0, "BA1")],
    );
    let (status, grn) = w.call("POST", "/api/procurement/grns", body).await;
    assert_eq!(status, StatusCode::OK, "{grn}");
    let id = grn["grn"]["id"].as_str().expect("grn id");
    assert!(grn["grn"]["posted_at"].is_null(), "a new GRN is a draft");
    assert_eq!(w.pharmacy_stock(0).await, before, "a draft moves no stock");
    assert_eq!(w.po_received(0).await, 0, "nor PO quantities");
    assert_eq!(w.batches_on(id).await, 0);

    let path = format!("/api/procurement/grns/{id}/complete");
    let (status, posted) = w.call("PUT", &path, json!({})).await;
    assert_eq!(status, StatusCode::OK, "{posted}");
    assert!(posted["posted_at"].is_string());
    assert_eq!(
        w.pharmacy_stock(0).await,
        before + 11,
        "billed plus free goods"
    );
    assert_eq!(
        w.po_received(0).await,
        10,
        "free goods are not billed against the PO"
    );

    let (status, again) = w.call("PUT", &path, json!({})).await;
    assert_eq!(status, StatusCode::CONFLICT, "{again}");
    assert_eq!(
        w.pharmacy_stock(0).await,
        before + 11,
        "a second post moves nothing"
    );
    assert_eq!(w.batches_on(id).await, 1);
}

/// Given one bill with two batches of the same drug, When it is posted, Then
/// each line points at its own pharmacy batch and batch-stock row, each
/// batch points back at its line, and each carries the line's MRP.
#[tokio::test]
async fn two_batches_of_one_drug_keep_their_own_links() {
    let w = world().await;
    let mut second = w.line(0, "BB2");
    second["mrp"] = json!("32");
    let body = w.grn(
        &format!("INV-B{}", w.tag),
        "2026-10-01",
        vec![w.line(0, "BB1"), second],
    );
    let (status, grn) = w.call("POST", "/api/procurement/grns", body).await;
    assert_eq!(status, StatusCode::OK, "{grn}");
    let id = grn["grn"]["id"].as_str().expect("grn id");
    let (status, _) = w
        .call(
            "PUT",
            &format!("/api/procurement/grns/{id}/complete"),
            json!({}),
        )
        .await;
    assert_eq!(status, StatusCode::OK);

    let rows: Vec<(String, Option<Uuid>, Option<Uuid>, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT gi.batch_number, gi.pharmacy_batch_id, gi.batch_stock_id, pb.batch_number, pb.mrp::text \
           FROM grn_items gi \
           LEFT JOIN pharmacy_batches pb ON pb.id = gi.pharmacy_batch_id AND pb.grn_item_id = gi.id \
          WHERE gi.grn_id = $1::uuid ORDER BY gi.batch_number",
    )
    .bind(id)
    .fetch_all(&w.app.db)
    .await
    .expect("lines");
    assert_eq!(rows.len(), 2);
    for (line_batch, pharmacy_batch, stock_row, batch_on_shelf, _) in &rows {
        assert!(
            pharmacy_batch.is_some() && stock_row.is_some(),
            "{line_batch} is linked"
        );
        assert_eq!(
            batch_on_shelf.as_deref(),
            Some(line_batch.as_str()),
            "its own batch"
        );
    }
    assert_ne!(rows[0].1, rows[1].1, "two lines, two pharmacy batches");
    assert_ne!(rows[0].2, rows[1].2, "two lines, two batch-stock rows");
    assert_eq!(rows[0].4.as_deref(), Some("30.00"));
    assert_eq!(rows[1].4.as_deref(), Some("32.00"), "MRP is per batch");
}

/// Given INV/0045 of 1 Oct entered, When "inv-45" of 1 Oct is entered for the
/// same supplier, Then 409 naming the first GRN; the same number on another
/// date is a different bill. And an e-invoice IRN is entered once.
#[tokio::test]
async fn the_same_supplier_invoice_is_entered_once() {
    let w = world().await;
    let first = w.grn(
        &format!("INV/{}/0045", w.tag),
        "2026-10-01",
        vec![w.line(0, "BC1")],
    );
    let (status, grn) = w.call("POST", "/api/procurement/grns", first).await;
    assert_eq!(status, StatusCode::OK, "{grn}");
    let number = grn["grn"]["grn_number"]
        .as_str()
        .expect("number")
        .to_owned();

    let again = w.grn(
        &format!("inv-{}-45", w.tag.to_lowercase()),
        "2026-10-01",
        vec![w.line(0, "BC2")],
    );
    let (status, refused) = w.call("POST", "/api/procurement/grns", again).await;
    assert_eq!(status, StatusCode::CONFLICT, "{refused}");
    assert!(
        refused["detail"]
            .as_str()
            .unwrap_or_default()
            .contains(&number),
        "{refused}"
    );

    let other_day = w.grn(
        &format!("INV/{}/0045", w.tag),
        "2026-10-02",
        vec![w.line(0, "BC3")],
    );
    assert_eq!(
        w.call("POST", "/api/procurement/grns", other_day).await.0,
        StatusCode::OK
    );

    let irn = format!(
        "{:0>64}",
        w.tag
            .to_lowercase()
            .replace(|c: char| !c.is_ascii_hexdigit(), "a")
    );
    let mut with_irn = w.grn(
        &format!("E-{}", w.tag),
        "2026-10-03",
        vec![w.line(1, "BC4")],
    );
    with_irn["irn"] = json!(irn);
    assert_eq!(
        w.call("POST", "/api/procurement/grns", with_irn.clone())
            .await
            .0,
        StatusCode::OK
    );
    with_irn["invoice_number"] = json!(format!("F-{}", w.tag));
    let (status, refused) = w.call("POST", "/api/procurement/grns", with_irn).await;
    assert_eq!(
        status,
        StatusCode::CONFLICT,
        "the IRN is the bill: {refused}"
    );
}

/// Given lines with MRP below rate, a batch expiring inside the shelf-life
/// floor, or a bill total its lines do not add up to, Then each is refused
/// on the field at fault; a GST rate that differs from the catalogue's for
/// the HSN is saved with a warning.
#[tokio::test]
async fn bills_that_fail_the_receiving_checks_are_refused() {
    let w = world().await;
    let post = |body| w.call("POST", "/api/procurement/grns", body);
    let field = |v: &serde_json::Value, f: &str| v["fields"][f].is_array();

    let mut swapped = w.line(0, "BD1");
    swapped["mrp"] = json!("15");
    let (status, body) = post(w.grn(&format!("D1{}", w.tag), "2026-10-01", vec![swapped])).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{body}");
    assert!(field(&body, "items[0].mrp"), "{body}");

    let mut near = w.line(0, "BD2");
    near["expiry_date"] = json!(
        (chrono::Utc::now() + chrono::Duration::days(60))
            .format("%Y-%m-%d")
            .to_string()
    );
    let (status, body) = post(w.grn(&format!("D2{}", w.tag), "2026-10-01", vec![near])).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{body}");
    assert!(field(&body, "items[0].expiry_date"), "{body}");

    let mut short = w.grn(
        &format!("D3{}", w.tag),
        "2026-10-01",
        vec![w.line(0, "BD3")],
    );
    short["invoice_amount"] = json!("250.00");
    let (status, body) = post(short).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{body}");
    assert!(field(&body, "invoice_amount"), "{body}");

    let mut old_rate = w.line(0, "BD4");
    old_rate["gst_rate"] = json!("12");
    let mut bill = w.grn(&format!("D4{}", w.tag), "2026-10-01", vec![old_rate]);
    bill["invoice_amount"] = json!("224.00");
    let (status, body) = post(bill).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["warnings"][0]["field"], "items[0].gst_rate", "{body}");
}

/// Given one posted GRN and one draft for a supplier, When the vendor ledger
/// is read, Then it answers and owes the supplier for the posted one only.
#[tokio::test]
async fn the_vendor_ledger_reads_posted_grns() {
    let w = world().await;
    let (_, posted) = w
        .call(
            "POST",
            "/api/procurement/grns",
            w.grn(
                &format!("L1{}", w.tag),
                "2026-10-01",
                vec![w.line(0, "BL1")],
            ),
        )
        .await;
    let id = posted["grn"]["id"].as_str().expect("id");
    w.call(
        "PUT",
        &format!("/api/procurement/grns/{id}/complete"),
        json!({}),
    )
    .await;
    w.call(
        "POST",
        "/api/procurement/grns",
        w.grn(
            &format!("L2{}", w.tag),
            "2026-10-01",
            vec![w.line(1, "BL2")],
        ),
    )
    .await;

    let (status, ledger) = w
        .call(
            "GET",
            &format!("/api/procurement/vendors/{}/ledger", w.vendor),
            json!(null),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{ledger}");
    let entries = ledger["entries"].as_array().expect("entries");
    assert_eq!(entries.len(), 1, "the draft is not yet owed: {ledger}");
    assert_eq!(ledger["total_purchases"], "210.00");
}

/// Given a store keeper without `procurement.grn.post`, When they save a GRN
/// it is a draft; When they post it, Then 403 and no stock moves.
#[tokio::test]
async fn posting_needs_its_own_permission() {
    let w = world().await;
    let clerk = user(
        &w.app,
        &w.csrf,
        "store_keeper",
        &[],
        &["procurement.grn.post"],
    )
    .await;
    let me = (&clerk.client, clerk.csrf.as_str());
    let body = w.grn(
        &format!("P1{}", w.tag),
        "2026-10-01",
        vec![w.line(0, "BP1")],
    );
    let (status, grn) = grn_world::send(me, &w.app, "POST", "/api/procurement/grns", body).await;
    assert_eq!(status, StatusCode::OK, "{grn}");
    let before = w.pharmacy_stock(0).await;
    let id = grn["grn"]["id"].as_str().expect("id");
    let (status, _) = grn_world::send(
        me,
        &w.app,
        "PUT",
        &format!("/api/procurement/grns/{id}/complete"),
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(w.pharmacy_stock(0).await, before);
}
