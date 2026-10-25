//! Proof that patient data never reaches an error report: synthetic errors full
//! of a patient's identifiers go through the real SDK and the real scrubbing
//! transport, and the serialized envelopes are searched for every one of them.

use std::sync::Arc;

use sentry::protocol::{Breadcrumb, Event, Exception, Map, Request, User, Value};
use sentry::test::TestTransport;
use sentry::{ClientOptions, Hub, Level, Scope, Transport};
use tracing_subscriber::layer::SubscriberExt;

use crate::config::Settings;
use crate::envelope::scrubbing;
use crate::sdk::client_options;
use crate::tunnel::scrub_browser_envelope;

type TestResult = Result<(), Box<dyn std::error::Error>>;

const NAME: &str = "Ramesh Kumar Iyer";
const UHID: &str = "MB-2026-000123";
const PHONE: &str = "9876543210";
const AADHAAR: &str = "2345 6789 0123";
const EMAIL: &str = "ramesh.iyer@example.com";
const IP: &str = "203.0.113.9";
const TENANT: &str = "1b4e28ba-2fa1-11d2-883f-0016d3cca427";

/// Every fragment a report could leak a patient through.
const NEEDLES: [&str; 12] = [
    "Ramesh",
    "Iyer",
    UHID,
    "000123",
    PHONE,
    AADHAAR,
    "234567890123",
    EMAIL,
    IP,
    "q=Ramesh",
    "diabetes",
    "sess-cookie-value",
];

fn assert_clean(serialized: &str) {
    for needle in NEEDLES {
        assert!(
            !serialized.contains(needle),
            "`{needle}` leaked into:\n{serialized}"
        );
    }
}

fn settings() -> Result<Settings, Box<dyn std::error::Error>> {
    let lookup = |key: &str| match key {
        "SENTRY_DSN" => Some("http://abc123@127.0.0.1:8180/1".to_owned()),
        "SENTRY_RELEASE" => Some("4f2a9c1d0b3e".to_owned()),
        _ => None,
    };
    Settings::from_lookup(lookup)?.ok_or_else(|| "expected settings".into())
}

fn serialized(transport: &TestTransport) -> Result<String, std::io::Error> {
    let mut out = Vec::new();
    for envelope in transport.fetch_and_clear_envelopes() {
        envelope.to_writer(&mut out)?;
    }
    Ok(String::from_utf8_lossy(&out).into_owned())
}

fn patient_error_event() -> Result<Event<'static>, Box<dyn std::error::Error>> {
    let message = format!(
        "could not save patient '{NAME}' (Mr. {NAME}) UHID {UHID}, phone {PHONE}, \
         aadhaar {AADHAAR}, email {EMAIL}: Key (phone)=({PHONE}) already exists"
    );
    let mut extra = Map::new();
    extra.insert("patient".to_owned(), Value::String(NAME.to_owned()));
    Ok(Event {
        level: Level::Error,
        message: Some(message.clone()),
        exception: vec![Exception {
            ty: "PatientSaveError".to_owned(),
            value: Some(message),
            ..Exception::default()
        }]
        .into(),
        request: Some(Request {
            url: Some(format!("https://hims.example.in/api/patients/{UHID}?q=Ramesh").parse()?),
            method: Some("POST".to_owned()),
            data: Some(format!(
                "{{\"name\":\"{NAME}\",\"diagnosis\":\"diabetes\"}}"
            )),
            query_string: Some("q=Ramesh".to_owned()),
            cookies: Some("mb_session=sess-cookie-value".to_owned()),
            headers: Map::from([(
                "Authorization".to_owned(),
                "Bearer sess-cookie-value".to_owned(),
            )]),
            ..Request::default()
        }),
        extra,
        ..Event::default()
    })
}

#[test]
fn a_server_error_full_of_patient_data_leaves_with_none_of_it() -> TestResult {
    let transport = TestTransport::new();
    let sink: Arc<dyn Transport> = Arc::<TestTransport>::clone(&transport);
    let factory = move |_: &ClientOptions| scrubbing(Arc::clone(&sink));
    let client = Arc::new(sentry::Client::from(client_options(
        &settings()?,
        Arc::new(factory),
    )));
    let hub = Arc::new(Hub::new(
        Some(Arc::clone(&client)),
        Arc::new(Scope::default()),
    ));
    let event = patient_error_event()?;

    Hub::run(hub, || {
        sentry::configure_scope(|scope| {
            scope.set_user(Some(User {
                id: Some("8f14e45fceea167a5a36dedd4bea2543".to_owned()),
                email: Some(EMAIL.to_owned()),
                username: Some(NAME.to_owned()),
                ip_address: IP.parse().ok(),
                ..User::default()
            }));
            scope.set_tag("patient_phone", PHONE);
            scope.set_tag("tenant_id", TENANT);
            scope.set_tag("role", "doctor");
        });
        sentry::add_breadcrumb(Breadcrumb {
            message: Some(format!("searched for {NAME} / {PHONE}")),
            data: Map::from([("body".to_owned(), Value::String(NAME.to_owned()))]),
            ..Breadcrumb::default()
        });
        // The path most production errors take: an ERROR log line.
        let subscriber =
            tracing_subscriber::registry().with(sentry::integrations::tracing::layer());
        tracing::subscriber::with_default(subscriber, || {
            tracing::error!(patient = NAME, uhid = UHID, "lookup failed for {PHONE}");
        });
        sentry::capture_event(event);
    });
    client.flush(None);

    let sent = serialized(&transport)?;
    assert!(
        sent.contains("PatientSaveError"),
        "the error itself must still be reported"
    );
    assert!(
        sent.contains("8f14e45fceea167a5a36dedd4bea2543"),
        "the opaque user hash survives"
    );
    assert!(sent.contains(TENANT), "the tenant tag survives, for triage");
    assert_clean(&sent);
    Ok(())
}

#[test]
fn a_browser_envelope_full_of_patient_data_is_forwarded_with_none_of_it() -> TestResult {
    let header = r#"{"event_id":"9ec79c33ec9942ab8353589fcb2e04dc","dsn":"https://k@errors.example/1","sent_at":"2026-10-25T07:00:00Z"}"#;
    let event = serde_json::json!({
        "event_id": "9ec79c33ec9942ab8353589fcb2e04dc",
        "level": "error",
        "platform": "javascript",
        "exception": {"values": [{"type": "TypeError",
            "value": format!("Cannot read 'x' of {NAME} {PHONE}")}]},
        "request": {"url": format!("https://hims.example.in/patients/{UHID}?q=Ramesh"),
            "headers": {"Cookie": "mb_session=sess-cookie-value"}},
        "user": {"id": "8f14e45fceea167a5a36dedd4bea2543", "email": EMAIL, "ip_address": IP},
        "breadcrumbs": {"values": [{"category": "ui.input", "message": format!("input {NAME}"),
            "data": {"value": AADHAAR}},
            {"category": "fetch", "data": {"method": "GET", "status_code": 500,
                "url": format!("/api/patients/search?q=Ramesh&phone={PHONE}")}}]},
        "extra": {"diagnosis": "diabetes"},
        "tags": {"url": format!("https://hims.example.in/patients/{UHID}?q=Ramesh")}
    });
    let session = serde_json::json!({"sid": "7ec79c33ec9942ab8353589fcb2e04dc",
        "did": EMAIL, "started": "2026-10-25T07:00:00Z", "status": "ok", "errors": 1,
        "attrs": {"release": "4f2a9c1d0b3e", "ip_address": IP}});
    let body =
        format!("{header}\n{{\"type\":\"event\"}}\n{event}\n{{\"type\":\"session\"}}\n{session}\n");

    let forwarded = scrub_browser_envelope(body.as_bytes()).ok_or("envelope was refused")?;
    let forwarded = String::from_utf8(forwarded)?;
    assert!(
        forwarded.contains("TypeError"),
        "the error itself must still be forwarded"
    );
    assert!(
        forwarded.contains("/patients/:id"),
        "the path stays, the UHID goes"
    );
    assert!(
        !forwarded.contains("errors.example"),
        "the browser's DSN is not passed on"
    );
    assert_clean(&forwarded);
    Ok(())
}

#[test]
fn something_that_is_not_an_envelope_is_refused() {
    assert!(scrub_browser_envelope(b"not an envelope").is_none());
}
