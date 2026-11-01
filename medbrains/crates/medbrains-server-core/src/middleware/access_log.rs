//! HIPAA-style read-side access logging.
//!
//! Fires when a successful GET request hits a path that touches PHI
//! (patient-bearing entity) and writes an `access_log` row. This is the
//! "who looked at this patient's record, when, from where" trail
//! mandated by HIPAA / DPDP / DISHA / GDPR.
//!
//! Async via `tokio::spawn` so it never blocks the response. Failures are
//! logged at error level — fallback file logger is a Phase-2.5 follow-up.

use axum::{
    extract::{Request, State},
    http::Method,
    middleware::Next,
    response::Response,
};
use uuid::Uuid;

use crate::{
    middleware::{audit::CorrelationId, auth::Claims, client_ip::ClientIp},
    state::AppState,
};

/// Path prefixes that touch PHI. Listed explicitly rather than inferred
/// so we don't accidentally log catalog/master reads (which generate
/// noise without compliance value).
const PHI_PREFIXES: &[&str] = &[
    "patients",
    "encounters",
    "opd",
    "ipd",
    "icu",
    "emergency",
    "lab",
    "radiology",
    "pharmacy",
    "billing",
    "blood-bank",
    "consent",
    "case-mgmt",
    "chronic",
    "documents",
    "bedside",
];

pub async fn access_log_layer(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Response {
    // Only GET reads — POST/PUT/PATCH/DELETE are covered by AuditLayer
    if *request.method() != Method::GET {
        return next.run(request).await;
    }

    // Snapshot context BEFORE handler runs
    let claims_opt = request.extensions().get::<Claims>().cloned();
    let ip_opt = request.extensions().get::<ClientIp>().map(ClientIp::as_str);
    let user_agent = request
        .headers()
        .get(axum::http::header::USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned);
    let correlation_id = request.extensions().get::<CorrelationId>().map(|c| c.0);
    let path = request.uri().path().to_owned();

    let response = next.run(request).await;

    let Some(claims) = claims_opt else {
        return response;
    };

    let Some((entity_type, entity_id)) = parse_phi_path(&path) else {
        return response;
    };

    if !response.status().is_success() {
        // A decoy patient is hidden from every query, so naming one is
        // refused — and is exactly the read the honeytoken exists to catch.
        if let (true, Some(patient_id)) = (entity_type == "patients", entity_id) {
            let pool = state.db.clone();
            let (tenant_id, user_id) = (claims.tenant_id, claims.sub);
            tokio::spawn(async move {
                if let Err(e) = probe_honeytoken(&pool, tenant_id, patient_id, user_id, &path).await
                {
                    tracing::error!(error = %e, %tenant_id, "honeytoken probe failed");
                }
            });
        }
        return response;
    }

    let pool = state.db.clone();
    let tenant_id = claims.tenant_id;
    let module = entity_type.clone();
    let patient_id = (entity_type == "patients").then_some(entity_id).flatten();
    let row = AccessRow {
        tenant_id,
        user_id: claims.sub,
        entity_type,
        entity_id,
        patient_id,
        ip_address: ip_opt,
        user_agent,
        module,
        correlation_id,
        acting_agent: claims
            .act
            .as_ref()
            .map(super::auth::ActingAgent::to_audit_json),
    };

    tokio::spawn(async move {
        if let Err(e) = insert_access_log(&pool, &row).await {
            tracing::error!(
                error = %e,
                tenant_id = %tenant_id,
                "access_log_layer: failed to insert access_log row"
            );
        }
    });

    response
}

/// Match path against `PHI_PREFIXES`. Returns (`entity_type`, optional `entity_id`).
fn parse_phi_path(path: &str) -> Option<(String, Option<Uuid>)> {
    let stripped = path.trim_start_matches("/api/");
    let mut segments = stripped.split('/');
    let prefix = segments.next()?;
    if !PHI_PREFIXES.contains(&prefix) {
        return None;
    }
    let entity_id = segments.next().and_then(|s| Uuid::parse_str(s).ok());
    Some((prefix.to_owned(), entity_id))
}

/// One `access_log` row: who read which record, and — when an AI agent made
/// the read for them — which agent.
#[derive(Debug)]
pub struct AccessRow {
    pub tenant_id: Uuid,
    pub user_id: Uuid,
    pub entity_type: String,
    pub entity_id: Option<Uuid>,
    pub patient_id: Option<Uuid>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub module: String,
    pub correlation_id: Option<Uuid>,
    pub acting_agent: Option<serde_json::Value>,
}

/// Write one access row in its own transaction. Public so reads that do not go
/// through HTTP (the assistant's direct chart tools) leave the same trail.
///
/// # Errors
/// The row could not be written.
pub async fn insert_access_log(pool: &sqlx::PgPool, row: &AccessRow) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;
    // allow-raw-sql: access-log writes its own scoped tx; tenant context bootstrap.
    sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
        .bind(row.tenant_id.to_string())
        .execute(&mut *tx)
        .await?;
    sqlx::query(
        "INSERT INTO access_log ( \
             tenant_id, user_id, entity_type, entity_id, patient_id, action, \
             ip_address, user_agent, module, correlation_id, acting_agent \
         ) VALUES ($1, $2, $3, $4, $5, 'view', $6, $7, $8, $9, $10)",
    )
    .bind(row.tenant_id)
    .bind(row.user_id)
    .bind(&row.entity_type)
    .bind(row.entity_id)
    .bind(row.patient_id)
    .bind(row.ip_address.as_deref())
    .bind(row.user_agent.as_deref())
    .bind(&row.module)
    .bind(row.correlation_id)
    .bind(row.acting_agent.as_ref())
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

/// Raise the decoy-patient alarm if `patient_id` is a decoy. The same
/// database function the `access_log` trigger calls, so the rule lives once.
///
/// # Errors
/// The check could not be made.
pub async fn probe_honeytoken(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    patient_id: Uuid,
    user_id: Uuid,
    path: &str,
) -> Result<bool, sqlx::Error> {
    let mut tx = pool.begin().await?;
    // allow-raw-sql: tenant context bootstrap, as insert_access_log does.
    sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await?;
    let hit: bool = sqlx::query_scalar("SELECT public.security_honeytoken_hit($1, $2, $3, $4)")
        .bind(tenant_id)
        .bind(patient_id)
        .bind(user_id)
        .bind(format!("request:{path}"))
        .fetch_one(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(hit)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_patients_with_id() {
        let r = parse_phi_path("/api/patients/550e8400-e29b-41d4-a716-446655440000").unwrap();
        assert_eq!(r.0, "patients");
        assert!(r.1.is_some());
    }

    #[test]
    fn matches_lab_no_id() {
        let r = parse_phi_path("/api/lab").unwrap();
        assert_eq!(r.0, "lab");
        assert!(r.1.is_none());
    }

    #[test]
    fn rejects_unknown_prefix() {
        assert!(parse_phi_path("/api/admin/users").is_none());
        assert!(parse_phi_path("/api/health").is_none());
    }
}
