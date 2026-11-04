//! The screen's way to talk to the agent: one line of JSON each way on a Unix socket only the
//! screen's group can open. A web page cannot reach a Unix socket, so no token is needed.

use std::os::unix::fs::PermissionsExt;
use std::path::Path;
use std::sync::Arc;

use serde::Deserialize;
use serde_json::{Value, json};
use tokio::io::{AsyncWriteExt, BufReader};
use tokio::net::{UnixListener, UnixStream};

use crate::node::Node;
use crate::wire::{Kind, read_frame};

const SOCKET_MODE: u32 = 0o660;

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
    }
}

/// One connection: one request, one answer.
async fn serve(node: Arc<Node>, stream: UnixStream) -> anyhow::Result<()> {
    let (read, mut write) = stream.into_split();
    let request: Request = read_frame(&mut BufReader::new(read)).await?;
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
    loop {
        let (stream, _) = listener.accept().await?;
        let node = Arc::clone(&node);
        tokio::spawn(async move {
            if let Err(error) = serve(node, stream).await {
                tracing::info!(%error, "the screen's request failed");
            }
        });
    }
}
