//! Appointment scheduling + no-show prediction leaf crate. Mounted via router().

use axum::{Router, routing::{get, post, put}};
use medbrains_server_core::state::AppState;

pub mod scheduling;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/scheduling/predictions",
            get(scheduling::list_predictions),
        )
        .route(
            "/api/scheduling/predictions/score",
            post(scheduling::score_appointment),
        )
        .route(
            "/api/scheduling/predictions/score-batch",
            post(scheduling::score_batch),
        )
        .route(
            "/api/scheduling/waitlist",
            get(scheduling::list_waitlist).post(scheduling::create_waitlist_entry),
        )
        .route(
            "/api/scheduling/waitlist/{id}",
            put(scheduling::update_waitlist_entry),
        )
        .route(
            "/api/scheduling/waitlist/{id}/offer",
            post(scheduling::offer_slot),
        )
        .route(
            "/api/scheduling/waitlist/{id}/respond",
            post(scheduling::respond_to_offer),
        )
        .route(
            "/api/scheduling/auto-fill",
            post(scheduling::auto_fill_slots),
        )
        .route(
            "/api/scheduling/overbooking-rules",
            get(scheduling::list_overbooking_rules).post(scheduling::create_overbooking_rule),
        )
        .route(
            "/api/scheduling/overbooking-rules/{id}",
            put(scheduling::update_overbooking_rule).delete(scheduling::delete_overbooking_rule),
        )
        .route(
            "/api/scheduling/overbooking/recommendation",
            get(scheduling::get_overbooking_recommendation),
        )
        .route(
            "/api/scheduling/analytics/noshow-rates",
            get(scheduling::noshow_rates),
        )
        .route(
            "/api/scheduling/analytics/prediction-accuracy",
            get(scheduling::prediction_accuracy),
        )
        .route(
            "/api/scheduling/analytics/waitlist-stats",
            get(scheduling::waitlist_stats),
        )
        .route(
            "/api/scheduling/conflicts",
            get(scheduling::detect_conflicts),
        )
        .route(
            "/api/scheduling/waitlist/promote",
            post(scheduling::promote_waitlist),
        )
        .route(
            "/api/scheduling/analytics/overview",
            get(scheduling::schedule_analytics),
        )
        .route(
            "/api/scheduling/recurring",
            post(scheduling::create_recurring),
        )
        .route(
            "/api/scheduling/blocks",
            post(scheduling::create_block),
        )
}
