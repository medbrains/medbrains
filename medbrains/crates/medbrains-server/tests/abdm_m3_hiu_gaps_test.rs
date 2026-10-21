//! ABDM M3 (HIU) gaps (#4843): a request whose notify never came is asked
//! about and settled by on-status; a HIP that sends a `link` instead of
//! inline content is fetched — but never at a private or local address;
//! and ABDM's answers that arrive before our call returns find their row.

use crate::abdm_hip_world;

use abdm_hip_world::{
    World,
    hiu::{
        REMOTE_CONTEXT, accepted, answer_synchronously, consult, encrypt_to_us, granted, header,
        notify_granted, on_fetch, push_entries, raise, received, with_hpr,
    },
    world,
};
use axum::{Router, http::StatusCode, routing::get};
use medbrains_abdm::gateway as paths;
use medbrains_crypto::fidelius;
use serde_json::{Value, json};
use uuid::Uuid;

/// Every test saves ABDM keys for the same hospital; run them one at a time.
static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

async fn check_status(w: &World, id: &str) -> Value {
    let r = w
        .app
        .client
        .post(
            w.app
                .url(&format!("/api/abdm/consent-requests/{id}/check-status")),
        )
        .header("x-csrf-token", &w.csrf)
        .send()
        .await
        .expect("check");
    assert_eq!(r.status().as_u16(), 200);
    r.json().await.expect("json")
}

/// A mock HIP serving `body` at `/files/record`; returns its URL.
async fn serve_link(body: String) -> String {
    let app = Router::new().route(
        "/files/record",
        get(move || {
            let body = body.clone();
            async move { body }
        }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind");
    let addr = listener.local_addr().expect("addr");
    tokio::spawn(async move { axum::serve(listener, app).await.ok() });
    format!("http://{addr}/files/record")
}

fn linked(link: &str, checksum: &str) -> Value {
    json!({ "link": link, "media": "application/fhir+json", "checksum": checksum,
            "careContextReference": REMOTE_CONTEXT })
}

fn last_statuses(w: &World) -> Value {
    w.last(paths::HI_NOTIFY_PATH).body["notification"]["statusNotification"]["statusResponses"]
        .clone()
}

/// Given a request ABDM accepted but whose notify never came, When a doctor
/// checks its status, Then ABDM is asked with the consent-request id, its
/// on-status GRANTED settles the request as notify would — the artefact is
/// fetched and the health-information request follows — and the time of the
/// check is shown; a second check at once is not sent again.
#[tokio::test]
async fn checking_a_stuck_request_settles_it_like_notify() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    with_hpr(&w).await;
    let consent_request = accepted(&w).await;
    let artefact = Uuid::new_v4().to_string();
    let granted_id = artefact.clone();
    let answers = answer_synchronously(
        &w,
        paths::CONSENT_STATUS_PATH,
        paths::CB_HIU_CONSENT_ON_STATUS,
        move |call| {
            json!({ "consentRequest": { "id": call.body["consentRequestId"], "status": "GRANTED",
                    "consentArtefacts": [{ "id": granted_id }] },
                    "response": { "requestId": header(call, "request-id") } })
        },
    );
    let id = received(&w).await["requests"][0]["id"]
        .as_str()
        .expect("id")
        .to_owned();
    let row = check_status(&w, &id).await;
    let asked = w.last(paths::CONSENT_STATUS_PATH);
    assert_eq!(asked.body["consentRequestId"], consent_request.as_str());
    assert_eq!(header(&asked, "x-hiu-id"), Some(w.hip_id.clone()));
    assert_eq!(*answers.lock().expect("answers"), [StatusCode::ACCEPTED]);
    assert_eq!(row["status"], "granted", "{row}");
    assert!(row["status_checked_at"].is_string(), "{row}");
    assert_eq!(
        w.last(paths::CONSENT_FETCH_PATH).body["consentId"],
        artefact.as_str()
    );
    let hi_request = on_fetch(&w, &artefact).await;
    assert_eq!(
        hi_request.body["hiRequest"]["consent"]["id"],
        artefact.as_str()
    );

    check_status(&w, &id).await;
    assert_eq!(
        w.count(paths::CONSENT_STATUS_PATH),
        1,
        "granted: nothing to ask"
    );
}

/// Given requests waiting for the patient for longer than ten minutes, When
/// the patient's requests are read, Then ABDM is asked about them in the
/// background — and reading again at once asks nothing more.
#[tokio::test]
async fn reading_stale_requests_asks_about_them_once() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    with_hpr(&w).await;
    let consent_request = accepted(&w).await;
    sqlx::query(
        "UPDATE abdm_consent_requests SET requested_at = now() - interval '20 minutes' \
          WHERE consent_request_id = $1",
    )
    .bind(&consent_request)
    .execute(&w.app.db)
    .await
    .expect("age it");
    received(&w).await;
    for _ in 0..50 {
        if w.count(paths::CONSENT_STATUS_PATH) > 0 {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }
    assert_eq!(w.count(paths::CONSENT_STATUS_PATH), 1);
    let view = received(&w).await;
    assert!(
        view["requests"][0]["status_checked_at"].is_string(),
        "{view}"
    );
    tokio::time::sleep(std::time::Duration::from_millis(300)).await;
    assert_eq!(
        w.count(paths::CONSENT_STATUS_PATH),
        1,
        "not again within the interval"
    );
}

/// Given a grant, When the HIP pushes an entry as a `link` to its own
/// server, Then the linked ciphertext is fetched, decrypted, checked and
/// kept like inline content, and ABDM is told OK for that care context.
#[tokio::test]
async fn a_linked_entry_is_fetched_decrypted_and_kept() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    with_hpr(&w).await;
    let g = granted(&w).await;
    let hip = fidelius::generate().expect("hip keys");
    let plain = consult("Linked scan report").to_string();
    let link = serve_link(encrypt_to_us(&g.hi_request, &hip, &plain)).await;
    let sum = fidelius::checksum(&plain).expect("md5");
    let entries = vec![linked(&link, &sum)];
    let status = push_entries(&w, &g.hi_request, ((0, 1), "txn-hiu"), &hip, entries).await;
    assert_eq!(status, 202);
    assert_eq!(last_statuses(&w)[0]["hiStatus"], "OK");
    let view = received(&w).await;
    assert_eq!(view["records"][0]["title"], "Linked scan report", "{view}");
}

/// Given a grant, When a pushed `link` points at a private or link-local
/// address, Then it is never fetched: the entry is refused and ABDM told
/// ERRORED. And once the hospital's ABDM is production, the loopback
/// override is ignored too.
#[tokio::test]
async fn links_to_private_or_local_addresses_are_refused() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    with_hpr(&w).await;
    let g = granted(&w).await;
    let hip = fidelius::generate().expect("hip keys");
    let sum = "00000000000000000000000000000000";
    let inside = vec![
        linked("http://10.0.0.1/record", sum),
        linked("http://169.254.169.254/latest/meta-data", sum),
        linked("file:///etc/passwd", sum),
    ];
    let status = push_entries(&w, &g.hi_request, ((0, 2), "txn-hiu"), &hip, inside).await;
    assert_eq!(status, 400);
    let statuses = last_statuses(&w);
    for s in statuses.as_array().expect("statuses") {
        assert_eq!(s["hiStatus"], "ERRORED", "{statuses}");
    }
    assert_eq!(
        statuses[0]["description"],
        "The link points to a private or local address"
    );

    let saved = w
        .app
        .client
        .put(w.app.url("/api/abdm/settings"))
        .header("x-csrf-token", &w.csrf)
        .json(&json!({ "environment": "production", "client_id": "sbx-client", "client_secret": "sbx-secret" }))
        .send()
        .await
        .expect("settings");
    assert!(saved.status().is_success());
    let plain = consult("Loopback").to_string();
    let link = serve_link(encrypt_to_us(&g.hi_request, &hip, &plain)).await;
    let sum = fidelius::checksum(&plain).expect("md5");
    let entries = vec![linked(&link, &sum)];
    let status = push_entries(&w, &g.hi_request, ((1, 2), "txn-hiu"), &hip, entries).await;
    assert_eq!(status, 400, "production refuses loopback");
    assert_eq!(last_statuses(&w)[0]["hiStatus"], "ERRORED");
}

/// Given ABDM answers before our call returns — on-init during consent
/// init, on-request during the health-information request — Then each
/// answer finds its row (never 404), and the send's own bookkeeping does
/// not overwrite it: the request waits for the patient, the artefact stays
/// acknowledged under ABDM's transaction and still takes the push.
#[tokio::test]
async fn answers_that_arrive_before_the_send_returns_are_matched() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    with_hpr(&w).await;
    let consent_request = format!("cr-{}", Uuid::new_v4());
    let cr = consent_request.clone();
    let on_init = answer_synchronously(
        &w,
        paths::CONSENT_INIT_PATH,
        paths::CB_HIU_CONSENT_ON_INIT,
        move |call| {
            json!({ "consentRequest": { "id": cr },
                    "response": { "requestId": header(call, "request-id") } })
        },
    );
    let row = raise(&w).await;
    assert_eq!(*on_init.lock().expect("on-init"), [StatusCode::ACCEPTED]);
    assert_eq!(row["status"], "awaiting_patient", "{row}");

    let on_request = answer_synchronously(
        &w,
        paths::HIU_HI_REQUEST_PATH,
        paths::CB_HIU_HI_ON_REQUEST,
        |call| {
            json!({ "hiRequest": { "transactionId": "txn-race", "sessionStatus": "ACKNOWLEDGED" },
                    "response": { "requestId": header(call, "request-id") } })
        },
    );
    let artefact = notify_granted(&w, &consent_request).await;
    let hi_request = on_fetch(&w, &artefact).await;
    assert_eq!(
        *on_request.lock().expect("on-request"),
        [StatusCode::ACCEPTED]
    );
    let (hi_status, txn): (Option<String>, Option<String>) = sqlx::query_as(
        "SELECT hi_status, transaction_id FROM abdm_consent_artefacts WHERE consent_id = $1",
    )
    .bind(&artefact)
    .fetch_one(&w.app.db)
    .await
    .expect("artefact");
    assert_eq!(hi_status.as_deref(), Some("acknowledged"));
    assert_eq!(txn.as_deref(), Some("txn-race"));

    let hip = fidelius::generate().expect("hip keys");
    let plain = consult("After the race").to_string();
    let entry = json!({ "content": encrypt_to_us(&hi_request, &hip, &plain),
        "media": "application/fhir+json", "checksum": fidelius::checksum(&plain).expect("md5"),
        "careContextReference": REMOTE_CONTEXT });
    let status = push_entries(&w, &hi_request, ((0, 1), "txn-race"), &hip, vec![entry]).await;
    assert_eq!(status, 202);
}
