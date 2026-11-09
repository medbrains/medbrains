//! Free text never carries a gated drug.
//!
//! Every Schedule H/H1/X/NDPS check keys on the catalogue item. A dispense
//! through the schedule gate takes catalogue lines only, with or without a
//! prescription, so any free-text line there is refused with "Choose the drug
//! from the catalogue". At OTC and POS, free text naming a gated drug is
//! refused: a gated catalogue name or a part of a gated generic, anywhere in
//! it as a whole word or phrase, after zero-width characters are deleted and
//! NFKC applied; a line still holding a non-ASCII letter is refused too; a
//! line naming nothing gated is sold.

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

/// POSTs a one-line POS sale typed as `drug_name`.
async fn pos_sale(d: &Desk, drug_name: &str) -> (StatusCode, String) {
    let body = json!({
        "items": [{
            "catalog_item_id": null, "drug_name": drug_name, "quantity": 1,
            "gst_rate": 12, "mrp": 10, "selling_price": 10,
        }],
        "payment_mode": "cash",
    });
    post(d, "/api/pharmacy/pos/sales", body).await
}

#[tokio::test]
async fn a_gated_name_anywhere_in_free_text_or_disguised_is_refused() {
    let d = dispense_world::desk().await;
    named_drug(
        &d,
        ("Morphine Sulphate 10mg Tablet", "Morphine"),
        "NDPS",
        true,
    )
    .await;
    named_drug(&d, ("Tramadol 50mg Tablet", "Tramadol"), "H1", false).await;
    named_drug(
        &d,
        (
            "Codeine Phosphate + Chlorpheniramine Syrup",
            "Codeine Phosphate + Chlorpheniramine",
        ),
        "H",
        false,
    )
    .await;
    named_drug(&d, ("Iron 100mg Injection", "Iron"), "H", false).await;
    let sale = |drug_name: &str| json!({ "items": [{ "catalog_item_id": null, "drug_name": drug_name, "quantity": 1, "unit_price": 10 }] });

    for typed in [
        "2 strips morphine",
        "50mg tramadol",
        "2 strips tramadol",
        "T. Tramadol",
        "Mor\u{200B}phine",
        "Morphin\u{0435}",
        "Chlorpheniramine maleate syrup",
    ] {
        let (status, text) = post(&d, "/api/pharmacy/otc-sale", sale(typed)).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{typed}: {text}");
        assert!(text.contains(CHOOSE), "{typed}: {text}");
    }
    let (_, plain) = post(&d, "/api/pharmacy/otc-sale", sale("Environment spray")).await;
    assert!(!plain.contains(CHOOSE), "iron is not in environment: {plain}");

    let (status, text) = pos_sale(&d, "50mg tramadol").await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{text}");
    assert!(text.contains(CHOOSE), "{text}");
}
