//! Wire and row types for the marketing module.
//!
//! Everything here is enquiry-level. There is no clinical field on any of
//! these structs and none should be added: the moment a diagnosis can be
//! serialised out of this module, the wall described in `0975_marketing.sql`
//! stops being real.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// An enquiry contact — somebody who asked, who may or may not be a patient.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Contact {
    pub id: Uuid,
    pub display_name: Option<String>,
    pub primary_phone: Option<String>,
    pub email: Option<String>,
    /// Advisory link to the clinical record. Present does not mean reachable:
    /// holding a marketing code never opens a chart.
    pub patient_id: Option<Uuid>,
    pub campaign_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub source: String,
    pub stage_id: Option<Uuid>,
    pub assigned_to: Option<Uuid>,
    pub first_seen_at: DateTime<Utc>,
    pub last_contacted_at: Option<DateTime<Utc>>,
    pub consent_call: bool,
    pub consent_sms: bool,
    pub consent_whatsapp: bool,
}

/// One line of the timeline.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Interaction {
    pub id: Uuid,
    pub contact_id: Uuid,
    pub kind: String,
    pub channel: String,
    pub direction: String,
    pub occurred_at: DateTime<Utc>,
    pub answered: Option<bool>,
    pub duration_secs: Option<i32>,
    pub agent_id: Option<Uuid>,
    pub disposition: Option<String>,
    pub note: Option<String>,
    /// Deliberately absent from this struct: `recording_url`. Reading the
    /// timeline is `marketing.interactions.log`-adjacent; playing what the
    /// caller actually said is `marketing.interactions.play_recording`, and a
    /// field that ships with every timeline read would collapse the two.
    pub external_ref: Option<String>,
}

/// A stage in a tenant's pipeline. Stages are rows, not an enum, so a dental
/// clinic and an IVF unit can differ without a deployment.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct PipelineStage {
    pub id: Uuid,
    pub pipeline_id: Uuid,
    pub code: String,
    pub name: String,
    pub position: i32,
    pub is_won: bool,
    pub is_lost: bool,
    pub sla_minutes: Option<i32>,
}

/// What the agent sees when the phone rings.
#[derive(Debug, Clone, Serialize)]
pub struct ScreenPop {
    /// Absent when the number is not known — a new caller, which the desk
    /// needs told plainly rather than shown an empty record.
    pub contact: Option<Contact>,
    pub is_new_caller: bool,
    /// The last three, newest first. Three because that is what fits above the
    /// fold while somebody is saying hello.
    pub recent: Vec<Interaction>,
    pub campaign_name: Option<String>,
    pub stage_name: Option<String>,
    /// Open callback tasks for this contact, so the agent is not promising a
    /// call back that is already booked.
    pub open_tasks: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateContactRequest {
    pub display_name: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub source: Option<String>,
    pub campaign_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    /// Set only when the desk knows this enquiry is an existing patient. It is
    /// a label on the enquiry, never a way through to the chart.
    pub patient_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct ListContactsQuery {
    pub stage_id: Option<Uuid>,
    pub assigned_to: Option<Uuid>,
    pub campaign_id: Option<Uuid>,
    pub search: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct ScreenPopQuery {
    /// Raw, as the switch delivered it.
    pub phone: String,
}

#[derive(Debug, Deserialize)]
pub struct MoveStageRequest {
    pub stage_id: Uuid,
    pub note: Option<String>,
}
