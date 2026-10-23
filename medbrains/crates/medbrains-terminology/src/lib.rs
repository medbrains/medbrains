//! SNOMED CT terminology service: a local PostgreSQL store loaded from the
//! licensed RF2 release packages — the International Edition plus any
//! number of extensions (the `NRCeS` India packages among them), each
//! recorded as a release with its modules and version.
//!
//! * [`package`] / [`rf2`] / [`load`] — check, unpack and stream a package
//!   into the component tables;
//! * [`closure`] — derived terms and the IS-A transitive closure, computed
//!   once per import;
//! * [`search`] / [`concept`] / [`ecl`] — bounded reads;
//! * [`analytics`] — a tenant's coded records counted by hierarchy.
//!
//! Every endpoint is authenticated and every result capped (licence clause
//! 2.2.4: no bulk extraction). No SNOMED content ships with the code; the
//! tests use a synthetic release.

pub mod analytics;
pub mod closure;
pub mod concept;
pub mod ecl;
pub mod http_admin;
pub mod http_query;
pub mod ids;
pub mod job;
pub mod load;
pub mod package;
pub mod release;
pub mod rf2;
pub mod sctid;
pub mod search;

use axum::Router;
use axum::extract::DefaultBodyLimit;
use axum::routing::{get, post};
use medbrains_server_core::state::AppState;

/// Protected routes — mounted behind the auth middleware.
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/terminology/snomed/status", get(http_query::get_status))
        .route("/api/terminology/snomed/search", get(http_query::search_concepts))
        .route("/api/terminology/snomed/concepts/{id}", get(http_query::get_concept))
        .route(
            "/api/terminology/snomed/concepts/{id}/hierarchy",
            get(http_query::get_concept_hierarchy),
        )
        .route("/api/terminology/snomed/subsumes", get(http_query::check_subsumption))
        .route("/api/terminology/snomed/ecl", get(http_query::evaluate_ecl))
        .route(
            "/api/terminology/snomed/analytics/count",
            get(http_query::count_coded_records),
        )
        .route(
            "/api/terminology/snomed/analytics/rollup",
            get(http_query::rollup_coded_records),
        )
        .route("/api/terminology/snomed/releases", get(http_admin::list_releases))
        .route("/api/terminology/snomed/releases/{id}", get(http_admin::get_release))
        // The upload enforces its own limit while streaming to disk.
        .route(
            "/api/terminology/snomed/releases/upload",
            post(http_admin::upload_release).layer(DefaultBodyLimit::disable()),
        )
        .route(
            "/api/terminology/snomed/releases/import-path",
            post(http_admin::import_from_path),
        )
        .route(
            "/api/terminology/snomed/import-files",
            get(http_admin::list_import_files),
        )
}
