//! The hospital's ICD-10 catalogue and its coding switch, in PostgreSQL.
//! Every call runs in the caller's tenant-scoped transaction (RLS).

use chrono::{DateTime, Utc};
use medbrains_core::diagnosis_coding::{DiagnosisCoding, SETTING_CATEGORY, SETTING_KEY};
use medbrains_db::audit::{AuditEntry, AuditLogger};
use serde::Serialize;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use medbrains_server_core::error::AppError;

use super::parse::{self, Format};

type Tx<'a> = Transaction<'a, Postgres>;

const INSERT_CHUNK: usize = 5_000;
const MAX_RELEASES_LISTED: i64 = 50;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Icd10Release {
    pub id: Uuid,
    pub version: String,
    pub source: String,
    pub licence_note: String,
    pub file_name: Option<String>,
    pub format: String,
    pub content_sha256: String,
    pub code_count: i32,
    pub loaded_by: Uuid,
    pub loaded_by_name: Option<String>,
    pub loaded_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Icd10Code {
    pub code: String,
    pub title: String,
    pub chapter: Option<String>,
}

#[derive(Debug)]
pub struct ReleaseMeta {
    pub version: String,
    pub source: String,
    pub licence_note: String,
    pub file_name: Option<String>,
    pub format: Format,
}

const RELEASE_SELECT: &str = "SELECT r.id, r.version, r.source, r.licence_note, r.file_name, \
    r.format, r.content_sha256, r.code_count, r.loaded_by, u.full_name AS loaded_by_name, \
    r.loaded_at FROM icd10_releases r LEFT JOIN users u ON u.id = r.loaded_by \
    WHERE r.tenant_id = $1 AND r.deleted_at IS NULL";

/// The switch. A missing row reads as the documented default (ICD-11 —
/// migration 1196 seeds one for every tenant); a value the server never
/// writes is an error, not a silent default.
pub async fn load_coding(tx: &mut Tx<'_>, tenant: Uuid) -> Result<DiagnosisCoding, AppError> {
    let value: Option<Value> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = $2 AND key = $3 AND deleted_at IS NULL",
    )
    .bind(tenant)
    .bind(SETTING_CATEGORY)
    .bind(SETTING_KEY)
    .fetch_optional(&mut **tx)
    .await?;
    value.map_or(Ok(DiagnosisCoding::default()), |v| {
        serde_json::from_value(v)
            .map_err(|_| AppError::Internal("unreadable diagnosis_coding setting".to_owned()))
    })
}

pub async fn save_coding(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    user: Uuid,
    mode: DiagnosisCoding,
) -> Result<(), AppError> {
    let before = load_coding(tx, tenant).await?;
    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) VALUES ($1, $2, $3, $4) \
         ON CONFLICT (tenant_id, category, key) \
         DO UPDATE SET value = EXCLUDED.value, deleted_at = NULL, updated_at = now()",
    )
    .bind(tenant)
    .bind(SETTING_CATEGORY)
    .bind(SETTING_KEY)
    .bind(json!(mode))
    .execute(&mut **tx)
    .await?;
    let (old, new) = (json!({ "mode": before }), json!({ "mode": mode }));
    let e = entry(
        tenant,
        user,
        "diagnosis_coding_changed",
        "tenant_settings",
        (Some(&old), &new),
    );
    AuditLogger::log(tx, &e).await?;
    Ok(())
}

const fn entry<'a>(
    tenant: Uuid,
    user: Uuid,
    action: &'a str,
    entity_type: &'a str,
    values: (Option<&'a Value>, &'a Value),
) -> AuditEntry<'a> {
    AuditEntry {
        tenant_id: tenant,
        user_id: Some(user),
        action,
        entity_type,
        entity_id: None,
        old_values: values.0,
        new_values: Some(values.1),
        ip_address: None,
    }
}

pub async fn list_releases(tx: &mut Tx<'_>, tenant: Uuid) -> Result<Vec<Icd10Release>, AppError> {
    let sql = format!("{RELEASE_SELECT} ORDER BY r.loaded_at DESC LIMIT $2");
    Ok(sqlx::query_as(&sql)
        .bind(tenant)
        .bind(MAX_RELEASES_LISTED)
        .fetch_all(&mut **tx)
        .await?)
}

/// The release in use: the latest loaded. `None` = no catalogue.
pub async fn active_release(
    tx: &mut Tx<'_>,
    tenant: Uuid,
) -> Result<Option<Icd10Release>, AppError> {
    let sql = format!("{RELEASE_SELECT} ORDER BY r.loaded_at DESC LIMIT 1");
    Ok(sqlx::query_as(&sql)
        .bind(tenant)
        .fetch_optional(&mut **tx)
        .await?)
}

/// Load a licensed file. The same file again is a no-op (`true`); a file
/// loaded before and since replaced is made current again.
pub async fn import(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    user: Uuid,
    meta: &ReleaseMeta,
    content: &str,
) -> Result<(Icd10Release, bool), AppError> {
    sqlx::query("SELECT pg_advisory_xact_lock(hashtext('icd10_import:' || $1::text))")
        .bind(tenant)
        .execute(&mut **tx)
        .await?;
    let sha = hex::encode(Sha256::digest(content.as_bytes()));
    let active = active_release(tx, tenant).await?;
    if let Some(current) = active.filter(|r| r.content_sha256 == sha) {
        return Ok((current, true));
    }
    let entries = parse::parse(meta.format, content).map_err(AppError::BadRequest)?;
    let count = i32::try_from(entries.len())
        .map_err(|_| AppError::BadRequest("too many codes".to_owned()))?;
    let release_id: Uuid = sqlx::query_scalar(
        "INSERT INTO icd10_releases (tenant_id, version, source, licence_note, file_name, format, \
            content_sha256, code_count, loaded_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) \
         ON CONFLICT (tenant_id, content_sha256) WHERE deleted_at IS NULL DO UPDATE \
            SET loaded_at = now(), loaded_by = EXCLUDED.loaded_by, version = EXCLUDED.version, \
                source = EXCLUDED.source, licence_note = EXCLUDED.licence_note \
         RETURNING id",
    )
    .bind(tenant)
    .bind(meta.version.trim())
    .bind(meta.source.trim())
    .bind(meta.licence_note.trim())
    .bind(meta.file_name.as_deref())
    .bind(meta.format.as_str())
    .bind(&sha)
    .bind(count)
    .bind(user)
    .fetch_one(&mut **tx)
    .await?;
    sqlx::query("DELETE FROM icd10_catalogue WHERE tenant_id = $1")
        .bind(tenant)
        .execute(&mut **tx)
        .await?;
    for chunk in entries.chunks(INSERT_CHUNK) {
        let codes: Vec<&str> = chunk.iter().map(|e| e.code.as_str()).collect();
        let titles: Vec<&str> = chunk.iter().map(|e| e.title.as_str()).collect();
        let chapters: Vec<Option<&str>> = chunk.iter().map(|e| e.chapter.as_deref()).collect();
        sqlx::query(
            "INSERT INTO icd10_catalogue (tenant_id, code, title, chapter, release_id) \
             SELECT $1, c, t, ch, $5 FROM unnest($2::text[], $3::text[], $4::text[]) AS x(c, t, ch)",
        )
        .bind(tenant)
        .bind(&codes)
        .bind(&titles)
        .bind(&chapters)
        .bind(release_id)
        .execute(&mut **tx)
        .await?;
    }
    let new_values = json!({
        "version": meta.version.trim(), "source": meta.source.trim(),
        "licence_note": meta.licence_note.trim(), "file_name": meta.file_name,
        "format": meta.format.as_str(), "content_sha256": sha, "code_count": count,
    });
    let mut e = entry(
        tenant,
        user,
        "icd10_catalogue_loaded",
        "icd10_releases",
        (None, &new_values),
    );
    e.entity_id = Some(release_id);
    AuditLogger::log(tx, &e).await?;
    let release = active_release(tx, tenant)
        .await?
        .ok_or_else(|| AppError::Internal("ICD-10 release vanished".to_owned()))?;
    Ok((release, false))
}

fn like_escape(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

/// Bounded search by code prefix (dots optional) or title words. `None` =
/// no catalogue loaded, which a caller must not show as "no match".
pub async fn search(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    needle: &str,
    limit: i64,
) -> Result<Option<(Icd10Release, Vec<Icd10Code>)>, AppError> {
    let Some(release) = active_release(tx, tenant).await? else {
        return Ok(None);
    };
    let rows = sqlx::query_as(
        "SELECT code, title, chapter FROM icd10_catalogue \
         WHERE tenant_id = $1 \
           AND (replace(code, '.', '') ILIKE replace($2, '.', '') || '%' \
                OR title ILIKE '%' || $2 || '%') \
         ORDER BY (replace(code, '.', '') ILIKE replace($2, '.', '') || '%') DESC, \
                  (title ILIKE $2 || '%') DESC, char_length(code), code \
         LIMIT $3",
    )
    .bind(tenant)
    .bind(like_escape(needle.trim()))
    .bind(limit)
    .fetch_all(&mut **tx)
    .await?;
    Ok(Some((release, rows)))
}

pub async fn lookup(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    code: &str,
) -> Result<Option<Icd10Code>, AppError> {
    Ok(sqlx::query_as(
        "SELECT code, title, chapter FROM icd10_catalogue WHERE tenant_id = $1 AND code = upper($2)",
    )
    .bind(tenant)
    .bind(code.trim())
    .fetch_optional(&mut **tx)
    .await?)
}

fn system_label(system: &str) -> &str {
    match system {
        "icd10" => "ICD-10",
        "icd11" => "ICD-11",
        _ => system,
    }
}

/// Whether a new diagnosis code may be recorded: its system must be one the
/// hospital codes in, and an ICD-10 code must be in the loaded catalogue.
pub async fn check_diagnosis_code(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    system: &str,
    code: Option<&str>,
) -> Result<(), AppError> {
    let Some(code) = code.map(str::trim).filter(|c| !c.is_empty()) else {
        return Ok(());
    };
    let mode = load_coding(tx, tenant).await?;
    if !mode.allows(system) {
        return Err(AppError::BadRequest(format!(
            "This hospital codes diagnoses in {}; a {} code is not accepted",
            mode.label(),
            system_label(system)
        )));
    }
    if system == "icd10" && lookup(tx, tenant, code).await?.is_none() {
        return Err(AppError::BadRequest(format!(
            "{code} is not in the hospital's loaded ICD-10 catalogue"
        )));
    }
    Ok(())
}
