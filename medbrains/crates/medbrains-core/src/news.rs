//! News / health-advisory module.
//!
//! Articles flagged `category = 'outbreak_alert'` with non-empty
//! `icd_boost` feed into the simulator's weighted diagnosis picker so a
//! current dengue surge etc. shifts the synthetic case-mix without
//! needing a code change.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct NewsArticle {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub category: String,
    pub title: String,
    pub body: String,
    pub severity: String,
    pub source: Option<String>,
    pub icd_boost: Vec<String>,
    pub is_active: bool,
    pub published_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}
