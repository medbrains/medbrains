//! Query budget: a list endpoint's round trips must not grow with its rows (#5462).
//!
//! Each test scopes a list to rows only it made (a quiet day, a fresh ward, a
//! unique surname), reads it once with 1 row and once with 50, and compares the
//! statement counts `query_count` reports. A query inside a per-row loop makes
//! the 50-row read 49 statements dearer; a flat list costs the same either way.

use crate::{common, query_count};

use chrono::{Duration, NaiveDate};
use reqwest::StatusCode;
use serde_json::Value;
use uuid::Uuid;

/// A test step's result: a failed seed or read fails the test with its error.
type R<T> = Result<T, Box<dyn std::error::Error>>;

/// The rows a test adds after its 1-row read, to reach 50.
const MORE: i64 = 49;

/// A signed-in admin plus the ids every seed needs.
#[derive(Debug)]
struct World {
    app: common::TestApp,
    tenant: Uuid,
    doctor: Uuid,
    /// Unique per test: the surname every seeded patient carries.
    tag: String,
}

/// Spawn the server, sign in, and pick the tenant and a doctor to seed with.
async fn world() -> R<World> {
    let app = common::spawn_app().await;
    app.login_admin().await;
    let (tenant, doctor): (Uuid, Uuid) =
        sqlx::query_as("SELECT tenant_id, id FROM users WHERE username = 'admin'")
            .fetch_one(&app.db)
            .await?;
    let tag = format!("Qb{}", &Uuid::new_v4().simple().to_string()[..10]);
    Ok(World {
        app,
        tenant,
        doctor,
        tag,
    })
}

/// A day in the 1980s no other test's rows land on.
fn quiet_day() -> NaiveDate {
    let offset = i64::try_from(Uuid::new_v4().as_u128() % 3600).unwrap_or(0);
    NaiveDate::from_ymd_opt(1980, 1, 1).unwrap_or_default() + Duration::days(offset)
}

/// GET `path` as the admin; returns the statement count and the JSON body.
async fn read(w: &World, path: &str) -> R<(u32, Value)> {
    let resp = w.app.get(&w.app.client, path).await;
    assert_eq!(resp.status(), StatusCode::OK, "{path}");
    let count = query_count::of(&resp).ok_or("no x-query-count header: counter not installed")?;
    Ok((count, resp.json().await?))
}

/// Number of entries in `body` (or in `body[key]` when the list is wrapped).
fn rows(body: &Value, key: Option<&str>) -> usize {
    key.map_or(body, |k| &body[k])
        .as_array()
        .map_or(0, Vec::len)
}

/// `n` patients surnamed `w.tag`, each with an OPD encounter on `day`;
/// returns `(patient, encounter)` pairs.
async fn seed_patients(w: &World, from: i64, n: i64, day: NaiveDate) -> R<Vec<(Uuid, Uuid)>> {
    sqlx::query_as(
        "WITH p AS ( \
           INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
           SELECT $1, $2 || '-' || g, 'Budget' || g, $2, 'other'::gender, \
                  '+9198' || lpad(((random() * 1e8)::bigint)::text, 8, '0') \
             FROM generate_series($3::bigint, $3 + $4 - 1) g RETURNING id) \
         INSERT INTO encounters (tenant_id, patient_id, encounter_type, encounter_date) \
         SELECT $1, p.id, 'opd', $5 FROM p RETURNING patient_id, id",
    )
    .bind(w.tenant)
    .bind(&w.tag)
    .bind(from)
    .bind(n)
    .bind(day)
    .fetch_all(&w.app.db)
    .await
    .map_err(Into::into)
}

/// The fewest statements two reads of `path` took, with the last body.
///
/// Middleware does throttled work (a session touch, a cache refresh) on some
/// requests and not others; the smaller of two reads is the list's own cost.
async fn cost(w: &World, path: &str) -> R<(u32, Value)> {
    let (first, _) = read(w, path).await?;
    let (second, body) = read(w, path).await?;
    Ok((first.min(second), body))
}

/// Read `path` warm at 1 row and again at 50; 50 rows must cost no more.
///
/// The counts go to stderr so a run's log is the per-endpoint budget record.
#[allow(clippy::print_stderr)]
async fn assert_flat(
    w: &World,
    path: &str,
    key: Option<&str>,
    seed_more: impl AsyncFnOnce() -> R<()>,
) -> R<()> {
    read(w, path).await?; // warm per-process caches (permissions, settings)
    let (one, body) = cost(w, path).await?;
    assert_eq!(rows(&body, key), 1, "{path} at 1 row: {body}");
    seed_more().await?;
    let (fifty, body) = cost(w, path).await?;
    assert_eq!(rows(&body, key), 50, "{path} at 50 rows");
    eprintln!("query budget {path}: {one} statements at 1 row, {fifty} at 50");
    assert!(
        fifty <= one,
        "{path}: {one} statements at 1 row, {fifty} at 50 — a query per row"
    );
    Ok(())
}

/// Given a quiet day's OPD queue, When it grows from 1 to 50 patients,
/// Then reading it costs the same number of statements.
#[tokio::test]
async fn opd_queue_is_flat() -> R<()> {
    let w = world().await?;
    let day = quiet_day();
    let dept: Uuid = sqlx::query_scalar("SELECT id FROM departments WHERE tenant_id = $1 LIMIT 1")
        .bind(w.tenant)
        .fetch_one(&w.app.db)
        .await?;
    let queue = async |from: i64, n: i64| -> R<()> {
        let pairs = seed_patients(&w, from, n, day).await?;
        let encounters: Vec<Uuid> = pairs.iter().map(|p| p.1).collect();
        sqlx::query(
            "INSERT INTO opd_queues (tenant_id, encounter_id, department_id, token_number, \
                                     status, queue_date) \
             SELECT $1, e, $2, $4 + o, 'waiting'::queue_status, $3 \
               FROM unnest($5::uuid[]) WITH ORDINALITY AS t(e, o)",
        )
        .bind(w.tenant)
        .bind(dept)
        .bind(day)
        .bind(i32::try_from(from).unwrap_or(0))
        .bind(&encounters)
        .execute(&w.app.db)
        .await?;
        Ok(())
    };
    queue(1, 1).await?;
    let path = format!("/api/opd/queue?date={day}&search={}", w.tag);
    assert_flat(&w, &path, None, async || queue(2, MORE).await).await
}

/// Given patients sharing a unique surname, When 49 more register,
/// Then searching for the surname costs the same number of statements.
#[tokio::test]
async fn patient_search_is_flat() -> R<()> {
    let w = world().await?;
    let day = quiet_day();
    seed_patients(&w, 1, 1, day).await?;
    let path = format!("/api/patients?search={}&per_page=100", w.tag);
    assert_flat(&w, &path, Some("patients"), async || {
        seed_patients(&w, 2, MORE, day).await.map(drop)
    })
    .await
}

/// Given one patient's invoices, When they go from 1 to 50,
/// Then the billing list for that patient costs the same number of statements.
#[tokio::test]
async fn invoice_list_is_flat() -> R<()> {
    let w = world().await?;
    let (patient, encounter) = *seed_patients(&w, 1, 1, quiet_day())
        .await?
        .first()
        .ok_or("no patient seeded")?;
    let bill = async |from: i64, n: i64| -> R<()> {
        sqlx::query(
            "INSERT INTO invoices (tenant_id, invoice_number, patient_id, encounter_id, total_amount) \
             SELECT $1, $2 || '-INV-' || g, $3, $4, 100 FROM generate_series($5::bigint, $5 + $6 - 1) g",
        )
        .bind(w.tenant)
        .bind(&w.tag)
        .bind(patient)
        .bind(encounter)
        .bind(from)
        .bind(n)
        .execute(&w.app.db)
        .await?;
        Ok(())
    };
    bill(1, 1).await?;
    let path = format!("/api/billing/invoices?patient_id={patient}&per_page=100");
    assert_flat(&w, &path, Some("invoices"), async || bill(2, MORE).await).await
}

/// Given prescriptions waiting for pharmacist review, When they go from 1 to 50,
/// Then the dispense queue costs the same number of statements.
#[tokio::test]
async fn pharmacy_rx_queue_is_flat() -> R<()> {
    let w = world().await?;
    let day = quiet_day();
    let prescribe = async |from: i64, n: i64| -> R<()> {
        let pairs = seed_patients(&w, from, n, day).await?;
        let (patients, encounters): (Vec<Uuid>, Vec<Uuid>) = pairs.into_iter().unzip();
        sqlx::query(
            "WITH rx AS ( \
               INSERT INTO prescriptions (tenant_id, encounter_id, doctor_id, patient_id) \
               SELECT $1, e, $2, p FROM unnest($3::uuid[], $4::uuid[]) AS t(p, e) \
               RETURNING id, encounter_id, patient_id) \
             INSERT INTO pharmacy_prescriptions (tenant_id, prescription_id, patient_id, \
                                                 encounter_id, doctor_id) \
             SELECT $1, rx.id, rx.patient_id, rx.encounter_id, $2 FROM rx \
             WHERE NOT EXISTS (SELECT 1 FROM pharmacy_prescriptions pp \
                                WHERE pp.prescription_id = rx.id)",
        )
        .bind(w.tenant)
        .bind(w.doctor)
        .bind(&patients)
        .bind(&encounters)
        .execute(&w.app.db)
        .await?;
        Ok(())
    };
    prescribe(1, 1).await?;
    let path = format!("/api/pharmacy/rx-queue?search={}", w.tag);
    assert_flat(&w, &path, None, async || prescribe(2, MORE).await).await
}

/// A ward of its own; returns its id.
async fn fresh_ward(w: &World) -> R<Uuid> {
    sqlx::query_scalar(
        "INSERT INTO wards (tenant_id, code, name, total_beds) VALUES ($1, $2, $2, 50) RETURNING id",
    )
    .bind(w.tenant)
    .bind(format!("QB-{}", w.tag.to_uppercase()))
    .fetch_one(&w.app.db)
    .await
    .map_err(Into::into)
}

/// Given a fresh ward, When it goes from 1 bed to 50,
/// Then the bed board for that ward costs the same number of statements.
#[tokio::test]
async fn bed_board_is_flat() -> R<()> {
    let w = world().await?;
    let ward = fresh_ward(&w).await?;
    let beds = async |from: i64, n: i64| -> R<()> {
        sqlx::query(
            "WITH l AS ( \
               INSERT INTO locations (tenant_id, level, code, name) \
               SELECT $1, 'bed', $3 || '-B' || g, 'Bed ' || g \
                 FROM generate_series($4::bigint, $4 + $5 - 1) g RETURNING id), \
             m AS (INSERT INTO ward_bed_mappings (tenant_id, ward_id, bed_location_id) \
                   SELECT $1, $2, id FROM l RETURNING bed_location_id) \
             INSERT INTO bed_states (tenant_id, location_id, ward_id) \
             SELECT $1, bed_location_id, $2 FROM m \
             ON CONFLICT (tenant_id, location_id) DO UPDATE SET ward_id = EXCLUDED.ward_id",
        )
        .bind(w.tenant)
        .bind(ward)
        .bind(format!("QB-{}", w.tag.to_uppercase()))
        .bind(from)
        .bind(n)
        .execute(&w.app.db)
        .await?;
        Ok(())
    };
    beds(1, 1).await?;
    let path = format!("/api/ipd/bed-dashboard/beds?ward_id={ward}");
    assert_flat(&w, &path, None, async || beds(2, MORE).await).await
}

/// Given a ward whose patients each have a pending task, When it goes from 1
/// admitted patient to 50, Then the shift handover costs the same number of
/// statements — it used to cost three more per patient.
#[tokio::test]
async fn ward_handover_is_flat() -> R<()> {
    let w = world().await?;
    let ward = fresh_ward(&w).await?;
    let day = quiet_day();
    let admit = async |from: i64, n: i64| -> R<()> {
        let pairs = seed_patients(&w, from, n, day).await?;
        let (patients, encounters): (Vec<Uuid>, Vec<Uuid>) = pairs.into_iter().unzip();
        sqlx::query(
            "WITH a AS ( \
               INSERT INTO admissions (tenant_id, encounter_id, patient_id, admitting_doctor, \
                                       ward_id, status) \
               SELECT $1, e, p, $2, $3, 'admitted' FROM unnest($4::uuid[], $5::uuid[]) AS t(p, e) \
               RETURNING id) \
             INSERT INTO nursing_tasks (tenant_id, admission_id, task_type, description) \
             SELECT $1, id, 'monitoring', 'Check drain' FROM a",
        )
        .bind(w.tenant)
        .bind(w.doctor)
        .bind(ward)
        .bind(&patients)
        .bind(&encounters)
        .execute(&w.app.db)
        .await?;
        Ok(())
    };
    admit(1, 1).await?;
    let path = format!("/api/care-view/handover?ward_id={ward}&shift=morning");
    assert_flat(&w, &path, Some("patients"), async || admit(2, MORE).await).await
}
