//! The main-machine agent's view of the server, on loopback. The server holds every decision;
//! this agent only asks. A trait, because the tests stand in for the server here.

use async_trait::async_trait;
use medbrains_core::peer_sync::PeerRosterDoc;
use serde::{Deserialize, Serialize};

use crate::wire::{JoinState, Kind};

const SERVER: &str = "http://127.0.0.1:3000/api/machine-agent";
const TOKEN_HEADER: &str = "x-machine-agent-token";
const REQUEST_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(5);

/// A join request as it goes to the server. No tenant: the server serves one hospital and says
/// which, so nothing a node sent can choose it.
#[derive(Debug, Clone, Serialize)]
pub(crate) struct Filing {
    pub(crate) node_id: String,
    /// Where the connection came from, as this agent saw it. The server limits per address.
    pub(crate) address: String,
    pub(crate) label: String,
    pub(crate) kind: Kind,
    pub(crate) code: String,
    /// What the main machine's screen shows after approval, for a person to type on the node.
    pub(crate) confirm_code: String,
}

/// A connected machine, as reported to the server.
#[derive(Debug, Clone, Serialize)]
pub(crate) struct Seen {
    pub(crate) node_id: String,
    /// The loopback address its connections arrive from, which the audit log records.
    pub(crate) address: String,
}

/// Handshakes given up on, for the server to record and Machines to warn about.
#[derive(Debug, Clone, Copy, Default, Serialize)]
pub(crate) struct GivenUpReport {
    pub(crate) count: u32,
    pub(crate) paused: bool,
}

/// The server's answer about a join request.
#[derive(Debug, Clone, Deserialize)]
pub(crate) struct Answer {
    pub(crate) state: JoinState,
}

/// The server's answer to a sync.
#[derive(Debug, Clone, Deserialize)]
pub(crate) struct Synced {
    pub(crate) hospital: String,
    pub(crate) roster: PeerRosterDoc,
}

/// What the agent needs from the server.
#[async_trait]
pub(crate) trait Hospital: Send + Sync {
    /// Files a request; it grants nothing until a person approves it.
    async fn file_join(&self, filing: &Filing) -> anyhow::Result<Answer>;
    /// Where this key's latest request stands.
    async fn join_state(&self, node_id: &str) -> anyhow::Result<Answer>;
    /// Reports who is connected and gets back who may be.
    async fn sync(&self, connected: &[Seen], given_up: GivenUpReport) -> anyhow::Result<Synced>;
}

/// The real server.
#[derive(Debug)]
pub(crate) struct Server {
    client: reqwest::Client,
    token: String,
}

impl Server {
    /// A client that never leaves this machine.
    pub(crate) fn new(token: String) -> anyhow::Result<Self> {
        let client = reqwest::Client::builder()
            .timeout(REQUEST_TIMEOUT)
            .build()?;
        Ok(Self { client, token })
    }

    /// Reads a JSON answer, turning a refusal into an error.
    async fn read<T: serde::de::DeserializeOwned>(
        request: reqwest::RequestBuilder,
    ) -> anyhow::Result<T> {
        Ok(request.send().await?.error_for_status()?.json().await?)
    }
}

#[async_trait]
impl Hospital for Server {
    async fn file_join(&self, filing: &Filing) -> anyhow::Result<Answer> {
        let request = self.client.post(format!("{SERVER}/join"));
        Self::read(request.header(TOKEN_HEADER, &self.token).json(filing)).await
    }

    async fn join_state(&self, node_id: &str) -> anyhow::Result<Answer> {
        let request = self.client.get(format!("{SERVER}/join/{node_id}"));
        Self::read(request.header(TOKEN_HEADER, &self.token)).await
    }

    async fn sync(&self, connected: &[Seen], given_up: GivenUpReport) -> anyhow::Result<Synced> {
        let request = self.client.post(format!("{SERVER}/sync"));
        let body = serde_json::json!({ "connected": connected, "given_up": given_up });
        Self::read(request.header(TOKEN_HEADER, &self.token).json(&body)).await
    }
}
