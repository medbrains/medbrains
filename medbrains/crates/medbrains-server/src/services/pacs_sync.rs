//! Bring studies back from the PACS to their orders (#226).
//!
//! Each pass reads Orthanc's change feed from where the last pass stopped.
//! A `StableStudy` (no new images for a while) is looked up, and its
//! accession number — the one the modality copied from the worklist — names
//! the radiology order it belongs to. The study is recorded against that
//! order, the order is marked done, and the viewer link is set. A study
//! whose accession matches no order is left for the PACS's own reconciliation:
//! guessing a patient from a name is how images end up in the wrong record.

use std::time::Duration;

use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;

const PASS_INTERVAL_SECS: u64 = 60;
/// Change-feed pages read per tenant per pass (100 changes each).
const MAX_PAGES: usize = 20;

pub fn spawn(pool: PgPool) {
    tokio::spawn(async move {
        let http = reqwest::Client::new();
        loop {
            match scan_once(&pool, &http).await {
                Ok(linked) if linked > 0 => tracing::info!(linked, "PACS studies linked"),
                Ok(_) => {}
                Err(error) => tracing::error!(%error, "PACS sync failed"),
            }
            tokio::time::sleep(Duration::from_secs(PASS_INTERVAL_SECS)).await;
        }
    });
}

#[derive(sqlx::FromRow)]
struct Config {
    tenant_id: Uuid,
    value: Value,
}

/// The PACS's HTTP API for one hospital.
struct Pacs<'a> {
    http: &'a reqwest::Client,
    url: String,
    username: String,
}

impl Pacs<'_> {
    async fn get(&self, path: &str) -> Result<Value, AppError> {
        let mut request = self
            .http
            .get(format!("{}{path}", self.url))
            .timeout(Duration::from_secs(20));
        if !self.username.is_empty() {
            let password = std::env::var("ORTHANC_PASSWORD").unwrap_or_default();
            request = request.basic_auth(&self.username, Some(password));
        }
        let response = request
            .send()
            .await
            .map_err(|e| AppError::ServiceUnavailable(format!("PACS unreachable: {e}")))?;
        if !response.status().is_success() {
            return Err(AppError::ServiceUnavailable(format!(
                "PACS answered {} for {path}",
                response.status()
            )));
        }
        response
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("PACS reply for {path}: {e}")))
    }
}

/// One pass over every hospital with a PACS. Returns how many studies it linked.
pub async fn scan_once(pool: &PgPool, http: &reqwest::Client) -> Result<u64, AppError> {
    let configs = sqlx::query_as::<_, Config>(
        "SELECT tenant_id, value FROM tenant_settings \
          WHERE category = 'radiology' AND key = 'pacs_config' AND deleted_at IS NULL \
            AND COALESCE(value->>'orthanc_url', '') <> '' LIMIT 1000",
    )
    .fetch_all(pool)
    .await?;
    let mut linked = 0;
    for config in configs {
        let field = |k: &str| {
            config
                .value
                .get(k)
                .and_then(Value::as_str)
                .unwrap_or_default()
                .trim()
                .to_owned()
        };
        let pacs = Pacs {
            http,
            url: field("orthanc_url").trim_end_matches('/').to_owned(),
            username: field("orthanc_username"),
        };
        match sync_tenant(pool, config.tenant_id, &pacs).await {
            Ok(n) => linked += n,
            Err(error) => {
                tracing::warn!(tenant_id = %config.tenant_id, %error, "PACS sync for tenant failed");
            }
        }
    }
    Ok(linked)
}

async fn sync_tenant(pool: &PgPool, tenant_id: Uuid, pacs: &Pacs<'_>) -> Result<u64, AppError> {
    let mut cursor: i64 = sqlx::query_scalar::<_, Value>(
        "SELECT value FROM tenant_settings \
          WHERE tenant_id = $1 AND category = 'radiology' AND key = 'pacs_cursor' AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .fetch_optional(pool)
    .await?
    .and_then(|v| v.as_i64())
    .unwrap_or(0);
    let mut linked = 0;
    for _ in 0..MAX_PAGES {
        let page = pacs
            .get(&format!("/changes?since={cursor}&limit=100"))
            .await?;
        let studies = page["Changes"]
            .as_array()
            .map(|c| {
                c.iter()
                    .filter(|ch| ch["ChangeType"] == "StableStudy")
                    .filter_map(|ch| ch["ID"].as_str().map(str::to_owned))
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        for orthanc_id in studies {
            if link_study(pool, tenant_id, pacs, &orthanc_id).await? {
                linked += 1;
            }
        }
        cursor = page["Last"].as_i64().unwrap_or(cursor);
        if page["Done"].as_bool().unwrap_or(true) {
            break;
        }
    }
    sqlx::query(
        "INSERT INTO tenant_settings (id, tenant_id, category, key, value) \
         VALUES (gen_random_uuid(), $1, 'radiology', 'pacs_cursor', $2) \
         ON CONFLICT (tenant_id, category, key) DO UPDATE \
            SET value = $2, updated_at = now(), deleted_at = NULL, deleted_by = NULL, delete_reason = NULL",
    )
    .bind(tenant_id)
    .bind(serde_json::json!(cursor))
    .execute(pool)
    .await?;
    Ok(linked)
}

#[derive(sqlx::FromRow)]
struct Order {
    id: Uuid,
    patient_id: Uuid,
    modality: String,
}

/// Record one stable study against its order. False when no order matches.
async fn link_study(
    pool: &PgPool,
    tenant_id: Uuid,
    pacs: &Pacs<'_>,
    orthanc_id: &str,
) -> Result<bool, AppError> {
    let study = pacs.get(&format!("/studies/{orthanc_id}")).await?;
    let tags = &study["MainDicomTags"];
    let text = |k: &str| tags[k].as_str().unwrap_or_default().trim().to_owned();
    let (accession, uid) = (text("AccessionNumber"), text("StudyInstanceUID"));
    if accession.is_empty() || uid.is_empty() {
        return Ok(false);
    }
    let mut tx = pool.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    let order = sqlx::query_as::<_, Order>(
        "SELECT o.id, o.patient_id, m.code AS modality FROM radiology_orders o \
           JOIN radiology_modalities m ON m.id = o.modality_id \
          WHERE o.tenant_id = $1 AND o.accession_number = $2 AND o.deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(&accession)
    .fetch_optional(&mut *tx)
    .await?;
    let Some(order) = order else {
        tracing::info!(%tenant_id, accession, "PACS study matches no order; left for reconciliation");
        return Ok(false);
    };
    let stats = pacs
        .get(&format!("/studies/{orthanc_id}/statistics"))
        .await?;
    let count = |k: &str| {
        stats[k]
            .as_i64()
            .or_else(|| stats[k].as_str().and_then(|s| s.parse().ok()))
            .unwrap_or(0)
    };
    let study_date = chrono::NaiveDate::parse_from_str(&text("StudyDate"), "%Y%m%d").ok();
    let viewer = format!("{}/ohif/viewer?StudyInstanceUIDs={uid}", pacs.url);
    sqlx::query(
        "INSERT INTO radiology_dicom_studies \
           (tenant_id, order_id, patient_id, study_instance_uid, accession_number, modality, \
            study_date, study_description, instance_count, series_count, orthanc_id, pacs_url, \
            viewer_url, file_size_bytes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, NULLIF($8, ''), $9, $10, $11, $12, $13, $14) \
         ON CONFLICT (tenant_id, study_instance_uid) DO UPDATE SET \
           instance_count = EXCLUDED.instance_count, series_count = EXCLUDED.series_count, \
           file_size_bytes = EXCLUDED.file_size_bytes, updated_at = now(), \
           deleted_at = NULL, deleted_by = NULL, delete_reason = NULL",
    )
    .bind(tenant_id)
    .bind(order.id)
    .bind(order.patient_id)
    .bind(&uid)
    .bind(&accession)
    .bind(&order.modality)
    .bind(study_date)
    .bind(text("StudyDescription"))
    .bind(i32::try_from(count("CountInstances")).unwrap_or(i32::MAX))
    .bind(i32::try_from(count("CountSeries")).unwrap_or(i32::MAX))
    .bind(orthanc_id)
    .bind(&pacs.url)
    .bind(&viewer)
    .bind(count("DiskSize"))
    .execute(&mut *tx)
    .await?;
    // The images are in: the exam is done, and the radiologist can report it.
    sqlx::query(
        "UPDATE radiology_orders SET pacs_study_uid = $1, orthanc_id = $2, \
                status = CASE WHEN status::text IN ('ordered', 'scheduled', 'in_progress') \
                              THEN 'completed'::radiology_order_status ELSE status END, \
                completed_at = COALESCE(completed_at, now()), updated_at = now() \
          WHERE id = $3 AND tenant_id = $4",
    )
    .bind(&uid)
    .bind(orthanc_id)
    .bind(order.id)
    .bind(tenant_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(true)
}
