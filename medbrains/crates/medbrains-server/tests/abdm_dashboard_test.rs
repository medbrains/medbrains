//! The ABDM management dashboard: a month's OPD ABHA coverage, KYC, ABHAs
//! created here, links counted for DHIS under its caps (KYC-verified ABHAs,
//! one a day and five a month per ABHA), the threshold flag, consents, Scan &
//! Share and failed links — and the same DHIS figures on the sharing summary,
//! because both read one definition. Staff without the permission get 403.

use crate::abdm_hip_world;
use crate::common;

use abdm_hip_world::{World, world};
use serde_json::{Value, json};
use uuid::Uuid;

/// Every test saves ABDM keys for the same hospital; run them one at a time.
static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

/// A month nothing else writes to: far in the past, different every run.
fn quiet_month() -> String {
    let n = Uuid::new_v4().as_u128();
    format!("{}-{:02}", 1990 + n % 30, 1 + (n / 30) % 12)
}

async fn new_patient(w: &World, first: &str) -> Uuid {
    let p: Value = w
        .app
        .client
        .post(w.app.url("/api/patients"))
        .header("x-csrf-token", &w.csrf)
        .json(&json!({
            "first_name": first, "last_name": "Dash", "gender": "male", "date_of_birth": "1980-01-01",
            "phone": format!("9{:09}", Uuid::new_v4().as_u128() % 1_000_000_000),
        }))
        .send()
        .await
        .expect("register")
        .json()
        .await
        .expect("patient");
    Uuid::parse_str(p["id"].as_str().expect("id")).expect("uuid")
}

/// Clear anything an earlier run left in the month, then seed it. `{m}` is
/// the month's first day; `{a}` has a KYC-verified ABHA, `{b}` a verified ABHA
/// without KYC, `{c}` none; `{why}` is this run's failure reason.
const SEED: &str = r"
DO $$ DECLARE t uuid := (SELECT tenant_id FROM patients WHERE id = '{a}');
  u uuid := (SELECT id FROM users WHERE username = 'admin'); m date := '{m}';
BEGIN
  UPDATE abdm_care_contexts SET deleted_at = now() WHERE tenant_id = t AND dhis_month = m;
  UPDATE encounters SET deleted_at = now() WHERE tenant_id = t AND date_trunc('month', encounter_date) = m;
  UPDATE abha_verifications SET deleted_at = now()
   WHERE tenant_id = t AND date_trunc('month', timezone('Asia/Kolkata', verified_at)) = m;
  UPDATE abdm_profile_shares SET deleted_at = now()
   WHERE tenant_id = t AND date_trunc('month', timezone('Asia/Kolkata', created_at)) = m;
  UPDATE abdm_consent_artefacts SET deleted_at = now()
   WHERE tenant_id = t AND date_trunc('month', timezone('Asia/Kolkata', notified_at)) = m;
  UPDATE abdm_consent_requests SET deleted_at = now()
   WHERE tenant_id = t AND date_trunc('month', timezone('Asia/Kolkata', requested_at)) = m;

  UPDATE patient_abha_links SET kyc_verified = true, verified_at = m - 40 WHERE patient_id = '{a}';
  INSERT INTO patient_abha_links (tenant_id, patient_id, abha_number, kyc_verified, verified_at)
  VALUES (t, '{b}', '{b_abha}', false, m - 40);

  -- A: day 1 has a category-1 and a category-2 record, days 2-6 one category-2
  -- each: six days, so the monthly cap of five drops one. B: no KYC.
  INSERT INTO abdm_care_contexts (tenant_id, patient_id, source_kind, source_id, reference_number,
         display, hi_types, record_date, link_status, linked_at, linked_via, last_error)
  SELECT t, p, 'opd_consult', gen_random_uuid(), 'DASH-' || gen_random_uuid(), 'Dashboard test',
         hi, m + d, st, CASE WHEN st = 'linked' THEN ((m + d) + time '10:00') AT TIME ZONE 'Asia/Kolkata' END,
         CASE WHEN st = 'linked' THEN 'hip_initiated' END, err
    FROM (VALUES ('{a}'::uuid, 0, ARRAY['DiagnosticReport'], 'linked', NULL),
                 ('{a}'::uuid, 0, ARRAY['OPConsultation'], 'linked', NULL),
                 ('{a}'::uuid, 1, ARRAY['OPConsultation'], 'linked', NULL),
                 ('{a}'::uuid, 2, ARRAY['Prescription'], 'linked', NULL),
                 ('{a}'::uuid, 3, ARRAY['OPConsultation'], 'linked', NULL),
                 ('{a}'::uuid, 4, ARRAY['OPConsultation'], 'linked', NULL),
                 ('{a}'::uuid, 5, ARRAY['OPConsultation'], 'linked', NULL),
                 ('{b}'::uuid, 0, ARRAY['DischargeSummary'], 'linked', NULL),
                 ('{b}'::uuid, 1, ARRAY['DiagnosticReport'], 'linked', NULL),
                 ('{a}'::uuid, 7, ARRAY['OPConsultation'], 'failed', '{why}'),
                 ('{c}'::uuid, 7, ARRAY['OPConsultation'], 'failed', '{why}'))
         AS v(p, d, hi, st, err);

  INSERT INTO encounters (tenant_id, patient_id, encounter_type, status, encounter_date)
  SELECT t, p, 'opd', 'open', m + 2 FROM unnest(ARRAY['{a}', '{a}', '{b}', '{c}']::uuid[]) p;

  INSERT INTO abha_verifications (tenant_id, created_by, method, otp_system, environment, abdm_txn_id,
         stage, abha_number, verified_at, expires_at, created_here)
  SELECT t, u, 'aadhaar_enrol', 'aadhaar', 'sandbox', 'txn', 'verified', '91000000000000',
         m + time '11:00', m + time '11:30', here FROM unnest(ARRAY[true, true, false]) here;

  INSERT INTO abdm_profile_shares (tenant_id, facility_id, request_id, abha_address, profile, status,
         expires_at, created_at)
  SELECT t, (SELECT id FROM facilities WHERE tenant_id = t AND hfr_facility_id = '{hip}'),
         gen_random_uuid()::text, 'dash@sbx', '{}'::jsonb, st, m + 1, m + time '09:00'
    FROM unnest(ARRAY['linked', 'registered', 'expired', 'waiting']) st;

  INSERT INTO abdm_consent_artefacts (tenant_id, consent_id, role, patient_id, status, notified_at)
  SELECT t, gen_random_uuid()::text, 'hip', '{a}', st, m + time '12:00'
    FROM unnest(ARRAY['GRANTED', 'GRANTED', 'DENIED', 'REVOKED']) st;

  -- HIU: the first granted request brought two records from another HIP on one
  -- day (one DHIS consent); the second only from ourselves (none).
  WITH r AS (
    INSERT INTO abdm_consent_requests (tenant_id, patient_id, requested_by, requester_name,
           requester_hpr_id, abha_address, hiu_id, purpose_code, hi_types, date_from, date_to,
           data_erase_at, status, requested_at)
    SELECT t, '{a}', u, 'Dr Test', 'hpr', 'a@sbx', 'OURHIU', 'CAREMGT', ARRAY['OPConsultation'],
           m - 365, m, m + 365, st, m + time '08:00' + n * interval '1 minute'
      FROM unnest(ARRAY['granted', 'granted', 'denied', 'revoked']) WITH ORDINALITY AS s(st, n)
    RETURNING id, status, requested_at),
  a AS (
    INSERT INTO abdm_consent_artefacts (tenant_id, consent_id, role, patient_id, hiu_id, status,
           consent_request_id, notified_at)
    SELECT t, gen_random_uuid()::text, 'hiu', '{a}', 'OURHIU', 'GRANTED', r.id, r.requested_at
      FROM r WHERE r.status = 'granted'
    RETURNING id, consent_request_id, notified_at)
  INSERT INTO abdm_received_records (tenant_id, patient_id, consent_request_id, consent_artefact_id,
         care_context_reference, source_hip_id, transaction_id, checksum, bundle, received_at, erase_at)
  SELECT t, '{a}', a.consent_request_id, a.id, 'ref' || g, src, 'tx', 'sum', '{}'::jsonb,
         a.notified_at + interval '1 hour', m + 365
    FROM a CROSS JOIN LATERAL (
      SELECT CASE WHEN a.notified_at = (SELECT min(notified_at) FROM a) THEN 'OTHERHIP' ELSE 'OURHIU' END) s(src)
    CROSS JOIN generate_series(1, 2) g;
END $$;
";

async fn get(w: &World, path: &str) -> Value {
    let r = w.app.client.get(w.app.url(path)).send().await.expect("get");
    assert_eq!(r.status().as_u16(), 200, "{path}");
    r.json().await.expect("json")
}

/// Given a month with the records above, When management opens the
/// dashboard, Then every KPI counts exactly them and DHIS applies its caps.
#[tokio::test]
async fn the_dashboard_counts_the_month_and_dhis_applies_its_caps() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let (b, c) = (
        new_patient(&w, "Bina").await,
        new_patient(&w, "Chetan").await,
    );
    let month = quiet_month();
    let why = format!("HIP refused {}", Uuid::new_v4().simple());
    let b_abha = format!("92{:012}", Uuid::new_v4().as_u128() % 1_000_000_000_000);
    let seed = SEED
        .replace("{m}", &format!("{month}-01"))
        .replace("{a}", &w.patient_id.to_string())
        .replace("{b}", &b.to_string())
        .replace("{c}", &c.to_string())
        .replace("{b_abha}", &b_abha)
        .replace("{hip}", &w.hip_id)
        .replace("{why}", &why);
    sqlx::raw_sql(&seed).execute(&w.app.db).await.expect("seed");

    let d = get(&w, &format!("/api/abdm/dashboard?month={month}")).await;
    let cur = &d["current"];
    assert_eq!(cur["month"], format!("{month}-01"));
    assert_eq!(cur["opd_visits"], 4);
    assert_eq!(cur["opd_with_abha"], 3, "C has no ABHA");
    assert_eq!(cur["abha_patients"], 2);
    assert_eq!(cur["kyc_patients"], 1, "B's ABHA is not KYC-verified");
    assert_eq!(
        cur["abhas_created"], 2,
        "a verified-elsewhere ABHA is not ours"
    );
    assert_eq!(cur["shares"], 4);
    assert_eq!(cur["shares_completed"], 2);
    assert_eq!(
        cur["shares_expired"], 2,
        "a waiting share past its expiry is expired"
    );
    assert_eq!(cur["hip_consents_granted"], 2);
    assert_eq!(cur["hip_consents_denied"], 1);
    assert_eq!(cur["hip_consents_revoked"], 1);
    assert_eq!(cur["hiu_consents_granted"], 2);
    assert_eq!(cur["hiu_consents_denied"], 1);
    assert_eq!(cur["hiu_consents_revoked"], 1);

    let dhis = &cur["dhis"];
    assert_eq!(dhis["linked_category_1"], 3, "A's report and B's two");
    assert_eq!(dhis["linked_category_2"], 6);
    assert_eq!(dhis["eligible_category_1"], 1, "B is not KYC-verified");
    assert_eq!(
        dhis["eligible_category_2"], 4,
        "day 1 is taken by the category-1 record; day 6 is past the cap of five"
    );
    assert_eq!(
        dhis["hiu_eligible_consents"], 1,
        "records from ourselves do not count"
    );
    let est = &cur["estimate"];
    assert_eq!(est["eligible_links"], 5);
    assert_eq!(est["hip_inr"], 10 + 4 * 5);
    assert_eq!(est["hiu_inr"], 10);
    assert_eq!(est["threshold"], 100);
    assert_eq!(est["threshold_met"], false);
    assert_eq!(
        est["payable_inr"], 0,
        "below the threshold DHIS pays nothing"
    );

    let trend = d["trend"].as_array().expect("trend");
    assert_eq!(trend.len(), 6);
    assert_eq!(
        trend[5], d["current"],
        "the trend ends with the chosen month"
    );
    assert_eq!(trend[4]["opd_visits"], 0);

    let failures = d["failures"].to_string();
    assert!(failures.contains(&why), "{failures}");
    assert!(d["failures_open"].as_i64().unwrap_or(0) >= 2);
    assert!(
        d["failure_reasons"]
            .as_array()
            .is_some_and(|r| !r.is_empty())
    );
    assert!(d["facilities"].to_string().contains(&w.hip_id));
    let hpr = &d["hpr"];
    assert!(hpr["with_hpr_id"].as_i64() <= hpr["active_doctors"].as_i64());

    // The sharing summary reads the same DHIS definition.
    let s = get(&w, &format!("/api/abdm/sharing/summary?month={month}")).await;
    assert_eq!(s["counts"]["eligible_category_2"], 4);
    assert_eq!(s["estimated_incentive_inr"], 30);
    assert_eq!(s["hiu_estimated_incentive_inr"], 10);
    assert_eq!(s["threshold_met"], false);
}

/// Given staff without `abdm.dashboard.view`, Then the dashboard is 403;
/// a quality officer, who holds it, sees it; a malformed month is 400.
#[tokio::test]
async fn the_dashboard_needs_its_permission() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let desk = common::provision_staff(&w.app, &w.csrf, "receptionist", &[]).await;
    let r = desk
        .client
        .get(w.app.url("/api/abdm/dashboard"))
        .send()
        .await
        .expect("get");
    assert_eq!(r.status().as_u16(), 403);
    let quality = common::provision_staff(&w.app, &w.csrf, "quality_officer", &[]).await;
    let r = quality
        .client
        .get(w.app.url("/api/abdm/dashboard"))
        .send()
        .await
        .expect("get");
    assert_eq!(r.status().as_u16(), 200);
    let r = w
        .app
        .client
        .get(w.app.url("/api/abdm/dashboard?month=2026-13"))
        .send()
        .await
        .expect("get");
    assert_eq!(r.status().as_u16(), 400);
}
