//! SNOMED CT store, end to end, on a SYNTHETIC RF2 release (made-up
//! concepts in made-up namespace 9999999 — no licensed content):
//! an admin uploads the package and it loads in the background; concepts,
//! descriptions and the closure arrive; a synonym finds its concept, in Hindi
//! when asked; subsumption, descendants and `<<X MINUS <<Y` follow the
//! polyhierarchy; a hospital's diagnoses are counted by hierarchy; loading
//! the same release again changes nothing; and staff without the permission
//! are refused.

use crate::common;

use std::io::{Cursor, Write};
use std::path::{Path, PathBuf};
use std::time::Duration;

use reqwest::{Client, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

const ROOT: &str = "138875005";
const FINDING: &str = "109999999109";
const DISORDER: &str = "119999999106";
const SUGAR: &str = "129999999104";
const SUGAR_ONE: &str = "139999999102";
const SUGAR_TWO: &str = "149999999107";
const METABOLIC: &str = "159999999105";
const FEVER: &str = "169999999108";
const MODULE: i64 = 19_999_999_103;
const SIMPLE_REFSET: &str = "39999999107";

fn fixture_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join(
        "../medbrains-terminology/tests/fixtures/SnomedCT_SyntheticRF2_PRODUCTION_20000101T120000Z",
    )
}

fn add_dir(zip: &mut zip::ZipWriter<Cursor<Vec<u8>>>, root: &Path, dir: &Path) {
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);
    for entry in std::fs::read_dir(dir).expect("fixture dir") {
        let path = entry.expect("entry").path();
        if path.is_dir() {
            add_dir(zip, root, &path);
            continue;
        }
        let rel = path
            .strip_prefix(root)
            .expect("relative")
            .to_string_lossy()
            .replace('\\', "/");
        zip.start_file(format!("SnomedCT_Synthetic/{rel}"), options)
            .expect("start");
        zip.write_all(&std::fs::read(&path).expect("read"))
            .expect("write");
    }
}

fn package() -> Vec<u8> {
    let mut zip = zip::ZipWriter::new(Cursor::new(Vec::new()));
    let root = fixture_dir();
    add_dir(&mut zip, &root, &root);
    zip.finish().expect("zip").into_inner()
}

async fn upload(
    app: &common::TestApp,
    client: &Client,
    csrf: &str,
    bytes: Vec<u8>,
) -> (StatusCode, Value) {
    let resp = client
        .post(app.url("/api/terminology/snomed/releases/upload"))
        .header("x-csrf-token", csrf)
        .header("content-type", "application/zip")
        .header("x-file-name", "synthetic.zip")
        .body(bytes)
        .send()
        .await
        .expect("upload");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

async fn get(app: &common::TestApp, client: &Client, path: &str) -> (StatusCode, Value) {
    let resp = client.get(app.url(path)).send().await.expect("get");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

/// Upload, then wait for the background import to finish.
async fn import_fixture(app: &common::TestApp, csrf: &str) -> Value {
    let (status, started) = upload(app, &app.client, csrf, package()).await;
    assert!(
        status == StatusCode::ACCEPTED || status == StatusCode::OK,
        "{status} {started}"
    );
    let id = started["release"]["id"]
        .as_str()
        .expect("release id")
        .to_owned();
    for _ in 0..120 {
        let (_, release) = get(
            app,
            &app.client,
            &format!("/api/terminology/snomed/releases/{id}"),
        )
        .await;
        match release["status"].as_str() {
            Some("completed") => return release,
            Some("failed") => panic!("import failed: {}", release["error"]),
            _ => tokio::time::sleep(Duration::from_millis(500)).await,
        }
    }
    panic!("import did not finish");
}

/// Staff in `role` with a signed-in client.
async fn staff(app: &common::TestApp, csrf: &str, role: &str) -> Client {
    let tag = &Uuid::new_v4().simple().to_string()[..10];
    let (username, password) = (format!("sn_{tag}"), format!("Snomed#{tag}Aa9"));
    let resp = app
        .client
        .post(app.url("/api/setup/users"))
        .header("x-csrf-token", csrf)
        .json(&json!({
            "username": username, "email": format!("{username}@example.test"),
            "password": password, "full_name": format!("Staff {tag}"), "role": role,
        }))
        .send()
        .await
        .expect("create user");
    assert!(resp.status().is_success(), "create {role}");
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    client
        .post(app.url("/api/auth/login"))
        .json(&json!({ "username": username, "password": password }))
        .send()
        .await
        .expect("login");
    client
}

/// A patient with one encounter carrying one diagnosis per code.
async fn code_diagnoses(app: &common::TestApp, codes: &[&str]) {
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    let encounter: Uuid = sqlx::query_scalar(
        "WITH p AS (INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
                    SELECT tenant_id, $1, 'Coded', 'Patient', 'other'::gender, $2 \
                      FROM users WHERE username = 'admin' RETURNING id, tenant_id) \
         INSERT INTO encounters (tenant_id, patient_id, encounter_type) \
         SELECT tenant_id, id, 'opd' FROM p RETURNING id",
    )
    .bind(format!("UH-SN-{suffix}"))
    .bind(format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("encounter");
    for code in codes {
        sqlx::query(
            "INSERT INTO diagnoses (tenant_id, encounter_id, description, snomed_code) \
             SELECT tenant_id, id, 'coded in test', $2 FROM encounters WHERE id = $1",
        )
        .bind(encounter)
        .bind(*code)
        .execute(&app.db)
        .await
        .expect("diagnosis");
    }
}

fn category_records(rollup: &Value, id: &str) -> i64 {
    rollup["categories"]
        .as_array()
        .and_then(|rows| rows.iter().find(|r| r["concept_id"] == id))
        .and_then(|r| r["records"].as_i64())
        .unwrap_or(0)
}

#[tokio::test]
async fn synthetic_release_loads_searches_walks_and_counts() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let release = import_fixture(&app, &csrf).await;
    assert_eq!(release["edition"], "XX9999999");
    assert_eq!(release["concept_count"], 13, "{release}");
    assert_eq!(release["description_count"], 30, "en + hi descriptions");
    assert_eq!(release["relationship_count"], 14);
    assert_eq!(
        release["refset_member_count"], 32,
        "language + simple members"
    );
    assert!(
        release["skipped_files"]
            .as_array()
            .is_some_and(Vec::is_empty),
        "full view not listed"
    );

    let concepts: i64 =
        sqlx::query_scalar("SELECT count(*) FROM snomed_concept WHERE module_id = $1")
            .bind(MODULE)
            .fetch_one(&app.db)
            .await
            .expect("count");
    assert_eq!(concepts, 13);
    let synthetic: Vec<i64> = [
        FINDING, DISORDER, SUGAR, SUGAR_ONE, SUGAR_TWO, METABOLIC, FEVER,
    ]
    .iter()
    .map(|c| c.parse().expect("id"))
    .collect();
    let pairs: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM snomed_transitive_closure WHERE subtype_id = ANY($1)",
    )
    .bind(&synthetic)
    .fetch_one(&app.db)
    .await
    .expect("closure");
    assert_eq!(
        pairs, 20,
        "ancestors of the seven clinical concepts, the inactive IS-A left out"
    );

    // Search: a synonym finds its concept; Hindi when asked; refset + tag filters.
    let (s, found) = get(
        &app,
        &app.client,
        "/api/terminology/snomed/search?q=sweet%20blood",
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{found}");
    assert_eq!(found["loaded"], true);
    assert_eq!(
        found["results"][0]["concept_id"], SUGAR,
        "exact synonym ranks first: {found}"
    );
    assert_eq!(
        found["results"][0]["preferred_term"],
        "Synthetic sugar disorder"
    );
    assert_eq!(found["results"][0]["matched_term"], "Sweet blood syndrome");
    assert_eq!(found["results"][0]["semantic_tag"], "disorder");
    let (_, hindi) = get(
        &app,
        &app.client,
        "/api/terminology/snomed/search?q=pyrexia%20synthetic&lang=hi",
    )
    .await;
    assert_eq!(
        hindi["results"][0]["preferred_term"], "सिंथेटिक बुखार",
        "{hindi}"
    );
    let (_, members) = get(
        &app,
        &app.client,
        &format!("/api/terminology/snomed/search?q=synthetic&refset={SIMPLE_REFSET}"),
    )
    .await;
    let ids: Vec<&str> = members["results"]
        .as_array()
        .map(|r| r.iter().filter_map(|h| h["concept_id"].as_str()).collect())
        .unwrap_or_default();
    assert_eq!(ids.len(), 2, "{members}");
    assert!(ids.contains(&SUGAR_ONE) && ids.contains(&FEVER));
    let (_, procs) = get(
        &app,
        &app.client,
        "/api/terminology/snomed/search?q=synthetic&semantic_tag=procedure",
    )
    .await;
    assert_eq!(
        procs["results"].as_array().map(Vec::len),
        Some(1),
        "{procs}"
    );
    let (_, retired) = get(
        &app,
        &app.client,
        "/api/terminology/snomed/search?q=synthetic%20retired",
    )
    .await;
    assert_eq!(
        retired["results"].as_array().map(Vec::len),
        Some(0),
        "inactive concepts hidden by default"
    );
    let (_, capped) = get(
        &app,
        &app.client,
        "/api/terminology/snomed/search?q=synthetic&limit=5000",
    )
    .await;
    assert!(
        capped["results"].as_array().is_some_and(|r| r.len() <= 50),
        "licence cap"
    );

    // Subsumption and descendants.
    let (sugar_two, disorder) = (
        SUGAR_TWO.parse().expect("id"),
        DISORDER.parse().expect("id"),
    );
    assert!(
        medbrains_terminology::search::is_a(&app.db, sugar_two, disorder)
            .await
            .expect("is_a")
    );
    let (_, kind) = get(
        &app,
        &app.client,
        &format!("/api/terminology/snomed/subsumes?sub={FEVER}&sup={DISORDER}"),
    )
    .await;
    assert_eq!(kind["is_a"], false, "{kind}");
    let (_, down) = get(
        &app,
        &app.client,
        &format!("/api/terminology/snomed/concepts/{FINDING}/hierarchy?direction=descendants"),
    )
    .await;
    assert_eq!(down["total"], 6, "{down}");
    let (_, detail) = get(
        &app,
        &app.client,
        &format!("/api/terminology/snomed/concepts/{SUGAR_TWO}"),
    )
    .await;
    assert_eq!(
        detail["parents"].as_array().map(Vec::len),
        Some(2),
        "polyhierarchy: {detail}"
    );
    assert_eq!(
        detail["fsn"],
        "Synthetic sugar disorder type two (disorder)"
    );

    // ECL: sugar disorders that are not metabolic disorders.
    let ecl = format!("<<{SUGAR} MINUS <<{METABOLIC}");
    let resp = app
        .client
        .get(app.url("/api/terminology/snomed/ecl"))
        .query(&[("expression", ecl.as_str())])
        .send()
        .await
        .expect("ecl");
    let result: Value = resp.json().await.expect("ecl json");
    let ids: Vec<&str> = result["concepts"]
        .as_array()
        .map(|r| r.iter().filter_map(|c| c["concept_id"].as_str()).collect())
        .unwrap_or_default();
    assert_eq!(result["total"], 2, "{result}");
    assert!(ids.contains(&SUGAR) && ids.contains(&SUGAR_ONE), "{result}");
    let (s, _) = get(
        &app,
        &app.client,
        "/api/terminology/snomed/ecl?expression=%3C%3C116680004",
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST, "bad check digit refused");

    // Analytics: counted by hierarchy through the closure.
    let count_path = format!("/api/terminology/snomed/analytics/count?concept={SUGAR}");
    let (_, before) = get(&app, &app.client, &count_path).await;
    let (_, rollup_before) = get(
        &app,
        &app.client,
        "/api/terminology/snomed/analytics/rollup",
    )
    .await;
    code_diagnoses(&app, &[SUGAR_ONE, SUGAR_TWO, FEVER, "123456789"]).await;
    let (s, after) = get(&app, &app.client, &count_path).await;
    assert_eq!(s, StatusCode::OK, "{after}");
    let delta =
        |field: &str| after[field].as_i64().unwrap_or(0) - before[field].as_i64().unwrap_or(0);
    assert_eq!(delta("records"), 2, "type one and type two: {after}");
    assert_eq!(delta("patients"), 1);
    assert_eq!(
        delta("unknown_codes"),
        1,
        "a code the release lacks is reported"
    );
    let (_, rollup) = get(
        &app,
        &app.client,
        "/api/terminology/snomed/analytics/rollup",
    )
    .await;
    assert_eq!(rollup["parent_id"], ROOT);
    assert_eq!(
        category_records(&rollup, FINDING) - category_records(&rollup_before, FINDING),
        3,
        "{rollup}"
    );

    // Loading the same release again is a no-op.
    let (status, again) = upload(&app, &app.client, &csrf, package()).await;
    assert_eq!(status, StatusCode::OK, "{again}");
    assert_eq!(again["already_imported"], true);
    let concepts_after: i64 =
        sqlx::query_scalar("SELECT count(*) FROM snomed_concept WHERE module_id = $1")
            .bind(MODULE)
            .fetch_one(&app.db)
            .await
            .expect("count");
    assert_eq!(concepts_after, 13);

    // A non-package is refused before anything is queued.
    let (status, _) = upload(&app, &app.client, &csrf, b"not a zip".to_vec()).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    // Permissions: the desk cannot search, a doctor cannot count or load.
    let desk = staff(&app, &csrf, "receptionist").await;
    let (s, _) = get(&app, &desk, "/api/terminology/snomed/search?q=synthetic").await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    let doctor = staff(&app, &csrf, "doctor").await;
    let (s, _) = get(&app, &doctor, "/api/terminology/snomed/search?q=synthetic").await;
    assert_eq!(s, StatusCode::OK, "clinicians browse");
    let (s, _) = get(&app, &doctor, &count_path).await;
    assert_eq!(s, StatusCode::FORBIDDEN, "analytics is its own permission");
    let (s, _) = get(&app, &doctor, "/api/terminology/snomed/releases").await;
    assert_eq!(s, StatusCode::FORBIDDEN, "loading releases is admin-only");
}
