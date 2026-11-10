//! Before anyone signs in, a hospital code names a hospital and the answer is
//! that hospital's sign-in methods — its own identity providers and whether
//! passwords are accepted — never another hospital's. An unknown code and a
//! page not on any hospital's own domain are "not found", so the sign-in page
//! asks for the code.

use crate::common;

use reqwest::StatusCode;
use serde_json::Value;
use uuid::Uuid;

#[tokio::test]
async fn a_hospital_code_answers_with_that_hospitals_sign_in_methods_only() {
    let app = common::spawn_app().await;
    let (tenant, code): (Uuid, String) =
        sqlx::query_as("SELECT t.id, t.code FROM tenants t JOIN users u ON u.tenant_id = t.id WHERE u.username = 'admin'")
            .fetch_one(&app.db)
            .await
            .expect("tenant");
    let tag = Uuid::new_v4().simple().to_string()[..8].to_owned();
    // A provider belonging to another hospital must never be offered here.
    let other: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) VALUES ($1, 'Other Hospital', 'multi_specialty') RETURNING id",
    )
    .bind(format!("OTH{}", tag.to_uppercase()))
    .fetch_one(&app.db)
    .await
    .expect("other tenant");
    for (owner, name) in [
        (tenant, format!("Microsoft {tag}")),
        (other, format!("Elsewhere {tag}")),
    ] {
        sqlx::query(
            "INSERT INTO identity_providers (tenant_id, code, name, protocol, is_active) \
             VALUES ($1, $2, $3, 'oidc', true)",
        )
        .bind(owner)
        .bind(format!("idp-{tag}-{owner}"))
        .bind(name)
        .execute(&app.db)
        .await
        .expect("provider");
    }

    let get = |query: String| {
        let client = app.client.clone();
        let url = app.url(&format!("/api/auth/sign-in-options{query}"));
        async move { client.get(url).send().await.expect("request") }
    };

    let resp = get(format!("?code={}", code.to_lowercase())).await;
    assert_eq!(
        resp.status(),
        StatusCode::OK,
        "codes match case-insensitively"
    );
    let body: Value = resp.json().await.expect("json");
    assert_eq!(body["code"], code.as_str());
    assert_eq!(
        body["password"], true,
        "passwords are on unless the hospital turns them off"
    );
    let names: Vec<&str> = body["providers"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|p| p["name"].as_str())
        .collect();
    assert!(
        names.contains(&format!("Microsoft {tag}").as_str()),
        "{body}"
    );
    assert!(
        !names.contains(&format!("Elsewhere {tag}").as_str()),
        "another hospital's provider leaked: {body}"
    );
    assert!(
        body.get("users").is_none() && body.get("tenant_id").is_none(),
        "nothing beyond the methods: {body}"
    );

    assert_eq!(
        get("?code=NO-SUCH-HOSPITAL".to_owned()).await.status(),
        StatusCode::NOT_FOUND
    );
    // No code, and the test host is no hospital's own domain: ask for the code
    // rather than list every hospital's providers. That is an answer, not an
    // error, so it is 200 with nothing in it.
    let resp = get(String::new()).await;
    assert_eq!(resp.status(), StatusCode::OK);
    assert_eq!(resp.json::<Value>().await.expect("json"), Value::Null);

    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, 'auth', 'password_login_disabled', 'true'::jsonb) \
         ON CONFLICT (tenant_id, category, key) DO UPDATE SET value = EXCLUDED.value, deleted_at = NULL",
    )
    .bind(tenant)
    .execute(&app.db)
    .await
    .expect("disable passwords");
    let body: Value = get(format!("?code={code}"))
        .await
        .json()
        .await
        .expect("json");
    // Settings are soft-deleted, so restore by value, not by DELETE.
    sqlx::query(
        "UPDATE tenant_settings SET value = 'false'::jsonb \
          WHERE tenant_id = $1 AND category = 'auth' AND key = 'password_login_disabled'",
    )
    .bind(tenant)
    .execute(&app.db)
    .await
    .expect("restore");
    assert_eq!(
        body["password"], false,
        "a hospital that turned passwords off says so: {body}"
    );
}
