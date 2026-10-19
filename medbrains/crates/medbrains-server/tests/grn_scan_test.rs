//! Scanning a supplier bill into a GRN (#4861). The bill reader is a mock:
//! an HTTP client holding the reader's machine permission, posting what a
//! real reader would. Nothing posts stock until a person commits, a corrected
//! field is kept as original-vs-final, a confirmed item match is remembered
//! for the supplier's next bill, and one bill is entered once.

mod common;
mod grn_world;

use grn_world::{User, World, parse_result, send, user, world};
use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

const WORKER: &str = "procurement.grn.scan_worker";

fn me(u: &User) -> (&reqwest::Client, &str) {
    (&u.client, u.csrf.as_str())
}

/// Upload a bill (as a new file) and return the scan id.
async fn upload(w: &World, keeper: &User) -> String {
    let sha = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
    let (status, scan) = send(
        me(keeper),
        &w.app,
        "POST",
        "/api/procurement/grn-scans",
        json!({
            "file_key": format!("{}/purchase_bill/{}.jpg", w.tenant, Uuid::new_v4()),
            "file_sha256": sha, "mime_type": "image/jpeg",
        }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{scan}");
    assert_eq!(
        scan["status"], "parsing",
        "an upload is queued for the reader"
    );
    scan["id"].as_str().expect("scan id").to_owned()
}

/// The mock reader: claim the queued bill and post what it read.
async fn read(w: &World, reader: &User, id: &str, payload: Value) {
    // Named, so tests sharing the hospital never take each other's bills.
    let (status, claimed) = send(
        me(reader),
        &w.app,
        "POST",
        "/api/procurement/grn-scans/claim",
        json!({ "scan_id": id }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{claimed}");
    assert_eq!(
        claimed["scan"]["id"], id,
        "the reader takes the queued bill"
    );
    assert!(claimed["lease_until"].is_string());
    let path = format!("/api/procurement/grn-scans/{id}/parse-result");
    let (status, parsed) = send(me(reader), &w.app, "POST", &path, payload).await;
    assert_eq!(status, StatusCode::OK, "{parsed}");
    assert_eq!(parsed["status"], "parsed");
}

/// The reviewer's corrections: PO, store, each line's item, one batch fixed.
fn corrected(w: &World, review: &Value, items: &[usize]) -> Value {
    let mut draft = review["draft"].clone();
    draft["header"]["po_id"] = json!(w.po);
    draft["header"]["store_location_id"] = json!(w.store);
    for (n, i) in items.iter().enumerate() {
        draft["lines"][n]["catalog_item_id"] = json!(w.drugs[*i].store_id);
    }
    draft["lines"][0]["batch_number"] = json!("ZB12");
    draft
}

async fn review(w: &World, keeper: &User, id: &str) -> Value {
    let (status, r) = send(
        me(keeper),
        &w.app,
        "GET",
        &format!("/api/procurement/grn-scans/{id}/review"),
        json!(null),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{r}");
    r
}

/// Given a two-line bill read by the reader (one batch read at 62%), When the
/// store keeper reviews it, Then each line has catalogue suggestions and the
/// draft moved no stock; When they correct a batch, match the items and
/// commit, Then the GRN posts once, stock rises once, the correction is kept,
/// and a second commit is refused with stock unchanged.
#[tokio::test]
async fn a_scanned_bill_is_reviewed_corrected_and_posts_stock_once() {
    let w = world().await;
    let keeper = user(&w.app, &w.csrf, "store_keeper", &[], &[]).await;
    let reader = user(&w.app, &w.csrf, "staff", &[WORKER], &[]).await;
    let id = upload(&w, &keeper).await;
    let invoice = format!("SB/{}/101", w.tag);
    let lines = [
        (w.drugs[0].name.to_uppercase(), "Z812", 10),
        (w.drugs[1].name.to_uppercase(), "Q77", 10),
    ];
    let lines: Vec<(&str, &str, i32)> =
        lines.iter().map(|(n, b, q)| (n.as_str(), *b, *q)).collect();
    read(&w, &reader, &id, parse_result(&w.gstin, &invoice, &lines)).await;

    let r = review(&w, &keeper, &id).await;
    assert_eq!(
        r["draft"]["header"]["vendor_id"],
        json!(w.vendor),
        "matched on GSTIN"
    );
    assert_eq!(
        r["draft"]["confidence"]["lines[0].batch_number"],
        json!(0.62)
    );
    let suggested: Vec<&Value> = r["suggestions"]
        .as_array()
        .expect("suggestions")
        .iter()
        .filter(|s| s["line"] == 0)
        .map(|s| &s["catalog_item_id"])
        .collect();
    assert!(suggested.contains(&&json!(w.drugs[0].store_id)), "{r}");
    let before = (w.pharmacy_stock(0).await, w.pharmacy_stock(1).await);

    let draft = corrected(&w, &r, &[0, 1]);
    let (status, saved) = send(
        me(&keeper),
        &w.app,
        "PUT",
        &format!("/api/procurement/grn-scans/{id}/draft"),
        draft,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{saved}");
    assert_eq!(
        w.pharmacy_stock(0).await,
        before.0,
        "a reviewed draft moves no stock"
    );

    let commit = format!("/api/procurement/grn-scans/{id}/commit");
    let (status, grn) = send(me(&keeper), &w.app, "POST", &commit, json!({})).await;
    assert_eq!(status, StatusCode::OK, "{grn}");
    assert!(grn["grn"]["posted_at"].is_string(), "commit posts the GRN");
    assert_eq!(grn["items"][0]["batch_number"], "ZB12");
    assert_eq!(
        (w.pharmacy_stock(0).await, w.pharmacy_stock(1).await),
        (before.0 + 10, before.1 + 10)
    );

    let (status, _) = send(me(&keeper), &w.app, "POST", &commit, json!({})).await;
    assert_eq!(
        status,
        StatusCode::CONFLICT,
        "a committed scan does not commit twice"
    );
    assert_eq!(
        w.pharmacy_stock(0).await,
        before.0 + 10,
        "stock moved exactly once"
    );

    let kept: Vec<(String, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT field_path, original_value, final_value FROM grn_scan_corrections WHERE scan_id = $1::uuid",
    )
    .bind(&id)
    .fetch_all(&w.app.db)
    .await
    .expect("corrections");
    assert_eq!(
        kept,
        vec![(
            "lines[0].batch_number".into(),
            Some("Z812".into()),
            Some("ZB12".into())
        )]
    );
    let raw: Value =
        sqlx::query_scalar("SELECT extracted_json FROM purchase_bill_scans WHERE id = $1::uuid")
            .bind(&id)
            .fetch_one(&w.app.db)
            .await
            .expect("extraction");
    assert_eq!(
        raw["lines"][0]["batch_number"]["value"], "Z812",
        "what was read is never overwritten"
    );
}

/// Given a bill already committed, When the same file is uploaded again, Then
/// 409; When a different photo of the same invoice is read, Then the review
/// names the GRN and committing it is refused with 409.
#[tokio::test]
async fn the_same_bill_is_refused_by_file_and_by_invoice() {
    let w = world().await;
    let keeper = user(&w.app, &w.csrf, "store_keeper", &[], &[]).await;
    let reader = user(&w.app, &w.csrf, "staff", &[WORKER], &[]).await;
    let invoice = format!("SD/{}/7", w.tag);
    let name = w.drugs[0].name.clone();
    let first = upload(&w, &keeper).await;
    read(
        &w,
        &reader,
        &first,
        parse_result(&w.gstin, &invoice, &[(&name, "D1", 10)]),
    )
    .await;
    let r = review(&w, &keeper, &first).await;
    send(
        me(&keeper),
        &w.app,
        "PUT",
        &format!("/api/procurement/grn-scans/{first}/draft"),
        corrected(&w, &r, &[0]),
    )
    .await;
    let (status, grn) = send(
        me(&keeper),
        &w.app,
        "POST",
        &format!("/api/procurement/grn-scans/{first}/commit"),
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{grn}");
    let number = grn["grn"]["grn_number"]
        .as_str()
        .expect("number")
        .to_owned();

    let sha: String =
        sqlx::query_scalar("SELECT file_sha256 FROM purchase_bill_scans WHERE id = $1::uuid")
            .bind(&first)
            .fetch_one(&w.app.db)
            .await
            .expect("sha");
    let (status, body) = send(
        me(&keeper),
        &w.app,
        "POST",
        "/api/procurement/grn-scans",
        json!({
            "file_key": format!("{}/purchase_bill/again.jpg", w.tenant), "file_sha256": sha,
        }),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");

    let second = upload(&w, &keeper).await;
    read(
        &w,
        &reader,
        &second,
        parse_result(&w.gstin, &invoice, &[(&name, "D1", 10)]),
    )
    .await;
    let r = review(&w, &keeper, &second).await;
    assert_eq!(r["duplicate_grn"], json!(number), "{r}");
    send(
        me(&keeper),
        &w.app,
        "PUT",
        &format!("/api/procurement/grn-scans/{second}/draft"),
        corrected(&w, &r, &[0]),
    )
    .await;
    let (status, body) = send(
        me(&keeper),
        &w.app,
        "POST",
        &format!("/api/procurement/grn-scans/{second}/commit"),
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    assert!(
        body["detail"]
            .as_str()
            .unwrap_or_default()
            .contains(&number),
        "{body}"
    );
}

/// Given a reviewer matched the supplier's "ZORBELIN…" to our drug and kept
/// "remember" on, When that supplier's next bill is read, Then the line is
/// already matched to the drug, as the system's suggestion; and the supplier
/// accuracy report counts the held match.
#[tokio::test]
async fn a_confirmed_match_is_remembered_for_the_next_bill() {
    let w = world().await;
    let keeper = user(&w.app, &w.csrf, "store_keeper", &[], &[]).await;
    let reader = user(&w.app, &w.csrf, "staff", &[WORKER], &[]).await;
    let supplier_name = format!("ZORBELIN-650 TAB {} 10S", w.tag);
    let first = upload(&w, &keeper).await;
    read(
        &w,
        &reader,
        &first,
        parse_result(
            &w.gstin,
            &format!("SM/{}/1", w.tag),
            &[(&supplier_name, "M1", 10)],
        ),
    )
    .await;
    let r = review(&w, &keeper, &first).await;
    assert!(
        r["draft"]["lines"][0]["catalog_item_id"].is_null(),
        "no alias yet: nothing auto-filled"
    );
    send(
        me(&keeper),
        &w.app,
        "PUT",
        &format!("/api/procurement/grn-scans/{first}/draft"),
        corrected(&w, &r, &[0]),
    )
    .await;
    let (status, body) = send(
        me(&keeper),
        &w.app,
        "POST",
        &format!("/api/procurement/grn-scans/{first}/commit"),
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");

    let next = upload(&w, &keeper).await;
    read(
        &w,
        &reader,
        &next,
        parse_result(
            &w.gstin,
            &format!("SM/{}/2", w.tag),
            &[(&supplier_name, "M2", 10)],
        ),
    )
    .await;
    let r = review(&w, &keeper, &next).await;
    let line = &r["draft"]["lines"][0];
    assert_eq!(line["catalog_item_id"], json!(w.drugs[0].store_id), "{r}");
    assert_eq!(line["suggested_item_id"], json!(w.drugs[0].store_id));
    send(
        me(&keeper),
        &w.app,
        "PUT",
        &format!("/api/procurement/grn-scans/{next}/draft"),
        corrected(&w, &r, &[0]),
    )
    .await;
    let (status, body) = send(
        me(&keeper),
        &w.app,
        "POST",
        &format!("/api/procurement/grn-scans/{next}/commit"),
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");

    let (_, accuracy) = send(
        me(&keeper),
        &w.app,
        "GET",
        "/api/procurement/grn-scans/accuracy",
        json!(null),
    )
    .await;
    let row = accuracy
        .as_array()
        .expect("rows")
        .iter()
        .find(|r| r["vendor_id"] == json!(w.vendor))
        .cloned();
    let row = row.expect("this supplier is measured");
    assert_eq!(
        (row["scans"].as_i64(), row["lines_auto_matched"].as_i64()),
        (Some(2), Some(1))
    );
}

/// Given a queued bill, When a reader posts a result without claiming it,
/// Then 409; When a store keeper tries the reader's endpoints, Then 403; and
/// the reader cannot commit or merge — those are a person's.
#[tokio::test]
async fn the_reader_and_the_reviewer_each_hold_only_their_own_permission() {
    let w = world().await;
    let keeper = user(&w.app, &w.csrf, "store_keeper", &[], &[]).await;
    let reader = user(&w.app, &w.csrf, "staff", &[WORKER], &[]).await;
    let no_post = user(
        &w.app,
        &w.csrf,
        "store_keeper",
        &[],
        &["procurement.grn.post"],
    )
    .await;
    let id = upload(&w, &keeper).await;
    let payload = parse_result(&w.gstin, "X/1", &[("ANY", "B", 1)]);
    let path = format!("/api/procurement/grn-scans/{id}/parse-result");

    assert_eq!(
        send(me(&reader), &w.app, "POST", &path, payload.clone())
            .await
            .0,
        StatusCode::CONFLICT
    );
    // A leased bill is not handed to a second reader.
    let claim = json!({ "scan_id": id });
    let (_, first) = send(
        me(&reader),
        &w.app,
        "POST",
        "/api/procurement/grn-scans/claim",
        claim.clone(),
    )
    .await;
    assert_eq!(first["scan"]["id"], json!(id));
    let other = user(&w.app, &w.csrf, "staff", &[WORKER], &[]).await;
    let (status, second) = send(
        me(&other),
        &w.app,
        "POST",
        "/api/procurement/grn-scans/claim",
        claim.clone(),
    )
    .await;
    assert_eq!((status, second), (StatusCode::OK, Value::Null));
    assert_eq!(
        send(me(&other), &w.app, "POST", &path, payload.clone())
            .await
            .0,
        StatusCode::CONFLICT
    );
    assert_eq!(
        send(
            me(&keeper),
            &w.app,
            "POST",
            "/api/procurement/grn-scans/claim",
            claim
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        send(me(&keeper), &w.app, "POST", &path, payload).await.0,
        StatusCode::FORBIDDEN
    );
    let commit = format!("/api/procurement/grn-scans/{id}/commit");
    assert_eq!(
        send(me(&reader), &w.app, "POST", &commit, json!({}))
            .await
            .0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        send(me(&no_post), &w.app, "POST", &commit, json!({}))
            .await
            .0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        send(
            me(&reader),
            &w.app,
            "GET",
            &format!("/api/procurement/grn-scans/{id}/review"),
            json!(null)
        )
        .await
        .0,
        StatusCode::FORBIDDEN,
    );
    let discarded = send(
        me(&keeper),
        &w.app,
        "POST",
        &format!("/api/procurement/grn-scans/{id}/discard"),
        json!({}),
    )
    .await;
    assert_eq!(discarded.0, StatusCode::OK, "leave no bill queued");
}
