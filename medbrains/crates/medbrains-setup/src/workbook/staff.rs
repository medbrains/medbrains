//! The Staff sheet: everyone who signs in, their role and departments, and —
//! for doctors — registration, specialty, qualification and fee.
//!
//! No password ever travels in the workbook. A new person is created without
//! one and emailed how to set it (Forgot password, with the hospital code and
//! their username); a hospital on single sign-on needs none at all.

use axum::http::HeaderMap;
use medbrains_core::access::BUILT_IN_ROLES;
use medbrains_server_core::{
    error::AppError,
    middleware::{auth::Claims, authorization::is_bypass_role},
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use super::{Problems, SheetTally, text};

const SHEET: &str = "Staff";
/// Roles a spreadsheet may never hand out: the platform's own, and machines.
const NOT_FROM_A_SHEET: &[&str] = &["super_admin", "service_account", "display_device"];

#[derive(Debug, Clone, Default, Deserialize, Serialize, sqlx::FromRow)]
pub struct Row {
    #[serde(default)]
    #[sqlx(skip)]
    pub row: u32,
    pub username: Option<String>,
    pub full_name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub role: Option<String>,
    /// Department codes, separated by commas.
    pub departments: Option<String>,
    pub designation: Option<String>,
    pub employee_code: Option<String>,
    pub registration_number: Option<String>,
    pub specialization: Option<String>,
    pub qualification: Option<String>,
    pub consultation_fee: Option<String>,
}

/// The roles this caller may give from a sheet.
pub(crate) fn assignable_roles(caller_is_admin: bool) -> Vec<&'static str> {
    BUILT_IN_ROLES
        .iter()
        .map(|r| r.code)
        .filter(|c| !NOT_FROM_A_SHEET.contains(c) && (caller_is_admin || *c != "hospital_admin"))
        .collect()
}

fn valid_username(u: &str) -> bool {
    let mut chars = u.chars();
    chars.next().is_some_and(|c| c.is_ascii_lowercase())
        && (3..=30).contains(&u.len())
        && u.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
}

struct Person {
    username: String,
    full_name: String,
    email: String,
    role: String,
    departments: Vec<Uuid>,
    fee: Option<Decimal>,
}

async fn check(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant: Uuid,
    roles: &[&str],
    r: &Row,
    problems: &mut Problems,
) -> Result<Option<Person>, AppError> {
    let username = text(r.username.as_ref()).map(|u| u.to_lowercase());
    let (Some(username), Some(full_name), Some(email)) =
        (username, text(r.full_name.as_ref()), text(r.email.as_ref()).map(|e| e.to_lowercase()))
    else {
        problems.add(SHEET, r.row, "Username / Full name / Email", "Each person needs all three");
        return Ok(None);
    };
    if !valid_username(&username) {
        problems.add(SHEET, r.row, "Username", "3–30 lowercase letters, digits or _, starting with a letter");
        return Ok(None);
    }
    if !email.contains('@') || email.starts_with('@') || email.ends_with('@') {
        problems.add(SHEET, r.row, "Email", format!("{email} is not an email address"));
        return Ok(None);
    }
    let role = text(r.role.as_ref()).map_or_else(String::new, |v| v.to_lowercase().replace([' ', '-'], "_"));
    if !roles.contains(&role.as_str()) {
        problems.add(SHEET, r.row, "Role", format!("Use one of: {}", roles.join(", ")));
        return Ok(None);
    }
    let fee = match text(r.consultation_fee.as_ref()) {
        None => None,
        Some(f) => match f.replace(',', "").parse::<Decimal>() {
            Ok(v) if v >= Decimal::ZERO => Some(v),
            _ => {
                problems.add(SHEET, r.row, "Consultation fee", format!("{f} is not an amount"));
                return Ok(None);
            }
        },
    };
    let codes: Vec<String> = r.departments.as_deref().unwrap_or("")
        .split([',', ';'])
        .map(|c| c.trim().to_uppercase())
        .filter(|c| !c.is_empty())
        .collect();
    let found: Vec<(String, Uuid)> = sqlx::query_as(
        "SELECT code, id FROM departments WHERE tenant_id = $1 AND code = ANY($2) AND deleted_at IS NULL",
    )
    .bind(tenant)
    .bind(&codes)
    .fetch_all(&mut **tx)
    .await?;
    if let Some(missing) = codes.iter().find(|c| !found.iter().any(|(f, _)| f == *c)) {
        problems.add(SHEET, r.row, "Departments", format!("No department has the code {missing}"));
        return Ok(None);
    }
    // Keep the sheet's order: the first department is the person's own.
    let departments = codes.iter().filter_map(|c| found.iter().find(|(f, _)| f == c).map(|(_, id)| *id)).collect();
    Ok(Some(Person { username, full_name, email, role, departments, fee }))
}

pub(crate) async fn import(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    headers: &HeaderMap,
    rows: &[Row],
    problems: &mut Problems,
) -> Result<(SheetTally, u32), AppError> {
    let tenant = claims.tenant_id;
    let caller_is_admin = is_bypass_role(claims);
    let roles = assignable_roles(caller_is_admin);
    let mut tally = SheetTally { sheet: SHEET, added: 0, updated: 0 };
    let mut welcomed = 0;
    let hospital_code: String = sqlx::query_scalar("SELECT code FROM tenants WHERE id = $1")
        .bind(tenant)
        .fetch_one(&mut **tx)
        .await?;
    for r in rows {
        let Some(p) = check(tx, tenant, &roles, r, problems).await? else { continue };
        let existing: Option<(Uuid, String)> = sqlx::query_as(
            "SELECT id, role::text FROM users WHERE tenant_id = $1 AND username = $2",
        )
        .bind(tenant)
        .bind(&p.username)
        .fetch_optional(&mut **tx)
        .await?;
        if existing.as_ref().is_some_and(|(_, role)| {
            NOT_FROM_A_SHEET.contains(&role.as_str()) || (role == "hospital_admin" && !caller_is_admin)
        }) {
            problems.add(SHEET, r.row, "Username", format!("{} is an administrator; change them on the Users screen", p.username));
            continue;
        }
        let email_taken: bool = sqlx::query_scalar(
            "SELECT EXISTS (SELECT 1 FROM users WHERE tenant_id = $1 AND lower(email) = $2 AND username <> $3)",
        )
        .bind(tenant)
        .bind(&p.email)
        .bind(&p.username)
        .fetch_one(&mut **tx)
        .await?;
        if email_taken {
            problems.add(SHEET, r.row, "Email", format!("{} already belongs to someone else", p.email));
            continue;
        }
        let (id, inserted): (Uuid, bool) = sqlx::query_as(
            "INSERT INTO users (tenant_id, username, email, full_name, role, phone, department_ids, \
                department_id, designation, employee_code, medical_registration_number, \
                specialization, qualification, consultation_fee) \
             VALUES ($1, $2, $3, $4, $5::user_role, $6, $7::uuid[], ($7::uuid[])[1], $8, $9, $10, $11, $12, $13) \
             ON CONFLICT (tenant_id, username) DO UPDATE SET email = EXCLUDED.email, \
               full_name = EXCLUDED.full_name, phone = EXCLUDED.phone, \
               department_ids = EXCLUDED.department_ids, department_id = EXCLUDED.department_id, \
               designation = EXCLUDED.designation, employee_code = EXCLUDED.employee_code, \
               medical_registration_number = EXCLUDED.medical_registration_number, \
               specialization = EXCLUDED.specialization, qualification = EXCLUDED.qualification, \
               consultation_fee = EXCLUDED.consultation_fee, \
               perm_version = users.perm_version + (users.role <> EXCLUDED.role)::int, \
               role = EXCLUDED.role, is_active = true, \
               deleted_at = NULL, deleted_by = NULL, delete_reason = NULL \
             RETURNING id, (xmax = 0)",
        )
        .bind(tenant)
        .bind(&p.username)
        .bind(&p.email)
        .bind(&p.full_name)
        .bind(&p.role)
        .bind(text(r.phone.as_ref()))
        .bind(&p.departments)
        .bind(text(r.designation.as_ref()))
        .bind(text(r.employee_code.as_ref()))
        .bind(text(r.registration_number.as_ref()))
        .bind(text(r.specialization.as_ref()))
        .bind(text(r.qualification.as_ref()))
        .bind(p.fee)
        .fetch_one(&mut **tx)
        .await?;
        if inserted {
            tally.added += 1;
            welcome(tx, tenant, id, &p, &hospital_code, headers).await?;
            welcomed += 1;
        } else {
            tally.updated += 1;
        }
    }
    Ok((tally, welcomed))
}

/// The page they set their password on, at the address the admin uploaded from.
fn app_base(headers: &HeaderMap) -> String {
    headers
        .get("x-forwarded-host")
        .or_else(|| headers.get(axum::http::header::HOST))
        .and_then(|v| v.to_str().ok())
        .map_or_else(|| "https://app.medbrains.in".to_owned(), |h| format!("https://{h}"))
}

async fn welcome(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant: Uuid,
    user: Uuid,
    p: &Person,
    hospital_code: &str,
    headers: &HeaderMap,
) -> Result<(), AppError> {
    let link = format!("{}/forgot-password", app_base(headers));
    let text = format!(
        "Hello {name},\n\nYour MedBrains account is ready.\nHospital code: {hospital_code}\n\
         Username: {username}\n\nSet your password at {link} — choose Forgot password, enter the \
         hospital code and your username, and use the code we email you.",
        name = p.full_name,
        username = p.username,
    );
    medbrains_outbox::queue::queue_in_tx(
        tx,
        medbrains_outbox::queue::OutboxRow {
            tenant_id: tenant,
            aggregate_type: "user",
            aggregate_id: Some(user),
            event_type: "email.welcome",
            payload: json!({
                "to": p.email,
                "subject": "Your MedBrains account is ready",
                "text": text,
                "html": format!("<pre style=\"font-family:inherit\">{}</pre>", text.replace('<', "&lt;")),
            }),
            idempotency_key: Some(format!("welcome:{user}")),
        },
    )
    .await
    .map_err(|e| AppError::Internal(format!("queue welcome email: {e}")))?;
    Ok(())
}
