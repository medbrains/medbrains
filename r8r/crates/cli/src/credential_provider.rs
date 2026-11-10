//! Bridges the execution engine to the credential table.
//!
//! `r8r-core` deliberately knows nothing about storage; this is the adapter
//! that decrypts on demand and hands the engine exactly one credential.

use crate::databases::Database;
use async_trait::async_trait;
use r8r_core::{CoreError, CredentialProvider, ResolvedCredential, Result};
use std::sync::Arc;

#[derive(Clone)]
pub struct DatabaseCredentials {
    db: Arc<Database>,
}

impl std::fmt::Debug for DatabaseCredentials {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        // Deliberately opaque: a Debug print must never reach a secret.
        f.debug_struct("DatabaseCredentials")
            .finish_non_exhaustive()
    }
}

impl DatabaseCredentials {
    #[must_use]
    pub fn new(db: Arc<Database>) -> Self {
        DatabaseCredentials { db }
    }
}

#[async_trait]
impl CredentialProvider for DatabaseCredentials {
    async fn get(&self, id: &str) -> Result<ResolvedCredential> {
        let stored = self
            .db
            .credentials()
            .decrypt(id)?
            .ok_or_else(|| CoreError::Node(format!("credential `{id}` was not found")))?;

        Ok(ResolvedCredential {
            id: stored.summary.id,
            name: stored.summary.name,
            type_name: stored.summary.type_name,
            data: stored.data,
        })
    }
}
