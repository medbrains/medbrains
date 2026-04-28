//! HIPAA-style read-side access logging.
//!
//! Fires when a successful GET request hits a path that touches PHI
//! (patient-bearing entity) and writes an `access_log` row. This is the
//! "who looked at this patient's record, when, from where" trail
//! mandated by HIPAA / DPDP / DISHA / GDPR.
//!
//! Async via tokio::spawn so it never blocks the response. Failures are
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
    let ip_opt = request
        .extensions()
        .get::<ClientIp>()
        .map(ClientIp::as_str);
    let user_agent = request
        .headers()
        .get(axum::http::header::USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned);
    let correlation_id = request
        .extensions()
        .get::<CorrelationId>()
        .map(|c| c.0);
    let path = request.uri().path().to_owned();

    let response = next.run(request).await;
    if !response.status().is_success() {
        return response;
    }

    let Some(claims) = claims_opt else {
        return response;
    };

    let Some((entity_type, entity_id)) = parse_phi_path(&path) else {
        return response;
    };

    let pool = state.db.clone();
    let tenant_id = claims.tenant_id;
    let user_id = claims.sub;
    let module = entity_type.clone();

    tokio::spawn(async move {
        if let Err(e) = insert_access_log(
            &pool,
            tenant_id,
            user_id,
            entity_type,
            entity_id,
            ip_opt,
            user_agent,
            module,
            correlation_id,
        )
        .await
        {
            tracing::error!(
                error = %e,
                tenant_id = %tenant_id,
                "access_log_layer: failed to insert access_log row"
            );
        }
    });

    response
}

/// Match path against PHI_PREFIXES. Returns (entity_type, optional entity_id).
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

#[allow(clippy::too_many_arguments)]
async fn insert_access_log(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    user_id: Uuid,
    entity_type: String,
    entity_id: Option<Uuid>,
    ip_address: Option<String>,
    user_agent: Option<String>,
    module: String,
    correlation_id: Option<Uuid>,
) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;
    // allow-raw-sql: access-log writes its own scoped tx; tenant context bootstrap.
    sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await?;
    // patient_id resolution would need a per-entity-type lookup; for v1
    // we record entity_id in entity_id column and let analytics correlate.
    sqlx::query(
        "INSERT INTO access_log ( \
             tenant_id, user_id, entity_type, entity_id, action, \
             ip_address, user_agent, module, correlation_id \
         ) VALUES ($1, $2, $3, $4, 'view', $5, $6, $7, $8)",
    )
    .bind(tenant_id)
    .bind(user_id)
    .bind(&entity_type)
    .bind(entity_id)
    .bind(ip_address.as_deref())
    .bind(user_agent.as_deref())
    .bind(&module)
    .bind(correlation_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
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
