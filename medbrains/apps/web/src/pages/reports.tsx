import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NavLink,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { usePermissionStore } from "@medbrains/stores";
import {
  type ReportDefinition as ApiReportDefinition,
  type EChartsTemplate,
  P,
  type ReportCatalogResponse,
  type ReportDataResponse,
} from "@medbrains/types";
import {
  IconCalendarStats,
  IconChartBar,
  IconCurrencyRupee,
  IconFileAnalytics,
  IconFlask,
  IconHeartRateMonitor,
  IconScale,
  IconSearch,
  IconStethoscope,
  IconX,
} from "@tabler/icons-react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { type ComponentType, useMemo, useState } from "react";
import { PageHeader } from "../components";
import { NabhIndicatorMatrix } from "../components/Reports/NabhIndicatorMatrix";
import { type EChartsCoreOption, ReportChart } from "../components/Reports/ReportChart";
import { ReportDetailPanel } from "../components/Reports/ReportDetailPanel";
import { useRequirePermission } from "../hooks/useRequirePermission";
import { reportsService } from "../services/reports.service";
import styles from "./reports.module.scss";

type ReportPriority = "P1" | "P2" | "P3";
type ReportReadiness =
  | "live_api"
  | "query_buildable"
  | "derived_view"
  | "predictive"
  | "capture_needed";
type ReportExport = "PDF" | "Excel" | "CSV" | "PNG";
type ExportMode = "standard" | "governed";
type VisualKind =
  | "command"
  | "line"
  | "heatmap"
  | "boxplot"
  | "funnel"
  | "sankey"
  | "map"
  | "graph"
  | "radar"
  | "gauge"
  | "treemap"
  | "matrix"
  | "body"
  | "forecast";

interface ReportDefinition {
  id: string;
  title: string;
  purpose: string;
  sourceTables: string[];
  permissions: string[];
  priority: ReportPriority;
  readiness: ReportReadiness;
  chartTypes: string[];
  echartsTemplate?: EChartsTemplate;
  visualKind: VisualKind;
  refresh: string;
  exports: ReportExport[];
  exportMode: ExportMode;
  drilldowns: string[];
  dataEndpoint?: string | null;
}

interface ReportFamily {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  icon: ComponentType<{ size?: number; stroke?: number }>;
  accent: string;
  reports: ReportDefinition[];
}

interface ReportRuntimeData {
  opdFootfall: Array<{
    date: string;
    visit_count: number;
    new_patients: number;
    follow_ups: number;
  }>;
  bedOccupancy: Array<{
    ward_name: string;
    occupied: number;
    vacant: number;
    occupancy_pct: number;
  }>;
  noShows: Array<{
    doctor_id?: string;
    department_id?: string;
    total_appointments: number;
    noshow_count: number;
    noshow_rate?: number;
  }>;
}

interface ReportLoadingState {
  opdFootfall: boolean;
  bedOccupancy: boolean;
  noShows: boolean;
}

type ReportDataById = Record<string, ReportDataResponse<unknown>>;

const STANDARD_EXPORTS: ReportExport[] = ["PDF", "Excel", "CSV", "PNG"];
const GOVERNED_EXPORTS: ReportExport[] = ["PDF", "PNG", "Excel", "CSV"];

const READINESS_META: Record<ReportReadiness, { label: string; color: string }> = {
  live_api: { label: "Live API", color: "green" },
  query_buildable: { label: "Query buildable", color: "blue" },
  derived_view: { label: "Derived view", color: "teal" },
  predictive: { label: "Predictive", color: "grape" },
  capture_needed: { label: "Capture needed", color: "orange" },
};

const PRIORITY_META: Record<ReportPriority, { label: string; color: string }> = {
  P1: { label: "P1 daily", color: "red" },
  P2: { label: "P2 operating", color: "orange" },
  P3: { label: "P3 specialty", color: "gray" },
};

const REPORT_FAMILIES: readonly ReportFamily[] = [
  {
    id: "executive",
    title: "Executive Command",
    eyebrow: "Hospital operating board",
    description:
      "Morning command center for leadership: capacity, money, safety, queues, and red flags.",
    icon: IconChartBar,
    accent: "blue",
    reports: [
      {
        id: "enterprise-kpi-command-board",
        title: "Enterprise KPI command board",
        purpose:
          "OPD visits, IPD census, occupancy, collections, TAT breaches, and incidents in one board.",
        sourceTables: [
          "appointments",
          "admissions",
          "invoices",
          "payments",
          "quality_indicators",
          "quality_incidents",
        ],
        permissions: [P.ANALYTICS.VIEW],
        priority: "P1",
        readiness: "query_buildable",
        chartTypes: ["line", "gauge", "custom KPI cards"],
        visualKind: "command",
        refresh: "Intraday / daily",
        exports: STANDARD_EXPORTS,
        exportMode: "standard",
        drilldowns: ["service line", "facility", "department", "exception list"],
      },
      {
        id: "occupancy-queue-pressure",
        title: "Occupancy and queue pressure",
        purpose: "Congestion signal across beds, ICU, transfers, and OPD queues.",
        sourceTables: ["admissions", "wards", "beds", "opd_queues", "bed_reservations"],
        permissions: [P.ANALYTICS.VIEW],
        priority: "P1",
        readiness: "query_buildable",
        chartTypes: ["line", "stacked bar", "heat strip"],
        visualKind: "heatmap",
        refresh: "5-15 min",
        exports: STANDARD_EXPORTS,
        exportMode: "standard",
        drilldowns: ["ward", "room", "bed", "clinic", "doctor"],
      },
      {
        id: "revenue-collections-leakage",
        title: "Revenue, collections, and leakage",
        purpose: "Gross billing, net billing, concessions, refunds, and write-down direction.",
        sourceTables: ["invoices", "payments", "billing_concessions", "refunds", "credit_notes"],
        permissions: [P.BILLING.REPORTS_VIEW],
        priority: "P1",
        readiness: "live_api",
        chartTypes: ["line", "waterfall", "stacked bar"],
        visualKind: "sankey",
        refresh: "Intraday / day close",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["invoice class", "payer", "department", "refund approval"],
      },
      {
        id: "safety-compliance-red-flags",
        title: "Safety and compliance red flags",
        purpose:
          "Open incidents, overdue CAPA, critical alerts, unsigned records, and audit slippage.",
        sourceTables: [
          "quality_incidents",
          "quality_capa",
          "quality_audits",
          "lab_critical_alerts",
          "audit_log",
          "signed_records",
        ],
        permissions: [P.QUALITY.INDICATORS_LIST],
        priority: "P1",
        readiness: "live_api",
        chartTypes: ["matrix", "heatmap", "alert list"],
        visualKind: "matrix",
        refresh: "Near-real-time / daily",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["severity", "department", "owner", "case drawer"],
      },
    ],
  },
  {
    id: "opd",
    title: "OPD",
    eyebrow: "Front door demand",
    description:
      "Registration, queue, consultant load, cancellations, no-shows, revisits, and patient source.",
    icon: IconStethoscope,
    accent: "teal",
    reports: [
      {
        id: "opd-registration-arrivals",
        title: "Registration and arrival trend",
        purpose: "Registrations, arrivals, walk-ins, and conversion to encounter.",
        sourceTables: ["patients", "appointments", "encounters"],
        permissions: [P.ANALYTICS.VIEW],
        priority: "P1",
        readiness: "query_buildable",
        chartTypes: ["line", "area", "bar"],
        visualKind: "line",
        refresh: "5-15 min / intraday",
        exports: STANDARD_EXPORTS,
        exportMode: "standard",
        drilldowns: ["clinic", "consultant", "patient type", "age/sex"],
      },
      {
        id: "opd-queue-wait-heatmap",
        title: "Queue wait heatmap",
        purpose: "Median and 90th percentile wait by day, hour, clinic, and doctor.",
        sourceTables: ["opd_queues", "appointments", "encounters", "queue_tokens"],
        permissions: [P.ANALYTICS.VIEW],
        priority: "P1",
        readiness: "query_buildable",
        chartTypes: ["heatmap", "line"],
        visualKind: "heatmap",
        refresh: "5-15 min",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["hour", "clinic", "consultant", "patient queue list"],
      },
      {
        id: "opd-consultant-slot-utilization",
        title: "Consultant load and slot utilization",
        purpose: "Slots booked, filled, overrun, idle capacity, and clinic-template pressure.",
        sourceTables: ["appointments", "encounters", "doctor_schedules", "doctor_profiles"],
        permissions: [P.ANALYTICS.VIEW],
        priority: "P1",
        readiness: "query_buildable",
        chartTypes: ["stacked bar", "line"],
        visualKind: "line",
        refresh: "Intraday",
        exports: STANDARD_EXPORTS,
        exportMode: "standard",
        drilldowns: ["consultant", "specialty", "slot duration", "payer"],
      },
      {
        id: "opd-no-show-revisit",
        title: "No-show, cancellation, and revisit behavior",
        purpose: "No-show percentage, short-notice cancellations, and revisit within 7/30 days.",
        sourceTables: ["appointments", "encounters", "noshow_prediction_scores", "patients"],
        permissions: [P.SCHEDULING.ANALYTICS_VIEW],
        priority: "P2",
        readiness: "query_buildable",
        chartTypes: ["cohort heatmap", "line"],
        visualKind: "heatmap",
        refresh: "Daily",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["clinic", "consultant", "time band", "cohort"],
      },
    ],
  },
  {
    id: "ipd",
    title: "IPD",
    eyebrow: "Beds / discharge / utilization",
    description:
      "Ward census, occupancy, length of stay, bed turnaround, and discharge bottlenecks.",
    icon: IconHeartRateMonitor,
    accent: "cyan",
    reports: [
      {
        id: "ipd-census-bed-occupancy",
        title: "Census and bed occupancy",
        purpose: "Daily census, occupancy percentage, ICU load, and reserve vs available beds.",
        sourceTables: ["admissions", "wards", "beds", "bed_reservations"],
        permissions: [P.IPD.REPORTS_VIEW],
        priority: "P1",
        readiness: "live_api",
        chartTypes: ["line", "stacked bar"],
        visualKind: "line",
        refresh: "Near-real-time / hourly",
        exports: STANDARD_EXPORTS,
        exportMode: "standard",
        drilldowns: ["ward", "specialty", "bed class", "ICU/non-ICU"],
      },
      {
        id: "ipd-alos-case-mix",
        title: "ALOS vs case mix",
        purpose: "Length of stay by service line versus baseline and outlier distribution.",
        sourceTables: ["admissions", "encounters", "diagnoses", "billing_packages"],
        permissions: [P.IPD.REPORTS_VIEW],
        priority: "P1",
        readiness: "query_buildable",
        chartTypes: ["boxplot", "control line"],
        visualKind: "boxplot",
        refresh: "Daily",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["specialty", "diagnosis group", "payer", "outlier admission"],
      },
      {
        id: "ipd-bed-turnaround-delay",
        title: "Bed turnaround and housekeeping delay",
        purpose: "Vacate-to-clean, clean-to-ready, transfer friction, and bed-supply blockers.",
        sourceTables: ["bed_turnaround_log", "beds", "wards", "room_turnarounds"],
        permissions: [P.IPD.REPORTS_VIEW],
        priority: "P1",
        readiness: "query_buildable",
        chartTypes: ["boxplot", "bar"],
        visualKind: "boxplot",
        refresh: "Real-time / shift",
        exports: STANDARD_EXPORTS,
        exportMode: "standard",
        drilldowns: ["ward", "bed class", "housekeeping shift", "bed"],
      },
      {
        id: "ipd-discharge-delay-readmission",
        title: "Discharge delay and readmission",
        purpose: "Delay causes, discharge bottlenecks, and 7/30-day readmission watch.",
        sourceTables: ["admissions", "ipd_discharge_tat_log", "encounters", "discharge_barriers"],
        permissions: [P.IPD.REPORTS_VIEW],
        priority: "P1",
        readiness: "query_buildable",
        chartTypes: ["funnel", "line"],
        visualKind: "funnel",
        refresh: "Shift / daily",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["specialty", "consultant", "payer", "delay reason"],
      },
    ],
  },
  {
    id: "lab",
    title: "Laboratory",
    eyebrow: "TAT / quality / traceability",
    description: "Turnaround, critical alerts, sample rejections, QC, EQAS, and outsourced tests.",
    icon: IconFlask,
    accent: "grape",
    reports: [
      {
        id: "lab-end-to-end-tat",
        title: "End-to-end lab TAT",
        purpose: "Order-to-collection, collection-to-result, and result-to-validation TAT.",
        sourceTables: ["lab_orders", "lab_results", "tat_records"],
        permissions: [P.LAB.REPORTS_VIEW],
        priority: "P1",
        readiness: "live_api",
        chartTypes: ["line", "boxplot"],
        visualKind: "boxplot",
        refresh: "15 min / hourly",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["test group", "priority", "ward/OPD", "lab section"],
      },
      {
        id: "lab-critical-value-notification",
        title: "Critical value notification compliance",
        purpose: "Critical values within target time, read-back, and acknowledgement lag.",
        sourceTables: ["lab_critical_alerts", "lab_results", "comm_critical_alerts"],
        permissions: [P.LAB.REPORTS_VIEW],
        priority: "P1",
        readiness: "query_buildable",
        chartTypes: ["funnel", "bullet bar"],
        visualKind: "funnel",
        refresh: "Near-real-time",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["test", "shift", "ward", "ordering doctor"],
      },
      {
        id: "lab-sample-rejection-recollection",
        title: "Sample rejection and recollection",
        purpose: "Rejection rate, reason Pareto, and recollection burden by unit.",
        sourceTables: ["lab_sample_rejections", "lab_orders", "lab_phlebotomy_queue"],
        permissions: [P.LAB.REPORTS_VIEW],
        priority: "P1",
        readiness: "query_buildable",
        chartTypes: ["Pareto bar", "heatmap"],
        visualKind: "heatmap",
        refresh: "Daily",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["collection point", "unit", "phlebotomist", "sample type"],
      },
      {
        id: "lab-qc-eqas-outsourced",
        title: "QC/EQAS and outsourced dependency",
        purpose: "QC failures, EQAS trend, outsourced test share, and external TAT.",
        sourceTables: ["lab_qc_results", "lab_eqas_results", "lab_outsourced_orders"],
        permissions: [P.LAB.REPORTS_VIEW],
        priority: "P2",
        readiness: "query_buildable",
        chartTypes: ["heatmap", "stacked bar"],
        visualKind: "heatmap",
        refresh: "Daily",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["analyzer", "test class", "vendor", "section"],
      },
    ],
  },
  {
    id: "radiology",
    title: "Radiology / DICOM",
    eyebrow: "Imaging workflow",
    description: "Modality use, RIS/PACS/DICOM status, reports, dose, and critical findings.",
    icon: IconFlask,
    accent: "violet",
    reports: [
      {
        id: "radiology-modality-utilization",
        title: "Modality load and scheduling utilization",
        purpose: "CT/MRI/X-ray/USG volume, slot utilization, idle time, and machine pressure.",
        sourceTables: ["radiology_orders", "radiology_dicom_studies", "radiology_modalities"],
        permissions: [P.RADIOLOGY.ORDERS_LIST],
        priority: "P1",
        readiness: "query_buildable",
        chartTypes: ["stacked bar", "calendar heatmap"],
        visualKind: "heatmap",
        refresh: "15 min / hourly",
        exports: STANDARD_EXPORTS,
        exportMode: "standard",
        drilldowns: ["modality", "machine", "shift", "ordering unit"],
      },
      {
        id: "radiology-order-report-tat-backlog",
        title: "Order-to-report TAT and backlog",
        purpose: "Order-to-scan, scan-to-prelim, prelim-to-final, and aged backlog.",
        sourceTables: ["radiology_orders", "radiology_reports", "tat_records"],
        permissions: [P.RADIOLOGY.ORDERS_LIST],
        priority: "P1",
        readiness: "query_buildable",
        chartTypes: ["boxplot", "burn-down line"],
        visualKind: "boxplot",
        refresh: "15 min / hourly",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["modality", "priority", "radiologist", "department"],
      },
      {
        id: "radiology-dose-dosimetry",
        title: "Dose/dosimetry and radiation safety",
        purpose: "Patient dose trends, staff TLD compliance, and protocol outliers.",
        sourceTables: [
          "radiation_dose_records",
          "radiology_dosimetry_records",
          "radiology_dicom_studies",
        ],
        permissions: [P.RADIOLOGY.ORDERS_LIST],
        priority: "P2",
        readiness: "query_buildable",
        chartTypes: ["control chart", "heatmap"],
        visualKind: "heatmap",
        refresh: "Daily / monthly",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["modality", "protocol", "machine", "staff role"],
      },
      {
        id: "radiology-quality-critical-findings",
        title: "Report quality, amendments, and critical findings",
        purpose: "Amendment rate, unsigned reports, critical result acknowledgement, and severity.",
        sourceTables: ["radiology_reports", "signed_records", "audit_log", "comm_critical_alerts"],
        permissions: [P.RADIOLOGY.ORDERS_LIST],
        priority: "P2",
        readiness: "query_buildable",
        chartTypes: ["bar", "funnel"],
        visualKind: "funnel",
        refresh: "Daily",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["radiologist", "modality", "report type", "severity"],
      },
    ],
  },
  {
    id: "pharmacy",
    title: "Pharmacy",
    eyebrow: "Medication safety / inventory",
    description:
      "Dispensing, stock, expiry, NDPS, high-risk drugs, returns, ADR, and margin leakage.",
    icon: IconHeartRateMonitor,
    accent: "green",
    reports: [
      {
        id: "pharmacy-fulfillment-turnaround",
        title: "Prescription fulfillment and turnaround",
        purpose: "Ordered vs dispensed, partial fills, substitutions, and dispense time.",
        sourceTables: ["pharmacy_prescriptions", "pharmacy_orders", "pharmacy_order_items"],
        permissions: [P.PHARMACY.ANALYTICS_VIEW],
        priority: "P1",
        readiness: "query_buildable",
        chartTypes: ["funnel", "line"],
        visualKind: "funnel",
        refresh: "15 min / hourly",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["doctor", "department", "formulation", "IP/OP"],
      },
      {
        id: "pharmacy-stockout-expiry-days-on-hand",
        title: "Stockout risk, near-expiry, days on hand",
        purpose: "At-risk SKUs, expiry exposure, replenishment urgency, and wastage.",
        sourceTables: ["pharmacy_batches", "pharmacy_stock_transactions", "purchase_orders"],
        permissions: [P.PHARMACY.ANALYTICS_VIEW],
        priority: "P1",
        readiness: "query_buildable",
        chartTypes: ["heatmap", "treemap"],
        visualKind: "treemap",
        refresh: "15 min / hourly",
        exports: STANDARD_EXPORTS,
        exportMode: "standard",
        drilldowns: ["store", "SKU", "category", "vendor", "ABC/VED class"],
      },
      {
        id: "pharmacy-ndps-high-risk-compliance",
        title: "NDPS and high-risk medication compliance",
        purpose: "Controlled-drug issue logs, dual-check completion, variance, and witness gaps.",
        sourceTables: ["pharmacy_ndps_register", "pharmacy_catalog", "pharmacy_orders"],
        permissions: [P.PHARMACY.ANALYTICS_VIEW],
        priority: "P1",
        readiness: "query_buildable",
        chartTypes: ["heatmap", "control chart"],
        visualKind: "heatmap",
        refresh: "Daily",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["store", "drug", "pharmacist", "shift"],
      },
      {
        id: "pharmacy-safety-returns-margin-leakage",
        title: "Medication safety, ADRs, returns, and margin leakage",
        purpose: "High-risk alerts, ADR trend, returns, credit leakage, and drug margin loss.",
        sourceTables: [
          "pharmacy_allergy_check_log",
          "adr_reports",
          "pharmacy_returns",
          "pharmacy_credit_notes",
          "pharmacy_drug_margin_daily",
        ],
        permissions: [P.PHARMACY.ANALYTICS_VIEW],
        priority: "P1",
        readiness: "live_api",
        chartTypes: ["sankey", "waterfall", "line"],
        visualKind: "sankey",
        refresh: "Daily",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["drug class", "unit", "pharmacist", "doctor", "vendor"],
      },
    ],
  },
  {
    id: "finance",
    title: "Billing / Finance",
    eyebrow: "Revenue cycle",
    description:
      "Gross-to-net, collections, settlement, aging, DNFB, denials, refunds, concessions.",
    icon: IconCurrencyRupee,
    accent: "lime",
    reports: [
      {
        id: "billing-gross-net-payer-mix",
        title: "Gross-to-net revenue and payer mix",
        purpose: "Gross charges, deductions, package mix, payer mix, and service-line performance.",
        sourceTables: ["invoices", "invoice_items", "payments", "billing_concessions"],
        permissions: [P.BILLING.REPORTS_VIEW],
        priority: "P1",
        readiness: "live_api",
        chartTypes: ["stacked bar", "line", "sunburst"],
        visualKind: "treemap",
        refresh: "Intraday / daily",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["payer", "department", "package", "service line"],
      },
      {
        id: "billing-collections-settlement",
        title: "Collections, cash, and daily settlement",
        purpose: "POS cash, digital collections, payment mode, and settlement variance.",
        sourceTables: ["payments", "invoices", "day_end_closes", "payment_gateway_transactions"],
        permissions: [P.BILLING.REPORTS_VIEW],
        priority: "P1",
        readiness: "live_api",
        chartTypes: ["line", "waterfall"],
        visualKind: "sankey",
        refresh: "Intraday / day close",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["counter", "cashier", "payment mode", "payer"],
      },
      {
        id: "billing-ar-dnfb-unpaid-discharge",
        title: "A/R aging, DNFB, unpaid discharge",
        purpose: "Aging buckets, discharged-not-final-billed, and discharge without clearance.",
        sourceTables: ["invoices", "payments", "admissions", "credit_patients", "insurance_claims"],
        permissions: [P.BILLING.REPORTS_VIEW],
        priority: "P1",
        readiness: "query_buildable",
        chartTypes: ["heatmap", "bar"],
        visualKind: "heatmap",
        refresh: "Daily",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["payer", "aging bucket", "department", "ward"],
      },
      {
        id: "billing-denials-refunds-concessions",
        title: "Denials, refunds, and concessions",
        purpose: "Rejections by cause, refund load, concession trend, and leakage path.",
        sourceTables: ["refunds", "credit_notes", "billing_concessions", "insurance_claims"],
        permissions: [P.BILLING.REPORTS_VIEW],
        priority: "P1",
        readiness: "query_buildable",
        chartTypes: ["sankey", "waterfall", "Pareto"],
        visualKind: "sankey",
        refresh: "Daily",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["payer", "denial code", "package", "department"],
      },
    ],
  },
  {
    id: "camp",
    title: "Camp",
    eyebrow: "Outreach / remote operations",
    description:
      "Coverage, turnout, screenings, referrals, offline sync, supplies, and field incidents.",
    icon: IconCalendarStats,
    accent: "orange",
    reports: [
      {
        id: "camp-coverage-turnout",
        title: "Camp coverage and turnout trend",
        purpose:
          "Camp count, registrations, turnout, location performance, and organizer workload.",
        sourceTables: ["camps", "camp_registrations", "camp_remote_setups"],
        permissions: [P.ANALYTICS.VIEW],
        priority: "P1",
        readiness: "live_api",
        chartTypes: ["line", "map", "stacked bar"],
        visualKind: "map",
        refresh: "After event / daily",
        exports: STANDARD_EXPORTS,
        exportMode: "standard",
        drilldowns: ["village", "organizer", "camp type", "date"],
      },
      {
        id: "camp-screening-referral-conversion",
        title: "Screening yield and referral conversion",
        purpose:
          "Positive-screen yield, referral issued, referral arrived, and admitted conversion.",
        sourceTables: ["camp_screenings", "camp_referrals", "camp_lab_samples"],
        permissions: [P.ANALYTICS.VIEW],
        priority: "P1",
        readiness: "query_buildable",
        chartTypes: ["funnel", "treemap"],
        visualKind: "funnel",
        refresh: "Daily",
        exports: STANDARD_EXPORTS,
        exportMode: "standard",
        drilldowns: ["camp", "condition", "age/sex", "village"],
      },
      {
        id: "camp-disease-followup-map",
        title: "Disease cluster and follow-up map",
        purpose: "Geographic clustering of positives and follow-up completion.",
        sourceTables: ["camp_screenings", "camp_referrals", "camp_followups", "patient_addresses"],
        permissions: [P.ANALYTICS.VIEW],
        priority: "P2",
        readiness: "query_buildable",
        chartTypes: ["geo scatter", "heatmap"],
        visualKind: "map",
        refresh: "Daily / weekly",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["disease", "geography", "date window", "camp type"],
      },
      {
        id: "camp-sync-supplies-incidents",
        title: "Offline sync, supplies, and incident health",
        purpose: "Sync lag, failed uploads, supply use, field incidents, and device reliability.",
        sourceTables: ["camp_sync_events", "camp_supply_items", "camp_incidents"],
        permissions: [P.ANALYTICS.VIEW],
        priority: "P1",
        readiness: "query_buildable",
        chartTypes: ["status matrix", "line", "bar"],
        visualKind: "matrix",
        refresh: "Real-time during camp",
        exports: STANDARD_EXPORTS,
        exportMode: "standard",
        drilldowns: ["device", "field worker", "camp", "date"],
      },
    ],
  },
  {
    id: "quality",
    title: "NABH / Quality",
    eyebrow: "Evidence / incidents / CAPA",
    description:
      "NABH indicator evidence, incidents, sentinel events, CAPA, audit closure, feedback, and complaints.",
    icon: IconScale,
    accent: "red",
    reports: [
      {
        id: "nabh-evidence-matrix",
        title: "NABH indicator evidence matrix",
        purpose:
          "Indicator status, evidence completeness, trend direction, and submission readiness.",
        sourceTables: ["quality_indicators", "quality_indicator_values", "quality_audits"],
        permissions: [P.QUALITY.INDICATORS_LIST],
        priority: "P1",
        readiness: "live_api",
        chartTypes: ["matrix", "sparkline"],
        visualKind: "matrix",
        refresh: "Daily / weekly / monthly",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["indicator", "chapter", "department", "month/quarter"],
      },
      {
        id: "quality-incident-sentinel-trend",
        title: "Incident and sentinel-event trend",
        purpose: "Incident count, severity mix, near-miss ratio, and event type Pareto.",
        sourceTables: ["quality_incidents", "quality_committees"],
        permissions: [P.QUALITY.INDICATORS_LIST],
        priority: "P1",
        readiness: "live_api",
        chartTypes: ["line", "stacked bar", "Pareto"],
        visualKind: "line",
        refresh: "Daily",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["severity", "department", "event type", "shift"],
      },
      {
        id: "quality-capa-audit-aging",
        title: "CAPA and audit nonconformity aging",
        purpose: "Open CAPAs, overdue actions, audit NC closure time, and owner discipline.",
        sourceTables: ["quality_capa", "quality_audits", "quality_action_items"],
        permissions: [P.QUALITY.INDICATORS_LIST],
        priority: "P1",
        readiness: "query_buildable",
        chartTypes: ["funnel", "boxplot"],
        visualKind: "funnel",
        refresh: "Weekly",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["chapter", "owner", "department", "severity"],
      },
      {
        id: "quality-feedback-complaints-prem-prom",
        title: "Patient feedback, complaints, PROM/PREM",
        purpose: "Complaint aging, satisfaction trend, patient experience, and service recovery.",
        sourceTables: ["patient_feedback", "comm_complaints", "quality_indicators"],
        permissions: [P.QUALITY.INDICATORS_LIST],
        priority: "P1",
        readiness: "query_buildable",
        chartTypes: ["line", "radar", "bar"],
        visualKind: "radar",
        refresh: "Daily / monthly",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["touchpoint", "unit", "doctor", "cohort"],
      },
    ],
  },
  {
    id: "community",
    title: "Community / Geo",
    eyebrow: "Catchment / disease / access",
    description:
      "Patient origins, disease hotspots, referral networks, access gaps, and outreach strategy.",
    icon: IconFileAnalytics,
    accent: "indigo",
    reports: [
      {
        id: "geo-patient-origin-service-area",
        title: "Patient origin and service area map",
        purpose: "Where patients come from, referral catchment, and service intensity.",
        sourceTables: ["patient_addresses", "encounters", "appointments", "admissions"],
        permissions: [P.ANALYTICS.VIEW],
        priority: "P2",
        readiness: "query_buildable",
        chartTypes: ["choropleth", "flow lines"],
        visualKind: "map",
        refresh: "Daily / weekly",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["pincode", "district", "village", "specialty", "payer"],
      },
      {
        id: "geo-disease-hotspot-seasonality",
        title: "Disease burden hotspot and seasonality",
        purpose: "Case density by geography, disease, month, age/sex, and season.",
        sourceTables: ["encounters", "diagnoses", "lab_results", "patient_addresses"],
        permissions: [P.ANALYTICS.VIEW],
        priority: "P2",
        readiness: "query_buildable",
        chartTypes: ["map", "calendar heatmap"],
        visualKind: "map",
        refresh: "Daily / weekly / monthly",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["disease", "geography", "month", "age/sex"],
      },
      {
        id: "geo-referral-network-catchment-flow",
        title: "Referral network and catchment flow",
        purpose: "Source-to-destination referral patterns and load concentration.",
        sourceTables: ["referrals", "camp_referrals", "appointments", "admissions"],
        permissions: [P.ANALYTICS.VIEW],
        priority: "P2",
        readiness: "query_buildable",
        chartTypes: ["graph", "sankey"],
        visualKind: "graph",
        refresh: "Weekly",
        exports: STANDARD_EXPORTS,
        exportMode: "standard",
        drilldowns: ["source village", "spoke site", "specialty", "date"],
      },
      {
        id: "geo-access-gap-underserved",
        title: "Access gap and underserved geography",
        purpose:
          "Long travel burden, weak utilization, weak follow-up, and low service penetration.",
        sourceTables: ["geo_towns", "facilities", "appointments", "camp_registrations"],
        permissions: [P.ANALYTICS.VIEW],
        priority: "P3",
        readiness: "capture_needed",
        chartTypes: ["isochrone map", "scatter"],
        visualKind: "map",
        refresh: "Monthly",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["geography", "payer", "age/sex", "service line"],
      },
    ],
  },
  {
    id: "body",
    title: "Body / Clinical Maps",
    eyebrow: "Anatomy-aware views",
    description: "Dental, pain, wound, pressure-ulcer, eye, ENT, ortho, and body-part findings.",
    icon: IconStethoscope,
    accent: "pink",
    reports: [
      {
        id: "body-dental-odontogram",
        title: "Dental findings odontogram",
        purpose:
          "Tooth-level findings, missing/treated/restored distribution, and treatment burden.",
        sourceTables: ["specialty_records", "camp_screenings", "diagnoses"],
        permissions: [P.ANALYTICS.VIEW],
        priority: "P3",
        readiness: "capture_needed",
        chartTypes: ["custom SVG odontogram"],
        visualKind: "body",
        refresh: "Encounter close / daily",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["encounter", "provider", "age/sex", "tooth region"],
      },
      {
        id: "body-pain-location-map",
        title: "Pain location intensity map",
        purpose: "Body-region pain burden, follow-up movement, and response tracking.",
        sourceTables: ["pain_assessments", "pain_score_entries", "encounters"],
        permissions: [P.ANALYTICS.VIEW],
        priority: "P3",
        readiness: "query_buildable",
        chartTypes: ["custom SVG heatmap"],
        visualKind: "body",
        refresh: "Encounter close / daily",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["provider", "diagnosis", "severity", "date range"],
      },
      {
        id: "body-wound-pressure-ulcer-map",
        title: "Wound, pressure-ulcer, lesion body map",
        purpose: "Site, stage, progression, healing trajectory, and safety surveillance.",
        sourceTables: ["wound_assessments", "ipd_nursing_assessments", "admissions"],
        permissions: [P.QUALITY.INDICATORS_LIST],
        priority: "P2",
        readiness: "query_buildable",
        chartTypes: ["custom SVG", "timeline"],
        visualKind: "body",
        refresh: "Daily",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["ward", "wound type", "stage", "date"],
      },
      {
        id: "body-specialty-regional-findings",
        title: "Eye, ENT, ortho regional findings map",
        purpose: "Specialty-region findings mapped to anatomy and laterality.",
        sourceTables: ["specialty_records", "radiology_orders", "diagnoses"],
        permissions: [P.ANALYTICS.VIEW],
        priority: "P3",
        readiness: "capture_needed",
        chartTypes: ["custom SVG"],
        visualKind: "body",
        refresh: "Encounter close / daily",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["specialty", "provider", "side", "severity"],
      },
    ],
  },
  {
    id: "security",
    title: "Security / Data Quality",
    eyebrow: "Trust / identity / audit",
    description:
      "Registration quality, ABHA linkage, duplicate identity risk, unsigned records, and access anomalies.",
    icon: IconScale,
    accent: "dark",
    reports: [
      {
        id: "data-quality-abha-linkage",
        title: "Registration completeness and ABHA linkage",
        purpose:
          "Missing demographics, ABHA linkage percentage, invalid fields, and consent coverage.",
        sourceTables: ["patients", "patient_abha_links", "patient_identifiers", "patient_consents"],
        permissions: [P.ANALYTICS.VIEW],
        priority: "P1",
        readiness: "query_buildable",
        chartTypes: ["heatmap", "bar"],
        visualKind: "heatmap",
        refresh: "Daily",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["registration desk", "unit", "staff", "date"],
      },
      {
        id: "security-duplicate-uhid-risk",
        title: "Duplicate UHID identity risk graph",
        purpose: "Suspected duplicates and match-confidence clusters.",
        sourceTables: ["patients", "patient_identifiers", "patient_merge_history"],
        permissions: [P.ANALYTICS.VIEW],
        priority: "P1",
        readiness: "query_buildable",
        chartTypes: ["graph", "table"],
        visualKind: "graph",
        refresh: "Daily",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["site", "age band", "match confidence", "registrar"],
      },
      {
        id: "security-unsigned-amended-records",
        title: "Unsigned and amended records aging",
        purpose: "Pending signatures, amended reports, old open drafts, and legal exposure.",
        sourceTables: ["audit_log", "signed_records", "radiology_reports", "lab_results"],
        permissions: [P.ANALYTICS.VIEW],
        priority: "P1",
        readiness: "live_api",
        chartTypes: ["bar", "boxplot"],
        visualKind: "boxplot",
        refresh: "Daily",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["document type", "unit", "clinician", "age bucket"],
      },
      {
        id: "security-access-anomaly-surveillance",
        title: "Access anomaly and audit-trail surveillance",
        purpose:
          "After-hours access, cross-location access, unusual record views, and break-glass.",
        sourceTables: ["audit_log", "access_log", "break_glass_events", "access_alerts"],
        permissions: [P.ANALYTICS.VIEW],
        priority: "P1",
        readiness: "live_api",
        chartTypes: ["scatter", "calendar heatmap", "network"],
        visualKind: "graph",
        refresh: "Near-real-time / daily",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["user", "role", "location", "time band", "record type"],
      },
    ],
  },
  {
    id: "predictive",
    title: "Predictive Models",
    eyebrow: "Forecast / anomaly",
    description:
      "Bed demand, no-show, OPD load, stockout, infection/outbreak, incident, and simulator signals.",
    icon: IconFileAnalytics,
    accent: "yellow",
    reports: [
      {
        id: "predict-bed-demand-discharge",
        title: "Bed demand and discharge forecast",
        purpose: "Occupancy forecast, expected discharges, and likely bottlenecks.",
        sourceTables: ["admissions", "beds", "ipd_discharge_tat_log", "bed_reservations"],
        permissions: [P.ANALYTICS.VIEW],
        priority: "P2",
        readiness: "predictive",
        chartTypes: ["forecast line", "interval band"],
        visualKind: "forecast",
        refresh: "Daily",
        exports: STANDARD_EXPORTS,
        exportMode: "standard",
        drilldowns: ["ward", "bed class", "season", "holiday/event window"],
      },
      {
        id: "predict-opd-noshow-load",
        title: "No-show and OPD load forecast",
        purpose: "Probability of no-show and future clinic crowding.",
        sourceTables: ["appointments", "opd_queues", "encounters", "noshow_prediction_scores"],
        permissions: [P.SCHEDULING.ANALYTICS_VIEW],
        priority: "P2",
        readiness: "predictive",
        chartTypes: ["forecast line", "risk heatmap"],
        visualKind: "forecast",
        refresh: "Daily",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["clinic", "consultant", "slot", "payer"],
      },
      {
        id: "predict-stockout-near-expiry",
        title: "Stockout and near-expiry forecast",
        purpose: "Future shortage risk, expiry exposure, and replenishment priority.",
        sourceTables: ["pharmacy_stock_transactions", "pharmacy_batches", "pharmacy_order_items"],
        permissions: [P.PHARMACY.ANALYTICS_VIEW],
        priority: "P2",
        readiness: "predictive",
        chartTypes: ["forecast line", "treemap"],
        visualKind: "forecast",
        refresh: "Daily",
        exports: STANDARD_EXPORTS,
        exportMode: "standard",
        drilldowns: ["SKU", "store", "vendor", "ABC/VED class"],
      },
      {
        id: "predict-infection-outbreak-incident",
        title: "Infection, outbreak, incident early warning",
        purpose:
          "Statistical anomaly detection over cases, incidents, screenings, or notifiable events.",
        sourceTables: [
          "infection_surveillance_events",
          "outbreak_events",
          "lab_results",
          "camp_screenings",
        ],
        permissions: [P.QUALITY.INDICATORS_LIST],
        priority: "P2",
        readiness: "predictive",
        chartTypes: ["anomaly line", "map", "alert band"],
        visualKind: "forecast",
        refresh: "Daily / weekly",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["disease", "ward", "unit", "geography", "date"],
      },
    ],
  },
  {
    id: "nmc",
    title: "NMC Overlay",
    eyebrow: "Teaching hospital evidence",
    description:
      "Conditional overlay for teaching hospitals: bed occupancy, OPD attendance, clinical material, MRD completeness.",
    icon: IconScale,
    accent: "gray",
    reports: [
      {
        id: "nmc-specialty-bed-occupancy",
        title: "Specialty bed occupancy vs NMC threshold",
        purpose: "Specialty-wise bed occupancy versus expected minimums.",
        sourceTables: ["admissions", "wards", "departments"],
        permissions: [P.ANALYTICS.VIEW],
        priority: "P2",
        readiness: "query_buildable",
        chartTypes: ["line", "target band"],
        visualKind: "line",
        refresh: "Monthly / quarterly",
        exports: STANDARD_EXPORTS,
        exportMode: "standard",
        drilldowns: ["specialty", "month", "unit"],
      },
      {
        id: "nmc-opd-clinical-material",
        title: "Specialty OPD attendance and clinical material",
        purpose: "OPD attendance by specialty and teaching-load adequacy.",
        sourceTables: ["appointments", "encounters", "departments", "doctor_profiles"],
        permissions: [P.ANALYTICS.VIEW],
        priority: "P2",
        readiness: "query_buildable",
        chartTypes: ["line", "stacked bar"],
        visualKind: "line",
        refresh: "Monthly / quarterly",
        exports: STANDARD_EXPORTS,
        exportMode: "standard",
        drilldowns: ["specialty", "session", "faculty unit"],
      },
      {
        id: "nmc-procedure-case-mix",
        title: "Procedure and case-mix teaching material adequacy",
        purpose: "Breadth and depth of procedures and cases available for teaching.",
        sourceTables: ["procedure_orders", "surgeries", "ot_case_records", "admissions"],
        permissions: [P.ANALYTICS.VIEW],
        priority: "P3",
        readiness: "capture_needed",
        chartTypes: ["treemap", "boxplot"],
        visualKind: "treemap",
        refresh: "Monthly / quarterly",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["specialty", "procedure class", "month/quarter"],
      },
      {
        id: "nmc-mrd-completeness-availability",
        title: "MRD completeness and record availability",
        purpose: "Record completion, availability, and retention readiness.",
        sourceTables: ["mrd_medical_records", "mrd_record_movements", "ipd_discharge_summaries"],
        permissions: [P.ANALYTICS.VIEW],
        priority: "P2",
        readiness: "query_buildable",
        chartTypes: ["heatmap", "KPI tiles"],
        visualKind: "heatmap",
        refresh: "Monthly / quarterly",
        exports: GOVERNED_EXPORTS,
        exportMode: "governed",
        drilldowns: ["department", "record type", "age bucket", "missing field"],
      },
    ],
  },
];

const VISUAL_KINDS = new Set<VisualKind>([
  "command",
  "line",
  "heatmap",
  "boxplot",
  "funnel",
  "sankey",
  "map",
  "graph",
  "radar",
  "gauge",
  "treemap",
  "matrix",
  "body",
  "forecast",
]);

function normalizePriority(priority: ApiReportDefinition["priority"] | string): ReportPriority {
  if (priority.toLowerCase() === "p2") return "P2";
  if (priority.toLowerCase() === "p3") return "P3";
  return "P1";
}

function normalizeExport(format: ApiReportDefinition["exports"][number] | string): ReportExport {
  const normalized = format.toLowerCase();
  if (normalized === "excel") return "Excel";
  if (normalized === "csv") return "CSV";
  if (normalized === "png") return "PNG";
  return "PDF";
}

function normalizeVisualKind(value: string): VisualKind {
  return VISUAL_KINDS.has(value as VisualKind) ? (value as VisualKind) : "line";
}

function templateForReport(report: ReportDefinition): EChartsTemplate {
  if (report.echartsTemplate) return report.echartsTemplate;

  const grammar = report.chartTypes.join(" ").toLowerCase();
  if (grammar.includes("bar race")) return "bar_race";
  if (grammar.includes("waterfall")) return "bar_waterfall";
  if (grammar.includes("calendar")) return "heatmap_calendar";
  if (grammar.includes("boxplot")) return "boxplot";
  if (grammar.includes("sankey")) return "sankey";
  if (grammar.includes("graph") || grammar.includes("network")) return "graph_network";
  if (grammar.includes("radar") || report.visualKind === "radar") return "radar";
  if (grammar.includes("sunburst")) return "sunburst";
  if (grammar.includes("treemap") || report.visualKind === "treemap") return "treemap";
  if (grammar.includes("funnel") || report.visualKind === "funnel") return "funnel";
  if (grammar.includes("gauge") || report.visualKind === "gauge") return "gauge";
  if (grammar.includes("geo scatter") || grammar.includes("effect scatter")) {
    return "effect_scatter_map";
  }
  if (grammar.includes("map") || report.visualKind === "map") return "geo_map";
  if (grammar.includes("pictorial")) return "pictorial_bar";
  if (grammar.includes("custom svg") || report.visualKind === "body") return "custom_svg";
  if (grammar.includes("timeline")) return "timeline";
  if (grammar.includes("parallel")) return "parallel_coordinates";
  if (grammar.includes("theme")) return "theme_river";
  if (grammar.includes("candlestick") || grammar.includes("ohlc")) return "candlestick_ohlc";
  if (grammar.includes("area")) return "area_stack";
  if (grammar.includes("stacked bar")) return "bar_stack";
  if (grammar.includes("gradient") || report.visualKind === "forecast") return "line_gradient";
  if (report.visualKind === "heatmap" || report.visualKind === "matrix") return "heatmap_cartesian";
  return "line_stack";
}

function apiReportToUi(report: ApiReportDefinition): ReportDefinition {
  return {
    id: report.id,
    title: report.title,
    purpose: report.purpose,
    sourceTables: report.source_tables,
    permissions: report.permissions,
    priority: normalizePriority(report.priority),
    readiness: report.readiness,
    chartTypes: report.chart_types,
    echartsTemplate: report.echarts_template,
    visualKind: normalizeVisualKind(report.visual_kind),
    refresh: report.refresh,
    exports: report.exports.map(normalizeExport),
    exportMode: report.export_mode,
    drilldowns: report.drilldowns,
    dataEndpoint: report.data_endpoint,
  };
}

function catalogToReportFamilies(catalog?: ReportCatalogResponse): ReportFamily[] {
  if (!catalog?.families.length) return [...REPORT_FAMILIES];

  const presentationByFamily = new Map(
    REPORT_FAMILIES.map((family) => [
      family.id,
      {
        icon: family.icon,
        accent: family.accent,
      },
    ]),
  );

  return catalog.families.map((family) => {
    const presentation = presentationByFamily.get(family.id);
    return {
      id: family.id,
      title: family.title,
      eyebrow: family.eyebrow,
      description: family.description,
      icon: presentation?.icon ?? IconFileAnalytics,
      accent: presentation?.accent ?? "blue",
      reports: family.reports.map(apiReportToUi),
    };
  });
}

function daysAgoIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function reportSourceLabel(report: ReportDefinition): string {
  return report.sourceTables.slice(0, 4).join(", ");
}

function reportStatusLabel(report: ReportDefinition): string {
  const wiring = report.dataEndpoint === null ? " · Source not wired" : "";
  return `${PRIORITY_META[report.priority].label} · ${READINESS_META[report.readiness].label}${wiring}`;
}

function reportMatchesSearch(
  report: ReportDefinition,
  family: ReportFamily,
  query: string,
): boolean {
  if (!query) return true;
  return [
    family.title,
    family.eyebrow,
    family.description,
    report.id,
    report.title,
    report.purpose,
    report.priority,
    report.readiness,
    report.refresh,
    report.echartsTemplate ?? "",
    report.sourceTables.join(" "),
    report.permissions.join(" "),
    report.chartTypes.join(" "),
    report.drilldowns.join(" "),
  ]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function commandOption(): EChartsCoreOption {
  return {
    color: ["#1c7ed6", "#12b886", "#f59f00", "#e03131"],
    tooltip: { trigger: "axis" },
    legend: { bottom: 0 },
    grid: { left: 44, right: 18, top: 30, bottom: 54 },
    xAxis: { type: "category", data: ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"] },
    yAxis: { type: "value" },
    series: [
      { name: "OPD", type: "line", smooth: true, data: [90, 240, 330, 280, 210, 160] },
      { name: "Beds", type: "line", smooth: true, data: [72, 76, 81, 84, 83, 80] },
      { name: "Lab breach", type: "bar", data: [3, 8, 11, 9, 5, 4] },
      { name: "Red flags", type: "bar", data: [1, 4, 6, 3, 2, 2] },
    ],
  };
}

function lineOption(report: ReportDefinition, runtimeData: ReportRuntimeData): EChartsCoreOption {
  if (report.id === "opd-registration-arrivals" && runtimeData.opdFootfall.length > 0) {
    const rows = runtimeData.opdFootfall;
    return {
      color: ["#1c7ed6", "#12b886", "#7950f2"],
      tooltip: { trigger: "axis" },
      legend: { bottom: 0 },
      grid: { left: 44, right: 18, top: 28, bottom: 54 },
      xAxis: { type: "category", data: rows.map((row) => row.date.slice(5)) },
      yAxis: { type: "value", minInterval: 1 },
      series: [
        { name: "Visits", type: "line", smooth: true, data: rows.map((row) => row.visit_count) },
        { name: "New", type: "bar", stack: "patients", data: rows.map((row) => row.new_patients) },
        {
          name: "Follow-up",
          type: "bar",
          stack: "patients",
          data: rows.map((row) => row.follow_ups),
        },
      ],
    };
  }
  if (report.id === "ipd-census-bed-occupancy" && runtimeData.bedOccupancy.length > 0) {
    const rows = runtimeData.bedOccupancy;
    return {
      color: ["#fa5252", "#12b886", "#1c7ed6"],
      tooltip: { trigger: "axis" },
      legend: { bottom: 0 },
      grid: { left: 44, right: 18, top: 28, bottom: 62 },
      xAxis: {
        type: "category",
        data: rows.map((row) => row.ward_name),
        axisLabel: { interval: 0, rotate: rows.length > 5 ? 24 : 0 },
      },
      yAxis: { type: "value" },
      series: [
        { name: "Occupied", type: "bar", stack: "beds", data: rows.map((row) => row.occupied) },
        { name: "Vacant", type: "bar", stack: "beds", data: rows.map((row) => row.vacant) },
        { name: "Occupancy %", type: "line", data: rows.map((row) => row.occupancy_pct) },
      ],
    };
  }
  return {
    color: ["#1c7ed6", "#12b886", "#f08c00"],
    tooltip: { trigger: "axis" },
    legend: { bottom: 0 },
    grid: { left: 44, right: 18, top: 28, bottom: 54 },
    xAxis: { type: "category", data: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
    yAxis: { type: "value" },
    series: [
      { name: "Current", type: "line", smooth: true, data: [42, 51, 56, 61, 58, 49, 45] },
      { name: "Baseline", type: "line", smooth: true, data: [38, 42, 45, 47, 46, 43, 40] },
      { name: "Exceptions", type: "bar", data: [3, 5, 4, 7, 6, 4, 2] },
    ],
  };
}

function heatmapOption(
  report: ReportDefinition,
  runtimeData: ReportRuntimeData,
): EChartsCoreOption {
  if (report.id === "opd-no-show-revisit" && runtimeData.noShows.length > 0) {
    const rows = runtimeData.noShows.slice(0, 8);
    return {
      color: ["#f76707"],
      tooltip: { trigger: "axis" },
      grid: { left: 44, right: 18, top: 24, bottom: 42 },
      xAxis: {
        type: "category",
        data: rows.map((row, index) => row.department_id ?? row.doctor_id ?? `Group ${index + 1}`),
      },
      yAxis: { type: "value", axisLabel: { formatter: "{value}%" } },
      series: [
        {
          name: "No-show %",
          type: "bar",
          data: rows.map((row) => Math.round((row.noshow_rate ?? 0) * 1000) / 10),
        },
      ],
    };
  }
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hours = ["08", "10", "12", "14", "16", "18"];
  const data = days.flatMap((_, dayIndex) =>
    hours.map((_, hourIndex) => [hourIndex, dayIndex, (dayIndex + 2) * (hourIndex + 1)]),
  );
  return {
    tooltip: { position: "top" },
    grid: { left: 54, right: 16, top: 20, bottom: 54 },
    xAxis: { type: "category", data: hours },
    yAxis: { type: "category", data: days },
    visualMap: {
      min: 0,
      max: 42,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      inRange: { color: ["#e7f5ff", "#74c0fc", "#f59f00", "#e03131"] },
    },
    series: [{ name: report.title, type: "heatmap", data }],
  };
}

function boxplotOption(): EChartsCoreOption {
  return {
    tooltip: { trigger: "item" },
    grid: { left: 46, right: 18, top: 24, bottom: 42 },
    xAxis: { type: "category", data: ["OPD", "IPD", "Lab", "Radio", "Pharm"] },
    yAxis: { type: "value" },
    series: [
      {
        name: "Distribution",
        type: "boxplot",
        data: [
          [12, 22, 28, 35, 54],
          [18, 30, 42, 58, 91],
          [10, 24, 31, 46, 88],
          [22, 45, 64, 78, 130],
          [8, 16, 22, 29, 47],
        ],
      },
    ],
  };
}

function funnelOption(): EChartsCoreOption {
  return {
    color: ["#228be6", "#12b886", "#fab005", "#fd7e14", "#e03131"],
    tooltip: { trigger: "item", formatter: "{b}: {c}" },
    series: [
      {
        type: "funnel",
        top: 18,
        bottom: 18,
        left: "8%",
        width: "84%",
        label: { formatter: "{b}: {c}" },
        data: [
          { value: 920, name: "Created" },
          { value: 810, name: "Started" },
          { value: 690, name: "Completed" },
          { value: 540, name: "Cleared" },
          { value: 430, name: "Closed" },
        ],
      },
    ],
  };
}

function sankeyOption(): EChartsCoreOption {
  const nodes = ["Gross", "Concession", "Refund", "Net", "Collected", "Outstanding"].map(
    (name) => ({
      name,
    }),
  );
  return {
    tooltip: { trigger: "item" },
    series: [
      {
        type: "sankey",
        emphasis: { focus: "adjacency" },
        data: nodes,
        links: [
          { source: "Gross", target: "Concession", value: 18 },
          { source: "Gross", target: "Refund", value: 4 },
          { source: "Gross", target: "Net", value: 166 },
          { source: "Net", target: "Collected", value: 141 },
          { source: "Net", target: "Outstanding", value: 25 },
        ],
      },
    ],
  };
}

function mapOption(): EChartsCoreOption {
  return {
    tooltip: { trigger: "item" },
    grid: { left: 36, right: 24, top: 24, bottom: 36 },
    xAxis: { type: "value", min: 0, max: 100, splitLine: { show: false } },
    yAxis: { type: "value", min: 0, max: 100, splitLine: { show: false } },
    visualMap: {
      min: 0,
      max: 100,
      right: 8,
      top: 24,
      inRange: { color: ["#74c0fc", "#ffd43b", "#fa5252"] },
    },
    series: [
      {
        name: "Locality risk",
        type: "effectScatter",
        symbolSize: (value: number[]) => Math.max(10, (value[2] ?? 0) / 2),
        data: [
          [18, 42, 31, "Village A"],
          [32, 68, 64, "Village B"],
          [48, 51, 42, "Village C"],
          [66, 74, 88, "Village D"],
          [82, 38, 53, "Village E"],
        ],
        encode: { tooltip: [3, 2] },
      },
    ],
  };
}

function graphOption(): EChartsCoreOption {
  return {
    tooltip: {},
    series: [
      {
        type: "graph",
        layout: "force",
        roam: true,
        label: { show: true },
        force: { repulsion: 130, edgeLength: 70 },
        data: [
          { name: "Patient" },
          { name: "Family" },
          { name: "Village" },
          { name: "Doctor" },
          { name: "Referral" },
          { name: "Record" },
        ],
        links: [
          { source: "Patient", target: "Family" },
          { source: "Patient", target: "Village" },
          { source: "Patient", target: "Doctor" },
          { source: "Doctor", target: "Referral" },
          { source: "Patient", target: "Record" },
        ],
      },
    ],
  };
}

function radarOption(): EChartsCoreOption {
  return {
    legend: { bottom: 0 },
    radar: {
      indicator: [
        { name: "Safety", max: 100 },
        { name: "Access", max: 100 },
        { name: "TAT", max: 100 },
        { name: "Finance", max: 100 },
        { name: "Quality", max: 100 },
        { name: "Experience", max: 100 },
      ],
    },
    series: [
      {
        type: "radar",
        areaStyle: {},
        data: [
          { value: [84, 78, 71, 89, 76, 68], name: "Current" },
          { value: [92, 86, 82, 91, 88, 80], name: "Target" },
        ],
      },
    ],
  };
}

function gaugeOption(): EChartsCoreOption {
  return {
    series: [
      {
        type: "gauge",
        progress: { show: true },
        axisLine: { lineStyle: { width: 12 } },
        detail: { valueAnimation: true, formatter: "{value}%" },
        data: [{ value: 82, name: "Readiness" }],
      },
    ],
  };
}

function treemapOption(): EChartsCoreOption {
  return {
    tooltip: { trigger: "item" },
    series: [
      {
        type: "treemap",
        roam: false,
        data: [
          { name: "Medicine", value: 42 },
          { name: "Diagnostics", value: 36 },
          { name: "IPD", value: 30 },
          { name: "OPD", value: 28 },
          { name: "Surgery", value: 22 },
          { name: "Other", value: 14 },
        ],
      },
    ],
  };
}

function matrixOption(): EChartsCoreOption {
  const rows = ["NABH", "Safety", "Clinical", "Finance", "Security"];
  const cols = ["Open", "Due", "Risk", "Done"];
  return {
    tooltip: { position: "top" },
    grid: { left: 58, right: 18, top: 24, bottom: 44 },
    xAxis: { type: "category", data: cols },
    yAxis: { type: "category", data: rows },
    visualMap: {
      min: 0,
      max: 20,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      inRange: { color: ["#e7f5ff", "#74c0fc", "#e03131"] },
    },
    series: [
      {
        type: "heatmap",
        data: rows.flatMap((_, row) => cols.map((_, col) => [col, row, (row + 1) * (col + 2)])),
        label: { show: true },
      },
    ],
  };
}

function bodyOption(): EChartsCoreOption {
  return {
    tooltip: { trigger: "item" },
    xAxis: { type: "value", min: 0, max: 100, show: false },
    yAxis: { type: "value", min: 0, max: 100, show: false },
    series: [
      {
        type: "scatter",
        symbolSize: (value: number[]) => Math.max(14, value[2] ?? 12),
        data: [
          [50, 84, 18, "Head/eye"],
          [50, 64, 30, "Chest"],
          [42, 52, 22, "Left arm"],
          [58, 52, 19, "Right arm"],
          [50, 38, 26, "Abdomen"],
          [44, 18, 20, "Left leg"],
          [56, 18, 24, "Right leg"],
        ],
        encode: { tooltip: [3, 2] },
      },
    ],
    graphic: [
      {
        type: "text",
        left: "center",
        top: "middle",
        style: { text: "Clinical body map", fill: "#868e96", fontSize: 14 },
      },
    ],
  };
}

function forecastOption(): EChartsCoreOption {
  return {
    color: ["#1c7ed6", "#f08c00", "#12b886"],
    tooltip: { trigger: "axis" },
    legend: { bottom: 0 },
    grid: { left: 44, right: 18, top: 28, bottom: 54 },
    xAxis: { type: "category", data: ["Today", "+1", "+2", "+3", "+4", "+5", "+6"] },
    yAxis: { type: "value" },
    series: [
      {
        name: "Forecast",
        type: "line",
        smooth: true,
        data: [82, 88, 94, 98, 101, 96, 90],
        markArea: {
          itemStyle: { color: "rgba(255, 212, 59, 0.18)" },
          data: [[{ name: "confidence band", yAxis: 86 }, { yAxis: 104 }]],
        },
      },
      { name: "Baseline", type: "line", smooth: true, data: [76, 79, 82, 84, 83, 80, 78] },
      { name: "Risk flags", type: "bar", data: [2, 3, 5, 6, 7, 4, 3] },
    ],
  };
}

function lineGradientOption(report: ReportDefinition): EChartsCoreOption {
  return {
    color: ["#1c7ed6", "#12b886"],
    tooltip: { trigger: "axis" },
    legend: { bottom: 0 },
    grid: { left: 44, right: 18, top: 28, bottom: 54 },
    xAxis: { type: "category", data: ["D-6", "D-5", "D-4", "D-3", "D-2", "D-1", "Today"] },
    yAxis: { type: "value" },
    series: [
      {
        name: report.title,
        type: "line",
        smooth: true,
        symbolSize: 8,
        areaStyle: { opacity: 0.16 },
        data: [44, 52, 58, 61, 73, 69, 82],
        markPoint: { data: [{ type: "max", name: "Peak" }] },
      },
      {
        name: "Baseline",
        type: "line",
        smooth: true,
        lineStyle: { type: "dashed" },
        data: [40, 43, 45, 48, 51, 53, 55],
      },
    ],
  };
}

function areaStackOption(): EChartsCoreOption {
  return {
    color: ["#1c7ed6", "#12b886", "#fab005", "#f76707"],
    tooltip: { trigger: "axis" },
    legend: { bottom: 0 },
    grid: { left: 44, right: 18, top: 28, bottom: 54 },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    },
    yAxis: { type: "value" },
    series: [
      {
        name: "New",
        type: "line",
        stack: "total",
        areaStyle: {},
        smooth: true,
        data: [120, 132, 141, 154, 150, 138],
      },
      {
        name: "Repeat",
        type: "line",
        stack: "total",
        areaStyle: {},
        smooth: true,
        data: [90, 102, 118, 121, 130, 124],
      },
      {
        name: "Camp",
        type: "line",
        stack: "total",
        areaStyle: {},
        smooth: true,
        data: [24, 36, 30, 42, 45, 38],
      },
    ],
  };
}

function barStackOption(): EChartsCoreOption {
  return {
    color: ["#1c7ed6", "#12b886", "#f59f00", "#e03131"],
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { bottom: 0 },
    grid: { left: 44, right: 18, top: 28, bottom: 54 },
    xAxis: { type: "category", data: ["OPD", "IPD", "Lab", "Radio", "Pharm", "OT"] },
    yAxis: { type: "value" },
    series: [
      { name: "Completed", type: "bar", stack: "status", data: [320, 88, 420, 145, 260, 42] },
      { name: "Pending", type: "bar", stack: "status", data: [44, 21, 80, 37, 52, 11] },
      { name: "Breach", type: "bar", stack: "status", data: [8, 6, 18, 9, 12, 3] },
    ],
  };
}

function barRaceOption(): EChartsCoreOption {
  return {
    color: ["#1c7ed6"],
    tooltip: { trigger: "axis" },
    grid: { left: 112, right: 24, top: 24, bottom: 28 },
    xAxis: { type: "value" },
    yAxis: {
      type: "category",
      inverse: true,
      data: ["Medicine", "General Surgery", "OBG", "Orthopedics", "Pediatrics"],
    },
    series: [
      {
        type: "bar",
        realtimeSort: true,
        label: { show: true, position: "right" },
        data: [1860, 1490, 1320, 1180, 1040],
      },
    ],
  };
}

function waterfallOption(): EChartsCoreOption {
  return {
    color: ["#adb5bd", "#12b886", "#e03131", "#1c7ed6"],
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { bottom: 0 },
    grid: { left: 48, right: 20, top: 28, bottom: 54 },
    xAxis: {
      type: "category",
      data: ["Gross", "Concession", "Refund", "Denial", "Net", "Collected"],
    },
    yAxis: { type: "value" },
    series: [
      {
        name: "Offset",
        type: "bar",
        stack: "total",
        itemStyle: { color: "transparent" },
        data: [0, 166, 162, 150, 0, 0],
      },
      { name: "Movement", type: "bar", stack: "total", data: [184, 18, 4, 12, 150, 128] },
    ],
  };
}

function calendarHeatmapOption(): EChartsCoreOption {
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (41 - index));
    return [date.toISOString().slice(0, 10), Math.round(20 + Math.sin(index / 3) * 12 + index / 2)];
  });
  return {
    tooltip: { position: "top" },
    visualMap: {
      min: 0,
      max: 60,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      inRange: { color: ["#e7f5ff", "#74c0fc", "#f59f00", "#e03131"] },
    },
    calendar: {
      top: 24,
      left: 28,
      right: 28,
      cellSize: ["auto", 22],
      range: [days[0]?.[0], days.at(-1)?.[0]],
      itemStyle: { borderWidth: 0.5 },
    },
    series: [{ type: "heatmap", coordinateSystem: "calendar", data: days }],
  };
}

function sunburstOption(): EChartsCoreOption {
  return {
    tooltip: { trigger: "item" },
    series: [
      {
        type: "sunburst",
        radius: [0, "88%"],
        label: { rotate: "radial" },
        data: [
          {
            name: "Clinical",
            children: [
              { name: "OPD", value: 38 },
              { name: "IPD", value: 28 },
              { name: "OT", value: 16 },
            ],
          },
          {
            name: "Diagnostics",
            children: [
              { name: "Lab", value: 34 },
              { name: "Radiology", value: 22 },
            ],
          },
          {
            name: "Pharmacy",
            children: [
              { name: "OP", value: 26 },
              { name: "IP", value: 18 },
            ],
          },
        ],
      },
    ],
  };
}

function pictorialBarOption(): EChartsCoreOption {
  return {
    color: ["#1c7ed6", "#12b886", "#f59f00"],
    tooltip: { trigger: "axis" },
    grid: { left: 44, right: 18, top: 28, bottom: 42 },
    xAxis: { type: "category", data: ["Beds", "Nurses", "Vent.", "OT", "Stock"] },
    yAxis: { type: "value" },
    series: [
      {
        type: "pictorialBar",
        symbol: "rect",
        symbolRepeat: true,
        symbolSize: [18, 6],
        data: [84, 76, 68, 55, 72],
      },
    ],
  };
}

function timelineOption(): EChartsCoreOption {
  return {
    baseOption: {
      timeline: {
        bottom: 0,
        autoPlay: false,
        data: ["Arrival", "Consult", "Order", "Result", "Discharge"],
      },
      tooltip: { trigger: "axis" },
      grid: { left: 44, right: 18, top: 24, bottom: 72 },
      xAxis: { type: "category", data: ["0h", "2h", "4h", "8h", "24h"] },
      yAxis: { type: "value" },
    },
    options: [
      { series: [{ name: "Patients", type: "line", smooth: true, data: [80, 92, 88, 76, 60] }] },
      { series: [{ name: "Consults", type: "line", smooth: true, data: [20, 64, 96, 88, 44] }] },
      { series: [{ name: "Orders", type: "line", smooth: true, data: [8, 42, 90, 96, 48] }] },
      { series: [{ name: "Results", type: "line", smooth: true, data: [0, 12, 44, 82, 76] }] },
      { series: [{ name: "Closed", type: "line", smooth: true, data: [0, 4, 18, 56, 84] }] },
    ],
  } as unknown as EChartsCoreOption;
}

function parallelCoordinatesOption(): EChartsCoreOption {
  return {
    parallelAxis: [
      { dim: 0, name: "Load" },
      { dim: 1, name: "TAT" },
      { dim: 2, name: "Cost" },
      { dim: 3, name: "Risk" },
      { dim: 4, name: "Quality" },
    ],
    parallel: { left: 42, right: 28, top: 28, bottom: 28 },
    series: [
      {
        type: "parallel",
        lineStyle: { width: 2, opacity: 0.45 },
        data: [
          [82, 61, 44, 28, 86],
          [68, 72, 59, 41, 74],
          [91, 84, 70, 66, 62],
          [54, 38, 32, 18, 91],
        ],
      },
    ],
  };
}

function themeRiverOption(): EChartsCoreOption {
  const dates = ["2026/05/01", "2026/05/02", "2026/05/03", "2026/05/04", "2026/05/05"];
  return {
    tooltip: { trigger: "axis" },
    legend: { bottom: 0 },
    singleAxis: {
      top: 36,
      bottom: 64,
      type: "time",
      axisPointer: { animation: true },
    },
    series: [
      {
        type: "themeRiver",
        data: dates.flatMap((date, index) => [
          [date, 12 + index * 4, "Fever"],
          [date, 8 + index * 3, "Diabetes"],
          [date, 18 - index, "Hypertension"],
        ]),
      },
    ],
  };
}

function candlestickOhlcOption(): EChartsCoreOption {
  return {
    tooltip: { trigger: "axis" },
    grid: { left: 44, right: 18, top: 28, bottom: 42 },
    xAxis: { type: "category", data: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
    yAxis: { type: "value" },
    series: [
      {
        type: "candlestick",
        data: [
          [72, 84, 68, 91],
          [84, 79, 74, 88],
          [79, 96, 75, 101],
          [96, 92, 86, 105],
          [92, 88, 82, 100],
          [88, 94, 80, 98],
        ],
      },
    ],
  };
}

function optionForReport(
  report: ReportDefinition,
  runtimeData: ReportRuntimeData,
): EChartsCoreOption {
  switch (templateForReport(report)) {
    case "line_stack":
      return lineOption(report, runtimeData);
    case "line_gradient":
      return lineGradientOption(report);
    case "area_stack":
      return areaStackOption();
    case "bar_stack":
      return barStackOption();
    case "bar_race":
      return barRaceOption();
    case "bar_waterfall":
      return waterfallOption();
    case "heatmap_cartesian":
      return heatmapOption(report, runtimeData);
    case "heatmap_calendar":
      return calendarHeatmapOption();
    case "boxplot":
      return boxplotOption();
    case "sankey":
      return sankeyOption();
    case "graph_network":
      return graphOption();
    case "radar":
      return radarOption();
    case "treemap":
      return treemapOption();
    case "sunburst":
      return sunburstOption();
    case "funnel":
      return funnelOption();
    case "gauge":
      return gaugeOption();
    case "geo_map":
    case "effect_scatter_map":
      return mapOption();
    case "pictorial_bar":
      return pictorialBarOption();
    case "custom_svg":
      return bodyOption();
    case "timeline":
      return timelineOption();
    case "parallel_coordinates":
      return parallelCoordinatesOption();
    case "theme_river":
      return themeRiverOption();
    case "candlestick_ohlc":
      return candlestickOhlcOption();
  }
  switch (report.visualKind) {
    case "command":
      return commandOption();
    case "line":
      return lineOption(report, runtimeData);
    case "heatmap":
      return heatmapOption(report, runtimeData);
    case "boxplot":
      return boxplotOption();
    case "funnel":
      return funnelOption();
    case "sankey":
      return sankeyOption();
    case "map":
      return mapOption();
    case "graph":
      return graphOption();
    case "radar":
      return radarOption();
    case "gauge":
      return gaugeOption();
    case "treemap":
      return treemapOption();
    case "matrix":
      return matrixOption();
    case "body":
      return bodyOption();
    case "forecast":
      return forecastOption();
  }
}

function loadingForReport(report: ReportDefinition, loadingState: ReportLoadingState): boolean {
  if (report.id === "opd-registration-arrivals") return loadingState.opdFootfall;
  if (report.id === "ipd-census-bed-occupancy") return loadingState.bedOccupancy;
  if (report.id === "opd-no-show-revisit") return loadingState.noShows;
  return false;
}

function liveSummary(report: ReportDefinition, reportData?: ReportDataResponse<unknown>): string {
  if (!report.dataEndpoint) {
    return `Source query is not live yet. Management should treat this as a governed report definition until ${report.sourceTables
      .slice(0, 3)
      .join(", ")} is wired and validated.`;
  }
  if (!reportData) {
    return "Live endpoint exists, but the current data version has not loaded yet. Do not use this chart for management action until the source rows and summary metadata arrive.";
  }
  const generatedAt = new Date(reportData.generated_at).toLocaleString();
  const fields = firstRowFields(reportData);
  const sourceWarning = reportData.summary.warning
    ? ` Source warning: ${reportData.summary.warning}.`
    : "";
  const fieldSummary =
    fields.length > 0 ? ` Visible fields: ${fields.join(", ")}.` : " No row fields available.";
  return `Live data version returned ${reportData.summary.row_count} row(s) from ${reportData.summary.source}; generated ${generatedAt}.${sourceWarning}${fieldSummary}`;
}

function firstRowFields(reportData: ReportDataResponse<unknown>): string[] {
  const first = reportData.rows[0];
  if (!first || typeof first !== "object" || Array.isArray(first)) {
    return [];
  }
  return Object.keys(first as Record<string, unknown>).slice(0, 8);
}

function formatReportDataStatus(reportData?: ReportDataResponse<unknown>): string {
  if (!reportData) return "Pending live response";
  if (reportData.summary.status === "live") return "Live source";
  return "Not wired";
}

function formatGeneratedAt(reportData?: ReportDataResponse<unknown>): string {
  if (!reportData) return "Pending";
  return new Date(reportData.generated_at).toLocaleString();
}

type ReportDomain =
  | "executive"
  | "opd"
  | "ipd"
  | "lab"
  | "radiology"
  | "pharmacy"
  | "finance"
  | "camp"
  | "quality"
  | "community"
  | "body"
  | "security"
  | "predictive"
  | "nmc";

interface ReportDomainBrief {
  label: string;
  audience: string;
  managementUse: string;
  leadingSignals: string;
  prediction: string;
  redFlag: string;
  goodSignal: string;
}

const REPORT_DOMAIN_BRIEFS: Record<ReportDomain, ReportDomainBrief> = {
  executive: {
    label: "Executive command",
    audience: "CEO, medical superintendent, COO, and hospital administrator",
    managementUse: "see the daily operating pressure before department meetings start",
    leadingSignals:
      "capacity pressure, collections movement, service delays, and unresolved safety events",
    prediction:
      "anticipate the next operational choke point by combining queue velocity, bed pressure, cash lag, and safety exceptions",
    redFlag:
      "multiple departments breaching together means this is a hospital-level escalation, not a local dashboard issue",
    goodSignal:
      "the same board links capacity, money, safety, and delay signals before managers act",
  },
  opd: {
    label: "OPD management",
    audience: "OPD manager, reception lead, consultants, and duty administrator",
    managementUse:
      "balance front-desk load, consultant slots, walk-ins, no-shows, and repeat visits",
    leadingSignals:
      "arrival pattern, queue age, consultant utilization, and revisit or no-show cohorts",
    prediction:
      "anticipate clinic crowding and appointment leakage from arrival velocity, slot utilization, and prior no-show behavior",
    redFlag:
      "high wait time with idle consultant slots usually indicates registration, token, or routing failure",
    goodSignal:
      "registration, queue, consultation, and follow-up data can be drilled into the same operating flow",
  },
  ipd: {
    label: "IPD management",
    audience: "nursing superintendent, ward in-charge, bed manager, and treating units",
    managementUse:
      "control bed availability, discharge friction, long stay, transfers, and ward throughput",
    leadingSignals:
      "occupancy, bed class pressure, discharge barriers, housekeeping lag, and readmission watch",
    prediction:
      "anticipate next-shift bed shortage from active census, expected discharges, blocked beds, and admission pipeline",
    redFlag:
      "high occupancy with delayed discharge and slow bed turnaround requires immediate bed-management review",
    goodSignal:
      "bed, admission, discharge, and ward drilldowns are explicit before any occupancy chart becomes live",
  },
  lab: {
    label: "Lab operations",
    audience: "lab director, pathologist, lab manager, quality officer, and clinical units",
    managementUse:
      "reduce diagnostic delay, critical-value miss, sample rejection, QC failure, and outsourcing dependence",
    leadingSignals:
      "sample age, validation age, critical alert acknowledgement, rejection reasons, and analyzer section load",
    prediction:
      "anticipate TAT breach from pending queue age, priority mix, analyzer load, collection backlog, and verification delay",
    redFlag:
      "critical values without acknowledgement are clinical-risk events and need escalation, not just a report note",
    goodSignal:
      "the report separates collection, processing, validation, and notification so action ownership is clear",
  },
  radiology: {
    label: "Radiology operations",
    audience: "radiology head, modality supervisor, reporting radiologist, and operations lead",
    managementUse:
      "control modality load, RIS/PACS backlog, reporting delay, dose safety, and critical finding communication",
    leadingSignals:
      "order age, scan completion, report verification, modality queue, repeat scans, and critical-finding acknowledgement",
    prediction:
      "anticipate imaging backlog from modality utilization, aged orders, reporting queue, machine downtime, and priority mix",
    redFlag:
      "critical findings without documented communication are patient-safety and medicolegal exceptions",
    goodSignal:
      "DICOM/RIS/reporting sources are separated so workflow delay and storage delay are not mixed",
  },
  pharmacy: {
    label: "Pharmacy management",
    audience: "pharmacy manager, clinical pharmacist, purchase lead, and finance controller",
    managementUse:
      "control fulfillment, stock risk, expiry loss, controlled drugs, ADRs, returns, and margin leakage",
    leadingSignals:
      "partial fills, stock days, batch age, reorder pressure, NDPS balance, return volume, and ADR trend",
    prediction:
      "anticipate stockout or expiry loss from consumption velocity, batch age, reorder level, and vendor lead time",
    redFlag: "controlled-drug issue, return, and witness events must balance by shift and register",
    goodSignal:
      "the report links medication safety, inventory, and money leakage rather than treating pharmacy as sales only",
  },
  finance: {
    label: "Finance control",
    audience: "CFO, finance controller, billing lead, cashier lead, and hospital administrator",
    managementUse:
      "track gross-to-net revenue, collections, settlement variance, A/R, DNFB, refunds, denials, and concessions",
    leadingSignals:
      "collection lag, unpaid discharge, payer aging, concession growth, refund reason, denial reason, and settlement variance",
    prediction:
      "anticipate day-close cash gap and revenue leakage from billing mix, concessions, refunds, payer lag, and unbilled services",
    redFlag:
      "revenue growth with worsening collections or DNFB means cash is not converting, even if billing looks healthy",
    goodSignal:
      "finance reports declare payer, department, cashier, counter, and approval drilldowns for accountability",
  },
  camp: {
    label: "Camp and outreach",
    audience: "camp coordinator, outreach lead, medical officer, and hospital operations team",
    managementUse:
      "measure field turnout, screening yield, referral conversion, offline sync health, supplies, and field incidents",
    leadingSignals:
      "village turnout, positive screens, referral arrival, sync lag, device failures, and supply consumption",
    prediction:
      "anticipate referral leakage and locality clusters by comparing positive screens with hospital arrival and follow-up windows",
    redFlag:
      "downloaded camp packets with stale sync or expired data must not drive clinical decisions",
    goodSignal:
      "camp reports connect field work back to hospital conversion, follow-up, and data safety",
  },
  quality: {
    label: "NABH and quality",
    audience: "quality head, committee chairs, medical superintendent, and department owners",
    managementUse:
      "track indicator evidence, incidents, sentinel events, CAPA aging, audit closure, feedback, and complaints",
    leadingSignals:
      "indicator breach, overdue CAPA, repeated incident type, complaint aging, committee delay, and evidence gap",
    prediction:
      "anticipate accreditation risk from unresolved evidence gaps, repeat incidents, overdue CAPA, and weak owner closure",
    redFlag: "repeat incidents without CAPA closure indicate system failure, not isolated variance",
    goodSignal:
      "NABH evidence, quality events, audit actions, and patient voice sit in the same management loop",
  },
  community: {
    label: "Community intelligence",
    audience: "hospital strategy team, outreach lead, public-health lead, and service-line heads",
    managementUse:
      "understand catchment, disease burden, referral flow, follow-up loss, and underserved geography",
    leadingSignals:
      "village/pincode origin, disease density, referral source, travel burden, service penetration, and follow-up completion",
    prediction:
      "anticipate disease clusters or access gaps by comparing locality signal density with moving baseline and camp coverage",
    redFlag:
      "small-cell locality reports can identify patients and must be suppressed unless permitted",
    goodSignal: "geo reports are designed around catchment decisions, not decorative maps",
  },
  body: {
    label: "Clinical body maps",
    audience:
      "specialty clinicians, nursing quality teams, wound-care teams, and clinical auditors",
    managementUse:
      "spot anatomical burden, wound progression, dental needs, pain movement, and specialty-region patterns",
    leadingSignals:
      "body region, laterality, severity, stage, follow-up change, and treatment burden",
    prediction:
      "anticipate deterioration or follow-up need from persistent region severity, stage progression, and missed reassessment",
    redFlag:
      "clinical body-map output is patient-identifiable and must remain under governed clinical access",
    goodSignal: "anatomy-aware reports can show clinical burden that normal tables hide",
  },
  security: {
    label: "Security and data quality",
    audience: "CISO, data protection lead, MRD lead, quality officer, and administrator",
    managementUse:
      "monitor identity quality, ABHA linkage, duplicates, unsigned records, amendments, exports, and access anomalies",
    leadingSignals:
      "missing identifiers, duplicate confidence, unsigned age, amendment frequency, after-hours access, and break-glass usage",
    prediction:
      "anticipate investigation workload from abnormal access clusters, old unsigned records, and duplicate identity risk",
    redFlag:
      "privileged export or after-hours cross-location access needs immediate review and audit context",
    goodSignal:
      "trust reports combine data completeness, legal signature state, and access behavior",
  },
  predictive: {
    label: "Predictive workbench",
    audience: "operations leadership, quality team, finance, pharmacy, and department owners",
    managementUse:
      "convert historical HMS signals into reviewed forecasts, anomaly bands, and action queues",
    leadingSignals: "trend, seasonality, baseline variance, confidence, drift, and owner backlog",
    prediction:
      "produce a review-required forecast with confidence band and explanation, never an automatic decision",
    redFlag:
      "prediction without source freshness, model version, confidence, and reviewer status should be hidden",
    goodSignal:
      "forecast reports are separated from live descriptive reports so governance is explicit",
  },
  nmc: {
    label: "NMC teaching overlay",
    audience: "dean, medical superintendent, academic coordinator, MRD head, and department heads",
    managementUse:
      "track teaching-hospital evidence for specialty occupancy, OPD attendance, clinical material, procedures, and MRD readiness",
    leadingSignals:
      "specialty census, OPD volume, faculty unit, procedure breadth, record completeness, and audit availability",
    prediction:
      "anticipate inspection gaps where clinical material, occupancy, or records fall below the expected teaching threshold",
    redFlag:
      "NMC evidence must match validated hospital records, not manual spreadsheet-only counts",
    goodSignal:
      "clinical activity and MRD availability are linked before teaching evidence is shown",
  },
};

function domainForReport(report: ReportDefinition): ReportDomain {
  const id = report.id;
  if (id.startsWith("opd-")) return "opd";
  if (id.startsWith("ipd-")) return "ipd";
  if (id.startsWith("lab-")) return "lab";
  if (id.startsWith("radiology-")) return "radiology";
  if (id.startsWith("pharmacy-")) return "pharmacy";
  if (id.startsWith("billing-") || id.startsWith("revenue-")) return "finance";
  if (id.startsWith("camp-")) return "camp";
  if (id.startsWith("nabh-") || id.startsWith("quality-")) return "quality";
  if (id.startsWith("geo-")) return "community";
  if (id.startsWith("body-")) return "body";
  if (id.startsWith("security-") || id.startsWith("data-quality-")) return "security";
  if (id.startsWith("predict-")) return "predictive";
  if (id.startsWith("nmc-")) return "nmc";
  return "executive";
}

function listOrFallback(items: string[], fallback: string): string {
  return items.length > 0 ? items.join(", ") : fallback;
}

function visualManagementReading(report: ReportDefinition): string {
  if (report.visualKind === "forecast") {
    return "Management reading: compare current trajectory, baseline, and confidence band before changing staffing, stock, or capacity.";
  }

  switch (templateForReport(report)) {
    case "heatmap_cartesian":
    case "heatmap_calendar":
      return "Management reading: act on the hottest time, place, unit, or owner first, then compare against the same slot in the baseline period.";
    case "boxplot":
      return "Management reading: do not trust the average alone; the long tail and outliers show where patients or records are getting delayed.";
    case "funnel":
      return "Management reading: every step drop is an accountable leakage point, so assign the first large fall-off to an owner.";
    case "sankey":
      return "Management reading: follow the largest flow or loss path to decide whether the intervention is operational, financial, or clinical.";
    case "graph_network":
      return "Management reading: dense or unusual relationships need identity, referral, access, or outbreak review depending on the report domain.";
    case "radar":
      return "Management reading: weakest axes become the department improvement plan; do not average away one failing dimension.";
    case "treemap":
    case "sunburst":
      return "Management reading: the largest blocks show concentration risk, case mix, or money/stock dependency.";
    case "geo_map":
    case "effect_scatter_map":
      return "Management reading: locality signals need privacy suppression first, then outreach, referral, or public-health action.";
    case "custom_svg":
      return "Management reading: anatomy-level clustering should trigger specialty workflow review and patient follow-up checks.";
    case "line_gradient":
      return "Management reading: compare current trajectory, baseline, and confidence band before changing staffing, stock, or capacity.";
    case "bar_waterfall":
      return "Management reading: the largest negative bridge explains the leakage or delay bucket that needs correction.";
    case "parallel_coordinates":
      return "Management reading: high-risk lines are multi-factor cases where load, cost, quality, and delay worsen together.";
    case "theme_river":
      return "Management reading: seasonality shifts show when a disease, demand, or operational theme is gaining share.";
    case "candlestick_ohlc":
      return "Management reading: volatility matters; wide daily spread means the average is hiding unstable operations.";
    case "bar_race":
      return "Management reading: changing rank shows departments, doctors, services, or SKUs gaining operational weight.";
    default:
      return "Management reading: compare current period, baseline, exception count, and owner backlog before assigning action.";
  }
}

function predictiveSummary(report: ReportDefinition): string[] {
  const brief = REPORT_DOMAIN_BRIEFS[domainForReport(report)];
  const drilldowns = listOrFallback(report.drilldowns.slice(0, 3), "defined drilldowns");
  const predictiveNote =
    report.readiness === "predictive" || report.visualKind === "forecast"
      ? "This chart should show confidence, drift state, and reviewer status before management accepts the forecast."
      : "Use this as a leading signal now; the next version can add baseline variance and confidence bands.";

  return [
    `${brief.prediction}.`,
    `Use ${drilldowns} to find the cohort or owner most likely to drive tomorrow's exception load.`,
    predictiveNote,
  ];
}

function detailInsights(report: ReportDefinition, reportData?: ReportDataResponse<unknown>) {
  const brief = REPORT_DOMAIN_BRIEFS[domainForReport(report)];
  const drilldownTargets = report.drilldowns.slice(0, 4);
  const sourceTargets = report.sourceTables.slice(0, 4);
  const drilldownText = listOrFallback(drilldownTargets, "the configured drilldown");
  const sourceText = listOrFallback(sourceTargets, "the configured HMS source");
  const statusText = `${READINESS_META[report.readiness].label}; ${PRIORITY_META[report.priority].label}; cadence ${report.refresh}.`;
  return {
    summary: `${brief.label}: ${report.purpose}`,
    executiveSummary: [
      `${brief.audience} use this to ${brief.managementUse}.`,
      `What this chart is deciding: ${report.purpose}`,
      liveSummary(report, reportData),
      statusText,
    ],
    predictions: predictiveSummary(report),
    anticipated: [
      `Anticipate the next review queue from ${brief.leadingSignals}.`,
      `Watch for stale data: newest source event must be inside ${report.refresh}.`,
      report.exportMode === "governed"
        ? "Anticipate PHI/export approval when drilling into patient-identifiable rows."
        : "Anticipate standard export needs with user, timestamp, and filter audit.",
      "If cohort or geography output becomes small-cell identifiable, suppress it or require elevated permission.",
    ],
    aiInteractions: [
      `Ask: "What changed in ${report.title} since the previous period, split by ${drilldownText}?"`,
      `Ask: "Which ${drilldownTargets[0] ?? "owner"} needs action first, and what evidence supports that?"`,
      `Ask: "Draft a management note for ${brief.audience} with red flags, likely drivers, and owner actions."`,
      "AI must use this summary report version plus the current data version, not raw unrestricted database access.",
      "Allowed responses can explain variance, find likely drivers, draft action lists, and prepare committee notes with links back to source rows.",
      "Every AI answer must show data version, summary version, filters, user, timestamp, and whether PHI was included.",
      "Clinical, regulatory, finance, and security conclusions must remain review-required; AI cannot auto-sign, auto-diagnose, or auto-escalate.",
    ],
    detailNotes: [
      visualManagementReading(report),
      `Primary drilldowns: ${drilldownText}.`,
      `Primary source tables: ${sourceText}.`,
      `Export/audit mode: ${report.exportMode}; outputs ${report.exports.join(", ")}.`,
    ],
    redFlags: [
      brief.redFlag,
      `Newest source event must be within ${report.refresh}.`,
      report.exportMode === "governed"
        ? "Patient-identifiable drilldown requires governed export and audit."
        : "Standard export still records user, timestamp, and filter context.",
      "Small-cell geography or cohort output must be suppressed unless explicitly authorized.",
    ],
    appreciation: [
      brief.goodSignal,
      reportData
        ? `Data version is explicit: ${reportData.summary.status} from ${reportData.summary.source}.`
        : "The report clearly shows whether the live source is pending or not wired.",
      "Priority, readiness, source, drilldowns, and export mode are visible before management acts.",
    ],
    actions: [
      `Open drilldown by ${drilldownText}.`,
      report.dataEndpoint
        ? `Review live rows from ${sourceText} and assign the first variance owner.`
        : `Wire query from ${sourceText} before marking this report as operationally usable.`,
      `Validate export mode: ${report.exportMode}.`,
    ],
  };
}

function ReportTile({
  report,
  runtimeData,
  loadingState,
  reportData,
  isReportLoading,
  onDetails,
}: {
  report: ReportDefinition;
  runtimeData: ReportRuntimeData;
  loadingState: ReportLoadingState;
  reportData?: ReportDataResponse<unknown>;
  isReportLoading?: boolean;
  onDetails: (report: ReportDefinition) => void;
}) {
  const canView = usePermissionStore((state) =>
    report.permissions.some((permission) => state.hasPermission(permission)),
  );
  const readiness = READINESS_META[report.readiness];
  const priority = PRIORITY_META[report.priority];

  if (report.id === "nabh-evidence-matrix") {
    return (
      <Card withBorder radius="md" padding="md" h="100%">
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start">
            <Stack gap={3}>
              <Group gap={6}>
                <Badge color={priority.color} variant="light">
                  {priority.label}
                </Badge>
                <Badge color={readiness.color} variant="light">
                  {readiness.label}
                </Badge>
              </Group>
              <Text fw={800}>{report.title}</Text>
              <Text size="sm" c="dimmed">
                {report.purpose}
              </Text>
            </Stack>
          </Group>
          {canView ? (
            <div style={{ position: "relative" }}>
              <Button
                size="xs"
                variant="gradient"
                gradient={{ from: "primary", to: "copper", deg: 120 }}
                leftSection={<IconFileAnalytics size={14} />}
                onClick={() => onDetails(report)}
                style={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}
              >
                View details
              </Button>
              <NabhIndicatorMatrix />
            </div>
          ) : (
            <Text size="sm" c="dimmed">
              Restricted by permission: {report.permissions.join(", ")}
            </Text>
          )}
        </Stack>
      </Card>
    );
  }

  return (
    <ReportChart
      title={report.title}
      description={report.purpose}
      permission={report.permissions[0] ?? P.ANALYTICS.VIEW}
      option={optionForReport(report, runtimeData)}
      status={`${reportStatusLabel(report)}${
        reportData ? ` · ${reportData.summary.row_count} rows` : ""
      }`}
      isLoading={loadingForReport(report, loadingState) || isReportLoading}
      disabledActions={report.dataEndpoint === null}
      sourceHref={undefined}
      onViewDetails={() => onDetails(report)}
    />
  );
}

function ReportFamilyPanel({
  family,
  reports,
  runtimeData,
  loadingState,
  reportDataById,
  loadingByReportId,
  onDetails,
}: {
  family: ReportFamily;
  reports: ReportDefinition[];
  runtimeData: ReportRuntimeData;
  loadingState: ReportLoadingState;
  reportDataById: ReportDataById;
  loadingByReportId: Record<string, boolean>;
  onDetails: (report: ReportDefinition) => void;
}) {
  const FamilyIcon = family.icon;
  return (
    <Card withBorder radius="md" padding="lg">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Group align="flex-start">
            <ThemeIcon color={family.accent} size={44} radius="md">
              <FamilyIcon size={24} />
            </ThemeIcon>
            <Stack gap={2}>
              <Text size="xs" fw={800} tt="uppercase" c="dimmed">
                {family.eyebrow}
              </Text>
              <Title order={3}>{family.title}</Title>
              <Text c="dimmed">{family.description}</Text>
            </Stack>
          </Group>
          <Group gap="xs">
            <Badge color={family.accent} variant="light" size="lg">
              {reports.length} charts
            </Badge>
            <Badge color="red" variant="light">
              {reports.filter((report) => report.priority === "P1").length} P1
            </Badge>
          </Group>
        </Group>
        <SimpleGrid cols={{ base: 1, xl: 2 }}>
          {reports.map((report) => (
            <div
              key={report.id}
              className={report.id === "nabh-evidence-matrix" ? styles.fullWidth : undefined}
            >
              <ReportTile
                report={report}
                runtimeData={runtimeData}
                loadingState={loadingState}
                reportData={reportDataById[report.id]}
                isReportLoading={loadingByReportId[report.id]}
                onDetails={onDetails}
              />
            </div>
          ))}
        </SimpleGrid>
      </Stack>
    </Card>
  );
}

export function ReportsPage() {
  useRequirePermission(P.ANALYTICS.VIEW);
  const [activeFamilyId, setActiveFamilyId] = useState(REPORT_FAMILIES[0]?.id ?? "executive");
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<ReportPriority | "all">("all");
  const [readinessFilter, setReadinessFilter] = useState<ReportReadiness | "all">("all");
  const [selectedReport, setSelectedReport] = useState<ReportDefinition | null>(null);
  const [detailOpened, { open: openDetails, close: closeDetails }] = useDisclosure(false);
  const hasPermission = usePermissionStore((state) => state.hasPermission);
  const normalizedSearch = search.trim().toLowerCase();

  const { data: reportCatalog } = useQuery({
    queryKey: ["reports", "catalog"],
    queryFn: () => reportsService.getReportCatalog(),
    enabled: hasPermission(P.ANALYTICS.VIEW),
  });
  const reportFamilies = useMemo(() => catalogToReportFamilies(reportCatalog), [reportCatalog]);
  const activeFamily =
    reportFamilies.find((family) => family.id === activeFamilyId) ?? reportFamilies[0];
  const visibleFamilies = useMemo(() => {
    const sourceFamilies = normalizedSearch ? reportFamilies : activeFamily ? [activeFamily] : [];
    return sourceFamilies
      .map((family) => ({
        family,
        reports: family.reports.filter((report) => {
          const matchesPriority = priorityFilter === "all" || report.priority === priorityFilter;
          const matchesReadiness =
            readinessFilter === "all" || report.readiness === readinessFilter;
          return (
            matchesPriority &&
            matchesReadiness &&
            reportMatchesSearch(report, family, normalizedSearch)
          );
        }),
      }))
      .filter(({ reports }) => reports.length > 0);
  }, [activeFamily, normalizedSearch, priorityFilter, readinessFilter, reportFamilies]);
  const visibleReportList = useMemo(
    () => visibleFamilies.flatMap(({ reports }) => reports),
    [visibleFamilies],
  );
  const liveReportList = useMemo(
    () => visibleReportList.filter((report) => report.dataEndpoint),
    [visibleReportList],
  );
  const defaultFrom = daysAgoIso(30);
  const liveReportQueries = useQueries({
    queries: liveReportList.map((report) => ({
      queryKey: ["reports", "data", report.id, defaultFrom],
      queryFn: () => reportsService.getReportData(report.id, { from: defaultFrom }),
      enabled: report.permissions.some((permission) => hasPermission(permission)),
      staleTime: 30_000,
    })),
  });
  const reportDataById = useMemo<ReportDataById>(() => {
    const entries = liveReportList.flatMap((report, index) => {
      const data = liveReportQueries[index]?.data;
      return data ? ([[report.id, data]] as const) : [];
    });
    return Object.fromEntries(entries);
  }, [liveReportList, liveReportQueries]);
  const loadingByReportId = useMemo<Record<string, boolean>>(() => {
    const entries = liveReportList.map(
      (report, index) => [report.id, liveReportQueries[index]?.isLoading ?? false] as const,
    );
    return Object.fromEntries(entries);
  }, [liveReportList, liveReportQueries]);
  const runtimeData = useMemo<ReportRuntimeData>(
    () => ({
      opdFootfall: (reportDataById["opd-registration-arrivals"]?.rows ??
        []) as ReportRuntimeData["opdFootfall"],
      bedOccupancy: (reportDataById["ipd-census-bed-occupancy"]?.rows ??
        []) as ReportRuntimeData["bedOccupancy"],
      noShows: (reportDataById["opd-no-show-revisit"]?.rows ?? []) as ReportRuntimeData["noShows"],
    }),
    [reportDataById],
  );
  const loadingState: ReportLoadingState = {
    opdFootfall: loadingByReportId["opd-registration-arrivals"] ?? false,
    bedOccupancy: loadingByReportId["ipd-census-bed-occupancy"] ?? false,
    noShows: loadingByReportId["opd-no-show-revisit"] ?? false,
  };
  const allReports = reportFamilies.flatMap((family) => family.reports);
  const registeredReportCount =
    reportCatalog?.families.reduce((count, family) => count + family.reports.length, 0) ??
    allReports.length;
  const visibleChartCount = visibleFamilies.reduce(
    (count, family) => count + family.reports.length,
    0,
  );

  const showDetails = (report: ReportDefinition) => {
    setSelectedReport(report);
    openDetails();
  };

  return (
    <Stack gap="md">
      <PageHeader
        title="Reporting Command Center"
        subtitle="Native MedBrains reports for hospital operations, NABH evidence, finance, outreach, security, body maps, and predictive workbenches"
        icon={<IconFileAnalytics size={28} />}
      />

      <Card withBorder radius="md" padding="md" className={styles.searchPanel}>
        <Stack gap="sm">
          <Group align="flex-start" justify="space-between">
            <TextInput
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="Search chart, module, source table, KPI, NABH, ABHA, NDPS, DICOM, camp, village..."
              leftSection={<IconSearch size={16} />}
              rightSection={
                search ? (
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    aria-label="Clear report search"
                    onClick={() => setSearch("")}
                  >
                    <IconX size={14} />
                  </ActionIcon>
                ) : undefined
              }
              className={styles.searchInput}
            />
            <Group gap="xs">
              {(["all", "P1", "P2", "P3"] as const).map((priority) => (
                <Button
                  key={priority}
                  size="xs"
                  radius="xl"
                  variant={priorityFilter === priority ? "filled" : "light"}
                  color={priority === "all" ? "blue" : PRIORITY_META[priority].color}
                  onClick={() => setPriorityFilter(priority)}
                >
                  {priority === "all" ? "All priority" : priority}
                </Button>
              ))}
            </Group>
          </Group>
          <Group gap="xs">
            {(
              [
                "all",
                "live_api",
                "query_buildable",
                "derived_view",
                "predictive",
                "capture_needed",
              ] as const
            ).map((readiness) => (
              <Button
                key={readiness}
                size="xs"
                radius="xl"
                variant={readinessFilter === readiness ? "filled" : "light"}
                color={readiness === "all" ? "gray" : READINESS_META[readiness].color}
                onClick={() => setReadinessFilter(readiness)}
              >
                {readiness === "all" ? "All readiness" : READINESS_META[readiness].label}
              </Button>
            ))}
          </Group>
          <Text size="xs" c="dimmed">
            Showing {visibleChartCount} of {allReports.length} report surfaces. Backend registry
            returned {registeredReportCount} permission-visible reports with source tables,
            drilldowns, export mode, and readiness.
          </Text>
        </Stack>
      </Card>

      <div className={styles.layout}>
        <Card withBorder radius="md" padding="sm" className={`${styles.sidebar} ${styles.navCard}`}>
          <Stack gap="xs">
            {reportFamilies.map((family) => {
              const Icon = family.icon;
              const isActive = family.id === activeFamily?.id;
              return (
                <NavLink
                  key={family.id}
                  label={family.title}
                  description={`${family.eyebrow} · ${family.reports.length} charts`}
                  leftSection={
                    <ThemeIcon color={family.accent} variant={isActive ? "filled" : "light"}>
                      <Icon size={18} />
                    </ThemeIcon>
                  }
                  active={isActive}
                  onClick={() => setActiveFamilyId(family.id)}
                  className={`${styles.familyButton} ${isActive ? styles.familyButtonActive : ""}`}
                />
              );
            })}
          </Stack>
        </Card>

        <Stack gap="md">
          {visibleFamilies.length > 0 ? (
            visibleFamilies.map(({ family, reports }) => (
              <ReportFamilyPanel
                key={family.id}
                family={family}
                reports={reports}
                runtimeData={runtimeData}
                loadingState={loadingState}
                reportDataById={reportDataById}
                loadingByReportId={loadingByReportId}
                onDetails={showDetails}
              />
            ))
          ) : (
            <Card withBorder radius="md" padding="lg">
              <Text fw={700}>No matching reports</Text>
              <Text c="dimmed" size="sm">
                Try another chart, table, module, priority, or readiness filter.
              </Text>
            </Card>
          )}
        </Stack>
      </div>

      <Modal
        opened={detailOpened}
        onClose={closeDetails}
        size="xl"
        title={selectedReport?.title ?? "Report details"}
      >
        {selectedReport && (
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, md: 4 }}>
              <Card withBorder radius="md" padding="md">
                <Text size="xs" fw={800} tt="uppercase" c="dimmed">
                  Data version
                </Text>
                <Text size="sm">{formatReportDataStatus(reportDataById[selectedReport.id])}</Text>
              </Card>
              <Card withBorder radius="md" padding="md">
                <Text size="xs" fw={800} tt="uppercase" c="dimmed">
                  Summary report version
                </Text>
                <Text size="sm">
                  {READINESS_META[selectedReport.readiness].label} ·{" "}
                  {PRIORITY_META[selectedReport.priority].label}
                </Text>
              </Card>
              <Card withBorder radius="md" padding="md">
                <Text size="xs" fw={800} tt="uppercase" c="dimmed">
                  Source version
                </Text>
                <Text size="sm">
                  {reportDataById[selectedReport.id]?.summary.source ??
                    reportSourceLabel(selectedReport)}
                </Text>
              </Card>
              <Card withBorder radius="md" padding="md">
                <Text size="xs" fw={800} tt="uppercase" c="dimmed">
                  Generated
                </Text>
                <Text size="sm">{formatGeneratedAt(reportDataById[selectedReport.id])}</Text>
              </Card>
            </SimpleGrid>
            <ReportDetailPanel
              report={{
                id: selectedReport.id,
                title: selectedReport.title,
                description: selectedReport.purpose,
                permission: selectedReport.permissions.join(", "),
                cadence: selectedReport.refresh,
                source: selectedReport.sourceTables.join(", "),
                outputs: selectedReport.exports,
                status: READINESS_META[selectedReport.readiness].label,
                dataStatus: formatReportDataStatus(reportDataById[selectedReport.id]),
                dataSource:
                  reportDataById[selectedReport.id]?.summary.source ??
                  selectedReport.sourceTables.join(", "),
                generatedAt: formatGeneratedAt(reportDataById[selectedReport.id]),
                rowCount: reportDataById[selectedReport.id]?.summary.row_count ?? null,
                warning: reportDataById[selectedReport.id]?.summary.warning ?? null,
              }}
              insights={detailInsights(selectedReport, reportDataById[selectedReport.id])}
            />
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
