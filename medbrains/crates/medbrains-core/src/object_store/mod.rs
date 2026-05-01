//! `ObjectStore` — substrate-agnostic blob storage.
//!
//! Used by media uploads (DICOM, lab attachments, prescription PDFs).
//! Cloud impl = S3 in `medbrains-server`. On-prem impl = `LocalFs`
//! here (no MinIO daemon — Rust binary handles it directly).

pub mod cold_local;
pub mod local;
pub mod tiering;

pub use cold_local::ColdLocalObjectStore;
pub use tiering::{
    transition_hash, ObjectStoragePolicy, StorageTier, StorageTierTransition,
};

use async_trait::async_trait;
use std::fmt;

#[derive(Debug)]
pub enum ObjectStoreError {
    NotFound(String),
    Io(String),
    Backend(String),
}

impl fmt::Display for ObjectStoreError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NotFound(k) => write!(f, "object not found: {k}"),
            Self::Io(m) => write!(f, "object_store io: {m}"),
            Self::Backend(m) => write!(f, "object_store backend: {m}"),
        }
    }
}

impl std::error::Error for ObjectStoreError {}

#[async_trait]
pub trait ObjectStore: Send + Sync + fmt::Debug {
    async fn put(&self, key: &str, bytes: Vec<u8>, content_type: Option<&str>) -> Result<(), ObjectStoreError>;
    async fn get(&self, key: &str) -> Result<Vec<u8>, ObjectStoreError>;
    async fn delete(&self, key: &str) -> Result<(), ObjectStoreError>;
    async fn exists(&self, key: &str) -> Result<bool, ObjectStoreError>;
}

pub use local::LocalFsObjectStore;
