//! The dashboard crate's HTTP routes: dashboards, widgets and the launcher.
//!
//! Kept apart from `lib.rs` so the handlers' file stays inside its size
//! allowance (`scripts/check_rust_size.py`).

use axum::routing::{get, post, put};
use medbrains_server_core::state::AppState;

use crate::{
    batch_widget_data, dashboard_summary, get_dashboard, get_my_dashboard, get_widget_data,
    launcher, list_dashboards, list_widget_templates, my_widgets, personalize_dashboard, work,
};

/// Dashboards, widget templates, widget data and the launcher routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/users/me/launcher", get(launcher::get_launcher))
        .route("/api/users/me/favourites", put(launcher::set_favourite))
        .route("/api/users/me/work", get(work::get_my_work))
        .route("/api/dashboards", get(list_dashboards))
        .route("/api/dashboards/my", get(get_my_dashboard))
        .route(
            "/api/dashboards/my/personalize",
            post(personalize_dashboard),
        )
        .route(
            "/api/dashboards/my/widgets/{code}",
            put(my_widgets::set_my_widget),
        )
        .route(
            "/api/dashboards/my/report-widgets/{report_id}",
            put(my_widgets::set_my_report_widget),
        )
        .route("/api/dashboards/{id}", get(get_dashboard))
        .route("/api/widget-templates", get(list_widget_templates))
        .route("/api/dashboard/summary", get(dashboard_summary))
        .route("/api/dashboard/widget-data/batch", post(batch_widget_data))
        .route(
            "/api/dashboard/widget-data/{widget_id}",
            get(get_widget_data),
        )
}
