//! Starting a camp's route of stations from a template
//! (RFCs/modules/RFC-MODULE-token-queues.md, P4a).
//!
//! A camp is set up in a village hall in an hour. "General camp" gives it the
//! four stations every camp runs — registration, vitals, doctor, pharmacy — in
//! order, so a patient registered at the first is called by the same number at
//! each of the others.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// One station in a template: its kind, the name staff and patients see, and
/// whether the doctor sits there.
struct Station {
    kind: &'static str,
    name: &'static str,
    doctor: bool,
}

const GENERAL_CAMP: [Station; 4] = [
    Station {
        kind: "registration",
        name: "Registration",
        doctor: false,
    },
    Station {
        kind: "vitals",
        name: "Vitals",
        doctor: false,
    },
    Station {
        kind: "consultation",
        name: "Doctor",
        doctor: true,
    },
    Station {
        kind: "pharmacy",
        name: "Pharmacy",
        doctor: false,
    },
];

#[derive(Debug, Deserialize)]
pub struct ApplyTemplateRequest {
    /// Only `general` today.
    pub template: String,
}

#[derive(Debug, Serialize)]
pub struct RouteStation {
    pub counter_id: Uuid,
    pub name: String,
    pub flow_position: i16,
}

/// `POST /api/camp/camps/{id}/route-template`
pub async fn apply_route_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(camp_id): Path<Uuid>,
    Json(body): Json<ApplyTemplateRequest>,
) -> Result<Json<Vec<RouteStation>>, AppError> {
    require_permission(&claims, permissions::camp::UPDATE)?;
    if body.template != "general" {
        return Err(AppError::BadRequest("Unknown camp template".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let camp = sqlx::query!(
        r#"SELECT organizing_department_id,
                  EXISTS(SELECT 1 FROM camp_counters c
                          WHERE c.camp_id = camps.id AND c.deleted_at IS NULL) AS "has_counters!"
             FROM camps WHERE id = $1 AND tenant_id = $2 FOR UPDATE"#,
        camp_id,
        claims.tenant_id,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    // A template sets a camp up; it never rearranges one already running.
    if camp.has_counters {
        return Err(AppError::Conflict(
            "This camp already has counters — change them on the Counters tab".to_owned(),
        ));
    }

    let mut route = Vec::with_capacity(GENERAL_CAMP.len());
    for (position, station) in (1_i16..).zip(GENERAL_CAMP.iter()) {
        let counter_id = sqlx::query_scalar!(
            "INSERT INTO camp_counters (tenant_id, camp_id, source_key, counter_type, \
               counter_name, status, flow_position) \
             VALUES ($1, $2, $3, $4, $5, 'ready', $6) RETURNING id",
            claims.tenant_id,
            camp_id,
            format!("route:{}", station.kind),
            station.kind,
            station.name,
            position,
        )
        .fetch_one(&mut *tx)
        .await?;
        // The camp board lists the departments at each counter; the doctor's
        // counter serves the camp's organising department.
        if let (true, Some(department_id)) = (station.doctor, camp.organizing_department_id) {
            sqlx::query!(
                "INSERT INTO camp_department_counters (tenant_id, camp_id, source_key, \
                   department_id, counter_id, status) \
                 VALUES ($1, $2, 'route:doctor', $3, $4, 'ready')",
                claims.tenant_id,
                camp_id,
                department_id,
                counter_id,
            )
            .execute(&mut *tx)
            .await?;
        }
        route.push(RouteStation {
            counter_id,
            name: station.name.to_owned(),
            flow_position: position,
        });
    }
    tx.commit().await?;
    Ok(Json(route))
}
