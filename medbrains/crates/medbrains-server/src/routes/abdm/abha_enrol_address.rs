//! The last step of "Create ABHA": the ABHA address (M1 `CRT_ABHA_112`).
//!
//! At least three addresses are offered — ABDM's suggestions, topped up from
//! the person's name and birth year — and a custom one may be typed. A typed
//! address must meet NHA's rules (`medbrains_abdm::rules`), checked here as
//! well as on the screen. When ABDM says it is taken the desk sees NHA's
//! exact words and chooses: keep the address the ABHA already has, or try
//! another.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_abdm::{
    CreateAddressRequest,
    errors::code_of,
    rules::{
        ADDRESS_TAKEN, MIN_ADDRESS_SUGGESTIONS, address_checklist, address_name, address_rules,
        derive_addresses,
    },
};
use medbrains_core::permissions;
use medbrains_kernel::authz::require_permission;
use serde::Deserialize;
use uuid::Uuid;

use super::abha::{Abdm, connect, map_abdm_error};
use super::abha_address::address_domain;
use super::abha_common::{VerificationStep, peek_token, update};
use super::abha_enrol::{finish, load, step};
use crate::{error::AppError, middleware::auth::Claims, state::AppState};

/// ABDM's code for an ABHA address someone already has.
const TAKEN_CODE: &str = "ABDM-1101";

#[derive(Debug, Deserialize)]
pub struct ChooseAddress {
    #[serde(default)]
    pub abha_address: String,
    /// After "ABHA address already exists.": finish with the address the
    /// new ABHA already has instead of creating one.
    #[serde(default)]
    pub keep_existing: bool,
}

/// Move to the address step with at least [`MIN_ADDRESS_SUGGESTIONS`]
/// addresses to pick from.
///
/// # Errors
/// ABDM's refusal of the suggestions call, as from [`map_abdm_error`].
pub(super) async fn offer_addresses(
    state: &AppState,
    claims: &Claims,
    id: Uuid,
    abdm: &Abdm,
    txn: &str,
) -> Result<Json<VerificationStep>, AppError> {
    let mut suggestions = abdm
        .client
        .address_suggestions(&abdm.session, txn)
        .await
        .map_err(map_abdm_error)?
        .abha_address_list;
    let domain = address_domain(abdm.environment);
    if suggestions.len() < MIN_ADDRESS_SUGGESTIONS {
        top_up(abdm, id, domain, &mut suggestions).await;
    }
    update(state, claims, id, |q| {
        q.push("stage = 'choose_address'");
    })
    .await?;
    Ok(Json(VerificationStep {
        suggestions,
        address_domain: Some(domain),
        ..step(id, "choose_address", None)
    }))
}

/// Add addresses made from the person's ABHA profile until there are
/// enough. Best effort: without the profile the desk can still type one.
async fn top_up(abdm: &Abdm, id: Uuid, domain: &str, suggestions: &mut Vec<String>) {
    let Some(token) = peek_token(id) else { return };
    let Ok(profile) = abdm.client.profile(&abdm.session, &token).await else {
        return;
    };
    let field = |v: &Option<String>| v.clone().unwrap_or_default();
    for candidate in derive_addresses(
        &field(&profile.first_name),
        &field(&profile.last_name),
        &field(&profile.year_of_birth),
        domain,
    ) {
        if suggestions.len() >= MIN_ADDRESS_SUGGESTIONS {
            break;
        }
        if !suggestions
            .iter()
            .any(|s| address_name(s, domain) == candidate)
        {
            suggestions.push(candidate);
        }
    }
}

/// Whether ABDM refused the address because it is taken.
fn is_taken(error: &AppError) -> bool {
    matches!(error, AppError::BadRequest(m)
        if code_of(m) == Some(TAKEN_CODE) || m.to_ascii_lowercase().contains("already exist"))
}

/// The address as ABDM takes it, or NHA's rules it breaks.
fn checked_name(typed: &str, domain: &str) -> Result<String, AppError> {
    let name = address_name(typed, domain).to_ascii_lowercase();
    if address_rules(&name, domain).all_met() {
        return Ok(name);
    }
    let unmet: Vec<String> = address_checklist(&name, domain)
        .into_iter()
        .filter(|(_, met)| !met)
        .map(|(words, _)| words)
        .collect();
    Err(AppError::BadRequest(format!(
        "This ABHA address does not meet ABDM's rules: {}.",
        unmet.join("; ")
    )))
}

/// `POST /api/abdm/abha/enrolments/{id}/address` — create the chosen ABHA
/// address and finish, or with `keep_existing` finish on the address the
/// ABHA already has.
///
/// # Errors
/// 400 for an address that breaks NHA's rules; 409 "ABHA address already
/// exists." when ABDM says it is taken; ABDM's other refusals as they come.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn choose_address(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ChooseAddress>,
) -> Result<Json<VerificationStep>, AppError> {
    require_permission(&claims, permissions::abdm::abha::MANAGE)?;
    let row = load(&state, &claims, id, "choose_address").await?;
    let abdm = connect(&state, claims.tenant_id).await?;
    if body.keep_existing {
        return finish(&state, &claims, id, &abdm, true).await;
    }
    let name = checked_name(&body.abha_address, address_domain(abdm.environment))?;
    let created = abdm
        .client
        .create_address(
            &abdm.session,
            &CreateAddressRequest {
                txn_id: row.abdm_txn_id,
                abha_address: name,
                preferred: 1,
            },
        )
        .await
        .map_err(map_abdm_error);
    match created {
        Ok(_) => finish(&state, &claims, id, &abdm, true).await,
        Err(e) if is_taken(&e) => Err(AppError::Conflict(ADDRESS_TAKEN.to_owned())),
        Err(e) => Err(e),
    }
}

#[cfg(test)]
mod tests {
    use super::{checked_name, is_taken};
    use crate::error::AppError;

    /// The server refuses what the screen's checklist refuses, naming the
    /// rules broken; a good address is sent without its domain.
    #[test]
    fn a_typed_address_is_checked_against_nhas_rules() {
        assert_eq!(
            checked_name("Priya.V_90@sbx", "sbx").ok().as_deref(),
            Some("priya.v_90")
        );
        let why = match checked_name("_pri.ya.v", "sbx") {
            Err(AppError::BadRequest(why)) => why,
            other => format!("not refused: {other:?}"),
        };
        assert!(why.contains("At most one dot (.)"), "{why}");
        assert!(why.contains("No . or _ at the start or end"), "{why}");
        assert!(!why.contains("8–18"), "{why}");
    }

    /// ABDM's taken-address refusal, by code or by words, and nothing else.
    #[test]
    fn a_taken_address_is_recognised() {
        let by_code =
            AppError::BadRequest("x\nThat ABHA address is taken. (code ABDM-1101)".into());
        assert!(is_taken(&by_code));
        assert!(is_taken(&AppError::BadRequest(
            "ABHA Address already exists".into()
        )));
        assert!(!is_taken(&AppError::BadRequest(
            "Invalid OTP (code ABDM-1204)".into()
        )));
        assert!(!is_taken(&AppError::ServiceUnavailable(
            "already exists".into()
        )));
    }
}
