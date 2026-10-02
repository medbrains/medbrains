//! Code-first widget registry → catalogue sync.
//!
//! Dashboard widgets are developed in code, not in a no-code builder. This is the
//! single source of truth for the **catalogue** (`widget_templates`) — the list of
//! widgets an admin can place on a dashboard. Add a `WidgetSpec` here and it is
//! registered automatically on boot; remove one and it disappears.
//!
//! Rendering is the matching half: `widget_type` is dispatched by
//! `DashboardWidgetCard` on the web client. A new widget of an existing type needs
//! no frontend change; a new *type* needs a new render arm there.

use sqlx::PgPool;

/// One registered widget. Kept intentionally small — config/data_source are the
/// only flexible parts. `data_source` types: `sql_count` | `module_query` |
/// `static` (see routes/dashboard.rs::resolve_widget_data).
struct WidgetSpec {
    /// Stable key: what a placed widget points back to. Never reuse one.
    code: &'static str,
    name: &'static str,
    description: &'static str,
    wtype: &'static str,
    icon: &'static str,
    color: &'static str,
    config: &'static str,
    data_source: &'static str,
    width: i32,
    height: i32,
    category: &'static str,
    /// Permission required to see/place the widget ("" = none).
    perm: &'static str,
}

/// THE registry. Add a widget here → it appears in the catalogue on next boot.
const CATALOG: &[WidgetSpec] = &[
    WidgetSpec {
        code: "total_patients",
        name: "Total Patients",
        description: "Count of registered patients",
        wtype: "stat_card",
        icon: "IconUsers",
        color: "primary",
        config: r#"{"format": "number"}"#,
        data_source: r#"{"type": "sql_count", "table": "patients"}"#,
        width: 3,
        height: 2,
        category: "metrics",
        perm: "patients.list",
    },
    WidgetSpec {
        code: "opd_today_count",
        name: "Today's OPD",
        description: "OPD encounters created today",
        wtype: "stat_card",
        icon: "IconStethoscope",
        color: "primary",
        config: r#"{"format": "number"}"#,
        data_source:
            r#"{"type": "sql_count", "table": "encounters", "filter": "DATE(encounter_date) = CURRENT_DATE"}"#,
        width: 3,
        height: 2,
        category: "metrics",
        perm: "opd.queue.view",
    },
    WidgetSpec {
        code: "pending_lab_orders",
        name: "Pending Lab Orders",
        description: "Lab orders awaiting result",
        wtype: "stat_card",
        icon: "IconFlask",
        color: "warning",
        config: r#"{"format": "number"}"#,
        data_source:
            r#"{"type": "sql_count", "table": "lab_orders", "filter": "status IN ('ordered','sample_collected')"}"#,
        width: 3,
        height: 2,
        category: "metrics",
        perm: "lab.orders.list",
    },
    WidgetSpec {
        code: "active_admissions",
        name: "Active Admissions",
        description: "Currently admitted patients",
        wtype: "stat_card",
        icon: "IconBed",
        color: "primary",
        config: r#"{"format": "number"}"#,
        data_source: r#"{"type": "sql_count", "table": "admissions", "filter": "status = 'admitted'"}"#,
        width: 3,
        height: 2,
        category: "metrics",
        perm: "ipd.admissions.list",
    },
    WidgetSpec {
        code: "revenue_today",
        name: "Revenue (Today)",
        description: "Billing collected today",
        wtype: "stat_card",
        icon: "IconCash",
        color: "primary",
        // `sensitive` gates the amount on billing.amount field-access (PR3).
        config: r#"{"format": "currency", "sensitive": {"value": "billing.amount"}}"#,
        data_source: r#"{"type": "module_query", "module": "billing", "query": "today_revenue"}"#,
        width: 3,
        height: 2,
        category: "metrics",
        perm: "billing.invoices.list",
    },
    WidgetSpec {
        code: "recent_lab_results",
        name: "Recent Lab Results",
        description: "Latest resulted lab orders",
        wtype: "list",
        icon: "IconList",
        color: "primary",
        config: r#"{"max_items": 8, "show_timestamp": true}"#,
        data_source:
            r#"{"type": "module_query", "module": "lab", "query": "recent_results", "params": {"limit": 8}}"#,
        width: 4,
        height: 3,
        category: "data",
        perm: "lab.results.list",
    },
    WidgetSpec {
        code: "system_health",
        name: "System Health",
        description: "Service status",
        wtype: "system_health",
        icon: "IconServer",
        color: "neutral",
        config: r#"{}"#,
        data_source: r#"{"type": "static", "static_data": {"status": "ok"}}"#,
        width: 4,
        height: 2,
        category: "system",
        perm: "",
    },
    WidgetSpec {
        code: "doctor_documentation",
        name: "Documentation by doctor",
        description: "OPD, last 7 days — least complete first",
        wtype: "data_table",
        icon: "IconFileCheck",
        color: "indigo",
        config: r#"{"max_rows": 10, "columns": ["doctor", "visits", "coded_pct", "note_pct", "left_open"], "labels": {"doctor": "Doctor", "visits": "Visits", "coded_pct": "Coded diagnosis %", "note_pct": "Complete note %", "left_open": "Left open"}}"#,
        data_source: r#"{"type": "module_query", "module": "management", "query": "doctor_documentation"}"#,
        width: 12,
        height: 4,
        category: "Doctors' documentation",
        perm: "analytics.management.view",
    },
    WidgetSpec {
        code: "revenue_30d",
        name: "Revenue, last 30 days",
        description: "Billed per day",
        wtype: "chart",
        icon: "IconCoin",
        color: "green",
        config: r#"{"chart_type": "bar", "x_axis": "date", "y_axis": "revenue", "sensitive": {"revenue": "billing.amount"}}"#,
        data_source: r#"{"type": "module_query", "module": "billing", "query": "revenue_trend"}"#,
        width: 6,
        height: 3,
        category: "Finance",
        perm: "billing.reports.view",
    },
    WidgetSpec {
        code: "opd_queue_table",
        name: "OPD queue",
        description: "Today's tokens with their doctor",
        wtype: "data_table",
        icon: "IconList",
        color: "blue",
        config: r#"{"max_rows": 10, "columns": ["token_no", "patient_name", "doctor_name", "status"]}"#,
        data_source: r#"{"type": "module_query", "module": "opd", "query": "active_tokens", "params": {"limit": 10}}"#,
        width: 6,
        height: 4,
        category: "OPD",
        perm: "opd.queue.list",
    },
    WidgetSpec {
        code: "recent_admissions",
        name: "Recent admissions",
        description: "Latest IPD admissions",
        wtype: "data_table",
        icon: "IconBed",
        color: "orange",
        config: r#"{"max_rows": 10, "columns": ["patient_name", "department", "bed", "admitted_at"]}"#,
        data_source: r#"{"type": "module_query", "module": "ipd", "query": "recent_admissions", "params": {"limit": 10}}"#,
        width: 6,
        height: 4,
        category: "IPD",
        perm: "ipd.admissions.list",
    },
];

/// The management KPIs (`medbrains-dashboard::management_kpis`), each a stat
/// card read against the usual day: `(code, name, description, category, icon)`.
/// Code doubles as the KPI code the widget's data source names.
const KPI_WIDGETS: &[(&str, &str, &str, &str, &str)] = &[
    ("opd_visits", "OPD visits", "Against the usual day", "OPD", "IconStethoscope"),
    ("opd_wait_minutes", "Median wait", "Token issued to called", "OPD", "IconClock"),
    ("opd_consult_minutes", "Median consult time", "Called to completed", "OPD", "IconClipboardCheck"),
    ("appointment_no_show_pct", "Appointment no-shows", "Of appointments with an outcome", "OPD", "IconCalendar"),
    ("coded_diagnosis_pct", "Coded diagnosis", "OPD visits with an ICD code, 7 days", "Doctors' documentation", "IconFileCheck"),
    ("complete_note_pct", "Complete notes", "Complaint and examination recorded, 7 days", "Doctors' documentation", "IconClipboardCheck"),
    ("visits_left_open_pct", "Visits left open", "Not closed after their day, 7 days", "Doctors' documentation", "IconAlertTriangle"),
    ("opd_unbilled_pct", "Visits with no bill", "OPD visits never invoiced, 7 days", "Department efficiency", "IconReceipt"),
    ("billing_lag_hours", "Billing lag", "Visit to invoice issued", "Department efficiency", "IconCash"),
    ("pharmacy_wait_minutes", "Pharmacy wait", "Token issued to called", "Department efficiency", "IconPill"),
    ("lab_tat_minutes", "Lab turnaround", "Sample collected to verified", "Department efficiency", "IconFlask"),
    ("lab_within_target_pct", "Lab within target", "Verified within the test's turnaround, 7 days", "Department efficiency", "IconClock"),
    ("bed_turnaround_minutes", "Bed turnaround", "Vacated to ready for the next patient", "Department efficiency", "IconBed"),
    ("bed_occupancy_pct", "Bed occupancy", "Patients in beds over beds in service", "IPD", "IconBed"),
    ("alos_days", "Average length of stay", "Bed-days per discharge, 7 days", "IPD", "IconBed"),
    ("mortality_pct", "Mortality", "Deaths among discharges, 7 days", "IPD", "IconHeartbeat"),
    ("readmission_30d_pct", "Readmissions", "Back within 30 days of discharge, 7 days", "IPD", "IconArrowsTransferDown"),
    ("lama_dama_pct", "Left against advice", "LAMA, DAMA or absconded, 7 days", "IPD", "IconAlertTriangle"),
];
/// Who may place or see a management KPI.
const KPI_PERMISSION: &str = "analytics.management.view";

struct Template {
    code: String,
    name: String,
    description: String,
    wtype: String,
    icon: String,
    color: String,
    config: String,
    data_source: String,
    width: i32,
    height: i32,
    category: String,
    perm: String,
}

/// The whole catalogue: the specs, then one stat card per management KPI.
fn templates() -> Vec<Template> {
    let specs = CATALOG.iter().map(|w| Template {
        code: w.code.to_owned(),
        name: w.name.to_owned(),
        description: w.description.to_owned(),
        wtype: w.wtype.to_owned(),
        icon: w.icon.to_owned(),
        color: w.color.to_owned(),
        config: w.config.to_owned(),
        data_source: w.data_source.to_owned(),
        width: w.width,
        height: w.height,
        category: w.category.to_owned(),
        perm: w.perm.to_owned(),
    });
    let kpis = KPI_WIDGETS.iter().map(|&(code, name, description, category, icon)| Template {
        code: code.to_owned(),
        name: name.to_owned(),
        description: description.to_owned(),
        wtype: "stat_card".to_owned(),
        icon: icon.to_owned(),
        color: "indigo".to_owned(),
        config: "{}".to_owned(),
        data_source: serde_json::json!({
            "type": "module_query", "module": "management", "query": "kpi",
            "params": { "code": code },
        })
        .to_string(),
        width: 3,
        height: 2,
        category: category.to_owned(),
        perm: KPI_PERMISSION.to_owned(),
    });
    specs.chain(kpis).collect()
}

/// Sync the code registry into `widget_templates` (global, `is_system`).
///
/// Code is the source of truth. Entries upsert by `code`, so a template keeps
/// its id across boots; one no longer in code is removed. A widget already
/// on a dashboard with a template's exact data source is linked back to it,
/// so the dashboard's widget menu shows it as placed. Idempotent.
pub(crate) async fn sync_widget_catalog(pool: &PgPool) -> Result<(), sqlx::Error> {
    let templates = templates();
    let mut tx = pool.begin().await?;
    for w in &templates {
        let perms = if w.perm.is_empty() {
            serde_json::json!([])
        } else {
            serde_json::json!([w.perm])
        };
        sqlx::query(
            "INSERT INTO widget_templates
                (tenant_id, code, name, description, widget_type, icon, color,
                 default_config, default_source, default_width, default_height,
                 category, is_system, required_permissions, required_departments)
             VALUES (NULL, $1, $2, $3, $4::widget_type, $5, $6,
                 $7::jsonb, $8::jsonb, $9, $10, $11, true, $12::jsonb, '[]'::jsonb)
             ON CONFLICT (code) WHERE tenant_id IS NULL AND deleted_at IS NULL DO UPDATE SET
                 name = EXCLUDED.name, description = EXCLUDED.description,
                 widget_type = EXCLUDED.widget_type, icon = EXCLUDED.icon,
                 color = EXCLUDED.color, default_config = EXCLUDED.default_config,
                 default_source = EXCLUDED.default_source,
                 default_width = EXCLUDED.default_width,
                 default_height = EXCLUDED.default_height, category = EXCLUDED.category,
                 required_permissions = EXCLUDED.required_permissions",
        )
        .bind(&w.code)
        .bind(&w.name)
        .bind(&w.description)
        .bind(&w.wtype)
        .bind(&w.icon)
        .bind(&w.color)
        .bind(&w.config)
        .bind(&w.data_source)
        .bind(w.width)
        .bind(w.height)
        .bind(&w.category)
        .bind(&perms)
        .execute(&mut *tx)
        .await?;
    }
    let codes: Vec<&str> = templates.iter().map(|t| t.code.as_str()).collect();
    sqlx::query(
        "DELETE FROM widget_templates \
          WHERE is_system AND tenant_id IS NULL AND (code IS NULL OR code <> ALL($1))",
    )
    .bind(&codes)
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "UPDATE dashboard_widgets w SET template_code = t.code \
           FROM widget_templates t \
          WHERE w.template_code IS NULL AND w.deleted_at IS NULL \
            AND t.tenant_id IS NULL AND t.code IS NOT NULL \
            AND w.data_source = t.default_source",
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    tracing::info!(count = templates.len(), "widget catalogue synced from code registry");
    Ok(())
}
