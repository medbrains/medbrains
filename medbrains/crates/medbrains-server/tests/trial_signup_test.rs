//! Self-serve trials. A hospital's own server never takes a second sign-up —
//! that would put a stranger's organisation beside its patients. The trial
//! server (`TRIAL_SIGNUP=open`) does: the new hospital gets a 30-day trial,
//! the sizing it was quoted, and an administrator of that hospital only —
//! never a platform administrator.
//!
//! Run both ways: `cargo test --test trial_signup_test` proves the door is
//! shut; with `TRIAL_SIGNUP=open` it proves the trial.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

fn signup(tag: &str, plan: Option<Value>) -> Value {
    let code = format!("TR{}", tag.to_uppercase());
    let mut body = json!({
        "hospital_name": format!("Trial Hospital {tag}"),
        "hospital_code": code,
        "hospital_type": "multi_specialty",
        "admin_full_name": "Trial Admin",
        "admin_username": format!("trial_{tag}"),
        "admin_email": format!("admin@trial-{tag}.example"),
        "admin_password": "Trial#2026pass",
    });
    if let Some(plan) = plan {
        body["plan"] = plan;
    }
    body
}

#[tokio::test]
async fn a_second_hospital_signs_up_only_on_the_trial_server() {
    let app = common::spawn_app().await;
    let tag = Uuid::new_v4().simple().to_string()[..8].to_owned();
    let plan = json!({ "beds": 120, "staff_users": 150, "imaging": true,
                       "placement": "dedicated_cloud" });
    let status: Value = app
        .get(&app.client, "/api/onboarding/status")
        .await
        .json()
        .await
        .expect("status");
    let open = std::env::var("TRIAL_SIGNUP").is_ok_and(|v| v.eq_ignore_ascii_case("open"));
    assert_eq!(status["trial_open"], open, "{status}");

    let resp = app
        .client
        .post(app.url("/api/onboarding/init"))
        .header("x-forwarded-for", format!("198.51.100.{}", tag.len()))
        .json(&signup(&tag, Some(plan)))
        .send()
        .await
        .expect("init");
    if !open {
        assert_eq!(resp.status(), StatusCode::FORBIDDEN, "a hospital's server takes no sign-ups");
        return;
    }
    assert_eq!(resp.status(), StatusCode::OK);
    let created: Value = resp.json().await.expect("init json");
    assert_eq!(created["role"], "hospital_admin", "never a platform administrator");
    assert!(created["trial_ends_at"].is_string());

    let tenant: Uuid = created["tenant_id"].as_str().and_then(|s| s.parse().ok()).expect("tenant");
    let (status, beds, quoted, days): (String, i32, Value, f64) = sqlx::query_as(
        "SELECT status, beds, sizing, \
                (EXTRACT(EPOCH FROM trial_ends_at - created_at) / 86400)::float8 \
           FROM tenant_subscriptions WHERE tenant_id = $1",
    )
    .bind(tenant)
    .fetch_one(&app.db)
    .await
    .expect("subscription");
    assert_eq!(status, "trial");
    assert_eq!(beds, 120);
    assert_eq!(quoted["tier"], "medium", "{quoted}");
    assert!(quoted["infra_monthly_inr"].as_u64().is_some_and(|inr| inr > 0));
    assert!((days - 30.0).abs() < 0.01, "a 30-day trial: {days}");
    let role: String = sqlx::query_scalar("SELECT role::text FROM users WHERE tenant_id = $1")
        .bind(tenant)
        .fetch_one(&app.db)
        .await
        .expect("admin");
    assert_eq!(role, "hospital_admin");

    // On the trial server, a sign-up must say what the facility is.
    let resp = app
        .client
        .post(app.url("/api/onboarding/init"))
        .json(&signup(&format!("{tag}x"), None))
        .send()
        .await
        .expect("init without plan");
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);

    // A fourth trial from one address in a day is refused.
    let ip = format!("203.0.113.{}", u8::from_str_radix(&tag[..2], 16).unwrap_or(7));
    let mut last = StatusCode::OK;
    for n in 0..4 {
        let small = json!({ "beds": 0, "staff_users": 5, "placement": "shared_cloud" });
        last = app
            .client
            .post(app.url("/api/onboarding/init"))
            .header("x-forwarded-for", &ip)
            .json(&signup(&format!("{tag}{n}"), Some(small)))
            .send()
            .await
            .expect("repeat")
            .status();
    }
    assert_eq!(last, StatusCode::CONFLICT, "the fourth trial from one address");
}
