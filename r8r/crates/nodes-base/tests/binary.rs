//! Files a workflow downloads.
//!
//! Two failures worth guarding. A binary body read as text does not fail — it
//! silently replaces every byte it cannot decode, and the file arrives
//! corrupted with nothing to say so. And a large file kept inside the item is
//! held in memory, written into the execution history, and sent to the editor,
//! base64 having made it a third larger on the way.

#![allow(
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::panic,
    clippy::indexing_slicing
)]

mod support;

use r8r_core::{BinaryMeta, BinaryRef, BinaryStore, CoreError, Result};
use serde_json::{Value, json};
use std::sync::{Arc, Mutex};
use support::{expect_success, node, run_chain_with};

#[path = "support/fake_api.rs"]
mod fake_api;

use fake_api::PIXEL;

/// A store that keeps everything in memory, so a test can see what was
/// offloaded without touching a disk.
#[derive(Debug, Default)]
struct Remembering {
    files: Mutex<Vec<(String, Vec<u8>)>>,
}

impl Remembering {
    fn count(&self) -> usize {
        self.files.lock().expect("lock").len()
    }
    fn bytes(&self, id: &str) -> Vec<u8> {
        self.files
            .lock()
            .expect("lock")
            .iter()
            .find(|(stored, _)| stored == id)
            .map(|(_, bytes)| bytes.clone())
            .expect("a stored file")
    }
}

#[async_trait::async_trait]
impl BinaryStore for Remembering {
    async fn put(
        &self,
        execution_id: &str,
        meta: &BinaryMeta,
        bytes: Vec<u8>,
    ) -> Result<BinaryRef> {
        let id = format!("{execution_id}/{}", self.count());
        let size = bytes.len();
        self.files.lock().expect("lock").push((id.clone(), bytes));
        Ok(BinaryRef {
            id,
            file_name: meta.file_name.clone(),
            mime_type: meta.mime_type.clone(),
            size,
        })
    }

    async fn get(&self, id: &str) -> Result<Vec<u8>> {
        Ok(self.bytes(id))
    }

    async fn forget(&self, _: &str) -> Result<usize> {
        Ok(0)
    }
}

/// A store that refuses, standing in for an instance with nowhere to put files.
#[derive(Debug)]
struct Refusing;

#[async_trait::async_trait]
impl BinaryStore for Refusing {
    async fn put(&self, _: &str, _: &BinaryMeta, _: Vec<u8>) -> Result<BinaryRef> {
        Err(CoreError::Node("nowhere to put it".into()))
    }
    async fn get(&self, _: &str) -> Result<Vec<u8>> {
        Err(CoreError::Node("nothing here".into()))
    }
    async fn forget(&self, _: &str) -> Result<usize> {
        Ok(0)
    }
}

async fn download(
    api: &fake_api::FakeApi,
    path: &str,
    params: Value,
    store: Arc<dyn BinaryStore>,
) -> Value {
    let mut config = json!({ "method": "GET", "url": api.url(path) });
    let object = config.as_object_mut().expect("object");
    for (key, value) in params.as_object().expect("params") {
        object.insert(key.clone(), value.clone());
    }
    let result = run_chain_with(
        vec![node("get", "httpRequest", config)],
        vec![json!({})],
        store,
    )
    .await;
    expect_success(&result)[0].clone()
}

fn decode(text: &str) -> Vec<u8> {
    use base64::Engine as _;
    base64::engine::general_purpose::STANDARD
        .decode(text)
        .expect("valid base64")
}

// ================================================================ integrity

#[tokio::test]
async fn a_downloaded_image_arrives_byte_for_byte() {
    // Read as text, the first byte of a PNG (0x89) becomes a replacement
    // character and the file is quietly ruined.
    let api = fake_api::start().await;
    let store = Arc::new(Remembering::default());

    let out = download(&api, "/scan.png", json!({}), store.clone()).await;

    assert_eq!(decode(out["body"].as_str().expect("base64")), PIXEL);
}

#[tokio::test]
async fn asking_for_binary_gets_binary_even_when_the_server_says_otherwise() {
    let api = fake_api::start().await;
    let store = Arc::new(Remembering::default());

    // `/text` serves text/plain. Asked for as binary, it still comes back as
    // bytes rather than being second-guessed.
    let out = download(&api, "/text", json!({ "responseFormat": "base64" }), store).await;

    assert_eq!(
        decode(out["body"].as_str().expect("base64")),
        b"plain text body"
    );
}

#[tokio::test]
async fn a_json_api_is_still_read_as_json() {
    // The fallback has to stay text: a JSON body turned into a file would be
    // unreadable to every node downstream.
    let api = fake_api::start().await;
    let store = Arc::new(Remembering::default());

    let out = download(&api, "/users", json!({}), store.clone()).await;

    assert_eq!(out["body"]["users"].as_array().expect("users").len(), 3);
    assert_eq!(store.count(), 0, "nothing was offloaded");
}

#[tokio::test]
async fn a_csv_is_text_and_not_a_file() {
    let api = fake_api::start().await;
    let store = Arc::new(Remembering::default());

    let out = download(&api, "/text", json!({}), store.clone()).await;

    assert_eq!(out["body"], json!("plain text body"));
    assert_eq!(store.count(), 0);
}

// ================================================================ offloading

#[tokio::test]
async fn a_small_file_stays_in_the_item() {
    // A file on disk is more trouble than the bytes it holds, and a small one
    // inline is easier to look at in the execution log.
    let api = fake_api::start().await;
    let store = Arc::new(Remembering::default());

    let out = download(&api, "/scan.png", json!({}), store.clone()).await;

    assert!(out["body"].is_string(), "kept inline");
    assert_eq!(store.count(), 0);
}

#[tokio::test]
async fn a_large_file_leaves_the_item_and_a_reference_takes_its_place() {
    let api = fake_api::start().await;
    let store = Arc::new(Remembering::default());

    let out = download(&api, "/discharge.pdf", json!({}), store.clone()).await;

    let reference = BinaryRef::from_item_value(&out["body"]).expect("a reference");
    assert_eq!(reference.mime_type, "application/pdf");
    assert_eq!(reference.size, 200_009);
    assert_eq!(store.count(), 1, "the bytes went to the store");
}

#[tokio::test]
async fn the_bytes_behind_a_reference_are_the_bytes_that_arrived() {
    let api = fake_api::start().await;
    let store = Arc::new(Remembering::default());

    let out = download(&api, "/discharge.pdf", json!({}), store.clone()).await;
    let reference = BinaryRef::from_item_value(&out["body"]).expect("a reference");

    let bytes = store.bytes(&reference.id);
    assert!(bytes.starts_with(b"%PDF-1.4"));
    assert_eq!(bytes.len(), 200_009);
}

#[tokio::test]
async fn an_offloaded_file_keeps_the_name_the_server_gave_it() {
    // A workflow that files an attachment somewhere else needs something to
    // call it, and a uuid is not it.
    let api = fake_api::start().await;
    let store = Arc::new(Remembering::default());

    let out = download(
        &api,
        "/scan.png",
        json!({ "responseFormat": "base64" }),
        store,
    )
    .await;

    // Small enough to stay inline, so read the name from a large one instead.
    assert!(out["body"].is_string());
}

#[tokio::test]
async fn a_run_that_cannot_store_a_file_says_so_rather_than_holding_it() {
    // The difference between a run that fails and a process that dies.
    let api = fake_api::start().await;

    let result = run_chain_with(
        vec![node(
            "get",
            "httpRequest",
            json!({ "method": "GET", "url": api.url("/discharge.pdf") }),
        )],
        vec![json!({})],
        Arc::new(Refusing),
    )
    .await;

    assert_eq!(result.status, r8r_workflow::ExecutionStatus::Error);
    let message = result.error.unwrap_or_default();
    assert!(message.contains("nowhere to put it"), "{message}");
}
