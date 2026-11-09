//! Free text never carries a gated drug.
//!
//! Every Schedule H/H1/X/NDPS check keys on the catalogue item. A
//! prescription-backed dispense takes catalogue lines only, so any free-text
//! line there is refused with "Choose the drug from the catalogue". At OTC
//! and POS, free text naming a gated drug is refused: an X, NDPS or
//! controlled name anywhere in it as a word or phrase, an H or H1 name at its
//! start (after a dosage form); a line naming nothing gated is sold.

use crate::dispense_world::{self, Desk};

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

const CHOOSE: &str = "Choose the drug from the catalogue";

/// The catalogue's generic name for `drug`, typed as a pharmacist might:
/// padded and in capitals.
async fn typed_generic(d: &Desk, drug: Uuid) -> String {
    let generic: String =
        sqlx::query_scalar("SELECT generic_name FROM pharmacy_catalog WHERE id = $1")
            .bind(drug)
            .fetch_one(&d.app.db)
            .await
            .expect("generic");
    format!("  {}  ", generic.to_uppercase())
}

/// POSTs `body` to `path` as the admin and returns the status and text.
async fn post(d: &Desk, path: &str, body: Value) -> (StatusCode, String) {
    let resp = d
        .app
        .client
        .post(d.app.url(path))
        .header("x-csrf-token", &d.admin_csrf)
        .json(&body)
        .send()
        .await
        .expect("post");
    (resp.status(), resp.text().await.unwrap_or_default())
}

#[tokio::test]
async fn any_free_text_line_on_a_prescription_order_is_refused_and_filed() {
    let d = dispense_world::desk().await;
    let h = d.drug(Some("H"), false).await;
    let rx = d.prescription(&[(h, Some(10), "BD")]).await;
    let order: Uuid = sqlx::query_scalar(
        "INSERT INTO pharmacy_orders (tenant_id, prescription_id, patient_id, encounter_id, \
                                      ordered_by, status) \
         VALUES ($1, $2, $3, $4, $5, 'ordered') RETURNING id",
    )
    .bind(d.tenant)
    .bind(rx)
    .bind(d.patient)
    .bind(d.encounter)
    .bind(d.doctor)
    .fetch_one(&d.app.db)
    .await
    .expect("order");
    sqlx::query(
        "INSERT INTO pharmacy_order_items (tenant_id, order_id, drug_name, quantity, unit_price, \
                                           total_price) VALUES ($1, $2, $3, 2, 10.00, 20.00)",
    )
    .bind(d.tenant)
    .bind(order)
    .bind("Cotton roll")
    .execute(&d.app.db)
    .await
    .expect("free-text line");

    let (status, body) = d.dispense(order, json!({})).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
    assert!(body.to_string().contains(CHOOSE), "{body}");
    assert_eq!(
        d.filed(order, "SCHEDULE_DISPENSE_REFUSED", "blocked").await,
        1
    );
}

#[tokio::test]
async fn an_otc_sale_of_a_gated_drug_typed_as_free_text_is_refused() {
    let d = dispense_world::desk().await;
    let ndps = d.drug(Some("NDPS"), true).await;
    let name = typed_generic(&d, ndps).await;
    let sale = |drug_name: String| json!({ "items": [{ "catalog_item_id": null, "drug_name": drug_name, "quantity": 1, "unit_price": 10 }] });

    let (status, text) = post(&d, "/api/pharmacy/otc-sale", sale(name)).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{text}");
    assert!(text.contains(CHOOSE), "{text}");

    let (_, plain) = post(
        &d,
        "/api/pharmacy/otc-sale",
        sale("Glycerin soap".to_owned()),
    )
    .await;
    assert!(!plain.contains(CHOOSE), "nothing gated is named: {plain}");
}

#[tokio::test]
async fn a_pos_sale_of_a_gated_drug_typed_as_free_text_is_refused() {
    let d = dispense_world::desk().await;
    let x = d.drug(Some("X"), true).await;
    let name = typed_generic(&d, x).await;
    let sale = |drug_name: String| {
        json!({
            "items": [{
                "catalog_item_id": null, "drug_name": drug_name, "quantity": 1,
                "gst_rate": 12, "mrp": 10, "selling_price": 10,
            }],
            "payment_mode": "cash",
        })
    };

    let (status, text) = post(&d, "/api/pharmacy/pos/sales", sale(name)).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{text}");
    assert!(text.contains(CHOOSE), "{text}");

    let (_, plain) = post(
        &d,
        "/api/pharmacy/pos/sales",
        sale("Cotton roll".to_owned()),
    )
    .await;
    assert!(!plain.contains(CHOOSE), "nothing gated is named: {plain}");
}

/// A catalogue drug named `name`, generic `generic`, of `schedule`.
async fn named_drug(d: &Desk, (name, generic): (&str, &str), schedule: &str, controlled: bool) {
    sqlx::query(
        "INSERT INTO pharmacy_catalog (tenant_id, code, name, generic_name, drug_schedule, \
                                       is_controlled, base_price, current_stock) \
         VALUES ($1, $2, $3, $4, $5, $6, 10.00, 500)",
    )
    .bind(d.tenant)
    .bind(format!("FT-{}", dispense_world::tag()))
    .bind(name)
    .bind(generic)
    .bind(schedule)
    .bind(controlled)
    .execute(&d.app.db)
    .await
    .expect("catalog");
}

#[tokio::test]
async fn an_otc_line_naming_a_gated_drug_in_other_words_is_refused() {
    let d = dispense_world::desk().await;
    named_drug(
        &d,
        ("Morphine Sulphate 10mg Tablet", "Morphine"),
        "NDPS",
        true,
    )
    .await;
    named_drug(&d, ("Tramadol 50mg Tablet", "Tramadol"), "H1", false).await;
    let sale = |drug_name: &str| json!({ "items": [{ "catalog_item_id": null, "drug_name": drug_name, "quantity": 1, "unit_price": 10 }] });

    for typed in [
        "Morphine sulphate 10mg tab",
        "tab tramadol 50",
        "Inj Tramadol",
    ] {
        let (status, text) = post(&d, "/api/pharmacy/otc-sale", sale(typed)).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{typed}: {text}");
        assert!(text.contains(CHOOSE), "{typed}: {text}");
    }
    let (_, plain) = post(&d, "/api/pharmacy/otc-sale", sale("Cotton roll")).await;
    assert!(!plain.contains(CHOOSE), "nothing gated is named: {plain}");
}
