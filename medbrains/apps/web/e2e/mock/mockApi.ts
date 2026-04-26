import type { Page, Route } from "@playwright/test";
import { readFileSync } from "node:fs";

const fixturePath = new URL("./fixtures/module-api-fixtures.json", import.meta.url);
const fixtures = JSON.parse(readFileSync(fixturePath, "utf8")) as {
  authMe: Record<string, unknown>;
  tenantSettings: unknown[];
  secureDeviceSettings: unknown[];
  systemHealth: Record<string, unknown>;
  devices: Record<string, unknown>;
};

const GENERIC_OBJECT_RESPONSE = {
  status: "ok",
  items: [],
  data: [],
  results: [],
  rows: [],
  widgets: [],
  dashboard: {},
  recent_activity: [],
  counts: {},
  metrics: {},
  summary: {},
};

const MOCK_CARE_VIEW_WARD_GRID = {
  summary: {
    total_beds: 24,
    occupied: 18,
    critical_count: 2,
    isolation_count: 1,
    pending_discharges: 3,
    overdue_tasks_total: 4,
  },
  patients: [
    {
      admission_id: "cv-adm-1",
      patient_id: "patient-1",
      encounter_id: "enc-1",
      patient_name: "Ramesh Kumar",
      uhid: "UHID-1001",
      bed_id: "bed-1",
      bed_name: "B-101",
      ward_id: "ward-icu",
      ward_name: "ICU",
      is_critical: true,
      isolation_required: false,
      ip_type: "ICU",
      admitting_doctor_name: "Dr. Sharma",
      primary_nurse_name: "Nurse Anita",
      pending_tasks: 2,
      overdue_tasks: 1,
      pending_meds: 1,
      overdue_meds: 0,
      vitals_due: true,
      fall_risk_level: "High",
      latest_news2_score: 6,
      active_clinical_docs: 2,
      expected_discharge_date: "2026-04-29",
    },
  ],
};

const MOCK_CARE_VIEW_TASKS = {
  medication_tasks: [
    {
      mar_id: "mar-1",
      admission_id: "cv-adm-1",
      patient_name: "Ramesh Kumar",
      bed_name: "B-101",
      drug_name: "Piperacillin/Tazobactam",
      dose: "4.5 g",
      route: "IV",
      scheduled_at: "2026-04-26T10:00:00Z",
      is_overdue: false,
      is_high_alert: false,
    },
  ],
  nursing_tasks: [
    {
      task_id: "task-1",
      admission_id: "cv-adm-1",
      patient_name: "Ramesh Kumar",
      bed_name: "B-101",
      description: "Fluid balance review",
      category: "Monitoring",
      priority: "high",
      due_at: "2026-04-26T11:00:00Z",
      is_overdue: false,
    },
  ],
};

const MOCK_HANDOVER_SUMMARY = {
  ward_name: "ICU",
  shift: "morning",
  patients: [
    {
      admission_id: "cv-adm-1",
      patient_name: "Ramesh Kumar",
      bed_name: "B-101",
      is_critical: true,
      isolation_required: false,
      provisional_diagnosis: "Sepsis",
      pending_tasks: ["Repeat lactate"],
      pending_meds: ["Meropenem 2 PM dose"],
      active_clinical_docs: ["Nursing progress note"],
    },
  ],
  total_patients: 1,
  critical_count: 1,
};

const MOCK_REGULATORY_DASHBOARD = {
  accreditation_scores: [
    {
      body: "NABH",
      total_standards: 24,
      compliant: 19,
      non_compliant: 5,
      score_percent: 79.2,
    },
  ],
  department_scores: [
    {
      department_id: "dept-quality",
      department_name: "Quality",
      avg_score: 82.5,
      checklist_count: 6,
    },
  ],
  upcoming_deadlines: [
    {
      id: "event-1",
      title: "NABH evidence upload",
      category: "nabh",
      due_date: "2026-05-02",
      status: "upcoming",
      assigned_to_name: "Quality Team",
    },
  ],
  overdue_items: 2,
  total_checklists: 14,
  compliant_checklists: 11,
  license_expiring_soon: 1,
};

const MOCK_COMPLIANCE_GAPS = [
  {
    checklist_id: "gap-1",
    checklist_name: "Medication Safety Audit",
    department_id: "dept-pharmacy",
    department_name: "Pharmacy",
    accreditation_body: "nabh",
    non_compliant_items: 2,
    gap_descriptions: ["Crash cart seal log incomplete"],
  },
];

const MOCK_ANALYTICS = {
  deptRevenue: [
    { department_name: "Cardiology", revenue: 245000, invoice_count: 48 },
    { department_name: "Radiology", revenue: 118000, invoice_count: 22 },
  ],
  doctorRevenue: [
    { doctor_name: "Dr. Mehta", department_name: "Cardiology", revenue: 142000, patient_count: 19 },
    { doctor_name: "Dr. Rao", department_name: "Radiology", revenue: 88000, patient_count: 14 },
  ],
  ipdCensus: [
    { date: "2026-04-24", admissions: 18, discharges: 12, deaths: 1, active: 94 },
    { date: "2026-04-25", admissions: 15, discharges: 10, deaths: 0, active: 99 },
  ],
  labTat: [
    { test_name: "CBC", order_count: 64, avg_tat_mins: 42, p90_tat_mins: 58, min_tat_mins: 18, max_tat_mins: 75 },
    { test_name: "LFT", order_count: 26, avg_tat_mins: 75, p90_tat_mins: 110, min_tat_mins: 40, max_tat_mins: 146 },
  ],
  otUtilization: [
    { room_name: "OT-1", total_bookings: 12, completed: 10, cancelled: 1, avg_duration_mins: 84, utilization_pct: 81.5 },
  ],
  erVolume: [
    { date: "2026-04-25", total_visits: 96, immediate: 4, emergent: 12, urgent: 28, less_urgent: 31, non_urgent: 21, avg_door_to_doctor_mins: 18 },
  ],
  clinicalIndicators: [
    { period: "2026-04", mortality_rate: 1.4, infection_rate: 2.1, readmission_rate: 4.2, avg_los_days: 4.8 },
  ],
  opdFootfall: [
    { date: "2026-04-25", department_name: "General Medicine", visit_count: 118, new_patients: 37, follow_ups: 81 },
    { date: "2026-04-25", department_name: "Orthopedics", visit_count: 62, new_patients: 19, follow_ups: 43 },
  ],
  bedOccupancy: [
    { ward_name: "ICU", total_beds: 12, occupied: 10, vacant: 2, occupancy_pct: 83.3 },
    { ward_name: "Ward A", total_beds: 28, occupied: 21, vacant: 7, occupancy_pct: 75.0 },
  ],
};

function isIdentifierSegment(segment: string): boolean {
  return /^[0-9a-f-]{8,}$/i.test(segment) || /^\d+$/.test(segment);
}

function defaultGetBody(pathname: string): unknown {
  if (
    pathname.includes("/stats")
    || pathname.includes("/summary")
    || pathname.includes("/metrics")
    || pathname.includes("/overview")
    || pathname.includes("/dashboard")
    || pathname.includes("/analytics")
    || pathname.includes("/health")
    || pathname.includes("/realtime")
    || pathname.includes("/counts")
    || pathname.includes("/system-health")
  ) {
    return GENERIC_OBJECT_RESPONSE;
  }

  const segments = pathname.split("/").filter(Boolean);
  const lastSegment = segments.at(-1) ?? "";
  if (lastSegment === "my" || lastSegment === "current" || lastSegment === "profile") {
    return GENERIC_OBJECT_RESPONSE;
  }
  return isIdentifierSegment(lastSegment) ? GENERIC_OBJECT_RESPONSE : [];
}

function getMockBody(pathname: string, method: string): unknown {
  if (pathname === "/api/auth/me") {
    return fixtures.authMe;
  }

  if (pathname === "/api/auth/refresh") {
    return { token: "mock-token", csrf_token: "mock-csrf-token" };
  }

  if (pathname === "/api/health") {
    return { status: "ok" };
  }

  if (pathname === "/api/dashboard/summary") {
    return {
      total_patients: 0,
      today_registrations: 0,
      opd_queue_count: 0,
      today_visits: 0,
      lab_pending: 0,
      today_revenue: "0",
      today_appointments: 0,
      ipd_active: 0,
      recent_activity: [],
    };
  }

  if (pathname === "/api/dashboards/my") {
    return {
      dashboard: {
        id: "mock-dashboard",
        name: "My Dashboard",
        description: "Mock dashboard",
        layout_config: { columns: 12 },
      },
      widgets: [],
    };
  }

  if (pathname === "/api/widget-templates") {
    return [];
  }

  if (pathname === "/api/ipd/wards") {
    return [
      { id: "ward-icu", name: "ICU" },
      { id: "ward-a", name: "Ward A" },
    ];
  }

  if (pathname === "/api/care-view/ward-grid") {
    return MOCK_CARE_VIEW_WARD_GRID;
  }

  if (pathname === "/api/care-view/my-tasks") {
    return MOCK_CARE_VIEW_TASKS;
  }

  if (pathname === "/api/care-view/vitals-checklist") {
    return [
      {
        admission_id: "cv-adm-1",
        patient_name: "Ramesh Kumar",
        bed_name: "B-101",
        last_vitals_at: "2026-04-26T08:00:00Z",
        hours_since_last: 2.5,
        vitals_due: false,
      },
    ];
  }

  if (pathname === "/api/care-view/handover") {
    return MOCK_HANDOVER_SUMMARY;
  }

  if (pathname === "/api/care-view/discharge-readiness") {
    return [
      {
        admission_id: "cv-adm-1",
        patient_name: "Ramesh Kumar",
        uhid: "UHID-1001",
        bed_name: "B-101",
        ward_name: "ICU",
        expected_discharge_date: "2026-04-29",
        billing_cleared: false,
        pharmacy_cleared: true,
        nursing_cleared: true,
        doctor_cleared: false,
        pending_lab_count: 1,
        readiness_pct: 75,
      },
    ];
  }

  if (pathname === "/api/regulatory/dashboard") {
    return MOCK_REGULATORY_DASHBOARD;
  }

  if (pathname === "/api/regulatory/dashboard/gaps") {
    return MOCK_COMPLIANCE_GAPS;
  }

  if (pathname === "/api/quality/standards") {
    return [
      { id: "std-1", standard_code: "ACC-01", name: "Medication reconciliation", chapter: "Care of Patients" },
    ];
  }

  if (pathname === "/api/quality/compliance") {
    return [
      { standard_id: "std-1", compliance: "compliant", evidence_summary: "Monthly audit complete" },
    ];
  }

  if (pathname === "/api/analytics/revenue/department") {
    return MOCK_ANALYTICS.deptRevenue;
  }

  if (pathname === "/api/analytics/revenue/doctor") {
    return MOCK_ANALYTICS.doctorRevenue;
  }

  if (pathname === "/api/analytics/ipd/census") {
    return MOCK_ANALYTICS.ipdCensus;
  }

  if (pathname === "/api/analytics/lab/tat") {
    return MOCK_ANALYTICS.labTat;
  }

  if (pathname === "/api/analytics/ot/utilization") {
    return MOCK_ANALYTICS.otUtilization;
  }

  if (pathname === "/api/analytics/er/volume") {
    return MOCK_ANALYTICS.erVolume;
  }

  if (pathname === "/api/analytics/clinical/indicators") {
    return MOCK_ANALYTICS.clinicalIndicators;
  }

  if (pathname === "/api/analytics/opd/footfall") {
    return MOCK_ANALYTICS.opdFootfall;
  }

  if (pathname === "/api/analytics/bed/occupancy") {
    return MOCK_ANALYTICS.bedOccupancy;
  }

  if (pathname === "/api/setup/system-health") {
    return fixtures.systemHealth;
  }

  if (pathname.startsWith("/api/settings/tenant")) {
    return fixtures.tenantSettings;
  }

  if (pathname === "/api/setup/device-settings") {
    if (method === "GET") {
      return fixtures.secureDeviceSettings;
    }
    return fixtures.secureDeviceSettings[0] ?? { status: "ok" };
  }

  if (pathname === "/api/devices/manufacturers") {
    return fixtures.devices.manufacturers;
  }

  if (pathname === "/api/devices/catalog") {
    return fixtures.devices.catalog;
  }

  if (pathname.startsWith("/api/devices/catalog/") && pathname.endsWith("/preview-config")) {
    return {
      protocol_config: { type: "dicom" },
      field_mappings: [],
      data_transforms: [],
      qc_config: {},
      applied_quirks: [],
      confidence: 0.95,
      warnings: [],
      suggested_name: "Mock Device",
      suggested_code: "MOCK-DEVICE",
      default_port: 104,
    };
  }

  if (pathname.startsWith("/api/devices/catalog/")) {
    return (fixtures.devices.catalog as unknown[])[0] ?? {};
  }

  if (pathname === "/api/devices/instances") {
    return method === "GET" ? fixtures.devices.instances : (fixtures.devices.instances as unknown[])[0] ?? {};
  }

  if (pathname.match(/^\/api\/devices\/instances\/[^/]+\/messages$/)) {
    return fixtures.devices.messages;
  }

  if (pathname.match(/^\/api\/devices\/instances\/[^/]+\/config-history$/)) {
    return fixtures.devices.configHistory;
  }

  if (pathname.match(/^\/api\/devices\/instances\/[^/]+\/(test|regenerate-config)$/)) {
    return pathname.endsWith("/test")
      ? { status: "ok", message: "Mock test succeeded" }
      : {
        protocol_config: { type: "dicom" },
        field_mappings: [],
        data_transforms: [],
        qc_config: {},
        applied_quirks: [],
        confidence: 0.95,
        warnings: [],
        suggested_name: "Mock Device",
        suggested_code: "MOCK-DEVICE",
        default_port: 104,
      };
  }

  if (pathname.match(/^\/api\/devices\/instances\/[^/]+$/)) {
    return (fixtures.devices.instances as unknown[])[0] ?? {};
  }

  if (pathname === "/api/devices/routing-rules") {
    return method === "GET" ? fixtures.devices.routingRules : (fixtures.devices.routingRules as unknown[])[0] ?? {};
  }

  if (pathname === "/api/devices/agents") {
    return fixtures.devices.agents;
  }

  if (method !== "GET") {
    return { status: "ok" };
  }

  return defaultGetBody(pathname);
}

export async function installMockApi(page: Page) {
  await page.route("https://checkout.razorpay.com/**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "",
    });
  });

  await page.route((url) => url.pathname.startsWith("/api/") || url.pathname === "/api", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();
    const body = getMockBody(url.pathname, method);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

export async function seedMockSession(page: Page) {
  await page.goto("/login");
  await page.evaluate((authUser) => {
    localStorage.setItem(
      "auth-storage",
      JSON.stringify({ state: { user: authUser }, version: 0 }),
    );
    document.cookie = "csrf_token=mock-csrf-token; path=/";
  }, fixtures.authMe);
}
