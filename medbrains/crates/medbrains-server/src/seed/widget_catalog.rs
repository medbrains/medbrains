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
];

/// Sync the code registry into `widget_templates` (global, `is_system`). Code is
/// the source of truth: system templates are cleared and re-inserted, so adding
/// or removing a `WidgetSpec` is reflected on the next boot. Idempotent.
pub(crate) async fn sync_widget_catalog(pool: &PgPool) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;
    sqlx::query("DELETE FROM widget_templates WHERE is_system = true AND tenant_id IS NULL")
        .execute(&mut *tx)
        .await?;
    for w in CATALOG {
        let perms = if w.perm.is_empty() {
            serde_json::json!([])
        } else {
            serde_json::json!([w.perm])
        };
        sqlx::query(
            "INSERT INTO widget_templates
                (tenant_id, name, description, widget_type, icon, color,
                 default_config, default_source, default_width, default_height,
                 category, is_system, required_permissions, required_departments)
             VALUES (NULL, $1, $2, $3::widget_type, $4, $5,
                 $6::jsonb, $7::jsonb, $8, $9, $10, true, $11::jsonb, '[]'::jsonb)",
        )
        .bind(w.name)
        .bind(w.description)
        .bind(w.wtype)
        .bind(w.icon)
        .bind(w.color)
        .bind(w.config)
        .bind(w.data_source)
        .bind(w.width)
        .bind(w.height)
        .bind(w.category)
        .bind(&perms)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    tracing::info!(count = CATALOG.len(), "widget catalogue synced from code registry");
    Ok(())
}
