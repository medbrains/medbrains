//! Keeping the cached roster current.
//!
//! The appliance admits peers from a roster it holds on disk. Without something
//! refreshing it, an operator places that file by hand and it silently rots:
//! devices paired last week cannot sync, devices retired last week still can —
//! until the 16h staleness ceiling trips and the appliance admits nobody at all.
//!
//! # Why failing to fetch is not an error
//!
//! Losing the server is the case this appliance exists for. A failed refresh
//! keeps the roster already in memory and tries again later; it never clears it
//! and never falls back to admitting more. Staleness is already bounded by
//! `PeerRoster`, so an outage long enough to matter closes the door on its own
//! rather than needing this loop to notice.
//!
//! The disk copy is what survives a restart mid-outage, so it is written
//! atomically — a half-written roster read at boot would be indistinguishable
//! from a hospital that has paired no devices.

use std::path::Path;
use std::sync::{Arc, RwLock};
use std::time::Duration;

use anyhow::{Context, Result, bail};
use medbrains_core::peer_sync::PeerRosterDoc;
use medbrains_edge::peer_roster::PeerRoster;
use tracing::{info, warn};
use uuid::Uuid;

/// Largest roster this appliance will read into memory.
///
/// A hospital's paired-device list is kilobytes. The cap is here so a wrong URL
/// or a compromised endpoint cannot hand a ward box something that exhausts it.
const MAX_ROSTER_BYTES: u64 = 4 * 1024 * 1024;

/// How long a single refresh may take before it is abandoned.
///
/// Short on purpose: this runs on a schedule, so a hung request should be
/// dropped and retried rather than held open against a box with little memory.
const FETCH_TIMEOUT: Duration = Duration::from_secs(30);

/// Refresh the roster on a schedule, for as long as the process runs.
pub(crate) async fn refresh_forever(
    server_url: String,
    token: String,
    tenant_id: Uuid,
    roster_path: std::path::PathBuf,
    every: Duration,
    shared: Arc<RwLock<PeerRoster>>,
) {
    let client = match build_client() {
        Ok(c) => c,
        Err(e) => {
            warn!(error = %e, "could not build the roster client — roster will not refresh");
            return;
        }
    };

    loop {
        match fetch(&client, &server_url, &token, tenant_id).await {
            Ok(doc) => {
                let count = doc.peers.len();
                if let Err(e) = persist(&roster_path, &doc) {
                    // The in-memory roster is still good; only the restart
                    // copy is stale, so this is a warning and not a retreat.
                    warn!(error = %e, "refreshed the roster but could not cache it to disk");
                }
                match shared.write() {
                    Ok(mut guard) => {
                        *guard = to_roster(doc);
                        info!(peers = count, "peer roster refreshed");
                    }
                    Err(e) => warn!(error = %e, "roster lock poisoned — keeping the old roster"),
                }
            }
            // Expected whenever the link to the server is down, which is the
            // situation this appliance is built for.
            Err(e) => {
                warn!(error = %e, "could not refresh the peer roster — keeping the current one");
            }
        }

        tokio::time::sleep(every).await;
    }
}

fn build_client() -> Result<reqwest::Client> {
    reqwest::Client::builder()
        .timeout(FETCH_TIMEOUT)
        .build()
        .context("build http client")
}

async fn fetch(
    client: &reqwest::Client,
    server_url: &str,
    token: &str,
    tenant_id: Uuid,
) -> Result<PeerRosterDoc> {
    let url = format!(
        "{}/api/devices/peer-roster",
        server_url.trim_end_matches('/')
    );

    let response = client
        .get(&url)
        .bearer_auth(token)
        .send()
        .await
        .context("request peer roster")?;

    let status = response.status();
    if !status.is_success() {
        // The body may name the tenant or the reason; the status is enough to
        // act on and enough to log.
        bail!("peer roster request returned {status}");
    }

    // Checked before reading, so an oversized body is refused rather than
    // buffered into a box that cannot hold it.
    if let Some(len) = response.content_length() {
        if len > MAX_ROSTER_BYTES {
            bail!("peer roster is {len} bytes, over the {MAX_ROSTER_BYTES} limit");
        }
    }

    let body = response.bytes().await.context("read peer roster")?;
    if body.len() as u64 > MAX_ROSTER_BYTES {
        bail!("peer roster exceeded {MAX_ROSTER_BYTES} bytes");
    }

    let doc: PeerRosterDoc = serde_json::from_slice(&body).context("parse peer roster")?;

    // A roster for another tenant means this appliance is pointed at the wrong
    // hospital. Taking it would let one hospital's devices sync against
    // another's box.
    if doc.tenant_id != tenant_id {
        bail!("peer roster was issued for another tenant");
    }

    Ok(doc)
}

/// Write the cache atomically.
///
/// A crash partway through a plain write leaves a truncated file that parses as
/// nothing, which at boot is indistinguishable from a hospital that has paired
/// no devices. Rename is atomic on the same filesystem, so a reader sees either
/// the old roster or the new one.
fn persist(path: &Path, doc: &PeerRosterDoc) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).with_context(|| format!("create {parent:?}"))?;
    }
    let tmp = path.with_extension("json.tmp");
    let encoded = serde_json::to_vec(doc).context("encode roster")?;
    std::fs::write(&tmp, encoded).with_context(|| format!("write {tmp:?}"))?;
    std::fs::rename(&tmp, path).with_context(|| format!("replace {path:?}"))
}

pub(crate) fn to_roster(doc: PeerRosterDoc) -> PeerRoster {
    let peers = doc
        .peers
        .into_iter()
        .map(|entry| (entry.node_id, entry.binding))
        .collect();
    PeerRoster::new(doc.tenant_id, doc.issued_at, peers)
}

#[cfg(test)]
#[allow(clippy::expect_used, clippy::unwrap_used)]
mod tests {
    use super::{persist, to_roster};
    use medbrains_core::peer_sync::{PeerBinding, PeerRosterDoc, PeerRosterEntry};
    use uuid::Uuid;

    fn doc(tenant: Uuid, peers: usize) -> PeerRosterDoc {
        PeerRosterDoc {
            tenant_id: tenant,
            issued_at: 1_800_000_000,
            peers: (0..peers)
                .map(|i| PeerRosterEntry {
                    node_id: format!("peer-{i}"),
                    binding: PeerBinding {
                        device_instance_id: Uuid::new_v4(),
                        tenant_id: tenant,
                        device_status: "active".to_owned(),
                        revoked: false,
                    },
                })
                .collect(),
        }
    }

    #[test]
    fn a_cached_roster_reads_back_as_written() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("roster.json");
        let tenant = Uuid::new_v4();

        persist(&path, &doc(tenant, 3)).expect("persist");

        let raw = std::fs::read(&path).expect("read");
        let back: PeerRosterDoc = serde_json::from_slice(&raw).expect("parse");
        assert_eq!(back.peers.len(), 3);
        assert_eq!(back.tenant_id, tenant);
    }

    #[test]
    fn replacing_a_cache_leaves_no_temp_file_behind() {
        // A stray .tmp accumulating on every refresh would fill a ward box's
        // disk over months of uptime.
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("roster.json");
        let tenant = Uuid::new_v4();

        persist(&path, &doc(tenant, 1)).expect("first");
        persist(&path, &doc(tenant, 2)).expect("second");

        let strays: Vec<_> = std::fs::read_dir(dir.path())
            .expect("readdir")
            .filter_map(Result::ok)
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .filter(|name| name.ends_with(".tmp"))
            .collect();
        assert!(strays.is_empty(), "left behind: {strays:?}");

        let raw = std::fs::read(&path).expect("read");
        let back: PeerRosterDoc = serde_json::from_slice(&raw).expect("parse");
        assert_eq!(back.peers.len(), 2, "the newer roster must win");
    }

    #[test]
    fn a_roster_with_no_peers_converts_to_one_that_admits_nobody() {
        let tenant = Uuid::new_v4();
        let roster = to_roster(doc(tenant, 0));
        assert!(roster.is_empty());
        assert_eq!(roster.tenant_id(), tenant);
    }
}
