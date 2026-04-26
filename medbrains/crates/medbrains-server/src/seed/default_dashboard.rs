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
        title: "Total Patients",
        subtitle: "Registered patients",
        icon: "IconUsers",
        color: "blue",
        config: r#"{"format": "number"}"#,
        data_source: r#"{"type": "sql_count", "table": "patients"}"#,
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
        subtitle: "OPD encounters today",
        icon: "IconStethoscope",
        color: "teal",
        config: r#"{"format": "number"}"#,
        data_source: r#"{"type": "sql_count", "table": "encounters", "filter": "DATE(encounter_date) = CURRENT_DATE"}"#,
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
        config: r#"{"max_rows": 10, "columns": ["token_number", "patient_name", "department", "status"]}"#,
        data_source: r#"{"type": "api", "endpoint": "/api/opd/queue", "params": {"status": "waiting"}}"#,
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
        data_source: r#"{"type": "api", "endpoint": "/api/ipd/admissions", "params": {"limit": 10}}"#,
        x: 6,
        y: 2,
        w: 6,
        h: 4,
        perm: "ipd.admissions.list",
        sort: 6,
    },
    WidgetDef {
        wtype: "chart",
        title: "Revenue This Month",
        subtitle: "Monthly billing trend",
        icon: "IconCoin",
        color: "green",
        config: r#"{"chart_type": "bar", "x_axis": "date", "y_axis": "amount"}"#,
        data_source: r#"{"type": "api", "endpoint": "/api/dashboard/widget-data/revenue-monthly"}"#,
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

    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM dashboards WHERE tenant_id = $1 AND code = 'default-main')",
    )
    .bind(tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    if exists {
        tx.commit().await?;
        tracing::debug!("Default dashboard already exists, skipping");
        return Ok(());
    }

    let dashboard_id: uuid::Uuid = sqlx::query_scalar(
        "INSERT INTO dashboards (tenant_id, code, name, description, is_default, role_codes, layout_config) \
         VALUES ($1, 'default-main', 'Hospital Overview', \
         'Default dashboard for all staff — key metrics at a glance', \
         true, '[]'::jsonb, \
         '{\"columns\": 12, \"row_height\": 80, \"gap\": 16}'::jsonb) \
         RETURNING id",
    )
    .bind(tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    insert_widgets(&mut tx, dashboard_id).await?;

    tx.commit().await?;
    tracing::info!("Seeded default dashboard with {} widgets", WIDGETS.len());
    Ok(())
}
