//! Census-driven pacer for autonomous agent runs.
//!
//! Instead of a cron a human sets, the pacer drives agent activity at the
//! volume a real hospital would have RIGHT NOW: today's target (size ×
//! season/holiday scale) spread across the day by a clinical hour-of-day
//! curve, minus what the sim has already produced today (live census). It
//! returns how many agent episodes to fire this tick to track that curve —
//! full volume by day's end, self-correcting to the numbers on the ground.

use chrono::{Timelike, Utc};
use medbrains_core::simulator::AgentProfile;
use medbrains_server_core::state::AppState;
use uuid::Uuid;

use super::{calendar, seasonality};

/// Per-tick episode cap — a runaway guard (NOT a cost cap; full volume is the
/// chosen policy). Firing is sequential per tick, so this bounds one tick's
/// work; raise it and add a worker pool if you need higher throughput.
const MAX_PER_TICK: u32 = 25;

/// Relative OPD arrival weight by hour of day (index 0 = midnight). Clinical
/// shape: opens ~07:00, mid-morning + late-afternoon peaks, tapers by ~20:00.
const OPD_HOURLY: [f32; 24] = [
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.05, 0.35, 0.85, 1.0, 1.0, 0.9, 0.7, 0.6, 0.75, 0.9, 0.8, 0.55,
    0.3, 0.15, 0.05, 0.0, 0.0, 0.0,
];

/// Fraction of the day's volume that should have arrived by `now` — the
/// cumulative hour curve, interpolated within the current hour.
fn cumulative_fraction(hour: usize, minute_frac: f32) -> f32 {
    let total: f32 = OPD_HOURLY.iter().sum();
    if total <= 0.0 {
        return 0.0;
    }
    let full: f32 = OPD_HOURLY.iter().take(hour).sum();
    let partial = OPD_HOURLY.get(hour).copied().unwrap_or(0.0) * minute_frac;
    (full + partial) / total
}

/// Today's OPD target for this hospital, scaled for season and holidays.
#[allow(clippy::cast_precision_loss)]
fn target_today(profile: &AgentProfile) -> f32 {
    let today = Utc::now().date_naive();
    let holiday_scale = if calendar::lookup(today).is_some() {
        0.2
    } else {
        1.0
    };
    // Season lightly nudges total volume (monsoon / peak seasons run busier).
    let season = seasonality::season_for(today, "IN");
    let season_scale = if season.boosted_icds.is_empty() {
        1.0
    } else {
        1.15
    };
    profile.hospital_daily_opd as f32 * holiday_scale * season_scale
}

/// How many agent episodes to fire this tick to catch up to the daily curve.
#[allow(clippy::cast_precision_loss, clippy::cast_possible_truncation, clippy::cast_sign_loss)]
pub async fn episodes_for_tick(state: &AppState, tenant_id: &Uuid, profile: &AgentProfile) -> u32 {
    let now = Utc::now();
    let minute_frac = (f32::from(now.minute() as u16) * 60.0 + f32::from(now.second() as u16)) / 3600.0;
    let expected_by_now =
        target_today(profile) * cumulative_fraction(now.hour() as usize, minute_frac);

    let produced = produced_today(state, tenant_id).await;
    let deficit = (expected_by_now - produced as f32).max(0.0);
    (deficit.floor() as u32).min(MAX_PER_TICK)
}

/// Live census signal: dummy OPD encounters the sim has produced so far today.
async fn produced_today(state: &AppState, tenant_id: &Uuid) -> i64 {
    let Ok(mut tx) = state.db.begin().await else {
        return 0;
    };
    if medbrains_db::pool::set_tenant_context(&mut tx, tenant_id)
        .await
        .is_err()
    {
        return 0;
    }
    let count: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM encounters \
         WHERE is_dummy = true AND created_at::date = CURRENT_DATE",
    )
    .fetch_one(&mut *tx)
    .await
    .unwrap_or(0);
    let _ = tx.commit().await;
    count
}

#[cfg(test)]
mod tests {
    use super::cumulative_fraction;

    #[test]
    fn zero_before_open() {
        assert_eq!(cumulative_fraction(0, 0.0), 0.0);
        assert_eq!(cumulative_fraction(5, 0.0), 0.0);
    }

    #[test]
    fn full_by_end_of_day() {
        assert!((cumulative_fraction(23, 1.0) - 1.0).abs() < 0.001);
    }

    #[test]
    fn monotonic_across_the_day() {
        assert!(cumulative_fraction(9, 0.0) > cumulative_fraction(7, 0.0));
        assert!(cumulative_fraction(18, 0.0) > cumulative_fraction(9, 0.0));
    }
}
