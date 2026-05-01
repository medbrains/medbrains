//! SpiceDB Watch consumer — streams relationship updates and invokes
//! a caller-supplied async callback for each batch of affected users.
//!
//! Used by `medbrains-server::main` to bump `users.perm_version` when
//! a tuple write/delete changes who can see what. Without this,
//! permission revocation only takes effect at JWT expiry (15 min).

use std::collections::HashSet;
use std::future::Future;
use std::time::Duration;

use uuid::Uuid;

const RECONNECT_DELAY: Duration = Duration::from_secs(5);

/// Spawn a long-running watcher. The future never returns — designed
/// to be `tokio::spawn`'d at server boot.
///
/// `on_users_changed` is called every time the SpiceDB stream yields a
/// batch with at least one tuple whose subject is `user:{uuid}`. The
/// caller decides what to do with the affected user IDs (typically:
/// `UPDATE users SET perm_version = perm_version + 1 WHERE id = ANY($1)`).
///
/// On any stream error or disconnect, the loop sleeps and reconnects.
pub async fn run_user_watcher<F, Fut>(endpoint: String, token: String, mut on_users_changed: F)
where
    F: FnMut(Vec<Uuid>) -> Fut + Send + 'static,
    Fut: Future<Output = ()> + Send,
{
    loop {
        match stream_once(&endpoint, &token, &mut on_users_changed).await {
            Ok(()) => {
                // Stream ended normally — server closed it, retry once.
                tracing::info!("watch: stream closed cleanly, reconnecting");
            }
            Err(e) => {
                let msg = e.to_string();
                // SpiceDB v1.39 doesn't expose WatchService at all. The
                // proto we generated references it but the server returns
                // "unknown service authzed.api.v1.WatchService". Without
                // Watch, perm_version invalidation falls back to natural
                // JWT expiry (15 min). That's acceptable for dev; in
                // prod, deploy SpiceDB ≥ v1.46 which exposes WatchService.
                if msg.contains("unknown service") || msg.contains("Unimplemented") {
                    tracing::warn!(
                        error = %e,
                        "watch: SpiceDB build doesn't expose WatchService — exiting consumer. \
                         JWT expiry remains the only invalidation path until SpiceDB upgrade."
                    );
                    return;
                }
                tracing::warn!(error = %e, "watch: stream errored, reconnecting");
            }
        }
        tokio::time::sleep(RECONNECT_DELAY).await;
    }
}

async fn stream_once<F, Fut>(
    endpoint: &str,
    token: &str,
    on_users_changed: &mut F,
) -> Result<(), Box<dyn std::error::Error>>
where
    F: FnMut(Vec<Uuid>) -> Fut,
    Fut: Future<Output = ()>,
{
    use spicedb_rs_proto::authzed::api::v1 as v1;
    use spicedb_rs_proto::authzed::api::v1::watch_service_client::WatchServiceClient;
    use tonic::Request;
    use tonic::transport::Endpoint;

    let channel = Endpoint::from_shared(endpoint.to_owned())?
        .connect()
        .await?;
    let mut client = WatchServiceClient::new(channel);

    let mut req = Request::new(v1::WatchRequest {
        optional_object_types: vec![],
        optional_start_cursor: None,
        optional_relationship_filters: vec![],
        optional_update_kinds: vec![],
    });
    let auth_value = format!("Bearer {token}").parse()?;
    req.metadata_mut().insert("authorization", auth_value);

    let mut stream = client.watch(req).await?.into_inner();
    tracing::info!(endpoint = endpoint, "watch: stream open");

    while let Some(msg) = stream.message().await? {
        let mut affected: HashSet<Uuid> = HashSet::new();
        for update in msg.updates {
            let Some(rel) = update.relationship else {
                continue;
            };
            // Only `user:` subjects matter for perm_version. Tuples
            // between groups/depts cascade through CheckPermission and
            // don't need an explicit JWT bump.
            let Some(subj) = rel.subject.and_then(|s| s.object) else {
                continue;
            };
            if subj.object_type != "user" {
                continue;
            }
            if let Ok(uuid) = Uuid::parse_str(&subj.object_id) {
                affected.insert(uuid);
            }
        }
        if affected.is_empty() {
            continue;
        }
        on_users_changed(affected.into_iter().collect()).await;
    }
    Ok(())
}
