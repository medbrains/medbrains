//! A throwaway HTTP server so the HTTP Request node can be tested against real
//! sockets, real status codes and real content types rather than a mock.

#![allow(dead_code, unreachable_pub, clippy::expect_used, clippy::unwrap_used)]
// A route table is a list, not a function with branches to follow. Splitting
// one at sixty lines makes the fixtures harder to read, not easier.
#![allow(clippy::too_many_lines)]

use axum::extract::Query;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde_json::{Value, json};
use std::collections::BTreeMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;

/// A running fake API. Dropping it leaves the task to die with the runtime.
pub struct FakeApi {
    pub base: String,
    /// How many times `/flaky` has been hit.
    pub hits: Arc<AtomicUsize>,
    /// How many times any `/paged/*` route has been hit — the number of
    /// requests a paginating node actually made.
    pub requests: Arc<AtomicUsize>,
}

impl FakeApi {
    pub fn requests(&self) -> usize {
        self.requests.load(Ordering::SeqCst)
    }
}

impl FakeApi {
    pub fn url(&self, path: &str) -> String {
        format!("{}{path}", self.base)
    }
}

/// Bind to an ephemeral port and serve the fixtures below.
pub async fn start() -> FakeApi {
    let hits = Arc::new(AtomicUsize::new(0));
    let counter = hits.clone();

    let app = Router::new()
        .route("/users", get(users))
        .route("/echo", post(echo))
        .route("/text", get(|| async { "plain text body" }))
        .route(
            "/not-json",
            get(|| async {
                // Claims JSON, sends garbage — the classic broken-API case.
                (
                    [(axum::http::header::CONTENT_TYPE, "application/json")],
                    "{ not json",
                )
                    .into_response()
            }),
        )
        .route(
            "/boom",
            get(|| async { (StatusCode::INTERNAL_SERVER_ERROR, "upstream exploded") }),
        )
        .route(
            "/teapot",
            get(|| async { (StatusCode::IM_A_TEAPOT, Json(json!({ "no": "coffee" }))) }),
        )
        .route(
            "/slow",
            get(|| async {
                tokio::time::sleep(Duration::from_millis(400)).await;
                "eventually"
            }),
        )
        .route(
            "/flaky",
            get(move || {
                let counter = counter.clone();
                async move {
                    // Fails the first two calls, then succeeds — a rate limiter.
                    let n = counter.fetch_add(1, Ordering::SeqCst);
                    if n < 2 {
                        (StatusCode::TOO_MANY_REQUESTS, "slow down").into_response()
                    } else {
                        Json(json!({ "ok": true, "attempt": n + 1 })).into_response()
                    }
                }
            }),
        );

    let requests = Arc::new(AtomicUsize::new(0));
    let app = app
        .merge(paged_routes(&requests))
        .merge(throttle_routes())
        .merge(lookup_routes())
        .merge(binary_routes());

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind ephemeral port");
    let address = listener.local_addr().expect("local address");
    tokio::spawn(async move {
        let _ = axum::serve(listener, app).await;
    });

    FakeApi {
        base: format!("http://{address}"),
        hits,
        requests,
    }
}

/// A directory of 250 patients, served four different ways.
///
/// Every real API paginates; almost none of them paginate the same way. These
/// four are the shapes worth supporting, each serving the same records so a
/// test can assert that the workflow ends up with all 250 regardless.
pub const DIRECTORY_SIZE: usize = 250;

fn patient(index: usize) -> Value {
    json!({ "id": index, "name": format!("Patient {index}"), "mrn": format!("MRN{index:05}") })
}

fn slice(from: usize, size: usize) -> Vec<Value> {
    (from..DIRECTORY_SIZE.min(from.saturating_add(size)))
        .map(patient)
        .collect()
}

fn number(query: &BTreeMap<String, String>, key: &str, fallback: usize) -> usize {
    query
        .get(key)
        .and_then(|raw| raw.parse().ok())
        .unwrap_or(fallback)
}

/// A service that throttles, and says for how long.
///
/// `/throttled/{seconds}` refuses the first call with a `Retry-After` and
/// succeeds on the second, so a test can measure whether the named wait was
/// honoured rather than the node's own.
/// Looks up a patient by medical record number, and refuses when there is not
/// one — the everyday shape of a bad record in a batch of good ones.
/// A small PNG, byte for byte. Real binary: it is not valid UTF-8, so a
/// response read as text comes back corrupted rather than merely wrong.
pub const PIXEL: &[u8] = &[
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
    0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
    0x42, 0x60, 0x82,
];

fn binary_routes() -> Router {
    Router::new()
        .route(
            "/scan.png",
            get(|| async {
                (
                    [
                        (axum::http::header::CONTENT_TYPE, "image/png"),
                        (
                            axum::http::header::CONTENT_DISPOSITION,
                            "attachment; filename=\"scan.png\"",
                        ),
                    ],
                    PIXEL,
                )
            }),
        )
        // A discharge summary, big enough to be worth not keeping in memory.
        .route(
            "/discharge.pdf",
            get(|| async {
                let mut body = b"%PDF-1.4\n".to_vec();
                body.extend(std::iter::repeat_n(b'A', 200_000));
                (
                    [(axum::http::header::CONTENT_TYPE, "application/pdf")],
                    body,
                )
            }),
        )
}

fn lookup_routes() -> Router {
    Router::new().route(
        "/lookup",
        get(|Query(query): Query<BTreeMap<String, String>>| async move {
            match query.get("mrn").map(String::as_str) {
                Some(mrn) if !mrn.is_empty() => {
                    Json(json!({ "mrn": mrn, "found": true })).into_response()
                }
                _ => (
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "mrn is required" })),
                )
                    .into_response(),
            }
        }),
    )
}

fn throttle_routes() -> Router {
    let seen = Arc::new(AtomicUsize::new(0));
    let by_date = Arc::new(AtomicUsize::new(0));

    Router::new()
        .route(
            "/throttled/{seconds}",
            get(
                move |axum::extract::Path(seconds): axum::extract::Path<String>| {
                    let seen = seen.clone();
                    async move {
                        if seen.fetch_add(1, Ordering::SeqCst) == 0 {
                            return (
                                StatusCode::TOO_MANY_REQUESTS,
                                [(axum::http::header::RETRY_AFTER, seconds)],
                                "rate limit exceeded",
                            )
                                .into_response();
                        }
                        Json(json!({ "ok": true })).into_response()
                    }
                },
            ),
        )
        // The same thing, but naming an HTTP-date instead of seconds. Which
        // form a service sends is not something a workflow gets to choose.
        .route(
            "/throttled-until",
            get(move || {
                let by_date = by_date.clone();
                async move {
                    if by_date.fetch_add(1, Ordering::SeqCst) == 0 {
                        let at = chrono::Utc::now() + chrono::Duration::hours(2);
                        return (
                            StatusCode::SERVICE_UNAVAILABLE,
                            [(
                                axum::http::header::RETRY_AFTER,
                                at.format("%a, %d %b %Y %H:%M:%S GMT").to_string(),
                            )],
                            "come back later",
                        )
                            .into_response();
                    }
                    Json(json!({ "ok": true })).into_response()
                }
            }),
        )
}

fn paged_routes(requests: &Arc<AtomicUsize>) -> Router {
    let counted = |counter: &Arc<AtomicUsize>| {
        let counter = counter.clone();
        move || counter.fetch_add(1, Ordering::SeqCst)
    };

    let cursor_count = counted(requests);
    let offset_count = counted(requests);
    let page_count = counted(requests);
    let link_count = counted(requests);
    let forever_count = counted(requests);

    Router::new()
        // A cursor in the body, the shape Stripe and Slack use.
        .route(
            "/paged/cursor",
            get(move |Query(query): Query<BTreeMap<String, String>>| {
                cursor_count();
                async move {
                    let from = number(&query, "cursor", 0);
                    let records = slice(from, 100);
                    let next = from.saturating_add(records.len());
                    Json(json!({
                        "patients": records,
                        "meta": {
                            "next_cursor": if next < DIRECTORY_SIZE {
                                json!(next.to_string())
                            } else {
                                Value::Null
                            }
                        },
                    }))
                }
            }),
        )
        // Offset and limit, the shape most SQL-backed APIs expose.
        .route(
            "/paged/offset",
            get(move |Query(query): Query<BTreeMap<String, String>>| {
                offset_count();
                async move {
                    let limit = number(&query, "limit", 100);
                    Json(json!({ "data": slice(number(&query, "offset", 0), limit) }))
                }
            }),
        )
        // Page numbers counted from 1.
        .route(
            "/paged/pages",
            get(move |Query(query): Query<BTreeMap<String, String>>| {
                page_count();
                async move {
                    let size = number(&query, "per_page", 100);
                    let page = number(&query, "page", 1).max(1);
                    let from = page.saturating_sub(1).saturating_mul(size);
                    Json(json!({ "results": slice(from, size) }))
                }
            }),
        )
        // An RFC 5988 Link header, the shape GitHub uses — and note it names
        // `prev` before `next`, because real headers do.
        .route(
            "/paged/link",
            get(move |Query(query): Query<BTreeMap<String, String>>| {
                link_count();
                async move {
                    let from = number(&query, "from", 0);
                    let records = slice(from, 100);
                    let next = from.saturating_add(records.len());
                    let mut links = format!("</paged/link?from={from}>; rel=\"prev\"");
                    if next < DIRECTORY_SIZE {
                        use std::fmt::Write as _;
                        let _ = write!(
                            links,
                            ", </paged/link?from={next}>; rel=\"next\", \
                             </paged/link?from=200>; rel=\"last\""
                        );
                    }
                    (
                        [(axum::http::header::LINK, links)],
                        Json(json!({ "items": records })),
                    )
                }
            }),
        )
        // Always offers another page. A real vendor bug, and the reason for a
        // ceiling: without one this is an infinite loop that looks like a slow
        // workflow.
        .route(
            "/paged/forever",
            get(move || {
                forever_count();
                async move {
                    Json(json!({
                        "items": (0..10).map(patient).collect::<Vec<_>>(),
                        "next": "more",
                    }))
                }
            }),
        )
}

async fn users() -> Json<Value> {
    Json(json!({
        "users": [
            { "id": 1, "name": "Ada",  "plan": "pro",  "mrr": 99 },
            { "id": 2, "name": "Grace", "plan": "free", "mrr": 0 },
            { "id": 3, "name": "Linus", "plan": "pro",  "mrr": 149 }
        ]
    }))
}

/// Reflects what it received, so tests can assert on what was actually sent.
async fn echo(
    Query(query): Query<BTreeMap<String, String>>,
    headers: HeaderMap,
    body: String,
) -> Response {
    let header_map: BTreeMap<String, String> = headers
        .iter()
        .map(|(name, value)| {
            (
                name.to_string(),
                value.to_str().unwrap_or_default().to_string(),
            )
        })
        .collect();
    Json(json!({ "query": query, "headers": header_map, "raw": body })).into_response()
}

/// Routes that stand in for a vendor API, so a manifest can be exercised
/// end-to-end without touching the real Slack or GitHub.
pub fn vendor_routes() -> Router {
    Router::new()
        .route("/chat.postMessage", post(slack_post_message))
        .route("/conversations.list", get(slack_conversations))
        .route(
            "/auth.test",
            post(|| async { Json(json!({ "ok": false, "error": "invalid_auth" })) }),
        )
        .route("/repos/{owner}/{repo}/issues", post(github_create_issue))
}

async fn slack_post_message(headers: HeaderMap, body: String) -> Response {
    let authorization = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default()
        .to_string();
    let sent: Value = serde_json::from_str(&body).unwrap_or(Value::Null);

    Json(json!({
        "ok": true,
        "channel": sent.get("channel").cloned().unwrap_or(Value::Null),
        "ts": "1700000000.000100",
        "message": { "text": sent.get("text").cloned().unwrap_or(Value::Null) },
        "sawAuthorization": authorization,
    }))
    .into_response()
}

async fn slack_conversations(Query(query): Query<BTreeMap<String, String>>) -> Response {
    Json(json!({
        "ok": true,
        "channels": [
            { "id": "C1", "name": "general" },
            { "id": "C2", "name": "random" }
        ],
        "sawQuery": query,
    }))
    .into_response()
}

async fn github_create_issue(
    axum::extract::Path((owner, repo)): axum::extract::Path<(String, String)>,
    body: String,
) -> Response {
    let sent: Value = serde_json::from_str(&body).unwrap_or(Value::Null);
    Json(json!({
        "number": 42,
        "html_url": format!("https://github.com/{owner}/{repo}/issues/42"),
        "title": sent.get("title").cloned().unwrap_or(Value::Null),
        "body": sent.get("body").cloned().unwrap_or(Value::Null),
    }))
    .into_response()
}

/// Start a server that serves both the generic fixtures and the vendor routes.
pub async fn start_vendor() -> FakeApi {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind ephemeral port");
    let address = listener.local_addr().expect("local address");
    let app = vendor_routes();
    tokio::spawn(async move {
        let _ = axum::serve(listener, app).await;
    });
    FakeApi {
        base: format!("http://{address}"),
        hits: Arc::new(AtomicUsize::new(0)),
        requests: Arc::new(AtomicUsize::new(0)),
    }
}

/// A stand-in for a `MedBrains` instance.
///
/// Reproduces the FHIR R4 shapes `crates/medbrains-fhir-api` actually returns:
/// a `CapabilityStatement` with no authentication, `Patient` and `Encounter`
/// reads behind a bearer token, a `$everything` searchset Bundle, and a FHIR
/// `OperationOutcome` for an unknown id rather than a plain 404 body.
pub fn medbrains_routes() -> Router {
    Router::new()
        .route("/api/fhir/metadata", get(fhir_metadata))
        .route("/api/fhir/Patient/{id}", get(fhir_patient))
        .route("/api/fhir/Patient/{id}/$everything", get(fhir_everything))
        .route("/api/fhir/Encounter/{id}", get(fhir_encounter))
}

pub async fn start_medbrains() -> FakeApi {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind ephemeral port");
    let address = listener.local_addr().expect("local address");
    let app = medbrains_routes();
    tokio::spawn(async move {
        let _ = axum::serve(listener, app).await;
    });
    FakeApi {
        base: format!("http://{address}"),
        hits: Arc::new(AtomicUsize::new(0)),
        requests: Arc::new(AtomicUsize::new(0)),
    }
}

const KNOWN_PATIENT: &str = "3f1a9c02-0000-4000-8000-000000000001";

async fn fhir_metadata() -> Response {
    fhir(json!({
        "resourceType": "CapabilityStatement",
        "status": "active",
        "kind": "instance",
        "fhirVersion": "4.0.1",
        "format": ["json"],
        "rest": [{ "mode": "server", "resource": [{ "type": "Patient" }] }],
    }))
}

async fn fhir_patient(
    axum::extract::Path(id): axum::extract::Path<String>,
    headers: HeaderMap,
) -> Response {
    if let Some(refusal) = require_bearer(&headers) {
        return refusal;
    }
    if id != KNOWN_PATIENT {
        return not_found("Patient", &id);
    }
    fhir(patient_resource(&id))
}

async fn fhir_encounter(
    axum::extract::Path(id): axum::extract::Path<String>,
    headers: HeaderMap,
) -> Response {
    if let Some(refusal) = require_bearer(&headers) {
        return refusal;
    }
    fhir(json!({
        "resourceType": "Encounter",
        "id": id,
        "status": "finished",
        "class": { "code": "AMB", "display": "ambulatory" },
        "subject": { "reference": format!("Patient/{KNOWN_PATIENT}") },
    }))
}

/// A patient's whole record, as a searchset Bundle.
async fn fhir_everything(
    axum::extract::Path(id): axum::extract::Path<String>,
    headers: HeaderMap,
) -> Response {
    if let Some(refusal) = require_bearer(&headers) {
        return refusal;
    }
    fhir(json!({
        "resourceType": "Bundle",
        "type": "searchset",
        "total": 3,
        "entry": [
            { "resource": patient_resource(&id) },
            { "resource": {
                "resourceType": "Encounter",
                "id": "enc-1",
                "status": "finished",
                "subject": { "reference": format!("Patient/{id}") },
            }},
            { "resource": {
                "resourceType": "Observation",
                "id": "obs-1",
                "status": "final",
                "code": { "text": "Systolic blood pressure" },
                "valueQuantity": { "value": 128, "unit": "mm[Hg]" },
            }},
        ],
    }))
}

fn patient_resource(id: &str) -> Value {
    json!({
        "resourceType": "Patient",
        "id": id,
        "active": true,
        "name": [{ "use": "official", "family": "Kapoor", "given": ["Aarav"] }],
        "gender": "male",
        "birthDate": "1984-02-11",
    })
}

/// `MedBrains` answers an unknown id with a FHIR `OperationOutcome`, not a plain
/// error body — worth reproducing, because it changes what a workflow sees.
fn not_found(resource: &str, id: &str) -> Response {
    (
        StatusCode::NOT_FOUND,
        [(axum::http::header::CONTENT_TYPE, "application/fhir+json")],
        Json(json!({
            "resourceType": "OperationOutcome",
            "issue": [{
                "severity": "error",
                "code": "not-found",
                "diagnostics": format!("{resource}/{id} was not found"),
            }],
        })),
    )
        .into_response()
}

fn require_bearer(headers: &HeaderMap) -> Option<Response> {
    let presented = headers
        .get("authorization")
        .and_then(|value| value.to_str().ok());
    match presented {
        Some(value) if value.starts_with("Bearer ") && value.len() > 7 => None,
        _ => Some(
            (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": "a bearer token is required" })),
            )
                .into_response(),
        ),
    }
}

/// FHIR responses carry their own content type.
fn fhir(body: Value) -> Response {
    (
        [(axum::http::header::CONTENT_TYPE, "application/fhir+json")],
        Json(body),
    )
        .into_response()
}
