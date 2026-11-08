//! A hospital names its own secrets, never the platform's.
//!
//! Settings that point at a secret (the SMTP password, the AI provider key)
//! take a short name the server resolves inside the hospital's namespace.
//! Scenarios, per site:
//! - a legal short name is accepted and resolves to
//!   `medbrains/<env>/<tenant>/<purpose>-<name>`;
//! - `JWT_PRIVATE_KEY_PEM`, `DATABASE_URL`, `../x` and a full path are refused
//!   when saved and when resolved;
//! - a legacy platform name already stored is refused when resolved and is
//!   never looked up, so nothing is sent;
//! - the generic settings route and the config import refuse the `ai` and
//!   `email` categories, and the export leaves them out.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use medbrains_core::secrets::{SecretError, SecretResolver};
use medbrains_outbox::handler::{Handler, HandlerCtx, HandlerError};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::common;

/// Names that must never be resolved for a hospital.
const REFUSED: [&str; 5] = [
    "JWT_PRIVATE_KEY_PEM",
    "DATABASE_URL",
    "../x",
    "medbrains/dev/00000000-0000-0000-0000-000000000000/smtp-x",
    "SMTP_PASSWORD",
];

/// A resolver that records every key it is asked for and answers from a map.
#[derive(Debug, Default)]
struct Recording {
    asked: Mutex<Vec<String>>,
    values: HashMap<String, String>,
}

#[async_trait::async_trait]
impl SecretResolver for Recording {
    async fn get(&self, key: &str) -> Result<String, SecretError> {
        self.asked.lock().expect("lock").push(key.to_owned());
        self.values
            .get(key)
            .cloned()
            .ok_or_else(|| SecretError::NotFound(key.to_owned()))
    }
}

impl Recording {
    /// Every key asked so far.
    fn asked(&self) -> Vec<String> {
        self.asked.lock().expect("lock").clone()
    }
}

/// A fresh hospital, so no other test sees its settings.
async fn new_tenant(app: &common::TestApp) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) \
         VALUES ($1, 'Secret Names Hospital', 'multi_specialty') RETURNING id",
    )
    .bind(format!("SN{}", Uuid::new_v4().simple().to_string()[..10].to_uppercase()))
    .fetch_one(&app.db)
    .await
    .expect("tenant")
}

/// Store `value` as the tenant's `<category>/config`, bypassing every screen.
async fn store_config(app: &common::TestApp, tenant: Uuid, category: &str, value: &Value) {
    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) VALUES ($1, $2, 'config', $3) \
         ON CONFLICT (tenant_id, category, key) DO UPDATE SET value = EXCLUDED.value, deleted_at = NULL",
    )
    .bind(tenant)
    .bind(category)
    .bind(value)
    .execute(&app.db)
    .await
    .expect("store config");
}

/// An outbox context for `tenant` with `resolver`.
fn ctx(app: &common::TestApp, tenant: Uuid, resolver: Arc<Recording>) -> HandlerCtx {
    HandlerCtx {
        pool: app.db.clone(),
        tenant_id: tenant,
        event_id: Uuid::new_v4(),
        event_type: "email.send".to_owned(),
        actor_user_id: None,
        attempts: 1,
        secret_resolver: resolver,
        http_client: reqwest::Client::new(),
        object_store: Arc::new(medbrains_core::object_store::LocalFsObjectStore::new(
            std::env::temp_dir().join("medbrains-secret-names-test"),
        )),
    }
}

/// An SMTP config pointing at a closed local port, so nothing really leaves.
fn smtp_config(secret: Option<&str>) -> Value {
    json!({
        "provider": "smtp", "smtp_host": "127.0.0.1", "smtp_port": "1",
        "smtp_tls": "starttls", "from_address": "noreply@hospital.example",
        "smtp_username": "noreply@hospital.example", "smtp_password_secret": secret,
    })
}

/// Send one email through the SMTP handler.
async fn send(ctx: &HandlerCtx) -> Result<Value, HandlerError> {
    medbrains_outbox::handlers::email_stub::SmtpSendHandler::new("email.send")
        .handle(
            ctx,
            &json!({ "to": "a@b.example", "subject": "s", "text": "t" }),
        )
        .await
}

#[tokio::test]
async fn a_stored_platform_name_is_never_resolved_for_smtp() {
    let app = common::spawn_app().await;
    let tenant = new_tenant(&app).await;
    for name in REFUSED {
        store_config(&app, tenant, "email", &smtp_config(Some(name))).await;
        let resolver = Arc::new(Recording::default());
        let got = send(&ctx(&app, tenant, Arc::clone(&resolver))).await;
        assert!(
            matches!(got, Err(HandlerError::Permanent(_))),
            "{name}: {got:?}"
        );
        let asked = resolver.asked();
        assert!(
            asked
                .iter()
                .all(|k| k != name && !k.contains("JWT") && !k.contains("DATABASE")),
            "{name} was looked up: {asked:?}"
        );
        assert!(!asked.iter().any(|k| k == "SMTP_PASSWORD"), "{asked:?}");
    }
}

#[tokio::test]
async fn a_short_name_resolves_inside_the_hospital_namespace() {
    let app = common::spawn_app().await;
    let tenant = new_tenant(&app).await;
    store_config(&app, tenant, "email", &smtp_config(Some("mailbox"))).await;
    let resolver = Arc::new(Recording::default());
    // The closed port fails the send; what matters is which key was asked.
    let _ = send(&ctx(&app, tenant, Arc::clone(&resolver))).await;
    let env = medbrains_core::secrets::tenant_name::deploy_env();
    let expected = format!("medbrains/{env}/{tenant}/smtp-mailbox");
    assert!(
        resolver.asked().contains(&expected),
        "{:?}",
        resolver.asked()
    );
}

#[tokio::test]
async fn the_platform_smtp_password_goes_only_to_the_platform_host() {
    let app = common::spawn_app().await;
    let tenant = new_tenant(&app).await;
    store_config(&app, tenant, "email", &smtp_config(None)).await;
    let resolver = Arc::new(Recording {
        values: HashMap::from([
            ("SMTP_HOST".to_owned(), "mail.platform.example".to_owned()),
            ("SMTP_PASSWORD".to_owned(), "platform-password".to_owned()),
        ]),
        ..Recording::default()
    });
    let _ = send(&ctx(&app, tenant, Arc::clone(&resolver))).await;
    let asked = resolver.asked();
    assert!(!asked.iter().any(|k| k == "SMTP_PASSWORD"), "{asked:?}");
    assert!(!asked.iter().any(|k| k == "SMTP_USERNAME"), "{asked:?}");
}

#[tokio::test]
async fn a_password_is_never_sent_without_tls() {
    let app = common::spawn_app().await;
    let tenant = new_tenant(&app).await;
    let mut config = smtp_config(Some("mailbox"));
    config["smtp_tls"] = json!("none");
    store_config(&app, tenant, "email", &config).await;
    let env = medbrains_core::secrets::tenant_name::deploy_env();
    let resolver = Arc::new(Recording {
        values: HashMap::from([(
            format!("medbrains/{env}/{tenant}/smtp-mailbox"),
            "pw".to_owned(),
        )]),
        ..Recording::default()
    });
    let got = send(&ctx(&app, tenant, resolver)).await;
    assert!(
        matches!(&got, Err(HandlerError::Permanent(m)) if m.contains("unencrypted")),
        "{got:?}"
    );
}

#[tokio::test]
async fn the_ai_key_name_is_refused_outside_the_namespace() {
    let app = common::spawn_app().await;
    let tenant = new_tenant(&app).await;
    for name in REFUSED {
        store_config(
            &app,
            tenant,
            "ai",
            &json!({ "provider": "openrouter", "api_key_secret": name }),
        )
        .await;
        let resolver = Arc::new(Recording::default());
        let mut state = app.state.clone();
        state.secret_resolver = Arc::clone(&resolver) as Arc<dyn SecretResolver>;
        let got = medbrains_server_services::llm::resolve_config(&state, &tenant).await;
        assert!(got.is_err(), "{name} resolved");
        assert!(
            resolver.asked().is_empty(),
            "{name}: {:?}",
            resolver.asked()
        );
    }

    store_config(
        &app,
        tenant,
        "ai",
        &json!({ "provider": "openrouter", "api_key_secret": "main" }),
    )
    .await;
    let env = medbrains_core::secrets::tenant_name::deploy_env();
    let key = format!("medbrains/{env}/{tenant}/ai-main");
    let resolver = Arc::new(Recording {
        values: HashMap::from([(key.clone(), "tenant-key".to_owned())]),
        ..Recording::default()
    });
    let mut state = app.state.clone();
    state.secret_resolver = Arc::clone(&resolver) as Arc<dyn SecretResolver>;
    let cfg = medbrains_server_services::llm::resolve_config(&state, &tenant)
        .await
        .expect("a short name resolves");
    assert_eq!(cfg.api_key, "tenant-key");
    assert_eq!(resolver.asked(), vec![key]);
}

#[tokio::test]
async fn saving_email_settings_refuses_names_outside_the_namespace() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let put = |secret: &str, tls: &str| {
        app.client
            .put(app.url("/api/admin/email-settings"))
            .header("x-csrf-token", &csrf)
            .json(&json!({
                "provider": "smtp", "smtp_host": "mail.hospital.example", "smtp_port": "587",
                "smtp_tls": tls, "from_address": "noreply@hospital.example", "from_name": "H",
                "smtp_username": "noreply@hospital.example", "smtp_password_secret": secret,
            }))
            .send()
    };
    let before = app
        .client
        .get(app.url("/api/admin/email-settings"))
        .send()
        .await
        .expect("get");
    let before: Value = before.json().await.expect("json");

    for name in REFUSED {
        let resp = put(name, "starttls").await.expect("put");
        assert_eq!(resp.status(), 400, "{name}");
    }
    assert_eq!(put("mailbox", "none").await.expect("put").status(), 400);

    let saved: Value = put("mailbox", "starttls")
        .await
        .expect("put")
        .json()
        .await
        .expect("json");
    let path = saved["smtp_password_secret_path"].as_str().expect("path");
    assert!(
        path.starts_with("medbrains/") && path.ends_with("/smtp-mailbox"),
        "{path}"
    );

    // Put the admin tenant's email settings back as they were.
    let restore = json!({
        "provider": before["provider"], "smtp_host": before["smtp_host"],
        "smtp_port": before["smtp_port"], "smtp_tls": before["smtp_tls"],
        "from_address": before["from_address"], "from_name": before["from_name"],
        "smtp_username": before["smtp_username"],
    });
    let back = app
        .client
        .put(app.url("/api/admin/email-settings"))
        .header("x-csrf-token", &csrf)
        .json(&restore)
        .send()
        .await
        .expect("restore");
    assert!(back.status().is_success());
}

#[tokio::test]
async fn generic_writers_refuse_categories_with_their_own_endpoint() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    for category in ["ai", "email"] {
        let resp = app
            .client
            .put(app.url("/api/setup/settings"))
            .header("x-csrf-token", &csrf)
            .json(&json!({ "category": category, "key": "config",
                           "value": { "provider": "openrouter", "api_key_secret": "JWT_PRIVATE_KEY_PEM" } }))
            .send()
            .await
            .expect("put");
        assert_eq!(resp.status(), 400, "generic PUT {category}");

        let bundle = json!({ "dry_run": false, "bundle": {
            "bundle_version": 1, "exported_at": "2026-11-08T00:00:00Z", "document_templates": [],
            "settings": [
                { "category": "regression_test", "key": "secret_names_import", "value": "x" },
                { "category": category, "key": "config", "value": { "api_key_secret": "DATABASE_URL" } },
            ] } });
        let resp = app
            .client
            .post(app.url("/api/setup/config-import"))
            .header("x-csrf-token", &csrf)
            .json(&bundle)
            .send()
            .await
            .expect("import");
        assert_eq!(resp.status(), 400, "import {category}");
    }
    // Refused whole: the harmless entry before it was not written either.
    let written: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM tenant_settings \
          WHERE category = 'regression_test' AND key = 'secret_names_import')",
    )
    .fetch_one(&app.db)
    .await
    .expect("check");
    assert!(!written);

    let export: Value = app
        .client
        .get(app.url("/api/setup/config-export"))
        .send()
        .await
        .expect("export")
        .json()
        .await
        .expect("json");
    let categories: Vec<&str> = export["settings"]
        .as_array()
        .expect("settings")
        .iter()
        .filter_map(|s| s["category"].as_str())
        .collect();
    for own in medbrains_server_core::settings_guard::OWN_ENDPOINT_CATEGORIES {
        assert!(!categories.contains(own), "export carried {own}");
    }
}
