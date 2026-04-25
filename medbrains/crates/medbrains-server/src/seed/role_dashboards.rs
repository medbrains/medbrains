use sqlx::PgPool;

struct WidgetDef {
    wtype: &'static str,
    title: &'static str,
    subtitle: &'static str,
    icon: &'static str,
    color: &'static str,
    config: &'static str,
    data_source: &'static str,
    x: i32,
    y: i32,
    w: i32,
    h: i32,
    perm: &'static str,
    sort: i32,
    refresh_ms: Option<i32>,
}

struct RoleDashboard {
    code: &'static str,
    name: &'static str,
    description: &'static str,
    role_codes: &'static str,
    widgets: &'static [WidgetDef],
}

// ── Doctor Dashboard ──────────────────────────────────────────

const DOCTOR_WIDGETS: &[WidgetDef] = &[
    WidgetDef {
        wtype: "stat_card", title: "My Patients Today", subtitle: "Encounters assigned to you today",
        icon: "IconStethoscope", color: "teal",
        config: r#"{"format": "number"}"#,
        data_source: r#"{"type": "module_query", "module": "patients", "query": "my_patients_today"}"#,
        x: 0, y: 0, w: 3, h: 2, perm: "opd.visit.list", sort: 1, refresh_ms: Some(30000),
    },
    WidgetDef {
        wtype: "stat_card", title: "My Pending Labs", subtitle: "Lab orders awaiting results",
        icon: "IconFlask", color: "orange",
        config: r#"{"format": "number"}"#,
        data_source: r#"{"type": "module_query", "module": "lab", "query": "my_pending"}"#,
        x: 3, y: 0, w: 3, h: 2, perm: "lab.orders.list", sort: 2, refresh_ms: Some(60000),
    },
    WidgetDef {
        wtype: "stat_card", title: "Active Admissions", subtitle: "Current IPD patients",
        icon: "IconBed", color: "indigo",
        config: r#"{"format": "number"}"#,
        data_source: r#"{"type": "sql_count", "table": "admissions", "filter": "status = 'admitted'"}"#,
        x: 6, y: 0, w: 3, h: 2, perm: "ipd.admissions.list", sort: 3, refresh_ms: None,
    },
    WidgetDef {
        wtype: "stat_card", title: "Total Patients", subtitle: "Registered patients",
        icon: "IconUsers", color: "blue",
        config: r#"{"format": "number"}"#,
        data_source: r#"{"type": "sql_count", "table": "patients"}"#,
        x: 9, y: 0, w: 3, h: 2, perm: "patients.list", sort: 4, refresh_ms: None,
    },
    WidgetDef {
        wtype: "data_table", title: "My OPD Queue", subtitle: "Your current waiting list",
        icon: "IconList", color: "teal",
        config: r#"{"max_rows": 10, "columns": ["token_number", "patient_name", "status", "wait_time"]}"#,
        data_source: r#"{"type": "module_query", "module": "opd", "query": "my_queue"}"#,
        x: 0, y: 2, w: 6, h: 4, perm: "opd.queue.list", sort: 5, refresh_ms: Some(15000),
    },
    WidgetDef {
        wtype: "data_table", title: "My Appointments", subtitle: "Today's scheduled appointments",
        icon: "IconCalendar", color: "blue",
        config: r#"{"max_rows": 10, "columns": ["patient_name", "scheduled_time", "visit_type", "status"]}"#,
        data_source: r#"{"type": "module_query", "module": "opd", "query": "my_appointments"}"#,
        x: 6, y: 2, w: 6, h: 4, perm: "opd.queue.list", sort: 6, refresh_ms: Some(60000),
    },
    WidgetDef {
        wtype: "quick_actions", title: "Quick Actions", subtitle: "Frequently used actions",
        icon: "IconRocket", color: "violet",
        config: r#"{"actions": [{"label": "New OPD Visit", "icon": "IconStethoscope", "route": "/opd?action=new", "permission": "opd.visit.create"},{"label": "Lab Order", "icon": "IconFlask", "route": "/lab?action=new", "permission": "lab.orders.create"},{"label": "Prescribe", "icon": "IconPill", "route": "/pharmacy?action=new", "permission": "pharmacy.prescriptions.list"},{"label": "Register Patient", "icon": "IconUserPlus", "route": "/patients?action=new", "permission": "patients.create"}]}"#,
        data_source: r#"{"type": "static"}"#,
        x: 0, y: 6, w: 12, h: 2, perm: "dashboard.view", sort: 7, refresh_ms: None,
    },
];

// ── Nurse Dashboard ───────────────────────────────────────────

const NURSE_WIDGETS: &[WidgetDef] = &[
    WidgetDef {
        wtype: "stat_card", title: "Ward Patients", subtitle: "Active admissions in your department",
        icon: "IconBed", color: "indigo",
        config: r#"{"format": "number"}"#,
        data_source: r#"{"type": "module_query", "module": "ipd", "query": "my_ward_patients"}"#,
        x: 0, y: 0, w: 3, h: 2, perm: "ipd.admissions.list", sort: 1, refresh_ms: Some(30000),
    },
    WidgetDef {
        wtype: "stat_card", title: "Bed Occupancy", subtitle: "Current bed occupancy",
        icon: "IconBuildingHospital", color: "teal",
        config: r#"{"format": "number"}"#,
        data_source: r#"{"type": "module_query", "module": "ipd", "query": "occupied_beds"}"#,
        x: 3, y: 0, w: 3, h: 2, perm: "ipd.bed_dashboard.view", sort: 2, refresh_ms: None,
    },
    WidgetDef {
        wtype: "stat_card", title: "Pending Lab", subtitle: "Pending lab orders",
        icon: "IconFlask", color: "orange",
        config: r#"{"format": "number"}"#,
        data_source: r#"{"type": "module_query", "module": "lab", "query": "pending_count"}"#,
        x: 6, y: 0, w: 3, h: 2, perm: "lab.phlebotomy.list", sort: 3, refresh_ms: Some(60000),
    },
    WidgetDef {
        wtype: "stat_card", title: "OPD Queue", subtitle: "Current OPD queue",
        icon: "IconStethoscope", color: "blue",
        config: r#"{"format": "number"}"#,
        data_source: r#"{"type": "module_query", "module": "opd", "query": "queue_count"}"#,
        x: 9, y: 0, w: 3, h: 2, perm: "opd.queue.list", sort: 4, refresh_ms: Some(30000),
    },
    WidgetDef {
        wtype: "data_table", title: "Medication Schedule", subtitle: "Upcoming medication administrations",
        icon: "IconPill", color: "red",
        config: r#"{"max_rows": 10, "columns": ["patient_name", "drug_name", "dose", "scheduled_time"]}"#,
        data_source: r#"{"type": "module_query", "module": "ipd", "query": "medication_schedule"}"#,
        x: 0, y: 2, w: 6, h: 4, perm: "ipd.admissions.list", sort: 5, refresh_ms: Some(30000),
    },
    WidgetDef {
        wtype: "data_table", title: "Recent Admissions", subtitle: "Latest IPD admissions",
        icon: "IconBed", color: "indigo",
        config: r#"{"max_rows": 10, "columns": ["patient_name", "department", "bed", "admitted_at"]}"#,
        data_source: r#"{"type": "api", "endpoint": "/api/ipd/admissions", "params": {"limit": 10}}"#,
        x: 6, y: 2, w: 6, h: 4, perm: "ipd.admissions.list", sort: 6, refresh_ms: None,
    },
    WidgetDef {
        wtype: "quick_actions", title: "Quick Actions", subtitle: "Nursing shortcuts",
        icon: "IconRocket", color: "violet",
        config: r#"{"actions": [{"label": "Bed Dashboard", "icon": "IconBed", "route": "/ipd?tab=beds", "permission": "ipd.bed_dashboard.view"},{"label": "Discharge Tracker", "icon": "IconClipboardCheck", "route": "/care-view?tab=discharge", "permission": "care_view.discharge_tracker"},{"label": "Record Vitals", "icon": "IconHeartbeat", "route": "/ipd?tab=docs", "permission": "ipd.clinical_docs.create"},{"label": "Handover", "icon": "IconArrowsTransferDown", "route": "/care-view?tab=handover", "permission": "care_view.handover"}]}"#,
        data_source: r#"{"type": "static"}"#,
        x: 0, y: 6, w: 12, h: 2, perm: "dashboard.view", sort: 7, refresh_ms: None,
    },
];

// ── Receptionist Dashboard ────────────────────────────────────

const RECEPTIONIST_WIDGETS: &[WidgetDef] = &[
    WidgetDef {
        wtype: "stat_card", title: "Today's Registrations", subtitle: "Patients registered today",
        icon: "IconUserPlus", color: "blue",
        config: r#"{"format": "number"}"#,
        data_source: r#"{"type": "module_query", "module": "patients", "query": "today_count"}"#,
        x: 0, y: 0, w: 3, h: 2, perm: "patients.list", sort: 1, refresh_ms: Some(30000),
    },
    WidgetDef {
        wtype: "stat_card", title: "OPD Queue", subtitle: "Current waiting patients",
        icon: "IconStethoscope", color: "teal",
        config: r#"{"format": "number"}"#,
        data_source: r#"{"type": "module_query", "module": "opd", "query": "queue_count"}"#,
        x: 3, y: 0, w: 3, h: 2, perm: "opd.queue.list", sort: 2, refresh_ms: Some(15000),
    },
    WidgetDef {
        wtype: "stat_card", title: "Total Patients", subtitle: "All registered patients",
        icon: "IconUsers", color: "indigo",
        config: r#"{"format": "number"}"#,
        data_source: r#"{"type": "sql_count", "table": "patients"}"#,
        x: 6, y: 0, w: 3, h: 2, perm: "patients.list", sort: 3, refresh_ms: None,
    },
    WidgetDef {
        wtype: "stat_card", title: "Pending Payments", subtitle: "Pending invoice payments",
        icon: "IconReceipt", color: "orange",
        config: r#"{"format": "number"}"#,
        data_source: r#"{"type": "module_query", "module": "billing", "query": "pending_invoices"}"#,
        x: 9, y: 0, w: 3, h: 2, perm: "billing.invoices.list", sort: 4, refresh_ms: Some(60000),
    },
    WidgetDef {
        wtype: "data_table", title: "OPD Queue", subtitle: "Current OPD waiting list",
        icon: "IconList", color: "teal",
        config: r#"{"max_rows": 10, "columns": ["token_number", "patient_name", "doctor_name", "status"]}"#,
        data_source: r#"{"type": "api", "endpoint": "/api/opd/queue", "params": {"status": "waiting"}}"#,
        x: 0, y: 2, w: 6, h: 4, perm: "opd.queue.list", sort: 5, refresh_ms: Some(15000),
    },
    WidgetDef {
        wtype: "data_table", title: "Upcoming Appointments", subtitle: "Today's scheduled appointments",
        icon: "IconCalendar", color: "blue",
        config: r#"{"max_rows": 10, "columns": ["patient_name", "scheduled_time", "doctor_name", "status"]}"#,
        data_source: r#"{"type": "module_query", "module": "opd", "query": "my_appointments"}"#,
        x: 6, y: 2, w: 6, h: 4, perm: "opd.queue.list", sort: 6, refresh_ms: Some(60000),
    },
    WidgetDef {
        wtype: "quick_actions", title: "Quick Actions", subtitle: "Front desk shortcuts",
        icon: "IconRocket", color: "violet",
        config: r#"{"actions": [{"label": "Register Patient", "icon": "IconUserPlus", "route": "/patients?action=new", "permission": "patients.create"},{"label": "New OPD Visit", "icon": "IconStethoscope", "route": "/opd?action=new", "permission": "opd.visit.create"},{"label": "Create Invoice", "icon": "IconReceipt", "route": "/billing?action=new", "permission": "billing.invoices.create"},{"label": "Visitor Pass", "icon": "IconId", "route": "/front-office?tab=visitors", "permission": "front_office.visitors.create"}]}"#,
        data_source: r#"{"type": "static"}"#,
        x: 0, y: 6, w: 12, h: 2, perm: "dashboard.view", sort: 7, refresh_ms: None,
    },
];

// ── Lab Technician Dashboard ──────────────────────────────────

const LAB_TECH_WIDGETS: &[WidgetDef] = &[
    WidgetDef {
        wtype: "stat_card", title: "Pending Samples", subtitle: "Lab orders awaiting processing",
        icon: "IconFlask", color: "orange",
        config: r#"{"format": "number"}"#,
        data_source: r#"{"type": "module_query", "module": "lab", "query": "pending_count"}"#,
        x: 0, y: 0, w: 3, h: 2, perm: "lab.orders.list", sort: 1, refresh_ms: Some(30000),
    },
    WidgetDef {
        wtype: "stat_card", title: "Completed Today", subtitle: "Lab orders completed today",
        icon: "IconCheck", color: "green",
        config: r#"{"format": "number"}"#,
        data_source: r#"{"type": "module_query", "module": "lab", "query": "today_completed"}"#,
        x: 3, y: 0, w: 3, h: 2, perm: "lab.orders.list", sort: 2, refresh_ms: Some(60000),
    },
    WidgetDef {
        wtype: "stat_card", title: "Lab TAT", subtitle: "Average turnaround time today",
        icon: "IconClock", color: "cyan",
        config: r#"{"format": "duration_minutes"}"#,
        data_source: r#"{"type": "module_query", "module": "lab", "query": "tat_today"}"#,
        x: 6, y: 0, w: 3, h: 2, perm: "lab.orders.list", sort: 3, refresh_ms: Some(120000),
    },
    WidgetDef {
        wtype: "stat_card", title: "QC Pending", subtitle: "QC results needing review",
        icon: "IconShield", color: "red",
        config: r#"{"format": "number"}"#,
        data_source: r#"{"type": "module_query", "module": "lab", "query": "pending_count"}"#,
        x: 9, y: 0, w: 3, h: 2, perm: "lab.qc.list", sort: 4, refresh_ms: Some(60000),
    },
    WidgetDef {
        wtype: "data_table", title: "Phlebotomy Queue", subtitle: "Samples pending collection",
        icon: "IconDroplet", color: "red",
        config: r#"{"max_rows": 10, "columns": ["patient_name", "test_name", "priority", "ordered_at"]}"#,
        data_source: r#"{"type": "module_query", "module": "lab", "query": "phlebotomy_queue"}"#,
        x: 0, y: 2, w: 6, h: 4, perm: "lab.phlebotomy.list", sort: 5, refresh_ms: Some(30000),
    },
    WidgetDef {
        wtype: "list", title: "Recent Results", subtitle: "Latest completed lab results",
        icon: "IconTestPipe", color: "orange",
        config: r#"{"max_items": 8, "show_timestamp": true}"#,
        data_source: r#"{"type": "module_query", "module": "lab", "query": "recent_results", "params": {"limit": 8}}"#,
        x: 6, y: 2, w: 6, h: 4, perm: "lab.orders.list", sort: 6, refresh_ms: Some(60000),
    },
];

// ── Pharmacist Dashboard ──────────────────────────────────────

const PHARMACIST_WIDGETS: &[WidgetDef] = &[
    WidgetDef {
        wtype: "stat_card", title: "Pending Rx", subtitle: "Prescriptions awaiting dispensing",
        icon: "IconPrescription", color: "green",
        config: r#"{"format": "number"}"#,
        data_source: r#"{"type": "module_query", "module": "pharmacy", "query": "pending_prescriptions"}"#,
        x: 0, y: 0, w: 3, h: 2, perm: "pharmacy.prescriptions.list", sort: 1, refresh_ms: Some(15000),
    },
    WidgetDef {
        wtype: "stat_card", title: "Dispensed Today", subtitle: "Orders dispensed today",
        icon: "IconCheck", color: "teal",
        config: r#"{"format": "number"}"#,
        data_source: r#"{"type": "module_query", "module": "pharmacy", "query": "today_dispensed"}"#,
        x: 3, y: 0, w: 3, h: 2, perm: "pharmacy.prescriptions.list", sort: 2, refresh_ms: Some(60000),
    },
    WidgetDef {
        wtype: "stat_card", title: "Total Patients", subtitle: "Registered patients",
        icon: "IconUsers", color: "blue",
        config: r#"{"format": "number"}"#,
        data_source: r#"{"type": "sql_count", "table": "patients"}"#,
        x: 6, y: 0, w: 3, h: 2, perm: "patients.view", sort: 3, refresh_ms: None,
    },
    WidgetDef {
        wtype: "stat_card", title: "Pending Lab", subtitle: "Pending lab orders",
        icon: "IconFlask", color: "orange",
        config: r#"{"format": "number"}"#,
        data_source: r#"{"type": "module_query", "module": "lab", "query": "pending_count"}"#,
        x: 9, y: 0, w: 3, h: 2, perm: "pharmacy.prescriptions.list", sort: 4, refresh_ms: None,
    },
    WidgetDef {
        wtype: "list", title: "Stock Alerts", subtitle: "Low stock and near-expiry drugs",
        icon: "IconAlertTriangle", color: "yellow",
        config: r#"{"max_items": 10, "show_icon": true}"#,
        data_source: r#"{"type": "module_query", "module": "pharmacy", "query": "stock_alerts"}"#,
        x: 0, y: 2, w: 4, h: 4, perm: "pharmacy.stock.manage", sort: 5, refresh_ms: Some(300000),
    },
    WidgetDef {
        wtype: "data_table", title: "NDPS Register", subtitle: "Recent controlled substance entries",
        icon: "IconShield", color: "red",
        config: r#"{"max_rows": 8, "columns": ["drug_name", "action", "quantity", "balance", "created_at"]}"#,
        data_source: r#"{"type": "module_query", "module": "pharmacy", "query": "ndps_recent"}"#,
        x: 4, y: 2, w: 8, h: 4, perm: "pharmacy.ndps.list", sort: 6, refresh_ms: Some(60000),
    },
    WidgetDef {
        wtype: "quick_actions", title: "Quick Actions", subtitle: "Pharmacy shortcuts",
        icon: "IconRocket", color: "violet",
        config: r#"{"actions": [{"label": "Dispense", "icon": "IconPill", "route": "/pharmacy?tab=orders", "permission": "pharmacy.dispensing.create"},{"label": "Stock Check", "icon": "IconPackage", "route": "/pharmacy?tab=stock", "permission": "pharmacy.stock.manage"},{"label": "NDPS Entry", "icon": "IconShield", "route": "/pharmacy?tab=ndps", "permission": "pharmacy.ndps.manage"},{"label": "Indent", "icon": "IconFileText", "route": "/indent?action=new", "permission": "indent.create"}]}"#,
        data_source: r#"{"type": "static"}"#,
        x: 0, y: 6, w: 12, h: 2, perm: "dashboard.view", sort: 7, refresh_ms: None,
    },
];

// ── Billing Clerk Dashboard ───────────────────────────────────

const BILLING_WIDGETS: &[WidgetDef] = &[
    WidgetDef {
        wtype: "stat_card", title: "Today's Revenue", subtitle: "Total billing today",
        icon: "IconCoin", color: "green",
        config: r#"{"format": "currency"}"#,
        data_source: r#"{"type": "module_query", "module": "billing", "query": "today_revenue"}"#,
        x: 0, y: 0, w: 3, h: 2, perm: "billing.invoices.list", sort: 1, refresh_ms: Some(30000),
    },
    WidgetDef {
        wtype: "stat_card", title: "Collections", subtitle: "Payments collected today",
        icon: "IconCash", color: "teal",
        config: r#"{"format": "currency"}"#,
        data_source: r#"{"type": "module_query", "module": "billing", "query": "today_collections"}"#,
        x: 3, y: 0, w: 3, h: 2, perm: "billing.invoices.list", sort: 2, refresh_ms: Some(30000),
    },
    WidgetDef {
        wtype: "stat_card", title: "Pending Invoices", subtitle: "Invoices awaiting payment",
        icon: "IconReceipt", color: "orange",
        config: r#"{"format": "number"}"#,
        data_source: r#"{"type": "module_query", "module": "billing", "query": "pending_invoices"}"#,
        x: 6, y: 0, w: 3, h: 2, perm: "billing.invoices.list", sort: 3, refresh_ms: Some(60000),
    },
    WidgetDef {
        wtype: "stat_card", title: "Day Close", subtitle: "Today's day-end close status",
        icon: "IconCalendarCheck", color: "violet",
        config: r#"{"format": "text"}"#,
        data_source: r#"{"type": "module_query", "module": "billing", "query": "day_close_status"}"#,
        x: 9, y: 0, w: 3, h: 2, perm: "billing.day_close.create", sort: 4, refresh_ms: Some(120000),
    },
    WidgetDef {
        wtype: "data_table", title: "Recent Payments", subtitle: "Latest payment transactions",
        icon: "IconCash", color: "green",
        config: r#"{"max_rows": 10, "columns": ["patient_name", "amount", "method", "received_at"]}"#,
        data_source: r#"{"type": "module_query", "module": "billing", "query": "revenue_summary"}"#,
        x: 0, y: 2, w: 6, h: 4, perm: "billing.invoices.list", sort: 5, refresh_ms: Some(30000),
    },
    WidgetDef {
        wtype: "chart", title: "Revenue Trend", subtitle: "Revenue trend this week",
        icon: "IconTrendingUp", color: "green",
        config: r#"{"chart_type": "line", "x_axis": "date", "y_axis": "amount"}"#,
        data_source: r#"{"type": "module_query", "module": "billing", "query": "revenue_summary"}"#,
        x: 6, y: 2, w: 6, h: 4, perm: "billing.reports.view", sort: 6, refresh_ms: None,
    },
    WidgetDef {
        wtype: "quick_actions", title: "Quick Actions", subtitle: "Billing shortcuts",
        icon: "IconRocket", color: "violet",
        config: r#"{"actions": [{"label": "New Invoice", "icon": "IconReceipt", "route": "/billing?action=new", "permission": "billing.invoices.create"},{"label": "Record Payment", "icon": "IconCash", "route": "/billing?tab=payments", "permission": "billing.payments.create"},{"label": "Day Close", "icon": "IconCalendarCheck", "route": "/billing?tab=dayclose", "permission": "billing.day_close.create"},{"label": "Advance", "icon": "IconWallet", "route": "/billing?tab=advances", "permission": "billing.advances.create"}]}"#,
        data_source: r#"{"type": "static"}"#,
        x: 0, y: 6, w: 12, h: 2, perm: "dashboard.view", sort: 7, refresh_ms: None,
    },
];

// ── Facilities Manager Dashboard ──────────────────────────────

const FACILITIES_WIDGETS: &[WidgetDef] = &[
    WidgetDef {
        wtype: "stat_card", title: "Open Work Orders", subtitle: "Active work orders",
        icon: "IconTool", color: "orange",
        config: r#"{"format": "number"}"#,
        data_source: r#"{"type": "module_query", "module": "facilities", "query": "open_work_orders"}"#,
        x: 0, y: 0, w: 3, h: 2, perm: "facilities.work_orders.list", sort: 1, refresh_ms: Some(60000),
    },
    WidgetDef {
        wtype: "stat_card", title: "Pending Indents", subtitle: "Indents awaiting approval",
        icon: "IconFileText", color: "blue",
        config: r#"{"format": "number"}"#,
        data_source: r#"{"type": "module_query", "module": "billing", "query": "pending_invoices"}"#,
        x: 3, y: 0, w: 3, h: 2, perm: "indent.list", sort: 2, refresh_ms: Some(60000),
    },
    WidgetDef {
        wtype: "stat_card", title: "Bed Occupancy", subtitle: "Current bed occupancy",
        icon: "IconBed", color: "indigo",
        config: r#"{"format": "number"}"#,
        data_source: r#"{"type": "module_query", "module": "ipd", "query": "occupied_beds"}"#,
        x: 6, y: 0, w: 3, h: 2, perm: "ipd.bed_dashboard.view", sort: 3, refresh_ms: None,
    },
    WidgetDef {
        wtype: "stat_card", title: "Staff on Duty", subtitle: "Employees checked in today",
        icon: "IconUsers", color: "teal",
        config: r#"{"format": "number"}"#,
        data_source: r#"{"type": "module_query", "module": "system", "query": "staff_on_duty"}"#,
        x: 9, y: 0, w: 3, h: 2, perm: "hr.attendance.list", sort: 4, refresh_ms: Some(300000),
    },
    WidgetDef {
        wtype: "list", title: "Equipment PM Due", subtitle: "Preventive maintenance due within 7 days",
        icon: "IconSettings", color: "red",
        config: r#"{"max_items": 10, "show_timestamp": true, "show_icon": true}"#,
        data_source: r#"{"type": "module_query", "module": "facilities", "query": "equipment_pm_due"}"#,
        x: 0, y: 2, w: 6, h: 4, perm: "bme.pm.list", sort: 5, refresh_ms: Some(300000),
    },
    WidgetDef {
        wtype: "list", title: "Compliance Alerts", subtitle: "Expiring licenses and compliance items",
        icon: "IconAlertTriangle", color: "yellow",
        config: r#"{"max_items": 8, "show_timestamp": true, "show_icon": true}"#,
        data_source: r#"{"type": "module_query", "module": "facilities", "query": "equipment_pm_due"}"#,
        x: 6, y: 2, w: 6, h: 4, perm: "facilities.compliance.list", sort: 6, refresh_ms: Some(300000),
    },
    WidgetDef {
        wtype: "quick_actions", title: "Quick Actions", subtitle: "Facilities shortcuts",
        icon: "IconRocket", color: "violet",
        config: r#"{"actions": [{"label": "New Work Order", "icon": "IconTool", "route": "/facilities?tab=work-orders&action=new", "permission": "facilities.work_orders.create"},{"label": "Approve Indent", "icon": "IconFileCheck", "route": "/indent?tab=approvals", "permission": "indent.approve"},{"label": "Equipment", "icon": "IconSettings", "route": "/bme", "permission": "bme.equipment.list"},{"label": "Fire Safety", "icon": "IconFlame", "route": "/facilities?tab=fire", "permission": "facilities.fire.list"}]}"#,
        data_source: r#"{"type": "static"}"#,
        x: 0, y: 6, w: 12, h: 2, perm: "dashboard.view", sort: 7, refresh_ms: None,
    },
];

// ── Hospital Admin/CEO Dashboard ──────────────────────────────

const ADMIN_WIDGETS: &[WidgetDef] = &[
    WidgetDef {
        wtype: "stat_card", title: "Revenue MTD", subtitle: "Month-to-date revenue",
        icon: "IconTrendingUp", color: "green",
        config: r#"{"format": "currency"}"#,
        data_source: r#"{"type": "module_query", "module": "billing", "query": "revenue_mtd"}"#,
        x: 0, y: 0, w: 3, h: 2, perm: "billing.reports.view", sort: 1, refresh_ms: Some(300000),
    },
    WidgetDef {
        wtype: "stat_card", title: "Bed Occupancy", subtitle: "Current bed occupancy",
        icon: "IconBed", color: "indigo",
        config: r#"{"format": "number"}"#,
        data_source: r#"{"type": "module_query", "module": "ipd", "query": "occupied_beds"}"#,
        x: 3, y: 0, w: 3, h: 2, perm: "ipd.admissions.list", sort: 2, refresh_ms: Some(60000),
    },
    WidgetDef {
        wtype: "stat_card", title: "Staff on Duty", subtitle: "Employees checked in today",
        icon: "IconUsers", color: "teal",
        config: r#"{"format": "number"}"#,
        data_source: r#"{"type": "module_query", "module": "system", "query": "staff_on_duty"}"#,
        x: 6, y: 0, w: 3, h: 2, perm: "dashboard.view", sort: 3, refresh_ms: Some(300000),
    },
    WidgetDef {
        wtype: "stat_card", title: "Total Patients", subtitle: "Registered patients",
        icon: "IconUsers", color: "blue",
        config: r#"{"format": "number"}"#,
        data_source: r#"{"type": "sql_count", "table": "patients"}"#,
        x: 9, y: 0, w: 3, h: 2, perm: "patients.list", sort: 4, refresh_ms: None,
    },
    WidgetDef {
        wtype: "data_table", title: "OPD Queue", subtitle: "Current OPD waiting list",
        icon: "IconList", color: "teal",
        config: r#"{"max_rows": 10, "columns": ["token_number", "patient_name", "department", "status"]}"#,
        data_source: r#"{"type": "api", "endpoint": "/api/opd/queue", "params": {"status": "waiting"}}"#,
        x: 0, y: 2, w: 6, h: 4, perm: "opd.queue.list", sort: 5, refresh_ms: Some(15000),
    },
    WidgetDef {
        wtype: "data_table", title: "Recent Admissions", subtitle: "Latest IPD admissions",
        icon: "IconBed", color: "orange",
        config: r#"{"max_rows": 10, "columns": ["patient_name", "department", "bed", "admitted_at"]}"#,
        data_source: r#"{"type": "api", "endpoint": "/api/ipd/admissions", "params": {"limit": 10}}"#,
        x: 6, y: 2, w: 6, h: 4, perm: "ipd.admissions.list", sort: 6, refresh_ms: None,
    },
    WidgetDef {
        wtype: "chart", title: "Revenue This Month", subtitle: "Monthly billing trend",
        icon: "IconCoin", color: "green",
        config: r#"{"chart_type": "bar", "x_axis": "date", "y_axis": "amount"}"#,
        data_source: r#"{"type": "module_query", "module": "billing", "query": "revenue_summary"}"#,
        x: 0, y: 6, w: 6, h: 3, perm: "billing.reports.view", sort: 7, refresh_ms: None,
    },
    WidgetDef {
        wtype: "system_health", title: "System Health", subtitle: "API and database health",
        icon: "IconServer", color: "green",
        config: r"{}",
        data_source: r#"{"type": "module_query", "module": "system", "query": "health_check"}"#,
        x: 6, y: 6, w: 6, h: 3, perm: "dashboard.view", sort: 8, refresh_ms: Some(60000),
    },
];

// ── All Role Dashboards ───────────────────────────────────────

const ROLE_DASHBOARDS: &[RoleDashboard] = &[
    RoleDashboard {
        code: "role-doctor",
        name: "Doctor Dashboard",
        description: "Clinical dashboard — your patients, OPD queue, lab results, appointments",
        role_codes: r#"["doctor"]"#,
        widgets: DOCTOR_WIDGETS,
    },
    RoleDashboard {
        code: "role-nurse",
        name: "Nurse Dashboard",
        description: "Nursing dashboard — ward patients, medications, bed status",
        role_codes: r#"["nurse"]"#,
        widgets: NURSE_WIDGETS,
    },
    RoleDashboard {
        code: "role-receptionist",
        name: "Receptionist Dashboard",
        description: "Front desk — registrations, OPD queue, appointments, payments",
        role_codes: r#"["receptionist"]"#,
        widgets: RECEPTIONIST_WIDGETS,
    },
    RoleDashboard {
        code: "role-lab-tech",
        name: "Lab Technician Dashboard",
        description: "Lab operations — pending samples, QC, TAT, phlebotomy",
        role_codes: r#"["lab_technician"]"#,
        widgets: LAB_TECH_WIDGETS,
    },
    RoleDashboard {
        code: "role-pharmacist",
        name: "Pharmacist Dashboard",
        description: "Pharmacy — pending prescriptions, stock alerts, NDPS register",
        role_codes: r#"["pharmacist"]"#,
        widgets: PHARMACIST_WIDGETS,
    },
    RoleDashboard {
        code: "role-billing-clerk",
        name: "Billing Clerk Dashboard",
        description: "Billing — revenue, collections, pending invoices, day close",
        role_codes: r#"["billing_clerk"]"#,
        widgets: BILLING_WIDGETS,
    },
    RoleDashboard {
        code: "role-facilities",
        name: "Facilities Manager Dashboard",
        description: "Facilities — work orders, equipment PM, indents, compliance",
        role_codes: r#"["facilities_manager"]"#,
        widgets: FACILITIES_WIDGETS,
    },
    RoleDashboard {
        code: "role-admin",
        name: "Hospital Admin Dashboard",
        description: "Executive overview — revenue, occupancy, staff, system health",
        role_codes: r#"["hospital_admin"]"#,
        widgets: ADMIN_WIDGETS,
    },
];

async fn insert_widgets(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    dashboard_id: uuid::Uuid,
    widgets: &[WidgetDef],
) -> Result<(), Box<dyn std::error::Error>> {
    for wd in widgets {
        sqlx::query(
            "INSERT INTO dashboard_widgets \
             (dashboard_id, widget_type, title, subtitle, icon, color, config, data_source, \
              position_x, position_y, width, height, permission_code, sort_order, refresh_interval) \
             VALUES ($1, $2::widget_type, $3, $4, $5, $6, $7::jsonb, $8::jsonb, \
                     $9, $10, $11, $12, $13, $14, $15)",
        )
        .bind(dashboard_id)
        .bind(wd.wtype)
        .bind(wd.title)
        .bind(wd.subtitle)
        .bind(wd.icon)
        .bind(wd.color)
        .bind(wd.config)
        .bind(wd.data_source)
        .bind(wd.x)
        .bind(wd.y)
        .bind(wd.w)
        .bind(wd.h)
        .bind(wd.perm)
        .bind(wd.sort)
        .bind(wd.refresh_ms)
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}

/// Seed role-specific dashboards with tailored widgets per role.
/// Idempotent — skips dashboards whose code already exists.
pub(super) async fn seed_role_dashboards(
    pool: &PgPool,
    tenant_id: uuid::Uuid,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut tx = pool.begin().await?;

    sqlx::query("SELECT set_config('app.tenant_id', $1::text, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await?;

    for rd in ROLE_DASHBOARDS {
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM dashboards WHERE tenant_id = $1 AND code = $2)",
        )
        .bind(tenant_id)
        .bind(rd.code)
        .fetch_one(&mut *tx)
        .await?;

        if exists {
            tracing::debug!(code = rd.code, "Role dashboard already exists, skipping");
            continue;
        }

        let dashboard_id: uuid::Uuid = sqlx::query_scalar(
            "INSERT INTO dashboards (tenant_id, code, name, description, is_default, role_codes, layout_config) \
             VALUES ($1, $2, $3, $4, false, $5::jsonb, \
             '{\"columns\": 12, \"row_height\": 80, \"gap\": 16}'::jsonb) \
             RETURNING id",
        )
        .bind(tenant_id)
        .bind(rd.code)
        .bind(rd.name)
        .bind(rd.description)
        .bind(rd.role_codes)
        .fetch_one(&mut *tx)
        .await?;

        insert_widgets(&mut tx, dashboard_id, rd.widgets).await?;

        tracing::info!(
            code = rd.code,
            widgets = rd.widgets.len(),
            "Seeded role dashboard"
        );
    }

    tx.commit().await?;
    Ok(())
}
