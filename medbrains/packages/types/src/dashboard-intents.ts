export type DashboardReportFamily = "opd" | "lab" | "finance" | "ipd";
export type DashboardReportPriority = "P1" | "P2" | "P3";

export type DashboardMobileRoute =
  | "Billing"
  | "LabResultsView"
  | "PatientSearch"
  | "Queue"
  | "TokenBoards";

export type DashboardStatIntentId =
  | "ipdActive"
  | "labPending"
  | "opdQueue"
  | "revenueToday"
  | "todayAppointments"
  | "totalPatients";

export interface DashboardReportIntent {
  family: DashboardReportFamily;
  priority: DashboardReportPriority;
  query: string;
}

export interface DashboardMobileIntent {
  actionLabel: string;
  params?: Readonly<Record<string, string | number | boolean>>;
  route: DashboardMobileRoute;
}

export interface DashboardStatIntent {
  id: DashboardStatIntentId;
  mobile?: DashboardMobileIntent;
  report: DashboardReportIntent;
  webActionLabel: string;
}

export const DASHBOARD_STAT_INTENTS: Readonly<Record<DashboardStatIntentId, DashboardStatIntent>> =
  {
    ipdActive: {
      id: "ipdActive",
      report: {
        family: "ipd",
        priority: "P1",
        query: "active admissions bed occupancy",
      },
      webActionLabel: "Open IPD occupancy reports",
    },
    labPending: {
      id: "labPending",
      mobile: {
        actionLabel: "Open lab worklist",
        route: "LabResultsView",
      },
      report: {
        family: "lab",
        priority: "P1",
        query: "pending lab",
      },
      webActionLabel: "Open laboratory pending reports",
    },
    opdQueue: {
      id: "opdQueue",
      mobile: {
        actionLabel: "Open OPD queue",
        route: "Queue",
      },
      report: {
        family: "opd",
        priority: "P1",
        query: "queue visits",
      },
      webActionLabel: "Open OPD queue reports",
    },
    revenueToday: {
      id: "revenueToday",
      mobile: {
        actionLabel: "Open billing desk",
        params: { filter: "pending" },
        route: "Billing",
      },
      report: {
        family: "finance",
        priority: "P1",
        query: "revenue billing",
      },
      webActionLabel: "Open finance revenue reports",
    },
    todayAppointments: {
      id: "todayAppointments",
      report: {
        family: "opd",
        priority: "P2",
        query: "appointments no show",
      },
      webActionLabel: "Open appointment reports",
    },
    totalPatients: {
      id: "totalPatients",
      mobile: {
        actionLabel: "Find patient",
        route: "PatientSearch",
      },
      report: {
        family: "opd",
        priority: "P1",
        query: "patient registration",
      },
      webActionLabel: "Open patient registration reports",
    },
  };

export function buildDashboardReportPath(intentId: DashboardStatIntentId): string {
  const report = DASHBOARD_STAT_INTENTS[intentId].report;
  const family = encodeURIComponent(report.family);
  const query = encodeURIComponent(report.query);
  const priority = encodeURIComponent(report.priority);

  return `/reports?family=${family}&q=${query}&priority=${priority}`;
}
