//! Honeytokens (RFC-OSINT §3a): a few decoy patients and a decoy API key per
//! hospital that no legitimate workflow ever touches.
//!
//! - Decoy patients are hidden from the request role by the restrictive
//!   policy `patients_hide_honeytokens` (migration 1401), so no list, search,
//!   count, report or clinical workflow built on `patients` can show them.
//!   Naming one anyway — its ID can only come from copied data — raises a
//!   critical finding at once, from the database (`security_honeytoken_hit`,
//!   reached from the `access_log` trigger and the request logger).
//! - The decoy key's plaintext sits in the hospital's settings as bait; it
//!   was never issued, so presenting it raises a critical finding
//!   (`app_honeytoken_key_hit`, from API-key authentication).
//!
//! Every five minutes this check keeps the trap set: decoys present, alarm
//! trigger and hiding policy in place. It refuses to seed decoys while the
//! request role escapes row level security — they would then show in lists.

use std::fmt::Write as _;

use serde_json::json;
use uuid::Uuid;

use crate::model::{CheckError, Found, Report, Severity};
use crate::runner::{Check, Ctx};

pub const KEY: &str = "honeytokens";
/// Findings raised on access by the database itself; never auto-resolved.
pub const ACCESS_KEY: &str = "honeytoken.access";
pub const DECOY_PATIENTS: i64 = 3;
pub const BAIT_CATEGORY: &str = "integrations";
pub const BAIT_KEY: &str = "lis_bridge_api_key";

/// Synthetic names: no real person's data.
const NAMES: &[(&str, &str, &str)] = &[
    ("Ishani", "Raghavendran", "female"),
    ("Tarun", "Velayudhan", "male"),
    ("Meenal", "Kothandaraman", "female"),
    ("Arvind", "Sethuraman", "male"),
    ("Kavya", "Natarajan", "female"),
    ("Rohan", "Iyengar", "male"),
];

#[derive(Debug)]
pub struct Honeytokens;

#[async_trait::async_trait]
impl Check for Honeytokens {
    fn key(&self) -> &'static str {
        KEY
    }

    fn per_tenant(&self) -> bool {
        true
    }

    async fn run(&self, ctx: &Ctx, tenant: Option<Uuid>) -> Result<Report, CheckError> {
        let tenant = tenant.ok_or_else(|| CheckError("no hospital given".into()))?;
        let mode = medbrains_kernel::health::rls_mode(&ctx.request).await?;
        if !mode.enforced {
            return Err(CheckError(format!(
                "paused: the app connects as {}, which row level security does not bind, so \
                 decoy patients would show in lists. Fix the database role (see Posture).",
                mode.role
            )));
        }
        let actor = medbrains_kernel::Actor {
            tenant_id: tenant,
            user_id: Uuid::nil(),
        };
        let (patients, findings) = medbrains_kernel::work(&ctx.worker, actor, async |tx| {
            retire_removed(tx, tenant).await?;
            let patients = top_up_patients(tx, tenant).await?;
            ensure_key(tx, tenant).await?;
            let findings = alarm_integrity(tx).await?;
            Ok((patients, findings))
        })
        .await?;
        Ok(Report::found(
            findings,
            json!({ "decoy_patients": patients, "decoy_key": true }),
        ))
    }
}

/// A decoy whose patient row is gone was deleted by someone: an event, kept
/// under [`ACCESS_KEY`] so it stays until a person closes it.
async fn retire_removed(
    tx: &mut medbrains_kernel::Tx,
    tenant: Uuid,
) -> Result<(), medbrains_kernel::AppError> {
    let removed: Vec<String> = sqlx::query_scalar(
        "UPDATE security_honeytokens h SET deleted_at = now(), delete_reason = 'decoy patient removed' \
          WHERE h.tenant_id = $1 AND h.kind = 'patient' AND h.deleted_at IS NULL \
            AND NOT EXISTS (SELECT 1 FROM patients p WHERE p.id = h.patient_id \
                              AND p.tenant_id = $1 AND p.deleted_at IS NULL) \
          RETURNING h.label",
    )
    .bind(tenant)
    .fetch_all(&mut **tx)
    .await?;
    for label in removed {
        sqlx::query("SELECT security_upsert_finding($1, $2, $3, 'removed', $4, 'high', '{}'::jsonb, $5, NULL)")
            .bind(tenant)
            .bind(ACCESS_KEY)
            .bind(format!("Decoy patient {label}"))
            .bind("A decoy patient record was deleted")
            .bind("No workflow can reach this record, so deleting it took direct access. Find who \
                   did it in the audit log. A replacement decoy has been set.")
            .execute(&mut **tx)
            .await?;
    }
    Ok(())
}

fn random_hex(bytes: usize) -> Result<String, medbrains_kernel::AppError> {
    let mut buf = vec![0_u8; bytes];
    getrandom::fill(&mut buf).map_err(|e| medbrains_kernel::AppError::Internal(e.to_string()))?;
    Ok(buf
        .iter()
        .fold(String::with_capacity(bytes * 2), |mut out, b| {
            let _ = write!(out, "{b:02X}");
            out
        }))
}

/// A UHID from the hospital's own sequence, so a decoy looks like its
/// neighbours; a random one when the hospital has no sequence yet (never
/// creating the sequence, which real registration owns).
async fn decoy_uhid(
    tx: &mut medbrains_kernel::Tx,
    tenant: Uuid,
) -> Result<String, medbrains_kernel::AppError> {
    let next = sqlx::query_scalar::<_, String>(
        "UPDATE sequences SET current_val = current_val + 1 \
          WHERE tenant_id = $1 AND seq_type = 'UHID' \
          RETURNING prefix || lpad(current_val::text, GREATEST(pad_width, length(current_val::text)), '0')",
    )
    .bind(tenant)
    .fetch_optional(&mut **tx)
    .await?;
    match next {
        Some(uhid) => Ok(uhid),
        None => Ok(format!("ZZ{}", random_hex(5)?)),
    }
}

async fn top_up_patients(
    tx: &mut medbrains_kernel::Tx,
    tenant: Uuid,
) -> Result<i64, medbrains_kernel::AppError> {
    let have: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM security_honeytokens \
          WHERE tenant_id = $1 AND kind = 'patient' AND deleted_at IS NULL",
    )
    .bind(tenant)
    .fetch_one(&mut **tx)
    .await?;
    for slot in have..DECOY_PATIENTS {
        let pick = random_hex(1)?;
        let index = usize::from_str_radix(&pick, 16).unwrap_or(0) % NAMES.len();
        let (first, last, gender) = NAMES[index];
        let uhid = decoy_uhid(tx, tenant).await?;
        let id: Uuid = sqlx::query_scalar(
            "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone, date_of_birth) \
             VALUES ($1, $2, $3, $4, $5::gender, '0000000000', DATE '1970-01-01' + ($6 * 3217)) RETURNING id",
        )
        .bind(tenant)
        .bind(&uhid)
        .bind(first)
        .bind(last)
        .bind(gender)
        .bind(i32::try_from(slot).unwrap_or(0))
        .fetch_one(&mut **tx)
        .await?;
        sqlx::query(
            "INSERT INTO security_honeytokens (tenant_id, kind, patient_id, label) VALUES ($1, 'patient', $2, $3)",
        )
        .bind(tenant)
        .bind(id)
        .bind(&uhid)
        .execute(&mut **tx)
        .await?;
    }
    Ok(have.max(DECOY_PATIENTS))
}

/// The decoy key and its bait stay paired: if the bait is gone the key is
/// retired and a new pair set, since only the bait holds the plaintext.
async fn ensure_key(
    tx: &mut medbrains_kernel::Tx,
    tenant: Uuid,
) -> Result<(), medbrains_kernel::AppError> {
    let paired: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM security_honeytokens WHERE tenant_id = $1 AND kind = 'api_key' \
                          AND deleted_at IS NULL) \
            AND EXISTS (SELECT 1 FROM tenant_settings WHERE tenant_id = $1 AND category = $2 \
                          AND key = $3 AND deleted_at IS NULL)",
    )
    .bind(tenant)
    .bind(BAIT_CATEGORY)
    .bind(BAIT_KEY)
    .fetch_one(&mut **tx)
    .await?;
    if paired {
        return Ok(());
    }
    let minted = medbrains_api_keys::mint(
        medbrains_api_keys::Environment::Live,
        &["patients.list".to_owned()],
    )
    .map_err(|e| medbrains_kernel::AppError::Internal(e.to_string()))?;
    sqlx::query(
        "UPDATE security_honeytokens SET deleted_at = now(), delete_reason = 'bait replaced' \
          WHERE tenant_id = $1 AND kind = 'api_key' AND deleted_at IS NULL",
    )
    .bind(tenant)
    .execute(&mut **tx)
    .await?;
    sqlx::query(
        "INSERT INTO security_honeytokens (tenant_id, kind, key_fingerprint, label) \
         VALUES ($1, 'api_key', $2, 'Decoy API key')",
    )
    .bind(tenant)
    .bind(&minted.hash)
    .execute(&mut **tx)
    .await?;
    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) VALUES ($1, $2, $3, $4) \
         ON CONFLICT (tenant_id, category, key) DO UPDATE SET value = EXCLUDED.value, \
             deleted_at = NULL, updated_at = now()",
    )
    .bind(tenant)
    .bind(BAIT_CATEGORY)
    .bind(BAIT_KEY)
    .bind(json!({ "api_key": minted.secret, "endpoint": "/api/lab/results" }))
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// The alarm and the hiding policy are database objects someone could drop.
async fn alarm_integrity(
    tx: &mut medbrains_kernel::Tx,
) -> Result<Vec<Found>, medbrains_kernel::AppError> {
    let (trigger, policy): (bool, bool) = sqlx::query_as(
        "SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_access_log_honeytoken' \
                          AND tgenabled <> 'D'), \
                EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'patients' \
                          AND policyname = 'patients_hide_honeytokens')",
    )
    .fetch_one(&mut **tx)
    .await?;
    let mut out = Vec::new();
    if !trigger {
        out.push(integrity_finding(
            "alarm_off",
            "The decoy-record alarm is switched off",
            "The access_log trigger trg_access_log_honeytoken is missing or disabled. Re-apply \
             migration 1401 and find who changed the schema.",
        ));
    }
    if !policy {
        out.push(integrity_finding("decoys_visible", "Decoy patients are no longer hidden",
            "The patients policy patients_hide_honeytokens is missing, so decoys can show in lists. \
             Re-apply migration 1401 now and find who changed the schema."));
    }
    Ok(out)
}

fn integrity_finding(key: &str, title: &str, fix: &str) -> Found {
    Found {
        asset: "Honeytoken alarm".to_owned(),
        key: key.to_owned(),
        title: title.to_owned(),
        severity: Severity::Critical,
        evidence: json!({}),
        how_to_fix: fix.to_owned(),
        cve_id: None,
    }
}
