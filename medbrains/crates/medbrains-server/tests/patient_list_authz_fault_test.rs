//! The patient list answers an authorization outage with 503, never a page
//! of patients whose every action is quietly switched off.
//!
//! `list_accessible` answering and `bulk_check` failing is the case the list
//! swallowed: the visible set came back, the per-row flags did not, and the
//! rows were served with edit/delete/share all `false`.

use std::sync::Arc;

use async_trait::async_trait;
use axum::extract::{Query, State};
use axum::{Extension, Json};
use medbrains_authz::{AuthzBackend, AuthzContext, AuthzError, Relation, RelationTuple, Subject};
use medbrains_core::permissions;
use medbrains_server::middleware::auth::Claims;
use medbrains_server_core::error::AppError;
use uuid::Uuid;

use crate::common;

/// Lists the patients it was given, then cannot answer any per-row check.
struct ListsThenFails(Vec<Uuid>);

/// The outage every per-row call meets.
fn down<T>() -> Result<T, AuthzError> {
    Err(AuthzError::Other("authz backend unreachable".to_owned()))
}

#[async_trait]
impl AuthzBackend for ListsThenFails {
    async fn check(
        &self,
        _: &AuthzContext,
        _: Relation,
        _: &str,
        _: Uuid,
    ) -> Result<bool, AuthzError> {
        down()
    }
    async fn expand(
        &self,
        _: &AuthzContext,
        _: &str,
        _: Uuid,
    ) -> Result<Vec<RelationTuple>, AuthzError> {
        down()
    }
    async fn list_accessible(
        &self,
        _: &AuthzContext,
        _: &str,
        _: Relation,
    ) -> Result<Vec<Uuid>, AuthzError> {
        Ok(self.0.clone())
    }
    async fn write_tuple(
        &self,
        _: &AuthzContext,
        _: &str,
        _: Uuid,
        _: Relation,
        _: Subject,
        _: Option<chrono::DateTime<chrono::Utc>>,
        _: Option<String>,
    ) -> Result<Uuid, AuthzError> {
        down()
    }
    async fn grant_raw(
        &self,
        _: &AuthzContext,
        _: &str,
        _: Uuid,
        _: &str,
        _: Subject,
        _: Option<chrono::DateTime<chrono::Utc>>,
        _: Option<String>,
    ) -> Result<Uuid, AuthzError> {
        down()
    }
    async fn revoke_tuple(&self, _: &AuthzContext, _: Uuid) -> Result<(), AuthzError> {
        down()
    }
}

#[tokio::test]
async fn a_failed_row_check_is_an_outage_not_a_list() {
    let app = common::spawn_app().await;
    let (tenant, user): (Uuid, Uuid) =
        sqlx::query_as("SELECT tenant_id, id FROM users WHERE username = 'admin'")
            .fetch_one(&app.db)
            .await
            .expect("admin");
    let uhid = format!("UH-LF-{}", &Uuid::new_v4().simple().to_string()[..8]);
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Meena', 'Raghavan', 'female', '9000000001') RETURNING id",
    )
    .bind(tenant)
    .bind(&uhid)
    .fetch_one(&app.db)
    .await
    .expect("patient");

    let mut state = app.state.clone();
    state.authz = Arc::new(ListsThenFails(vec![patient]));
    // A non-bypass role, so the per-row check runs.
    let claims = Claims {
        sub: user,
        tenant_id: tenant,
        role: "doctor".to_owned(),
        permissions: vec![permissions::patients::LIST.to_owned()],
        department_ids: Vec::new(),
        perm_version: 0,
        paired_device_id: None,
        act: None,
        exp: usize::MAX,
    };
    let query = serde_json::from_value(serde_json::json!({})).expect("empty query");
    let answer =
        medbrains_patients::list_patients(State(state), Extension(claims), Query(query)).await;
    match answer {
        Err(AppError::ServiceUnavailable(_)) => {}
        Ok(Json(page)) => panic!(
            "an unanswerable row check served {} patient(s) with their actions switched off",
            page.patients.len()
        ),
        Err(other) => panic!("expected 503, got {other:?}"),
    }
}
