//! Sequences: UHIDs, numbers, tokens.
//!
//! Wraps `medbrains_db::sequence::next_sequence` — the atomic
//! `INSERT … ON CONFLICT DO UPDATE … RETURNING` on the `sequences` table.

use crate::{AppError, Tx};

/// How a sequence is formatted when it is first created. Once the row
/// exists, its stored prefix and width win.
#[derive(Debug, Clone, Copy)]
pub struct Format<'a> {
    pub prefix: &'a str,
    pub pad_width: i32,
}

/// The next value of the unit of work's hospital's `kind` sequence, e.g.
/// `ACMS-2026-00042`. Atomic: two concurrent callers never get the same value.
#[inline]
pub async fn next(tx: &mut Tx, kind: &str, format: Format<'_>) -> Result<String, AppError> {
    let tenant_id = tx.actor().tenant_id;
    let value = medbrains_db::sequence::next_sequence(
        tx.transaction(),
        tenant_id,
        kind,
        format.prefix,
        format.pad_width,
    )
    .await?;
    Ok(value)
}
