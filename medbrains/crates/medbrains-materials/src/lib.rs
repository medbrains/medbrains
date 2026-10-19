//! Materials/facilities-ops leaf crate: procurement, housekeeping. Mounted via router().

use axum::{Router, routing::{get,post,put}};
use medbrains_server_core::state::AppState;

pub mod catalog_merge;
pub mod grn;
pub mod grn_lines;
pub mod grn_match;
pub mod grn_post;
pub mod grn_scan;
pub mod grn_scan_commit;
pub mod grn_scan_contract;
pub mod grn_scan_review;
pub mod grn_validate;
pub mod housekeeping;
pub mod procurement;
pub mod ops;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/procurement/vendors",
            get(procurement::list_vendors).post(procurement::create_vendor),
        )
        .route(
            "/api/procurement/vendors/{id}",
            get(procurement::get_vendor).put(procurement::update_vendor),
        )
        .route(
            "/api/procurement/store-locations",
            get(procurement::list_store_locations).post(procurement::create_store_location),
        )
        .route(
            "/api/procurement/store-locations/{id}",
            put(procurement::update_store_location),
        )
        .route(
            "/api/procurement/purchase-orders",
            get(procurement::list_purchase_orders).post(procurement::create_purchase_order),
        )
        .route(
            "/api/procurement/purchase-orders/{id}",
            get(procurement::get_purchase_order),
        )
        .route(
            "/api/procurement/purchase-orders/{id}/approve",
            put(procurement::approve_purchase_order),
        )
        .route(
            "/api/procurement/purchase-orders/{id}/send",
            put(procurement::send_purchase_order),
        )
        .route(
            "/api/procurement/purchase-orders/{id}/cancel",
            put(procurement::cancel_purchase_order),
        )
        .route(
            "/api/procurement/grns",
            get(procurement::list_grns).post(grn::create_grn),
        )
        .route(
            "/api/procurement/grns/{id}",
            get(procurement::get_grn),
        )
        .route(
            "/api/procurement/grns/{id}/complete",
            put(grn_post::complete_grn),
        )
        // ── Supplier-bill scans (#4861) ──────────────────────
        .route(
            "/api/procurement/grn-scans",
            get(grn_scan::list_scans).post(grn_scan::create_scan),
        )
        .route("/api/procurement/grn-scans/claim", post(grn_scan::claim_scan))
        .route("/api/procurement/grn-scans/accuracy", get(grn_scan_review::scan_accuracy))
        .route("/api/procurement/grn-scans/item-search", get(grn_scan_review::item_search))
        .route("/api/procurement/grn-scans/{id}/review", get(grn_scan_review::review_scan))
        .route("/api/procurement/grn-scans/{id}/draft", put(grn_scan_review::save_draft))
        .route("/api/procurement/grn-scans/{id}/submit", post(grn_scan::submit_scan))
        .route("/api/procurement/grn-scans/{id}/discard", post(grn_scan::discard_scan))
        .route("/api/procurement/grn-scans/{id}/parse-result", post(grn_scan::parse_result))
        .route("/api/procurement/grn-scans/{id}/commit", post(grn_scan_commit::commit_scan))
        .route("/api/pharmacy/catalog/duplicates", get(catalog_merge::list_duplicates))
        .route("/api/pharmacy/catalog/merge", post(catalog_merge::merge_items))
        .route(
            "/api/procurement/rate-contracts",
            get(procurement::list_rate_contracts).post(procurement::create_rate_contract),
        )
        .route(
            "/api/procurement/rate-contracts/{id}",
            get(procurement::get_rate_contract),
        )
        .route(
            "/api/procurement/batch-stock",
            get(procurement::list_batch_stock),
        )
        // ── Procurement Phase 2 ─────────────────────────────
        .route("/api/procurement/vendor-performance", get(procurement::vendor_performance))
        .route(
            "/api/procurement/vendors/{id}/ledger",
            get(procurement::vendor_ledger),
        )
        .route("/api/procurement/vendor-comparison", get(procurement::vendor_comparison))
        .route("/api/procurement/emergency-purchase", post(procurement::create_emergency_po))
        .route(
            "/api/procurement/supplier-payments",
            get(procurement::list_supplier_payments).post(procurement::create_supplier_payment),
        )
        .route(
            "/api/procurement/supplier-payments/{id}",
            put(procurement::update_supplier_payment),
        )
        .route(
            "/api/housekeeping/schedules",
            get(housekeeping::list_cleaning_schedules)
                .post(housekeeping::create_cleaning_schedule),
        )
        .route(
            "/api/housekeeping/schedules/{id}",
            put(housekeeping::update_cleaning_schedule),
        )
        .route(
            "/api/housekeeping/tasks",
            get(housekeeping::list_cleaning_tasks)
                .post(housekeeping::create_cleaning_task),
        )
        .route(
            "/api/housekeeping/tasks/{id}/status",
            put(housekeeping::update_task_status),
        )
        .route(
            "/api/housekeeping/tasks/{id}/verify",
            put(housekeeping::verify_task),
        )
        .route(
            "/api/housekeeping/turnarounds",
            get(housekeeping::list_turnarounds)
                .post(housekeeping::create_turnaround),
        )
        .route(
            "/api/housekeeping/turnarounds/{id}/complete",
            put(housekeeping::complete_turnaround),
        )
        .route(
            "/api/housekeeping/pest-control",
            get(housekeeping::list_pest_control_schedules)
                .post(housekeeping::create_pest_control_schedule),
        )
        .route(
            "/api/housekeeping/pest-control/{id}",
            put(housekeeping::update_pest_control_schedule),
        )
        .route(
            "/api/housekeeping/pest-control-logs",
            get(housekeeping::list_pest_control_logs)
                .post(housekeeping::create_pest_control_log),
        )
        .route(
            "/api/housekeeping/linen",
            get(housekeeping::list_linen_items)
                .post(housekeeping::create_linen_item),
        )
        .route(
            "/api/housekeeping/linen/{id}",
            put(housekeeping::update_linen_item),
        )
        .route(
            "/api/housekeeping/linen-movements",
            get(housekeeping::list_linen_movements)
                .post(housekeeping::create_linen_movement),
        )
        .route(
            "/api/housekeeping/laundry-batches",
            get(housekeeping::list_laundry_batches)
                .post(housekeeping::create_laundry_batch),
        )
        .route(
            "/api/housekeeping/laundry-batches/{id}/complete",
            put(housekeeping::complete_laundry_batch),
        )
        .route(
            "/api/housekeeping/par-levels",
            get(housekeeping::list_par_levels)
                .post(housekeeping::upsert_par_level),
        )
        .route(
            "/api/housekeeping/condemnations",
            get(housekeeping::list_condemnations)
                .post(housekeeping::create_condemnation),
        )
        .route(
            "/api/housekeeping/bmw/schedule",
            get(housekeeping::get_bmw_schedule),
        )
        .route(
            "/api/housekeeping/bmw/sharp-replacement",
            post(housekeeping::create_sharp_replacement),
        )
}
