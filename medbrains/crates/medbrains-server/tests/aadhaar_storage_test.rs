//! An Aadhaar number entered at registration or in HR is never stored whole,
//! and the registration fingerprint is not the guessable plain hash.

mod common;

use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use uuid::Uuid;

const AADHAAR: &str = "234567890123";

#[tokio::test]
async fn aadhaar_is_kept_masked_and_keyed_never_whole() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let patient: Value = app
        .client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", &csrf)
        .json(&json!({
            "first_name": "Asha", "last_name": "Kumari", "gender": "female",
            "date_of_birth": "1990-01-01",
            "phone": format!("9{:09}", Uuid::new_v4().as_u128() % 1_000_000_000),
            "aadhaar_number": AADHAAR,
        }))
        .send()
        .await
        .expect("register")
        .json()
        .await
        .expect("json");
    let id = patient["id"].as_str().expect("id");

    let (number, hash, tenant): (String, Option<String>, Uuid) = sqlx::query_as(
        "SELECT id_number, id_number_hash, tenant_id FROM patient_identifiers \
         WHERE patient_id = $1::uuid AND id_type = 'aadhaar'",
    )
    .bind(id)
    .fetch_one(&app.db)
    .await
    .expect("identifier");
    assert_eq!(number, "XXXX-XXXX-0123");
    let hash = hash.expect("a fingerprint for duplicate checks");
    let plain: String = Sha256::digest(format!("{tenant}:aadhaar:{AADHAAR}").as_bytes())
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect();
    assert_ne!(
        hash, plain,
        "the fingerprint must need a key the database does not hold"
    );

    let anywhere: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM patients p WHERE p.id = $1::uuid AND p::text LIKE '%' || $2 || '%'",
    )
    .bind(id)
    .bind(AADHAAR)
    .fetch_one(&app.db)
    .await
    .expect("scan");
    assert_eq!(
        anywhere, 0,
        "the whole number is nowhere on the patient row"
    );
}
