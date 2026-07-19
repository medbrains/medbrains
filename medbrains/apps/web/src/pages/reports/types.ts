// Shared reports types — UI-side report/family/runtime models extracted from reports.tsx
// so the chart-option builders and report components can split into their own files.

import type { EChartsTemplate, ReportDataResponse } from "@medbrains/types";
import type { ComponentType } from "react";

export type ReportPriority = "P1" | "P2" | "P3";

export type ReportReadiness =
  | "live_api"
  | "query_buildable"
  | "derived_view"
  | "predictive"
  | "capture_needed";

export type ReportExport = "PDF" | "Excel" | "CSV" | "PNG";

export type ExportMode = "standard" | "governed";

export type VisualKind =
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

export interface ReportDefinition {
  id: string;
  title: string;
  purpose: string;
  sourceTables: string[];
  sourceEvents?: string[];
  eventPayloadKeys?: string[];
  indicatorTargets?: string[];
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

export interface ReportFamily {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  icon: ComponentType<{ size?: number; stroke?: number }>;
  accent: string;
  reports: ReportDefinition[];
}

export interface ReportRuntimeData {
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

export interface ReportLoadingState {
  opdFootfall: boolean;
  bedOccupancy: boolean;
  noShows: boolean;
}

export type ReportDataById = Record<string, ReportDataResponse<unknown>>;
