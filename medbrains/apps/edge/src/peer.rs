//! Serving sync over iroh, on this appliance.
//!
//! The WebSocket listener next door works only for devices that can route to
//! this box on the LAN. That covers a ward tablet and misses the cases the
//! appliance exists for — a phone on cellular, a hotspot with client isolation,
//! a vehicle whose wifi drops mid-round. Dialling by public key reaches all of
//! them without this box needing a routable address.
//!
//! # Admitting peers with no database
//!
//! The appliance holds no database, so it cannot look a key up. It admits from
//! a roster the server issues (`GET /api/devices/peer-roster`), cached on disk
//! so a restart during an outage does not cost the ward its sync.
//!
//! Every failure here lands on "admit nobody": no roster, an unreadable one, one
//! issued for another tenant, one too old to trust. That is deliberate and it is
//! the safe direction — a ward that cannot sync is a visible problem someone
//! fixes, and an appliance admitting keys it cannot vouch for is an invisible
//! one nobody does.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use anyhow::{Context, Result, bail};
use medbrains_core::peer_sync::PeerRosterDoc;
use medbrains_edge::iroh_transport::{PeerGatekeeper, build_endpoint, serve_connection};
use medbrains_edge::peer_admission::Admission;
use medbrains_edge::peer_roster::PeerRoster;
use medbrains_edge::sync::SyncServer;
use serde::Deserialize;
use tokio::sync::Semaphore;
use tracing::{error, info, warn};
use uuid::Uuid;

/// Concurrent peer connections this appliance will serve.
///
/// An appliance is a small box in a ward cupboard, not a server. The cap exists
/// so a burst — or something pointed at it deliberately — queues instead of
/// exhausting its memory and taking the LAN listener down with it.
const MAX_CONCURRENT_PEERS: usize = 64;

#[derive(Debug, Deserialize)]
pub(crate) struct IrohConfig {
    /// Off unless an operator turns it on. An appliance that starts dialling
    /// out because a binary was upgraded is not a decision anyone made.
    #[serde(default)]
    pub(crate) enabled: bool,
    /// The hospital this appliance serves.
    pub(crate) tenant_id: Uuid,
    /// This appliance's own key. Created on first run if absent.
    pub(crate) secret_key_path: PathBuf,
    /// Cached roster, refreshed from the server out of band.
    pub(crate) roster_path: PathBuf,
    /// Relay URLs the operator runs. Empty means direct-only: no relay, and no
    /// hospital sync metadata routed through anybody else's infrastructure.
    #[serde(default)]
    pub(crate) relays: Vec<String>,
}

/// Admits peers from the cached roster.
struct RosterGate {
    roster: PeerRoster,
}

impl PeerGatekeeper for RosterGate {
    fn admit(&self, node_id: &str, claimed_tenant: Uuid) -> Admission {
        // `PeerRoster` owns the staleness rule and delegates the rest to the
        // shared admission logic, so this box and a phone reach the same verdict
        // on the same key.
        self.roster
            .admit_peer(node_id, claimed_tenant, now_epoch_seconds())
    }
}

fn now_epoch_seconds() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| i64::try_from(d.as_secs()).unwrap_or(i64::MAX))
}

/// Load this appliance's key, creating one on first run.
///
/// The key file is the appliance's identity: anyone who can read it can be this
/// appliance. It is written `0600`, and a key already on disk with looser
/// permissions is refused rather than used — a node key readable by every
/// account on the box is a device identity that has already been copied, whether
/// or not anybody has got round to it.
fn load_or_create_secret(path: &Path) -> Result<iroh::SecretKey> {
    if path.exists() {
        let bytes = std::fs::read(path).with_context(|| format!("read {path:?}"))?;
        refuse_if_world_readable(path)?;
        let key: [u8; 32] = bytes
            .as_slice()
            .try_into()
            .map_err(|_| anyhow::anyhow!("{path:?} is not a 32-byte node key"))?;
        return Ok(iroh::SecretKey::from_bytes(&key));
    }

    let mut bytes = [0u8; 32];
    getrandom::fill(&mut bytes).context("generate node key")?;

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).with_context(|| format!("create {parent:?}"))?;
    }
    std::fs::write(path, bytes).with_context(|| format!("write {path:?}"))?;
    set_owner_only(path)?;

    info!(?path, "generated this appliance's node key");
    Ok(iroh::SecretKey::from_bytes(&bytes))
}

#[cfg(unix)]
fn set_owner_only(path: &Path) -> Result<()> {
    use std::os::unix::fs::PermissionsExt as _;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))
        .with_context(|| format!("restrict {path:?}"))
}

#[cfg(not(unix))]
fn set_owner_only(_path: &Path) -> Result<()> {
    Ok(())
}

#[cfg(unix)]
fn refuse_if_world_readable(path: &Path) -> Result<()> {
    use std::os::unix::fs::PermissionsExt as _;
    let mode = std::fs::metadata(path)
        .with_context(|| format!("stat {path:?}"))?
        .permissions()
        .mode();
    if mode & 0o077 != 0 {
        bail!(
            "{path:?} is readable beyond its owner (mode {:o}); \
             refusing to use a node key that may already have been copied — \
             chmod 600 it, or delete it to have a new one generated",
            mode & 0o777
        );
    }
    Ok(())
}

#[cfg(not(unix))]
fn refuse_if_world_readable(_path: &Path) -> Result<()> {
    Ok(())
}

/// Read the cached roster.
///
/// A roster issued for a different tenant is refused outright. It is more likely
/// a misconfigured appliance pointed at the wrong hospital than an attack, and
/// either way it must not admit anyone.
fn load_roster(path: &Path, tenant_id: Uuid) -> Result<PeerRoster> {
    let raw = std::fs::read(path).with_context(|| format!("read roster {path:?}"))?;
    let doc: PeerRosterDoc =
        serde_json::from_slice(&raw).with_context(|| format!("parse roster {path:?}"))?;

    if doc.tenant_id != tenant_id {
        bail!("roster at {path:?} was issued for another tenant");
    }

    let peers = doc
        .peers
        .into_iter()
        .map(|entry| (entry.node_id, entry.binding))
        .collect();

    Ok(PeerRoster::new(doc.tenant_id, doc.issued_at, peers))
}

/// Serve peer connections until the process stops.
pub(crate) async fn serve(cfg: IrohConfig, server: Arc<SyncServer>) -> Result<()> {
    let secret = load_or_create_secret(&cfg.secret_key_path)?;

    let roster = load_roster(&cfg.roster_path, cfg.tenant_id).unwrap_or_else(|e| {
        // Not fatal, and not silent. An appliance with no usable roster still
        // serves its LAN listener; it simply admits no peer over iroh until one
        // arrives.
        error!(error = %e, path = ?cfg.roster_path, "no usable peer roster — admitting no peers");
        PeerRoster::new(cfg.tenant_id, 0, Vec::new())
    });

    if roster.is_empty() {
        warn!("peer roster is empty — no device can sync over iroh yet");
    } else {
        info!(peers = roster.len(), "peer roster loaded");
    }

    let relays = parse_relays(&cfg.relays)?;
    if relays.is_none() {
        info!("no relays configured — direct connections only, no third party in the path");
    }

    let endpoint = build_endpoint(secret, relays).await?;
    info!(node_id = %endpoint.node_id(), "iroh sync endpoint listening");

    let gate: Arc<dyn PeerGatekeeper> = Arc::new(RosterGate { roster });
    let slots = Arc::new(Semaphore::new(MAX_CONCURRENT_PEERS));

    while let Some(incoming) = endpoint.accept().await {
        // Acquired before the handshake so a flood queues here rather than
        // inside the process.
        let Ok(slot) = Arc::clone(&slots).acquire_owned().await else {
            break;
        };
        let server = Arc::clone(&server);
        let gate = Arc::clone(&gate);
        let tenant = cfg.tenant_id;

        tokio::spawn(async move {
            let _slot = slot;
            match incoming.await {
                Ok(conn) => {
                    if let Err(e) = serve_connection(server, gate, conn, tenant).await {
                        warn!(error = %e, "peer session ended with an error");
                    }
                }
                Err(e) => warn!(error = %e, "peer handshake failed"),
            }
        });
    }

    Ok(())
}

fn parse_relays(relays: &[String]) -> Result<Option<iroh::RelayMap>> {
    if relays.is_empty() {
        return Ok(None);
    }
    let mut urls = Vec::with_capacity(relays.len());
    for raw in relays {
        urls.push(
            raw.parse::<iroh::RelayUrl>()
                .with_context(|| format!("relay url {raw:?}"))?,
        );
    }
    Ok(Some(iroh::RelayMap::from_iter(urls)))
}

#[cfg(test)]
#[allow(clippy::expect_used, clippy::unwrap_used)]
mod tests {
    use super::{load_or_create_secret, load_roster, parse_relays};
    use medbrains_core::peer_sync::{PeerBinding, PeerRosterDoc, PeerRosterEntry};
    use uuid::Uuid;

    fn write_roster(dir: &tempfile::TempDir, doc: &PeerRosterDoc) -> std::path::PathBuf {
        let path = dir.path().join("roster.json");
        std::fs::write(&path, serde_json::to_vec(doc).expect("encode")).expect("write");
        path
    }

    fn roster_for(tenant: Uuid) -> PeerRosterDoc {
        PeerRosterDoc {
            tenant_id: tenant,
            issued_at: 1_800_000_000,
            peers: vec![PeerRosterEntry {
                node_id: "peer-one".to_owned(),
                binding: PeerBinding {
                    device_instance_id: Uuid::new_v4(),
                    tenant_id: tenant,
                    device_status: "active".to_owned(),
                    revoked: false,
                },
            }],
        }
    }

    #[test]
    fn a_roster_issued_for_another_tenant_is_refused() {
        // A misconfigured appliance pointed at the wrong hospital is the likely
        // cause, and it must admit nobody either way.
        let dir = tempfile::tempdir().expect("tempdir");
        let path = write_roster(&dir, &roster_for(Uuid::new_v4()));
        assert!(load_roster(&path, Uuid::new_v4()).is_err());
    }

    #[test]
    fn a_roster_for_this_tenant_loads_its_peers() {
        let dir = tempfile::tempdir().expect("tempdir");
        let tenant = Uuid::new_v4();
        let path = write_roster(&dir, &roster_for(tenant));
        let roster = load_roster(&path, tenant).expect("load");
        assert_eq!(roster.len(), 1);
        assert_eq!(roster.tenant_id(), tenant);
    }

    #[test]
    fn a_missing_roster_is_an_error_rather_than_an_empty_one() {
        // The caller turns this into "admit nobody" loudly. Returning an empty
        // roster here would make a missing file indistinguishable from a
        // hospital that has genuinely paired no devices.
        let dir = tempfile::tempdir().expect("tempdir");
        assert!(load_roster(&dir.path().join("absent.json"), Uuid::new_v4()).is_err());
    }

    #[test]
    fn a_key_is_generated_once_and_then_reused() {
        // A node key that changed on restart would make every peer's roster
        // wrong the moment the appliance rebooted.
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("node.key");
        let first = load_or_create_secret(&path).expect("create");
        let second = load_or_create_secret(&path).expect("reuse");
        assert_eq!(first.to_bytes(), second.to_bytes());
    }

    #[cfg(unix)]
    #[test]
    fn a_key_readable_by_others_is_refused() {
        use std::os::unix::fs::PermissionsExt as _;
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("node.key");
        load_or_create_secret(&path).expect("create");

        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o644)).expect("chmod");
        let err = load_or_create_secret(&path).expect_err("must refuse");
        assert!(
            err.to_string().contains("readable beyond its owner"),
            "unexpected error: {err}"
        );
    }

    #[test]
    fn no_relays_means_direct_only() {
        // The default must not quietly become somebody else's relay.
        assert!(parse_relays(&[]).expect("parse").is_none());
    }

    #[test]
    fn a_malformed_relay_url_is_refused_rather_than_skipped() {
        // Dropping an unparseable relay would leave an operator believing their
        // relay is in use when it is not.
        assert!(parse_relays(&["not a url".to_owned()]).is_err());
    }
}
