//! Security posture, hourly (RFC-OSINT §3.1): the start-up checks on a page,
//! re-proved while the server runs, per hospital.
//!
//! - the request role really is bound by row level security (the same test
//!   as the boot preflight, `kernel::health::rls_mode`);
//! - required secrets and production settings, from this boot's preflight
//!   report (they are read once, at start);
//! - no administrator of this hospital signs in with the default password;
//! - every administrator has MFA on;
//! - a backup restore test is recorded.
//!
//! Each item is pass, fail or unknown; a part that cannot be read is
//! unknown, never pass.

use argon2::{Argon2, PasswordHash, PasswordVerifier};
use medbrains_infra_settings::preflight::Level;
use serde::Serialize;
use serde_json::json;
use uuid::Uuid;

use crate::model::{CheckError, Found, Report, Severity};
use crate::runner::{Check, Ctx};

const DEFAULT_ADMIN_PASSWORD: &str = "admin123";
/// Administrators checked for the default password; Argon2 is ~50 ms each.
const MAX_ADMINS: i64 = 20;
/// A restore test older than this no longer proves the backups work.
const RESTORE_TEST_DAYS: i64 = 35;
/// Roles that can change who may see patients: MFA is expected of them.
const ADMIN_ROLES: &[&str] = &["super_admin", "hospital_admin", "it_security_officer"];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Status {
    Pass,
    Fail,
    Unknown,
}

/// One line of the checklist.
#[derive(Debug, Clone, Serialize)]
pub struct Item {
    pub check: String,
    pub label: String,
    pub status: Status,
    pub detail: String,
    pub fix: Option<String>,
    #[serde(skip)]
    pub severity: Severity,
}

impl Item {
    fn new(
        check: &str,
        label: impl Into<String>,
        status: Status,
        detail: impl Into<String>,
    ) -> Self {
        Self {
            check: check.to_owned(),
            label: label.into(),
            status,
            detail: detail.into(),
            fix: None,
            severity: Severity::Medium,
        }
    }

    fn fix(mut self, fix: &str, severity: Severity) -> Self {
        self.fix = Some(fix.to_owned());
        self.severity = severity;
        self
    }
}

#[derive(Debug)]
pub struct Posture;

#[async_trait::async_trait]
impl Check for Posture {
    fn key(&self) -> &'static str {
        crate::POSTURE
    }

    fn per_tenant(&self) -> bool {
        true
    }

    async fn run(&self, ctx: &Ctx, tenant: Option<Uuid>) -> Result<Report, CheckError> {
        let tenant = tenant.ok_or_else(|| CheckError("no hospital given".into()))?;
        let mut items = vec![request_role(ctx).await];
        items.extend(boot_settings());
        let actor = medbrains_kernel::Actor {
            tenant_id: tenant,
            user_id: Uuid::nil(),
        };
        let tenant_items = medbrains_kernel::work(&ctx.worker, actor, async |tx| {
            Ok(vec![
                default_admin(tx, tenant).await?,
                mfa_coverage(tx, tenant).await?,
                restore_test(tx, tenant).await?,
            ])
        })
        .await?;
        items.extend(tenant_items);
        Ok(report(&items))
    }
}

/// The checklist as a report: every item in the detail, a finding per item
/// that did not pass.
#[must_use]
pub fn report(items: &[Item]) -> Report {
    let findings = items
        .iter()
        .filter(|i| i.status != Status::Pass)
        .map(|i| Found {
            asset: "Server setup".to_owned(),
            key: i.check.clone(),
            title: format!("{}: {}", i.label, i.detail),
            severity: i.severity,
            evidence: json!({ "status": i.status }),
            how_to_fix: i
                .fix
                .clone()
                .unwrap_or_else(|| "See the posture checklist.".to_owned()),
            cve_id: None,
        })
        .collect();
    Report::found(findings, json!({ "items": items }))
}

/// Whether the role the app connects as is bound by row level security.
///
/// An owner or superuser connection is the worst posture there is: tenant
/// isolation then rests on every query remembering its own WHERE.
pub async fn request_role(ctx: &Ctx) -> Item {
    const LABEL: &str = "Database role enforces tenant isolation";
    const FIX: &str = "Point DATABASE_URL at medbrains_app, not the owner or a superuser \
                       (docs/ops/DB-ROLES.md), and restart.";
    match medbrains_kernel::health::rls_mode(&ctx.request).await {
        Ok(m) if m.enforced => Item::new(
            "db.request_role",
            LABEL,
            Status::Pass,
            format!("{} is bound by row level security", m.role),
        ),
        Ok(m) => Item::new(
            "db.request_role",
            LABEL,
            Status::Fail,
            format!(
                "the app connects as {}, which row level security does not bind",
                m.role
            ),
        )
        .fix(FIX, Severity::Critical),
        Err(e) => Item::new(
            "db.request_role",
            LABEL,
            Status::Unknown,
            format!("could not check: {e}"),
        )
        .fix(FIX, Severity::High),
    }
}

/// Secrets and production settings from this boot's preflight. Empty
/// before the preflight has run, which is itself reported.
fn boot_settings() -> Vec<Item> {
    let boot = medbrains_infra_settings::preflight::report();
    if boot.is_empty() {
        return vec![
            Item::new(
                "boot.preflight",
                "Start-up checks",
                Status::Unknown,
                "not recorded for this boot",
            )
            .fix(
                "Restart the server; it records its start-up checks.",
                Severity::Medium,
            ),
        ];
    }
    boot.iter()
        .filter(|f| f.check.starts_with("secret.") || f.check.starts_with("env."))
        .map(|f| {
            let item = Item::new(
                f.check,
                format!(
                    "{} — {}",
                    if f.check.starts_with("secret.") {
                        "Required secret"
                    } else {
                        "Production setting"
                    },
                    f.check
                        .split_once('.')
                        .map_or(f.check, |(_, name)| name)
                        .replace('_', " ")
                ),
                if f.level == Level::Ok {
                    Status::Pass
                } else {
                    Status::Fail
                },
                f.detail.clone(),
            );
            match (f.level, f.fix) {
                (Level::Ok, _) => item,
                (Level::Fail, fix) => item.fix(fix.unwrap_or("Fix and restart."), Severity::High),
                (Level::Warn, fix) => item.fix(fix.unwrap_or("Fix and restart."), Severity::Medium),
            }
        })
        .collect()
}

type TxResult<T> = Result<T, medbrains_kernel::AppError>;

async fn default_admin(tx: &mut medbrains_kernel::Tx, tenant: Uuid) -> TxResult<Item> {
    const LABEL: &str = "Default administrator password removed";
    let rows = sqlx::query_as::<_, (String, String)>(
        "SELECT username, password_hash FROM users \
          WHERE tenant_id = $1 AND deleted_at IS NULL AND is_active AND password_hash IS NOT NULL \
            AND role::text IN ('super_admin', 'hospital_admin') ORDER BY username LIMIT $2",
    )
    .bind(tenant)
    .bind(MAX_ADMINS)
    .fetch_all(&mut **tx)
    .await?;
    let weak: Vec<&str> = rows
        .iter()
        .filter(|(_, hash)| {
            PasswordHash::new(hash).is_ok_and(|h| {
                Argon2::default()
                    .verify_password(DEFAULT_ADMIN_PASSWORD.as_bytes(), &h)
                    .is_ok()
            })
        })
        .map(|(u, _)| u.as_str())
        .collect();
    Ok(if weak.is_empty() {
        Item::new(
            "auth.default_admin",
            LABEL,
            Status::Pass,
            "no administrator uses the default password",
        )
    } else {
        Item::new(
            "auth.default_admin",
            LABEL,
            Status::Fail,
            format!("{} still use the default password", weak.join(", ")),
        )
        .fix(
            "Sign in as each one and change the password now.",
            Severity::Critical,
        )
    })
}

async fn mfa_coverage(tx: &mut medbrains_kernel::Tx, tenant: Uuid) -> TxResult<Item> {
    const LABEL: &str = "Administrators use MFA";
    let (total, without, names): (i64, i64, Vec<String>) = sqlx::query_as(
        "SELECT count(*), count(*) FILTER (WHERE NOT mfa_enabled), \
                COALESCE((array_agg(username ORDER BY username) FILTER (WHERE NOT mfa_enabled))[1:5], '{}') \
           FROM users WHERE tenant_id = $1 AND deleted_at IS NULL AND is_active \
            AND NOT is_service_account AND role::text = ANY($2)",
    )
    .bind(tenant)
    .bind(ADMIN_ROLES)
    .fetch_one(&mut **tx)
    .await?;
    Ok(if without == 0 {
        Item::new(
            "auth.admin_mfa",
            LABEL,
            Status::Pass,
            format!("all {total} administrators have MFA on"),
        )
    } else {
        Item::new(
            "auth.admin_mfa",
            LABEL,
            Status::Fail,
            format!("{without} of {total} administrators have no MFA ({})", names.join(", ")),
        )
        .fix("Turn on MFA for the administrator roles (Admin → Security → MFA) and ask each to enrol.", Severity::High)
    })
}

async fn restore_test(tx: &mut medbrains_kernel::Tx, tenant: Uuid) -> TxResult<Item> {
    const LABEL: &str = "Backups restore-tested";
    const FIX: &str = "Restore the latest backup to a scratch server, check it opens, and record \
                       the test in backup history.";
    let last: Option<chrono::DateTime<chrono::Utc>> = sqlx::query_scalar(
        "SELECT max(verification_at) FROM backup_history \
          WHERE (tenant_id = $1 OR tenant_id IS NULL) AND deleted_at IS NULL",
    )
    .bind(tenant)
    .fetch_one(&mut **tx)
    .await?;
    Ok(match last {
        None => Item::new(
            "backup.restore_test",
            LABEL,
            Status::Unknown,
            "no restore test recorded",
        )
        .fix(FIX, Severity::Medium),
        Some(at) if (chrono::Utc::now() - at).num_days() > RESTORE_TEST_DAYS => Item::new(
            "backup.restore_test",
            LABEL,
            Status::Fail,
            format!(
                "last restore test {} days ago",
                (chrono::Utc::now() - at).num_days()
            ),
        )
        .fix(FIX, Severity::Medium),
        Some(at) => Item::new(
            "backup.restore_test",
            LABEL,
            Status::Pass,
            format!("last restore test {}", at.date_naive()),
        ),
    })
}
