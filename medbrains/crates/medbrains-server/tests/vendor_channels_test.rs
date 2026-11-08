//! Nothing a MedBrains account set up keeps sending or running.
//!
//! A webhook, a pipeline or a connector made by someone at the vendor before
//! the grant rules existed would otherwise go on moving unmasked hospital data
//! for ever. Each is refused at delivery or run time — by the flag, or by the
//! live vendor-domain list, so a configured non-default domain counts too —
//! and flagging an account switches each one off, audited.

use crate::common::{self, TestApp};

use medbrains_outbox::handler::Handler as _;
use serde_json::{Value, json};
use uuid::Uuid;

/// Puts the default vendor-domain list back when a test ends, even on panic.
struct DomainsRestored;

impl Drop for DomainsRestored {
    /// Restore the default list so later tests see the usual rule.
    fn drop(&mut self) {
        medbrains_core::vendor::set_vendor_domains(medbrains_core::vendor::domains_from(
            "medbrains.in",
            false,
        ));
    }
}

/// Use `medbrains.in` plus a partner support domain for this test.
fn with_partner_domain() -> DomainsRestored {
    medbrains_core::vendor::set_vendor_domains(vec![
        "medbrains.in".to_owned(),
        "partner-support.example".to_owned(),
    ]);
    DomainsRestored
}

/// The seeded hospital and its admin.
async fn home(app: &TestApp) -> (Uuid, Uuid) {
    sqlx::query_as("SELECT tenant_id, id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("admin")
}

/// A user at `tenant` with `email`, inserted directly (it never signs in).
/// The local part of `email` gets the username appended, so reruns never
/// collide on an address; the domain, which is what the tests are about, is
/// kept as given.
async fn user_with_email(app: &TestApp, tenant: Uuid, email: &str) -> Uuid {
    let username = format!("vc{}", &Uuid::new_v4().simple().to_string()[..10]);
    let (local, domain) = email.split_once('@').expect("an address");
    let email = format!("{local}.{username}@{domain}");
    sqlx::query_scalar(
        "INSERT INTO users (tenant_id, username, email, password_hash, full_name, role) \
         VALUES ($1, $2, $3, 'x', 'Channel Test', 'receptionist') RETURNING id",
    )
    .bind(tenant)
    .bind(&username)
    .bind(email)
    .fetch_one(&app.db)
    .await
    .expect("user")
}

/// A webhook subscription made by `creator`.
async fn webhook_by(app: &TestApp, tenant: Uuid, creator: Uuid) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO webhook_subscriptions (tenant_id, name, url, signing_secret, event_types, \
                created_by) \
         VALUES ($1, 'Partner feed', 'https://partner.example.invalid/hook', 'secret', \
                 ARRAY['patient.registered'], $2) RETURNING id",
    )
    .bind(tenant)
    .bind(creator)
    .fetch_one(&app.db)
    .await
    .expect("webhook")
}

/// Run the webhook delivery handler once for `subscription`.
async fn deliver(app: &TestApp, tenant: Uuid, subscription: Uuid) -> Result<Value, String> {
    let ctx = common::handler_ctx(
        app,
        tenant,
        "webhook.deliver",
        common::TestSecrets::default(),
    );
    medbrains_outbox::handlers::webhook::WebhookDeliverHandler
        .handle(
            &ctx,
            &json!({ "subscription_id": subscription, "event_type": "patient.registered",
                     "data": { "patient_id": Uuid::nil() } }),
        )
        .await
        .map_err(|e| format!("{e:?}"))
}

/// Given a webhook set up long ago by an account on a configured, non-default
/// vendor domain (a subdomain of it, never flagged), it does not deliver; the
/// same webhook made by the hospital's admin is attempted.
#[tokio::test]
async fn a_webhook_a_vendor_account_made_does_not_deliver() {
    let app = common::spawn_app().await;
    let _restore = with_partner_domain();
    let (tenant, admin) = home(&app).await;
    let vendor = user_with_email(&app, tenant, "eng@help.partner-support.example").await;

    let theirs = webhook_by(&app, tenant, vendor).await;
    let skipped = deliver(&app, tenant, theirs).await.expect("handled");
    assert_eq!(
        skipped["skipped"], "set up by a MedBrains account",
        "{skipped}"
    );

    let ours = webhook_by(&app, tenant, admin).await;
    let attempted = deliver(&app, tenant, ours).await;
    assert!(
        attempted
            .as_ref()
            .map_or(true, |v| v["skipped"] != "set up by a MedBrains account"),
        "the hospital's own webhook was skipped: {attempted:?}"
    );
}

/// Insert an active before-event pipeline on `code`, made by `creator`.
async fn pipeline_by(app: &TestApp, tenant: Uuid, code: &str, creator: Uuid) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO integration_pipelines (tenant_id, name, code, status, trigger_type, \
                trigger_config, created_by) \
         VALUES ($1, 'Gate', $2, 'active', 'internal_event', jsonb_build_object('event_type', $3::text), $4) \
         RETURNING id",
    )
    .bind(tenant)
    .bind(format!("p{}", &Uuid::new_v4().simple().to_string()[..8]))
    .bind(code)
    .bind(creator)
    .fetch_one(&app.db)
    .await
    .expect("pipeline")
}

/// How many times `pipeline` has run.
async fn runs_of(app: &TestApp, pipeline: Uuid) -> i64 {
    sqlx::query_scalar("SELECT COUNT(*) FROM integration_executions WHERE pipeline_id = $1")
        .bind(pipeline)
        .fetch_one(&app.db)
        .await
        .expect("runs")
}

/// Given a before-event pipeline a vendor account made, the event runs the
/// hospital's own pipeline and not the vendor's.
#[tokio::test]
async fn a_pipeline_a_vendor_account_made_does_not_run() {
    let app = common::spawn_app().await;
    let (tenant, admin) = home(&app).await;
    let vendor = user_with_email(&app, tenant, "ops@medbrains.in").await;
    let code = format!(
        "vendor_test.gate_{}",
        &Uuid::new_v4().simple().to_string()[..8]
    );
    sqlx::query(
        "INSERT INTO event_registry (module, entity, action, event_code, phase) \
         VALUES ('vendor_test', 'gate', 'check', $1, 'before')",
    )
    .bind(&code)
    .execute(&app.db)
    .await
    .expect("event");
    let theirs = pipeline_by(&app, tenant, &code, vendor).await;
    let ours = pipeline_by(&app, tenant, &code, admin).await;

    let actor = medbrains_kernel::Actor {
        tenant_id: tenant,
        user_id: admin,
    };
    let tx = medbrains_kernel::begin(&app.db, actor).await.expect("tx");
    medbrains_kernel::events::before(&tx, &code, &json!({}))
        .await
        .expect("gate");
    drop(tx);

    assert_eq!(runs_of(&app, theirs).await, 0, "the vendor's pipeline ran");
    assert_eq!(
        runs_of(&app, ours).await,
        1,
        "the hospital's pipeline did not run"
    );
}

/// Given a connector a vendor account made, calling it is refused.
#[tokio::test]
async fn a_connector_a_vendor_account_made_is_not_called() {
    let app = common::spawn_app().await;
    let (tenant, _) = home(&app).await;
    let vendor = user_with_email(&app, tenant, "ops@medbrains.in").await;
    let connector: Uuid = sqlx::query_scalar(
        "INSERT INTO connectors (tenant_id, connector_type, name, created_by) \
         VALUES ($1, 'custom_http', 'Partner API', $2) RETURNING id",
    )
    .bind(tenant)
    .bind(vendor)
    .fetch_one(&app.db)
    .await
    .expect("connector");
    let called = medbrains_workflow::orchestration::connectors::execute_connector_action(
        &app.db,
        tenant,
        connector,
        "post",
        &json!({}),
    )
    .await;
    let refused = called.expect_err("the connector was called");
    assert!(
        format!("{refused:?}").contains("MedBrains account"),
        "{refused:?}"
    );
}

/// Given accounts on a configured vendor domain with a digest subscription, a
/// pipeline and a connector, the startup back-fill flags them, switches each
/// off (never deletes), audits each per hospital, and a second run changes
/// nothing.
#[tokio::test]
async fn the_startup_back_fill_switches_off_what_vendor_accounts_set_up() {
    let app = common::spawn_app().await;
    let _restore = with_partner_domain();
    let (tenant, _) = home(&app).await;
    let vendor = user_with_email(&app, tenant, "eng@partner-support.example").await;
    let digest: Uuid = sqlx::query_scalar(
        "INSERT INTO eod_digest_subscriptions (tenant_id, user_id) VALUES ($1, $2) RETURNING id",
    )
    .bind(tenant)
    .bind(vendor)
    .fetch_one(&app.db)
    .await
    .expect("digest");
    let pipeline = pipeline_by(&app, tenant, "vendor_test.after", vendor).await;

    let domains = ["partner-support.example"];
    assert!(
        back_fill(&app, &domains, 20).await.expect("flag") >= 1,
        "nothing was flagged"
    );
    assert_eq!(
        back_fill(&app, &domains, 20).await.expect("flag"),
        0,
        "a second run flagged again"
    );

    let (digest_on, pipeline_status): (bool, String) = sqlx::query_as(
        "SELECT (SELECT is_active FROM eod_digest_subscriptions WHERE id = $1), \
                (SELECT status FROM integration_pipelines WHERE id = $2)",
    )
    .bind(digest)
    .bind(pipeline)
    .fetch_one(&app.db)
    .await
    .expect("rows kept");
    assert!(!digest_on, "the digest still sends");
    assert_eq!(pipeline_status, "paused");
    let audited: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM vendor_credential_revocations r \
          JOIN audit_log a ON a.entity_id = r.id AND a.tenant_id = r.tenant_id \
         WHERE r.user_id = $1 AND r.kind IN ('eod_digest_subscription', 'integration_pipeline')",
    )
    .bind(vendor)
    .fetch_one(&app.db)
    .await
    .expect("audit");
    assert_eq!(
        audited, 2,
        "each switch-off is on the hospital's audit chain"
    );
}

/// Run the start-up back-fill with `domains` and a ceiling of `max`.
async fn back_fill(app: &TestApp, domains: &[&str], max: i32) -> Result<i32, String> {
    sqlx::query_scalar::<_, i32>("SELECT public.app_flag_vendor_accounts($1, $2, $3)")
        .bind(domains)
        .bind(medbrains_core::vendor::PUBLIC_SUFFIXES)
        .bind(max)
        .fetch_one(&app.db)
        .await
        .map_err(|e| e.to_string())
}

/// Whether `user` is flagged as a vendor account.
async fn flagged(app: &TestApp, user: Uuid) -> bool {
    sqlx::query_scalar("SELECT is_vendor_staff FROM users WHERE id = $1")
        .bind(user)
        .fetch_one(&app.db)
        .await
        .expect("user")
}

/// A fresh domain nobody else's test uses.
fn fresh_domain(label: &str) -> String {
    format!(
        "{label}{}.example",
        &Uuid::new_v4().simple().to_string()[..8]
    )
}

/// Given `in` (a public suffix) in the list, the back-fill refuses and flags
/// no one, and the parser refuses it before the database is asked.
#[tokio::test]
async fn a_public_suffix_is_refused() {
    let app = common::spawn_app().await;
    let (tenant, _) = home(&app).await;
    let person = user_with_email(&app, tenant, "nurse@hospital.in").await;
    let refused = back_fill(&app, &["in"], 20)
        .await
        .expect_err("in was accepted");
    assert!(refused.contains("public suffix"), "{refused}");
    assert!(!flagged(&app, person).await);
    assert_eq!(medbrains_core::vendor::parse_domains("in").1, vec!["in"]);
}

/// Given a domain that is the hospital's own (its site domain, or the domain
/// its administrator signs in with), the back-fill refuses and flags no one.
#[tokio::test]
async fn the_hospitals_own_domain_is_refused() {
    let app = common::spawn_app().await;
    let (tenant, _) = home(&app).await;
    let site = fresh_domain("site");
    sqlx::query("INSERT INTO site_domains (tenant_id, domain) VALUES ($1, $2)")
        .bind(tenant)
        .bind(&site)
        .execute(&app.db)
        .await
        .expect("site domain");
    let staff = user_with_email(&app, tenant, &format!("desk@{site}")).await;
    let refused = back_fill(&app, &[site.as_str()], 20)
        .await
        .expect_err("site domain accepted");
    assert!(refused.contains("own domain"), "{refused}");
    assert!(!flagged(&app, staff).await);

    let mail = fresh_domain("mail");
    let admin = user_with_email(&app, tenant, &format!("chief@{mail}")).await;
    sqlx::query("UPDATE users SET role = 'hospital_admin' WHERE id = $1")
        .bind(admin)
        .execute(&app.db)
        .await
        .expect("admin");
    let refused = back_fill(&app, &[mail.as_str()], 20)
        .await
        .expect_err("admin domain accepted");
    assert!(refused.contains("own domain"), "{refused}");
    assert!(!flagged(&app, admin).await);
}

/// Given more matching accounts than the ceiling, the back-fill refuses and
/// flags no one.
#[tokio::test]
async fn the_ceiling_stops_the_back_fill() {
    let app = common::spawn_app().await;
    let (tenant, _) = home(&app).await;
    let bulk = fresh_domain("bulk");
    let mut people = Vec::new();
    for n in 0..3 {
        people.push(user_with_email(&app, tenant, &format!("p{n}@{bulk}")).await);
    }
    let refused = back_fill(&app, &[bulk.as_str()], 2)
        .await
        .expect_err("ceiling ignored");
    assert!(refused.contains("ceiling"), "{refused}");
    for person in people {
        assert!(!flagged(&app, person).await, "flagged despite the refusal");
    }
}

/// Given the seeded admin as a hospital's only administrator, adding its
/// domain (what `MEDBRAINS_HOSTED=true` does) is refused rather than locking
/// the hospital out.
#[tokio::test]
async fn hosted_mode_never_locks_a_hospital_out() {
    let app = common::spawn_app().await;
    let other: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) VALUES ($1, 'Lone', 'standalone_clinic') RETURNING id",
    )
    .bind(format!("LN{}", &Uuid::new_v4().simple().to_string()[..8].to_uppercase()))
    .fetch_one(&app.db)
    .await
    .expect("tenant");
    let lone = fresh_domain("lone");
    let only_admin = user_with_email(&app, other, &format!("admin@{lone}")).await;
    sqlx::query("UPDATE users SET role = 'super_admin' WHERE id = $1")
        .bind(only_admin)
        .execute(&app.db)
        .await
        .expect("admin");
    let refused = back_fill(&app, &[lone.as_str()], 20)
        .await
        .expect_err("lock-out accepted");
    assert!(refused.contains("no administrator"), "{refused}");
    assert!(!flagged(&app, only_admin).await);
}

/// Given a correct list, only the accounts on it are flagged.
#[tokio::test]
async fn a_correct_list_flags_only_vendor_accounts() {
    let app = common::spawn_app().await;
    let (tenant, _) = home(&app).await;
    let support = fresh_domain("support");
    let vendor = user_with_email(&app, tenant, &format!("eng@help.{support}")).await;
    let colleague = user_with_email(&app, tenant, &format!("nurse@{}", fresh_domain("ward"))).await;
    assert_eq!(
        back_fill(&app, &[support.as_str()], 20)
            .await
            .expect("flag"),
        1
    );
    assert!(flagged(&app, vendor).await);
    assert!(!flagged(&app, colleague).await);
}
