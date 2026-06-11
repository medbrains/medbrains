use axum::{
    Extension, Json,
    extract::{Query, State},
};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

const WHO_ICD_API_BASE_URL: &str = "https://medbrains-icd.localhost";
const WHO_ICD_TOKEN_URL: &str = "https://icdaccessmanagement.who.int/connect/token";
const WHO_ICD_DEFAULT_RELEASE: &str = "2026-01";
const SNOMED_DISTRIBUTION_URL: &str = "https://www.snomed.org/get-snomed";

#[derive(Debug, Deserialize)]
pub struct TerminologySearchQuery {
    pub system: String,
    pub q: String,
    pub limit: Option<i64>,
    pub semantic_tag: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TerminologyLookupQuery {
    pub system: String,
    pub code: String,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct TerminologySearchResult {
    pub system: String,
    pub code: String,
    pub display: String,
    pub semantic_tag: Option<String>,
    pub source: String,
    pub source_url: Option<String>,
    pub source_version: Option<String>,
    pub active: bool,
    pub provider_mode: String,
    pub corpus_entry_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TerminologySearchResponse {
    pub results: Vec<TerminologySearchResult>,
    pub suggestions: Vec<String>,
}

struct Icd11SearchBundle {
    rows: Vec<TerminologySearchResult>,
    suggestions: Vec<String>,
}

enum TerminologySystem {
    Icd11,
    Snomed,
}

fn terminology_system(value: &str) -> Result<TerminologySystem, AppError> {
    match value.trim().to_lowercase().as_str() {
        "icd11" => Ok(TerminologySystem::Icd11),
        "snomed" => Ok(TerminologySystem::Snomed),
        _ => Err(AppError::BadRequest(
            "unsupported terminology system".to_owned(),
        )),
    }
}

fn bounded_limit(limit: Option<i64>) -> i64 {
    limit.unwrap_or(20).clamp(1, 50)
}

fn normalized_optional_text(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
}

pub async fn search_terminology(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<TerminologySearchQuery>,
) -> Result<Json<Vec<TerminologySearchResult>>, AppError> {
    require_permission(&claims, permissions::opd::queue::VIEW)?;

    let needle = normalize_terminology_query(&q.q);
    if needle.len() < 2 && !is_icd11_code_fragment(&needle) {
        return Ok(Json(Vec::new()));
    }

    let semantic_tag = normalized_optional_text(q.semantic_tag.as_deref());
    let rows = match terminology_system(&q.system)? {
        TerminologySystem::Icd11 => {
            let limit = bounded_limit(q.limit);
            match search_icd11_official(&needle, limit).await {
                Ok(rows) => rows,
                Err(error) => {
                    tracing::warn!(error = %error, "WHO ICD-11 search failed");
                    Vec::new()
                }
            }
        }
        TerminologySystem::Snomed => {
            search_snomed_cache(
                &state,
                &needle,
                semantic_tag.as_deref(),
                bounded_limit(q.limit),
            )
            .await?
        }
    };

    Ok(Json(rows))
}

pub async fn search_terminology_with_suggestions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<TerminologySearchQuery>,
) -> Result<Json<TerminologySearchResponse>, AppError> {
    require_permission(&claims, permissions::opd::queue::VIEW)?;

    let needle = normalize_terminology_query(&q.q);
    if needle.len() < 2 && !is_icd11_code_fragment(&needle) {
        return Ok(Json(TerminologySearchResponse {
            results: Vec::new(),
            suggestions: Vec::new(),
        }));
    }

    let semantic_tag = normalized_optional_text(q.semantic_tag.as_deref());
    let response = match terminology_system(&q.system)? {
        TerminologySystem::Icd11 => {
            let limit = bounded_limit(q.limit);
            match search_icd11_official_with_suggestions(&needle, limit).await {
                Ok(bundle) => TerminologySearchResponse {
                    results: bundle.rows,
                    suggestions: bundle.suggestions,
                },
                Err(error) => {
                    tracing::warn!(error = %error, "WHO ICD-11 search failed");
                    TerminologySearchResponse {
                        results: Vec::new(),
                        suggestions: Vec::new(),
                    }
                }
            }
        }
        TerminologySystem::Snomed => TerminologySearchResponse {
            results: search_snomed_cache(
                &state,
                &needle,
                semantic_tag.as_deref(),
                bounded_limit(q.limit),
            )
            .await?,
            suggestions: Vec::new(),
        },
    };

    Ok(Json(response))
}

pub async fn lookup_terminology(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<TerminologyLookupQuery>,
) -> Result<Json<TerminologySearchResult>, AppError> {
    require_permission(&claims, permissions::opd::queue::VIEW)?;

    let code = q.code.trim();
    if code.is_empty() {
        return Err(AppError::BadRequest("code is required".to_owned()));
    }

    let row = match terminology_system(&q.system)? {
        TerminologySystem::Icd11 => match lookup_icd11_official_code(code).await {
            Ok(row) => row,
            Err(error) => {
                tracing::warn!(error = %error, "WHO ICD-11 lookup failed");
                None
            }
        },
        TerminologySystem::Snomed => lookup_snomed_cache(&state, code).await?,
    };

    row.map(Json).ok_or(AppError::NotFound)
}

async fn search_icd11_official(
    needle: &str,
    limit: i64,
) -> Result<Vec<TerminologySearchResult>, AppError> {
    let bundle = search_icd11_official_with_suggestions(needle, limit).await?;
    Ok(bundle.rows)
}

async fn search_icd11_official_with_suggestions(
    needle: &str,
    limit: i64,
) -> Result<Icd11SearchBundle, AppError> {
    let base_url =
        std::env::var("WHO_ICD_API_BASE_URL").unwrap_or_else(|_| WHO_ICD_API_BASE_URL.to_owned());
    let token = if who_icd_requires_auth(&base_url) {
        match who_icd_access_token().await? {
            Some(value) => Some(value),
            None => {
                return Ok(Icd11SearchBundle {
                    rows: Vec::new(),
                    suggestions: Vec::new(),
                });
            }
        }
    } else {
        None
    };
    let release =
        std::env::var("WHO_ICD_RELEASE_ID").unwrap_or_else(|_| WHO_ICD_DEFAULT_RELEASE.to_owned());
    let provider_mode = who_icd_provider_mode(&base_url);
    let client = reqwest::Client::new();
    let mut rows = Vec::new();
    let mut seen = HashSet::new();
    let mut suggestions = Vec::new();
    let candidate_limit = limit.saturating_mul(4).clamp(limit, 100);

    if is_likely_complete_icd11_code(needle)
        && let Some(row) = lookup_icd11_official_code_with_context(
            &client,
            &base_url,
            &release,
            &provider_mode,
            token.as_deref(),
            needle,
        )
        .await?
    {
        push_unique_terminology_row(&mut rows, &mut seen, row);
    }

    let mut searched_variants = Vec::new();
    for variant in icd11_search_variants(needle).into_iter().take(5) {
        if i64::try_from(rows.len()).unwrap_or(candidate_limit) >= candidate_limit {
            break;
        }
        push_unique_query_variant(&mut searched_variants, &variant);
        let remaining = candidate_limit.saturating_sub(i64::try_from(rows.len()).unwrap_or(0));
        let search_response = search_icd11_official_query(
            &client,
            &base_url,
            &release,
            &provider_mode,
            token.as_deref(),
            &variant,
            remaining.max(5),
        )
        .await?;
        for suggestion in search_response.suggestions {
            push_unique_suggestion(&mut suggestions, &suggestion);
        }
        for row in search_response.rows {
            push_unique_terminology_row(&mut rows, &mut seen, row);
            if i64::try_from(rows.len()).unwrap_or(candidate_limit) >= candidate_limit {
                break;
            }
        }
    }

    let suggestion_variants = suggestions.clone();
    for suggestion in suggestion_variants.into_iter().take(5) {
        if i64::try_from(rows.len()).unwrap_or(candidate_limit) >= candidate_limit {
            break;
        }
        if searched_variants
            .iter()
            .any(|variant| variant.eq_ignore_ascii_case(&suggestion))
        {
            continue;
        }
        let remaining = candidate_limit.saturating_sub(i64::try_from(rows.len()).unwrap_or(0));
        let search_response = search_icd11_official_query(
            &client,
            &base_url,
            &release,
            &provider_mode,
            token.as_deref(),
            &suggestion,
            remaining.max(5),
        )
        .await?;
        for nested_suggestion in search_response.suggestions {
            push_unique_suggestion(&mut suggestions, &nested_suggestion);
        }
        for row in search_response.rows {
            push_unique_terminology_row(&mut rows, &mut seen, row);
            if i64::try_from(rows.len()).unwrap_or(candidate_limit) >= candidate_limit {
                break;
            }
        }
    }

    rows.sort_by_key(|row| terminology_relevance_score(needle, row));
    rows.truncate(usize::try_from(limit).unwrap_or(50));
    suggestions.truncate(8);

    Ok(Icd11SearchBundle { rows, suggestions })
}

async fn search_icd11_official_query(
    client: &reqwest::Client,
    base_url: &str,
    release: &str,
    provider_mode: &str,
    token: Option<&str>,
    query: &str,
    limit: i64,
) -> Result<Icd11SearchBundle, AppError> {
    let search_url = format!(
        "{}/icd/release/11/{}/mms/search",
        base_url.trim_end_matches('/'),
        release
    );

    let mut request = client
        .get(search_url)
        .header("API-Version", "v2")
        .header("Accept", "application/json")
        .header("Accept-Language", "en")
        .query(&[
            ("q", query),
            ("useFlexisearch", "true"),
            ("includeKeywordResult", "true"),
            ("medicalCodingMode", "true"),
            ("flatResults", "true"),
        ]);
    if let Some(token) = token {
        request = request.bearer_auth(token);
    }
    let response = request.send().await.map_err(|error| {
        AppError::Internal(format!("WHO ICD-11 search request failed: {error}"))
    })?;

    if !response.status().is_success() {
        return Err(AppError::Internal(format!(
            "WHO ICD-11 search returned status {}",
            response.status()
        )));
    }

    let payload = response
        .json::<Value>()
        .await
        .map_err(|error| AppError::Internal(format!("WHO ICD-11 search JSON failed: {error}")))?;
    Ok(parse_who_icd11_search_response_bundle(
        &payload,
        release,
        provider_mode,
        limit,
    ))
}

async fn lookup_icd11_official_code(
    code: &str,
) -> Result<Option<TerminologySearchResult>, AppError> {
    let base_url =
        std::env::var("WHO_ICD_API_BASE_URL").unwrap_or_else(|_| WHO_ICD_API_BASE_URL.to_owned());
    let token = if who_icd_requires_auth(&base_url) {
        who_icd_access_token().await?
    } else {
        None
    };
    let release =
        std::env::var("WHO_ICD_RELEASE_ID").unwrap_or_else(|_| WHO_ICD_DEFAULT_RELEASE.to_owned());
    let provider_mode = who_icd_provider_mode(&base_url);
    let client = reqwest::Client::new();
    lookup_icd11_official_code_with_context(
        &client,
        &base_url,
        &release,
        &provider_mode,
        token.as_deref(),
        code,
    )
    .await
}

async fn lookup_icd11_official_code_with_context(
    client: &reqwest::Client,
    base_url: &str,
    release: &str,
    provider_mode: &str,
    token: Option<&str>,
    code: &str,
) -> Result<Option<TerminologySearchResult>, AppError> {
    let normalized_code = code.trim().to_uppercase();
    if normalized_code.is_empty() {
        return Ok(None);
    }

    let code_info_url = format!(
        "{}/icd/release/11/{}/mms/codeinfo/{}",
        base_url.trim_end_matches('/'),
        release,
        encode_path_segment(&normalized_code),
    );
    let Some(code_info) = who_icd_get_json(client, &code_info_url, token).await? else {
        return Ok(None);
    };

    let Some(stem_id) = value_text(code_info.get("stemId")) else {
        return Ok(None);
    };
    let Some(stem_entity) =
        who_icd_get_json(client, &who_icd_entity_url(base_url, &stem_id), token).await?
    else {
        return Ok(None);
    };
    let Some(stem_title) = value_text(stem_entity.get("title")) else {
        return Ok(None);
    };
    let stem_url = value_text(stem_entity.get("@id"))
        .or_else(|| value_text(stem_entity.get("id")))
        .unwrap_or(stem_id);

    let mut display_parts = vec![stem_title];
    let mut source_urls = vec![stem_url];
    for extension_code in extension_codes_from_code_info(&code_info) {
        let extension_info_url = format!(
            "{}/icd/release/11/{}/mms/codeinfo/{}",
            base_url.trim_end_matches('/'),
            release,
            encode_path_segment(&extension_code),
        );
        let Some(extension_info) = who_icd_get_json(client, &extension_info_url, token).await?
        else {
            continue;
        };
        let Some(extension_stem_id) = value_text(extension_info.get("stemId")) else {
            continue;
        };
        let Some(extension_entity) = who_icd_get_json(
            client,
            &who_icd_entity_url(base_url, &extension_stem_id),
            token,
        )
        .await?
        else {
            continue;
        };
        if let Some(title) = value_text(extension_entity.get("title")) {
            display_parts.push(title);
        }
        if let Some(source_url) = value_text(extension_entity.get("@id"))
            .or_else(|| value_text(extension_entity.get("id")))
        {
            source_urls.push(source_url);
        }
    }

    Ok(Some(TerminologySearchResult {
        system: "icd11".to_owned(),
        code: normalized_code,
        display: display_parts.join(", "),
        semantic_tag: None,
        source: "WHO ICD-11 MMS".to_owned(),
        source_url: Some(source_urls.join(" & ")),
        source_version: Some(release.to_owned()),
        active: true,
        provider_mode: provider_mode.to_owned(),
        corpus_entry_id: None,
    }))
}

async fn who_icd_get_json(
    client: &reqwest::Client,
    url: &str,
    token: Option<&str>,
) -> Result<Option<Value>, AppError> {
    let mut request = client
        .get(url)
        .header("API-Version", "v2")
        .header("Accept", "application/json")
        .header("Accept-Language", "en");
    if let Some(token) = token {
        request = request.bearer_auth(token);
    }
    let response = request
        .send()
        .await
        .map_err(|error| AppError::Internal(format!("WHO ICD-11 request failed: {error}")))?;
    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(None);
    }
    if !response.status().is_success() {
        return Err(AppError::Internal(format!(
            "WHO ICD-11 request returned status {}",
            response.status()
        )));
    }
    let payload = response
        .json::<Value>()
        .await
        .map_err(|error| AppError::Internal(format!("WHO ICD-11 JSON failed: {error}")))?;
    Ok(Some(payload))
}

async fn who_icd_access_token() -> Result<Option<String>, AppError> {
    let client_id = match std::env::var("WHO_ICD_CLIENT_ID") {
        Ok(value) if !value.trim().is_empty() => value,
        _ => return Ok(None),
    };
    let client_secret = match std::env::var("WHO_ICD_CLIENT_SECRET") {
        Ok(value) if !value.trim().is_empty() => value,
        _ => return Ok(None),
    };
    let token_url =
        std::env::var("WHO_ICD_TOKEN_URL").unwrap_or_else(|_| WHO_ICD_TOKEN_URL.to_owned());

    let client = reqwest::Client::new();
    let response = client
        .post(token_url)
        .basic_auth(client_id, Some(client_secret))
        .form(&[
            ("grant_type", "client_credentials"),
            ("scope", "icdapi_access"),
        ])
        .send()
        .await
        .map_err(|error| AppError::Internal(format!("WHO ICD token request failed: {error}")))?;

    if !response.status().is_success() {
        return Err(AppError::Internal(format!(
            "WHO ICD token endpoint returned status {}",
            response.status()
        )));
    }

    let payload = response
        .json::<Value>()
        .await
        .map_err(|error| AppError::Internal(format!("WHO ICD token JSON failed: {error}")))?;
    Ok(payload
        .get("access_token")
        .and_then(Value::as_str)
        .map(str::to_owned))
}

fn who_icd_requires_auth(base_url: &str) -> bool {
    if let Ok(mode) = std::env::var("WHO_ICD_AUTH_MODE") {
        return !matches!(
            mode.trim().to_lowercase().as_str(),
            "none" | "local" | "disabled"
        );
    }
    base_url.contains("id.who.int")
}

fn who_icd_provider_mode(base_url: &str) -> String {
    if who_icd_requires_auth(base_url) {
        "official_api_cloud".to_owned()
    } else {
        "official_api_local".to_owned()
    }
}

fn is_likely_direct_icd11_code(value: &str) -> bool {
    let code = value.trim().to_uppercase();
    let chars = code.chars().collect::<Vec<_>>();
    if chars.len() < 4 {
        return false;
    }
    if !chars
        .iter()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '.' | '&' | '-'))
    {
        return false;
    }
    let starts_like_icd = (chars[0].is_ascii_digit() && chars[1].is_ascii_alphabetic())
        || (chars[0].is_ascii_alphabetic() && chars[1].is_ascii_alphabetic());
    starts_like_icd && chars.iter().any(char::is_ascii_digit)
}

fn is_likely_complete_icd11_code(value: &str) -> bool {
    let code = value.trim();
    if !is_likely_direct_icd11_code(code) {
        return false;
    }
    code.chars()
        .last()
        .is_some_and(|ch| ch.is_ascii_alphanumeric())
}

fn is_icd11_code_fragment(value: &str) -> bool {
    let query = value.trim();
    if query.chars().count() < 2 {
        return false;
    }
    if !query
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '.' | '&' | '-'))
    {
        return false;
    }
    query
        .chars()
        .any(|ch| ch.is_ascii_digit() || matches!(ch, '.' | '&' | '-'))
        || query.chars().count() <= 3
}

fn normalize_terminology_query(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    if let Some((code, display)) = trimmed.split_once('·') {
        let code = code.trim();
        let display = display.trim();
        if is_icd11_code_fragment(code) {
            return code.to_owned();
        }
        if !display.is_empty() {
            return display.to_owned();
        }
    }

    trimmed.to_owned()
}

fn icd11_search_variants(needle: &str) -> Vec<String> {
    let mut variants = Vec::new();
    push_unique_query_variant(&mut variants, needle);

    if let Some((code, display)) = needle.split_once('·') {
        push_unique_query_variant(&mut variants, code);
        push_unique_query_variant(&mut variants, display);
    }

    for part in needle.split(['&', '/', ',', ';', ':', '(', ')']) {
        push_unique_query_variant(&mut variants, part);
    }

    let tokens = terminology_query_tokens(needle);
    for token in &tokens {
        push_unique_query_variant(&mut variants, token);
        if token.chars().count() == 3 && token.chars().all(char::is_alphabetic) {
            push_unique_query_variant(&mut variants, &trim_suffix_chars(token, 1));
        }
    }

    for window_size in (2..=tokens.len()).rev() {
        for window in tokens.windows(window_size) {
            push_unique_query_variant(&mut variants, &window.join(" "));
        }
    }

    if let Some(singular) = singular_query_variant(needle) {
        push_unique_query_variant(&mut variants, &singular);
    }

    variants
}

fn terminology_query_tokens(value: &str) -> Vec<String> {
    value
        .split(|ch: char| {
            ch.is_whitespace() || matches!(ch, '&' | '/' | ',' | ';' | ':' | '(' | ')' | '·')
        })
        .map(str::trim)
        .filter(|token| token.chars().count() >= 2)
        .map(str::to_owned)
        .collect()
}

fn terminology_relevance_score(needle: &str, row: &TerminologySearchResult) -> i32 {
    let query = needle.trim().to_lowercase();
    let display = row.display.to_lowercase();
    let code = row.code.to_lowercase();
    if query.is_empty() {
        return 100;
    }
    if code == query {
        return 0;
    }
    if code.starts_with(&query) {
        return 1;
    }
    if display == query {
        return 2;
    }
    if display.starts_with(&query) {
        return 3;
    }
    let tokens = terminology_query_tokens(&query);
    if !tokens.is_empty() && tokens.iter().all(|token| display.contains(token)) {
        return 4;
    }
    if tokens.iter().any(|token| display.starts_with(token)) {
        return 5;
    }
    if tokens.iter().any(|token| display.contains(token)) {
        return 6;
    }
    20
}

fn singular_query_variant(value: &str) -> Option<String> {
    let trimmed = value.trim();
    let lower = trimmed.to_lowercase();
    let replacement = match lower.as_str() {
        "teeth" => Some("tooth".to_owned()),
        "feet" => Some("foot".to_owned()),
        "children" => Some("child".to_owned()),
        _ if lower.ends_with("ies") && lower.len() > 4 => {
            Some(format!("{}y", trim_suffix_chars(trimmed, 3)))
        }
        _ if lower.ends_with("ses") && lower.len() > 4 => Some(trim_suffix_chars(trimmed, 2)),
        _ if lower.ends_with('s') && lower.len() > 3 => Some(trim_suffix_chars(trimmed, 1)),
        _ => None,
    }?;
    if replacement.eq_ignore_ascii_case(trimmed) {
        None
    } else {
        Some(replacement)
    }
}

fn trim_suffix_chars(value: &str, count: usize) -> String {
    let keep = value.chars().count().saturating_sub(count);
    value.chars().take(keep).collect()
}

fn push_unique_query_variant(variants: &mut Vec<String>, value: &str) {
    let normalized = value.trim();
    if normalized.len() < 2 && !is_icd11_code_fragment(normalized) {
        return;
    }
    if normalized.is_empty() {
        return;
    }
    if variants
        .iter()
        .any(|existing| existing.eq_ignore_ascii_case(normalized))
    {
        return;
    }
    variants.push(normalized.to_owned());
}

fn push_unique_terminology_row(
    rows: &mut Vec<TerminologySearchResult>,
    seen: &mut HashSet<String>,
    row: TerminologySearchResult,
) {
    let key = format!("{}:{}", row.system, row.code.to_uppercase());
    if seen.insert(key) {
        rows.push(row);
    }
}

fn push_unique_suggestion(suggestions: &mut Vec<String>, value: &str) {
    let Some(suggestion) = normalized_text(value) else {
        return;
    };
    if suggestion.len() < 2 {
        return;
    }
    if suggestions
        .iter()
        .any(|existing| existing.eq_ignore_ascii_case(&suggestion))
    {
        return;
    }
    suggestions.push(suggestion);
}

fn extension_codes_from_code_info(payload: &Value) -> Vec<String> {
    let mut codes = Vec::new();
    let Some(map) = payload.as_object() else {
        return codes;
    };
    for (key, value) in map {
        if matches!(
            key.as_str(),
            "@context" | "@id" | "code" | "stemCode" | "stemId"
        ) {
            continue;
        }
        match value {
            Value::String(text) if is_likely_direct_icd11_code(text) => {
                codes.push(text.to_uppercase());
            }
            Value::Array(values) => {
                for nested in values {
                    if let Some(text) = nested.as_str()
                        && is_likely_direct_icd11_code(text)
                    {
                        codes.push(text.to_uppercase());
                    }
                }
            }
            _ => {}
        }
    }
    codes.sort();
    codes.dedup();
    codes
}

fn encode_path_segment(value: &str) -> String {
    url::form_urlencoded::byte_serialize(value.as_bytes()).collect()
}

fn who_icd_entity_url(base_url: &str, source_url: &str) -> String {
    source_url
        .replacen("http://id.who.int", base_url.trim_end_matches('/'), 1)
        .replacen("https://id.who.int", base_url.trim_end_matches('/'), 1)
}

fn parse_who_icd11_search_response_bundle(
    payload: &Value,
    release: &str,
    provider_mode: &str,
    limit: i64,
) -> Icd11SearchBundle {
    let mut suggestions = Vec::new();
    if let Some(words) = payload.get("words").and_then(Value::as_array) {
        for word in words {
            if let Some(label) = value_text(word.get("label")) {
                push_unique_suggestion(&mut suggestions, &label);
            }
        }
    }

    let Some(entities) = payload
        .get("destinationEntities")
        .or_else(|| payload.get("DestinationEntities"))
        .and_then(Value::as_array)
    else {
        return Icd11SearchBundle {
            rows: Vec::new(),
            suggestions,
        };
    };

    let rows = entities
        .iter()
        .filter_map(|entity| parse_who_icd11_entity(entity, release, provider_mode))
        .take(usize::try_from(limit).unwrap_or(50))
        .collect();

    Icd11SearchBundle { rows, suggestions }
}

fn parse_who_icd11_entity(
    entity: &Value,
    release: &str,
    provider_mode: &str,
) -> Option<TerminologySearchResult> {
    let code = value_text(entity.get("theCode"))
        .or_else(|| value_text(entity.get("code")))
        .or_else(|| last_uri_segment(entity.get("id").or_else(|| entity.get("@id"))?))?;
    let display = value_text(entity.get("title"))
        .or_else(|| value_text(entity.get("label")))
        .or_else(|| value_text(entity.get("bestMatchText")))?;
    let source_url = value_text(entity.get("id"))
        .or_else(|| value_text(entity.get("@id")))
        .or_else(|| value_text(entity.get("foundationUri")));

    Some(TerminologySearchResult {
        system: "icd11".to_owned(),
        code,
        display,
        semantic_tag: None,
        source: "WHO ICD-11 MMS".to_owned(),
        source_url,
        source_version: Some(release.to_owned()),
        active: true,
        provider_mode: provider_mode.to_owned(),
        corpus_entry_id: None,
    })
}

fn value_text(value: Option<&Value>) -> Option<String> {
    match value? {
        Value::String(text) => normalized_text(text),
        Value::Object(map) => map
            .get("@value")
            .or_else(|| map.get("label"))
            .or_else(|| map.get("title"))
            .and_then(|nested| value_text(Some(nested))),
        Value::Array(values) => values.iter().find_map(|nested| value_text(Some(nested))),
        _ => None,
    }
}

fn last_uri_segment(value: &Value) -> Option<String> {
    let text = value_text(Some(value))?;
    text.rsplit('/').next().and_then(normalized_text)
}

fn normalized_text(value: &str) -> Option<String> {
    let cleaned = strip_html(value)
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .trim()
        .to_owned();
    if cleaned.is_empty() {
        None
    } else {
        Some(cleaned)
    }
}

fn strip_html(value: &str) -> String {
    let mut output = String::with_capacity(value.len());
    let mut in_tag = false;
    for ch in value.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => output.push(ch),
            _ => {}
        }
    }
    output
}

async fn search_snomed_cache(
    state: &AppState,
    needle: &str,
    semantic_tag: Option<&str>,
    limit: i64,
) -> Result<Vec<TerminologySearchResult>, AppError> {
    let contains = format!("%{needle}%");
    let starts = format!("{needle}%");

    let rows = sqlx::query_as::<_, TerminologySearchResult>(
        "SELECT \
            'snomed'::text AS system, \
            code, \
            display_name AS display, \
            semantic_tag, \
            'SNOMED CT official release cache'::text AS source, \
            $3::text AS source_url, \
            NULL::text AS source_version, \
            is_active AS active, \
            'official_release_cache'::text AS provider_mode, \
            NULL::uuid AS corpus_entry_id \
         FROM snomed_codes \
         WHERE is_active = true \
           AND ($4::text IS NULL OR semantic_tag = $4) \
           AND (code ILIKE $1 OR display_name ILIKE $1) \
         ORDER BY CASE WHEN code ILIKE $2 THEN 0 ELSE 1 END, display_name ASC \
         LIMIT $5",
    )
    .bind(&contains)
    .bind(&starts)
    .bind(SNOMED_DISTRIBUTION_URL)
    .bind(semantic_tag)
    .bind(limit)
    .fetch_all(&state.db)
    .await?;

    Ok(rows)
}

async fn lookup_snomed_cache(
    state: &AppState,
    code: &str,
) -> Result<Option<TerminologySearchResult>, AppError> {
    let row = sqlx::query_as::<_, TerminologySearchResult>(
        "SELECT \
            'snomed'::text AS system, \
            code, \
            display_name AS display, \
            semantic_tag, \
            'SNOMED CT official release cache'::text AS source, \
            $2::text AS source_url, \
            NULL::text AS source_version, \
            is_active AS active, \
            'official_release_cache'::text AS provider_mode, \
            NULL::uuid AS corpus_entry_id \
         FROM snomed_codes \
         WHERE is_active = true AND code = $1 \
         LIMIT 1",
    )
    .bind(code)
    .bind(SNOMED_DISTRIBUTION_URL)
    .fetch_optional(&state.db)
    .await?;

    Ok(row)
}
