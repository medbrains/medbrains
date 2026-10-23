//! ABDM's four later HI types (HIP_INIT_SHARE_CARECONTEXT; the HIU's
//! HIU_FLOW_111–113), from realistic records: a vaccine given here and one
//! read off the patient's card, a visit's vitals, an uploaded report, and an
//! issued bill. Each is captured as a care context by the database (an ID
//! proof never is), and builds a bundle its NRCeS IG 6.5.0 profile accepts
//! (`medbrains_fhir::nrces::conformance`).
//!
//! Set `NRCES_BUNDLE_DIR` to also write each bundle there, for the HL7
//! validator: `java -jar validator_cli.jar <dir>/*.json -version 4.0.1 -ig <nrces package.tgz>`.

use crate::abdm_hip_world::world;
use chrono::NaiveDate;
use medbrains_fhir::nrces::conformance::violations;
use medbrains_server::routes::abdm::hip::bundle_records::Files;
use medbrains_server::routes::abdm::hip::bundles::{ContextRow, build};
use uuid::Uuid;

async fn insert(db: &sqlx::PgPool, sql: &str, binds: &[Uuid]) -> Uuid {
    let mut q = sqlx::query_scalar::<_, Uuid>(sql);
    for b in binds {
        q = q.bind(*b);
    }
    q.fetch_one(db).await.expect(sql)
}

/// Given a nurse who took a patient's vitals and gave a hepatitis B dose,
/// a second dose read off their card, an ultrasound report uploaded with an
/// ID proof, and the visit's bill issued, When the HIP builds what a consent
/// for those HI types asks for, Then each record has its care context (the
/// vaccines and vitals captured by the database), and every bundle meets its
/// profile.
#[tokio::test]
async fn the_later_hi_types_are_captured_and_meet_their_profiles() {
    let w = world().await;
    let db = &w.app.db;
    let p = w.patient_id;
    let nurse = insert(db, "INSERT INTO users (tenant_id, username, email, full_name, role) \
        SELECT tenant_id, 'nu' || left(md5(random()::text), 10), gen_random_uuid() || '@h.test', 'Sr Meena', 'nurse' \
          FROM patients WHERE id = $1 RETURNING id", &[p]).await;
    let visit = insert(
        db,
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type, status) \
        SELECT tenant_id, id, 'opd', 'open' FROM patients WHERE id = $1 RETURNING id",
        &[p],
    )
    .await;
    sqlx::query("INSERT INTO vitals (tenant_id, encounter_id, patient_id, recorded_by, temperature, pulse, \
            systolic_bp, diastolic_bp, respiratory_rate, spo2, weight_kg, height_cm, bmi) \
        SELECT tenant_id, $2, id, $3, 37.4, 88, 128, 84, 18, 97, 61.5, 158, 24.6 FROM patients WHERE id = $1")
        .bind(p).bind(visit).bind(nurse).execute(db).await.expect("vitals");
    let given = insert(db, "INSERT INTO patient_immunizations (tenant_id, patient_id, encounter_id, vaccine_name, \
            vaccine_code, dose_number, administered_on, lot_number, route, recorded_by) \
        SELECT tenant_id, id, $2, 'Hepatitis B vaccine', '836374004', 2, CURRENT_DATE, 'HB-2231', 'intramuscular', $3 \
          FROM patients WHERE id = $1 RETURNING id", &[p, visit, nurse]).await;
    let card = insert(db, "INSERT INTO patient_immunizations (tenant_id, patient_id, vaccine_name, dose_number, \
            administered_on, given_elsewhere, recorded_by) \
        SELECT tenant_id, id, 'BCG vaccine', 1, DATE '1990-01-15', true, $2 FROM patients WHERE id = $1 RETURNING id",
        &[p, nurse]).await;
    let report = insert(db, "INSERT INTO patient_documents (tenant_id, patient_id, document_type, document_name, \
            file_url, mime_type, uploaded_by) \
        SELECT tenant_id, id, 'report', 'Ultrasound abdomen report', 'docs/us.pdf', 'application/pdf', $2 \
          FROM patients WHERE id = $1 RETURNING id", &[p, nurse]).await;
    let id_proof = insert(db, "INSERT INTO patient_documents (tenant_id, patient_id, document_type, document_name, \
            file_url, mime_type) \
        SELECT tenant_id, id, 'id_proof', 'Aadhaar card', 'docs/id.jpg', 'image/jpeg' FROM patients WHERE id = $1 RETURNING id",
        &[p]).await;
    let bill = insert(db, "INSERT INTO invoices (tenant_id, invoice_number, patient_id, encounter_id, status, \
            subtotal, tax_amount, total_amount, created_by) \
        SELECT tenant_id, 'INV-' || left(md5(random()::text), 8), id, $2, 'draft', 1000, 120, 1120, $3 \
          FROM patients WHERE id = $1 RETURNING id", &[p, visit, nurse]).await;
    sqlx::query("INSERT INTO invoice_items (tenant_id, invoice_id, charge_code, description, quantity, unit_price, \
            total_price, cgst_amount, sgst_amount) \
        SELECT tenant_id, id, 'CONS', 'Consultation', 1, 1000, 1120, 60, 60 FROM invoices WHERE id = $1")
        .bind(bill).execute(db).await.expect("line");
    sqlx::query("UPDATE invoices SET status = 'issued', issued_at = now() WHERE id = $1")
        .bind(bill)
        .execute(db)
        .await
        .expect("issue");

    // Documents and bills are not captured automatically yet (migration
    // 1205): capture them as the trigger will.
    for (kind, id, display) in [
        ("health_document", report, "Ultrasound abdomen report"),
        ("invoice", bill, "Invoice"),
    ] {
        sqlx::query(
            "SELECT abdm_capture_care_context(tenant_id, id, $2, $3, NULL, CURRENT_DATE, $4) \
                     FROM patients WHERE id = $1",
        )
        .bind(p)
        .bind(kind)
        .bind(id)
        .bind(display)
        .execute(db)
        .await
        .expect("capture");
    }
    let captured: Vec<ContextRow> = sqlx::query_as(
        "SELECT reference_number, source_kind, source_id, record_date, display, encounter_id \
           FROM abdm_care_contexts WHERE patient_id = $1 AND source_id = ANY($2) ORDER BY reference_number")
        .bind(p).bind(vec![visit, given, card, report, id_proof, bill])
        .fetch_all(db).await.expect("captured");
    let kinds: Vec<&str> = captured.iter().map(|c| c.source_kind.as_str()).collect();
    assert_eq!(
        kinds,
        [
            "health_document",
            "immunization",
            "immunization",
            "invoice",
            "wellness"
        ],
        "one care context per record: {captured:?}"
    );
    assert!(
        captured
            .iter()
            .all(|c| c.record_date <= chrono::Utc::now().date_naive())
    );
    assert!(
        captured
            .iter()
            .any(|c| c.record_date == NaiveDate::from_ymd_opt(1990, 1, 15).unwrap_or_default())
    );

    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM patients WHERE id = $1")
        .bind(p)
        .fetch_one(db)
        .await
        .expect("tenant");
    let mut files = Files::new();
    files.insert(
        report,
        (
            "application/pdf".to_owned(),
            "JVBERi0xLjcKJeLjz9MK".to_owned(),
        ),
    );
    let mut tx = db.begin().await.expect("tx");
    let bundles = build(&mut tx, tenant, p, &captured, &files)
        .await
        .expect("bundles");
    tx.rollback().await.ok();
    assert_eq!(bundles.len(), 5, "one bundle per care context");

    let dir = std::env::var("NRCES_BUNDLE_DIR").ok();
    for (reference, bundle) in &bundles {
        let v = violations(bundle);
        assert!(v.is_empty(), "{reference}: {v:#?}");
        if let Some(d) = &dir {
            let kind = reference.split('-').next().unwrap_or("bundle");
            std::fs::write(
                format!("{d}/{kind}-{}.json", &reference[reference.len() - 8..]),
                serde_json::to_vec_pretty(bundle).unwrap_or_default(),
            )
            .expect("write bundle");
        }
    }
    let wellness = bundles
        .iter()
        .find(|(r, _)| r.starts_with("WR-"))
        .map(|(_, b)| b)
        .expect("wellness");
    let titles: Vec<&str> = wellness["entry"][0]["resource"]["section"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|s| s["title"].as_str())
        .collect();
    assert_eq!(titles, ["Vital Signs", "Body Measurement"]);
    let bill_bundle = bundles
        .iter()
        .find(|(r, _)| r.starts_with("INV-"))
        .map(|(_, b)| b)
        .expect("bill");
    let invoice = bill_bundle["entry"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|e| &e["resource"])
        .find(|r| r["resourceType"] == "Invoice")
        .expect("Invoice");
    assert_eq!(
        (
            invoice["totalGross"]["value"].as_f64(),
            invoice["type"]["coding"][0]["code"].as_str()
        ),
        (Some(1120.0), Some("03"))
    );

    let mut tx = db.begin().await.expect("tx");
    let without = build(&mut tx, tenant, p, &captured, &Files::new())
        .await
        .expect("bundles");
    tx.rollback().await.ok();
    assert_eq!(
        without.len(),
        4,
        "a document whose file cannot be read is not sent empty"
    );
}
