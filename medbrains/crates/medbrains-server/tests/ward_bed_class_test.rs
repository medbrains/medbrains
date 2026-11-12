//! A bed already in a ward can be given its class.
//!
//! The class could be set only while assigning a bed to a ward, and a bed is in
//! one ward at a time, so every bed mapped first showed "No class set" on the
//! bed board for good.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};

#[tokio::test]
async fn a_mapped_bed_takes_a_class_and_the_board_shows_it() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let wards: Value = app.get(&app.client, "/api/ipd/wards").await.json().await.expect("wards");
    let wards = wards.as_array().cloned().unwrap_or_default();
    let mut target = None;
    for ward in &wards {
        let ward_id = ward["id"].as_str().expect("ward id").to_owned();
        let beds: Value = app
            .get(&app.client, &format!("/api/ipd/wards/{ward_id}/beds"))
            .await
            .json()
            .await
            .expect("ward beds");
        if let Some(bed) = beds.as_array().and_then(|b| b.first()).cloned() {
            target = Some((ward_id, bed));
            break;
        }
    }
    let (ward_id, bed) = target.expect("a ward with a bed");
    let bed_types: Value =
        app.get(&app.client, "/api/setup/bed-types").await.json().await.expect("bed types");
    let bed_type = &bed_types[0];

    let resp = app
        .client
        .put(app.url(&format!("/api/ipd/wards/{ward_id}/beds/{}", bed["mapping_id"].as_str().expect("mapping"))))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "bed_type_id": bed_type["id"] }))
        .send()
        .await
        .expect("set class");
    assert_eq!(resp.status(), StatusCode::OK, "{}", resp.text().await.unwrap_or_default());

    let beds: Value = app
        .get(&app.client, &format!("/api/ipd/wards/{ward_id}/beds"))
        .await
        .json()
        .await
        .expect("ward beds");
    let row = beds
        .as_array()
        .and_then(|rows| rows.iter().find(|r| r["mapping_id"] == bed["mapping_id"]))
        .expect("the bed");
    assert_eq!(row["bed_type_id"], bed_type["id"]);
    assert!(row["bed_status"].is_string(), "status under the name the client reads: {row}");

    let board: Value = app
        .get(&app.client, &format!("/api/ipd/bed-dashboard/beds?ward_id={ward_id}"))
        .await
        .json()
        .await
        .expect("board");
    let on_board = board
        .as_array()
        .and_then(|rows| rows.iter().find(|r| r["bed_location_id"] == bed["bed_location_id"]))
        .expect("bed on the board");
    assert_eq!(on_board["bed_type_name"], bed_type["name"]);

    // Another hospital's class, or none at all, is refused.
    let resp = app
        .client
        .put(app.url(&format!("/api/ipd/wards/{ward_id}/beds/{}", bed["mapping_id"].as_str().expect("mapping"))))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "bed_type_id": uuid::Uuid::new_v4() }))
        .send()
        .await
        .expect("unknown class");
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
}
