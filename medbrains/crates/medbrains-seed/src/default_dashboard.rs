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
}

const WIDGETS: &[WidgetDef] = &[
    WidgetDef {
        wtype: "stat_card",
        title: "New patients",
        subtitle: "Registered today, against the usual day",
        icon: "IconUsers",
        color: "blue",
        config: r#"{"format": "number"}"#,
        data_source: r#"{"type": "module_query", "module": "management", "query": "kpi", "params": {"code": "patient_registrations"}}"#,
        x: 0,
        y: 0,
        w: 3,
        h: 2,
        perm: "patients.list",
        sort: 1,
    },
    WidgetDef {
        wtype: "stat_card",
        title: "Today's OPD",
        subtitle: "OPD visits, against the usual day",
        icon: "IconStethoscope",
        color: "teal",
        config: r#"{"format": "number"}"#,
        data_source: r#"{"type": "module_query", "module": "management", "query": "kpi", "params": {"code": "opd_visits"}}"#,
        x: 3,
        y: 0,
        w: 3,
        h: 2,
        perm: "opd.queue.list",
        sort: 2,
    },
    WidgetDef {
        wtype: "stat_card",
        title: "Active Admissions",
        subtitle: "Current IPD patients",
        icon: "IconBed",
        color: "orange",
        config: r#"{"format": "number"}"#,
        data_source: r#"{"type": "sql_count", "table": "admissions", "filter": "status = 'admitted'"}"#,
        x: 6,
        y: 0,
        w: 3,
        h: 2,
        perm: "ipd.admissions.list",
        sort: 3,
    },
    WidgetDef {
        wtype: "stat_card",
        title: "Pending Lab Orders",
        subtitle: "Unprocessed lab orders",
        icon: "IconFlask",
        color: "red",
        config: r#"{"format": "number"}"#,
        data_source: r#"{"type": "sql_count", "table": "lab_orders", "filter": "status IN ('ordered','sample_collected')"}"#,
        x: 9,
        y: 0,
        w: 3,
        h: 2,
        perm: "lab.orders.list",
        sort: 4,
    },
    WidgetDef {
        wtype: "data_table",
        title: "OPD Queue",
        subtitle: "Current OPD waiting list",
        icon: "IconList",
        color: "blue",
        config: r#"{"max_rows": 10, "columns": ["token_no", "patient_name", "doctor_name", "status"]}"#,
        data_source: r#"{"type": "module_query", "module": "opd", "query": "active_tokens", "params": {"limit": 10}}"#,
        x: 0,
        y: 2,
        w: 6,
        h: 4,
        perm: "opd.queue.list",
        sort: 5,
    },
    WidgetDef {
        wtype: "data_table",
        title: "Recent Admissions",
        subtitle: "Last 10 IPD admissions",
        icon: "IconBed",
        color: "orange",
        config: r#"{"max_rows": 10, "columns": ["patient_name", "department", "bed", "admitted_at"]}"#,
        data_source: r#"{"type": "module_query", "module": "ipd", "query": "recent_admissions", "params": {"limit": 10}}"#,
        x: 6,
        y: 2,
        w: 6,
        h: 4,
        perm: "ipd.admissions.list",
        sort: 6,
    },
    WidgetDef {
        wtype: "chart",
        title: "Revenue, last 30 days",
        subtitle: "Billed per day",
        icon: "IconCoin",
        color: "green",
        config: r#"{"chart_type": "bar", "x_axis": "date", "y_axis": "revenue", "sensitive": {"revenue": "billing.amount"}}"#,
        data_source: r#"{"type": "module_query", "module": "billing", "query": "revenue_trend"}"#,
        x: 0,
        y: 6,
        w: 6,
        h: 3,
        perm: "billing.invoices.list",
        sort: 7,
    },
    WidgetDef {
        wtype: "quick_actions",
        title: "Quick Actions",
        subtitle: "Frequently used actions",
        icon: "IconRocket",
        color: "violet",
        config: r#"{"actions": [{"label": "Register Patient", "icon": "IconUserPlus", "route": "/patients?action=new", "permission": "patients.create"},{"label": "New OPD Visit", "icon": "IconStethoscope", "route": "/opd?action=new", "permission": "opd.visit.create"},{"label": "Create Invoice", "icon": "IconReceipt", "route": "/billing?action=new", "permission": "billing.invoices.create"},{"label": "Lab Order", "icon": "IconFlask", "route": "/lab?action=new", "permission": "lab.orders.create"}]}"#,
        data_source: r#"{"type": "static"}"#,
        x: 6,
        y: 6,
        w: 6,
        h: 3,
        perm: "dashboard.view",
        sort: 8,
    },
];

async fn insert_widgets(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    dashboard_id: uuid::Uuid,
) -> Result<(), Box<dyn std::error::Error>> {
    for wd in WIDGETS {
        sqlx::query(
            "INSERT INTO dashboard_widgets \
             (dashboard_id, widget_type, title, subtitle, icon, color, config, data_source, \
              position_x, position_y, width, height, permission_code, sort_order) \
             VALUES ($1, $2::widget_type, $3, $4, $5, $6, $7::jsonb, $8::jsonb, \
                     $9, $10, $11, $12, $13, $14)",
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
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}

/// Seed a default dashboard with 8 widgets for the DEFAULT tenant.
/// Idempotent — skips if dashboard code already exists.
pub(super) async fn seed_default_dashboard(
    pool: &PgPool,
    tenant_id: uuid::Uuid,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut tx = pool.begin().await?;

    sqlx::query("SELECT set_config('app.tenant_id', $1::text, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await?;

    // ON CONFLICT, not check-then-insert: concurrent seeds must not 23505.
    // NOT EXISTS still counts soft-deleted rows, so a deleted dashboard stays deleted.
    let inserted: Option<uuid::Uuid> = sqlx::query_scalar(
        "INSERT INTO dashboards (tenant_id, code, name, description, is_default, role_codes, layout_config) \
         SELECT $1, 'default-main', 'Hospital Overview', \
         'Default dashboard for all staff — key metrics at a glance', \
         true, '[]'::jsonb, \
         '{\"columns\": 12, \"row_height\": 80, \"gap\": 16}'::jsonb \
         WHERE NOT EXISTS (SELECT 1 FROM dashboards WHERE tenant_id = $1 AND code = 'default-main') \
         ON CONFLICT (tenant_id, code) WHERE deleted_at IS NULL DO NOTHING RETURNING id",
    )
    .bind(tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    let Some(dashboard_id) = inserted else {
        tx.commit().await?;
        tracing::debug!("Default dashboard already exists, skipping");
        return Ok(());
    };

    insert_widgets(&mut tx, dashboard_id).await?;

    tx.commit().await?;
    tracing::info!("Seeded default dashboard with {} widgets", WIDGETS.len());
    Ok(())
}
