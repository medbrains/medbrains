//! The screen's way to talk to the agent: one line of JSON each way on a Unix socket only the
//! screen's group can open. A web page cannot reach a Unix socket, so no token is needed.

use std::os::unix::fs::PermissionsExt;
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;

use serde::Deserialize;
use serde_json::{Value, json};
use tokio::io::{AsyncWriteExt, BufReader};
use tokio::net::{UnixListener, UnixStream};
use tokio::sync::Semaphore;

use crate::node::Node;
use crate::wire::{Kind, read_frame};

const SOCKET_MODE: u32 = 0o660;
/// A screen that opens this and says nothing is dropped.
const READ_TIMEOUT: Duration = Duration::from_secs(5);
/// One screen asks one thing at a time; this leaves room and no more.
const MAX_CONNECTIONS: usize = 8;
const ACCEPT_RETRY: Duration = Duration::from_secs(1);

/// A request from the screen.
#[derive(Debug, Deserialize)]
#[serde(tag = "op", rename_all = "lowercase", deny_unknown_fields)]
enum Request {
    /// The main machines seen so far.
    Discover,
    /// Ask a typed address who it is.
    Find { address: String },
    /// Ask to join a main machine on the list.
    Join { id: String, name: String, kind: Kind },
    /// How the join stands.
    Status,
    /// The digits a person read off the main machine's screen.
    Confirm { code: String },
    /// The main machine this machine joined, and where it last looked.
    Main,
    /// Look for the joined main machine at a typed address. Its key must match.
    Readdress { address: String },
}

/// The answer to one request.
async fn answer(node: &Arc<Node>, request: Request) -> Value {
    match request {
        Request::Discover => json!({ "found": node.found() }),
        Request::Find { address } => match address.trim().parse() {
            Ok(ip) => match node.find_address(ip).await {
                Ok(found) => json!({ "found": [found] }),
                Err(_) => json!({ "error": "Nothing answered at that address." }),
            },
            Err(_) => json!({ "error": "That is not an address, such as 192.168.1.20." }),
        },
        Request::Join { id, name, kind } => match node.start_join(&id, name, kind) {
            Ok(()) => json!({ "ok": true }),
            Err(error) => json!({ "error": error.to_string() }),
        },
        Request::Status => json!(node.standing()),
        Request::Confirm { code } => match node.confirm(&code).await {
            Ok(()) => json!({ "ok": true }),
            Err(error) => json!({ "error": error.to_string() }),
        },
        Request::Main => match node.joined() {
            Ok(Some(joined)) => json!({ "hospital": joined.hospital, "addresses": joined.addresses }),
            Ok(None) => json!({ "error": "This machine has not joined." }),
            Err(error) => json!({ "error": error.to_string() }),
        },
        Request::Readdress { address } => match address.trim().parse() {
            Ok(ip) => match node.readdress(ip).await {
                Ok(()) => json!({ "ok": true }),
                Err(error) => json!({ "error": error.to_string() }),
            },
            Err(_) => json!({ "error": "That is not an address, such as 192.168.1.20." }),
        },
    }
}

/// One connection: one request, one answer.
async fn serve(node: Arc<Node>, stream: UnixStream) -> anyhow::Result<()> {
    let (read, mut write) = stream.into_split();
    let mut reader = BufReader::new(read);
    let request: Request = tokio::time::timeout(READ_TIMEOUT, read_frame(&mut reader)).await??;
    let mut line = answer(&node, request).await.to_string();
    line.push('\n');
    write.write_all(line.as_bytes()).await?;
    Ok(())
}

/// Serves the screen for as long as the agent runs.
pub(crate) async fn serve_forever(node: Arc<Node>, path: &Path) -> anyhow::Result<()> {
    drop(std::fs::remove_file(path));
    let listener = UnixListener::bind(path)?;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(SOCKET_MODE))?;
    let limit = Arc::new(Semaphore::new(MAX_CONNECTIONS));
    // A loop meant never to end: a failed accept, such as too many open files, must not stop the
    // agent carrying the screen.
    loop {
        let stream = match listener.accept().await {
            Ok((stream, _)) => stream,
            Err(error) => {
                tracing::warn!(%error, "the screen's socket could not accept");
                tokio::time::sleep(ACCEPT_RETRY).await;
                continue;
            }
        };
        let Ok(permit) = Arc::clone(&limit).try_acquire_owned() else {
            continue;
        };
        let node = Arc::clone(&node);
        tokio::spawn(async move {
            let _permit = permit;
            if let Err(error) = serve(node, stream).await {
                tracing::info!(%error, "the screen's request failed");
            }
        });
    }
}
