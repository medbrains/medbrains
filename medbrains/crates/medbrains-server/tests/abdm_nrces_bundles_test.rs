//! The NRCeS (IG 6.5.0) bundles a health-information transfer carries, built
//! from realistic records — an OP consult with coded diagnoses, a
//! prescription, a single-analyte and a panel lab report, a discharge summary
//! — and checked against the profiles' rules
//! (`medbrains_fhir::nrces::conformance`).
//!
//! Set `NRCES_BUNDLE_DIR` to also write each bundle there, for the HAPI
//! validator: `java -jar validator_cli.jar <dir>/*.json -version 4.0.1 -ig <nrces package.tgz>`.

use crate::abdm_hip_world::world;
use chrono::NaiveDate;
use medbrains_fhir::nrces::conformance::violations;
use medbrains_server::routes::abdm::hip::bundles::{ContextRow, build};
use serde_json::Value;
use uuid::Uuid;

async fn insert(db: &sqlx::PgPool, sql: &str, binds: &[Uuid]) -> Uuid {
    let mut q = sqlx::query_scalar::<_, Uuid>(sql);
    for b in binds {
        q = q.bind(*b);
    }
    q.fetch_one(db).await.expect(sql)
}

fn context(kind: &str, id: Uuid, display: &str) -> ContextRow {
    ContextRow {
        reference_number: format!("{kind}-{id}"),
        source_kind: kind.to_owned(),
        source_id: id,
        record_date: NaiveDate::from_ymd_opt(2026, 10, 23).unwrap_or_default(),
        display: display.to_owned(),
        encounter_id: None,
    }
}

fn resources<'a>(bundle: &'a Value, ty: &str) -> Vec<&'a Value> {
    bundle["entry"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|e| &e["resource"])
        .filter(|r| r["resourceType"] == ty)
        .collect()
}

fn section_codes(bundle: &Value) -> Vec<String> {
    bundle["entry"][0]["resource"]["section"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|s| s["code"]["coding"][0]["code"].as_str().map(str::to_owned))
        .collect()
}

/// Given a doctor with an HPR ID who saw a patient in OPD (coded dengue,
/// a ruled-out malaria), prescribed, ordered an HbA1c and a CBC, and later
/// discharged them, When the HIP builds the bundles a consent asks for,
/// Then every bundle meets its NRCeS profile: author and encounter present,
/// MedicationRequest names its requester, Conditions carry SNOMED (ICD-11 in the text),
/// lab values are UCUM quantities with LOINC where it is the test's own
/// analyte, and every section sits in its profile slice.
#[tokio::test]
async fn the_bundles_a_transfer_carries_meet_the_nrces_profiles() {
    let w = world().await;
    let db = &w.app.db;
    let p = w.patient_id;
    let hpr = format!("71-{:04}-{:04}-{:04}", rand4(), rand4(), rand4());
    let doctor = insert(db, "INSERT INTO users (tenant_id, username, email, full_name, role) \
        SELECT tenant_id, 'dr' || left(md5(random()::text), 10), gen_random_uuid() || '@h.test', 'Dr Asha Rao', 'doctor' \
          FROM patients WHERE id = $1 RETURNING id", &[p]).await;
    sqlx::query(
        "INSERT INTO doctor_profiles (tenant_id, user_id, display_name, hpr_id) \
        SELECT tenant_id, id, full_name, $2 FROM users WHERE id = $1",
    )
    .bind(doctor)
    .bind(&hpr)
    .execute(db)
    .await
    .expect("doctor profile");

    let opd = insert(db, "INSERT INTO encounters (tenant_id, patient_id, encounter_type, status, doctor_id, \
            chief_complaints, examination_findings, diagnosis, advice, follow_up_date, follow_up_instructions) \
        SELECT tenant_id, id, 'opd', 'open', $2, 'Fever and body ache for 3 days', 'Temp 101 F, no rash', \
               'Dengue fever', 'Oral fluids, avoid NSAIDs', DATE '2026-10-26', 'Review with platelet count' \
          FROM patients WHERE id = $1 RETURNING id", &[p, doctor]).await;
    for (system, code, snomed, text, certainty) in [
        (
            "icd11",
            "1D2Z",
            Some("38362002"),
            "Dengue fever",
            "probable",
        ),
        ("icd10", "B54", None, "Malaria", "ruled_out"),
    ] {
        sqlx::query("INSERT INTO diagnoses (tenant_id, encounter_id, icd_system, icd_code, icd_display, snomed_code, \
                snomed_display, description, certainty, is_primary) \
            SELECT tenant_id, id, $2, $3, $5, $4, CASE WHEN $4 IS NULL THEN NULL ELSE 'Dengue (disorder)' END, $5, $6, $2 = 'icd11' \
              FROM encounters WHERE id = $1")
            .bind(opd).bind(system).bind(code).bind(snomed).bind(text).bind(certainty)
            .execute(db).await.expect("diagnosis");
    }

    let rx = insert(
        db,
        "INSERT INTO prescriptions (tenant_id, encounter_id, doctor_id, patient_id, notes) \
        SELECT tenant_id, $2, $3, id, 'Take after food' FROM patients WHERE id = $1 RETURNING id",
        &[p, opd, doctor],
    )
    .await;
    for (drug, dose) in [("Paracetamol 650 mg", "1 tab"), ("ORS sachet", "1 sachet")] {
        sqlx::query("INSERT INTO prescription_items (tenant_id, prescription_id, drug_name, dosage, frequency, duration, route) \
            SELECT tenant_id, id, $2, $3, 'TDS', '3 days', 'oral' FROM prescriptions WHERE id = $1")
            .bind(rx).bind(drug).bind(dose).execute(db).await.expect("item");
    }

    let tag = Uuid::new_v4().simple().to_string();
    let lab = |name: &'static str, loinc: &'static str| {
        let tag = tag.clone();
        async move {
            let test: Uuid = sqlx::query_scalar(
                "INSERT INTO lab_test_catalog (tenant_id, code, name, loinc_code) \
                SELECT tenant_id, $2, $3, $4 FROM patients WHERE id = $1 RETURNING id",
            )
            .bind(p)
            .bind(format!("{name}-{tag}"))
            .bind(name)
            .bind(loinc)
            .fetch_one(db)
            .await
            .expect("test");
            insert(db, "INSERT INTO lab_orders (tenant_id, encounter_id, patient_id, test_id, ordered_by, status, \
                    verified_by, verified_at, interpretation) \
                SELECT tenant_id, $2, id, $3, $4, 'completed', $4, now(), 'Reviewed' FROM patients WHERE id = $1 RETURNING id",
                &[p, opd, test, doctor]).await
        }
    };
    let hba1c = lab("HbA1c", "4548-4").await;
    let cbc = lab("Complete blood count", "58410-2").await;
    for (order, name, value, unit, range, flag) in [
        (hba1c, "HbA1c", "6.1", "%", "4.0-5.6", "high"),
        (cbc, "Haemoglobin", "10.2", "g/dL", "12.0-15.5", "low"),
        (
            cbc,
            "Platelet count",
            "Clumped, repeat",
            "10^3/uL",
            "150-410",
            "abnormal",
        ),
    ] {
        sqlx::query("INSERT INTO lab_results (tenant_id, order_id, parameter_name, value, numeric_value, unit, reference_range, flag) \
            SELECT tenant_id, id, $2, $3, CASE WHEN $3 ~ '^[0-9.]+$' THEN $3::numeric END, $4, $5, $6::lab_result_flag \
              FROM lab_orders WHERE id = $1")
            .bind(order).bind(name).bind(value).bind(unit).bind(range).bind(flag)
            .execute(db).await.expect("result");
    }

    let ipd = insert(
        db,
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type, status, doctor_id) \
        SELECT tenant_id, id, 'ipd', 'open', $2 FROM patients WHERE id = $1 RETURNING id",
        &[p, doctor],
    )
    .await;
    sqlx::query("INSERT INTO diagnoses (tenant_id, encounter_id, icd_system, icd_code, icd_display, description, certainty) \
        SELECT tenant_id, id, 'icd11', '1D22', 'Dengue with warning signs', 'Dengue with warning signs', 'confirmed' \
          FROM encounters WHERE id = $1").bind(ipd).execute(db).await.expect("ipd diagnosis");
    // A hospital coding in ICD-10 (from its own licensed catalogue): the code
    // goes natively as an ICD-10 coding. "A91" and its title are fixtures.
    sqlx::query("INSERT INTO diagnoses (tenant_id, encounter_id, icd_system, icd_code, icd_display, description, certainty) \
        SELECT tenant_id, id, 'icd10', 'A91', 'Fixture dengue haemorrhagic fever', 'Dengue haemorrhagic fever', 'confirmed' \
          FROM encounters WHERE id = $1").bind(ipd).execute(db).await.expect("ipd icd-10 diagnosis");
    let admission = insert(db, "INSERT INTO admissions (tenant_id, encounter_id, patient_id, admitting_doctor, admitted_at, discharged_at) \
        SELECT tenant_id, $2, id, $3, now() - interval '4 days', now() FROM patients WHERE id = $1 RETURNING id",
        &[p, ipd, doctor]).await;
    let summary = insert(db, "INSERT INTO ipd_discharge_summaries (tenant_id, admission_id, final_diagnosis, \
            condition_at_discharge, course_in_hospital, treatment_given, investigation_summary, follow_up_instructions, verified_by) \
        SELECT tenant_id, id, 'Dengue with warning signs', 'Afebrile, platelets 1.2 lakh', 'IV fluids, monitored platelets', \
               'Crystalloids; paracetamol', 'Platelet nadir 38,000', 'Review in OPD after 1 week', $2 \
          FROM admissions WHERE id = $1 RETURNING id", &[admission, doctor]).await;

    let contexts = vec![
        context("opd_consult", opd, "OP consultation"),
        context("prescription", rx, "Prescription"),
        context("lab_report", hba1c, "HbA1c"),
        context("lab_report", cbc, "Complete blood count"),
        context("discharge_summary", summary, "Discharge summary"),
    ];
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM patients WHERE id = $1")
        .bind(p)
        .fetch_one(db)
        .await
        .expect("tenant");
    let mut tx = db.begin().await.expect("tx");
    let bundles = build(&mut tx, tenant, p, &contexts).await.expect("bundles");
    tx.rollback().await.ok();
    assert_eq!(bundles.len(), 5, "one bundle per care context");

    let dir = std::env::var("NRCES_BUNDLE_DIR").ok();
    for (reference, bundle) in &bundles {
        let v = violations(bundle);
        assert!(v.is_empty(), "{reference}: {v:#?}");
        let c = &bundle["entry"][0]["resource"];
        assert_eq!(c["author"][0]["type"], "Practitioner", "{reference}");
        assert!(c["encounter"]["reference"].is_string(), "{reference}");
        if let Some(d) = &dir {
            let kind = reference.split('-').next().unwrap_or("bundle");
            std::fs::write(
                format!("{d}/{kind}-{}.json", &reference[reference.len() - 8..]),
                serde_json::to_vec_pretty(bundle).unwrap_or_default(),
            )
            .expect("write bundle");
        }
    }
    let by = |kind: &str| {
        bundles
            .iter()
            .filter(|(r, _)| r.starts_with(kind))
            .map(|(_, b)| b)
            .collect::<Vec<_>>()
    };

    let op = by("opd_consult")[0];
    assert_eq!(
        section_codes(op),
        ["422843007", "425044008", "390906007", "736271009"]
    );
    let conditions = resources(op, "Condition");
    assert_eq!(conditions.len(), 1, "the ruled-out malaria is not sent");
    let coding = &conditions[0]["code"]["coding"];
    // The profile closes Condition.code.coding to ICD-10 and SNOMED CT, so the
    // ICD-11 code is named in the text.
    assert_eq!(coding[0]["system"], "http://snomed.info/sct");
    assert_eq!(coding[0]["code"], "38362002");
    assert_eq!(conditions[0]["code"]["text"], "Dengue fever (ICD-11 1D2Z)");
    assert_eq!(
        conditions[0]["verificationStatus"]["coding"][0]["code"],
        "provisional"
    );
    let doc = resources(op, "Practitioner");
    assert_eq!(
        doc[0]["identifier"][0]["value"],
        hpr.as_str(),
        "the doctor's HPR ID"
    );

    let prescription = by("prescription")[0];
    let requests = resources(prescription, "MedicationRequest");
    assert_eq!(requests.len(), 2);
    assert!(
        requests
            .iter()
            .all(|r| r["requester"]["reference"] == format!("urn:uuid:{doctor}"))
    );

    let labs = by("lab_report");
    let single = labs
        .iter()
        .find(|b| resources(b, "Observation").len() == 1)
        .expect("HbA1c");
    let hb = resources(single, "Observation")[0];
    assert_eq!(
        hb["code"]["coding"][0]["code"], "4548-4",
        "a single-analyte test's LOINC"
    );
    assert_eq!(hb["valueQuantity"]["code"], "%");
    assert_eq!(hb["interpretation"][0]["coding"][0]["code"], "H");
    let panel = labs
        .iter()
        .find(|b| resources(b, "Observation").len() == 2)
        .expect("CBC");
    assert_eq!(
        resources(panel, "DiagnosticReport")[0]["code"]["coding"][0]["code"],
        "58410-2"
    );
    let obs = resources(panel, "Observation");
    assert!(
        obs.iter().all(|o| o["code"]["coding"].is_null()),
        "a panel's code does not name its analytes"
    );
    assert!(obs.iter().any(|o| o["valueQuantity"]["code"] == "g/dL"));
    assert!(
        obs.iter()
            .any(|o| o["valueString"] == "Clumped, repeat 10^3/uL")
    );

    let discharge = by("discharge_summary")[0];
    assert_eq!(
        section_codes(discharge),
        ["422843007", "425044008", "721981007", "734163000", "8648-8"]
    );
    assert_eq!(resources(discharge, "Encounter")[0]["class"]["code"], "IMP");
    let conditions = resources(discharge, "Condition");
    let icd11 = conditions
        .iter()
        .find(|c| c["code"]["text"] == "Dengue with warning signs (ICD-11 1D22)")
        .expect("the ICD-11 diagnosis, named in the text");
    assert!(icd11["code"]["coding"].is_null(), "no ICD-11 coding slice");
    let icd10 = conditions
        .iter()
        .find(|c| c["code"]["text"] == "Dengue haemorrhagic fever")
        .expect("the ICD-10 diagnosis");
    assert_eq!(
        icd10["code"]["coding"][0],
        serde_json::json!({ "system": "http://hl7.org/fhir/sid/icd-10", "code": "A91",
            "display": "Fixture dengue haemorrhagic fever" }),
        "ICD-10 coded natively, never mapped from ICD-11"
    );
}

fn rand4() -> u128 {
    Uuid::new_v4().as_u128() % 10_000
}
