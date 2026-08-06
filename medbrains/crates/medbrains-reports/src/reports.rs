use axum::routing::get;
use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use medbrains_core::{
    analytics::DateRangeQuery,
    clinical_events::ClinicalEventName,
    permissions,
    reports::{
        EChartsTemplate, ReportCatalogResponse, ReportDataResponse, ReportDataStatus,
        ReportDataSummary, ReportDefinition, ReportExportFormat, ReportExportMode,
        ReportFamilyDefinition, ReportPriority, ReportReadiness,
    },
};
use serde::Serialize;
use serde_json::Value;

use crate::analytics;
use crate::nabh_indicators;
use medbrains_scheduling::scheduling;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::{is_bypass_role, require_any_permission};
use medbrains_server_core::state::AppState;

const STANDARD_EXPORTS: &[ReportExportFormat] = &[
    ReportExportFormat::Pdf,
    ReportExportFormat::Excel,
    ReportExportFormat::Csv,
    ReportExportFormat::Png,
];
const GOVERNED_EXPORTS: &[ReportExportFormat] = &[
    ReportExportFormat::Pdf,
    ReportExportFormat::Png,
    ReportExportFormat::Excel,
    ReportExportFormat::Csv,
];

#[derive(Clone, Copy)]
enum ReportDataKind {
    DeptRevenue,
    OpdFootfall,
    OpdQueueWait,
    LabCriticalValueCompliance,
    CredentialExpiry,
    CapaAging,
    DischargeSummaryCompletion,
    HaiRate,
    HandHygieneCompliance,
    ReadmissionWatch,
    OtCancellations,
    SampleRejections,
    BedOccupancy,
    LabTat,
    SchedulingNoShow,
    NabhIndicators,
    NotWired,
}

#[derive(Clone)]
struct ReportSeed {
    definition: ReportDefinition,
    data_kind: ReportDataKind,
}

#[derive(Clone)]
struct ReportFamilySeed {
    id: &'static str,
    title: &'static str,
    eyebrow: &'static str,
    description: &'static str,
    reports: Vec<ReportSeed>,
}

struct ReportEventSourceSeed {
    report_targets: &'static [&'static str],
    indicator_targets: &'static [&'static str],
    source_events: &'static [ClinicalEventName],
}

struct ReportEventMetadata {
    event_payload_keys: Vec<String>,
    indicator_targets: Vec<String>,
    source_events: Vec<String>,
}

fn strings(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| (*value).to_owned()).collect()
}

fn push_unique(values: &mut Vec<String>, value: &str) {
    if !values.iter().any(|current| current == value) {
        values.push(value.to_owned());
    }
}

const REPORT_EVENT_SOURCES: &[ReportEventSourceSeed] = &[
    ReportEventSourceSeed {
        report_targets: &[
            "enterprise-kpi-command-board",
            "opd-registration-arrivals",
            "opd-queue-wait-heatmap",
            "opd-consultant-slot-utilization",
            "patient-journey-sankey",
            "opd-doctor-productivity-bubble",
            "predict-opd-noshow-load",
            "nmc-opd-clinical-material",
        ],
        indicator_targets: &["access.flow", "opd.wait_time"],
        source_events: &[
            ClinicalEventName::PatientCreated,
            ClinicalEventName::PatientUpdated,
            ClinicalEventName::PatientSearchCompleted,
            ClinicalEventName::PatientAccessShared,
            ClinicalEventName::PatientCardPrinted,
            ClinicalEventName::OpdEncounterCreated,
            ClinicalEventName::OpdQueueCalled,
            ClinicalEventName::OpdConsultationStarted,
            ClinicalEventName::OpdVitalsRecorded,
            ClinicalEventName::OpdConsultationSaved,
            ClinicalEventName::OpdEncounterCompleted,
            ClinicalEventName::OpdFollowupScheduled,
            ClinicalEventName::OpdPrescriptionUpdated,
            ClinicalEventName::OpdCertificateCreated,
            ClinicalEventName::OpdConsentSigned,
        ],
    },
    ReportEventSourceSeed {
        report_targets: &[
            "enterprise-kpi-command-board",
            "occupancy-queue-pressure",
            "patient-journey-sankey",
            "ipd-census-bed-occupancy",
            "ipd-alos-case-mix",
            "ipd-bed-turnaround-delay",
            "ipd-discharge-delay-readmission",
            "billing-ar-dnfb-unpaid-discharge",
            "predict-bed-demand-discharge",
            "nmc-specialty-bed-occupancy",
            "nmc-mrd-completeness-availability",
        ],
        indicator_targets: &["ipd.occupancy", "ipd.discharge_tat", "ipd.bed_turnaround"],
        source_events: &[
            ClinicalEventName::IpdAdmissionCreated,
            ClinicalEventName::BedAssigned,
            ClinicalEventName::BedTransferred,
            ClinicalEventName::IpdDischargeInitiated,
            ClinicalEventName::IpdDischargeCompleted,
            ClinicalEventName::IpdDischargeFinalized,
            ClinicalEventName::MrdCaseSheetGenerated,
            ClinicalEventName::MrdCaseSheetPrinted,
        ],
    },
    ReportEventSourceSeed {
        report_targets: &[
            "safety-compliance-red-flags",
            "quality-incident-sentinel-trend",
            "hospital-risk-radar",
        ],
        indicator_targets: &["emergency.triage", "mlc.reporting"],
        source_events: &[
            ClinicalEventName::EmergencyVisitCreated,
            ClinicalEventName::MlcCreated,
            ClinicalEventName::EmergencyMlcPoliceIntimationCreated,
        ],
    },
    ReportEventSourceSeed {
        report_targets: &[
            "camp-coverage-turnout",
            "camp-screening-referral-conversion",
            "camp-disease-followup-map",
            "geo-access-gap-underserved",
            "geo-referral-network-catchment-flow",
        ],
        indicator_targets: &["camp.turnout", "camp.referral_conversion"],
        source_events: &[
            ClinicalEventName::CampStarted,
            ClinicalEventName::CampRegistrationCreated,
            ClinicalEventName::CampScreeningCompleted,
        ],
    },
    ReportEventSourceSeed {
        report_targets: &[
            "enterprise-kpi-command-board",
            "patient-journey-sankey",
            "lab-end-to-end-tat",
            "lab-critical-value-notification",
            "lab-sample-rejection-recollection",
            "radiology-modality-utilization",
            "radiology-order-report-tat-backlog",
            "radiology-quality-critical-findings",
            "geo-disease-hotspot-seasonality",
        ],
        indicator_targets: &["lab.tat", "radiology.tat", "critical_results"],
        source_events: &[
            ClinicalEventName::OrderCreated,
            ClinicalEventName::OrderCancelled,
            ClinicalEventName::LabSampleCollected,
            ClinicalEventName::LabResultPosted,
            ClinicalEventName::LabResultVerified,
            ClinicalEventName::LabOrderCompleted,
            ClinicalEventName::RadiologyOrderCompleted,
            ClinicalEventName::RadiologyReportCreated,
            ClinicalEventName::RadiologyReportVerified,
        ],
    },
    ReportEventSourceSeed {
        report_targets: &[
            "patient-journey-sankey",
            "pharmacy-fulfillment-turnaround",
            "pharmacy-stockout-expiry-days-on-hand",
            "pharmacy-ndps-high-risk-compliance",
            "pharmacy-safety-returns-margin-leakage",
            "predict-stockout-near-expiry",
        ],
        indicator_targets: &[
            "pharmacy.tat",
            "pharmacy.ndps_compliance",
            "inventory.stock_movement",
        ],
        source_events: &[
            ClinicalEventName::OrderCreated,
            ClinicalEventName::OrderCancelled,
            ClinicalEventName::IndentRequisitionSubmitted,
            ClinicalEventName::IndentRequisitionApproved,
            ClinicalEventName::IndentRequisitionIssued,
            ClinicalEventName::PharmacyOrderDispensed,
            ClinicalEventName::PharmacyPrescriptionReviewed,
            ClinicalEventName::PharmacyStockMovementCreated,
            ClinicalEventName::PharmacyNdpsMovementCreated,
        ],
    },
    ReportEventSourceSeed {
        report_targets: &[
            "enterprise-kpi-command-board",
            "revenue-collections-leakage",
            "patient-journey-sankey",
            "opd-doctor-productivity-bubble",
            "billing-gross-net-payer-mix",
            "billing-collections-settlement",
            "billing-ar-dnfb-unpaid-discharge",
        ],
        indicator_targets: &["billing.collection", "billing.dnfb", "finance.revenue"],
        source_events: &[
            ClinicalEventName::BillingInvoiceCreated,
            ClinicalEventName::BillingInvoiceFinalized,
            ClinicalEventName::BillingPaymentReceived,
        ],
    },
    ReportEventSourceSeed {
        report_targets: &[
            "safety-compliance-red-flags",
            "hospital-risk-radar",
            "nabh-evidence-matrix",
            "quality-incident-sentinel-trend",
            "quality-capa-audit-aging",
            "predict-infection-outbreak-incident",
        ],
        indicator_targets: &[
            "quality.incidents",
            "code_blue.response",
            "blood.transfusion_reaction",
            "bme.downtime",
            "bmw.disposal",
        ],
        source_events: &[
            ClinicalEventName::QualityIncidentReported,
            ClinicalEventName::EmergencyCodeBlueActivated,
            ClinicalEventName::EmergencyCodeBlueCompleted,
            ClinicalEventName::BloodTransfusionReactionReported,
            ClinicalEventName::BmeEquipmentDowntimeRecorded,
            ClinicalEventName::HousekeepingBmwDisposalRecorded,
        ],
    },
];

fn event_metadata_for_report(id: &str) -> ReportEventMetadata {
    let mut source_events = Vec::new();
    let mut event_payload_keys = Vec::new();
    let mut indicator_targets = Vec::new();

    for source in REPORT_EVENT_SOURCES {
        if !source.report_targets.contains(&id) {
            continue;
        }

        for event_name in source.source_events {
            push_unique(&mut source_events, event_name.as_str());
            for payload_key in event_name.required_payload_keys() {
                push_unique(&mut event_payload_keys, payload_key);
            }
        }

        for indicator_target in source.indicator_targets {
            push_unique(&mut indicator_targets, indicator_target);
        }
    }

    ReportEventMetadata {
        event_payload_keys,
        indicator_targets,
        source_events,
    }
}

fn infer_echarts_template(chart_types: &[&str], visual_kind: &str) -> EChartsTemplate {
    let chart_grammar = chart_types.join(" ").to_lowercase();
    let visual_kind = visual_kind.to_lowercase();

    if chart_grammar.contains("bar race") {
        EChartsTemplate::BarRace
    } else if chart_grammar.contains("waterfall") {
        EChartsTemplate::BarWaterfall
    } else if chart_grammar.contains("calendar") {
        EChartsTemplate::HeatmapCalendar
    } else if chart_grammar.contains("boxplot") {
        EChartsTemplate::Boxplot
    } else if chart_grammar.contains("sankey") {
        EChartsTemplate::Sankey
    } else if chart_grammar.contains("graph") || chart_grammar.contains("network") {
        EChartsTemplate::GraphNetwork
    } else if chart_grammar.contains("radar") || visual_kind == "radar" {
        EChartsTemplate::Radar
    } else if chart_grammar.contains("sunburst") {
        EChartsTemplate::Sunburst
    } else if chart_grammar.contains("treemap") || visual_kind == "treemap" {
        EChartsTemplate::Treemap
    } else if chart_grammar.contains("funnel") || visual_kind == "funnel" {
        EChartsTemplate::Funnel
    } else if chart_grammar.contains("gauge") || visual_kind == "gauge" {
        EChartsTemplate::Gauge
    } else if chart_grammar.contains("geo scatter") || chart_grammar.contains("effect scatter") {
        EChartsTemplate::EffectScatterMap
    } else if chart_grammar.contains("map") || visual_kind == "map" {
        EChartsTemplate::GeoMap
    } else if chart_grammar.contains("pictorial") {
        EChartsTemplate::PictorialBar
    } else if chart_grammar.contains("custom svg") || visual_kind == "body" {
        EChartsTemplate::CustomSvg
    } else if chart_grammar.contains("timeline") {
        EChartsTemplate::Timeline
    } else if chart_grammar.contains("parallel") {
        EChartsTemplate::ParallelCoordinates
    } else if chart_grammar.contains("theme") {
        EChartsTemplate::ThemeRiver
    } else if chart_grammar.contains("candlestick") || chart_grammar.contains("ohlc") {
        EChartsTemplate::CandlestickOhlc
    } else if chart_grammar.contains("area") {
        EChartsTemplate::AreaStack
    } else if chart_grammar.contains("stacked bar") {
        EChartsTemplate::BarStack
    } else if chart_grammar.contains("gradient") || visual_kind == "forecast" {
        EChartsTemplate::LineGradient
    } else if visual_kind == "heatmap" || visual_kind == "matrix" {
        EChartsTemplate::HeatmapCartesian
    } else {
        EChartsTemplate::LineStack
    }
}

#[allow(clippy::too_many_arguments)]
fn report(
    id: &'static str,
    title: &'static str,
    purpose: &'static str,
    source_tables: &[&str],
    permissions: &[&str],
    priority: ReportPriority,
    readiness: ReportReadiness,
    chart_types: &[&str],
    visual_kind: &'static str,
    refresh: &'static str,
    exports: &[ReportExportFormat],
    export_mode: ReportExportMode,
    drilldowns: &[&str],
    data_kind: ReportDataKind,
) -> ReportSeed {
    let data_endpoint = match data_kind {
        ReportDataKind::NotWired => None,
        _ => Some(format!("/api/reports/{id}/data")),
    };
    let event_metadata = event_metadata_for_report(id);
    ReportSeed {
        definition: ReportDefinition {
            id: id.to_owned(),
            title: title.to_owned(),
            purpose: purpose.to_owned(),
            source_tables: strings(source_tables),
            source_events: event_metadata.source_events,
            event_payload_keys: event_metadata.event_payload_keys,
            indicator_targets: event_metadata.indicator_targets,
            permissions: strings(permissions),
            priority,
            readiness,
            chart_types: strings(chart_types),
            echarts_template: infer_echarts_template(chart_types, visual_kind),
            visual_kind: visual_kind.to_owned(),
            refresh: refresh.to_owned(),
            exports: exports.to_vec(),
            export_mode,
            drilldowns: strings(drilldowns),
            data_endpoint,
        },
        data_kind,
    }
}

fn family(
    id: &'static str,
    title: &'static str,
    eyebrow: &'static str,
    description: &'static str,
    reports: Vec<ReportSeed>,
) -> ReportFamilySeed {
    ReportFamilySeed {
        id,
        title,
        eyebrow,
        description,
        reports,
    }
}

#[allow(clippy::too_many_lines)]
fn catalog_seed() -> Vec<ReportFamilySeed> {
    vec![
        family(
            "executive",
            "Executive Command",
            "Hospital operating board",
            "Leadership view of capacity, queues, money, diagnostics, and safety red flags.",
            vec![
                report(
                    "enterprise-kpi-command-board",
                    "Enterprise KPI command board",
                    "OPD visits, IPD census, occupancy, collections, TAT breaches, and incidents.",
                    &[
                        "encounters",
                        "admissions",
                        "invoices",
                        "payments",
                        "quality_indicators",
                    ],
                    &[permissions::analytics::VIEW],
                    ReportPriority::P1,
                    ReportReadiness::QueryBuildable,
                    &["line", "gauge", "custom"],
                    "command",
                    "Intraday / daily",
                    STANDARD_EXPORTS,
                    ReportExportMode::Standard,
                    &["facility", "service line", "department", "exception list"],
                    ReportDataKind::OpdFootfall,
                ),
                report(
                    "occupancy-queue-pressure",
                    "Occupancy and queue pressure",
                    "Congestion signal across beds, ICU, transfers, and OPD queues.",
                    &[
                        "admissions",
                        "wards",
                        "beds",
                        "opd_queues",
                        "bed_reservations",
                    ],
                    &[
                        permissions::analytics::VIEW,
                        permissions::ipd::reports::VIEW,
                    ],
                    ReportPriority::P1,
                    ReportReadiness::QueryBuildable,
                    &["line", "stacked bar", "heat strip"],
                    "heatmap",
                    "5-15 min",
                    STANDARD_EXPORTS,
                    ReportExportMode::Standard,
                    &["ward", "room", "bed", "clinic", "doctor"],
                    ReportDataKind::BedOccupancy,
                ),
                report(
                    "revenue-collections-leakage",
                    "Revenue, collections, and leakage",
                    "Gross billing, net billing, concessions, refunds, and write-down direction.",
                    &[
                        "invoices",
                        "invoice_items",
                        "payments",
                        "billing_concessions",
                        "refunds",
                    ],
                    &[permissions::billing::reports::VIEW],
                    ReportPriority::P1,
                    ReportReadiness::LiveApi,
                    &["line", "waterfall", "stacked bar"],
                    "sankey",
                    "Intraday / day close",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["payer", "department", "invoice class", "refund approval"],
                    ReportDataKind::DeptRevenue,
                ),
                report(
                    "safety-compliance-red-flags",
                    "Safety and compliance red flags",
                    "Open incidents, overdue CAPA, critical alerts, unsigned records, and audit slippage.",
                    &[
                        "quality_indicators",
                        "quality_incidents",
                        "quality_capa",
                        "audit_log",
                    ],
                    &[permissions::quality::indicators::LIST],
                    ReportPriority::P1,
                    ReportReadiness::LiveApi,
                    &["matrix", "heatmap", "alert list"],
                    "matrix",
                    "Near-real-time / daily",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["severity", "department", "owner", "case drawer"],
                    ReportDataKind::NabhIndicators,
                ),
                report(
                    "patient-journey-sankey",
                    "Patient journey flow",
                    "Registration to OPD, diagnostics, pharmacy, IPD, billing, discharge, and follow-up leakage.",
                    &[
                        "patients",
                        "appointments",
                        "encounters",
                        "lab_orders",
                        "radiology_orders",
                        "prescriptions",
                        "admissions",
                        "invoices",
                    ],
                    &[permissions::analytics::VIEW],
                    ReportPriority::P1,
                    ReportReadiness::QueryBuildable,
                    &["sankey"],
                    "sankey",
                    "Intraday / daily",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["service line", "doctor", "payer", "drop-off stage"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "hospital-risk-radar",
                    "Hospital risk radar",
                    "Balanced risk posture across patient safety, clinical care, medication safety, infection control, facility safety, HR, MRD, and CAPA.",
                    &[
                        "quality_indicators",
                        "quality_incidents",
                        "infection_surveillance",
                        "hr_training",
                        "mrd_records",
                        "quality_capa",
                    ],
                    &[
                        permissions::analytics::VIEW,
                        permissions::quality::indicators::LIST,
                    ],
                    ReportPriority::P1,
                    ReportReadiness::QueryBuildable,
                    &["radar"],
                    "radar",
                    "Daily / weekly",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["chapter", "department", "risk owner", "CAPA status"],
                    ReportDataKind::NotWired,
                ),
            ],
        ),
        family(
            "opd",
            "OPD",
            "Front-door access and clinic flow",
            "Registration, queue, consultant utilization, no-shows, and revisit behavior.",
            vec![
                report(
                    "opd-registration-arrivals",
                    "Registration and arrival trend",
                    "Registrations, arrivals, walk-ins, and conversion to encounter.",
                    &["patients", "appointments", "encounters"],
                    &[permissions::analytics::VIEW],
                    ReportPriority::P1,
                    ReportReadiness::QueryBuildable,
                    &["line", "area", "bar"],
                    "line",
                    "5-15 min / intraday",
                    STANDARD_EXPORTS,
                    ReportExportMode::Standard,
                    &["clinic", "consultant", "patient type", "age and sex"],
                    ReportDataKind::OpdFootfall,
                ),
                report(
                    "opd-queue-wait-heatmap",
                    "Queue wait heatmap",
                    "Median and p90 wait by day, hour, clinic, and doctor.",
                    &["opd_queues", "appointments", "encounters"],
                    &[permissions::analytics::VIEW, permissions::opd::queue::VIEW],
                    ReportPriority::P1,
                    ReportReadiness::LiveApi,
                    &["heatmap", "line"],
                    "heatmap",
                    "5-15 min",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["clinic", "doctor", "slot", "patient queue"],
                    ReportDataKind::OpdQueueWait,
                ),
                report(
                    "opd-consultant-slot-utilization",
                    "Consultant load and slot utilization",
                    "Booked, filled, overrun, and idle clinic capacity.",
                    &["appointments", "encounters", "doctor_schedules"],
                    &[permissions::analytics::VIEW],
                    ReportPriority::P1,
                    ReportReadiness::QueryBuildable,
                    &["stacked bar", "line"],
                    "line",
                    "Intraday",
                    STANDARD_EXPORTS,
                    ReportExportMode::Standard,
                    &["consultant", "specialty", "slot duration", "payer"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "opd-no-show-revisit",
                    "No-show, cancellation, revisit behavior",
                    "No-show percentage, short-notice cancellations, and 7/30-day revisits.",
                    &["appointments", "encounters", "patients"],
                    &[permissions::scheduling::analytics::VIEW],
                    ReportPriority::P2,
                    ReportReadiness::QueryBuildable,
                    &["cohort heatmap", "line"],
                    "heatmap",
                    "Daily / weekly",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["doctor", "department", "slot", "cohort"],
                    ReportDataKind::SchedulingNoShow,
                ),
                report(
                    "opd-doctor-productivity-bubble",
                    "Doctor productivity bubble",
                    "Patient count, revenue, average consult time, and downstream lab/pharmacy conversion by consultant.",
                    &[
                        "appointments",
                        "encounters",
                        "invoices",
                        "lab_orders",
                        "prescriptions",
                    ],
                    &[permissions::analytics::VIEW],
                    ReportPriority::P2,
                    ReportReadiness::QueryBuildable,
                    &["scatter", "bubble"],
                    "graph",
                    "Daily / weekly",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["department", "consultant", "payer", "conversion band"],
                    ReportDataKind::NotWired,
                ),
            ],
        ),
        family(
            "ipd",
            "IPD",
            "Inpatient capacity and care flow",
            "Census, occupancy, length of stay, bed turnaround, discharge delay, and readmission.",
            vec![
                report(
                    "ipd-census-bed-occupancy",
                    "Census and bed occupancy",
                    "Daily census, occupancy percentage, ICU load, reserve vs available beds.",
                    &["admissions", "wards", "beds", "bed_reservations"],
                    &[
                        permissions::ipd::reports::VIEW,
                        permissions::analytics::VIEW,
                    ],
                    ReportPriority::P1,
                    ReportReadiness::LiveApi,
                    &["line", "stacked bar"],
                    "line",
                    "Near-real-time / hourly",
                    STANDARD_EXPORTS,
                    ReportExportMode::Standard,
                    &["ward", "specialty", "bed class", "ICU"],
                    ReportDataKind::BedOccupancy,
                ),
                report(
                    "ipd-alos-case-mix",
                    "ALOS vs case mix",
                    "Length of stay by service line against baseline and outlier distribution.",
                    &["admissions", "encounters", "diagnoses", "packages"],
                    &[permissions::ipd::reports::VIEW],
                    ReportPriority::P1,
                    ReportReadiness::QueryBuildable,
                    &["boxplot", "control line"],
                    "boxplot",
                    "Daily",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["specialty", "diagnosis group", "payer", "consultant"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "ipd-bed-turnaround-delay",
                    "Bed turnaround and housekeeping delay",
                    "Vacate-to-clean, clean-to-ready, and transfer friction.",
                    &["bed_turnaround_log", "beds", "wards", "housekeeping_tasks"],
                    &[permissions::ipd::reports::VIEW],
                    ReportPriority::P1,
                    ReportReadiness::QueryBuildable,
                    &["boxplot", "bar"],
                    "boxplot",
                    "Hourly",
                    STANDARD_EXPORTS,
                    ReportExportMode::Standard,
                    &["ward", "bed class", "housekeeping shift", "bed"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "ipd-discharge-delay-readmission",
                    "Discharge delay and readmission",
                    "Delay causes, discharge bottlenecks, and 7/30-day readmission watch.",
                    &["admissions", "discharge_milestones", "encounters"],
                    &[permissions::ipd::reports::VIEW],
                    ReportPriority::P1,
                    ReportReadiness::LiveApi,
                    &["funnel", "line"],
                    "funnel",
                    "Daily",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["specialty", "consultant", "payer", "discharge reason"],
                    ReportDataKind::ReadmissionWatch,
                ),
            ],
        ),
        family(
            "lab",
            "Lab",
            "Diagnostic turnaround and quality",
            "TAT, critical values, rejection, QC, EQAS, and outsourced dependency.",
            vec![
                report(
                    "lab-end-to-end-tat",
                    "End-to-end lab TAT",
                    "Order-to-collection, collection-to-result, and result-to-validation.",
                    &["lab_orders", "lab_results", "lab_test_catalog"],
                    &[
                        permissions::lab::reports::VIEW,
                        permissions::analytics::VIEW,
                    ],
                    ReportPriority::P1,
                    ReportReadiness::LiveApi,
                    &["line", "boxplot"],
                    "boxplot",
                    "15 min / hourly",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["test group", "priority", "ward or OPD", "lab section"],
                    ReportDataKind::LabTat,
                ),
                report(
                    "lab-critical-value-notification",
                    "Critical value notification compliance",
                    "Criticals within target time, read-back, and acknowledgement lag.",
                    &["lab_critical_alerts", "lab_results", "acknowledgements"],
                    &[
                        permissions::lab::reports::VIEW,
                        permissions::quality::indicators::LIST,
                    ],
                    ReportPriority::P1,
                    ReportReadiness::LiveApi,
                    &["funnel", "bullet bar"],
                    "funnel",
                    "15 min / hourly",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["test", "shift", "ward", "ordering doctor"],
                    ReportDataKind::LabCriticalValueCompliance,
                ),
                report(
                    "lab-sample-rejection-recollection",
                    "Sample rejection and recollection",
                    "Rejection rate, reason Pareto, and recollection burden.",
                    &["lab_orders", "lab_samples", "sample_rejections"],
                    &[permissions::lab::reports::VIEW],
                    ReportPriority::P1,
                    ReportReadiness::LiveApi,
                    &["pareto bar", "heatmap"],
                    "heatmap",
                    "Daily",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["collection point", "unit", "phlebotomist", "sample type"],
                    ReportDataKind::SampleRejections,
                ),
                report(
                    "lab-qc-eqas-outsourced",
                    "QC/EQAS and outsourced dependency",
                    "QC failures, EQAS trend, outsourced test share, and external TAT.",
                    &["lab_qc", "lab_eqas", "outsourced_labs", "lab_orders"],
                    &[
                        permissions::lab::qc::LIST,
                        permissions::lab::outsourced::LIST,
                    ],
                    ReportPriority::P2,
                    ReportReadiness::QueryBuildable,
                    &["heatmap", "stacked bar"],
                    "heatmap",
                    "Daily / weekly",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["analyzer", "test class", "vendor", "section"],
                    ReportDataKind::NotWired,
                ),
            ],
        ),
        family(
            "radiology",
            "Radiology",
            "Imaging workload, DICOM, and safety",
            "Modality load, order-to-report TAT, dose, amendments, and critical findings.",
            vec![
                report(
                    "radiology-modality-utilization",
                    "Modality load and scheduling utilization",
                    "CT/MRI/X-ray/US volume, slot utilization, and idle time.",
                    &["radiology_orders", "radiology_dicom_studies", "equipment"],
                    &[permissions::radiology::orders::VIEW],
                    ReportPriority::P1,
                    ReportReadiness::QueryBuildable,
                    &["stacked bar", "calendar heatmap"],
                    "heatmap",
                    "15 min / hourly",
                    STANDARD_EXPORTS,
                    ReportExportMode::Standard,
                    &["modality", "machine", "shift", "ordering unit"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "radiology-order-report-tat-backlog",
                    "Order-to-report TAT and backlog",
                    "Order-to-scan, scan-to-prelim, prelim-to-final, and aged backlog.",
                    &["radiology_orders", "radiology_reports"],
                    &[permissions::radiology::orders::VIEW],
                    ReportPriority::P1,
                    ReportReadiness::QueryBuildable,
                    &["boxplot", "burn-down line"],
                    "boxplot",
                    "15 min / hourly",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["modality", "priority", "radiologist", "department"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "radiology-dose-dosimetry",
                    "Dose/dosimetry and radiation safety",
                    "Patient dose trends, staff TLD compliance, and protocol outliers.",
                    &[
                        "radiology_dosimetry",
                        "radiology_dicom_studies",
                        "staff_tld_logs",
                    ],
                    &[
                        permissions::radiology::orders::VIEW,
                        permissions::quality::indicators::LIST,
                    ],
                    ReportPriority::P2,
                    ReportReadiness::QueryBuildable,
                    &["control chart", "heatmap"],
                    "heatmap",
                    "Daily / monthly",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["modality", "protocol", "machine", "staff role"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "radiology-quality-critical-findings",
                    "Report quality, amendments, critical findings",
                    "Amendment rate, unsigned reports, and critical result acknowledgement.",
                    &["radiology_reports", "signed_records", "critical_findings"],
                    &[permissions::radiology::orders::VIEW],
                    ReportPriority::P2,
                    ReportReadiness::QueryBuildable,
                    &["bar", "funnel"],
                    "funnel",
                    "Daily",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["radiologist", "modality", "report type", "severity"],
                    ReportDataKind::NotWired,
                ),
            ],
        ),
        family(
            "pharmacy",
            "Pharmacy",
            "Medication continuity, safety, and stock control",
            "Fulfillment, stockout risk, NDPS compliance, returns, ADRs, and leakage.",
            vec![
                report(
                    "pharmacy-fulfillment-turnaround",
                    "Prescription fulfillment and turnaround",
                    "Ordered vs dispensed, partial fills, substitutions, and dispense time.",
                    &["prescriptions", "pharmacy_orders", "pharmacy_order_items"],
                    &[permissions::pharmacy::analytics::VIEW],
                    ReportPriority::P1,
                    ReportReadiness::QueryBuildable,
                    &["funnel", "line"],
                    "funnel",
                    "15 min / hourly",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["doctor", "department", "formulation", "OP/IP"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "pharmacy-stockout-expiry-days-on-hand",
                    "Stockout risk, near-expiry, days on hand",
                    "At-risk SKUs, expiry exposure, and replenishment urgency.",
                    &["pharmacy_batches", "stock_transactions", "purchase_orders"],
                    &[permissions::pharmacy::analytics::VIEW],
                    ReportPriority::P1,
                    ReportReadiness::QueryBuildable,
                    &["heatmap", "treemap"],
                    "treemap",
                    "15 min / hourly",
                    STANDARD_EXPORTS,
                    ReportExportMode::Standard,
                    &["store", "SKU", "category", "vendor", "ABC/VED"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "pharmacy-ndps-high-risk-compliance",
                    "NDPS and high-risk medication compliance",
                    "Controlled-drug issue logs, dual-check completion, and variance.",
                    &["ndps_register", "prescriptions", "pharmacy_dispensing"],
                    &[permissions::pharmacy::ndps::LIST],
                    ReportPriority::P1,
                    ReportReadiness::LiveApi,
                    &["heatmap", "control chart"],
                    "heatmap",
                    "Shift / daily",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["store", "drug", "pharmacist", "shift"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "pharmacy-safety-returns-margin-leakage",
                    "Medication safety, ADRs, returns and margin leakage",
                    "High-risk alerts, error/ADR trend, returns, and credit leakage.",
                    &[
                        "prescriptions",
                        "quality_incidents",
                        "pharmacy_returns",
                        "credit_notes",
                    ],
                    &[permissions::pharmacy::analytics::VIEW],
                    ReportPriority::P1,
                    ReportReadiness::LiveApi,
                    &["sankey", "waterfall", "line"],
                    "sankey",
                    "Daily",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["drug class", "unit", "pharmacist", "doctor", "vendor"],
                    ReportDataKind::NotWired,
                ),
            ],
        ),
        family(
            "finance",
            "Billing and Finance",
            "Revenue cycle and money returns",
            "Gross-to-net revenue, cash settlement, A/R, DNFB, denials, refunds, and concessions.",
            vec![
                report(
                    "billing-gross-net-payer-mix",
                    "Gross-to-net revenue and payer mix",
                    "Gross charges, deductions, package mix, and payer mix.",
                    &[
                        "invoices",
                        "invoice_items",
                        "payments",
                        "packages",
                        "concessions",
                    ],
                    &[permissions::billing::reports::VIEW],
                    ReportPriority::P1,
                    ReportReadiness::LiveApi,
                    &["stacked bar", "line", "sunburst"],
                    "treemap",
                    "Intraday / daily",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["payer", "department", "package", "service line"],
                    ReportDataKind::DeptRevenue,
                ),
                report(
                    "billing-collections-settlement",
                    "Collections, cash, and daily settlement",
                    "POS cash, digital collections, payment mode, and settlement variance.",
                    &["payments", "invoices", "cashier_settlements"],
                    &[permissions::billing::reports::VIEW],
                    ReportPriority::P1,
                    ReportReadiness::LiveApi,
                    &["line", "waterfall"],
                    "line",
                    "Intraday / day close",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["counter", "payment mode", "payer", "cashier"],
                    ReportDataKind::DeptRevenue,
                ),
                report(
                    "billing-ar-dnfb-unpaid-discharge",
                    "A/R aging, DNFB, unpaid discharge",
                    "Aging buckets, discharged-not-final-billed, and unpaid discharge risk.",
                    &["aging", "invoices", "admissions", "payments"],
                    &[permissions::billing::reports::VIEW],
                    ReportPriority::P1,
                    ReportReadiness::QueryBuildable,
                    &["heatmap", "bar"],
                    "heatmap",
                    "Daily",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["payer", "aging bucket", "department", "ward"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "billing-denials-refunds-concessions",
                    "Denials, refunds, concessions",
                    "Rejections by cause, refund load, concession trend, and leakage path.",
                    &["invoices", "payments", "concessions", "refunds", "denials"],
                    &[permissions::billing::reports::VIEW],
                    ReportPriority::P1,
                    ReportReadiness::QueryBuildable,
                    &["sankey", "waterfall", "pareto"],
                    "sankey",
                    "Daily",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["payer", "denial code", "package", "department"],
                    ReportDataKind::NotWired,
                ),
            ],
        ),
        family(
            "camp",
            "Camp",
            "Outreach and offline operations",
            "Coverage, turnout, screening yield, referral conversion, sync health, and rural follow-up.",
            vec![
                report(
                    "camp-coverage-turnout",
                    "Camp coverage and turnout trend",
                    "Camp count, registrations, turnout, and location performance.",
                    &["camp_camps", "camp_registrations", "camp_screenings"],
                    &[permissions::camp::LIST],
                    ReportPriority::P1,
                    ReportReadiness::LiveApi,
                    &["line", "map", "stacked bar"],
                    "map",
                    "After event / daily",
                    STANDARD_EXPORTS,
                    ReportExportMode::Standard,
                    &["village", "organizer", "camp type", "date"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "camp-screening-referral-conversion",
                    "Screening yield and referral conversion",
                    "Positive-screen yield, referral issued, referral arrived, and admitted.",
                    &["camp_screenings", "camp_referrals", "camp_lab_samples"],
                    &[permissions::camp::screenings::LIST],
                    ReportPriority::P1,
                    ReportReadiness::QueryBuildable,
                    &["funnel", "treemap"],
                    "funnel",
                    "Daily / after event",
                    STANDARD_EXPORTS,
                    ReportExportMode::Standard,
                    &["camp", "condition", "age and sex", "village"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "camp-disease-followup-map",
                    "Disease cluster and follow-up map",
                    "Geographic clustering of positives and follow-up completion.",
                    &["camp_screenings", "camp_referrals", "geo_towns", "patients"],
                    &[permissions::camp::followups::LIST],
                    ReportPriority::P2,
                    ReportReadiness::QueryBuildable,
                    &["geo scatter", "heatmap"],
                    "map",
                    "Daily / weekly",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["disease", "geography", "date window", "camp type"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "camp-sync-supplies-incidents",
                    "Offline sync, supplies, incident health",
                    "Sync lag, failed uploads, supply use, and field incidents.",
                    &["camp_sync_events", "camp_supplies", "camp_incidents"],
                    &[permissions::camp::LIST],
                    ReportPriority::P1,
                    ReportReadiness::QueryBuildable,
                    &["status matrix", "line", "bar"],
                    "matrix",
                    "Near-real-time during camp",
                    STANDARD_EXPORTS,
                    ReportExportMode::Standard,
                    &["device", "field worker", "camp", "date"],
                    ReportDataKind::NotWired,
                ),
            ],
        ),
        family(
            "quality",
            "NABH and Quality",
            "Accreditation evidence and safety learning",
            "NABH evidence, incidents, CAPA, audit nonconformity, complaints, PROM and PREM.",
            vec![
                report(
                    "nabh-evidence-matrix",
                    "NABH indicator evidence matrix",
                    "Indicator status, evidence completeness, trend direction, and submission readiness.",
                    &["quality_indicators", "quality_audits", "quality_committees"],
                    &[permissions::quality::indicators::LIST],
                    ReportPriority::P1,
                    ReportReadiness::LiveApi,
                    &["matrix", "sparkline"],
                    "matrix",
                    "Monthly / quarterly",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["indicator", "chapter", "department", "period"],
                    ReportDataKind::NabhIndicators,
                ),
                report(
                    "quality-incident-sentinel-trend",
                    "Incident and sentinel-event trend",
                    "Incident count, severity mix, near-miss ratio, and event type Pareto.",
                    &[
                        "quality_incidents",
                        "quality_sentinel_events",
                        "quality_committees",
                    ],
                    &[permissions::quality::incidents::LIST],
                    ReportPriority::P1,
                    ReportReadiness::LiveApi,
                    &["line", "stacked bar", "pareto"],
                    "line",
                    "Daily / weekly",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["severity", "department", "event type", "shift"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "quality-capa-audit-aging",
                    "CAPA and audit nonconformity aging",
                    "Open CAPAs, overdue actions, and audit nonconformity closure time.",
                    &["quality_capa", "quality_audits"],
                    &[
                        permissions::quality::capa::LIST,
                        permissions::quality::audits::LIST,
                    ],
                    ReportPriority::P1,
                    ReportReadiness::LiveApi,
                    &["funnel", "boxplot"],
                    "funnel",
                    "Daily / weekly",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["chapter", "owner", "department", "severity"],
                    ReportDataKind::CapaAging,
                ),
                report(
                    "quality-feedback-complaints-prem-prom",
                    "Patient feedback, complaints, PROM/PREM",
                    "Complaint aging, satisfaction trend, and experience by touchpoint.",
                    &["feedback", "complaints", "quality_indicators"],
                    &[permissions::quality::indicators::LIST],
                    ReportPriority::P1,
                    ReportReadiness::QueryBuildable,
                    &["line", "radar", "bar"],
                    "radar",
                    "Daily / monthly",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["touchpoint", "unit", "doctor", "cohort"],
                    ReportDataKind::NotWired,
                ),
            ],
        ),
        family(
            "community",
            "Community and Geo",
            "Catchment, disease geography, and access gaps",
            "Patient origin, referral networks, disease seasonality, and underserved geography.",
            vec![
                report(
                    "geo-patient-origin-service-area",
                    "Patient origin and service area map",
                    "Where patients come from, referral catchment, and service intensity.",
                    &[
                        "patients",
                        "encounters",
                        "appointments",
                        "admissions",
                        "geo_towns",
                    ],
                    &[permissions::analytics::VIEW],
                    ReportPriority::P2,
                    ReportReadiness::QueryBuildable,
                    &["choropleth", "flow lines"],
                    "map",
                    "Daily / weekly",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["pincode", "district", "village", "specialty", "payer"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "geo-disease-hotspot-seasonality",
                    "Disease burden hotspot and seasonality",
                    "Case density by geography and month or season.",
                    &["encounters", "diagnoses", "lab_results", "geo_towns"],
                    &[
                        permissions::analytics::VIEW,
                        permissions::quality::indicators::LIST,
                    ],
                    ReportPriority::P2,
                    ReportReadiness::QueryBuildable,
                    &["map", "calendar heatmap"],
                    "map",
                    "Daily / weekly",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["disease", "geography", "month", "age and sex"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "geo-referral-network-catchment-flow",
                    "Referral network and catchment flow",
                    "Source-to-destination referral patterns and load concentration.",
                    &["referrals", "registrations", "appointments", "admissions"],
                    &[permissions::analytics::VIEW],
                    ReportPriority::P2,
                    ReportReadiness::QueryBuildable,
                    &["graph", "sankey"],
                    "graph",
                    "Weekly / monthly",
                    STANDARD_EXPORTS,
                    ReportExportMode::Standard,
                    &["source village", "spoke site", "specialty", "date"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "geo-access-gap-underserved",
                    "Access gap and underserved geography",
                    "Areas with long travel burden, weak utilization, or weak follow-up.",
                    &[
                        "geo_boundaries",
                        "facility_master",
                        "appointments",
                        "camp_camps",
                    ],
                    &[permissions::analytics::VIEW],
                    ReportPriority::P3,
                    ReportReadiness::Predictive,
                    &["isochrone map", "scatter"],
                    "map",
                    "Monthly",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["geography", "payer", "age and sex", "service line"],
                    ReportDataKind::NotWired,
                ),
            ],
        ),
        family(
            "body",
            "Body and Clinical Maps",
            "Anatomy-aware clinical burden",
            "Dental, pain, wound, pressure-ulcer, eye, ENT, and specialty regional findings.",
            vec![
                report(
                    "body-dental-odontogram",
                    "Dental findings odontogram",
                    "Tooth-level findings, missing, treated, and restored distribution.",
                    &["dental_findings", "dental_procedures"],
                    &[permissions::patients::VIEW],
                    ReportPriority::P3,
                    ReportReadiness::CaptureNeeded,
                    &["custom SVG odontogram"],
                    "body",
                    "Encounter close / daily",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["encounter", "provider", "age and sex", "tooth region"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "body-pain-location-map",
                    "Pain location intensity map",
                    "Body-region pain burden and movement over follow-ups.",
                    &["pain_assessments", "visits"],
                    &[permissions::patients::notes::VIEW],
                    ReportPriority::P3,
                    ReportReadiness::CaptureNeeded,
                    &["custom SVG heatmap"],
                    "body",
                    "Daily",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["provider", "diagnosis", "severity", "date"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "body-wound-pressure-ulcer-map",
                    "Wound, pressure-ulcer, lesion body map",
                    "Site, stage, progression, and healing trajectory.",
                    &["wound_assessments", "skin_assessments", "admissions"],
                    &[
                        permissions::nurse::wound::VIEW,
                        permissions::quality::pressure_ulcer::LIST,
                    ],
                    ReportPriority::P2,
                    ReportReadiness::CaptureNeeded,
                    &["custom SVG", "timeline"],
                    "body",
                    "Encounter close / daily",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["ward", "wound type", "stage", "date"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "body-specialty-regional-findings",
                    "Eye, ENT, ortho regional findings map",
                    "Specialty-region findings mapped to anatomy.",
                    &["specialty_findings", "procedures", "diagnoses"],
                    &[permissions::patients::VIEW],
                    ReportPriority::P3,
                    ReportReadiness::CaptureNeeded,
                    &["custom SVG"],
                    "body",
                    "Encounter close / daily",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["specialty", "provider", "side", "severity"],
                    ReportDataKind::NotWired,
                ),
            ],
        ),
        family(
            "ot_surgery",
            "OT / Surgery",
            "Theatre utilization and surgical safety",
            "OT calendar utilization, start delays, cancellations, checklist compliance, SSI, implants, and outcome signals.",
            vec![
                report(
                    "ot-utilization-calendar",
                    "OT utilization calendar",
                    "Room-wise booked, cut-to-close, turnover, idle, and emergency overrun load.",
                    &[
                        "ot_bookings",
                        "ot_rooms",
                        "ot_case_records",
                        "ot_turnaround_events",
                    ],
                    &[permissions::ot::reports::VIEW],
                    ReportPriority::P1,
                    ReportReadiness::QueryBuildable,
                    &["calendar heatmap"],
                    "heatmap",
                    "Daily / shift",
                    STANDARD_EXPORTS,
                    ReportExportMode::Standard,
                    &["OT room", "surgeon", "procedure class", "shift"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "ot-delay-turnaround-boxplot",
                    "OT start delay and turnaround boxplot",
                    "First-case delay, patient-in to incision, close-to-clean, and next-case readiness variation.",
                    &["ot_bookings", "ot_case_records", "ot_safety_checklists"],
                    &[permissions::ot::reports::VIEW],
                    ReportPriority::P1,
                    ReportReadiness::QueryBuildable,
                    &["boxplot"],
                    "boxplot",
                    "Daily",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["surgeon", "anesthesia type", "room", "delay reason"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "ot-cancelled-surgery-pareto",
                    "Cancelled surgery Pareto",
                    "Cancellation reasons ranked by preventability, late cancellation, and downstream bed impact.",
                    &[
                        "ot_bookings",
                        "ot_case_records",
                        "admissions",
                        "bed_reservations",
                    ],
                    &[permissions::ot::reports::VIEW],
                    ReportPriority::P1,
                    ReportReadiness::LiveApi,
                    &["pareto bar", "waterfall"],
                    "sankey",
                    "Daily / weekly",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["reason", "surgeon", "specialty", "bed impact"],
                    ReportDataKind::OtCancellations,
                ),
                report(
                    "ot-checklist-ssi-outcome-matrix",
                    "OT checklist, SSI, and outcome matrix",
                    "WHO surgical safety checklist completion, antibiotic timing, implant traceability, SSI, and outcome exceptions.",
                    &[
                        "ot_safety_checklists",
                        "infection_surveillance",
                        "ot_implants",
                        "postop_notes",
                    ],
                    &[
                        permissions::ot::reports::VIEW,
                        permissions::quality::indicators::LIST,
                    ],
                    ReportPriority::P1,
                    ReportReadiness::QueryBuildable,
                    &["matrix", "heatmap"],
                    "matrix",
                    "Daily / weekly",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["procedure", "surgeon", "checklist item", "infection marker"],
                    ReportDataKind::NotWired,
                ),
            ],
        ),
        family(
            "icu_critical",
            "ICU / Critical Care",
            "High-acuity capacity and deterioration signals",
            "ICU occupancy, ventilator load, acuity scores, sepsis alerts, bundle compliance, and critical lab response.",
            vec![
                report(
                    "icu-occupancy-trend",
                    "ICU occupancy and acuity trend",
                    "ICU bed pressure with SOFA/APACHE burden, isolation load, and step-down readiness.",
                    &["admissions", "beds", "icu_flowsheets", "icu_scores"],
                    &[
                        permissions::icu::flowsheets::LIST,
                        permissions::ipd::reports::VIEW,
                    ],
                    ReportPriority::P1,
                    ReportReadiness::QueryBuildable,
                    &["line", "gauge"],
                    "gauge",
                    "Near-real-time / hourly",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["ICU", "bed", "consultant", "acuity score"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "icu-ventilator-utilization",
                    "Ventilator utilization gauge",
                    "Ventilator occupancy, invasive/non-invasive split, weaning readiness, and device shortage risk.",
                    &["icu_ventilator_events", "icu_devices", "icu_flowsheets"],
                    &[permissions::icu::ventilator::LIST],
                    ReportPriority::P1,
                    ReportReadiness::QueryBuildable,
                    &["gauge", "stacked bar"],
                    "gauge",
                    "Near-real-time / hourly",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["device", "bed", "mode", "weaning status"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "icu-sepsis-alert-timeline",
                    "Sepsis and critical alert timeline",
                    "Sepsis screen positives, lactate delay, antibiotic timing, escalation, and closure.",
                    &[
                        "icu_flowsheets",
                        "lab_results",
                        "prescriptions",
                        "critical_alerts",
                    ],
                    &[
                        permissions::icu::scores::LIST,
                        permissions::lab::reports::VIEW,
                    ],
                    ReportPriority::P1,
                    ReportReadiness::QueryBuildable,
                    &["timeline", "alert markers"],
                    "line",
                    "15 min / hourly",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["bed", "consultant", "score band", "alert status"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "icu-hai-bundle-trend",
                    "ICU VAP / CLABSI / CAUTI bundle trend",
                    "Device days, bundle compliance, infection signal, and unit-level prevention gaps.",
                    &[
                        "infection_surveillance",
                        "icu_devices",
                        "icu_flowsheets",
                        "quality_indicators",
                    ],
                    &[
                        permissions::icu::flowsheets::LIST,
                        permissions::infection_control::surveillance::LIST,
                    ],
                    ReportPriority::P1,
                    ReportReadiness::QueryBuildable,
                    &["multi-line", "heatmap"],
                    "heatmap",
                    "Daily / weekly",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["infection type", "ICU", "device", "bundle element"],
                    ReportDataKind::NotWired,
                ),
            ],
        ),
        family(
            "infection_control",
            "Infection Control",
            "HAI, stewardship, hygiene, and outbreak surveillance",
            "Ward infection heatmaps, antibiogram, hand hygiene, BMW compliance, needle-stick, sterilization, and outbreak signals.",
            vec![
                report(
                    "infection-hai-trend",
                    "HAI / SSI / CAUTI / CLABSI / VAP trend",
                    "Healthcare-associated infection trend with device days and unit-normalized rates.",
                    &["infection_surveillance", "quality_indicators", "admissions"],
                    &[permissions::infection_control::surveillance::LIST],
                    ReportPriority::P1,
                    ReportReadiness::LiveApi,
                    &["multi-line"],
                    "line",
                    "Daily / weekly",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["infection type", "ward", "device", "organism"],
                    ReportDataKind::HaiRate,
                ),
                report(
                    "infection-ward-heatmap",
                    "Ward-wise infection heatmap",
                    "Unit hot spots by ward, organism, procedure group, and device exposure.",
                    &[
                        "infection_surveillance",
                        "wards",
                        "lab_results",
                        "admissions",
                    ],
                    &[permissions::infection_control::surveillance::LIST],
                    ReportPriority::P1,
                    ReportReadiness::QueryBuildable,
                    &["heatmap"],
                    "heatmap",
                    "Daily",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["ward", "organism", "sample source", "case definition"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "infection-antibiogram-heatmap",
                    "Antibiogram resistance heatmap",
                    "Organism-antibiotic resistance pattern for stewardship and formulary action.",
                    &[
                        "lab_results",
                        "microbiology_results",
                        "antibiotic_sensitivity",
                    ],
                    &[
                        permissions::infection_control::stewardship::LIST,
                        permissions::lab::reports::VIEW,
                    ],
                    ReportPriority::P1,
                    ReportReadiness::QueryBuildable,
                    &["heatmap"],
                    "heatmap",
                    "Weekly / monthly",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["organism", "antibiotic", "sample source", "unit"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "infection-hygiene-outbreak-signal",
                    "Hand hygiene and outbreak signal",
                    "Hand hygiene compliance, isolation bed use, biowaste misses, and outbreak anomaly alerts.",
                    &[
                        "hand_hygiene_audits",
                        "infection_outbreaks",
                        "biowaste_records",
                        "isolation_beds",
                    ],
                    &[
                        permissions::infection_control::hygiene::LIST,
                        permissions::infection_control::outbreak::LIST,
                    ],
                    ReportPriority::P1,
                    ReportReadiness::LiveApi,
                    &["gauge", "anomaly line", "calendar heatmap"],
                    "forecast",
                    "Daily",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["ward", "audit point", "outbreak cluster", "waste stream"],
                    ReportDataKind::HandHygieneCompliance,
                ),
            ],
        ),
        family(
            "hr_training",
            "HR / Staff / Training",
            "Credentialing, roster coverage, and workforce safety",
            "Attendance calendars, shift gaps, training compliance, nurse-patient ratios, license expiry, vaccination, and skill mix.",
            vec![
                report(
                    "hr-attendance-calendar",
                    "Staff attendance calendar",
                    "Duty presence, late marks, absenteeism, and critical shift staffing gaps.",
                    &["hr_attendance", "hr_rosters", "departments"],
                    &[permissions::hr::attendance::LIST],
                    ReportPriority::P1,
                    ReportReadiness::QueryBuildable,
                    &["calendar heatmap"],
                    "heatmap",
                    "Daily / shift",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["department", "role", "shift", "employee"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "hr-roster-coverage-heatmap",
                    "Shift coverage gap heatmap",
                    "Rostered vs required staffing by ward, skill, shift, and peak workload.",
                    &["hr_rosters", "wards", "admissions", "opd_queues"],
                    &[permissions::hr::roster::LIST, permissions::analytics::VIEW],
                    ReportPriority::P1,
                    ReportReadiness::QueryBuildable,
                    &["heatmap"],
                    "heatmap",
                    "Daily / weekly",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["ward", "skill", "shift", "load band"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "hr-training-compliance-heatmap",
                    "Mandatory training compliance heatmap",
                    "BLS, infection control, BMW, fire, medication safety, and role-specific training completion.",
                    &[
                        "hr_training_records",
                        "hr_employees",
                        "quality_training_requirements",
                    ],
                    &[permissions::hr::training::LIST],
                    ReportPriority::P1,
                    ReportReadiness::QueryBuildable,
                    &["heatmap", "gauge"],
                    "heatmap",
                    "Weekly / monthly",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["department", "role", "training", "expiry window"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "hr-credential-license-expiry",
                    "Credential and license expiry aging",
                    "Doctor, nurse, technician, radiation worker, and pharmacist credential expiry risk.",
                    &["hr_credentials", "hr_employees", "radiation_tld_logs"],
                    &[permissions::hr::credentials::LIST],
                    ReportPriority::P1,
                    ReportReadiness::LiveApi,
                    &["aging bar", "timeline"],
                    "line",
                    "Daily",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["credential type", "department", "role", "expiry bucket"],
                    ReportDataKind::CredentialExpiry,
                ),
            ],
        ),
        family(
            "mrd_records",
            "MRD / Medical Records",
            "Record completion, coding, and legal readiness",
            "Discharge summaries, consent forms, doctor signatures, ICD/procedure coding, MLC, file retrieval, and identity mismatch.",
            vec![
                report(
                    "mrd-discharge-summary-completion",
                    "Discharge summary completion gauge",
                    "Discharge summary completeness and TAT against MRD release policy.",
                    &["mrd_records", "admissions", "discharge_summaries"],
                    &[permissions::mrd::records::LIST],
                    ReportPriority::P1,
                    ReportReadiness::LiveApi,
                    &["gauge", "boxplot"],
                    "gauge",
                    "Daily",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["department", "consultant", "record type", "TAT bucket"],
                    ReportDataKind::DischargeSummaryCompletion,
                ),
                report(
                    "mrd-file-deficiency-matrix",
                    "Medical file deficiency matrix",
                    "Missing consent, notes, signatures, death/birth/MLC forms, and legal document gaps.",
                    &["mrd_records", "consents", "signed_records", "audit_log"],
                    &[permissions::mrd::records::LIST],
                    ReportPriority::P1,
                    ReportReadiness::QueryBuildable,
                    &["matrix", "heatmap"],
                    "matrix",
                    "Daily / weekly",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["department", "record type", "deficiency", "age bucket"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "mrd-coding-completion",
                    "ICD and procedure coding completion",
                    "Diagnosis and procedure coding completeness for claims, NMC, research, and outcomes.",
                    &["diagnoses", "procedure_logs", "admissions", "encounters"],
                    &[permissions::mrd::records::LIST],
                    ReportPriority::P1,
                    ReportReadiness::QueryBuildable,
                    &["gauge", "stacked bar"],
                    "gauge",
                    "Daily / weekly",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["specialty", "consultant", "ICD status", "procedure class"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "mrd-duplicate-identity-alerts",
                    "Duplicate UHID and identity mismatch alerts",
                    "Suspected duplicate records, missing ABHA/Aadhaar/mobile, and risky demographic collisions.",
                    &["patients", "mrd_records", "mpi_match_results", "abha_links"],
                    &[permissions::mrd::records::LIST, permissions::patients::VIEW],
                    ReportPriority::P1,
                    ReportReadiness::QueryBuildable,
                    &["graph", "alert cards"],
                    "graph",
                    "Daily",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["match confidence", "registrar", "site", "missing field"],
                    ReportDataKind::NotWired,
                ),
            ],
        ),
        family(
            "security",
            "Security and Data Quality",
            "Trust, identity, and digital governance",
            "Registration completeness, ABHA linkage, duplicate UHID risk, unsigned records, and access anomaly.",
            vec![
                report(
                    "data-quality-abha-linkage",
                    "Registration completeness and ABHA linkage",
                    "Missing demographics, ABHA linkage, invalid fields, and consent coverage.",
                    &["patients", "encounters", "abha_links", "consents"],
                    &[permissions::analytics::VIEW],
                    ReportPriority::P1,
                    ReportReadiness::QueryBuildable,
                    &["heatmap", "bar"],
                    "heatmap",
                    "Daily",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["registration desk", "unit", "staff", "date"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "security-duplicate-uhid-risk",
                    "Duplicate UHID identity risk graph",
                    "Suspected duplicates and match-confidence clusters.",
                    &["patients", "encounters", "mpi_match_results"],
                    &[permissions::patients::VIEW],
                    ReportPriority::P1,
                    ReportReadiness::QueryBuildable,
                    &["graph", "table"],
                    "graph",
                    "Daily",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["site", "age band", "match confidence", "registrar"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "security-unsigned-amended-records",
                    "Unsigned and amended records aging",
                    "Pending signatures, amended reports, and old open drafts.",
                    &[
                        "audit_log",
                        "signed_records",
                        "radiology_reports",
                        "lab_results",
                    ],
                    &[
                        permissions::audit::VIEW,
                        permissions::quality::indicators::LIST,
                    ],
                    ReportPriority::P1,
                    ReportReadiness::LiveApi,
                    &["bar", "boxplot"],
                    "boxplot",
                    "Near-real-time / daily",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["document type", "unit", "clinician", "age bucket"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "security-access-anomaly-surveillance",
                    "Access anomaly and audit-trail surveillance",
                    "After-hours access, cross-location access, and unusual record views.",
                    &["audit_log", "user_sessions", "security_events"],
                    &[permissions::audit::ACCESS_VIEW],
                    ReportPriority::P1,
                    ReportReadiness::LiveApi,
                    &["scatter", "calendar heatmap", "network"],
                    "heatmap",
                    "Near-real-time / daily",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["user", "role", "location", "record type"],
                    ReportDataKind::NotWired,
                ),
            ],
        ),
        family(
            "predictive",
            "Predictive Models",
            "Decision-support forecasts",
            "Bed demand, no-shows, stockout, outbreak, incident, and capacity early warnings.",
            vec![
                report(
                    "predict-bed-demand-discharge",
                    "Bed demand and discharge forecast",
                    "Occupancy forecast, expected discharges, and likely bottlenecks.",
                    &[
                        "admissions",
                        "beds",
                        "discharge_history",
                        "calendar_features",
                    ],
                    &[
                        permissions::analytics::VIEW,
                        permissions::ipd::reports::VIEW,
                    ],
                    ReportPriority::P2,
                    ReportReadiness::Predictive,
                    &["forecast line", "interval band"],
                    "forecast",
                    "Daily / weekly",
                    STANDARD_EXPORTS,
                    ReportExportMode::Standard,
                    &["ward", "bed class", "season", "event window"],
                    ReportDataKind::BedOccupancy,
                ),
                report(
                    "predict-opd-noshow-load",
                    "No-show and OPD load forecast",
                    "Probability of no-show and future clinic crowding.",
                    &["appointments", "opd_queues", "encounter_history"],
                    &[permissions::scheduling::analytics::VIEW],
                    ReportPriority::P2,
                    ReportReadiness::Predictive,
                    &["forecast line", "risk heatmap"],
                    "forecast",
                    "Daily",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["clinic", "consultant", "slot", "payer"],
                    ReportDataKind::SchedulingNoShow,
                ),
                report(
                    "predict-stockout-near-expiry",
                    "Stockout and near-expiry forecast",
                    "Future shortage risk and expiry exposure.",
                    &[
                        "stock_transactions",
                        "pharmacy_batches",
                        "replenishment_history",
                    ],
                    &[permissions::pharmacy::analytics::VIEW],
                    ReportPriority::P2,
                    ReportReadiness::Predictive,
                    &["forecast line", "treemap"],
                    "forecast",
                    "Daily / weekly",
                    STANDARD_EXPORTS,
                    ReportExportMode::Standard,
                    &["SKU", "store", "vendor", "ABC/VED"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "predict-infection-outbreak-incident",
                    "Infection, outbreak, incident early warning",
                    "Statistical anomaly detection over cases, incidents, and notifiable events.",
                    &[
                        "lab_results",
                        "quality_incidents",
                        "screenings",
                        "notifiable_diseases",
                    ],
                    &[permissions::quality::indicators::LIST],
                    ReportPriority::P2,
                    ReportReadiness::Predictive,
                    &["anomaly line", "map", "alert band"],
                    "forecast",
                    "Daily / weekly",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["disease", "ward", "unit", "geography"],
                    ReportDataKind::NotWired,
                ),
            ],
        ),
        family(
            "nmc",
            "NMC Overlay",
            "Teaching hospital evidence",
            "Specialty occupancy, OPD clinical material, procedure mix, and MRD completeness.",
            vec![
                report(
                    "nmc-specialty-bed-occupancy",
                    "Specialty bed occupancy vs NMC threshold",
                    "Specialty-wise bed occupancy against expected minimums.",
                    &["admissions", "wards", "specialty_map"],
                    &[
                        permissions::ipd::reports::VIEW,
                        permissions::analytics::VIEW,
                    ],
                    ReportPriority::P2,
                    ReportReadiness::QueryBuildable,
                    &["line", "target band"],
                    "line",
                    "Monthly / quarterly",
                    STANDARD_EXPORTS,
                    ReportExportMode::Standard,
                    &["specialty", "month", "unit"],
                    ReportDataKind::BedOccupancy,
                ),
                report(
                    "nmc-opd-clinical-material",
                    "Specialty OPD attendance and clinical material",
                    "OPD attendance by specialty and teaching-load adequacy.",
                    &["appointments", "encounters", "specialty_map"],
                    &[permissions::analytics::VIEW],
                    ReportPriority::P2,
                    ReportReadiness::QueryBuildable,
                    &["line", "stacked bar"],
                    "line",
                    "Monthly / quarterly",
                    STANDARD_EXPORTS,
                    ReportExportMode::Standard,
                    &["specialty", "session", "faculty unit"],
                    ReportDataKind::OpdFootfall,
                ),
                report(
                    "nmc-procedure-case-mix",
                    "Procedure and case-mix teaching material adequacy",
                    "Breadth and depth of procedures or cases available for teaching.",
                    &["procedure_logs", "ot_bookings", "admissions"],
                    &[permissions::analytics::VIEW],
                    ReportPriority::P3,
                    ReportReadiness::CaptureNeeded,
                    &["treemap", "boxplot"],
                    "treemap",
                    "Monthly / quarterly",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["specialty", "procedure class", "month", "quarter"],
                    ReportDataKind::NotWired,
                ),
                report(
                    "nmc-mrd-completeness-availability",
                    "MRD completeness and record availability",
                    "Record completion, availability, and retention readiness.",
                    &["mrd_records", "admissions", "discharge_summaries"],
                    &[permissions::analytics::VIEW],
                    ReportPriority::P2,
                    ReportReadiness::QueryBuildable,
                    &["heatmap", "KPI tiles"],
                    "heatmap",
                    "Monthly / quarterly",
                    GOVERNED_EXPORTS,
                    ReportExportMode::Governed,
                    &["department", "record type", "age bucket", "missing field"],
                    ReportDataKind::NotWired,
                ),
            ],
        ),
    ]
}

fn can_access_report(claims: &Claims, report: &ReportDefinition) -> bool {
    is_bypass_role(claims)
        || report
            .permissions
            .iter()
            .any(|permission| claims.permissions.iter().any(|claim| claim == permission))
}

fn all_catalog_permissions() -> Vec<String> {
    let mut permissions = Vec::new();
    for family in catalog_seed() {
        for report in family.reports {
            for permission in report.definition.permissions {
                if !permissions.contains(&permission) {
                    permissions.push(permission);
                }
            }
        }
    }
    permissions
}

fn find_report(report_id: &str) -> Option<ReportSeed> {
    catalog_seed()
        .into_iter()
        .flat_map(|family| family.reports)
        .find(|report| report.definition.id == report_id)
}

pub async fn catalog(
    Extension(claims): Extension<Claims>,
) -> Result<Json<ReportCatalogResponse>, AppError> {
    let permissions = all_catalog_permissions();
    let permission_refs: Vec<&str> = permissions.iter().map(String::as_str).collect();
    require_any_permission(&claims, &permission_refs)?;

    let families = catalog_seed()
        .into_iter()
        .filter_map(|family| {
            let reports: Vec<ReportDefinition> = family
                .reports
                .into_iter()
                .map(|report| report.definition)
                .filter(|report| can_access_report(&claims, report))
                .collect();

            if reports.is_empty() {
                return None;
            }

            Some(ReportFamilyDefinition {
                id: family.id.to_owned(),
                title: family.title.to_owned(),
                eyebrow: family.eyebrow.to_owned(),
                description: family.description.to_owned(),
                reports,
            })
        })
        .collect();

    Ok(Json(ReportCatalogResponse {
        generated_at: chrono::Utc::now(),
        families,
    }))
}

pub async fn data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(report_id): Path<String>,
    Query(range): Query<DateRangeQuery>,
) -> Result<Json<ReportDataResponse>, AppError> {
    let report = find_report(&report_id).ok_or(AppError::NotFound)?;
    if !can_access_report(&claims, &report.definition) {
        return Err(AppError::Forbidden);
    }

    match report.data_kind {
        ReportDataKind::DeptRevenue => {
            let Json(rows) =
                analytics::dept_revenue(State(state), Extension(claims), Query(range)).await?;
            live_response(&report_id, "analytics.revenue.department", rows)
        }
        ReportDataKind::OpdFootfall => {
            let Json(rows) =
                analytics::opd_footfall(State(state), Extension(claims), Query(range)).await?;
            live_response(&report_id, "analytics.opd.footfall", rows)
        }
        ReportDataKind::OpdQueueWait => {
            let Json(rows) =
                analytics::opd_queue_wait(State(state), Extension(claims), Query(range)).await?;
            live_response(&report_id, "analytics.opd.queue_wait", rows)
        }
        ReportDataKind::LabCriticalValueCompliance => {
            let Json(rows) =
                analytics::lab_critical_value_compliance(State(state), Extension(claims), Query(range))
                    .await?;
            live_response(&report_id, "analytics.lab.critical_value_compliance", rows)
        }
        ReportDataKind::CredentialExpiry => {
            let Json(rows) = analytics::credential_expiry(State(state), Extension(claims)).await?;
            live_response(&report_id, "analytics.hr.credential_expiry", rows)
        }
        ReportDataKind::CapaAging => {
            let Json(rows) = analytics::capa_aging(State(state), Extension(claims)).await?;
            live_response(&report_id, "analytics.quality.capa_aging", rows)
        }
        ReportDataKind::DischargeSummaryCompletion => {
            let Json(rows) = analytics::discharge_summary_completion(
                State(state),
                Extension(claims),
                Query(range),
            )
            .await?;
            live_response(&report_id, "analytics.mrd.discharge_summary_completion", rows)
        }
        ReportDataKind::HaiRate => {
            let Json(rows) =
                analytics::hai_rate(State(state), Extension(claims), Query(range)).await?;
            live_response(&report_id, "analytics.infection.hai_rate", rows)
        }
        ReportDataKind::HandHygieneCompliance => {
            let Json(rows) =
                analytics::hand_hygiene_compliance(State(state), Extension(claims), Query(range))
                    .await?;
            live_response(&report_id, "analytics.infection.hand_hygiene", rows)
        }
        ReportDataKind::ReadmissionWatch => {
            let Json(rows) =
                analytics::readmission_watch(State(state), Extension(claims), Query(range)).await?;
            live_response(&report_id, "analytics.ipd.readmission", rows)
        }
        ReportDataKind::OtCancellations => {
            let Json(rows) =
                analytics::ot_cancellations(State(state), Extension(claims), Query(range)).await?;
            live_response(&report_id, "analytics.ot.cancellations", rows)
        }
        ReportDataKind::SampleRejections => {
            let Json(rows) =
                analytics::sample_rejections(State(state), Extension(claims), Query(range)).await?;
            live_response(&report_id, "analytics.lab.sample_rejections", rows)
        }
        ReportDataKind::BedOccupancy => {
            let Json(rows) = analytics::bed_occupancy(State(state), Extension(claims)).await?;
            live_response(&report_id, "analytics.bed.occupancy", rows)
        }
        ReportDataKind::LabTat => {
            let Json(rows) =
                analytics::lab_tat(State(state), Extension(claims), Query(range)).await?;
            live_response(&report_id, "analytics.lab.tat", rows)
        }
        ReportDataKind::SchedulingNoShow => {
            let params = scheduling::NoshowRatesQuery {
                doctor_id: None,
                department_id: None,
            };
            let Json(rows) =
                scheduling::noshow_rates(State(state), Extension(claims), Query(params)).await?;
            live_response(&report_id, "scheduling.analytics.noshow_rates", rows)
        }
        ReportDataKind::NabhIndicators => {
            let Json(rows) = nabh_indicators::get_indicators(State(state), Extension(claims)).await?;
            live_response(&report_id, "nabh.indicators", vec![rows])
        }
        ReportDataKind::NotWired => Ok(Json(ReportDataResponse {
            report_id,
            generated_at: chrono::Utc::now(),
            summary: ReportDataSummary {
                row_count: 0,
                status: ReportDataStatus::NotWired,
                source: report.definition.source_tables.join(", "),
                warning: Some(
                    "Report is registered but the live source query or capture schema is not wired yet"
                        .to_owned(),
                ),
            },
            rows: Vec::new(),
        })),
    }
}

fn live_response<T: Serialize>(
    report_id: &str,
    source: &str,
    rows: Vec<T>,
) -> Result<Json<ReportDataResponse>, AppError> {
    let values = rows
        .into_iter()
        .map(serde_json::to_value)
        .collect::<Result<Vec<Value>, _>>()
        .map_err(|err| AppError::Internal(format!("serialize report rows: {err}")))?;
    Ok(Json(ReportDataResponse {
        report_id: report_id.to_owned(),
        generated_at: chrono::Utc::now(),
        summary: ReportDataSummary {
            row_count: values.len(),
            status: ReportDataStatus::Live,
            source: source.to_owned(),
            warning: None,
        },
        rows: values,
    }))
}

#[cfg(test)]
mod tests {
    use super::event_metadata_for_report;

    #[test]
    fn billing_report_carries_invoice_payment_event_sources() {
        let metadata = event_metadata_for_report("billing-gross-net-payer-mix");

        assert_eq!(
            metadata.source_events,
            vec![
                "billing.invoice.created".to_owned(),
                "billing.invoice.finalized".to_owned(),
                "billing.payment.received".to_owned(),
            ]
        );
        assert!(
            metadata
                .event_payload_keys
                .iter()
                .any(|key| key == "invoice_id")
        );
        assert!(
            metadata
                .event_payload_keys
                .iter()
                .any(|key| key == "payment_id")
        );
        assert!(
            metadata
                .indicator_targets
                .iter()
                .any(|target| target == "finance.revenue")
        );
    }

    #[test]
    fn registration_report_carries_identity_and_opd_documentation_event_sources() {
        let metadata = event_metadata_for_report("opd-registration-arrivals");

        for event in [
            "patient.updated",
            "patient.search.completed",
            "patient.access_shared",
            "patient.card_printed",
            "opd.vitals.recorded",
            "opd.consultation.saved",
            "opd.prescription.updated",
            "opd.certificate.created",
            "opd.consent.signed",
        ] {
            assert!(
                metadata.source_events.iter().any(|source| source == event),
                "missing event source {event}"
            );
        }

        for key in [
            "search_id",
            "consultation_id",
            "prescription_id",
            "certificate_id",
            "consent_id",
        ] {
            assert!(
                metadata
                    .event_payload_keys
                    .iter()
                    .any(|payload_key| payload_key == key),
                "missing payload key {key}"
            );
        }
    }

    #[test]
    fn ipd_mrd_report_carries_case_sheet_event_sources() {
        let metadata = event_metadata_for_report("nmc-mrd-completeness-availability");

        assert!(
            metadata
                .source_events
                .iter()
                .any(|event| event == "mrd.case_sheet.generated")
        );
        assert!(
            metadata
                .source_events
                .iter()
                .any(|event| event == "mrd.case_sheet.printed")
        );
        assert!(
            metadata
                .event_payload_keys
                .iter()
                .any(|key| key == "packet_id")
        );
        assert!(
            metadata
                .event_payload_keys
                .iter()
                .any(|key| key == "packet_type")
        );
    }

    #[test]
    fn diagnostic_tat_report_carries_sample_collection_event_source() {
        let metadata = event_metadata_for_report("lab-end-to-end-tat");

        assert!(
            metadata
                .source_events
                .iter()
                .any(|event| event == "order.created")
        );
        assert!(
            metadata
                .source_events
                .iter()
                .any(|event| event == "order.cancelled")
        );
        assert!(
            metadata
                .source_events
                .iter()
                .any(|event| event == "lab.sample_collected")
        );
        assert!(
            metadata
                .source_events
                .iter()
                .any(|event| event == "lab.result.posted")
        );
        assert!(
            metadata
                .source_events
                .iter()
                .any(|event| event == "lab.order.completed")
        );
        assert!(
            metadata
                .source_events
                .iter()
                .any(|event| event == "radiology.report.created")
        );
        assert!(
            metadata
                .event_payload_keys
                .iter()
                .any(|key| key == "order_id")
        );
        assert!(
            metadata
                .event_payload_keys
                .iter()
                .any(|key| key == "reason")
        );
        assert!(
            metadata
                .indicator_targets
                .iter()
                .any(|target| target == "lab.tat")
        );
    }

    #[test]
    fn pharmacy_stock_report_carries_indent_requisition_event_sources() {
        let metadata = event_metadata_for_report("pharmacy-stockout-expiry-days-on-hand");

        assert!(
            metadata
                .source_events
                .iter()
                .any(|event| event == "indent.requisition.submitted")
        );
        assert!(
            metadata
                .source_events
                .iter()
                .any(|event| event == "indent.requisition.approved")
        );
        assert!(
            metadata
                .source_events
                .iter()
                .any(|event| event == "indent.requisition.issued")
        );
        assert!(
            metadata
                .source_events
                .iter()
                .any(|event| event == "order.cancelled")
        );
        assert!(
            metadata
                .event_payload_keys
                .iter()
                .any(|key| key == "requisition_id")
        );
        assert!(
            metadata
                .event_payload_keys
                .iter()
                .any(|key| key == "reason")
        );
        assert!(
            metadata
                .indicator_targets
                .iter()
                .any(|target| target == "inventory.stock_movement")
        );
    }

    #[test]
    fn report_without_event_source_has_empty_metadata() {
        let metadata = event_metadata_for_report("lab-qc-eqas-outsourced");

        assert!(metadata.source_events.is_empty());
        assert!(metadata.event_payload_keys.is_empty());
        assert!(metadata.indicator_targets.is_empty());
    }
}

/// reports routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/reports/catalog", get(catalog))
        .route("/api/reports/{id}/data", get(data))
}
