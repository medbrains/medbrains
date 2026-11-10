//! Persistence. Mirrors `packages/cli/src/databases`.
//!
// ponytail: one SQLite connection behind a Mutex. Queries here are sub-millisecond
// and never held across an await, so contention is not measurable at this scale.
// Swap in a connection pool (r2d2/deadpool) when concurrent executions climb.

mod credential_repository;
mod execution_repository;
mod idempotency_repository;
mod migrations;
mod state_repository;
mod variable_repository;
mod version_repository;
mod wait_repository;
mod worker_repository;
mod workflow_repository;

pub use credential_repository::{CredentialRepository, CredentialSummary, DecryptedCredential};
pub use execution_repository::{
    ExecutionRepository, ExecutionSummary, Lineage, MAX_ATTEMPTS, Opening, StoredExecution,
};
pub use idempotency_repository::{DEFAULT_WINDOW_HOURS, IdempotencyRepository, RecordedResponse};
pub use state_repository::{MAX_KEYS, MAX_VALUE_BYTES, StateRepository};
pub use variable_repository::{
    MAX_VALUE_CHARS as MAX_VARIABLE_CHARS, MAX_VARIABLES, StoredVariable, VariableRepository,
    valid_key,
};
pub use version_repository::{
    KEEP_VERSIONS, StoredVersion, VersionEntry, VersionRepository, WorkflowVersion,
};
pub use wait_repository::{WaitRepository, WaitingRun};
pub use worker_repository::{
    HEARTBEAT_TIMEOUT_SECS, LEASE_SECS, SCHEDULER_LEASE, Worker, WorkerRepository,
};
pub use workflow_repository::{StoredWorkflow, WorkflowRepository};

use r8r_core::Encryptor;
use rusqlite::Connection;
use std::sync::{Mutex, MutexGuard, PoisonError};

pub struct Database {
    conn: Mutex<Connection>,
    encryptor: Encryptor,
}

impl std::fmt::Debug for Database {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Database").finish_non_exhaustive()
    }
}

impl Database {
    /// Open (or create) the database. `encryptor` seals credential data; every
    /// instance needs the same key to read credentials it wrote before.
    pub fn open(path: &str, encryptor: Encryptor) -> rusqlite::Result<Self> {
        let conn = Connection::open(path)?;
        // WAL lets the scheduler write while the API reads.
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        conn.pragma_update(None, "busy_timeout", 5000)?;
        migrations::run(&conn)?;
        Ok(Database {
            conn: Mutex::new(conn),
            encryptor,
        })
    }

    /// A poisoned mutex means a previous query panicked mid-statement; the
    /// connection itself is still usable, so recover rather than abort.
    pub(crate) fn conn(&self) -> MutexGuard<'_, Connection> {
        self.conn.lock().unwrap_or_else(PoisonError::into_inner)
    }

    pub fn workflows(&self) -> WorkflowRepository<'_> {
        WorkflowRepository { db: self }
    }

    pub fn versions(&self) -> VersionRepository<'_> {
        VersionRepository { db: self }
    }

    pub fn variables(&self) -> VariableRepository<'_> {
        VariableRepository { db: self }
    }

    pub fn workers(&self) -> WorkerRepository<'_> {
        WorkerRepository { db: self }
    }

    pub fn executions(&self) -> ExecutionRepository<'_> {
        ExecutionRepository { db: self }
    }

    pub fn idempotency(&self) -> IdempotencyRepository<'_> {
        IdempotencyRepository { db: self }
    }

    pub fn state(&self) -> StateRepository<'_> {
        StateRepository { db: self }
    }

    pub fn waits(&self) -> WaitRepository<'_> {
        WaitRepository { db: self }
    }

    pub fn credentials(&self) -> CredentialRepository<'_> {
        CredentialRepository {
            db: self,
            encryptor: &self.encryptor,
        }
    }
}
