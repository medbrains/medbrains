//! A share link, from the recipient's side.
//!
//! The link's token finds the study; it does not open it. The recipient is
//! sent a one-time code — by SMS to the patient's own phone on record, or to
//! the clinician's phone or email the link was made for — and only a correct
//! code starts a browser session for that link (an `HttpOnly` cookie scoped to
//! the link's path). The viewer and its `DICOMweb` refuse everything without
//! one. A forwarded link is useless without the recipient's phone.
//!
//! Limits: a code lasts ten minutes and survives five wrong tries; a link
//! gets five codes an hour; a session lasts until the link expires, at most
//! twelve hours. A de-identified link scrubs every `DICOM` JSON answer and
//! never serves a whole `DICOM` file ([`crate::deidentify`]).

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use axum::{
    Json,
    extract::{Path, RawQuery, State},
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
};
use chrono::{DateTime, Utc};
use medbrains_server_core::error::AppError;
use medbrains_server_core::state::AppState;
use serde::Deserialize;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::deidentify::{self, RelayKind};
use crate::share::audit;
use crate::viewer::{fetch, requested_study, respond, serve_ohif, tenant_target};

const TOKEN_TTL: Duration = Duration::from_secs(60);
const CACHE_CAP: usize = 5_000;
const CODE_MINUTES: i32 = 10;
const CODE_ATTEMPTS: i32 = 5;
const CODES_PER_HOUR: i64 = 5;
const SESSION_HOURS: i64 = 12;
const COOKIE: &str = "mb_share";

pub(crate) fn public_base(token: &str) -> String {
    format!("/api/public/radiology/share/{token}")
}

/// Where the recipient lands: the page that asks for the code.
#[must_use]
pub fn landing_path(token: &str) -> String {
    format!("/shared-images/{token}")
}

fn viewer_path(token: &str, uid: &str) -> String {
    format!("{}/ohif/viewer?StudyInstanceUIDs={uid}", public_base(token))
}

/// What a live token opens, and how its recipient is reached.
#[derive(Debug, Clone)]
pub(crate) struct Shared {
    pub link_id: Uuid,
    pub tenant_id: Uuid,
    pub uid: String,
    pub expires_at: DateTime<Utc>,
    pub recipient_name: Option<String>,
    pub recipient_kind: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub deidentify: bool,
}

#[derive(sqlx::FromRow)]
struct LinkRow {
    uid: String,
    recipient_name: Option<String>,
    recipient_kind: String,
    recipient_phone: Option<String>,
    recipient_email: Option<String>,
    deidentify: bool,
}

type Cache<V> = OnceLock<Mutex<HashMap<String, (Instant, V)>>>;
pub(crate) static TOKENS: Cache<Shared> = OnceLock::new();
static SESSIONS: Cache<Uuid> = OnceLock::new();

fn cached<V: Clone>(cache: &Cache<V>, key: &str) -> Option<V> {
    let map = cache.get_or_init(Mutex::default).lock().ok()?;
    map.get(key)
        .filter(|(at, _)| at.elapsed() < TOKEN_TTL)
        .map(|(_, v)| v.clone())
}

fn remember<V>(cache: &Cache<V>, key: String, value: V) {
    if let Ok(mut map) = cache.get_or_init(Mutex::default).lock() {
        if map.len() >= CACHE_CAP {
            map.clear();
        }
        map.insert(key, (Instant::now(), value));
    }
}

pub(crate) fn forget_token(token: &str) {
    if let Ok(mut map) = TOKENS.get_or_init(Mutex::default).lock() {
        map.remove(token);
    }
}

async fn resolve(state: &AppState, token: &str) -> Result<Shared, AppError> {
    if let Some(shared) = cached(&TOKENS, token).filter(|s| s.expires_at > Utc::now()) {
        return Ok(shared);
    }
    // The token is how the tenant is found: a SECURITY DEFINER lookup that
    // returns nothing for an expired or revoked link.
    let (link_id, tenant_id, _study, expires_at) =
        sqlx::query_as::<_, (Uuid, Uuid, Uuid, DateTime<Utc>)>(
            "SELECT id, tenant_id, study_id, expires_at FROM public.app_share_link_by_token($1)",
        )
        .bind(token)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;
    let mut conn = medbrains_db::pool::tenant_conn(&state.db, &tenant_id).await?;
    let row = sqlx::query_as::<_, LinkRow>(
        "SELECT s.study_instance_uid AS uid, l.recipient_name, l.recipient_kind, \
                l.recipient_phone, l.recipient_email, l.deidentify \
           FROM radiology_share_links l \
           JOIN radiology_dicom_studies s ON s.id = l.study_id AND s.tenant_id = l.tenant_id \
          WHERE l.id = $1 AND l.tenant_id = $2 AND s.deleted_at IS NULL",
    )
    .bind(link_id)
    .bind(tenant_id)
    .fetch_optional(&mut *conn)
    .await?
    .ok_or(AppError::NotFound)?;
    let shared = Shared {
        link_id,
        tenant_id,
        uid: row.uid,
        expires_at,
        recipient_name: row.recipient_name,
        recipient_kind: row.recipient_kind,
        phone: row.recipient_phone,
        email: row.recipient_email,
        deidentify: row.deidentify,
    };
    remember(&TOKENS, token.to_owned(), shared.clone());
    Ok(shared)
}

fn hash(link_id: Uuid, secret: &str) -> String {
    hex::encode(Sha256::digest(format!("{link_id}:{secret}").as_bytes()))
}

fn random_digits() -> Result<String, AppError> {
    let mut buf = [0u8; 4];
    getrandom::fill(&mut buf).map_err(|e| AppError::Internal(format!("code: {e}")))?;
    Ok(format!("{:06}", u32::from_le_bytes(buf) % 1_000_000))
}

fn random_secret() -> Result<String, AppError> {
    let mut buf = [0u8; 32];
    getrandom::fill(&mut buf).map_err(|e| AppError::Internal(format!("session: {e}")))?;
    Ok(hex::encode(buf))
}

/// `98•••••210` / `d•••@example.org` — enough to recognise, not to read.
#[must_use]
pub fn mask(destination: &str) -> String {
    if let Some((user, domain)) = destination.split_once('@') {
        let first: String = user.chars().take(1).collect();
        return format!("{first}•••@{domain}");
    }
    let digits: Vec<char> = destination.chars().filter(char::is_ascii_digit).collect();
    let n = digits.len();
    if n < 6 {
        return "•••".to_owned();
    }
    let head: String = digits[..2].iter().collect();
    let tail: String = digits[n - 3..].iter().collect();
    format!("{head}•••••{tail}")
}

/// `GET /api/public/radiology/viewer/{token}` — what the landing page shows
/// before a code: who the link is for and where the code will go. No PHI.
pub async fn validate_share_link(
    State(state): State<AppState>,
    Path(token): Path<String>,
) -> Result<Json<Value>, AppError> {
    let shared = resolve(&state, &token).await?;
    let destination = shared
        .phone
        .as_deref()
        .or(shared.email.as_deref())
        .map(mask);
    Ok(Json(json!({
        // A patient's own link must not name them to whoever holds it.
        "recipient_name": (shared.recipient_kind == "clinician")
            .then_some(shared.recipient_name.as_deref())
            .flatten(),
        "recipient_kind": shared.recipient_kind,
        "code_sent_to": destination,
        "deidentified": shared.deidentify,
        "expires_at": shared.expires_at,
    })))
}

/// `POST /api/public/radiology/share/{token}/code` — send a one-time code to
/// the link's recipient.
pub async fn send_share_code(
    State(state): State<AppState>,
    Path(token): Path<String>,
) -> Result<Json<Value>, AppError> {
    let shared = resolve(&state, &token).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &shared.tenant_id).await?;
    let recent: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM radiology_share_otps \
          WHERE link_id = $1 AND tenant_id = $2 AND created_at > now() - interval '1 hour'",
    )
    .bind(shared.link_id)
    .bind(shared.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    if recent >= CODES_PER_HOUR {
        return Err(AppError::TooManyRequests(
            "Too many codes for this link — try again in an hour".to_owned(),
        ));
    }
    let code = random_digits()?;
    // Only the newest code works.
    sqlx::query(
        "UPDATE radiology_share_otps SET used_at = now() \
          WHERE link_id = $1 AND tenant_id = $2 AND used_at IS NULL",
    )
    .bind(shared.link_id)
    .bind(shared.tenant_id)
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "INSERT INTO radiology_share_otps (tenant_id, link_id, code_hash, expires_at) \
         VALUES ($1, $2, $3, now() + make_interval(mins => $4))",
    )
    .bind(shared.tenant_id)
    .bind(shared.link_id)
    .bind(hash(shared.link_id, &code))
    .bind(CODE_MINUTES)
    .execute(&mut *tx)
    .await?;
    let text = format!(
        "Your code to view the shared medical images is {code}. It is valid for \
         {CODE_MINUTES} minutes. Do not share it."
    );
    let (event, payload, to) = match (&shared.phone, &shared.email) {
        (Some(phone), _) => (
            "sms.radiology_share_code",
            json!({ "to": phone, "body": text }),
            phone,
        ),
        (None, Some(email)) => (
            "email.radiology_share_code",
            json!({ "to": email, "subject": "Your code to view shared images", "text": text,
                    "html": format!("<p>{text}</p>") }),
            email,
        ),
        (None, None) => return Err(AppError::NotFound),
    };
    medbrains_outbox::queue_in_tx(
        &mut tx,
        medbrains_outbox::queue::OutboxRow {
            tenant_id: shared.tenant_id,
            aggregate_type: "radiology_share_link",
            aggregate_id: Some(shared.link_id),
            event_type: event,
            payload,
            idempotency_key: None,
        },
    )
    .await
    .map_err(|e| AppError::Internal(format!("queue share code: {e}")))?;
    tx.commit().await?;
    Ok(Json(json!({ "sent_to": mask(to) })))
}

#[derive(Debug, Deserialize)]
pub struct VerifyShareCode {
    pub code: String,
}

/// `POST /api/public/radiology/share/{token}/verify` — a correct code starts a
/// session for this link and returns the viewer's address.
pub async fn verify_share_code(
    State(state): State<AppState>,
    Path(token): Path<String>,
    Json(body): Json<VerifyShareCode>,
) -> Result<Response, AppError> {
    let shared = resolve(&state, &token).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &shared.tenant_id).await?;
    let code: Option<(Uuid, String, i32)> = sqlx::query_as(
        "SELECT id, code_hash, attempts FROM radiology_share_otps \
          WHERE link_id = $1 AND tenant_id = $2 AND used_at IS NULL AND expires_at > now() \
          ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
    )
    .bind(shared.link_id)
    .bind(shared.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    let refused = || AppError::BadRequest("That code is not right, or it has expired".to_owned());
    let Some((code_id, code_hash, attempts)) = code else {
        tx.commit().await?;
        return Err(refused());
    };
    if attempts >= CODE_ATTEMPTS || hash(shared.link_id, body.code.trim()) != code_hash {
        // Five wrong tries burn the code: it is no longer a secret.
        sqlx::query(
            "UPDATE radiology_share_otps SET attempts = attempts + 1, \
                    used_at = CASE WHEN attempts + 1 >= $2 THEN now() ELSE used_at END \
              WHERE id = $1",
        )
        .bind(code_id)
        .bind(CODE_ATTEMPTS)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        return Err(refused());
    }
    sqlx::query("UPDATE radiology_share_otps SET used_at = now() WHERE id = $1")
        .bind(code_id)
        .execute(&mut *tx)
        .await?;
    let secret = random_secret()?;
    let expires = shared
        .expires_at
        .min(Utc::now() + chrono::Duration::hours(SESSION_HOURS));
    let session: Uuid = sqlx::query_scalar(
        "INSERT INTO radiology_share_sessions (tenant_id, link_id, secret_hash, expires_at) \
         VALUES ($1, $2, $3, $4) RETURNING id",
    )
    .bind(shared.tenant_id)
    .bind(shared.link_id)
    .bind(hash(shared.link_id, &secret))
    .bind(expires)
    .fetch_one(&mut *tx)
    .await?;
    audit(
        &mut tx,
        shared.tenant_id,
        None,
        "radiology.share_link.verified",
        shared.link_id,
        &json!({}),
    )
    .await?;
    tx.commit().await?;
    let max_age = (expires - Utc::now()).num_seconds().max(0);
    let cookie = format!(
        "{COOKIE}={session}.{secret}; Path={}/; Max-Age={max_age}; HttpOnly; Secure; SameSite=Lax",
        public_base(&token)
    );
    let mut response =
        Json(json!({ "viewer_url": viewer_path(&token, &shared.uid) })).into_response();
    response.headers_mut().insert(
        header::SET_COOKIE,
        HeaderValue::from_str(&cookie).map_err(|e| AppError::Internal(format!("cookie: {e}")))?,
    );
    Ok(response)
}

/// The session cookie, if it is a live session for this link.
async fn has_session(
    state: &AppState,
    shared: &Shared,
    headers: &HeaderMap,
) -> Result<bool, AppError> {
    let Some(value) = headers
        .get_all(header::COOKIE)
        .iter()
        .filter_map(|v| v.to_str().ok())
        .flat_map(|v| v.split(';'))
        .find_map(|c| {
            c.trim()
                .strip_prefix(&format!("{COOKIE}="))
                .map(str::to_owned)
        })
    else {
        return Ok(false);
    };
    if cached(&SESSIONS, &value) == Some(shared.link_id) {
        return Ok(true);
    }
    let Some((id, secret)) = value.split_once('.') else {
        return Ok(false);
    };
    let Ok(id) = Uuid::parse_str(id) else {
        return Ok(false);
    };
    let mut conn = medbrains_db::pool::tenant_conn(&state.db, &shared.tenant_id).await?;
    let live: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM radiology_share_sessions \
          WHERE id = $1 AND link_id = $2 AND tenant_id = $3 AND secret_hash = $4 \
            AND expires_at > now() AND deleted_at IS NULL)",
    )
    .bind(id)
    .bind(shared.link_id)
    .bind(shared.tenant_id)
    .bind(hash(shared.link_id, secret))
    .fetch_one(&mut *conn)
    .await?;
    if live {
        remember(&SESSIONS, value, shared.link_id);
    }
    Ok(live)
}

/// Count and audit one open of a shared study (the viewer page, not each
/// frame it then loads).
async fn record_open(state: &AppState, shared: &Shared) -> Result<(), AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &shared.tenant_id).await?;
    sqlx::query("SELECT public.app_share_link_touch($1, $2)")
        .bind(shared.link_id)
        .bind(shared.tenant_id)
        .execute(&mut *tx)
        .await?;
    let values = json!({ "study_instance_uid": shared.uid, "deidentified": shared.deidentify });
    audit(
        &mut tx,
        shared.tenant_id,
        None,
        "radiology.share_link.open",
        shared.link_id,
        &values,
    )
    .await?;
    tx.commit().await?;
    Ok(())
}

/// `GET /api/public/radiology/share/{token}/ohif/` — the viewer's entry page.
pub async fn public_ohif_index(
    State(state): State<AppState>,
    Path(token): Path<String>,
    RawQuery(query): RawQuery,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    shared_ohif(&state, &token, "", query.as_deref(), &headers).await
}

/// `GET /api/public/radiology/share/{token}/ohif/{*rest}` — the viewer's
/// pages and files.
pub async fn public_ohif(
    State(state): State<AppState>,
    Path((token, rest)): Path<(String, String)>,
    RawQuery(query): RawQuery,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    shared_ohif(&state, &token, &rest, query.as_deref(), &headers).await
}

async fn shared_ohif(
    state: &AppState,
    token: &str,
    rest: &str,
    query: Option<&str>,
    headers: &HeaderMap,
) -> Result<Response, AppError> {
    let shared = resolve(state, token).await?;
    let is_page = !rest.rsplit('/').next().is_some_and(|f| f.contains('.'));
    if !has_session(state, &shared, headers).await? {
        // The page goes to where the code is asked for; anything else is refused.
        if is_page {
            return Ok((
                StatusCode::SEE_OTHER,
                [(header::LOCATION, landing_path(token))],
            )
                .into_response());
        }
        return Err(AppError::Unauthorized);
    }
    if is_page {
        record_open(state, &shared).await?;
    }
    let target = tenant_target(state, shared.tenant_id).await?;
    serve_ohif(
        &target,
        rest,
        query,
        headers,
        &format!("{}/ohif/", public_base(token)),
    )
    .await
}

/// `GET /api/public/radiology/share/{token}/dicom-web/{*rest}` — the shared
/// study's `DICOMweb`, and nothing else; scrubbed when the link is
/// de-identified.
pub async fn public_dicomweb(
    State(state): State<AppState>,
    Path((token, rest)): Path<(String, String)>,
    RawQuery(query): RawQuery,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    let shared = resolve(&state, &token).await?;
    if !has_session(&state, &shared, &headers).await? {
        return Err(AppError::Unauthorized);
    }
    let uid = requested_study(&rest, query.as_deref()).ok_or(AppError::NotFound)?;
    if uid != shared.uid {
        return Err(AppError::NotFound);
    }
    let target = tenant_target(&state, shared.tenant_id).await?;
    let path = format!("/dicom-web/{}", rest.trim_start_matches('/'));
    let mut fetched = fetch(&target, &path, query.as_deref(), &headers).await?;
    if shared.deidentify && fetched.status.is_success() {
        let ct = fetched
            .content_type
            .as_ref()
            .and_then(|v| v.to_str().ok())
            .unwrap_or_default();
        match deidentify::relay_kind(ct) {
            Some(RelayKind::Pixels) => {}
            Some(RelayKind::Json) => {
                let pseudonym = format!("SHARE-{}", &shared.link_id.simple().to_string()[..8]);
                fetched.body = deidentify::scrub_json(&fetched.body, &pseudonym)
                    .ok_or(AppError::Forbidden)?
                    .into();
            }
            None => return Err(AppError::Forbidden),
        }
    }
    respond(fetched)
}

#[cfg(test)]
mod tests {
    use super::{landing_path, mask};

    #[test]
    fn a_destination_is_recognisable_not_readable() {
        assert_eq!(mask("+91 98450 12210"), "91•••••210");
        assert_eq!(mask("dr.rao@cityhospital.in"), "d•••@cityhospital.in");
        assert_eq!(mask("123"), "•••");
        assert_eq!(landing_path("abc"), "/shared-images/abc");
    }
}
