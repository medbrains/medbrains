//! Clinical & operational analytics domain types.

use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ── Query Parameters ──────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct DateRangeQuery {
    pub from: Option<String>,
    pub to: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ExportQuery {
    pub report: String,
    pub format: Option<String>,
    pub from: Option<String>,
    pub to: Option<String>,
}

// ── Revenue ───────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct DeptRevenueRow {
    pub department_name: String,
    pub revenue: f64,
    pub invoice_count: i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct DoctorRevenueRow {
    pub doctor_name: String,
    pub department_name: String,
    pub revenue: f64,
    pub patient_count: i64,
}

// ── IPD ───────────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct IpdCensusRow {
    pub date: NaiveDate,
    pub admissions: i64,
    pub discharges: i64,
    pub deaths: i64,
    pub active: i64,
}

// ── Lab ───────────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct LabTatRow {
    pub test_name: String,
    pub order_count: i64,
    pub avg_tat_mins: f64,
    pub p90_tat_mins: f64,
    pub min_tat_mins: f64,
    pub max_tat_mins: f64,
}

// ── Pharmacy ──────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct PharmacySalesRow {
    pub drug_name: String,
    pub category: Option<String>,
    pub quantity_sold: i64,
    pub total_revenue: f64,
}

// ── Operation Theatre ─────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct OtUtilizationRow {
    pub room_name: String,
    pub total_bookings: i64,
    pub completed: i64,
    pub cancelled: i64,
    pub avg_duration_mins: f64,
    pub utilization_pct: f64,
}

// ── Emergency ─────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct ErVolumeRow {
    pub date: NaiveDate,
    pub total_visits: i64,
    pub immediate: i64,
    pub emergent: i64,
    pub urgent: i64,
    pub less_urgent: i64,
    pub non_urgent: i64,
    pub avg_door_to_doctor_mins: f64,
}

// ── Clinical Indicators ───────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct ClinicalIndicatorRow {
    pub period: String,
    pub mortality_rate: f64,
    pub infection_rate: f64,
    pub readmission_rate: f64,
    pub avg_los_days: f64,
}

// ── OPD ───────────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct OpdFootfallRow {
    pub date: NaiveDate,
    pub department_name: String,
    pub visit_count: i64,
    pub new_patients: i64,
    pub follow_ups: i64,
}

/// One cell of the OPD wait heatmap: how long patients waited in a given
/// department during a given hour of a given day.
///
/// Median and p90 rather than a mean: waiting times are long-tailed — one
/// patient waiting three hours drags an average that then describes nobody. The
/// p90 is the number a clinic manager can act on, because it is the experience
/// of the patients actually suffering the queue.
#[derive(Debug, Serialize, FromRow)]
pub struct OpdQueueWaitRow {
    pub queue_date: NaiveDate,
    /// Hour the token was issued, 0-23.
    pub hour_of_day: i32,
    pub department_name: String,
    pub patients_seen: i64,
    pub median_wait_minutes: f64,
    pub p90_wait_minutes: f64,
    pub longest_wait_minutes: f64,
}

/// One day of critical-value handling in the lab.
///
/// A critical value is a result so far out of range that somebody has to be
/// told now, and NABH judges the lab on whether that happened and how fast —
/// not on whether the result was produced. So the counts here are all about
/// what happened *after* the number existed: was a clinician told, did they
/// acknowledge, was the value read back to confirm it was heard correctly, and
/// did it have to be escalated because nobody answered.
#[derive(Debug, Serialize, FromRow)]
pub struct LabCriticalValueComplianceRow {
    pub alert_date: NaiveDate,
    pub critical_values: i64,
    pub notified: i64,
    pub acknowledged: i64,
    /// Read-back is the control against a critical value being misheard on the
    /// phone, which is why it is counted separately from acknowledgement.
    pub readback_verified: i64,
    pub escalated: i64,
    /// The common NABH expectation is notification inside an hour.
    pub notified_within_60_min: i64,
    pub median_minutes_to_notify: f64,
    pub p90_minutes_to_notify: f64,
}

/// Credential expiry risk, one row per credential type.
///
/// The point of this report is the people who should not be working right now.
/// A lapsed medical-council registration is not an administrative untidiness —
/// it means somebody is treating patients without a licence, and the hospital
/// is liable for every hour it goes unnoticed.
///
/// Buckets are cumulative deadlines rather than exclusive ranges: an already
/// expired credential is the emergency, the next 30 days is what a rota can
/// still absorb, and 90 days is when renewal paperwork has to start.
#[derive(Debug, Serialize, FromRow)]
pub struct CredentialExpiryRow {
    pub credential_type: String,
    pub total_credentials: i64,
    /// Already lapsed and not yet renewed — staff who should be stood down.
    pub expired: i64,
    pub expiring_within_30_days: i64,
    pub expiring_within_90_days: i64,
    /// Held but never verified against the issuing body. A trusted photocopy
    /// is not evidence, and NABH treats it as a finding.
    pub unverified: i64,
    /// Days until the soonest expiry still ahead; negative when one has lapsed.
    pub days_to_next_expiry: Option<i64>,
}

/// CAPA closure aging, one row per corrective-action type.
///
/// A corrective action exists because something already went wrong. The number
/// that matters is not how many were raised but how many are still open past
/// their due date, and how many were marked done without anyone checking they
/// worked.
///
/// NABH treats effectiveness verification as a separate step from completion
/// for exactly that reason: an action nobody verified is a promise, not a fix.
#[derive(Debug, Serialize, FromRow)]
pub struct CapaAgingRow {
    pub capa_type: String,
    pub total_capas: i64,
    /// Past the due date with nothing recorded as done.
    pub overdue: i64,
    pub open_on_time: i64,
    /// Completed but never verified — closed on paper only.
    pub completed_unverified: i64,
    pub verified: i64,
    /// Median days from raised to verified, over the ones that got there.
    pub median_days_to_verify: f64,
    /// How far past due the worst still-open action is.
    pub max_days_overdue: Option<i64>,
}

/// Discharge summary completion, one row per discharge date.
///
/// Counted from the discharges, never from the summaries. A discharge with no
/// summary row at all is the failure this report exists to find, and it is
/// invisible to any query that starts from the summary table — completion would
/// read 100% precisely because the missing ones do not exist to be counted.
///
/// NABH expects the summary to go with the patient. Drafted but not finalised
/// is counted apart from finalised for the same reason CAPA separates completed
/// from verified: an unfinalised summary is not something a patient can take to
/// their next doctor.
#[derive(Debug, Serialize, FromRow)]
pub struct DischargeSummaryCompletionRow {
    pub discharge_date: NaiveDate,
    pub discharges: i64,
    pub finalized: i64,
    pub draft_only: i64,
    /// Discharged with nothing written at all.
    pub missing: i64,
    /// Finalised inside 24 hours of the patient leaving.
    pub finalized_within_24h: i64,
    pub median_hours_to_finalize: f64,
}

/// Healthcare-associated infection rate, one row per month and HAI type.
///
/// The rate, not the count, is the number that means anything. A raw count of
/// CLABSIs falls when the ICU is empty and rises when it is full, so it
/// describes occupancy rather than infection control. NHSN and NABH both
/// express these per 1,000 device-days for that reason — the denominator is the
/// point of the metric, not decoration on it.
///
/// Suspected infections are reported separately from confirmed. Folding them
/// together would inflate the rate on cases that were later ruled out; dropping
/// them would hide a unit that investigates nothing.
#[derive(Debug, Serialize, FromRow)]
pub struct HaiRateRow {
    pub month: NaiveDate,
    pub hai_type: String,
    pub confirmed: i64,
    pub suspected: i64,
    /// Device-days for the device this HAI type is attributed to.
    pub device_days: i64,
    /// Confirmed infections per 1,000 device-days. `None` when no device-days
    /// were recorded — an undefined rate, which is not the same as zero.
    pub rate_per_1000_device_days: Option<f64>,
}

/// Hand hygiene compliance, one row per month and staff category.
///
/// Compliance is recomputed from observations rather than read from the stored
/// `compliance_rate` column, and it is a ratio of sums rather than a mean of
/// ratios. Averaging the per-audit rates would weight a five-observation spot
/// check the same as a five-hundred-observation ward round, which is how a unit
/// with one flattering mini-audit ends up outranking one that measured properly.
#[derive(Debug, Serialize, FromRow)]
pub struct HandHygieneComplianceRow {
    pub month: NaiveDate,
    pub staff_category: String,
    pub audits: i64,
    pub observations: i64,
    pub compliant: i64,
    /// `None` when nothing was observed — an unmeasured month is not a
    /// compliant one.
    pub compliance_percent: Option<f64>,
}

/// Readmission watch, one row per month of index discharge.
///
/// Deaths are excluded from the denominator. A patient who died cannot be
/// readmitted, so counting them as an eligible discharge makes the rate fall as
/// mortality rises — the hospital looks better the more patients it loses. CMS
/// and every serious readmission measure exclude them for that reason.
///
/// Rows are keyed by the month of the *index discharge*, not of the
/// readmission. Attributing a readmission to the month the patient came back
/// would smear responsibility onto whichever month happened to receive them and
/// would let a deteriorating ward look flat.
#[derive(Debug, Serialize, FromRow)]
pub struct ReadmissionRow {
    pub month: NaiveDate,
    /// Live discharges — the population that could come back.
    pub eligible_discharges: i64,
    /// Deaths, reported so the exclusion is visible rather than silent.
    pub deaths_excluded: i64,
    pub readmitted_within_7_days: i64,
    pub readmitted_within_30_days: i64,
    /// `None` when nothing was discharged that month.
    pub readmission_rate_30_day_percent: Option<f64>,
}

/// Cancelled and postponed theatre cases, ranked by reason.
///
/// Postponements count alongside cancellations. To the patient they are the
/// same event — fasted since midnight, sent home — and to the theatre they are
/// the same empty slot. Counting only the ones labelled `cancelled` rewards
/// relabelling rather than fixing, which is the easiest way to make this number
/// fall without a single extra operation happening.
///
/// Cases with no reason recorded get their own row rather than being dropped.
/// "Nobody wrote down why" is the most actionable finding a Pareto of
/// cancellation reasons can produce, and it is exactly what a `GROUP BY reason`
/// silently discards.
#[derive(Debug, Serialize, FromRow)]
pub struct OtCancellationRow {
    pub reason: String,
    pub cancelled: i64,
    pub postponed: i64,
    /// Both together — the theatre slots actually lost.
    pub slots_lost: i64,
    /// Lost on or after the scheduled date, when the patient had already
    /// prepared and the slot could no longer be refilled.
    pub late_losses: i64,
    /// Share of all scheduled cases in the period, so a rising count on a
    /// growing list is distinguishable from a worsening one.
    pub percent_of_scheduled: Option<f64>,
}

/// Sample rejections by reason, with the recollection that did or did not follow.
///
/// A rejection count on its own measures tidiness in the lab. The number that
/// matters clinically is `never_recollected`: a sample rejected and never
/// re-drawn means the doctor never got the result and, unless somebody noticed,
/// the patient was simply not tested. That failure leaves no error message
/// anywhere — the order is just quietly incomplete.
///
/// Orders are counted distinctly as well as rejections, because one order
/// rejected three times is one patient inconvenienced three times, not three
/// patients.
#[derive(Debug, Serialize, FromRow)]
pub struct SampleRejectionRow {
    pub rejection_reason: String,
    pub rejections: i64,
    pub orders_affected: i64,
    /// Rejected and no result ever posted afterwards — the test never happened.
    pub never_recollected: i64,
    /// Share of all orders raised in the window, so a rising count on rising
    /// volume is distinguishable from a worsening collection process.
    pub percent_of_orders: Option<f64>,
}

/// Radiology turnaround with the backlog it would otherwise hide.
///
/// Turnaround measured only over reported studies is a survivorship statistic.
/// The studies still sitting unreported are precisely the slow ones, and
/// excluding them means a department that falls further behind every week
/// reports an improving turnaround — the average gets faster because the slow
/// work has not finished yet, not because anything got quicker.
///
/// So the pending count and the age of the oldest unreported study sit beside
/// the percentiles. Read together, a falling TAT with a growing backlog is
/// visible; read apart, it looks like success.
#[derive(Debug, Serialize, FromRow)]
pub struct RadiologyTatRow {
    pub month: NaiveDate,
    pub priority: String,
    pub ordered: i64,
    pub reported: i64,
    /// Ordered and still not reported — the queue the percentiles exclude.
    pub still_pending: i64,
    /// Age in days of the oldest unreported study; the backlog's true depth.
    pub oldest_pending_days: Option<i64>,
    pub median_hours_to_report: Option<f64>,
    pub p90_hours_to_report: Option<f64>,
}

/// Stock at risk, counted as what can actually be dispensed.
///
/// `pharmacy_catalog.current_stock` includes batches that have already expired.
/// Expired stock cannot legally leave the shelf, so a pharmacy holding a
/// thousand expired tablets and none in date reads as fully stocked on that
/// column while the drug is, in practice, unavailable. Every figure here is
/// computed from batches still in date.
///
/// Expired quantity is reported rather than discarded, because it is both the
/// reason the shelf looks full and a write-off somebody has to account for.
#[derive(Debug, Serialize, FromRow)]
pub struct StockAtRiskRow {
    pub item_code: String,
    pub item_name: String,
    /// In-date stock — the only stock that can be dispensed.
    pub usable_on_hand: i64,
    /// On the shelf, out of date, dispensable to nobody.
    pub expired_on_hand: i64,
    pub expiring_within_30_days: i64,
    pub reorder_level: i64,
    /// True when usable stock is at or below the reorder level. Computed from
    /// usable stock, not from `current_stock`.
    pub below_reorder: bool,
    /// No usable stock at all, whatever the catalog column says.
    pub stocked_out: bool,
}

// ── Bed Occupancy ─────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct BedOccupancyRow {
    pub ward_name: String,
    pub total_beds: i64,
    pub occupied: i64,
    pub vacant: i64,
    pub occupancy_pct: f64,
}
