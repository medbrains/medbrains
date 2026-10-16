//! Hourly lock of equipment whose calibration has fallen overdue (NABH FMS,
//! NABL ISO 15189 §5.3). A calibration that goes past its due date at
//! midnight is locked — and its equipment taken out of service — within the
//! hour, whether or not anybody opens the BME screen.

use std::time::Duration;

use sqlx::PgPool;

const PASS_INTERVAL_SECS: u64 = 3600;

pub fn spawn(pool: PgPool) {
    tokio::spawn(async move {
        loop {
            match medbrains_bme::calibration_lock::sweep(&pool).await {
                Ok(locked) if locked > 0 => {
                    tracing::warn!(locked, "equipment locked — calibration overdue or failed");
                }
                Ok(_) => {}
                Err(error) => tracing::error!(%error, "calibration lock pass failed"),
            }
            tokio::time::sleep(Duration::from_secs(PASS_INTERVAL_SECS)).await;
        }
    });
}
