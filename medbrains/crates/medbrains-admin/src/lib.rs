//! Admin/multi-tenant leaf crate: hospital groups (multi_hospital), system-state
//! + DB-topology admin, blog, news feed. Mounted via router().

use axum::{Router, routing::{delete, get, post}};
use medbrains_server_core::state::AppState;

pub mod admin_db_topology;
pub mod admin_system_state;
pub mod blog;
pub mod multi_hospital;
pub mod news_feed;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/multi-hospital/groups",
            get(multi_hospital::list_groups).post(multi_hospital::create_group),
        )
        .route(
            "/api/multi-hospital/groups/{id}",
            get(multi_hospital::get_group)
                .put(multi_hospital::update_group)
                .delete(multi_hospital::delete_group),
        )
        // Regions
        .route(
            "/api/multi-hospital/regions",
            get(multi_hospital::list_regions).post(multi_hospital::create_region),
        )
        .route(
            "/api/multi-hospital/regions/{id}",
            get(multi_hospital::get_region).delete(multi_hospital::delete_region),
        )
        // Hospitals in Group
        .route(
            "/api/multi-hospital/hospitals",
            get(multi_hospital::list_all_hospitals),
        )
        .route(
            "/api/multi-hospital/groups/{group_id}/hospitals",
            get(multi_hospital::list_hospitals_in_group),
        )
        .route(
            "/api/multi-hospital/hospital-assignments",
            post(multi_hospital::assign_hospital_to_group),
        )
        .route(
            "/api/multi-hospital/hospital-assignments/{tenant_id}",
            delete(multi_hospital::remove_hospital_from_group),
        )
        // User Assignments
        .route(
            "/api/multi-hospital/users/{user_id}/assignments",
            get(multi_hospital::list_user_assignments),
        )
        .route(
            "/api/multi-hospital/user-assignments",
            get(multi_hospital::list_multi_hospital_users)
                .post(multi_hospital::create_user_assignment),
        )
        .route(
            "/api/multi-hospital/user-assignments/{assignment_id}",
            delete(multi_hospital::delete_user_assignment),
        )
        // Patient Transfers
        .route(
            "/api/multi-hospital/transfers/patients/outgoing",
            get(multi_hospital::list_outgoing_transfers),
        )
        .route(
            "/api/multi-hospital/transfers/patients/incoming",
            get(multi_hospital::list_incoming_transfers),
        )
        .route(
            "/api/multi-hospital/transfers/patients",
            post(multi_hospital::create_patient_transfer),
        )
        .route(
            "/api/multi-hospital/transfers/patients/{id}",
            get(multi_hospital::get_patient_transfer)
                .put(multi_hospital::update_patient_transfer),
        )
        // Stock Transfers
        .route(
            "/api/multi-hospital/transfers/stock/outgoing",
            get(multi_hospital::list_outgoing_stock_transfers),
        )
        .route(
            "/api/multi-hospital/transfers/stock/incoming",
            get(multi_hospital::list_incoming_stock_transfers),
        )
        .route(
            "/api/multi-hospital/transfers/stock",
            post(multi_hospital::create_stock_transfer),
        )
        .route(
            "/api/multi-hospital/transfers/stock/{id}",
            get(multi_hospital::get_stock_transfer)
                .put(multi_hospital::update_stock_transfer),
        )
        .route(
            "/api/multi-hospital/transfers/stock/{transfer_id}/items",
            get(multi_hospital::get_stock_transfer_items),
        )
        // Group KPIs & Dashboard
        .route(
            "/api/multi-hospital/groups/{group_id}/dashboard",
            get(multi_hospital::get_group_dashboard),
        )
        .route(
            "/api/multi-hospital/groups/{group_id}/kpis",
            get(multi_hospital::list_group_kpis),
        )
        .route(
            "/api/multi-hospital/hospitals/{tenant_id}/kpi",
            get(multi_hospital::get_hospital_kpi),
        )
        // Doctor Rotation
        .route(
            "/api/multi-hospital/groups/{group_id}/rotations",
            get(multi_hospital::list_doctor_rotations)
                .post(multi_hospital::create_doctor_rotation),
        )
        .route(
            "/api/multi-hospital/doctors/{doctor_id}/rotations",
            get(multi_hospital::get_doctor_rotation),
        )
        .route(
            "/api/multi-hospital/rotations/{id}",
            delete(multi_hospital::delete_doctor_rotation),
        )
        // Group Masters
        .route(
            "/api/multi-hospital/groups/{group_id}/drugs",
            get(multi_hospital::list_group_drugs),
        )
        .route(
            "/api/multi-hospital/groups/{group_id}/tests",
            get(multi_hospital::list_group_tests),
        )
        .route(
            "/api/multi-hospital/groups/{group_id}/tariffs",
            get(multi_hospital::list_group_tariffs),
        )
        .route(
            "/api/multi-hospital/price-overrides",
            get(multi_hospital::list_price_overrides),
        )
        // Group Templates
        .route(
            "/api/multi-hospital/groups/{group_id}/templates",
            get(multi_hospital::list_group_templates)
                .post(multi_hospital::create_group_template),
        )
        .route(
            "/api/multi-hospital/templates/{id}",
            get(multi_hospital::get_group_template)
                .delete(multi_hospital::delete_group_template),
        )
        .route(
            "/api/admin/system_state",
            get(admin_system_state::get_system_state)
                .post(admin_system_state::update_system_state),
        )
        .route("/api/blog", get(blog::list_blog).post(blog::create_blog))
        .route(
            "/api/blog/{id}",
            get(blog::get_blog).put(blog::update_blog).delete(blog::delete_blog),
        )
        .route("/api/news-feed", get(news_feed::list_news_feed))
        .route(
            "/api/news-feed/{id}",
            get(news_feed::get_news_feed_article),
        )
        .route(
            "/api/admin/db-topology",
            get(admin_db_topology::get_db_topology)
                .post(admin_db_topology::update_db_topology),
        )
}
