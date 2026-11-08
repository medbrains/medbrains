//! A recording never outlives 24 hours unsaved. Saving the note deletes it at
//! once ([`crate::review`]); this pass deletes the ones left behind and marks
//! their sessions abandoned. The transcript stays only on a saved session.

use std::time::Duration;

use sqlx::PgPool;

const PASS_INTERVAL: Duration = Duration::from_mins(15);
/// How long an unsaved recording is held.
pub const HOLD_HOURS: i32 = 24;

/// Run [`purge_expired`] every fifteen minutes on `pool` (the worker pool,
/// which sees every tenant).
pub fn spawn(pool: PgPool) {
    tokio::spawn(async move {
        loop {
            match purge_expired(&pool, HOLD_HOURS).await {
                Ok(0) => {}
                Ok(purged) => tracing::info!(purged, "dictation recordings past 24 hours deleted"),
                Err(error) => tracing::error!(%error, "dictation purge pass failed"),
            }
            tokio::time::sleep(PASS_INTERVAL).await;
        }
    });
}

/// Delete every recording older than `hours`, mark its session abandoned
/// (unless it was saved or rejected) and drop an unsaved transcript with it.
/// Returns how many recordings went.
///
/// # Errors
/// The database error; the next pass tries again.
pub async fn purge_expired(pool: &PgPool, hours: i32) -> Result<u64, sqlx::Error> {
    let done = sqlx::query!(
        "WITH gone AS ( \
           DELETE FROM dictation_audio a USING dictation_sessions s \
            WHERE s.id = a.session_id AND s.created_at < now() - make_interval(hours => $1) \
           RETURNING a.session_id) \
         UPDATE dictation_sessions s \
            SET audio_deleted_at = now(), \
                status = CASE WHEN s.status IN ('saved', 'rejected') THEN s.status ELSE 'abandoned' END, \
                transcript = CASE WHEN s.status = 'saved' THEN s.transcript END, \
                draft = CASE WHEN s.status = 'saved' THEN s.draft END \
           FROM gone WHERE s.id = gone.session_id",
        hours,
    )
    .execute(pool)
    .await?;
    Ok(done.rows_affected())
}
