#![allow(dead_code, unreachable_pub)]

//! The world the MedBrains Flow tests run in: the seeded hospital with the
//! `flow` add-on switched on through Admin -> Modules, one floor with a
//! billing zone and an OPD zone (a room inside it), each set up through the
//! Flow config API, and the four sources — tokens issued through the token
//! API, checked-in appointments, a visitor inside, staff on the roster.

use reqwest::{Client, StatusCode};
use serde_json::{Value, json};
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::common::{self, Staff};

/// The module switch and the tick are per tenant, and these tests share one.
pub static SERIAL: Mutex<()> = Mutex::const_new(());

pub struct World {
    pub app: common::TestApp,
    pub csrf: String,
    pub tenant: Uuid,
    pub admin: Uuid,
    pub floor: Uuid,
    pub billing_zone: Uuid,
    pub opd_zone: Uuid,
    pub opd_room: Uuid,
    pub billing: Uuid,
    pub opd: Uuid,
    pub tag: String,
}

pub async fn set_module(app: &common::TestApp, csrf: &str, status: &str) {
    let resp = app
        .client
        .put(app.url("/api/setup/modules/flow"))
        .header("x-csrf-token", csrf)
        .json(&json!({ "status": status }))
        .send()
        .await
        .expect("module switch");
    assert_eq!(
        resp.status(),
        StatusCode::OK,
        "{}",
        resp.text().await.unwrap_or_default()
    );
}

async fn location(
    app: &common::TestApp,
    tenant: Uuid,
    parent: Option<Uuid>,
    level: &str,
    code: String,
) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO locations (tenant_id, parent_id, level, code, name) \
         VALUES ($1, $2, $3::location_level, $4, $5) RETURNING id",
    )
    .bind(tenant)
    .bind(parent)
    .bind(level)
    .bind(&code)
    .bind(format!("Loc {code}"))
    .fetch_one(&app.db)
    .await
    .expect("location")
}

async fn department(app: &common::TestApp, tenant: Uuid, code: String, name: &str) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO departments (tenant_id, code, name, department_type) \
         VALUES ($1, $2, $3, 'clinical') RETURNING id",
    )
    .bind(tenant)
    .bind(code)
    .bind(name)
    .fetch_one(&app.db)
    .await
    .expect("department")
}

pub async fn world() -> World {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (tenant, admin): (Uuid, Uuid) =
        sqlx::query_as("SELECT tenant_id, id FROM users WHERE username = 'admin'")
            .fetch_one(&app.db)
            .await
            .expect("admin");
    set_module(&app, &csrf, "enabled").await;
    // Earlier runs' zones would otherwise pile up in the shared test tenant
    // until the aggregator's zone cap left this run's zones out.
    sqlx::query(
        "UPDATE flow_zone_config SET deleted_at = now(), delete_reason = 'test run over' \
          WHERE tenant_id = $1 AND deleted_at IS NULL \
            AND location_id IN (SELECT id FROM locations WHERE tenant_id = $1 AND name LIKE 'Loc Z%')",
    )
    .bind(tenant)
    .execute(&app.db)
    .await
    .expect("retire old test zones");
    let tag = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let floor = location(&app, tenant, None, "floor", format!("FL{tag}")).await;
    let billing_zone = location(&app, tenant, Some(floor), "zone", format!("ZB{tag}")).await;
    let opd_zone = location(&app, tenant, Some(floor), "zone", format!("ZO{tag}")).await;
    let opd_room = location(&app, tenant, Some(opd_zone), "room", format!("RM{tag}")).await;
    let billing = department(&app, tenant, format!("BL{tag}"), &format!("Billing {tag}")).await;
    let opd = department(&app, tenant, format!("OP{tag}"), &format!("Medicine {tag}")).await;
    let w = World {
        app,
        csrf,
        tenant,
        admin,
        floor,
        billing_zone,
        opd_zone,
        opd_room,
        billing,
        opd,
        tag,
    };
    // Billing: crowded past 10, wait goal 15 min. OPD: no limits, factor 2.
    w.put(
        &format!("/api/flow/config/zones/{billing_zone}"),
        &json!({
            "capacity": 40, "comfort_limit": 10, "attendant_factor": 1.8,
            "goal_wait_minutes": 15, "grid_row": 1, "grid_col": 1,
        }),
    )
    .await;
    w.put(
        &format!("/api/flow/config/zones/{opd_zone}"),
        &json!({
            "capacity": null, "comfort_limit": null, "attendant_factor": 2.0,
            "goal_wait_minutes": null, "grid_row": 1, "grid_col": 2,
        }),
    )
    .await;
    w.put(
        &format!("/api/flow/config/zones/{billing_zone}/sources"),
        &json!({
            "sources": [{ "kind": "department", "department_id": billing }],
        }),
    )
    .await;
    w.put(
        &format!("/api/flow/config/zones/{opd_zone}/sources"),
        &json!({
            "sources": [{ "kind": "department", "department_id": opd }],
        }),
    )
    .await;
    w
}

impl World {
    pub async fn put(&self, path: &str, body: &Value) -> Value {
        let resp = self
            .app
            .client
            .put(self.app.url(path))
            .header("x-csrf-token", &self.csrf)
            .json(body)
            .send()
            .await
            .expect("put");
        assert_eq!(
            resp.status(),
            StatusCode::OK,
            "{path}: {}",
            resp.text().await.unwrap_or_default()
        );
        resp.json().await.expect("put json")
    }

    /// GET as `client`, returning the status and the raw body.
    pub async fn get_as(&self, client: &Client, path: &str) -> (StatusCode, String) {
        let resp = client.get(self.app.url(path)).send().await.expect("get");
        let status = resp.status();
        (status, resp.text().await.unwrap_or_default())
    }

    pub async fn live(&self) -> Value {
        let (status, body) = self
            .get_as(
                &self.app.client,
                &format!("/api/flow/floors/{}/live", self.floor),
            )
            .await;
        assert_eq!(status, StatusCode::OK, "{body}");
        serde_json::from_str(&body).expect("live json")
    }

    pub fn zone<'a>(live: &'a Value, id: Uuid) -> &'a Value {
        live["zones"]
            .as_array()
            .and_then(|zones| zones.iter().find(|z| z["location_id"] == json!(id)))
            .expect("zone on the floor")
    }

    pub async fn tick(&self) -> medbrains_flow::aggregate::TickSummary {
        medbrains_flow::aggregate::run_tick(&self.app.db, self.tenant)
            .await
            .expect("tick")
    }

    /// Tokens issued at the desk, through the token API.
    pub async fn issue_tokens(&self, department: Uuid, module: &str, n: usize, patient_name: &str) {
        for _ in 0..n {
            let resp = self
                .app
                .client
                .post(self.app.url("/api/tokens/issue"))
                .header("x-csrf-token", &self.csrf)
                .json(
                    &json!({ "module": module, "scope": "department", "scope_id": department,
                               "patient_name": patient_name }),
                )
                .send()
                .await
                .expect("issue");
            assert_eq!(
                resp.status(),
                StatusCode::OK,
                "{}",
                resp.text().await.unwrap_or_default()
            );
        }
    }

    /// Patients checked in today and not yet seen.
    pub async fn checked_in(&self, department: Uuid, n: i32) {
        sqlx::query(
            "WITH p AS ( \
                INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
                SELECT $1, 'UH-FL-' || $2 || '-' || g, 'Flow', 'Checkin' || g, 'female', '9000000000' \
                  FROM generate_series(1, $3) g RETURNING id) \
             INSERT INTO appointments (tenant_id, patient_id, doctor_id, department_id, \
                 appointment_date, slot_start, slot_end, status, checked_in_at) \
             SELECT $1, p.id, $4, $5, (now() AT TIME ZONE 'Asia/Kolkata')::date, \
                    '09:00', '09:15', 'checked_in', now() FROM p",
        )
        .bind(self.tenant)
        .bind(format!("{}{}", self.tag, Uuid::new_v4().simple().to_string()[..4].to_uppercase()))
        .bind(n)
        .bind(self.admin)
        .bind(department)
        .execute(&self.app.db)
        .await
        .expect("checked in");
    }

    /// One visitor through the gate to `location`, not yet out.
    pub async fn visitor_inside(&self, location: Uuid) {
        sqlx::query(
            "WITH reg AS ( \
                INSERT INTO visitor_registrations (tenant_id, visitor_name, ward_id) \
                VALUES ($1, 'Flow Visitor', $2) RETURNING id), \
             pass AS ( \
                INSERT INTO visitor_passes (tenant_id, registration_id, pass_number, ward_id, valid_until) \
                SELECT $1, id, $3, $2, now() + interval '1 day' FROM reg RETURNING id) \
             INSERT INTO visitor_logs (tenant_id, pass_id, check_in_at) SELECT $1, id, now() FROM pass",
        )
        .bind(self.tenant)
        .bind(location)
        .bind(format!("VP-{}", Uuid::new_v4().simple()))
        .execute(&self.app.db)
        .await
        .expect("visitor");
    }

    /// `n` staff on today's roster in `department`, on a shift that is on now.
    pub async fn rostered(&self, department: Uuid, n: i32) {
        let code = format!(
            "FS{}",
            Uuid::new_v4().simple().to_string()[..8].to_uppercase()
        );
        sqlx::query(
            "WITH s AS ( \
                INSERT INTO shift_definitions (tenant_id, code, name, start_time, end_time) \
                VALUES ($1, $2, 'Flow all day', '00:00', '23:59:59') RETURNING id), \
             e AS ( \
                INSERT INTO employees (tenant_id, employee_code, first_name, department_id) \
                SELECT $1, $2 || '-' || g, 'Flow', $3 FROM generate_series(1, $4) g RETURNING id) \
             INSERT INTO duty_rosters (tenant_id, employee_id, department_id, shift_id, roster_date, created_by) \
             SELECT $1, e.id, $3, s.id, (now() AT TIME ZONE 'Asia/Kolkata')::date, $5 FROM e, s",
        )
        .bind(self.tenant)
        .bind(&code)
        .bind(department)
        .bind(n)
        .bind(self.admin)
        .execute(&self.app.db)
        .await
        .expect("roster");
    }

    pub async fn staff(&self, role: &str) -> Staff {
        common::provision_staff(&self.app, &self.csrf, role, &[]).await
    }
}
