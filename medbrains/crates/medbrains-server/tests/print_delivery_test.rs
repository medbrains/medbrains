//! Print delivery (#221): a wristband goes to the wristband printer without
//! anyone choosing it, the bridge receives it as ZPL carrying the patient's
//! identifiers, and reporting it printed completes the job and counts the
//! print; a printer that cannot carry a document is refused up front.

mod common;

use base64::Engine;
use serde_json::{Value, json};
use uuid::Uuid;

#[tokio::test]
async fn a_wristband_reaches_the_wristband_printer_as_zpl() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let tag = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let printer = |name: String, kind: &str| {
        sqlx::query_scalar::<_, Uuid>(
            "INSERT INTO printer_configs (tenant_id, name, printer_type, connection_type, connection_string) \
             VALUES ($1, $2, $3, 'network', '10.0.0.9') RETURNING id",
        )
        .bind(tenant)
        .bind(name)
        .bind(kind.to_owned())
        .fetch_one(&app.db)
    };
    let band_printer = printer(format!("Ward Zebra {tag}"), "wristband")
        .await
        .expect("printer");
    let receipt_printer = printer(format!("Counter {tag}"), "thermal")
        .await
        .expect("printer");
    let doc: Uuid = sqlx::query_scalar(
        "INSERT INTO document_outputs (tenant_id, module_code, source_table, source_id, document_number, \
             title, category, status, template_code, context_snapshot) \
         VALUES ($1, 'ipd', 'admissions', gen_random_uuid(), $2, 'Patient Wristband', 'custom', 'generated', \
                 'patient_wristband', $3) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("WB-{tag}"))
    .bind(json!({ "band": { "patient_name": "R. Lakshmi", "uhid": format!("UH-{tag}"), "age": "42y",
                            "gender": "F", "allergies": ["Penicillin"] } }))
    .fetch_one(&app.db)
    .await
    .expect("document");

    let queue = |printer: Option<Uuid>| {
        app.client
            .post(app.url(&format!("/api/documents/{doc}/queue-print")))
            .header("x-csrf-token", &csrf)
            .json(&json!({ "printer_id": printer, "copies": 1 }))
            .send()
    };
    let res = queue(Some(receipt_printer)).await.expect("queue");
    assert_eq!(
        res.status(),
        409,
        "a receipt printer cannot print a wristband"
    );
    let queued: Value = queue(None)
        .await
        .expect("queue")
        .json()
        .await
        .expect("json");
    assert_eq!(queued["printer_name"], json!(format!("Ward Zebra {tag}")));
    let job = queued["print_job_id"].as_str().expect("job").to_owned();

    let claimed: Vec<Value> = app
        .client
        .post(app.url("/api/documents/print-jobs/claim"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "printer_ids": [band_printer] }))
        .send()
        .await
        .expect("claim")
        .json()
        .await
        .expect("json");
    let mine = claimed
        .iter()
        .find(|j| j["job_id"] == json!(job))
        .expect("claimed");
    assert_eq!(mine["content_type"], "application/zpl");
    assert_eq!(mine["connection_string"], "10.0.0.9");
    let zpl = String::from_utf8(
        base64::engine::general_purpose::STANDARD
            .decode(mine["payload_base64"].as_str().expect("payload"))
            .expect("base64"),
    )
    .expect("utf8");
    assert!(zpl.contains(&format!("^FDUHID UH-{tag}^FS")), "{zpl}");
    assert!(zpl.contains("ALLERGY: Penicillin"));

    let again: Vec<Value> = app
        .client
        .post(app.url("/api/documents/print-jobs/claim"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "printer_ids": [band_printer] }))
        .send()
        .await
        .expect("claim")
        .json()
        .await
        .expect("json");
    assert!(
        again.iter().all(|j| j["job_id"] != json!(job)),
        "a job is handed out once"
    );

    let res = app
        .client
        .post(app.url(&format!("/api/documents/print-jobs/{job}/result")))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "error": null }))
        .send()
        .await
        .expect("result");
    assert!(res.status().is_success());
    let (status, prints): (String, i32) = sqlx::query_as(
        "SELECT j.status::text, d.print_count FROM print_jobs j JOIN document_outputs d ON d.id = j.document_output_id \
          WHERE j.id = $1::uuid",
    )
    .bind(&job)
    .fetch_one(&app.db)
    .await
    .expect("job");
    assert_eq!((status.as_str(), prints), ("completed", 1));

    sqlx::query("UPDATE printer_configs SET is_active = false WHERE id = ANY($1)")
        .bind(vec![band_printer, receipt_printer])
        .execute(&app.db)
        .await
        .expect("retire printers");
}
