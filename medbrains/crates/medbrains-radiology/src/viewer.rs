//! The image viewer, behind `MedBrains` sign-in.
//!
//! The hospital's Orthanc sits on its own network; a browser outside it (a
//! consultant at home, a ward over the VPN-less Wi-Fi, a patient's referral)
//! could not reach it, and inside it every viewer shared one PACS login with
//! no record of who opened what. Now the browser talks only to `MedBrains`:
//!
//! - the OHIF viewer (Orthanc's OHIF plugin, MIT) is served through
//!   `/api/radiology/pacs/ohif/`, with its config rewritten so it can only
//!   open the study it was given — no study list;
//! - its `DICOMweb` requests go through `/api/radiology/pacs/dicom-web/`, and
//!   every one names a study that is checked against the caller's access to
//!   that study's patient (memoised for a minute, allowed answers only);
//! - opening a study is an audited event (`radiology.study.view`).
//!
//! Anything that is not a single study by its UID is refused: a `DICOMweb`
//! query without a UID would list every patient in the PACS.

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use axum::{
    Extension, Json,
    body::Body,
    extract::{Path, RawQuery, State},
    http::{HeaderMap, StatusCode, header},
    response::Response,
};
use medbrains_core::permissions;
use medbrains_outbox::handlers::pacs_target::{self, PacsError, Policy, Target};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde_json::{Value, json};
use uuid::Uuid;

/// Where the viewer is served for signed-in staff.
pub const STAFF_BASE: &str = "/api/radiology/pacs";
const CACHE_TTL: Duration = Duration::from_secs(60);
/// Entries kept per cache before it is cleared; a minute of a busy hospital.
const CACHE_CAP: usize = 10_000;
/// The largest single PACS response relayed. A frame or a series' metadata
/// is far smaller; a whole-study retrieve is not something the viewer asks.
// ponytail: buffered, not streamed; stream with reqwest's `stream` feature
// if a site's studies outgrow this.
const MAX_RELAY_BYTES: u64 = 256 * 1024 * 1024;
const MAX_UID_LEN: usize = 64;

type Cache<K, V> = OnceLock<Mutex<HashMap<K, (Instant, V)>>>;

static TARGETS: Cache<Uuid, Target> = OnceLock::new();
static ALLOWED: Cache<(Uuid, Uuid, String), ()> = OnceLock::new();

fn cached<K: std::hash::Hash + Eq, V: Clone>(cache: &Cache<K, V>, key: &K) -> Option<V> {
    let map = cache.get_or_init(Mutex::default).lock().ok()?;
    map.get(key)
        .filter(|(at, _)| at.elapsed() < CACHE_TTL)
        .map(|(_, v)| v.clone())
}

fn remember<K: std::hash::Hash + Eq, V>(cache: &Cache<K, V>, key: K, value: V) {
    if let Ok(mut map) = cache.get_or_init(Mutex::default).lock() {
        if map.len() >= CACHE_CAP {
            map.clear();
        }
        map.insert(key, (Instant::now(), value));
    }
}

/// A DICOM UID: digits and dots, at most 64 characters.
#[must_use]
pub fn is_uid(s: &str) -> bool {
    s.len() <= MAX_UID_LEN
        && s.split('.')
            .all(|part| !part.is_empty() && part.bytes().all(|b| b.is_ascii_digit()))
}

/// A relayed path: plain segments only. `..` would let the PACS's URL
/// normalisation walk out of the study; `?`, `#` or `%` would smuggle a query.
#[must_use]
pub fn is_plain_path(rest: &str) -> bool {
    rest.trim_start_matches('/').split('/').all(|seg| {
        !seg.is_empty()
            && seg != "."
            && seg != ".."
            && seg
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'-' | b'_'))
    })
}

/// The one study a `DICOMweb` request is about, or `None` when it is not
/// about exactly one study by UID — which is refused.
#[must_use]
pub fn requested_study(rest: &str, query: Option<&str>) -> Option<String> {
    if !is_plain_path(rest) {
        return None;
    }
    let mut parts = rest.trim_start_matches('/').splitn(3, '/');
    if parts.next()? != "studies" {
        return None;
    }
    if let Some(uid) = parts.next() {
        return is_uid(uid).then(|| uid.to_owned());
    }
    // QIDO search: only a single, exact StudyInstanceUID.
    let mut uids = query?
        .split('&')
        .filter_map(|kv| kv.split_once('='))
        .filter(|(k, _)| k.eq_ignore_ascii_case("StudyInstanceUID") || *k == "0020000D");
    let (_, uid) = uids.next()?;
    (uids.next().is_none() && is_uid(uid)).then(|| uid.to_owned())
}

/// The tenant's PACS, vetted, memoised for a minute.
///
/// # Errors
/// 404 when the hospital has no PACS; 503 when it cannot be used.
pub async fn tenant_target(state: &AppState, tenant_id: Uuid) -> Result<Target, AppError> {
    if let Some(target) = cached(&TARGETS, &tenant_id) {
        return Ok(target);
    }
    let mut conn = medbrains_db::pool::tenant_conn(&state.db, &tenant_id).await?;
    let config: Option<Value> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings WHERE tenant_id = $1 AND category = 'radiology' \
           AND key = 'pacs_config' AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .fetch_optional(&mut *conn)
    .await?;
    let config = config.ok_or(AppError::NotFound)?;
    let target = pacs_target::target_from_config(
        tenant_id,
        &config,
        state.secret_resolver.as_ref(),
        &Policy::from_env(),
    )
    .await
    .map_err(|e| match e {
        PacsError::Db(e) => AppError::Internal(format!("PACS settings: {e}")),
        other => AppError::ServiceUnavailable(other.to_string()),
    })?
    .ok_or(AppError::NotFound)?;
    remember(&TARGETS, tenant_id, target.clone());
    Ok(target)
}

/// One PACS answer, read whole.
#[derive(Debug)]
pub struct Fetched {
    pub status: StatusCode,
    pub content_type: Option<header::HeaderValue>,
    pub body: axum::body::Bytes,
}

/// GET from the PACS, passing on only what the client will accept.
///
/// # Errors
/// 503 when the PACS is unreachable or its answer is too large to relay.
pub async fn fetch(
    target: &Target,
    path: &str,
    query: Option<&str>,
    headers: &HeaderMap,
) -> Result<Fetched, AppError> {
    let url = query.map_or_else(|| path.to_owned(), |q| format!("{path}?{q}"));
    let mut request = target.get(&url);
    if let Some(accept) = headers.get(header::ACCEPT).and_then(|v| v.to_str().ok()) {
        request = request.header("accept", accept);
    }
    let upstream = request
        .send()
        .await
        .map_err(|e| AppError::ServiceUnavailable(format!("PACS unreachable: {e}")))?;
    if upstream
        .content_length()
        .is_some_and(|n| n > MAX_RELAY_BYTES)
    {
        return Err(AppError::ServiceUnavailable(
            "PACS answer too large to relay".to_owned(),
        ));
    }
    let status =
        StatusCode::from_u16(upstream.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
    let content_type = upstream.headers().get("content-type").cloned();
    let body = upstream
        .bytes()
        .await
        .map_err(|e| AppError::ServiceUnavailable(format!("PACS answer cut off: {e}")))?;
    Ok(Fetched {
        status,
        content_type,
        body,
    })
}

/// Hand a PACS answer on. Only the content type crosses back; nothing the
/// PACS sets about cookies or caching does, and PHI is never cached.
///
/// # Errors
/// When the response cannot be built.
pub fn respond(fetched: Fetched) -> Result<Response, AppError> {
    let mut response = Response::builder()
        .status(fetched.status)
        .header(header::CACHE_CONTROL, "no-store");
    if let Some(ct) = fetched.content_type {
        response = response.header(header::CONTENT_TYPE, ct);
    }
    response
        .body(Body::from(fetched.body))
        .map_err(|e| AppError::Internal(format!("viewer response: {e}")))
}

/// Relay one GET to the PACS.
///
/// # Errors
/// As [`fetch`].
pub async fn relay(
    target: &Target,
    path: &str,
    query: Option<&str>,
    headers: &HeaderMap,
) -> Result<Response, AppError> {
    respond(fetch(target, path, query, headers).await?)
}

fn text_response(content_type: &'static str, body: String) -> Result<Response, AppError> {
    Response::builder()
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CACHE_CONTROL, "no-store")
        .body(Body::from(body))
        .map_err(|e| AppError::Internal(format!("viewer response: {e}")))
}

/// The inline scripts of OHIF's index page, which the CSP would block.
fn inline_scripts(html: &str) -> (String, String) {
    let (mut page, mut scripts, mut rest) = (String::new(), String::new(), html);
    while let Some(start) = rest.find("<script>") {
        let Some(len) = rest[start..].find("</script>") else {
            break;
        };
        page.push_str(&rest[..start]);
        scripts.push_str(&rest[start + "<script>".len()..start + len]);
        scripts.push('\n');
        rest = &rest[start + len + "</script>".len()..];
    }
    page.push_str(rest);
    (page, scripts)
}

/// OHIF's index with its inline script moved to `medbrains-init.js`, so the
/// page runs under the same script policy as the rest of `MedBrains`.
#[must_use]
pub fn rewrite_index(html: &str) -> String {
    let (page, scripts) = inline_scripts(html);
    if scripts.is_empty() {
        return page;
    }
    page.replacen(
        "<head>",
        "<head><script src=\"./medbrains-init.js\"></script>",
        1,
    )
}

/// OHIF's config, pinned to where we serve it and to the one study it was
/// opened for: no study list.
#[must_use]
pub fn rewrite_config(js: &str, basename: &str) -> String {
    format!(
        "{js}\nwindow.config.routerBasename = '{basename}';\nwindow.config.showStudyList = false;\n"
    )
}

/// Serve OHIF's files from the PACS through `base` (`…/ohif/`).
///
/// # Errors
/// As [`relay`].
pub async fn serve_ohif(
    target: &Target,
    rest: &str,
    query: Option<&str>,
    headers: &HeaderMap,
    basename: &str,
) -> Result<Response, AppError> {
    let rest = rest.trim_start_matches('/');
    // The viewer's files only — never a walk out of `/ohif/` into the PACS's
    // own API, which answers for every patient it holds.
    if !rest.is_empty() && !is_plain_path(rest) {
        return Err(AppError::NotFound);
    }
    let fetch_text = |path: String| async move {
        let page = target
            .get(&path)
            .send()
            .await
            .map_err(|e| AppError::ServiceUnavailable(format!("PACS unreachable: {e}")))?;
        page.text()
            .await
            .map_err(|e| AppError::ServiceUnavailable(format!("PACS answer cut off: {e}")))
    };
    match rest {
        "app-config.js" => text_response(
            "application/javascript",
            rewrite_config(
                &fetch_text("/ohif/app-config.js".to_owned()).await?,
                basename,
            ),
        ),
        "medbrains-init.js" => text_response(
            "application/javascript",
            inline_scripts(&fetch_text("/ohif/".to_owned()).await?).1,
        ),
        // A file has an extension; anything else is one of OHIF's routes.
        r if r.rsplit('/').next().is_some_and(|f| f.contains('.')) => {
            relay(target, &format!("/ohif/{r}"), query, headers).await
        }
        _ => text_response(
            "text/html; charset=utf-8",
            rewrite_index(&fetch_text("/ohif/".to_owned()).await?),
        ),
    }
}

/// May this caller see this study's patient? Allowed answers are memoised
/// for a minute so a viewer's many frame requests cost one check.
async fn authorize_study(state: &AppState, claims: &Claims, uid: &str) -> Result<(), AppError> {
    let key = (claims.tenant_id, claims.sub, uid.to_owned());
    if cached(&ALLOWED, &key).is_some() {
        return Ok(());
    }
    let mut conn = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let patient: Uuid = sqlx::query_scalar(
        "SELECT patient_id FROM radiology_dicom_studies \
          WHERE tenant_id = $1 AND study_instance_uid = $2 AND deleted_at IS NULL",
    )
    .bind(claims.tenant_id)
    .bind(uid)
    .fetch_optional(&mut *conn)
    .await?
    .ok_or(AppError::NotFound)?;
    drop(conn);
    medbrains_authz_gate::require_patient_access(state, claims, patient).await?;
    remember(&ALLOWED, key, ());
    Ok(())
}

/// `GET /api/radiology/pacs/dicom-web/{*rest}` — one study's `DICOMweb`.
pub async fn staff_dicomweb(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(rest): Path<String>,
    RawQuery(query): RawQuery,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    require_permission(&claims, permissions::radiology::orders::VIEW)?;
    let uid = requested_study(&rest, query.as_deref()).ok_or(AppError::Forbidden)?;
    authorize_study(&state, &claims, &uid).await?;
    let target = tenant_target(&state, claims.tenant_id).await?;
    relay(
        &target,
        &format!("/dicom-web/{}", rest.trim_start_matches('/')),
        query.as_deref(),
        &headers,
    )
    .await
}

/// `GET /api/radiology/pacs/ohif/{*rest}` — the viewer's own files.
pub async fn staff_ohif(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    rest: Option<Path<String>>,
    RawQuery(query): RawQuery,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    require_permission(&claims, permissions::radiology::orders::VIEW)?;
    let target = tenant_target(&state, claims.tenant_id).await?;
    let rest = rest.map(|Path(r)| r).unwrap_or_default();
    serve_ohif(
        &target,
        &rest,
        query.as_deref(),
        &headers,
        &format!("{STAFF_BASE}/ohif/"),
    )
    .await
}

/// `POST /api/radiology/dicom-studies/{id}/view` — open a study in the
/// viewer. Checks the patient, records who opened it, and returns where.
pub async fn open_study_viewer(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(study_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::radiology::orders::VIEW)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::RADIOLOGY_DICOM_STUDY,
        study_id,
    )
    .await?;
    // Say so now if there is no PACS to open, not as a blank viewer.
    tenant_target(&state, claims.tenant_id)
        .await
        .map_err(|e| match e {
            AppError::NotFound => AppError::Conflict(
                "No PACS is connected — set one in Radiology → Modalities → PACS".to_owned(),
            ),
            other => other,
        })?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (uid, patient_id): (String, Uuid) = sqlx::query_as(
        "SELECT study_instance_uid, patient_id FROM radiology_dicom_studies \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(study_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let values = json!({ "patient_id": patient_id, "study_instance_uid": uid });
    medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "radiology.study.view",
            entity_type: "radiology_dicom_study",
            entity_id: Some(study_id),
            old_values: None,
            new_values: Some(&values),
            ip_address: None,
        },
    )
    .await?;
    tx.commit().await?;
    remember(&ALLOWED, (claims.tenant_id, claims.sub, uid.clone()), ());
    Ok(Json(json!({
        "viewer_url": format!("{STAFF_BASE}/ohif/viewer?StudyInstanceUIDs={uid}"),
    })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_a_single_study_by_uid_is_relayed() {
        assert_eq!(
            requested_study("studies/1.2.840.1/series", None).as_deref(),
            Some("1.2.840.1")
        );
        assert_eq!(
            requested_study("studies", Some("StudyInstanceUID=1.2.3&includefield=all")).as_deref(),
            Some("1.2.3")
        );
        // A search that is not one exact study would list other patients.
        assert_eq!(requested_study("studies", None), None);
        assert_eq!(requested_study("studies", Some("PatientName=*")), None);
        assert_eq!(
            requested_study("studies", Some("StudyInstanceUID=1.2.*")),
            None
        );
        assert_eq!(
            requested_study("studies", Some("StudyInstanceUID=1.2,1.3")),
            None
        );
        assert_eq!(
            requested_study("studies", Some("StudyInstanceUID=1.2&StudyInstanceUID=1.3")),
            None
        );
        assert_eq!(
            requested_study("series", Some("StudyInstanceUID=1.2")),
            None
        );
        assert_eq!(requested_study("studies/../patients", None), None);
        assert_eq!(requested_study("studies/1.2.3/../../patients", None), None);
        assert_eq!(requested_study("studies/1.2.3/series%3Fx", None), None);
        assert_eq!(requested_study("studies/1..2", None), None);
        assert!(!is_plain_path("../patients") && !is_plain_path("assets/../../tools"));
        assert!(is_plain_path("assets/favicon-16x16.png") && is_plain_path("app.bundle.cf73.js"));
    }

    #[test]
    fn the_viewer_page_runs_without_inline_script() {
        let html = "<html><head><meta/><script>window.PUBLIC_URL = './';</script></head>\
                    <body><script src=\"./app.js\"></script></body></html>";
        let page = rewrite_index(html);
        assert!(!page.contains("window.PUBLIC_URL"));
        assert!(page.contains("<script src=\"./medbrains-init.js\"></script>"));
        assert!(page.contains("<script src=\"./app.js\"></script>"));
        assert_eq!(inline_scripts(html).1.trim(), "window.PUBLIC_URL = './';");
    }

    #[test]
    fn the_config_cannot_browse_the_study_list() {
        let js = rewrite_config("window.config = { showStudyList: true };", "/x/ohif/");
        assert!(js.ends_with(
            "window.config.routerBasename = '/x/ohif/';\nwindow.config.showStudyList = false;\n"
        ));
    }
}
