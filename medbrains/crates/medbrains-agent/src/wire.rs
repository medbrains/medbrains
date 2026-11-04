//! What a node and the main machine say to each other: newline-delimited JSON on one stream.
//!
//! Frames refuse unknown fields, so a node cannot slip in a tenant or a role: neither has a place
//! here. The node's key comes from the connection, the tenant from admission.

use anyhow::{Context, bail};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use tokio::io::{AsyncBufRead, AsyncBufReadExt, AsyncReadExt, AsyncWrite, AsyncWriteExt};

/// Anyone may ask to join on this protocol. It grants nothing.
pub(crate) const JOIN_ALPN: &[u8] = b"medbrains/join/1";
/// Carries a screen to the main machine. Only admitted keys get past the door.
pub(crate) const TUNNEL_ALPN: &[u8] = b"medbrains/tunnel/1";
/// The main machine's fixed iroh port, which the firewall opens.
pub(crate) const IROH_PORT: u16 = 7844;
/// Answers "who are you?" for a typed address, because dialling iroh needs the key.
pub(crate) const WHOAMI_PORT: u16 = 7845;
/// Keeps these machines apart from every other iroh application on the LAN.
pub(crate) const MDNS_SERVICE: &str = "medbrains-main";
/// Enough for the certificate; anything longer is refused rather than allocated for.
const MAX_FRAME: u64 = 64 * 1024;

/// What a machine is for. Sets `paired_devices.app_variant`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum Kind {
    Workstation,
    Display,
}

/// The node's opening: who it says it is, and its commitment.
#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct Hello {
    pub(crate) name: String,
    pub(crate) kind: Kind,
    pub(crate) commitment: String,
}

/// One side's nonce, in hex.
#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct NonceFrame {
    pub(crate) nonce: String,
}

/// Where a join request stands. Only `Approved` grants anything.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum JoinState {
    Pending,
    Approved,
    Rejected,
    Expired,
    /// Too many machines are already waiting.
    Busy,
}

impl JoinState {
    /// True when nothing more will change it.
    pub(crate) const fn is_final(self) -> bool {
        !matches!(self, Self::Pending)
    }
}

/// The main machine's news about a request. `certificate` comes only with `Approved`.
#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct StatusFrame {
    pub(crate) state: JoinState,
    pub(crate) hospital: Option<String>,
    pub(crate) certificate: Option<String>,
}

/// Reads one frame, refusing anything oversized.
pub(crate) async fn read_frame<T: DeserializeOwned>(
    reader: &mut (impl AsyncBufRead + Unpin),
) -> anyhow::Result<T> {
    let mut line = Vec::new();
    let read = reader.take(MAX_FRAME).read_until(b'\n', &mut line).await?;
    if read == 0 || !line.ends_with(b"\n") {
        bail!("the frame ended early or is too long");
    }
    serde_json::from_slice(&line).context("read a frame")
}

/// Writes one frame.
pub(crate) async fn write_frame<T: Serialize>(
    writer: &mut (impl AsyncWrite + Unpin),
    frame: &T,
) -> anyhow::Result<()> {
    let mut line = serde_json::to_vec(frame)?;
    line.push(b'\n');
    writer.write_all(&line).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{Hello, read_frame};

    /// A node cannot state a tenant: the frame has no such field, and extras are refused.
    #[tokio::test]
    async fn a_frame_naming_a_tenant_is_refused() {
        let frame = br#"{"name":"PC","kind":"display","commitment":"00","tenant_id":"x"}
"#;
        assert!(read_frame::<Hello>(&mut &frame[..]).await.is_err());
        let honest = br#"{"name":"PC","kind":"display","commitment":"00"}
"#;
        assert!(read_frame::<Hello>(&mut &honest[..]).await.is_ok());
    }

    #[tokio::test]
    async fn an_oversized_frame_is_refused() {
        let frame = vec![b'x'; 70 * 1024];
        assert!(read_frame::<Hello>(&mut frame.as_slice()).await.is_err());
    }
}
