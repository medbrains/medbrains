//! The HL7 ADT feed against real rows and a real MLLP receiver: a
//! destination set up on the settings API gets A01 when a patient is
//! admitted, A02 (naming the bed left) when they move, A03 on discharge;
//! a trigger it did not ask for queues nothing; and the handler sends a
//! framed ADT^A01 the receiver acknowledges, while a refusal (AR) is final.

use std::sync::Arc;

use medbrains_adapter_sdk::hl7;
use medbrains_outbox::handler::{Handler, HandlerCtx, HandlerError};
use medbrains_outbox::handlers::hl7_adt::AdtSendHandler;
use serde_json::{Value, json};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use uuid::Uuid;

use crate::common;
use crate::delivery_choice_world::{Setup, setup, staff};

const EVENT: &str = "hl7.adt.send";

fn ctx(app: &common::TestApp, tenant: Uuid) -> HandlerCtx {
    HandlerCtx {
        pool: app.db.clone(),
        tenant_id: tenant,
        event_id: Uuid::new_v4(),
        event_type: EVENT.to_owned(),
        actor_user_id: None,
        attempts: 1,
        secret_resolver: Arc::new(common::TestSecrets::default()),
        http_client: reqwest::Client::new(),
        object_store: Arc::new(medbrains_core::object_store::LocalFsObjectStore::new(
            std::env::temp_dir().join("medbrains-hl7-adt-tests"),
        )),
    }
}

/// A receiver on loopback that answers each message with `code` and hands
/// back what it got.
async fn receiver(code: &'static str) -> (u16, tokio::task::JoinHandle<String>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind");
    let port = listener.local_addr().expect("addr").port();
    let task = tokio::spawn(async move {
        let (mut sock, _) = listener.accept().await.expect("accept");
        let mut got = Vec::new();
        let mut buf = [0u8; 4096];
        while !got.windows(2).any(|w| w == [0x1C, 0x0D]) {
            let n = sock.read(&mut buf).await.expect("read");
            got.extend_from_slice(&buf[..n]);
        }
        let msg = hl7::mllp_unwrap(&got).unwrap_or_default();
        let ack =
            format!("MSH|^~\\&|PACS|RAD|MEDBRAINS|X|20261030||ACK|1|P|2.5\rMSA|{code}|1|test\r");
        sock.write_all(&hl7::mllp_wrap(&ack)).await.expect("ack");
        msg
    });
    (port, task)
}

async fn destination(app: &common::TestApp, s: &Setup, port: u16, events: &[&str]) -> Value {
    let (status, body) = staff(
        app,
        s,
        "POST",
        "/api/integrations/hl7-adt/destinations",
        json!({ "name": "Radiology PACS", "host": "127.0.0.1", "port": port,
                "events": events, "receiving_application": "PACS" }),
    )
    .await;
    assert!(status.is_success(), "{body}");
    body
}

async fn scalar(app: &common::TestApp, sql: &str, binds: &[Uuid]) -> Uuid {
    let mut q = sqlx::query_scalar::<_, Uuid>(sql);
    for b in binds {
        q = q.bind(*b);
    }
    q.fetch_one(&app.db).await.expect(sql)
}

/// Given a feed for A01, A02 and A03, When a patient is admitted to bed 1,
/// moved to bed 2 and discharged, Then each step is queued once, the move
/// naming bed 1; and the A01 reaches the receiver as ADT^A01 with the UHID.
#[tokio::test]
async fn admit_move_and_discharge_reach_the_receiver() {
    let app = common::spawn_app().await;
    let s = setup(&app).await;
    let (port, got) = receiver("AA").await;
    let dest = destination(&app, &s, port, &["A01", "A02", "A03"]).await;
    let patient = scalar(&app,
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, 'UH-ADT-' || substr(gen_random_uuid()::text, 1, 8), 'Lakshmi', 'Iyer', 'female', '9840012345') RETURNING id",
        &[s.tenant]).await;
    let ward = scalar(&app,
        "INSERT INTO wards (tenant_id, code, name) VALUES ($1, 'MW' || substr(gen_random_uuid()::text, 1, 4), 'Medical ward') RETURNING id",
        &[s.tenant]).await;
    let bed = |n: &'static str| {
        let app = &app;
        let tenant = s.tenant;
        async move {
            sqlx::query_scalar::<_, Uuid>(
                "INSERT INTO locations (tenant_id, level, code, name) \
                 VALUES ($1, 'bed', $2, 'Bed ' || $2) RETURNING id",
            )
            .bind(tenant)
            .bind(format!(
                "ADT-{}-{n}",
                Uuid::new_v4().simple().to_string()[..6].to_uppercase()
            ))
            .fetch_one(&app.db)
            .await
            .expect("bed")
        }
    };
    let bed1 = bed("1").await;
    let bed2 = bed("2").await;
    let doctor = scalar(&app, "SELECT id FROM users WHERE username = 'admin'", &[]).await;
    let encounter = scalar(&app,
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type) VALUES ($1, $2, 'ipd') RETURNING id",
        &[s.tenant, patient]).await;
    let admission = scalar(&app,
        "INSERT INTO admissions (tenant_id, encounter_id, patient_id, admitting_doctor, bed_id, ward_id) \
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
        &[s.tenant, encounter, patient, doctor, bed1, ward]).await;
    sqlx::query("UPDATE admissions SET bed_id = $2 WHERE id = $1")
        .bind(admission)
        .bind(bed2)
        .execute(&app.db)
        .await
        .expect("move");
    sqlx::query("UPDATE admissions SET status = 'discharged', discharged_at = now() WHERE id = $1")
        .bind(admission)
        .execute(&app.db)
        .await
        .expect("discharge");

    let mine = |rows: Vec<Value>| -> Vec<Value> {
        rows.into_iter()
            .filter(|r| r["destination_id"] == dest["id"])
            .collect()
    };
    let rows = mine(app.outbox_rows(EVENT, &admission.to_string()).await);
    let events: Vec<&str> = rows.iter().filter_map(|r| r["event"].as_str()).collect();
    assert_eq!(events, ["A01", "A02", "A03"], "{rows:?}");
    assert_eq!(rows[1]["prior_bed_id"], json!(bed1));
    assert!(
        mine(app.outbox_rows(EVENT, &encounter.to_string()).await)
            .iter()
            .all(|r| r["event"] != "A04"),
        "A04 was not asked for"
    );

    let sent = AdtSendHandler.handle(&ctx(&app, s.tenant), &rows[0]).await;
    assert!(sent.is_ok(), "{sent:?}");
    let message = got.await.expect("receiver");
    let parsed = hl7::parse(&message).expect("an HL7 message");
    let msh = parsed.first("MSH").expect("MSH");
    assert_eq!(parsed.component(msh, 9, 2), "A01");
    let pid = parsed.first("PID").expect("PID");
    assert!(
        parsed.component(pid, 3, 1).starts_with("UH-ADT-"),
        "{message:?}"
    );
    let pv1 = parsed.first("PV1").expect("PV1");
    // The bed as it stands when sent: the one moved to.
    let bed_now: String = sqlx::query_scalar("SELECT code FROM locations WHERE id = $1")
        .bind(bed2)
        .fetch_one(&app.db)
        .await
        .expect("bed code");
    assert_eq!(parsed.component(pv1, 3, 3), bed_now);
}

/// A receiver that refuses (AR) is not retried: the error is permanent.
#[tokio::test]
async fn a_refusal_is_final() {
    let app = common::spawn_app().await;
    let s = setup(&app).await;
    let (port, got) = receiver("AR").await;
    let dest = destination(&app, &s, port, &["A08"]).await;
    let patient = scalar(&app,
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, 'UH-ADT-' || substr(gen_random_uuid()::text, 1, 8), 'Ravi', 'Kumar', 'male', '') RETURNING id",
        &[s.tenant]).await;
    sqlx::query("UPDATE patients SET phone = '9840099999' WHERE id = $1")
        .bind(patient)
        .execute(&app.db)
        .await
        .expect("edit");
    let rows: Vec<Value> = app
        .outbox_rows(EVENT, &patient.to_string())
        .await
        .into_iter()
        .filter(|r| r["destination_id"] == dest["id"])
        .collect();
    assert_eq!(rows.len(), 1, "one A08 for the phone change: {rows:?}");
    let sent = AdtSendHandler.handle(&ctx(&app, s.tenant), &rows[0]).await;
    assert!(matches!(sent, Err(HandlerError::Permanent(_))), "{sent:?}");
    assert!(got.await.expect("receiver").contains("ADT^A08"));
}
