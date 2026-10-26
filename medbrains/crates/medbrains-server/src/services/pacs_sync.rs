//! Bring studies back from the PACS to their orders (#226).
//!
//! Each pass reads Orthanc's change feed from where the last pass stopped.
//! A `StableStudy` (no new images for a while) is looked up, and its
//! accession number — the one the modality copied from the worklist — names
//! the radiology order it belongs to. The study is recorded against that
//! order, the order is marked done, the viewer link is set and its dose read.
//! A study whose accession matches no order — a walk-in X-ray, a mistyped
//! accession — is queued for the radiology desk to match by hand: guessing a
//! patient from a name is how images end up in the wrong record.

use std::time::Duration;

use medbrains_core::secrets::SecretResolver;
use medbrains_outbox::handlers::pacs_target::{self, Policy, Target};
use medbrains_radiology::dose::CapturedStudy;
use medbrains_radiology::pacs_study::{self, OrderRef, pacs_get};
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;

const PASS_INTERVAL_SECS: u64 = 60;
/// Change-feed pages read per tenant per pass (100 changes each).
const MAX_PAGES: usize = 20;

pub fn spawn(pool: PgPool) {
    tokio::spawn(async move {
        let secrets = crate::secret_backend::build_secret_resolver().await;
        loop {
            match scan_once(&pool, secrets.as_ref()).await {
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

/// One pass over every hospital with a PACS. Returns how many studies it linked.
pub async fn scan_once(pool: &PgPool, secrets: &dyn SecretResolver) -> Result<u64, AppError> {
    let configs = sqlx::query_as::<_, Config>(
        "SELECT tenant_id, value FROM tenant_settings \
          WHERE category = 'radiology' AND key = 'pacs_config' AND deleted_at IS NULL \
            AND COALESCE(value->>'orthanc_url', '') <> '' LIMIT 1000",
    )
    .fetch_all(pool)
    .await?;
    let policy = Policy::from_env();
    let mut linked = 0;
    for config in configs {
        // A refused address or an unusable password stops this hospital's
        // sync before anything is sent; the others carry on.
        let target = match pacs_target::target_from_config(
            config.tenant_id,
            &config.value,
            secrets,
            &policy,
        )
        .await
        {
            Ok(Some(target)) => target,
            Ok(None) => continue,
            Err(error) => {
                tracing::warn!(tenant_id = %config.tenant_id, %error, "PACS not contacted");
                continue;
            }
        };
        match sync_tenant(pool, config.tenant_id, &target).await {
            Ok(n) => linked += n,
            Err(error) => {
                tracing::warn!(tenant_id = %config.tenant_id, %error, "PACS sync for tenant failed");
            }
        }
    }
    Ok(linked)
}

async fn sync_tenant(pool: &PgPool, tenant_id: Uuid, pacs: &Target) -> Result<u64, AppError> {
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
        let page = pacs_get(pacs, &format!("/changes?since={cursor}&limit=100")).await?;
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

/// File one stable study under its order, or queue it for a person to
/// match. True when it was filed.
async fn link_study(
    pool: &PgPool,
    tenant_id: Uuid,
    pacs: &Target,
    orthanc_id: &str,
) -> Result<bool, AppError> {
    let facts = pacs_study::read_study(pacs, orthanc_id).await?;
    if facts.uid.is_empty() {
        return Ok(false);
    }
    let mut tx = pool.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    // Its accession names the order; a study already filed (more images
    // arrived after it was matched by hand) keeps the order it has.
    let order = sqlx::query_as::<_, OrderRef>(
        "SELECT o.id, o.patient_id, m.code AS modality FROM radiology_orders o \
           JOIN radiology_modalities m ON m.id = o.modality_id \
          WHERE o.tenant_id = $1 AND o.deleted_at IS NULL \
            AND (o.accession_number = NULLIF($2, '') \
                 OR o.id = (SELECT order_id FROM radiology_dicom_studies \
                             WHERE tenant_id = $1 AND study_instance_uid = $3 \
                               AND deleted_at IS NULL)) \
          LIMIT 1",
    )
    .bind(tenant_id)
    .bind(&facts.accession)
    .bind(&facts.uid)
    .fetch_optional(&mut *tx)
    .await?;
    let Some(order) = order else {
        pacs_study::queue_unmatched(&mut tx, tenant_id, &facts).await?;
        tx.commit().await?;
        tracing::info!(%tenant_id, accession = facts.accession, "PACS study matches no order; queued for the radiology desk");
        return Ok(false);
    };
    let study_row =
        pacs_study::attach_study(&mut tx, tenant_id, &order, &facts, Some(&pacs.base)).await?;
    tx.commit().await?;
    // The dose is a second reading of the same study. Failing it must not
    // unlink the images, so it is reported and left for manual entry.
    let study = CapturedStudy {
        tenant_id,
        order_id: order.id,
        patient_id: order.patient_id,
        dicom_study_id: study_row,
        modality: &order.modality,
    };
    if let Err(error) = pacs_study::capture_dose(pool, pacs, &study, orthanc_id).await {
        tracing::warn!(%tenant_id, orthanc_id, %error, "dose not read from the PACS; enter it on the order");
    }
    Ok(true)
}
