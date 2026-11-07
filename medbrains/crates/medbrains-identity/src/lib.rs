//! Identity leaf crate: IAM access requests, enterprise SSO.

use axum::{
    Router,
    routing::{delete, get, post, put},
};
use medbrains_server_core::state::AppState;

pub mod iam;
pub mod sso;
pub mod sso_link;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/iam/access-requests",
            get(iam::list_access_requests).post(iam::create_access_request),
        )
        .route(
            "/api/iam/access-requests/{id}/approve",
            post(iam::approve_access_request),
        )
        .route(
            "/api/iam/access-requests/{id}/reject",
            post(iam::reject_access_request),
        )
        .route(
            "/api/iam/access-requests/{id}/revoke",
            post(iam::revoke_access_request),
        )
        .route(
            "/api/admin/sso/providers",
            get(sso::list_providers).post(sso::create_provider),
        )
        .route(
            "/api/admin/sso/providers/{id}",
            put(sso::update_provider).delete(sso::delete_provider),
        )
        .route(
            "/api/admin/sso/providers/{id}/mappings",
            get(sso::list_mappings).post(sso::create_mapping),
        )
        .route("/api/admin/sso/mappings/{id}", delete(sso::delete_mapping))
        .route(
            "/api/admin/identity/kanidm/people",
            get(sso_link::list_kanidm_people),
        )
        .route(
            "/api/admin/users/{id}/sso-link",
            get(sso_link::get_link)
                .put(sso_link::set_link)
                .delete(sso_link::remove_link),
        )
}
