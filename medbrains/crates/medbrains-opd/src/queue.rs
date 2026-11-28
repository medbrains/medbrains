//! The OPD queue as the desk, the nurse and the doctor read it: the row, the
//! filters the list accepts, and the one query behind `GET /api/opd/queue` and
//! the `opd.queue.today` action.

use chrono::{DateTime, NaiveDate, NaiveTime, Utc};
use medbrains_core::permissions;
use medbrains_kernel as kernel;
use medbrains_server_core::error::AppError;
use medbrains_server_core::hospital_time::tenant_local_today;
use medbrains_server_core::middleware::auth::Claims;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Default, Deserialize)]
pub struct ListQueueQuery {
    pub date: Option<NaiveDate>,
    pub department_id: Option<Uuid>,
    pub doctor_id: Option<Uuid>,
    pub visit_type: Option<String>,
    pub status: Option<String>,
    pub search: Option<String>,
    /// When true, restrict the result to entries where `doctor_id`
    /// equals the calling user's id. Lets a doctor's UI ask for
    /// "my queue today" without having to know the user's own
    /// staff record. Combined with `doctor_id` it acts as an AND
    /// (typical use is `mine=true` alone).
    pub mine: Option<bool>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct QueueEntry {
    pub id: Uuid,
    pub encounter_id: Uuid,
    pub department_id: Uuid,
    pub doctor_id: Option<Uuid>,
    /// The legacy per-tenant integer. Kept because older surfaces still read
    /// it, but it is not what anybody is called by: `sequences.OPD_TOKEN`
    /// never resets by date, so it had climbed past 400 while the board was
    /// calling T-001.
    pub token_number: i32,
    /// What the patient is actually called by -- the unified token's number,
    /// resolved through the encounter id.
    ///
    /// The same string the token console and every board shows, and stable
    /// across the whole visit: `number_for_visit` hands registration's number
    /// to OPD and on to the lab, so one person keeps one number from the front
    /// door to the pharmacy.
    pub token_code: Option<String>,
    /// The room or counter the token was last called to.
    pub token_counter_label: Option<String>,
    /// The queue the token belongs to -- a department, a room, or a station.
    pub token_room: Option<String>,
    pub token_priority: Option<String>,
    /// Whether the desk moved this token up (a priority change is on record).
    /// A lane the patient arrived in, such as an appointment, is not that.
    pub token_priority_escalated: bool,
    /// Why the token was moved up, in the words the desk typed. Free text
    /// about a patient: sent only to callers who may see who the patient is.
    pub token_priority_reason: Option<String>,
    pub status: String,
    pub queue_date: NaiveDate,
    pub called_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub patient_id: Uuid,
    pub patient_name: Option<String>,
    pub uhid: Option<String>,
    pub visit_type: Option<String>,
    /// Carried from the encounter so the waiting list says why each patient is
    /// here, not just that they are.
    pub chief_complaint: Option<String>,
    /// Whether anything has been recorded at the vitals counter yet. Lets the
    /// counter show who is still waiting without fetching every patient's
    /// vitals and diffing client-side.
    pub has_vitals: bool,
    pub camp_id: Option<Uuid>,
    pub camp_name: Option<String>,
    pub appointment_id: Option<Uuid>,
    pub appointment_type: Option<String>,
    pub appointment_status: Option<String>,
    pub appointment_date: Option<NaiveDate>,
    pub appointment_slot_start: Option<NaiveTime>,
    pub appointment_slot_end: Option<NaiveTime>,
    pub appointment_reason: Option<String>,
    /// `primary`, `cross_consult` (a colleague's opinion) or `returned`.
    pub kind: String,
    /// For a referral row: who asked, and why.
    pub referral_from_doctor: Option<String>,
    pub referral_reason: Option<String>,
    /// `auto_inactivity` when OPD closed the visit on its own
    /// (`auto_close`); `None` when a person closed it, or it is still open.
    pub close_reason: Option<String>,
}

/// Everything the list selects, up to its WHERE. `$3` is whether the caller may
/// see who the patient is: the name, the UHID and the desk's free-text reason
/// for moving a token up are sent only then.
const QUEUE_SELECT: &str = "SELECT q.id, q.encounter_id, q.department_id, q.doctor_id, q.token_number, \
                q.status::text AS status, q.queue_date, q.called_at, q.completed_at, \
                e.close_reason, \
                tok.number AS token_code, \
                tok.counter_label AS token_counter_label, \
                tok.scope_label AS token_room, \
                tok.priority AS token_priority, \
                tok.priority_changed_at IS NOT NULL AS token_priority_escalated, \
                CASE WHEN $3::bool THEN tok.priority_reason END AS token_priority_reason, \
                e.patient_id, \
                CASE WHEN $3::bool THEN CONCAT(p.first_name, ' ', p.last_name) ELSE NULL END AS patient_name, \
                CASE WHEN $3::bool THEN p.uhid ELSE NULL END AS uhid, \
                e.visit_type::text AS visit_type, \
                e.chief_complaints AS chief_complaint, \
                EXISTS (SELECT 1 FROM vitals v WHERE v.encounter_id = e.id) AS has_vitals, \
                NULLIF(e.attributes->>'camp_id', '')::uuid AS camp_id, \
                e.attributes->>'camp_name' AS camp_name, \
                a.id AS appointment_id, \
                a.appointment_type::text AS appointment_type, \
                a.status::text AS appointment_status, \
                a.appointment_date, \
                a.slot_start AS appointment_slot_start, \
                a.slot_end AS appointment_slot_end, \
                a.reason AS appointment_reason, \
                q.kind, \
                rfu.full_name AS referral_from_doctor, \
                rf.reason AS referral_reason \
         FROM opd_queues q \
         JOIN encounters e ON e.id = q.encounter_id \
         JOIN patients p ON p.id = e.patient_id \
         LEFT JOIN appointments a ON a.tenant_id = q.tenant_id AND a.encounter_id = e.id \
         LEFT JOIN referrals rf ON rf.id = q.referral_id \
         LEFT JOIN users rfu ON rfu.id = rf.from_doctor_id \
         LEFT JOIN LATERAL ( \
             SELECT t.* \
               FROM tokens t \
              WHERE t.tenant_id = q.tenant_id AND t.module = 'opd' \
                AND ((q.kind = 'primary' AND t.entity_type = 'encounter' \
                      AND t.entity_id = q.encounter_id) \
                  OR (t.entity_type = 'opd_queue' AND t.entity_id = q.id)) \
                AND t.token_date = q.queue_date \
              ORDER BY t.created_at LIMIT 1 \
         ) tok ON TRUE";

/// Waiting patients by the weight of their token, then arrival; everyone else
/// keeps an ordinary token's weight (6) and their arrival place.
const QUEUE_ORDER: &str = "ORDER BY CASE WHEN q.status = 'waiting' AND tok.id IS NOT NULL \
                  THEN token_queue_weight(tok.queue_id, tok.priority, tok.created_at) ELSE 6 END, \
                  q.token_number LIMIT 5000";

/// A value bound to one of the list's optional filters.
enum Bind {
    Id(Uuid),
    Text(String),
}

/// The WHERE of the list: its conditions, and the values bound from `$4` on.
struct Filters {
    conditions: Vec<String>,
    binds: Vec<Bind>,
}

impl Filters {
    /// The conditions every list has: the tenant (`$1`), the day (`$2`), and
    /// no deleted visit, which leaves the waiting room.
    fn new() -> Self {
        let fixed = [
            "q.tenant_id = $1",
            "q.queue_date = $2",
            "q.deleted_at IS NULL",
            "e.deleted_at IS NULL",
        ];
        Self {
            conditions: fixed.map(str::to_owned).to_vec(),
            binds: Vec::new(),
        }
    }

    /// Adds a condition; `{n}` in it becomes the placeholder of `bind`.
    fn add(&mut self, condition: &str, bind: Bind) {
        let placeholder = format!("${}", self.binds.len() + 4);
        self.conditions.push(condition.replace("{n}", &placeholder));
        self.binds.push(bind);
    }
}

/// A filter's text, trimmed; `None` when it is absent or blank.
fn text(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|value| !value.is_empty())
}

/// The filters the desk asked for. A caller who may not see who the patient
/// is searches the token, status, visit type and camp, never names or phones.
fn filters(params: &ListQueueQuery, claims: &Claims, can_view_identity: bool) -> Filters {
    let mut filters = Filters::new();
    if let Some(department) = params.department_id {
        filters.add("q.department_id = {n}", Bind::Id(department));
    }
    if let Some(doctor) = params.doctor_id {
        filters.add("q.doctor_id = {n}", Bind::Id(doctor));
    }
    if params.mine.unwrap_or(false) {
        filters.add("q.doctor_id = {n}", Bind::Id(claims.sub));
    }
    if let Some(visit_type) = text(params.visit_type.as_deref()) {
        filters.add(
            "e.visit_type::text = {n}",
            Bind::Text(visit_type.to_owned()),
        );
    }
    if let Some(search) = text(params.search.as_deref()) {
        let condition = if can_view_identity {
            "(q.token_number::text ILIKE {n} \
              OR p.uhid ILIKE {n} \
              OR p.phone ILIKE {n} \
              OR CONCAT(p.first_name, ' ', p.last_name) ILIKE {n})"
        } else {
            "(q.token_number::text ILIKE {n} \
              OR q.status::text ILIKE {n} \
              OR e.visit_type::text ILIKE {n} \
              OR COALESCE(e.attributes->>'camp_name', '') ILIKE {n})"
        };
        filters.add(condition, Bind::Text(format!("%{search}%")));
    }
    if let Some(status) = &params.status {
        filters.add("q.status::text = {n}", Bind::Text(status.clone()));
    }
    filters
}

/// The OPD queue for `params.date`, or the tenant's today when it is absent.
///
/// Filtered as the desk asks; patient identity is shown only to callers who may
/// see it. Shared by `GET /api/opd/queue` and the `opd.queue.today` action.
///
/// Priority, then arrival: a patient still waiting sorts by the weight of their
/// token (`token_queue_weight`, which the token console, the boards and
/// call-next sort by), so a patient the desk moved up is first on the doctor's
/// list too. It was ordered by arrival alone, and a patient raised to STAT
/// stayed where they were. A row no longer waiting, or with no token, keeps an
/// ordinary token's weight (6) and its arrival place.
pub async fn queue_rows(
    conn: &mut sqlx::PgConnection,
    claims: &Claims,
    params: &ListQueueQuery,
) -> Result<Vec<QueueEntry>, AppError> {
    // The redaction does not fire for the built-in roles today: opd.queue.* is
    // held by audit_officer, doctor, mrd_officer, nurse and receptionist, and
    // all five also hold patients.view. It does for a custom role, an API key
    // or an agent that holds the queue code alone.
    let can_view_identity = kernel::authz::is_bypass_role(claims)
        || claims
            .permissions
            .iter()
            .any(|permission| permission == permissions::patients::VIEW);
    let queue_date = if let Some(date) = params.date {
        date
    } else {
        tenant_local_today(&mut *conn, claims.tenant_id).await?
    };
    let filters = filters(params, claims, can_view_identity);
    let where_clause = filters.conditions.join(" AND ");
    let sql = format!("{QUEUE_SELECT} WHERE {where_clause} {QUEUE_ORDER}");
    let mut query = sqlx::query_as::<_, QueueEntry>(&sql)
        .bind(claims.tenant_id)
        .bind(queue_date)
        .bind(can_view_identity);
    for bind in filters.binds {
        query = match bind {
            Bind::Id(id) => query.bind(id),
            Bind::Text(text) => query.bind(text),
        };
    }
    Ok(query.fetch_all(conn).await?)
}
