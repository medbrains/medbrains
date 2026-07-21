//! Internal data simulator types.
//!
//! See `medbrains-server::services::simulator` for the engine and
//! `medbrains-server::routes::admin_simulator` for the HTTP surface.
//! The Day-1 contract: every row the engine writes through existing
//! create handlers carries `is_dummy = true` so regulator-facing reports
//! filter the activity out. NMC / NABH / IPSG required fields are
//! populated by the engine through the live route helpers, so the same
//! validation / audit / event-queue path fires as for real activity.

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SimulatorSchedule {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub cron_expr: Option<String>,
    pub profile: serde_json::Value,
    pub enabled: bool,
    pub created_by: Option<Uuid>,
    pub last_run_at: Option<DateTime<Utc>>,
    pub next_run_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SimulatorRun {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub schedule_id: Option<Uuid>,
    pub triggered_by: Option<Uuid>,
    pub trigger_kind: String,
    pub started_at: DateTime<Utc>,
    pub finished_at: Option<DateTime<Utc>>,
    pub status: String,
    pub summary: serde_json::Value,
    pub error: Option<String>,
    pub created_at: DateTime<Utc>,
    #[serde(default = "default_approval_status")]
    pub approval_status: String,
}

fn default_approval_status() -> String {
    "auto_committed".to_owned()
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SimulatorRunStep {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub run_id: Uuid,
    pub step_type: String,
    pub target_id: Option<Uuid>,
    pub success: bool,
    pub error: Option<String>,
    pub created_at: DateTime<Utc>,
}

// ── Profile JSON shape ───────────────────────────────────────────────
// Stored on the schedule as `profile jsonb`. The engine deserialises into
// `Profile` on each run; missing fields fall back to defaults so older
// schedules keep working.

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Profile {
    pub patients: u32,
    pub date: Option<NaiveDate>,
    pub opd_pct: f32,
    pub er_pct: f32,
    pub branches: BranchProbabilities,
    pub er: ErProfile,
    pub case_mix: Option<std::collections::BTreeMap<String, f32>>,
    // Day-4 additions — all `#[serde(default)]` so existing schedules load.
    pub hours: HoursProfile,
    pub holidays: HolidayPolicy,
    pub seasonality: SeasonalityPolicy,
    pub volumes: VolumeOverrides,
    pub natural_flow: NaturalFlowPolicy,
    /// Approval gate: `auto` commits the run immediately; `manual` parks
    /// the run as `pending_approval` until a super_admin approves or
    /// rejects it. Reject deletes the synthetic rows recorded in
    /// `simulator_run_steps`.
    pub approval_mode: ApprovalMode,
    /// LLM-agent mode. When `agent.enabled`, the run fans out Claude agents
    /// that authenticate as real roles and drive the live API instead of the
    /// scripted in-tx engine. Absent / disabled = the classic scripted run.
    pub agent: AgentProfile,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ApprovalMode {
    #[default]
    Auto,
    Manual,
}

impl Default for Profile {
    fn default() -> Self {
        Self {
            patients: 10,
            date: None,
            opd_pct: 0.90,
            er_pct: 0.10,
            branches: BranchProbabilities::default(),
            er: ErProfile::default(),
            case_mix: None,
            hours: HoursProfile::default(),
            holidays: HolidayPolicy::default(),
            seasonality: SeasonalityPolicy::default(),
            volumes: VolumeOverrides::default(),
            natural_flow: NaturalFlowPolicy::default(),
            approval_mode: ApprovalMode::default(),
            agent: AgentProfile::default(),
        }
    }
}

// ── LLM-agent mode ───────────────────────────────────────────────────
// Factor-matrix config for the agent simulator. Each enabled axis becomes
// a dimension the fan-out varies over; the LLM decides the rest at runtime.
// `#[serde(default)]` so schedules saved before agent mode existed still load.

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AgentProfile {
    pub enabled: bool,
    /// Role codes to fan out over (e.g. "nurse", "pharmacist"). Each agent
    /// logs in as that role's seeded demo user.
    pub roles: Vec<String>,
    /// Department ids to scope agents to. Empty = the demo user's own scope.
    pub departments: Vec<Uuid>,
    /// Locale codes (e.g. "en", "hi") the agent runs the API in.
    pub locales: Vec<String>,
    /// Free-text goals the agent pursues (e.g. "register a walk-in with fever").
    pub goals: Vec<String>,
    /// Agents per factor cell.
    pub fleet_size: u32,
    /// 0.0–1.0: how often an agent deliberately fumbles (finds error paths).
    pub chaos: f32,
    /// Self-improving loop bound: max generations before stopping.
    pub generations_cap: u32,
    /// Model override; falls back to the tenant / env AI config.
    pub model: Option<String>,
    /// Autonomous census-paced mode: the scheduler drives runs at the volume a
    /// real hospital of this size would have *right now* (hour-of-day curve ×
    /// season/holiday × how much the sim has already produced today) — no cron,
    /// no human trigger. See `services::simulator::pacer`.
    pub auto_census: bool,
    /// Hospital size baseline for the pacer: expected OPD footfall per day.
    pub hospital_daily_opd: u32,
    /// Run the adversarial verifier over subjective findings (default true).
    /// Costs one extra LLM call per unverified finding — disable to save spend.
    pub verify: bool,
    /// Also sweep every read-only list endpoint (per role) to find 5xx server
    /// errors across ALL modules — cheap (no LLM), heavy on HTTP. Off by default.
    pub sweep: bool,
}

impl Default for AgentProfile {
    fn default() -> Self {
        Self {
            enabled: false,
            roles: Vec::new(),
            departments: Vec::new(),
            locales: Vec::new(),
            goals: Vec::new(),
            fleet_size: 1,
            chaos: 0.15,
            generations_cap: 1,
            model: None,
            auto_census: false,
            hospital_daily_opd: 200,
            verify: true,
            sweep: false,
        }
    }
}

/// A free-text finding an agent reported during a run — the payoff of agent
/// mode. Persisted in `simulator_run_findings`; `cell` is the factor
/// combination it came from (role/department/locale/persona/goal).
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SimulatorRunFinding {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub run_id: Uuid,
    pub cell: serde_json::Value,
    pub kind: String,
    pub severity: String,
    pub message: String,
    /// Adversarial verdict: unverified | confirmed | plausible | rejected.
    #[serde(default = "default_verdict")]
    pub verdict: String,
    pub step_ref: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

fn default_verdict() -> String {
    "unverified".to_owned()
}

// ── Natural-flow adaptation ──────────────────────────────────────────
// When enabled, the engine samples real (is_dummy = false) encounters
// from the past `lookback_days` and blends their department / ICD /
// hour-of-day distributions into the synthetic load. The `blend` weight
// controls how much the natural pattern overrides the season / fixture
// defaults (0.0 = ignore natural, 1.0 = match natural exactly).

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct NaturalFlowPolicy {
    pub enabled: bool,
    pub lookback_days: i32,
    pub blend: f32,
}

impl Default for NaturalFlowPolicy {
    fn default() -> Self {
        Self {
            enabled: true,
            lookback_days: 30,
            blend: 0.6,
        }
    }
}

// ── Hours / closing time ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct HoursProfile {
    pub opd_open_hour: u8,
    pub opd_close_hour: u8,
    pub ipd_admission_start_hour: u8,
    pub er_24h: bool,
}

impl Default for HoursProfile {
    fn default() -> Self {
        Self {
            opd_open_hour: 8,
            opd_close_hour: 20,
            ipd_admission_start_hour: 10,
            er_24h: true,
        }
    }
}

// ── Holiday + festival policy ────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct HolidayPolicy {
    pub respect_holidays: bool,
    pub opd_scale_on_holiday: f32,
    pub er_scale_on_holiday: f32,
    pub festival_weight_boost: f32,
}

impl Default for HolidayPolicy {
    fn default() -> Self {
        Self {
            respect_holidays: true,
            opd_scale_on_holiday: 0.20,
            er_scale_on_holiday: 1.20,
            festival_weight_boost: 1.30,
        }
    }
}

// ── Season / weather weighting ───────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct SeasonalityPolicy {
    pub enabled: bool,
    pub region: String,
}

impl Default for SeasonalityPolicy {
    fn default() -> Self {
        Self {
            enabled: true,
            region: "IN".to_owned(),
        }
    }
}

// ── Per-module volume overrides ──────────────────────────────────────
// When set, the engine uses these counts directly instead of deriving
// from `patients` + branch probabilities.

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct VolumeOverrides {
    pub opd_count: Option<u32>,
    pub ipd_count: Option<u32>,
    pub er_count: Option<u32>,
    pub lab_count: Option<u32>,
    pub radiology_count: Option<u32>,
    pub pharmacy_count: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct BranchProbabilities {
    pub lab_pct: f32,
    pub rad_pct: f32,
    pub ipd_escalation_pct: f32,
    pub rx_pct: f32,
    pub dispense_pct: f32,
}

impl Default for BranchProbabilities {
    fn default() -> Self {
        Self {
            lab_pct: 0.25,
            rad_pct: 0.15,
            ipd_escalation_pct: 0.10,
            rx_pct: 0.70,
            dispense_pct: 0.80,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct ErProfile {
    pub mlc_pct: f32,
    pub admit_pct: f32,
    pub triage_mix: TriageMix,
}

impl Default for ErProfile {
    fn default() -> Self {
        Self {
            mlc_pct: 0.15,
            admit_pct: 0.30,
            triage_mix: TriageMix::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct TriageMix {
    pub red: f32,
    pub yellow: f32,
    pub green: f32,
}

impl Default for TriageMix {
    fn default() -> Self {
        Self {
            red: 0.10,
            yellow: 0.35,
            green: 0.55,
        }
    }
}

// ── Run summary aggregates ───────────────────────────────────────────

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct RunSummary {
    pub opd_count: u32,
    pub er_count: u32,
    pub vitals_count: u32,
    pub diagnoses_count: u32,
    pub prescription_count: u32,
    pub lab_count: u32,
    pub radiology_count: u32,
    pub pharmacy_count: u32,
    pub ipd_admission_count: u32,
    pub triage_count: u32,
    pub er_admit_count: u32,
    pub errors: u32,
    // Graded outcome of each live tool call, so a run's health is legible:
    // `passed` = 2xx, `rejected` = 4xx (the system correctly refused — expected,
    // not a defect), `server_errors` = 5xx / transport failure (a real defect).
    // `errors` stays the total of the latter two for backward compatibility.
    pub passed: u32,
    pub rejected: u32,
    pub server_errors: u32,
}
