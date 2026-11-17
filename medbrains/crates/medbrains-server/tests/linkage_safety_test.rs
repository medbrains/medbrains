//! Safety linkages — the table-only halves.
//!
//! Four cross-module effects the Playwright specs cannot see: outbox rows,
//! NABH mirror rows, and what happens when the same event is delivered
//! twice. `spawn_app` never starts the outbox worker, so each test proves
//! the emit half with a SELECT and the consume half by dispatching the
//! stored envelope directly — and dispatching it again.

use crate::common;

use serde_json::{Value, json};
use uuid::Uuid;

async fn create_patient(
    app: &common::TestApp,
    csrf: &str,
    last: &str,
    blood_group: Option<&str>,
) -> Value {
    let mut body = json!({
        "first_name": "Linkage",
        "last_name": last,
        "gender": "female",
        "date_of_birth": "1985-06-15",
        "phone": format!("99900{:05}", (Uuid::new_v4().as_u128() % 100_000) as u32),
    });
    if let Some(bg) = blood_group {
        body["blood_group"] = json!(bg);
    }
    app.client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("create patient")
        .json()
        .await
        .expect("patient json")
}

async fn post(app: &common::TestApp, csrf: &str, path: &str, body: Value) -> Value {
    let resp = app
        .client
        .post(app.url(path))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    assert!(status.is_success(), "{path} → {status}: {text}");
    serde_json::from_str(&text).expect("json body")
}

async fn incidents(
    app: &common::TestApp,
    tenant_id: Uuid,
    incident_type: &str,
    needle: &str,
) -> i64 {
    sqlx::query_scalar::<_, i64>(
        "SELECT count(*) FROM quality_incidents \
          WHERE tenant_id = $1 AND incident_type = $2 AND deleted_at IS NULL \
            AND (title LIKE '%' || $3 || '%' OR description LIKE '%' || $3 || '%')",
    )
    .bind(tenant_id)
    .bind(incident_type)
    .bind(needle)
    .fetch_one(&app.db)
    .await
    .expect("count incidents")
}

#[tokio::test]
async fn ndps_movement_without_second_witness_raises_one_incident_however_often_delivered() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let patient = create_patient(&app, &csrf, "Ndps", None).await;
    let tenant_id: Uuid = patient["tenant_id"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .expect("tenant");

    // A Schedule X drug with stock. The register handler derives
    // requires_dual_sign from the catalogue; nothing wrote it before.
    let drug_id: Uuid = sqlx::query_scalar(
        "INSERT INTO pharmacy_catalog (tenant_id, code, name, drug_schedule, is_controlled, current_stock) \
         VALUES ($1, $2, 'Linkage Morphine', 'NDPS', true, 100) RETURNING id",
    )
    .bind(tenant_id)
    .bind(format!("LNK-{}", &Uuid::new_v4().to_string()[..8]))
    .fetch_one(&app.db)
    .await
    .expect("catalog row");

    // Step up first: a controlled-drug register entry demands re-authentication.
    let stepped = app
        .client
        .post(app.url("/api/auth/step-up"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "password": "admin123" }))
        .send()
        .await
        .expect("step-up");
    assert!(
        stepped.status().is_success(),
        "step-up: {}",
        stepped.status()
    );

    // A receipt with no witness is the deficiency: the handler refuses an
    // unwitnessed dispense outright, so the register can only go wrong on
    // the way in. (It also opens the running balance for the dispense below.)
    let entry = post(
        &app,
        &csrf,
        "/api/pharmacy/ndps-register",
        json!({ "catalog_item_id": drug_id, "action": "receipt", "quantity": 50 }),
    )
    .await;
    let entry_id = entry["id"].as_str().expect("entry id").to_owned();
    let requires: Option<bool> =
        sqlx::query_scalar("SELECT requires_dual_sign FROM pharmacy_ndps_register WHERE id = $1")
            .bind(entry_id.parse::<Uuid>().expect("uuid"))
            .fetch_one(&app.db)
            .await
            .expect("register row");
    assert_eq!(
        requires,
        Some(true),
        "a Schedule X movement requires a second signature"
    );

    let emitted = app
        .outbox_rows("pharmacy.ndps.movement.created", &entry_id)
        .await;
    assert_eq!(emitted.len(), 1);
    app.dispatch(tenant_id, "pharmacy.ndps.movement.created", &emitted[0])
        .await;
    app.dispatch(tenant_id, "pharmacy.ndps.movement.created", &emitted[0])
        .await;
    assert_eq!(
        incidents(&app, tenant_id, "ndps_dual_signature_missing", &entry_id).await,
        1
    );

    // The negative: a witnessed movement raises nothing.
    let witness: Uuid = sqlx::query_scalar(
        "SELECT id FROM users WHERE tenant_id = $1 AND is_active = true AND username <> 'admin' LIMIT 1",
    )
    .bind(tenant_id)
    .fetch_one(&app.db)
    .await
    .expect("a witness");
    let witnessed = post(
        &app,
        &csrf,
        "/api/pharmacy/ndps-register",
        json!({ "catalog_item_id": drug_id, "action": "dispensed", "quantity": 1, "witnessed_by": witness }),
    )
    .await;
    let witnessed_id = witnessed["id"].as_str().expect("entry id").to_owned();
    let emitted = app
        .outbox_rows("pharmacy.ndps.movement.created", &witnessed_id)
        .await;
    assert_eq!(emitted.len(), 1);
    app.dispatch(tenant_id, "pharmacy.ndps.movement.created", &emitted[0])
        .await;
    assert_eq!(
        incidents(
            &app,
            tenant_id,
            "ndps_dual_signature_missing",
            &witnessed_id
        )
        .await,
        0
    );
}

async fn mirror_count(app: &common::TestApp, table: &str, id: Uuid) -> i64 {
    sqlx::query_scalar::<_, i64>(&format!(
        "SELECT count(*) FROM {table} WHERE source_record_id = $1"
    ))
    .bind(id)
    .fetch_one(&app.db)
    .await
    .expect("mirror count")
}

#[tokio::test]
async fn fall_and_sentinel_incidents_reach_their_nabh_registers_and_a_near_miss_does_not() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    // The falls register is a patient register: a fall with no patient on it
    // (a visitor's) is a quality incident but not a row there.
    let patient = create_patient(&app, &csrf, "Fall", None).await;
    let patient_id = patient["id"].as_str().expect("patient id").to_owned();

    let mut ids = Vec::new();
    for (kind, severity) in [
        ("fall", "minor"),
        ("medication_error", "sentinel"),
        ("medication_error", "near_miss"),
    ] {
        let row = post(
            &app,
            &csrf,
            "/api/quality/incidents",
            json!({
                "title": format!("Linkage {kind} {severity}"),
                "incident_type": kind,
                "severity": severity,
                "incident_date": chrono::Utc::now().to_rfc3339(),
                "patient_id": patient_id,
            }),
        )
        .await;
        ids.push(
            row["id"]
                .as_str()
                .and_then(|s| s.parse::<Uuid>().ok())
                .expect("incident id"),
        );
    }
    assert_eq!(
        mirror_count(&app, "nabh_falls_register", ids[0]).await,
        1,
        "a fall is on the falls register"
    );
    assert_eq!(
        mirror_count(&app, "nabh_sentinel_event_register", ids[1]).await,
        1,
        "a sentinel event is on the sentinel register"
    );
    assert_eq!(
        mirror_count(&app, "nabh_sentinel_event_register", ids[2]).await,
        0,
        "a near-miss is not"
    );
    assert_eq!(mirror_count(&app, "nabh_falls_register", ids[2]).await, 0);
}

#[tokio::test]
async fn breakdown_takes_active_kit_out_of_service_once_and_mirrors_downtime() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let patient = create_patient(&app, &csrf, "Bme", None).await;
    let tenant_id: Uuid = patient["tenant_id"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .expect("tenant");

    let kit = post(
        &app,
        &csrf,
        "/api/bme/equipment",
        json!({ "name": "Linkage Ventilator", "status": "active" }),
    )
    .await;
    let kit_id: Uuid = kit["id"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .expect("equipment id");
    let breakdown = post(
        &app,
        &csrf,
        "/api/bme/breakdowns",
        json!({ "equipment_id": kit_id, "description": "Linkage: no tidal volume" }),
    )
    .await;
    let breakdown_id = breakdown["id"].as_str().expect("breakdown id").to_owned();

    let emitted = app
        .outbox_rows("bme.equipment_downtime.recorded", &breakdown_id)
        .await;
    assert_eq!(emitted.len(), 1);
    let mirrored: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM nabh_equipment_downtime_log WHERE source_record_id = $1",
    )
    .bind(breakdown_id.parse::<Uuid>().expect("uuid"))
    .fetch_one(&app.db)
    .await
    .expect("downtime mirror");
    assert_eq!(mirrored, 1, "the breakdown is on the NABH downtime log");

    app.dispatch(tenant_id, "bme.equipment_downtime.recorded", &emitted[0])
        .await;
    app.dispatch(tenant_id, "bme.equipment_downtime.recorded", &emitted[0])
        .await;
    let status: String = sqlx::query_scalar("SELECT status::text FROM bme_equipment WHERE id = $1")
        .bind(kit_id)
        .fetch_one(&app.db)
        .await
        .expect("equipment status");
    assert_eq!(status, "under_maintenance");
}

/// A transfused unit with one sibling from the same donation still on the
/// shelf, and a reaction recorded against it.
struct ReactedTransfusion {
    tenant_id: Uuid,
    /// The donation's other unit, the one the pipeline must hold.
    sibling: Uuid,
    /// The stored `blood.transfusion_reaction.reported` envelope.
    event: Value,
    reaction_id: String,
}

/// Donor, screened donation, two units, crossmatch, transfusion of the first
/// unit and a severe reaction to it, all through the API.
async fn react_to_a_transfusion(app: &common::TestApp, csrf: &str) -> ReactedTransfusion {
    let patient = create_patient(app, csrf, "Transfusion", Some("o_positive")).await;
    let patient_id = patient["id"].as_str().expect("patient id").to_owned();
    let tenant_id: Uuid = patient["tenant_id"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .expect("tenant");

    let donor = post(
        app,
        csrf,
        "/api/blood-bank/donors",
        json!({ "donor_number": format!("LNK-{}", &Uuid::new_v4().to_string()[..8]), "first_name": "Linkage",
                "last_name": "Donor", "blood_group": "o_positive", "date_of_birth": "1990-01-01" }),
    )
    .await;
    let donation = post(
        app,
        csrf,
        &format!("/api/blood-bank/donors/{}/donations", donor["id"].as_str().expect("donor id")),
        json!({ "bag_number": format!("LNK-BAG-{}", &Uuid::new_v4().to_string()[..8]), "volume_ml": 450, "weight_kg": 60.0, "hemoglobin_g_dl": 13.5, "systolic_bp": 120, "diastolic_bp": 80, "pulse": 72 }),
    )
    .await;
    let donation_id = donation["id"].as_str().expect("donation id").to_owned();
    // Screened non-reactive on all five markers: nothing is released otherwise.
    let markers: Vec<Value> = ["hiv", "hbsag", "hcv", "syphilis", "malaria"]
        .iter()
        .map(|m| json!({ "marker": m, "result": "non_reactive" }))
        .collect();
    post(
        app,
        csrf,
        &format!("/api/blood-bank/donations/{donation_id}/tti"),
        json!({ "results": markers }),
    )
    .await;
    let expiry = (chrono::Utc::now() + chrono::Duration::days(30)).to_rfc3339();
    let mut units = Vec::new();
    for _ in 0..2 {
        let c = post(
            &app,
            &csrf,
            "/api/blood-bank/components",
            json!({ "donation_id": donation_id, "component_type": "prbc",
                    "bag_number": format!("LNK-C-{}", &Uuid::new_v4().to_string()[..8]),
                    "blood_group": "o_positive", "volume_ml": 250, "expiry_at": expiry }),
        )
        .await;
        let id = c["id"].as_str().expect("component id").to_owned();
        let resp = app
            .client
            .put(app.url(&format!("/api/blood-bank/components/{id}/status")))
            .header("x-csrf-token", csrf)
            .json(&json!({ "status": "available" }))
            .send()
            .await
            .expect("status");
        assert!(resp.status().is_success());
        units.push(id);
    }

    // Two different verifiers: the admin and any other user.
    let other_user: Uuid = sqlx::query_scalar(
        "SELECT id FROM users WHERE tenant_id = $1 AND is_active = true AND id <> $2 LIMIT 1",
    )
    .bind(tenant_id)
    .bind(
        patient["created_by"]
            .as_str()
            .and_then(|s| s.parse::<Uuid>().ok())
            .unwrap_or(Uuid::nil()),
    )
    .fetch_one(&app.db)
    .await
    .expect("a second verifier");
    let me: Uuid = sqlx::query_scalar(
        "SELECT id FROM users WHERE tenant_id = $1 AND is_active = true AND id <> $2 LIMIT 1",
    )
    .bind(tenant_id)
    .bind(other_user)
    .fetch_one(&app.db)
    .await
    .expect("a first verifier");
    // A red-cell unit is issued only on a compatible crossmatch for this
    // patient and this unit.
    let crossmatch = post(
        app,
        csrf,
        "/api/blood-bank/crossmatch",
        json!({ "patient_id": patient_id, "blood_group": "o_positive" }),
    )
    .await;
    let matched = app
        .client
        .put(app.url(&format!(
            "/api/blood-bank/crossmatch/{}",
            crossmatch["id"].as_str().expect("crossmatch id")
        )))
        .header("x-csrf-token", csrf)
        .json(&json!({ "status": "compatible", "result": "compatible", "component_id": units[0] }))
        .send()
        .await
        .expect("crossmatch result");
    assert!(
        matched.status().is_success(),
        "crossmatch: {}",
        matched.status()
    );
    let transfusion = post(
        app,
        csrf,
        "/api/blood-bank/transfusions",
        json!({ "patient_id": patient_id, "component_id": units[0],
                "patient_verified_by": me, "product_verified_by": other_user }),
    )
    .await;
    let transfusion_id = transfusion["id"]
        .as_str()
        .expect("transfusion id")
        .to_owned();
    let reacted = app
        .client
        .put(app.url(&format!(
            "/api/blood-bank/transfusions/{transfusion_id}/reaction"
        )))
        .header("x-csrf-token", csrf)
        .json(&json!({ "reaction_type": "febrile", "reaction_severity": "severe" }))
        .send()
        .await
        .expect("record reaction");
    assert!(
        reacted.status().is_success(),
        "reaction: {}",
        reacted.status()
    );

    let emitted = app
        .outbox_rows("blood.transfusion_reaction.reported", &transfusion_id)
        .await;
    assert_eq!(emitted.len(), 1, "one reaction event");
    let event = emitted[0].clone();
    let reaction_id = event["payload"]["reaction_id"]
        .as_str()
        .expect("reaction id")
        .to_owned();
    ReactedTransfusion {
        tenant_id,
        sibling: units[1].parse().expect("uuid"),
        event,
        reaction_id,
    }
}

/// The status of one blood component, read as the owner.
async fn component_status(app: &common::TestApp, id: Uuid) -> String {
    sqlx::query_scalar("SELECT status::text FROM blood_components WHERE id = $1")
        .bind(id)
        .fetch_one(&app.db)
        .await
        .expect("component status")
}

#[tokio::test]
async fn transfusion_reaction_quarantines_siblings_alerts_and_files_one_incident() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let r = react_to_a_transfusion(&app, &csrf).await;
    let event = "blood.transfusion_reaction.reported";
    app.dispatch(r.tenant_id, event, &r.event).await;
    app.dispatch(r.tenant_id, event, &r.event).await;

    assert_eq!(
        component_status(&app, r.sibling).await,
        "quarantined",
        "the donation's other unit is held"
    );
    assert_eq!(
        incidents(&app, r.tenant_id, "transfusion_reaction", &r.reaction_id).await,
        1,
        "two deliveries, one incident"
    );
    assert!(
        !app.outbox_rows("blood_bank.transfusion_reaction_alert", &r.reaction_id)
            .await
            .is_empty(),
        "the blood bank is told"
    );
}

/// #6010: the blood-bank alert failing to queue used to be discarded with
/// `let _`. Postgres had already aborted the transaction, and `COMMIT` on an
/// aborted transaction rolls back without an error, so the quarantine and the
/// incident vanished while the event read as delivered. Now the dispatch
/// fails, nothing is half-done, and the retry does all of it.
#[tokio::test]
async fn transfusion_reaction_whose_alert_cannot_queue_fails_and_the_retry_completes_it() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let r = react_to_a_transfusion(&app, &csrf).await;
    let rid: Uuid = r.reaction_id.parse().expect("uuid");
    let fault = format!("txr_fault_{}", rid.simple());
    // Fault only this reaction's alert, so tests running beside it are untouched.
    sqlx::raw_sql(&format!(
        "CREATE FUNCTION {fault}() RETURNS trigger LANGUAGE plpgsql AS $f$ BEGIN \
           IF NEW.event_type = 'blood_bank.transfusion_reaction_alert' \
              AND NEW.payload->>'reaction_id' = '{rid}' THEN \
             RAISE EXCEPTION 'injected outbox fault'; END IF; RETURN NEW; END $f$; \
         CREATE TRIGGER {fault} BEFORE INSERT ON outbox_events \
           FOR EACH ROW EXECUTE FUNCTION {fault}();"
    ))
    .execute(&app.db)
    .await
    .expect("install fault");

    let event = "blood.transfusion_reaction.reported";
    let failed = medbrains_workflow::events::dispatch_to_pipelines(
        &app.db,
        r.tenant_id,
        Uuid::nil(),
        event,
        &r.event,
    )
    .await;
    sqlx::raw_sql(&format!(
        "DROP TRIGGER {fault} ON outbox_events; DROP FUNCTION {fault}();"
    ))
    .execute(&app.db)
    .await
    .expect("remove fault");

    assert!(
        failed.is_err(),
        "a reaction the blood bank was not told of is not delivered"
    );
    assert_eq!(
        component_status(&app, r.sibling).await,
        "available",
        "nothing claims to be held when the step failed"
    );
    assert_eq!(
        incidents(&app, r.tenant_id, "transfusion_reaction", &r.reaction_id).await,
        0
    );

    app.dispatch(r.tenant_id, event, &r.event).await;
    assert_eq!(component_status(&app, r.sibling).await, "quarantined");
    assert_eq!(
        incidents(&app, r.tenant_id, "transfusion_reaction", &r.reaction_id).await,
        1
    );
    assert!(
        !app.outbox_rows("blood_bank.transfusion_reaction_alert", &r.reaction_id)
            .await
            .is_empty(),
        "the retry tells the blood bank"
    );
}
