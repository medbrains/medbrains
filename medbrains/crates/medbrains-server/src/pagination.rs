//! Shared server-side pagination — a query extractor + a `{ data, meta }` response.
//!
//! Replaces the hardcoded `LIMIT 5000` list pattern (which silently drops rows past
//! the cap). Endpoints take `?page&limit`, run `LIMIT $lim OFFSET $off` + a `COUNT(*)`,
//! and return `Paginated<T>`. Reuse this everywhere — do not hand-roll per endpoint.

use serde::{Deserialize, Serialize};

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
