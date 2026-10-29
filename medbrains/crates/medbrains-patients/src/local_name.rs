//! A patient's name in their own script (`patients.full_name_local`), and
//! the desk's help writing it.
//!
//! Registration takes the name in English letters, as every other screen and
//! report needs it, and offers the same name in an Indian script — or the
//! English spelling of a name typed in one (`medbrains_core::indic`, rules,
//! on-box). Search finds the patient from either script.

use axum::{
    Extension, Json,
    extract::{Query, State},
};
use medbrains_core::indic::{self, Script};
use medbrains_core::permissions;
use medbrains_server_core::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Longest name the desk transliterates at once.
const MAX_CHARS: usize = 120;

#[derive(Debug, Deserialize)]
pub struct TransliterateQuery {
    pub text: String,
    /// An Indian script, or `latin` for the English spelling.
    pub to: String,
}

#[derive(Debug, Serialize)]
pub struct Transliteration {
    pub suggestions: Vec<String>,
}

/// `GET /api/patients/transliterate?text=Ramesh+Kumar&to=devanagari` — the
/// name in another script, most likely spelling first. For the registration
/// desk, so it needs the permission to register.
pub async fn transliterate(
    Extension(claims): Extension<Claims>,
    Query(q): Query<TransliterateQuery>,
) -> Result<Json<Transliteration>, AppError> {
    require_permission(&claims, permissions::patients::CREATE)?;
    let text = q.text.trim();
    if text.chars().count() > MAX_CHARS {
        return Err(AppError::BadRequest(format!(
            "a name of at most {MAX_CHARS} characters"
        )));
    }
    let suggestions = if q.to == "latin" {
        let latin = indic::to_latin(text);
        if latin == text {
            Vec::new()
        } else {
            vec![latin]
        }
    } else {
        let script: Script = serde_json::from_value(serde_json::Value::String(q.to.clone()))
            .map_err(|_| AppError::BadRequest(format!("unknown script {:?}", q.to)))?;
        if indic::script_of(text).is_some() {
            Vec::new()
        } else {
            indic::from_latin(text, script)
        }
    };
    Ok(Json(Transliteration { suggestions }))
}

/// What a search term is matched against: its English spelling (for the
/// English name) and, if typed in an Indian script, itself (for the local
/// name).
#[must_use]
pub fn search_terms(q: &str) -> (String, Option<String>) {
    if indic::script_of(q).is_some() {
        (indic::to_latin(q), Some(q.to_owned()))
    } else {
        (q.to_owned(), None)
    }
}

/// Store the name in the patient's own script; blank clears it.
///
/// # Errors
/// A database error.
pub async fn save(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant: Uuid,
    patient: Uuid,
    name: &str,
) -> Result<(), AppError> {
    let name = name.trim();
    sqlx::query("UPDATE patients SET full_name_local = $3 WHERE id = $2 AND tenant_id = $1")
        .bind(tenant)
        .bind(patient)
        .bind((!name.is_empty()).then_some(name))
        .execute(&mut **tx)
        .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::search_terms;

    #[test]
    fn a_search_in_an_indian_script_also_searches_the_english_name() {
        assert_eq!(
            search_terms("रमेश"),
            ("Ramesh".to_owned(), Some("रमेश".to_owned()))
        );
        assert_eq!(search_terms("ramesh"), ("ramesh".to_owned(), None));
    }
}
