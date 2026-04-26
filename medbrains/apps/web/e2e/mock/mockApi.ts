import type { Page, Route } from "@playwright/test";
import { readFileSync } from "node:fs";

type JsonRecord = Record<string, unknown>;

interface MockFixtures {
  authMe: Record<string, unknown>;
  tenantSettings: unknown[];
  secureDeviceSettings: unknown[];
  systemHealth: Record<string, unknown>;
  devices: {
    manufacturers: JsonRecord[];
    catalog: JsonRecord[];
    instances: JsonRecord[];
    routingRules: JsonRecord[];
    agents: JsonRecord[];
    messages: unknown[];
    configHistory: unknown[];
  };
}

interface MockState {
  careView: {
    wards: Array<{ id: string; name: string }>;
    wardGrid: {
      summary: JsonRecord;
      patients: JsonRecord[];
    };
    tasks: {
      medication_tasks: JsonRecord[];
      nursing_tasks: JsonRecord[];
    };
    vitalsChecklist: JsonRecord[];
    handoverSummary: JsonRecord;
    dischargeReadiness: JsonRecord[];
  };
  regulatory: {
    dashboard: JsonRecord;
    complianceGaps: JsonRecord[];
    qualityStandards: JsonRecord[];
    qualityCompliance: JsonRecord[];
    checklists: JsonRecord[];
    adrReports: JsonRecord[];
    mvReports: JsonRecord[];
    pcpndtForms: JsonRecord[];
    calendarEvents: JsonRecord[];
    submissions: JsonRecord[];
    mockSurveys: JsonRecord[];
    staffCredentials: JsonRecord[];
    licenses: JsonRecord[];
    nablDocuments: JsonRecord[];
  };
  analytics: {
    deptRevenue: JsonRecord[];
    doctorRevenue: JsonRecord[];
    ipdCensus: JsonRecord[];
    labTat: JsonRecord[];
    otUtilization: JsonRecord[];
    erVolume: JsonRecord[];
    clinicalIndicators: JsonRecord[];
    opdFootfall: JsonRecord[];
    bedOccupancy: JsonRecord[];
  };
  devices: {
    manufacturers: JsonRecord[];
    catalog: JsonRecord[];
    instances: JsonRecord[];
    routingRules: JsonRecord[];
    agents: JsonRecord[];
    messages: unknown[];
    configHistory: unknown[];
  };
}

const fixturePath = new URL("./fixtures/module-api-fixtures.json", import.meta.url);
const fixtures = JSON.parse(readFileSync(fixturePath, "utf8")) as MockFixtures;

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
      tenant_id: "22222222-2222-2222-2222-222222222222",
      title: "Fire NOC renewal",
      description: "Renew fire clearance before expiry",
      regulatory_body_id: "nabh",
      event_type: "license_renewal",
      due_date: "2026-05-02",
      reminder_days: [90, 30, 7],
      department_id: "dept-facilities",
      assigned_to: "quality-user",
      assigned_to_name: "Quality Team",
      status: "upcoming",
      recurrence: "annual",
      source_table: "licenses",
      source_id: "license-1",
      created_by: "11111111-1111-1111-1111-111111111111",
      created_at: "2026-04-20T09:00:00Z",
      updated_at: "2026-04-20T09:00:00Z",
    },
    {
      id: "event-2",
      tenant_id: "22222222-2222-2222-2222-222222222222",
      title: "Medication safety mock audit",
      description: "Department readiness review",
      regulatory_body_id: "nabh",
      event_type: "audit",
      due_date: "2026-05-05",
      reminder_days: [14, 7],
      department_id: "dept-pharmacy",
      assigned_to: "pharmacy-user",
      status: "overdue",
      recurrence: "quarterly",
      created_by: "11111111-1111-1111-1111-111111111111",
      created_at: "2026-04-19T09:00:00Z",
      updated_at: "2026-04-19T09:00:00Z",
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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

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

function parseRequestBody(route: Route): JsonRecord {
  const postData = route.request().postData();
  if (!postData) {
    return {};
  }

  try {
    return JSON.parse(postData) as JsonRecord;
  } catch {
    return {};
  }
}

function buildPreviewConfig(adapter: JsonRecord): JsonRecord {
  const model = String(adapter.model ?? "Mock Device");
  const manufacturer = String(adapter.manufacturer ?? "Mock Manufacturer");
  const modelCode = String(adapter.model_code ?? "mock-device").toUpperCase();
  const protocol = String(adapter.protocol ?? "dicom");
  const defaultPort = typeof adapter.default_port === "number" ? adapter.default_port : 104;

  return {
    protocol_config: { type: protocol },
    field_mappings: [
      { device_field: "PatientID", target: "patient.uhid" },
      { device_field: "AccessionNumber", target: "order.accession_number" },
    ],
    data_transforms: [],
    qc_config: {},
    applied_quirks: [],
    confidence: 0.95,
    warnings: [],
    suggested_name: `${manufacturer} ${model}`,
    suggested_code: modelCode,
    default_port: defaultPort,
  };
}

function createMockState(): MockState {
  return {
    careView: {
      wards: [
        { id: "ward-icu", name: "ICU" },
        { id: "ward-a", name: "Ward A" },
      ],
      wardGrid: clone(MOCK_CARE_VIEW_WARD_GRID),
      tasks: clone(MOCK_CARE_VIEW_TASKS),
      vitalsChecklist: [
        {
          admission_id: "cv-adm-1",
          patient_name: "Ramesh Kumar",
          bed_name: "B-101",
          last_vitals_at: "2026-04-26T08:00:00Z",
          hours_since_last: 2.5,
          vitals_due: false,
        },
      ],
      handoverSummary: clone(MOCK_HANDOVER_SUMMARY),
      dischargeReadiness: [
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
      ],
    },
    regulatory: {
      dashboard: clone(MOCK_REGULATORY_DASHBOARD),
      complianceGaps: clone(MOCK_COMPLIANCE_GAPS),
      qualityStandards: [
        {
          id: "std-1",
          standard_code: "ACC-01",
          name: "Medication reconciliation",
          chapter: "Care of Patients",
        },
      ],
      qualityCompliance: [
        {
          standard_id: "std-1",
          compliance: "compliant",
          evidence_summary: "Monthly audit complete",
        },
      ],
      checklists: [
        {
          id: "checklist-1",
          tenant_id: "22222222-2222-2222-2222-222222222222",
          accreditation_body: "nabh",
          standard_code: "MS-01",
          name: "Medication Safety Audit",
          description: "Monthly audit",
          assessment_period_start: "2026-04-01",
          assessment_period_end: "2026-04-30",
          overall_status: "in_progress",
          compliance_score: 72,
          total_items: 20,
          compliant_items: 14,
          non_compliant_items: 6,
          created_by: "11111111-1111-1111-1111-111111111111",
          created_at: "2026-04-01T09:00:00Z",
          updated_at: "2026-04-20T09:00:00Z",
        },
      ],
      adrReports: [
        {
          id: "adr-1",
          tenant_id: "22222222-2222-2222-2222-222222222222",
          report_number: "ADR-001",
          reporter_id: "11111111-1111-1111-1111-111111111111",
          reporter_type: "doctor",
          drug_name: "Amoxicillin",
          reaction_description: "Generalized rash",
          reaction_date: "2026-04-21",
          severity: "moderate",
          status: "draft",
          seriousness_criteria: [],
          concomitant_drugs: [],
          submitted_to_pvpi: false,
          created_by: "11111111-1111-1111-1111-111111111111",
          created_at: "2026-04-21T09:00:00Z",
          updated_at: "2026-04-21T09:00:00Z",
        },
      ],
      mvReports: [
        {
          id: "mv-1",
          tenant_id: "22222222-2222-2222-2222-222222222222",
          report_number: "MV-001",
          reporter_id: "11111111-1111-1111-1111-111111111111",
          device_name: "Infusion Pump",
          event_description: "Unexpected stoppage",
          event_date: "2026-04-22",
          severity: "moderate",
          status: "draft",
          submitted_to_cdsco: false,
          created_by: "11111111-1111-1111-1111-111111111111",
          created_at: "2026-04-22T09:00:00Z",
          updated_at: "2026-04-22T09:00:00Z",
        },
      ],
      pcpndtForms: [
        {
          id: "pcpndt-1",
          tenant_id: "22222222-2222-2222-2222-222222222222",
          form_number: "FORM-F-001",
          patient_id: "patient-1",
          performing_doctor_id: "doctor-1",
          procedure_type: "ultrasound",
          indication: "Placenta localization",
          status: "submitted",
          quarterly_report_included: true,
          gender_disclosure_blocked: true,
          created_by: "11111111-1111-1111-1111-111111111111",
          created_at: "2026-04-18T09:00:00Z",
          updated_at: "2026-04-18T09:00:00Z",
        },
      ],
      calendarEvents: clone(MOCK_REGULATORY_DASHBOARD.upcoming_deadlines) as JsonRecord[],
      submissions: [
        {
          id: "submission-1",
          tenant_id: "22222222-2222-2222-2222-222222222222",
          submission_type: "annual_report",
          submitted_to: "NABH",
          reference_number: "NABH-2026-01",
          submitted_at: "2026-04-10",
          status: "acknowledged",
          notes: "Accepted without remarks",
          created_at: "2026-04-10T09:00:00Z",
        },
      ],
      mockSurveys: [
        {
          id: "survey-1",
          tenant_id: "22222222-2222-2222-2222-222222222222",
          accreditation_body: "nabh",
          standard_code: "CQI-01",
          name: "Quarterly NABH Mock Survey",
          assessment_period_start: "2026-04-01",
          assessment_period_end: "2026-04-30",
          overall_status: "in_progress",
          compliance_score: 78,
          total_items: 18,
          compliant_items: 14,
          non_compliant_items: 4,
          created_by: "11111111-1111-1111-1111-111111111111",
          created_at: "2026-04-05T09:00:00Z",
          updated_at: "2026-04-20T09:00:00Z",
        },
      ],
      staffCredentials: [
        {
          employee_id: "emp-1",
          employee_name: "Dr. Mehta",
          credential_type: "Medical Registration",
          expiry_date: "2026-09-15",
          days_until_expiry: 142,
          status: "valid",
        },
      ],
      licenses: [
        {
          id: "license-1",
          license_type: "Fire NOC",
          license_number: "FIRE-2024-101",
          issued_date: "2024-05-03",
          expiry_date: "2026-05-02",
          days_until_expiry: 6,
          renewal_status: "expiring_soon",
          responsible_person: "Facilities Manager",
        },
      ],
      nablDocuments: [
        {
          document_type: "SOPs",
          total_required: 12,
          total_uploaded: 10,
          completeness_pct: 83,
        },
      ],
    },
    analytics: clone(MOCK_ANALYTICS) as MockState["analytics"],
    devices: {
      manufacturers: clone(fixtures.devices.manufacturers),
      catalog: clone(fixtures.devices.catalog),
      instances: clone(fixtures.devices.instances),
      routingRules: [
        {
          id: "routing-1",
          device_instance_id: null,
          adapter_code: "siemens_ct_somatom_go",
          name: "CT -> Radiology Worklist",
          description: "Route CT acquisitions into radiology orders",
          target_module: "radiology",
          match_strategy: "accession_number",
          match_field: "AccessionNumber",
          target_entity: "radiology_orders",
          auto_verify: false,
          notify_on_critical: true,
          reject_duplicates: true,
          is_active: true,
          priority: 1,
          created_at: "2026-04-20T09:00:00Z",
        },
      ],
      agents: clone(fixtures.devices.agents),
      messages: clone(fixtures.devices.messages),
      configHistory: clone(fixtures.devices.configHistory),
    },
  };
}

function getMockBody(
  pathname: string,
  method: string,
  searchParams: URLSearchParams,
  requestBody: JsonRecord,
  state: MockState,
  generateId: (prefix: string) => string,
): unknown {
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
    return state.careView.wards;
  }

  if (pathname === "/api/care-view/ward-grid") {
    return state.careView.wardGrid;
  }

  if (pathname === "/api/care-view/my-tasks") {
    return state.careView.tasks;
  }

  if (pathname === "/api/care-view/vitals-checklist") {
    return state.careView.vitalsChecklist;
  }

  if (pathname === "/api/care-view/handover") {
    return state.careView.handoverSummary;
  }

  if (pathname === "/api/care-view/discharge-tracker") {
    return state.careView.dischargeReadiness;
  }

  if (pathname.match(/^\/api\/care-view\/tasks\/[^/]+\/complete$/) && method === "POST") {
    const taskId = pathname.split("/")[4];
    state.careView.tasks.nursing_tasks = state.careView.tasks.nursing_tasks.filter(
      (task) => String(task.task_id ?? "") !== taskId,
    );
    return { completed: true };
  }

  if (pathname === "/api/regulatory/dashboard") {
    return state.regulatory.dashboard;
  }

  if (pathname === "/api/regulatory/dashboard/gaps") {
    return state.regulatory.complianceGaps;
  }

  if (pathname === "/api/quality/standards") {
    return state.regulatory.qualityStandards;
  }

  if (pathname === "/api/quality/compliance") {
    return state.regulatory.qualityCompliance;
  }

  if (pathname === "/api/regulatory/checklists") {
    if (method === "GET") {
      const body = searchParams.get("accreditation_body");
      return body
        ? state.regulatory.checklists.filter((item) => String(item.accreditation_body) === body)
        : state.regulatory.checklists;
    }

    if (method === "POST") {
      const checklist = {
        id: generateId("checklist"),
        tenant_id: "22222222-2222-2222-2222-222222222222",
        overall_status: "not_started",
        compliance_score: 0,
        total_items: 0,
        compliant_items: 0,
        non_compliant_items: 0,
        created_by: "11111111-1111-1111-1111-111111111111",
        created_at: "2026-04-26T09:00:00Z",
        updated_at: "2026-04-26T09:00:00Z",
        ...requestBody,
      };
      state.regulatory.checklists.unshift(checklist);
      return checklist;
    }
  }

  if (pathname.match(/^\/api\/regulatory\/checklists\/[^/]+\/auto-populate$/) && method === "POST") {
    return { updated: 3 };
  }

  if (pathname === "/api/regulatory/adr-reports") {
    if (method === "GET") {
      const status = searchParams.get("status");
      return status
        ? state.regulatory.adrReports.filter((item) => String(item.status) === status)
        : state.regulatory.adrReports;
    }

    if (method === "POST") {
      const report = {
        id: generateId("adr"),
        tenant_id: "22222222-2222-2222-2222-222222222222",
        report_number: `ADR-${state.regulatory.adrReports.length + 1}`.padStart(3, "0"),
        reporter_id: "11111111-1111-1111-1111-111111111111",
        reporter_type: "doctor",
        status: "draft",
        seriousness_criteria: [],
        concomitant_drugs: [],
        submitted_to_pvpi: false,
        created_by: "11111111-1111-1111-1111-111111111111",
        created_at: "2026-04-26T09:00:00Z",
        updated_at: "2026-04-26T09:00:00Z",
        ...requestBody,
      };
      state.regulatory.adrReports.unshift(report);
      return report;
    }
  }

  if (pathname.match(/^\/api\/regulatory\/adr-reports\/[^/]+\/submit$/) && method === "POST") {
    const reportId = pathname.split("/")[4];
    state.regulatory.adrReports = state.regulatory.adrReports.map((item) =>
      String(item.id) === reportId
        ? {
          ...item,
          status: "submitted",
          submitted_to_pvpi: true,
          submitted_at: "2026-04-26T09:00:00Z",
        }
        : item,
    );
    return state.regulatory.adrReports.find((item) => String(item.id) === reportId) ?? {};
  }

  if (pathname === "/api/regulatory/materiovigilance") {
    if (method === "GET") {
      const status = searchParams.get("status");
      return status
        ? state.regulatory.mvReports.filter((item) => String(item.status) === status)
        : state.regulatory.mvReports;
    }

    if (method === "POST") {
      const report = {
        id: generateId("mv"),
        tenant_id: "22222222-2222-2222-2222-222222222222",
        report_number: `MV-${state.regulatory.mvReports.length + 1}`.padStart(3, "0"),
        reporter_id: "11111111-1111-1111-1111-111111111111",
        status: "draft",
        submitted_to_cdsco: false,
        created_by: "11111111-1111-1111-1111-111111111111",
        created_at: "2026-04-26T09:00:00Z",
        updated_at: "2026-04-26T09:00:00Z",
        ...requestBody,
      };
      state.regulatory.mvReports.unshift(report);
      return report;
    }
  }

  if (pathname.match(/^\/api\/regulatory\/materiovigilance\/[^/]+\/submit$/) && method === "POST") {
    const reportId = pathname.split("/")[4];
    state.regulatory.mvReports = state.regulatory.mvReports.map((item) =>
      String(item.id) === reportId
        ? {
          ...item,
          status: "submitted",
          submitted_to_cdsco: true,
          submitted_at: "2026-04-26T09:00:00Z",
        }
        : item,
    );
    return state.regulatory.mvReports.find((item) => String(item.id) === reportId) ?? {};
  }

  if (pathname === "/api/regulatory/pcpndt-forms") {
    if (method === "GET") {
      return state.regulatory.pcpndtForms;
    }

    if (method === "POST") {
      const form = {
        id: generateId("pcpndt"),
        tenant_id: "22222222-2222-2222-2222-222222222222",
        form_number: `FORM-F-${state.regulatory.pcpndtForms.length + 1}`,
        status: "draft",
        quarterly_report_included: false,
        gender_disclosure_blocked: true,
        created_by: "11111111-1111-1111-1111-111111111111",
        created_at: "2026-04-26T09:00:00Z",
        updated_at: "2026-04-26T09:00:00Z",
        ...requestBody,
      };
      state.regulatory.pcpndtForms.unshift(form);
      return form;
    }
  }

  if (pathname === "/api/regulatory/calendar/overdue") {
    return state.regulatory.calendarEvents.filter((event) => String(event.status) === "overdue");
  }

  if (pathname === "/api/regulatory/calendar") {
    if (method === "GET") {
      const status = searchParams.get("status");
      return status
        ? state.regulatory.calendarEvents.filter((event) => String(event.status) === status)
        : state.regulatory.calendarEvents;
    }

    if (method === "POST") {
      const event = {
        id: generateId("calendar"),
        tenant_id: "22222222-2222-2222-2222-222222222222",
        reminder_days: [],
        status: "upcoming",
        recurrence: String(requestBody.recurrence ?? "once"),
        created_by: "11111111-1111-1111-1111-111111111111",
        created_at: "2026-04-26T09:00:00Z",
        updated_at: "2026-04-26T09:00:00Z",
        ...requestBody,
      };
      state.regulatory.calendarEvents.unshift(event);
      state.regulatory.dashboard = {
        ...state.regulatory.dashboard,
        upcoming_deadlines: [event, ...(state.regulatory.dashboard.upcoming_deadlines as JsonRecord[] ?? [])],
      };
      return event;
    }
  }

  if (pathname.match(/^\/api\/regulatory\/calendar\/[^/]+$/) && method === "PUT") {
    const eventId = pathname.split("/")[4];
    state.regulatory.calendarEvents = state.regulatory.calendarEvents.map((event) =>
      String(event.id) === eventId
        ? {
          ...event,
          ...requestBody,
          updated_at: "2026-04-26T09:00:00Z",
        }
        : event,
    );
    return state.regulatory.calendarEvents.find((event) => String(event.id) === eventId) ?? {};
  }

  if (pathname === "/api/regulatory/submissions") {
    if (method === "GET") {
      return state.regulatory.submissions;
    }

    if (method === "POST") {
      const submission = {
        id: generateId("submission"),
        tenant_id: "22222222-2222-2222-2222-222222222222",
        status: String(requestBody.status ?? "submitted"),
        reference_number: requestBody.reference_number ?? null,
        notes: requestBody.notes ?? null,
        created_at: "2026-04-26T09:00:00Z",
        ...requestBody,
      };
      state.regulatory.submissions.unshift(submission);
      return submission;
    }
  }

  if (pathname === "/api/regulatory/mock-surveys") {
    if (method === "GET") {
      return state.regulatory.mockSurveys;
    }

    if (method === "POST") {
      const survey = {
        id: generateId("survey"),
        tenant_id: "22222222-2222-2222-2222-222222222222",
        overall_status: "not_started",
        compliance_score: null,
        total_items: 0,
        compliant_items: 0,
        non_compliant_items: 0,
        created_by: "11111111-1111-1111-1111-111111111111",
        created_at: "2026-04-26T09:00:00Z",
        updated_at: "2026-04-26T09:00:00Z",
        ...requestBody,
      };
      state.regulatory.mockSurveys.unshift(survey);
      return survey;
    }
  }

  if (pathname === "/api/regulatory/staff-credentials") {
    return state.regulatory.staffCredentials;
  }

  if (pathname === "/api/regulatory/licenses/dashboard") {
    return state.regulatory.licenses;
  }

  if (pathname === "/api/regulatory/nabl/documents") {
    return state.regulatory.nablDocuments;
  }

  if (pathname === "/api/analytics/revenue/department") {
    return state.analytics.deptRevenue;
  }

  if (pathname === "/api/analytics/revenue/doctor") {
    return state.analytics.doctorRevenue;
  }

  if (pathname === "/api/analytics/ipd/census") {
    return state.analytics.ipdCensus;
  }

  if (pathname === "/api/analytics/lab/tat") {
    return state.analytics.labTat;
  }

  if (pathname === "/api/analytics/ot/utilization") {
    return state.analytics.otUtilization;
  }

  if (pathname === "/api/analytics/er/volume") {
    return state.analytics.erVolume;
  }

  if (pathname === "/api/analytics/clinical/indicators") {
    return state.analytics.clinicalIndicators;
  }

  if (pathname === "/api/analytics/opd/footfall") {
    return state.analytics.opdFootfall;
  }

  if (pathname === "/api/analytics/bed/occupancy") {
    return state.analytics.bedOccupancy;
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
    return state.devices.manufacturers;
  }

  if (pathname === "/api/devices/catalog") {
    const query = searchParams.get("q")?.toLowerCase() ?? "";
    const category = searchParams.get("category");
    const protocol = searchParams.get("protocol");
    const manufacturer = searchParams.get("manufacturer");

    return state.devices.catalog.filter((adapter) => {
      const matchesQuery = query === ""
        || String(adapter.model ?? "").toLowerCase().includes(query)
        || String(adapter.manufacturer ?? "").toLowerCase().includes(query)
        || String(adapter.adapter_code ?? "").toLowerCase().includes(query);
      const matchesCategory = !category || String(adapter.device_category ?? "") === category;
      const matchesProtocol = !protocol || String(adapter.protocol ?? "") === protocol;
      const matchesManufacturer = !manufacturer || String(adapter.manufacturer_code ?? "") === manufacturer;
      return matchesQuery && matchesCategory && matchesProtocol && matchesManufacturer;
    });
  }

  if (pathname.startsWith("/api/devices/catalog/") && pathname.endsWith("/preview-config")) {
    const adapterCode = pathname.split("/")[4];
    const adapter = state.devices.catalog.find(
      (item) => String(item.adapter_code ?? item.id ?? "") === adapterCode,
    );
    return buildPreviewConfig(adapter ?? {});
  }

  if (pathname.startsWith("/api/devices/catalog/")) {
    const adapterCode = pathname.split("/")[4];
    return state.devices.catalog.find(
      (item) => String(item.adapter_code ?? item.id ?? "") === adapterCode,
    ) ?? state.devices.catalog[0] ?? {};
  }

  if (pathname === "/api/devices/instances") {
    if (method === "GET") {
      return state.devices.instances;
    }

    if (method === "POST") {
      const adapterCode = String(requestBody.adapter_code ?? "");
      const adapter = state.devices.catalog.find(
        (item) => String(item.adapter_code ?? "") === adapterCode,
      );
      const created = {
        id: generateId("device"),
        tenant_id: "22222222-2222-2222-2222-222222222222",
        facility_id: null,
        department_id: null,
        serial_number: requestBody.serial_number ?? null,
        hostname: requestBody.hostname ?? null,
        port: typeof requestBody.port === "number" ? requestBody.port : Number(requestBody.port ?? 0) || null,
        protocol_config: {
          type: String(adapter?.protocol ?? "dicom"),
        },
        field_mappings: [],
        data_transforms: [],
        qc_config: {},
        ai_config_version: 1,
        ai_confidence: 0.95,
        human_overrides: {},
        config_source: "ai",
        status: "pending_setup",
        last_heartbeat: null,
        last_message_at: null,
        last_error: null,
        error_count_24h: 0,
        message_count_24h: 0,
        bridge_agent_id: null,
        notes: requestBody.notes ?? null,
        tags: [],
        is_active: true,
        created_at: "2026-04-26T09:00:00Z",
        updated_at: "2026-04-26T09:00:00Z",
        ...requestBody,
      };
      state.devices.instances.unshift(created);
      return created;
    }
  }

  if (pathname.match(/^\/api\/devices\/instances\/[^/]+\/messages$/)) {
    return state.devices.messages;
  }

  if (pathname.match(/^\/api\/devices\/instances\/[^/]+\/config-history$/)) {
    return state.devices.configHistory;
  }

  if (pathname.match(/^\/api\/devices\/instances\/[^/]+\/test$/) && method === "POST") {
    return { status: "ok", message: "Mock test succeeded" };
  }

  if (pathname.match(/^\/api\/devices\/instances\/[^/]+\/regenerate-config$/) && method === "POST") {
    const deviceId = pathname.split("/")[4];
    const device = state.devices.instances.find((item) => String(item.id ?? "") === deviceId);
    const adapter = state.devices.catalog.find(
      (item) => String(item.adapter_code ?? "") === String(device?.adapter_code ?? ""),
    );
    return buildPreviewConfig(adapter ?? {});
  }

  if (pathname.match(/^\/api\/devices\/instances\/[^/]+$/)) {
    const deviceId = pathname.split("/")[4];
    return state.devices.instances.find((item) => String(item.id ?? "") === deviceId) ?? {};
  }

  if (pathname === "/api/devices/routing-rules") {
    if (method === "GET") {
      return state.devices.routingRules;
    }

    if (method === "POST") {
      const rule = {
        id: generateId("routing"),
        device_instance_id: null,
        description: null,
        auto_verify: false,
        notify_on_critical: false,
        reject_duplicates: false,
        is_active: true,
        priority: state.devices.routingRules.length + 1,
        created_at: "2026-04-26T09:00:00Z",
        ...requestBody,
      };
      state.devices.routingRules.unshift(rule);
      return rule;
    }
  }

  if (pathname.match(/^\/api\/devices\/routing-rules\/[^/]+$/) && method === "DELETE") {
    const ruleId = pathname.split("/")[4];
    state.devices.routingRules = state.devices.routingRules.filter(
      (item) => String(item.id ?? "") !== ruleId,
    );
    return { status: "ok" };
  }

  if (pathname === "/api/devices/agents") {
    return state.devices.agents;
  }

  if (method !== "GET") {
    return { status: "ok" };
  }

  return defaultGetBody(pathname);
}

export async function installMockApi(page: Page) {
  const state = createMockState();
  let nextId = 1;
  const generateId = (prefix: string) => `${prefix}-${String(nextId++).padStart(4, "0")}`;

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
    const requestBody = parseRequestBody(route);
    const body = getMockBody(
      url.pathname,
      method,
      url.searchParams,
      requestBody,
      state,
      generateId,
    );

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
