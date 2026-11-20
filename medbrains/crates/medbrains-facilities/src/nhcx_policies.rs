//! A patient's NHCX policies from the registry.
//!
//! `/participant/get/policies` (test case T-ML1-01) says which insurer covers them and who processes the
//! claims. The last answer is kept per patient; every later message about
//! a policy is addressed to its `processingid`
//! ([`crate::nhcx_common::processor_for`]), never to the insurer when a TPA
//! processes for it.

use axum::Json;
use axum::extract::{Extension, Query, State};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_core::nhcx_wire::hyphenated_abha;
use medbrains_core::permissions;
use medbrains_outbox::handlers::nhcx::registry::{LinkedPolicy, RegistryError};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

use crate::nhcx_common::{self, Tx};

/// One policy as the desk sees it, with the names the directory holds.
#[derive(Debug, Serialize)]
pub struct NhcxPatientPolicy {
    pub id: Uuid,
    pub identifier_type: String,
    pub payer_id: Option<String>,
    pub payer_name: Option<String>,
    pub processing_id: String,
    pub processor_name: Option<String>,
    pub member_id: Option<String>,
    pub product_id: Option<String>,
    pub product_name: Option<String>,
    pub fetched_at: DateTime<Utc>,
}

/// The last lookup for a patient.
#[derive(Debug, Serialize)]
pub struct NhcxPolicyLookup {
    pub patient_id: Uuid,
    pub policies: Vec<NhcxPatientPolicy>,
    /// What the desk should know when nothing was found: no ABHA, no member
    /// id, or the registry's own refusal.
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PatientPoliciesQuery {
    pub patient_id: Uuid,
}

/// The patient's kept policies, processor named.
async fn kept(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<Vec<NhcxPatientPolicy>, AppError> {
    Ok(sqlx::query_as!(
        NhcxPatientPolicy,
        r#"SELECT p.id, p.identifier_type, p.payer_id, pay.participant_name AS "payer_name?",
                  p.processing_id, proc.participant_name AS "processor_name?", p.member_id,
                  p.product_id, p.product_name, p.fetched_at
             FROM nhcx_patient_policies p
             LEFT JOIN nhcx_participants pay
                    ON pay.tenant_id = p.tenant_id AND pay.participant_code = p.payer_id
             LEFT JOIN nhcx_participants proc
                    ON proc.tenant_id = p.tenant_id AND proc.participant_code = p.processing_id
            WHERE p.tenant_id = $1 AND p.patient_id = $2
            ORDER BY p.fetched_at DESC, p.product_name LIMIT 50"#,
        tenant_id,
        patient_id,
    )
    .fetch_all(&mut **tx)
    .await?)
}

/// `GET /api/insurance/nhcx/policies?patient_id=` — the last registry lookup.
///
/// # Errors
/// 403 without `insurance.nhcx.lookup_policies` or access to the patient.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn list_patient_policies(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<PatientPoliciesQuery>,
) -> Result<Json<NhcxPolicyLookup>, AppError> {
    require_permission(&claims, permissions::insurance::nhcx::LOOKUP_POLICIES)?;
    medbrains_authz_gate::require_patient_billing_access(&state, &claims, q.patient_id).await?;
    let mut tx = nhcx_common::tenant_tx(&state, claims.tenant_id).await?;
    let policies = kept(&mut tx, claims.tenant_id, q.patient_id).await?;
    tx.commit().await?;
    Ok(Json(NhcxPolicyLookup {
        patient_id: q.patient_id,
        policies,
        note: None,
    }))
}

#[derive(Debug, Deserialize)]
pub struct LookupPoliciesRequest {
    pub patient_id: Uuid,
}

/// What a patient can be looked up by, strongest first (the handbook's
/// cascade): a verified ABHA number without hyphens, then the member id of
/// their active policy. The mobile number is not used — it can be shared.
async fn identifiers(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<Vec<(&'static str, String)>, AppError> {
    let patient = nhcx_common::load_patient(tx, tenant_id, patient_id).await?;
    let mut out = Vec::new();
    if let Some(abha) = patient.abha_number.as_deref().and_then(hyphenated_abha) {
        out.push(("AbhaNumber", abha.replace('-', "")));
    }
    let policy = nhcx_common::load_policy(tx, tenant_id, patient_id, None).await?;
    if let Some(member) = policy
        .and_then(|(_, p)| p.member_id)
        .filter(|m| !m.trim().is_empty())
    {
        out.push(("MemberId", member.trim().to_owned()));
    }
    Ok(out)
}

/// `POST /api/insurance/nhcx/policies/lookup` — ask the registry which
/// policies are linked to the patient, and keep the answer in place of the
/// last one.
///
/// # Errors
/// 403 without `insurance.nhcx.lookup_policies` or access to the patient;
/// 503 until onboarded or while the registry is down.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn lookup_patient_policies(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<LookupPoliciesRequest>,
) -> Result<Json<NhcxPolicyLookup>, AppError> {
    require_permission(&claims, permissions::insurance::nhcx::LOOKUP_POLICIES)?;
    // Asking the registry about a named person discloses that person.
    medbrains_authz_gate::require_patient_billing_access(&state, &claims, body.patient_id).await?;
    let mut tx = nhcx_common::tenant_tx(&state, claims.tenant_id).await?;
    nhcx_common::require_nhcx_onboarded(&mut tx, claims.tenant_id).await?;
    let ids = identifiers(&mut tx, claims.tenant_id, body.patient_id).await?;
    tx.commit().await?;
    if ids.is_empty() {
        return Ok(Json(NhcxPolicyLookup {
            patient_id: body.patient_id,
            policies: Vec::new(),
            note: Some("Link a verified ABHA number, or add the policy's member id, first".into()),
        }));
    }
    let http = nhcx_common::registry_http()?;
    let registry = nhcx_common::registry(&state, &http, claims.tenant_id).await?;
    let (found, refused) = cascade(&ids, |kind, value| registry.policies(kind, value)).await?;
    let mut tx = nhcx_common::tenant_tx(&state, claims.tenant_id).await?;
    if let Some((kind, policies)) = &found {
        keep(&mut tx, &claims, body.patient_id, (kind, policies)).await?;
    }
    let policies = kept(&mut tx, claims.tenant_id, body.patient_id).await?;
    tx.commit().await?;
    let note = found.is_none().then(|| {
        refused.unwrap_or_else(|| "The registry has no policy linked to this patient".into())
    });
    Ok(Json(NhcxPolicyLookup {
        patient_id: body.patient_id,
        policies,
        note,
    }))
}

/// A lookup's result: the first identifier that found a policy, and the
/// registry's last refusal when none did.
type Found = (Option<(&'static str, Vec<LinkedPolicy>)>, Option<String>);

/// Try each identifier in order and stop at the first that finds a policy.
/// A refusal moves on to the next; an outage stops the lookup, so it never
/// reads as "no policy".
async fn cascade<'a, F, Fut>(ids: &'a [(&'static str, String)], ask: F) -> Result<Found, AppError>
where
    F: Fn(&'static str, &'a str) -> Fut,
    Fut: Future<Output = Result<Vec<LinkedPolicy>, RegistryError>>,
{
    let mut refused = None;
    for (kind, value) in ids {
        match ask(kind, value).await {
            Ok(found) if !found.is_empty() => return Ok((Some((kind, found)), None)),
            Ok(_) => {}
            Err(e @ RegistryError::Refused(_)) => refused = Some(e.to_string()),
            Err(e) => return Err(nhcx_common::registry_error(&e)),
        }
    }
    Ok((None, refused))
}

/// Replace the patient's kept policies with this answer, in one statement.
async fn keep(
    tx: &mut Tx<'_>,
    claims: &Claims,
    patient_id: Uuid,
    (kind, policies): (&str, &[LinkedPolicy]),
) -> Result<(), AppError> {
    sqlx::query!(
        "DELETE FROM nhcx_patient_policies WHERE tenant_id = $1 AND patient_id = $2",
        claims.tenant_id,
        patient_id,
    )
    .execute(&mut **tx)
    .await?;
    let rows =
        serde_json::to_value(policies).map_err(|e| AppError::Internal(format!("policies: {e}")))?;
    sqlx::query!(
        "INSERT INTO nhcx_patient_policies \
             (tenant_id, patient_id, identifier_type, payer_id, processing_id, member_id, \
              product_id, product_name, fetched_by) \
         SELECT $1, $2, $3, r.payer_id, r.processing_id, r.member_id, r.product_id, \
                r.product_name, $4 \
           FROM jsonb_to_recordset($5) AS r(payer_id text, processing_id text, \
                member_id text, product_id text, product_name text)",
        claims.tenant_id,
        patient_id,
        kind,
        claims.sub,
        rows,
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    fn policy(processor: &str) -> LinkedPolicy {
        LinkedPolicy {
            payer_id: Some("1518@hcx".into()),
            processing_id: processor.into(),
            member_id: None,
            product_id: None,
            product_name: None,
        }
    }

    fn ids() -> Vec<(&'static str, String)> {
        vec![
            ("AbhaNumber", "91711234567890".into()),
            ("MemberId", "M1".into()),
        ]
    }

    #[tokio::test]
    async fn the_abha_is_tried_first_and_a_find_stops_the_cascade() {
        let (found, refused) = cascade(&ids(), |kind, _| async move {
            Ok(if kind == "AbhaNumber" {
                vec![policy("TPA@hcx")]
            } else {
                vec![]
            })
        })
        .await
        .unwrap();
        let (kind, got) = found.unwrap();
        assert_eq!(
            (kind, got[0].processing_id.as_str()),
            ("AbhaNumber", "TPA@hcx")
        );
        assert!(refused.is_none());
    }

    #[tokio::test]
    async fn a_refusal_moves_on_to_the_member_id() {
        let (found, _) = cascade(&ids(), |kind, _| async move {
            if kind == "AbhaNumber" {
                Err(RegistryError::Refused("404".into()))
            } else {
                Ok(vec![policy("1518@hcx")])
            }
        })
        .await
        .unwrap();
        assert_eq!(found.unwrap().0, "MemberId");
    }

    #[tokio::test]
    async fn an_outage_is_an_error_never_no_policy() {
        let got = cascade(&ids(), |_, _| async {
            Err::<Vec<LinkedPolicy>, _>(RegistryError::Unavailable("timeout".into()))
        })
        .await;
        assert!(matches!(got, Err(AppError::ServiceUnavailable(_))));
    }
}
