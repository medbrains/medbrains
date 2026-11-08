//! What an emergency page is about: a nursing code blue (`code_blue_events`)
//! or a floor code on `er_code_activations` (Code Pink, Red, Yellow, …).
//! Both are paged by the same handler; only the record they read and write
//! differs, and that difference lives here.

use serde_json::Value;
use sqlx::PgConnection;
use uuid::Uuid;

use medbrains_server_core::error::AppError;

use crate::code_blue_routing::{CODE_BLUE, Place};

/// The record a page is for.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Subject {
    CodeBlue(Uuid),
    ErCode(Uuid),
}

/// The record's facts the page needs.
#[derive(Debug, sqlx::FromRow)]
pub struct CodeContext {
    pub location: String,
    pub recorder_user_id: Option<Uuid>,
    pub ended: bool,
    pub code_type: String,
    pub ward_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
}

impl CodeContext {
    /// Where the code is, for routing.
    pub const fn place(&self) -> Place {
        Place {
            ward_id: self.ward_id,
            department_id: self.department_id,
        }
    }
}

impl Subject {
    /// Read the subject from an alert payload: `code_blue_id` or `er_code_id`.
    pub fn from_payload(payload: &Value) -> Option<Self> {
        let id = |key| {
            payload
                .get(key)
                .and_then(Value::as_str)
                .and_then(|s| s.parse().ok())
        };
        id("code_blue_id")
            .map(Self::CodeBlue)
            .or_else(|| id("er_code_id").map(Self::ErCode))
    }

    /// The record's id.
    pub const fn id(self) -> Uuid {
        match self {
            Self::CodeBlue(id) | Self::ErCode(id) => id,
        }
    }

    /// `aggregate_type` of its outbox rows and `entity_type` of its notifications.
    pub const fn aggregate(self) -> &'static str {
        match self {
            Self::CodeBlue(_) => "code_blue",
            Self::ErCode(_) => "er_code_activation",
        }
    }

    /// Where a page links to.
    pub const fn action_url(self) -> &'static str {
        match self {
            Self::CodeBlue(_) => "/nurse?tab=code-blue",
            Self::ErCode(_) => "/emergency?tab=codes",
        }
    }

    /// The two nullable `code_blue_pages` columns, one of them set.
    pub const fn page_columns(self) -> (Option<Uuid>, Option<Uuid>) {
        match self {
            Self::CodeBlue(id) => (Some(id), None),
            Self::ErCode(id) => (None, Some(id)),
        }
    }

    /// Load the record, or `NotFound`.
    pub async fn load(
        self,
        tx: &mut PgConnection,
        tenant_id: Uuid,
    ) -> Result<CodeContext, AppError> {
        let sql = match self {
            Self::CodeBlue(_) => {
                "SELECT e.location, e.recorder_user_id, e.ended_at IS NOT NULL AS ended, \
                        $3::text AS code_type, a.ward_id, a.department_id \
                   FROM code_blue_events e \
                   LEFT JOIN LATERAL ( \
                     SELECT ad.ward_id, ad.department_id FROM admissions ad \
                      WHERE ad.tenant_id = e.tenant_id AND ad.encounter_id = e.encounter_id \
                      ORDER BY ad.admitted_at DESC LIMIT 1) a ON true \
                  WHERE e.id = $1 AND e.tenant_id = $2 AND e.deleted_at IS NULL"
            }
            Self::ErCode(_) => {
                "SELECT COALESCE(c.location, '') AS location, c.activated_by AS recorder_user_id, \
                        c.deactivated_at IS NOT NULL AS ended, c.code_type, \
                        NULL::uuid AS ward_id, NULL::uuid AS department_id \
                   FROM er_code_activations c \
                  WHERE c.id = $1 AND c.tenant_id = $2 AND c.deleted_at IS NULL \
                    AND $3::text IS NOT NULL"
            }
        };
        sqlx::query_as::<_, CodeContext>(sql)
            .bind(self.id())
            .bind(tenant_id)
            .bind(CODE_BLUE)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(AppError::NotFound)
    }

    /// Write what the screen shows about the latest round.
    pub async fn record_status(
        self,
        tx: &mut PgConnection,
        tenant_id: Uuid,
        (note, warning): (&str, Option<&str>),
    ) -> Result<(), AppError> {
        let sql = match self {
            Self::CodeBlue(_) => {
                "UPDATE code_blue_events SET routing_note = $3, delivery_warning = $4 \
                  WHERE id = $1 AND tenant_id = $2"
            }
            Self::ErCode(_) => {
                "UPDATE er_code_activations SET routing_note = $3, delivery_warning = $4 \
                  WHERE id = $1 AND tenant_id = $2"
            }
        };
        sqlx::query(sql)
            .bind(self.id())
            .bind(tenant_id)
            .bind(note)
            .bind(warning)
            .execute(&mut *tx)
            .await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::Subject;
    use serde_json::json;
    use uuid::Uuid;

    #[test]
    fn a_payload_names_a_code_blue_or_a_floor_code() {
        let id = Uuid::new_v4();
        assert_eq!(
            Subject::from_payload(&json!({ "code_blue_id": id })),
            Some(Subject::CodeBlue(id))
        );
        assert_eq!(
            Subject::from_payload(&json!({ "er_code_id": id, "code_type": "code_pink" })),
            Some(Subject::ErCode(id))
        );
        assert_eq!(Subject::from_payload(&json!({})), None);
    }
}
