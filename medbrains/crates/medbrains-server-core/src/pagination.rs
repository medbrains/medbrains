//! Shared server-side pagination — a query extractor + a `{ data, meta }` response.
//!
//! Replaces the hardcoded `LIMIT 5000` list pattern (which silently drops rows past
//! the cap). Endpoints take `?page&limit`, run `LIMIT $lim OFFSET $off` + a `COUNT(*)`,
//! and return `Paginated<T>`. Reuse this everywhere — do not hand-roll per endpoint.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Default page size when the client doesn't ask, and the hard ceiling so a caller
/// can't request an unbounded page.
const DEFAULT_LIMIT: i64 = 50;
const MAX_LIMIT: i64 = 200;

/// `?page=..&limit=..` query params. `#[serde(default)]` so `?` works with no params.
#[derive(Debug, Clone, Copy, Default, Deserialize)]
pub struct Pagination {
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

impl Pagination {
    /// Rows per page, clamped to `[1, MAX_LIMIT]`.
    #[must_use]
    pub fn limit(&self) -> i64 {
        self.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT)
    }

    /// 1-based page number, floored at 1.
    #[must_use]
    pub fn page(&self) -> i64 {
        self.page.unwrap_or(1).max(1)
    }

    /// SQL `OFFSET` for the current page.
    #[must_use]
    pub fn offset(&self) -> i64 {
        (self.page() - 1) * self.limit()
    }
}

#[derive(Debug, Serialize)]
pub struct PageMeta {
    pub total: i64,
    pub page: i64,
    pub limit: i64,
}

/// A page of results plus the totals the client needs to render a pager.
#[derive(Debug, Serialize)]
pub struct Paginated<T> {
    pub data: Vec<T>,
    pub meta: PageMeta,
}

impl<T> Paginated<T> {
    #[must_use]
    pub fn new(data: Vec<T>, total: i64, p: &Pagination) -> Self {
        Self {
            data,
            meta: PageMeta {
                total,
                page: p.page(),
                limit: p.limit(),
            },
        }
    }
}

// ── Cursor / keyset pagination ──────────────────────────────────────────────
//
// Use for HIGH-VOLUME, append-heavy feeds (audit, notifications, activity,
// dispense/result logs) — anything you scroll rather than jump-to-page. Keyset
// (`WHERE id < $after ORDER BY id DESC LIMIT $lim+1`) is O(log n) at any depth,
// stable under concurrent inserts, and — crucially — **cacheable**: "N rows after
// id X" always returns the same rows, so each page is an immutable-ish chunk keyed
// by a stable id (CDN + TanStack Query cache it indefinitely). Offset pagination
// (`Pagination` above) is for review TABLES that want "page 5 of N" + a total.
//
// For time-ordered feeds, order by `(created_at, id)` and keyset on the pair so
// same-timestamp rows don't drop; the cursor is still the row id.

/// `?after=<id>&limit=..` — keyset cursor. `after` = last id seen (None = first page).
#[derive(Debug, Clone, Copy, Default, Deserialize)]
pub struct Cursor {
    pub after: Option<Uuid>,
    pub limit: Option<i64>,
}

impl Cursor {
    /// Rows per page, clamped. Fetch `limit() + 1` to detect a next page.
    #[must_use]
    pub fn limit(&self) -> i64 {
        self.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT)
    }
}

/// A cursor page: the rows plus the cursor for the next page (null = no more).
#[derive(Debug, Serialize)]
pub struct CursorPage<T> {
    pub data: Vec<T>,
    pub next_cursor: Option<Uuid>,
}

impl<T> CursorPage<T> {
    /// Build from an over-fetch: query `LIMIT cursor.limit() + 1`, pass the rows here
    /// with a getter for each row's id. If more than `limit` came back there's a next
    /// page — trim it and expose the last kept row's id as `next_cursor`.
    #[must_use]
    pub fn build(mut rows: Vec<T>, limit: i64, id_of: impl Fn(&T) -> Uuid) -> Self {
        let keep = usize::try_from(limit).unwrap_or(0);
        let next_cursor = if rows.len() > keep {
            rows.truncate(keep);
            rows.last().map(&id_of)
        } else {
            None
        };
        Self {
            data: rows,
            next_cursor,
        }
    }
}
