use sqlx::PgPool;

/// System screen definitions — seeded as global (`tenant_id` = NULL) active screens.
///
/// Each tuple: `(code, name, description, screen_type, module_code, route_path, icon, permission_code, sort_order, layout_json)`
struct ScreenDef {
    code: &'static str,
    name: &'static str,
    description: &'static str,
    screen_type: &'static str,
    module_code: &'static str,
    route_path: &'static str,
    icon: &'static str,
    permission_code: &'static str,
    sort_order: i32,
    layout: &'static str,
}

const SCREENS: &[ScreenDef] = &[
    // ── Patients ──────────────────────────────────────────────
    ScreenDef {
        code: "patient-list",
        name: "Patient List",
        description: "Patient directory with search and filters",
        screen_type: "list",
        module_code: "registration",
        route_path: "/patients",
        icon: "IconUsers",
        permission_code: "patients.list",
        sort_order: 1,
        layout: r#"{
            "header": {"title": "Patients", "subtitle": "Patient directory", "icon": "IconUsers"},
            "actions": [
                {"key": "register", "label": "Register Patient", "icon": "IconUserPlus", "variant": "filled", "action_type": "navigate", "route": "/patients?action=new", "permission": "patients.create"}
            ],
            "zones": [
                {"type": "filter_bar", "key": "filters", "config": {"search_placeholder": "Search by name, UHID, phone...", "filters": ["category", "registration_type", "gender"]}},
                {"type": "data_table", "key": "table", "config": {"data_source": "/api/patients", "columns": ["uhid", "full_name", "gender", "date_of_birth", "phone", "category", "created_at"], "row_actions": ["view", "edit"]}}
            ]
        }"#,
    },
    ScreenDef {
        code: "patient-create",
        name: "Patient Registration",
        description: "New patient registration form",
        screen_type: "form",
        module_code: "registration",
        route_path: "/patients/new",
        icon: "IconUserPlus",
        permission_code: "patients.create",
        sort_order: 2,
        layout: r#"{
            "header": {"title": "Register Patient", "subtitle": "New patient registration", "icon": "IconUserPlus"},
            "actions": [
                {"key": "save", "label": "Save", "icon": "IconCheck", "variant": "filled", "action_type": "form_submit", "permission": "patients.create"},
                {"key": "save_quick", "label": "Quick Save", "icon": "IconBolt", "variant": "light", "action_type": "form_submit_quick", "permission": "patients.create"}
            ],
            "zones": [
                {"type": "form", "key": "registration_form", "config": {"form_code": "patient-registration", "mode": "create", "quick_mode": true}}
            ]
        }"#,
    },
    ScreenDef {
        code: "patient-detail",
        name: "Patient Profile",
        description: "Patient detail view with tabs for history, insurance, etc.",
        screen_type: "detail",
        module_code: "registration",
        route_path: "/patients/:id",
        icon: "IconUser",
        permission_code: "patients.view",
        sort_order: 3,
        layout: r#"{
            "header": {"title": "Patient Profile", "subtitle": "{{patient.full_name}} — {{patient.uhid}}", "icon": "IconUser"},
            "actions": [
                {"key": "edit", "label": "Edit", "icon": "IconPencil", "variant": "light", "action_type": "navigate", "route": "/patients/{{id}}/edit", "permission": "patients.update"}
            ],
            "zones": [
                {"type": "detail_header", "key": "header", "config": {"fields": ["uhid", "full_name", "gender", "age", "phone", "category"]}},
                {"type": "tabs", "key": "tabs", "config": {"tabs": [
                    {"key": "overview", "label": "Overview", "icon": "IconUser", "zones": [{"type": "info_panel", "key": "demographics"}]},
                    {"key": "visits", "label": "Visits", "icon": "IconStethoscope", "zones": [{"type": "data_table", "key": "encounters"}]},
                    {"key": "lab", "label": "Lab Results", "icon": "IconFlask", "zones": [{"type": "data_table", "key": "lab_orders"}]},
                    {"key": "billing", "label": "Billing", "icon": "IconReceipt", "zones": [{"type": "data_table", "key": "invoices"}]},
                    {"key": "insurance", "label": "Insurance", "icon": "IconShield", "zones": [{"type": "data_table", "key": "insurance"}]}
                ]}}
            ]
        }"#,
    },
    // ── OPD ───────────────────────────────────────────────────
    ScreenDef {
        code: "opd-queue",
        name: "OPD Queue",
        description: "OPD token queue and waiting list",
        screen_type: "list",
        module_code: "opd",
        route_path: "/opd",
        icon: "IconStethoscope",
        permission_code: "opd.queue.list",
        sort_order: 10,
        layout: r#"{
            "header": {"title": "OPD Queue", "subtitle": "Today's token queue", "icon": "IconStethoscope"},
            "actions": [
                {"key": "new_visit", "label": "New Visit", "icon": "IconPlus", "variant": "filled", "action_type": "navigate", "route": "/opd/new", "permission": "opd.visit.create"}
            ],
            "zones": [
                {"type": "filter_bar", "key": "filters", "config": {"filters": ["department", "doctor", "status"]}},
                {"type": "data_table", "key": "queue", "config": {"data_source": "/api/opd/queue", "columns": ["token_number", "patient_name", "uhid", "department", "doctor", "status", "waiting_time"], "row_actions": ["call", "start", "complete", "no_show"]}}
            ]
        }"#,
    },
    ScreenDef {
        code: "opd-consultation",
        name: "OPD Consultation",
        description: "Consultation page: vitals + notes + prescriptions + diagnoses",
        screen_type: "composite",
        module_code: "opd",
        route_path: "/opd/encounters/:id",
        icon: "IconNotes",
        permission_code: "opd.visit.update",
        sort_order: 11,
        layout: r#"{
            "header": {"title": "Consultation", "subtitle": "{{encounter.patient_name}}", "icon": "IconNotes"},
            "actions": [
                {"key": "save", "label": "Save & Complete", "icon": "IconCheck", "variant": "filled", "action_type": "form_submit", "permission": "opd.visit.update"}
            ],
            "zones": [
                {"type": "detail_header", "key": "patient_banner", "config": {"fields": ["uhid", "full_name", "age", "gender", "allergies"]}},
                {"type": "tabs", "key": "consultation_tabs", "config": {"tabs": [
                    {"key": "vitals", "label": "Vitals", "icon": "IconHeartbeat", "zones": [{"type": "form", "key": "vitals_form", "config": {"form_code": "opd-vitals", "mode": "create"}}]},
                    {"key": "notes", "label": "Consultation", "icon": "IconNotes", "zones": [{"type": "form", "key": "consultation_form", "config": {"form_code": "opd-consultation", "mode": "create"}}]},
                    {"key": "diagnosis", "label": "Diagnosis", "icon": "IconSearch", "zones": [{"type": "data_table", "key": "diagnoses"}]},
                    {"key": "prescription", "label": "Prescription", "icon": "IconPill", "zones": [{"type": "form", "key": "rx_form", "config": {"form_code": "opd-prescription", "mode": "create"}}]},
                    {"key": "history", "label": "History", "icon": "IconHistory", "zones": [{"type": "data_table", "key": "past_encounters"}]}
                ]}}
            ]
        }"#,
    },
    // ── Lab ───────────────────────────────────────────────────
    ScreenDef {
        code: "lab-orders",
        name: "Lab Orders",
        description: "Lab order listing with status filters",
        screen_type: "list",
        module_code: "lab",
        route_path: "/lab",
        icon: "IconFlask",
        permission_code: "lab.orders.list",
        sort_order: 20,
        layout: r#"{
            "header": {"title": "Lab Orders", "subtitle": "Laboratory order management", "icon": "IconFlask"},
            "actions": [
                {"key": "new_order", "label": "New Order", "icon": "IconPlus", "variant": "filled", "action_type": "navigate", "route": "/lab/new", "permission": "lab.orders.create"}
            ],
            "zones": [
                {"type": "filter_bar", "key": "filters", "config": {"filters": ["status", "priority", "test_name", "date_range"]}},
                {"type": "data_table", "key": "orders", "config": {"data_source": "/api/lab/orders", "columns": ["order_number", "patient_name", "test_name", "priority", "status", "ordered_at"], "row_actions": ["view", "collect", "process", "complete"]}}
            ]
        }"#,
    },
    ScreenDef {
        code: "lab-board",
        name: "Lab Pipeline Board",
        description: "Kanban board for lab order workflow",
        screen_type: "kanban",
        module_code: "lab",
        route_path: "/lab/board",
        icon: "IconColumns",
        permission_code: "lab.orders.list",
        sort_order: 21,
        layout: r#"{
            "header": {"title": "Lab Pipeline", "subtitle": "Order processing board", "icon": "IconColumns"},
            "zones": [
                {"type": "kanban", "key": "pipeline", "config": {"data_source": "/api/lab/orders", "columns": [
                    {"key": "ordered", "label": "Ordered", "color": "blue"},
                    {"key": "sample_collected", "label": "Collected", "color": "teal"},
                    {"key": "processing", "label": "Processing", "color": "orange"},
                    {"key": "completed", "label": "Completed", "color": "green"},
                    {"key": "verified", "label": "Verified", "color": "violet"}
                ], "card_fields": ["patient_name", "test_name", "priority"]}}
            ]
        }"#,
    },
    // ── Pharmacy ──────────────────────────────────────────────
    ScreenDef {
        code: "pharmacy-orders",
        name: "Pharmacy Orders",
        description: "Pharmacy order listing and dispensing",
        screen_type: "list",
        module_code: "pharmacy",
        route_path: "/pharmacy",
        icon: "IconPill",
        permission_code: "pharmacy.prescriptions.list",
        sort_order: 30,
        layout: r#"{
            "header": {"title": "Pharmacy Orders", "subtitle": "Prescription dispensing", "icon": "IconPill"},
            "zones": [
                {"type": "filter_bar", "key": "filters", "config": {"filters": ["status", "date_range"]}},
                {"type": "data_table", "key": "orders", "config": {"data_source": "/api/pharmacy/orders", "columns": ["order_number", "patient_name", "status", "items_count", "total_amount", "created_at"], "row_actions": ["view", "dispense", "cancel"]}}
            ]
        }"#,
    },
    ScreenDef {
        code: "pharmacy-catalog",
        name: "Drug Catalog",
        description: "Pharmacy drug catalog management",
        screen_type: "list",
        module_code: "pharmacy",
        route_path: "/pharmacy/catalog",
        icon: "IconMedicineSyrup",
        permission_code: "pharmacy.stock.manage",
        sort_order: 31,
        layout: r#"{
            "header": {"title": "Drug Catalog", "subtitle": "Manage drug inventory", "icon": "IconMedicineSyrup"},
            "actions": [
                {"key": "add", "label": "Add Drug", "icon": "IconPlus", "variant": "filled", "action_type": "modal", "permission": "pharmacy.stock.manage"}
            ],
            "zones": [
                {"type": "filter_bar", "key": "filters", "config": {"filters": ["category", "schedule", "stock_status"]}},
                {"type": "data_table", "key": "catalog", "config": {"data_source": "/api/pharmacy/catalog", "columns": ["code", "name", "generic_name", "category", "schedule", "unit_price", "current_stock"], "row_actions": ["edit"]}}
            ]
        }"#,
    },
    // ── Billing ───────────────────────────────────────────────
    ScreenDef {
        code: "billing-invoices",
        name: "Invoices",
        description: "Invoice listing with payment status",
        screen_type: "list",
        module_code: "billing",
        route_path: "/billing",
        icon: "IconReceipt",
        permission_code: "billing.invoices.list",
        sort_order: 40,
        layout: r#"{
            "header": {"title": "Invoices", "subtitle": "Billing and payments", "icon": "IconReceipt"},
            "actions": [
                {"key": "new", "label": "New Invoice", "icon": "IconPlus", "variant": "filled", "action_type": "navigate", "route": "/billing/new", "permission": "billing.invoices.create"}
            ],
            "zones": [
                {"type": "filter_bar", "key": "filters", "config": {"filters": ["status", "date_range", "payment_status"]}},
                {"type": "data_table", "key": "invoices", "config": {"data_source": "/api/billing/invoices", "columns": ["invoice_number", "patient_name", "status", "total_amount", "paid_amount", "balance", "created_at"], "row_actions": ["view", "pay", "cancel"]}}
            ]
        }"#,
    },
    ScreenDef {
        code: "billing-create",
        name: "Create Invoice",
        description: "Invoice creation with line items",
        screen_type: "form",
        module_code: "billing",
        route_path: "/billing/new",
        icon: "IconReceiptPlus",
        permission_code: "billing.invoices.create",
        sort_order: 41,
        layout: r#"{
            "header": {"title": "Create Invoice", "subtitle": "New billing invoice", "icon": "IconReceiptPlus"},
            "actions": [
                {"key": "save", "label": "Save Draft", "icon": "IconDeviceFloppy", "variant": "light", "action_type": "form_submit"},
                {"key": "issue", "label": "Save & Issue", "icon": "IconCheck", "variant": "filled", "action_type": "form_submit_issue"}
            ],
            "zones": [
                {"type": "form", "key": "invoice_form", "config": {"form_code": "billing-invoice", "mode": "create"}}
            ]
        }"#,
    },
    // ── IPD ───────────────────────────────────────────────────
    ScreenDef {
        code: "ipd-admissions",
        name: "IPD Admissions",
        description: "Inpatient admission listing",
        screen_type: "list",
        module_code: "ipd",
        route_path: "/ipd",
        icon: "IconBed",
        permission_code: "ipd.admissions.list",
        sort_order: 50,
        layout: r#"{
            "header": {"title": "IPD Admissions", "subtitle": "Inpatient management", "icon": "IconBed"},
            "actions": [
                {"key": "admit", "label": "New Admission", "icon": "IconPlus", "variant": "filled", "action_type": "navigate", "route": "/ipd/new", "permission": "ipd.admissions.create"}
            ],
            "zones": [
                {"type": "filter_bar", "key": "filters", "config": {"filters": ["status", "department", "ward"]}},
                {"type": "data_table", "key": "admissions", "config": {"data_source": "/api/ipd/admissions", "columns": ["patient_name", "uhid", "department", "bed", "admitting_doctor", "status", "admitted_at"], "row_actions": ["view", "transfer", "discharge"]}}
            ]
        }"#,
    },
    ScreenDef {
        code: "ipd-bed-board",
        name: "Bed Occupancy Board",
        description: "Visual bed management kanban",
        screen_type: "kanban",
        module_code: "ipd",
        route_path: "/ipd/beds",
        icon: "IconLayoutBoard",
        permission_code: "ipd.beds.manage",
        sort_order: 51,
        layout: r#"{
            "header": {"title": "Bed Board", "subtitle": "Bed occupancy overview", "icon": "IconLayoutBoard"},
            "zones": [
                {"type": "kanban", "key": "beds", "config": {"data_source": "/api/ipd/beds", "columns": [
                    {"key": "vacant_clean", "label": "Available", "color": "green"},
                    {"key": "occupied", "label": "Occupied", "color": "red"},
                    {"key": "reserved", "label": "Reserved", "color": "orange"},
                    {"key": "maintenance", "label": "Maintenance", "color": "gray"}
                ], "card_fields": ["bed_code", "ward", "patient_name"]}}
            ]
        }"#,
    },
    // ── Inventory / Indent ────────────────────────────────────
    ScreenDef {
        code: "indent-catalog",
        name: "Store Catalog",
        description: "Central store item catalog",
        screen_type: "list",
        module_code: "inventory",
        route_path: "/indent/catalog",
        icon: "IconPackage",
        permission_code: "indent.list",
        sort_order: 60,
        layout: r#"{
            "header": {"title": "Store Catalog", "subtitle": "Hospital consumables inventory", "icon": "IconPackage"},
            "actions": [
                {"key": "add", "label": "Add Item", "icon": "IconPlus", "variant": "filled", "action_type": "modal", "permission": "indent.stock_manage"}
            ],
            "zones": [
                {"type": "filter_bar", "key": "filters", "config": {"filters": ["category", "stock_status"]}},
                {"type": "data_table", "key": "catalog", "config": {"data_source": "/api/indent/catalog", "columns": ["code", "name", "category", "unit", "base_price", "current_stock", "reorder_level"], "row_actions": ["edit"]}}
            ]
        }"#,
    },
    ScreenDef {
        code: "indent-requisitions",
        name: "Indent Requisitions",
        description: "Department indent requests",
        screen_type: "list",
        module_code: "inventory",
        route_path: "/indent",
        icon: "IconClipboardList",
        permission_code: "indent.list",
        sort_order: 61,
        layout: r#"{
            "header": {"title": "Indent Requisitions", "subtitle": "Department supply requests", "icon": "IconClipboardList"},
            "actions": [
                {"key": "new", "label": "New Requisition", "icon": "IconPlus", "variant": "filled", "action_type": "navigate", "route": "/indent/new", "permission": "indent.create"}
            ],
            "zones": [
                {"type": "filter_bar", "key": "filters", "config": {"filters": ["status", "indent_type", "department", "priority"]}},
                {"type": "data_table", "key": "requisitions", "config": {"data_source": "/api/indent/requisitions", "columns": ["indent_number", "department", "indent_type", "priority", "status", "total_amount", "created_at"], "row_actions": ["view", "approve", "reject"]}}
            ]
        }"#,
    },
    // ── Admin ─────────────────────────────────────────────────
    ScreenDef {
        code: "admin-users",
        name: "User Management",
        description: "Manage system users and access",
        screen_type: "list",
        module_code: "admin",
        route_path: "/admin/users",
        icon: "IconUsersGroup",
        permission_code: "admin.users.list",
        sort_order: 70,
        layout: r#"{
            "header": {"title": "Users", "subtitle": "User management", "icon": "IconUsersGroup"},
            "actions": [
                {"key": "add", "label": "Add User", "icon": "IconUserPlus", "variant": "filled", "action_type": "modal", "permission": "admin.users.create"}
            ],
            "zones": [
                {"type": "filter_bar", "key": "filters", "config": {"filters": ["role", "status"]}},
                {"type": "data_table", "key": "users", "config": {"data_source": "/api/setup/users", "columns": ["username", "full_name", "email", "role", "is_active", "last_login"], "row_actions": ["edit", "permissions", "delete"]}}
            ]
        }"#,
    },
    ScreenDef {
        code: "admin-roles",
        name: "Role Management",
        description: "Manage roles and permissions",
        screen_type: "list",
        module_code: "admin",
        route_path: "/admin/roles",
        icon: "IconShield",
        permission_code: "admin.roles.list",
        sort_order: 71,
        layout: r#"{
            "header": {"title": "Roles", "subtitle": "Role and permission management", "icon": "IconShield"},
            "actions": [
                {"key": "add", "label": "Add Role", "icon": "IconPlus", "variant": "filled", "action_type": "modal", "permission": "admin.roles.create"}
            ],
            "zones": [
                {"type": "data_table", "key": "roles", "config": {"data_source": "/api/setup/roles", "columns": ["code", "name", "description", "permissions_count", "is_system"], "row_actions": ["edit", "permissions"]}}
            ]
        }"#,
    },
    ScreenDef {
        code: "admin-modules",
        name: "Module Configuration",
        description: "Enable/disable hospital modules",
        screen_type: "list",
        module_code: "admin",
        route_path: "/admin/modules",
        icon: "IconPuzzle",
        permission_code: "admin.settings.general.manage",
        sort_order: 72,
        layout: r#"{
            "header": {"title": "Modules", "subtitle": "Module configuration", "icon": "IconPuzzle"},
            "zones": [
                {"type": "data_table", "key": "modules", "config": {"data_source": "/api/setup/modules", "columns": ["code", "name", "description", "status", "depends_on"], "row_actions": ["toggle"]}}
            ]
        }"#,
    },
    ScreenDef {
        code: "admin-locations",
        name: "Location Hierarchy",
        description: "Hospital location tree management",
        screen_type: "list",
        module_code: "admin",
        route_path: "/admin/locations",
        icon: "IconBuildingHospital",
        permission_code: "admin.settings.general.manage",
        sort_order: 73,
        layout: r#"{
            "header": {"title": "Locations", "subtitle": "Hospital location hierarchy", "icon": "IconBuildingHospital"},
            "actions": [
                {"key": "add", "label": "Add Location", "icon": "IconPlus", "variant": "filled", "action_type": "modal", "permission": "admin.settings.general.manage"}
            ],
            "zones": [
                {"type": "data_table", "key": "locations", "config": {"data_source": "/api/setup/locations", "columns": ["code", "name", "level", "parent_name", "is_active"], "row_actions": ["edit", "add_child", "delete"]}}
            ]
        }"#,
    },
    // ── Dashboard ─────────────────────────────────────────────
    ScreenDef {
        code: "main-dashboard",
        name: "Hospital Dashboard",
        description: "Default dashboard layout with key metrics",
        screen_type: "dashboard",
        module_code: "dashboard",
        route_path: "/dashboard",
        icon: "IconDashboard",
        permission_code: "dashboard.view",
        sort_order: 0,
        layout: r#"{
            "header": {"title": "Dashboard", "subtitle": "Hospital overview", "icon": "IconDashboard"},
            "zones": [
                {"type": "widget_grid", "key": "dashboard", "config": {"dashboard_code": "default-main"}}
            ]
        }"#,
    },
];

/// Seed system screen definitions.
/// Idempotent — skips screens that already exist (by code where `tenant_id` IS NULL).
pub(super) async fn seed_screens(pool: &PgPool) -> Result<(), Box<dyn std::error::Error>> {
    for screen in SCREENS {
        sqlx::query(
            "INSERT INTO screen_masters \
             (tenant_id, code, name, description, screen_type, module_code, status, \
              route_path, icon, permission_code, is_system, is_active, sort_order, layout, version, published_at) \
             VALUES (NULL, $1, $2, $3, $4::screen_type, $5, 'active'::form_status, \
                     $6, $7, $8, true, true, $9, $10::jsonb, 1, now()) \
             ON CONFLICT DO NOTHING",
        )
        .bind(screen.code)
        .bind(screen.name)
        .bind(screen.description)
        .bind(screen.screen_type)
        .bind(screen.module_code)
        .bind(screen.route_path)
        .bind(screen.icon)
        .bind(screen.permission_code)
        .bind(screen.sort_order)
        .bind(screen.layout)
        .execute(pool)
        .await?;
    }

    tracing::info!("Seeded {} system screen definitions", SCREENS.len());
    Ok(())
}
