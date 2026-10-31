//! Files a workflow carries, and where they are kept.
//!
//! A run that downloads a scanned discharge summary should not be holding it
//! in memory, writing it into the execution history, and sending it to the
//! editor. Base64 inflates it by a third on the way, and every one of those
//! copies outlives the run.
//!
//! So above a size worth caring about, the bytes go to a store and the item
//! carries a reference instead. Everything downstream still sees one value in
//! one field; what changes is where it lives.

use crate::errors::{CoreError, Result};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

/// The key a reference lives under inside an item.
///
/// Prefixed so it cannot be mistaken for a field somebody's API returned, and
/// so a node can tell a reference from an ordinary object by looking.
pub const BINARY_KEY: &str = "$binary";

/// Files at or above this are kept in a store rather than in the item.
///
/// Below it the copying is cheap and a file on disk is more trouble than the
/// bytes it holds — a small CSV inline is easier to look at in the execution
/// log and needs nothing cleaned up afterwards.
pub const INLINE_LIMIT: usize = 128 * 1024;

/// What is known about a file before it has been stored.
#[derive(Debug, Clone, Default)]
pub struct BinaryMeta {
    /// What to call it when somebody downloads it.
    pub file_name: Option<String>,
    pub mime_type: String,
}

/// Where a file went, and what it was.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BinaryRef {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_name: Option<String>,
    pub mime_type: String,
    pub size: usize,
}

impl BinaryRef {
    /// The value that goes into an item in place of the bytes.
    #[must_use]
    pub fn as_item_value(&self) -> Value {
        json!({ BINARY_KEY: self })
    }

    /// Read a reference back out of an item value, if that is what it is.
    #[must_use]
    pub fn from_item_value(value: &Value) -> Option<Self> {
        serde_json::from_value(value.get(BINARY_KEY)?.clone()).ok()
    }
}

/// Somewhere to keep files that are too big to carry.
#[async_trait]
pub trait BinaryStore: Send + Sync + std::fmt::Debug {
    /// Keep these bytes, and say where they went.
    ///
    /// `execution_id` is what ties a file to the run that produced it, so that
    /// pruning a run's history takes its files with it. A store that lost that
    /// link would fill a disk quietly.
    async fn put(&self, execution_id: &str, meta: &BinaryMeta, bytes: Vec<u8>)
    -> Result<BinaryRef>;

    /// Read a file back.
    async fn get(&self, id: &str) -> Result<Vec<u8>>;

    /// Forget every file belonging to a run. Returns how many went.
    async fn forget(&self, execution_id: &str) -> Result<usize>;
}

/// An engine with nowhere to put files.
///
/// Everything stays in the item, which is what r8r did before there was a
/// store and is still right for an embedding that does not want r8r writing
/// files. Refusing rather than silently inlining a 200 MB scan, because the
/// difference between those two is a run that fails and a process that dies.
#[derive(Debug, Default)]
pub struct NoBinaryStore;

#[async_trait]
impl BinaryStore for NoBinaryStore {
    async fn put(&self, _: &str, meta: &BinaryMeta, bytes: Vec<u8>) -> Result<BinaryRef> {
        Err(CoreError::Node(format!(
            "this file is {} bytes, and r8r has nowhere to put it — \
             configure a binary store, or ask the API for less at a time{}",
            bytes.len(),
            meta.file_name
                .as_ref()
                .map_or_else(String::new, |name| format!(" ({name})"))
        )))
    }

    async fn get(&self, id: &str) -> Result<Vec<u8>> {
        Err(CoreError::Node(format!(
            "`{id}` cannot be read back: this instance has no binary store"
        )))
    }

    async fn forget(&self, _: &str) -> Result<usize> {
        Ok(0)
    }
}

/// A file the workflow is carrying, however it is being carried.
///
/// Nodes that consume a file — the spreadsheet reader, the parsers — take one
/// of these rather than a base64 string, so that a small file passed inline
/// and a large one kept in a store are the same thing to them.
#[derive(Debug, Clone)]
pub enum Carried {
    Inline(Vec<u8>),
    Stored(BinaryRef),
}

impl Carried {
    /// Read what a field holds: a reference, base64 text, or neither.
    #[must_use]
    pub fn read(value: &Value) -> Option<Self> {
        if let Some(reference) = BinaryRef::from_item_value(value) {
            return Some(Carried::Stored(reference));
        }
        let text = value.as_str()?;
        decode_base64(text).map(Carried::Inline)
    }

    /// The bytes themselves, fetching them if they are not here.
    pub async fn bytes(&self, store: &dyn BinaryStore) -> Result<Vec<u8>> {
        match self {
            Carried::Inline(bytes) => Ok(bytes.clone()),
            Carried::Stored(reference) => store.get(&reference.id).await,
        }
    }
}

/// Base64, tolerant of the line breaks that arrive with anything that has been
/// through an email or a config file.
#[must_use]
pub fn decode_base64(text: &str) -> Option<Vec<u8>> {
    use base64::Engine as _;
    let cleaned: String = text.chars().filter(|c| !c.is_whitespace()).collect();
    base64::engine::general_purpose::STANDARD
        .decode(&cleaned)
        .ok()
}

#[must_use]
pub fn encode_base64(bytes: &[u8]) -> String {
    use base64::Engine as _;
    base64::engine::general_purpose::STANDARD.encode(bytes)
}

/// Put a file into an item: inline if it is small, in the store if it is not.
///
/// The threshold is the whole point. Deciding per file rather than per node
/// means a workflow that usually moves small payloads is never paying for a
/// store, and the one day it downloads a 40 MB scan it still works.
pub async fn carry(
    store: &dyn BinaryStore,
    execution_id: &str,
    meta: &BinaryMeta,
    bytes: Vec<u8>,
) -> Result<Value> {
    if bytes.len() < INLINE_LIMIT {
        return Ok(Value::String(encode_base64(&bytes)));
    }
    Ok(store.put(execution_id, meta, bytes).await?.as_item_value())
}
