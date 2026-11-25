//! The link check of the audit hash-chain walk, kept apart from the paging.
//!
//! Each row's hash is recomputed from its canonical input, which names its
//! `prev_hash`; that alone proves a row was not edited. It does not prove
//! the chain is whole: delete a row, or insert one whose hash is computed
//! honestly, and every remaining row still hashes correctly. Only comparing
//! each row's `prev_hash` with the row before it catches that.
//!
//! "The row before it" is the insertion order, which the table does not
//! store. `audit_log_hash_chain()` links a new row to the row with the
//! greatest `(created_at, id)` at the moment it inserts, under a per-tenant
//! lock, and `created_at` is the *transaction's* start time. So a transaction
//! that began before another but wrote its audit row after it gets an older
//! `created_at` than its parent. Walking in `(created_at, id)` order:
//!
//! - a row whose `prev_hash` is the current head is on the main line;
//! - any other row must be such a late writer: its parent is a main-line row
//!   still ahead in the walk, so it waits until that row is seen;
//! - a row still waiting when the walk ends points at a row that is not
//!   there, or not where it should be: the chain is broken there.
//!
//! Ceiling, measured on a fresh hospital: rows written in one transaction
//! share `created_at`, so the trigger links each to the one with the greatest
//! random `id` so far, and most of them end up as leaves too. A leaf (late
//! writer or same-transaction row) has no child whose `prev_hash` would dangle,
//! so deleting one, or forging one in that position, cannot be seen by any
//! walk of this chain. Deleting or inserting a main-line row is caught. Closing
//! the gap needs the trigger to stamp rows in lock order (`clock_timestamp()`
//! or a per-tenant counter) so the chain is a line; that is a migration on the
//! busiest table and the owner's call, not done here.

use std::collections::HashMap;

use sha2::{Digest, Sha256};
use uuid::Uuid;

/// One audit row as the walk sees it: `(id, hash, canonical input, prev_hash)`.
pub(crate) struct LinkRow<'a> {
    pub id: Uuid,
    pub hash: &'a str,
    pub canonical: Option<&'a str>,
    pub prev_hash: Option<&'a str>,
}

/// Late writers allowed to wait for their parent at once. A whole chain cut
/// in two would otherwise make every later row wait, without bound.
const MAX_WAITING: usize = 10_000;

/// Walk state carried across pages.
#[derive(Debug, Default)]
pub(crate) struct ChainWalk {
    /// Hash of the latest main-line row; `""` before the first row.
    head: String,
    /// `prev_hash` → the first waiting row's position and id.
    waiting: HashMap<String, (u64, Uuid)>,
    seen: u64,
    pub rows_checked: i64,
    pub rows_legacy_skipped: i64,
    pub broken_at: Option<Uuid>,
}

impl ChainWalk {
    /// Start a walk whose first row should link to `head` (`""` for the
    /// whole chain, the hash of the row just before a partial walk).
    pub(crate) fn starting_at(head: String) -> Self {
        Self {
            head,
            ..Self::default()
        }
    }

    /// Feed the next row in `(created_at, id)` order. Returns `false` once
    /// the chain is known broken, so the caller can stop reading.
    pub(crate) fn push(&mut self, row: &LinkRow<'_>) -> bool {
        self.seen += 1;
        let Some(canonical) = row.canonical else {
            // Pre-canonical legacy rows cannot be recomputed or link-checked;
            // they still head the chain the rows after them link into.
            self.rows_legacy_skipped += 1;
            self.advance(row.hash);
            return true;
        };
        if hex::encode(Sha256::digest(canonical.as_bytes())) != row.hash {
            self.broken_at = Some(row.id);
            return false;
        }
        self.rows_checked += 1;
        let prev = row.prev_hash.unwrap_or("");
        if prev == self.head {
            self.advance(row.hash);
        } else {
            self.waiting
                .entry(prev.to_owned())
                .or_insert((self.seen, row.id));
            if self.waiting.len() > MAX_WAITING {
                self.broken_at = self.first_waiting();
                return false;
            }
        }
        true
    }

    /// The walk is over: any row still waiting links to nothing.
    pub(crate) fn finish(mut self) -> Self {
        if self.broken_at.is_none() {
            self.broken_at = self.first_waiting();
        }
        self
    }

    /// The hash the next main-line row must link to.
    pub(crate) fn head(&self) -> &str {
        &self.head
    }

    /// Make `hash` the head and release the late writers waiting on it.
    fn advance(&mut self, hash: &str) {
        self.waiting.remove(hash);
        hash.clone_into(&mut self.head);
    }

    /// The earliest row still waiting for its parent.
    fn first_waiting(&self) -> Option<Uuid> {
        self.waiting
            .values()
            .min_by_key(|(at, _)| *at)
            .map(|(_, id)| *id)
    }
}
