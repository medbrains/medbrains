use std::collections::HashMap;

use argon2::{
    Argon2,
    password_hash::{PasswordHasher, SaltString, rand_core::OsRng},
};
use axum::{Extension, Json, extract::State, response::IntoResponse};
use axum_extra::extract::CookieJar;
use chrono::Utc;
use medbrains_core::onboarding::OnboardingProgress;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use sha2::{Digest, Sha256};

use crate::{
    error::AppError,
    middleware::{
        auth::{Claims, encode_jwt},
        cookies::{build_access_cookie, build_csrf_cookie, build_refresh_cookie},
    },
    state::AppState,
    validation::{self, ValidationErrors},
};

// ── Public email domains (not org-owned) ─────────────────────

/// Domains that are public email providers — multiple orgs can use these.
/// For these domains we check exact email uniqueness, not domain-level.
const PUBLIC_EMAIL_DOMAINS: &[&str] = &[
    "gmail.com",
    "yahoo.com",
    "yahoo.in",
    "yahoo.co.in",
    "outlook.com",
    "hotmail.com",
    "live.com",
    "aol.com",
    "icloud.com",
    "protonmail.com",
    "proton.me",
    "mail.com",
    "zoho.com",
    "yandex.com",
    "rediffmail.com",
];

fn extract_domain(email: &str) -> Option<&str> {
    email.rsplit_once('@').map(|(_, domain)| domain)
}

fn is_public_domain(domain: &str) -> bool {
    let lower = domain.to_lowercase();
    PUBLIC_EMAIL_DOMAINS.iter().any(|d| lower == **d)
}

// ── GET /api/onboarding/status ──────────────────────────────

#[derive(Debug, Serialize)]
pub struct OnboardingStatusResponse {
    /// Always true — new tenants can always register.
    /// Frontend uses this to decide initial landing behavior.
    pub needs_setup: bool,
    /// How many hospitals have been registered (no PII leaked).
    pub tenant_count: i64,
}

pub async fn status(
    State(state): State<AppState>,
) -> Result<Json<OnboardingStatusResponse>, AppError> {
    // Multi-tenant: onboarding is always available for new organizations.
    // This is a PUBLIC endpoint — never leak PII (admin emails, hospital names, etc.).
    let tenant_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM onboarding_progress WHERE is_complete = true")
            .fetch_one(&state.db)
            .await?;

    Ok(Json(OnboardingStatusResponse {
        // Always allow new orgs to register through the wizard.
        needs_setup: true,
        tenant_count,
    }))
}

// ── POST /api/onboarding/init ───────────────────────────────

#[derive(Debug, Deserialize)]
pub struct InitRequest {
    pub hospital_name: String,
    pub hospital_code: String,
    pub hospital_type: String,
    pub admin_username: String,
    pub admin_email: String,
    pub admin_password: String,
    pub admin_full_name: String,
}

#[derive(Debug, Serialize)]
pub struct InitResponse {
    pub tenant_id: Uuid,
    pub user_id: Uuid,
    pub csrf_token: String,
}

#[allow(clippy::too_many_lines)]
pub async fn init(
    State(state): State<AppState>,
    Json(body): Json<InitRequest>,
) -> Result<impl IntoResponse, AppError> {
    // ── Field validation ────────────────────────────────
    let mut errors = ValidationErrors::new();
    validation::validate_name(&mut errors, "hospital_name", &body.hospital_name);
    validation::validate_code(&mut errors, "hospital_code", &body.hospital_code);
    if body.hospital_type.is_empty() {
        errors.add("hospital_type", "Hospital type is required");
    }
    validation::validate_name(&mut errors, "admin_full_name", &body.admin_full_name);
    validation::validate_username(&mut errors, "admin_username", &body.admin_username);
    validation::validate_email(&mut errors, "admin_email", &body.admin_email);
    validation::validate_password(&mut errors, "admin_password", &body.admin_password);
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    // ── Uniqueness checks (multi-tenant safe) ───────────
    // 1. Hospital code must be unique across all tenants
    let code_taken: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM tenants WHERE code = $1)")
            .bind(&body.hospital_code)
            .fetch_one(&state.db)
            .await?;
    if code_taken {
        errors.add(
            "hospital_code",
            "A hospital with this code is already registered",
        );
    }

    // 2. Email / domain check — one super admin per org
    let domain = extract_domain(&body.admin_email);
    if let Some(domain) = domain {
        if is_public_domain(domain) {
            // Public domain → check exact email only
            let email_taken: bool = sqlx::query_scalar(
                "SELECT EXISTS(\
                    SELECT 1 FROM users WHERE email = $1 AND role = 'super_admin'\
                )",
            )
            .bind(&body.admin_email)
            .fetch_one(&state.db)
            .await?;
            if email_taken {
                errors.add(
                    "admin_email",
                    "This email is already registered as a super admin. Please log in instead.",
                );
            }
        } else {
            // Organization domain → check if any super admin with same domain exists
            let domain_pattern = format!("%@{domain}");
            let domain_taken: bool = sqlx::query_scalar(
                "SELECT EXISTS(\
                    SELECT 1 FROM users \
                    WHERE email ILIKE $1 AND role = 'super_admin'\
                )",
            )
            .bind(&domain_pattern)
            .fetch_one(&state.db)
            .await?;
            if domain_taken {
                errors.add(
                    "admin_email",
                    "An organization with this email domain has already been registered. \
                     Please contact your administrator to get access.",
                );
            }
        }
    }

    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    // ── Create tenant ───────────────────────────────────
    let tenant_id = Uuid::new_v4();
    let user_id = Uuid::new_v4();

    // Hash password
    let salt = SaltString::generate(&mut OsRng);
    let password_hash = Argon2::default()
        .hash_password(body.admin_password.as_bytes(), &salt)
        .map_err(|e| AppError::Internal(format!("password hash error: {e}")))?
        .to_string();

    let mut tx = state.db.begin().await?;

    // Create tenant
    sqlx::query(
        "INSERT INTO tenants (id, code, name, hospital_type, config) \
         VALUES ($1, $2, $3, $4::hospital_type, '{}')",
    )
    .bind(tenant_id)
    .bind(&body.hospital_code)
    .bind(&body.hospital_name)
    .bind(&body.hospital_type)
    .execute(&mut *tx)
    .await?;

    // Set tenant context for RLS
    sqlx::query("SELECT set_config('app.tenant_id', $1::text, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await?;

    // Create super admin user
    sqlx::query(
        "INSERT INTO users (id, tenant_id, username, email, password_hash, full_name, role) \
         VALUES ($1, $2, $3, $4, $5, $6, 'super_admin')",
    )
    .bind(user_id)
    .bind(tenant_id)
    .bind(&body.admin_username)
    .bind(&body.admin_email)
    .bind(&password_hash)
    .bind(&body.admin_full_name)
    .execute(&mut *tx)
    .await?;

    // Create onboarding progress record
    sqlx::query(
        "INSERT INTO onboarding_progress (tenant_id, current_step, completed_steps) \
         VALUES ($1, 2, '[1]')",
    )
    .bind(tenant_id)
    .execute(&mut *tx)
    .await?;

    // Audit log
    medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id,
            user_id: Some(user_id),
            action: "onboarding_init",
            entity_type: "tenant",
            entity_id: Some(tenant_id),
            old_values: None,
            new_values: None,
            ip_address: None,
        },
    )
    .await
    .map_err(AppError::from)?;

    tx.commit().await?;

    // Issue JWT tokens
    let now = Utc::now();
    let access_claims = Claims {
        sub: user_id,
        tenant_id,
        role: "super_admin".to_owned(),
        permissions: Vec::new(),
        department_ids: Vec::new(),
        perm_version: 1,
        exp: (now + chrono::Duration::minutes(60)).timestamp() as usize,
    };
    let access_token = encode_jwt(&access_claims, &state.jwt_encoding_key)
        .map_err(|e| AppError::Internal(format!("JWT encode error: {e}")))?;

    let refresh_raw = Uuid::new_v4().to_string();

    // Store refresh token
    let mut tx2 = state.db.begin().await?;
    sqlx::query("SELECT set_config('app.tenant_id', $1::text, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx2)
        .await?;

    let mut hasher = Sha256::new();
    hasher.update(refresh_raw.as_bytes());
    let refresh_hash = hex::encode(hasher.finalize());

    let expires_at = now + chrono::Duration::days(7);
    sqlx::query(
        "INSERT INTO refresh_tokens (tenant_id, user_id, token_hash, expires_at) \
         VALUES ($1, $2, $3, $4)",
    )
    .bind(tenant_id)
    .bind(user_id)
    .bind(&refresh_hash)
    .bind(expires_at)
    .execute(&mut *tx2)
    .await?;

    tx2.commit().await?;

    tracing::info!(%tenant_id, %user_id, "Onboarding initialized");

    // Generate CSRF token
    let mut csrf_buf = [0u8; 32];
    getrandom::fill(&mut csrf_buf)
        .map_err(|e| AppError::Internal(format!("CSRF token generation failed: {e}")))?;
    let csrf_token = hex::encode(csrf_buf);

    // Set cookies
    let cfg = &state.cookie_config;
    let jar = CookieJar::new()
        .add(build_access_cookie(&access_token, cfg))
        .add(build_refresh_cookie(&refresh_raw, cfg))
        .add(build_csrf_cookie(&csrf_token, cfg));

    Ok((
        jar,
        Json(InitResponse {
            tenant_id,
            user_id,
            csrf_token,
        }),
    ))
}

// ── POST /api/onboarding/setup ─────────────────────────────

#[derive(Debug, Deserialize)]
pub struct SetupHospitalDetails {
    pub address_line1: Option<String>,
    pub address_line2: Option<String>,
    pub city: Option<String>,
    pub pincode: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub website: Option<String>,
    pub registration_no: Option<String>,
    pub accreditation: Option<String>,
    pub timezone: String,
    pub currency: String,
    pub fy_start_month: i32,
}

#[derive(Debug, Deserialize)]
pub struct SetupGeo {
    pub country_id: Option<Uuid>,
    pub state_id: Option<Uuid>,
    pub district_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
#[allow(clippy::struct_excessive_bools)]
pub struct SetupFacility {
    pub local_id: String,
    pub code: String,
    pub name: String,
    pub facility_type: String,
    pub parent_local_id: Option<String>,
    pub bed_count: Option<i32>,
    pub shared_billing: bool,
    pub shared_pharmacy: bool,
    pub shared_lab: bool,
    pub shared_hr: bool,
}

#[derive(Debug, Deserialize)]
pub struct SetupLocation {
    pub local_id: String,
    pub code: String,
    pub name: String,
    pub level: String,
    pub parent_local_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SetupDepartment {
    pub local_id: String,
    pub code: String,
    pub name: String,
    pub department_type: String,
    pub parent_local_id: Option<String>,
    pub working_hours: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct SetupUser {
    pub full_name: String,
    pub username: String,
    pub email: String,
    pub password: String,
    pub role: String,
    pub specialization: Option<String>,
    pub medical_registration_number: Option<String>,
    pub qualification: Option<String>,
    pub consultation_fee: Option<f64>,
    pub department_local_ids: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct SetupRole {
    pub code: String,
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SetupSequences {
    pub uhid_prefix: String,
    pub uhid_pad_width: i32,
    pub invoice_prefix: String,
    pub invoice_pad_width: i32,
}

#[derive(Debug, Deserialize)]
pub struct SetupBranding {
    pub primary_color: String,
    pub secondary_color: String,
    pub logo_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SetupBedType {
    pub code: String,
    pub name: String,
    pub daily_rate: f64,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SetupTaxCategory {
    pub code: String,
    pub name: String,
    pub rate_percent: f64,
    pub applicability: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SetupPaymentMethod {
    pub code: String,
    pub name: String,
    pub is_default: bool,
}

#[derive(Debug, Deserialize)]
pub struct SetupAdditionalSequence {
    pub seq_type: String,
    pub prefix: String,
    pub pad_width: i32,
}

#[derive(Debug, Deserialize)]
pub struct SetupService {
    pub code: String,
    pub name: String,
    pub service_type: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SetupRequest {
    pub hospital_details: Option<SetupHospitalDetails>,
    pub geo: Option<SetupGeo>,
    pub regulator_ids: Option<Vec<Uuid>>,
    pub facilities: Vec<SetupFacility>,
    pub locations: Vec<SetupLocation>,
    pub departments: Vec<SetupDepartment>,
    pub users: Vec<SetupUser>,
    pub roles: Vec<SetupRole>,
    pub module_statuses: HashMap<String, String>,
    pub sequences: Option<SetupSequences>,
    pub branding: Option<SetupBranding>,
    pub additional_sequences: Option<Vec<SetupAdditionalSequence>>,
    pub bed_types: Option<Vec<SetupBedType>>,
    pub tax_categories: Option<Vec<SetupTaxCategory>>,
    pub payment_methods: Option<Vec<SetupPaymentMethod>>,
    pub services: Option<Vec<SetupService>>,
}

/// Insert items with parent references using topological ordering.
/// Items without a `parent_local_id` are inserted first, then children.
/// Returns a mapping of `local_id` → database UUID.
fn topological_order<T: HasLocalId, F>(items: &[T], get_parent: F) -> Vec<usize>
where
    F: Fn(&T) -> Option<&str>,
{
    let mut ordered: Vec<usize> = Vec::with_capacity(items.len());
    let mut remaining: Vec<usize> = (0..items.len()).collect();

    // Simple iterative topological sort — max depth = items.len()
    for _ in 0..items.len() {
        let prev_len = remaining.len();
        remaining.retain(|&idx| {
            let parent = get_parent(&items[idx]);
            let resolved = parent.is_none_or(|parent_id| {
                ordered
                    .iter()
                    .any(|&o| get_local_id_by_index(items, o) == parent_id)
            });
            if resolved {
                ordered.push(idx);
                false
            } else {
                true
            }
        });
        if remaining.len() == prev_len {
            // Remaining items have unresolvable parents — add them anyway
            ordered.append(&mut remaining);
            break;
        }
        if remaining.is_empty() {
            break;
        }
    }
    ordered
}

fn get_local_id_by_index<T: HasLocalId>(items: &[T], idx: usize) -> &str {
    items[idx].local_id()
}

trait HasLocalId {
    fn local_id(&self) -> &str;
}

impl HasLocalId for SetupFacility {
    fn local_id(&self) -> &str {
        &self.local_id
    }
}

impl HasLocalId for SetupLocation {
    fn local_id(&self) -> &str {
        &self.local_id
    }
}

impl HasLocalId for SetupDepartment {
    fn local_id(&self) -> &str {
        &self.local_id
    }
}

#[allow(clippy::too_many_lines)]
pub async fn setup(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<SetupRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // ── Idempotency check ───────────────────────────────
    let already_complete: bool = sqlx::query_scalar(
        "SELECT COALESCE(\
            (SELECT is_complete FROM onboarding_progress WHERE tenant_id = $1), \
            false\
        )",
    )
    .bind(claims.tenant_id)
    .fetch_one(&state.db)
    .await?;

    if already_complete {
        return Err(AppError::Conflict(
            "Onboarding has already been completed for this tenant".to_owned(),
        ));
    }

    // ── Validation ──────────────────────────────────────
    let mut errors = ValidationErrors::new();

    if let Some(ref details) = body.hospital_details {
        if let Some(ref email) = details.email {
            validation::validate_optional_email(&mut errors, "hospital_details.email", email);
        }
        if let Some(ref pincode) = details.pincode {
            validation::validate_optional_pincode(&mut errors, "hospital_details.pincode", pincode);
        }
        if let Some(ref phone) = details.phone {
            validation::validate_optional_phone(&mut errors, "hospital_details.phone", phone);
        }
        if details.currency.len() != 3 {
            errors.add(
                "hospital_details.currency",
                "Currency must be exactly 3 characters",
            );
        }
        if !(1..=12).contains(&details.fy_start_month) {
            errors.add(
                "hospital_details.fy_start_month",
                "Month must be between 1 and 12",
            );
        }
    }

    for (i, f) in body.facilities.iter().enumerate() {
        let prefix = format!("facilities[{i}]");
        validation::validate_code(&mut errors, &format!("{prefix}.code"), &f.code);
        validation::validate_name(&mut errors, &format!("{prefix}.name"), &f.name);
    }

    for (i, l) in body.locations.iter().enumerate() {
        let prefix = format!("locations[{i}]");
        validation::validate_code(&mut errors, &format!("{prefix}.code"), &l.code);
        validation::validate_name(&mut errors, &format!("{prefix}.name"), &l.name);
    }

    for (i, d) in body.departments.iter().enumerate() {
        let prefix = format!("departments[{i}]");
        validation::validate_code(&mut errors, &format!("{prefix}.code"), &d.code);
        validation::validate_name(&mut errors, &format!("{prefix}.name"), &d.name);
    }

    for (i, u) in body.users.iter().enumerate() {
        let prefix = format!("users[{i}]");
        validation::validate_username(&mut errors, &format!("{prefix}.username"), &u.username);
        validation::validate_email(&mut errors, &format!("{prefix}.email"), &u.email);
        validation::validate_password(&mut errors, &format!("{prefix}.password"), &u.password);
        validation::validate_name(&mut errors, &format!("{prefix}.full_name"), &u.full_name);
    }

    for (i, r) in body.roles.iter().enumerate() {
        let prefix = format!("roles[{i}]");
        validation::validate_code(&mut errors, &format!("{prefix}.code"), &r.code);
        validation::validate_name(&mut errors, &format!("{prefix}.name"), &r.name);
    }

    if let Some(ref seq) = body.sequences {
        validation::validate_prefix(&mut errors, "sequences.uhid_prefix", &seq.uhid_prefix);
        validation::validate_pad_width(&mut errors, "sequences.uhid_pad_width", seq.uhid_pad_width);
        validation::validate_prefix(&mut errors, "sequences.invoice_prefix", &seq.invoice_prefix);
        validation::validate_pad_width(
            &mut errors,
            "sequences.invoice_pad_width",
            seq.invoice_pad_width,
        );
    }

    if let Some(ref branding) = body.branding {
        validation::validate_hex_color(
            &mut errors,
            "branding.primary_color",
            &branding.primary_color,
        );
        validation::validate_hex_color(
            &mut errors,
            "branding.secondary_color",
            &branding.secondary_color,
        );
        if let Some(ref url) = branding.logo_url {
            if !url.is_empty() {
                validation::validate_optional_url(&mut errors, "branding.logo_url", url);
            }
        }
    }

    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    // ── Hash all user passwords before starting transaction ──
    let mut password_hashes: Vec<String> = Vec::with_capacity(body.users.len());
    for user in &body.users {
        let salt = SaltString::generate(&mut OsRng);
        let hash = Argon2::default()
            .hash_password(user.password.as_bytes(), &salt)
            .map_err(|e| AppError::Internal(format!("password hash error: {e}")))?
            .to_string();
        password_hashes.push(hash);
    }

    // ── Single transaction ──────────────────────────────
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // 1. Update tenant details
    if let Some(ref details) = body.hospital_details {
        sqlx::query(
            "UPDATE tenants SET \
             address_line1 = $1, address_line2 = $2, city = $3, pincode = $4, \
             phone = $5, email = $6, website = $7, registration_no = $8, \
             accreditation = $9, timezone = $10, currency = $11, fy_start_month = $12 \
             WHERE id = $13",
        )
        .bind(&details.address_line1)
        .bind(&details.address_line2)
        .bind(&details.city)
        .bind(&details.pincode)
        .bind(&details.phone)
        .bind(&details.email)
        .bind(&details.website)
        .bind(&details.registration_no)
        .bind(&details.accreditation)
        .bind(&details.timezone)
        .bind(&details.currency)
        .bind(details.fy_start_month)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;
    }

    // 2. Update tenant geo
    if let Some(ref geo) = body.geo {
        sqlx::query(
            "UPDATE tenants SET country_id = $1, state_id = $2, district_id = $3 \
             WHERE id = $4",
        )
        .bind(geo.country_id)
        .bind(geo.state_id)
        .bind(geo.district_id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;
    }

    // 3. Create "Main Hospital" facility (upsert — may already exist from init)
    let main_facility_id: Uuid = sqlx::query_scalar(
        "INSERT INTO facilities (tenant_id, code, name, facility_type, status) \
         VALUES ($1, 'MAIN', \
                 (SELECT name FROM tenants WHERE id = $1), \
                 'main_hospital', 'active') \
         ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // 4. Create additional facilities (topological order)
    let mut facility_id_map: HashMap<String, Uuid> = HashMap::new();
    let facility_order = topological_order(&body.facilities, |f| f.parent_local_id.as_deref());

    for idx in facility_order {
        let f = &body.facilities[idx];
        let parent_id = f
            .parent_local_id
            .as_ref()
            .and_then(|plid| facility_id_map.get(plid).copied())
            .or(Some(main_facility_id));

        let fid: Uuid = sqlx::query_scalar(
            "INSERT INTO facilities \
             (tenant_id, parent_id, code, name, facility_type, \
              bed_count, shared_billing, shared_pharmacy, shared_lab, shared_hr) \
             VALUES ($1, $2, $3, $4, $5::facility_type, \
                     COALESCE($6, 0), $7, $8, $9, $10) \
             RETURNING id",
        )
        .bind(claims.tenant_id)
        .bind(parent_id)
        .bind(&f.code)
        .bind(&f.name)
        .bind(&f.facility_type)
        .bind(f.bed_count)
        .bind(f.shared_billing)
        .bind(f.shared_pharmacy)
        .bind(f.shared_lab)
        .bind(f.shared_hr)
        .fetch_one(&mut *tx)
        .await?;

        facility_id_map.insert(f.local_id.clone(), fid);
    }

    // 5. Create locations (topological order)
    let mut location_id_map: HashMap<String, Uuid> = HashMap::new();
    let location_order = topological_order(&body.locations, |l| l.parent_local_id.as_deref());

    for idx in location_order {
        let l = &body.locations[idx];
        let parent_id = l
            .parent_local_id
            .as_ref()
            .and_then(|plid| location_id_map.get(plid).copied());

        let lid: Uuid = sqlx::query_scalar(
            "INSERT INTO locations (tenant_id, parent_id, level, code, name) \
             VALUES ($1, $2, $3::location_level, $4, $5) \
             RETURNING id",
        )
        .bind(claims.tenant_id)
        .bind(parent_id)
        .bind(&l.level)
        .bind(&l.code)
        .bind(&l.name)
        .fetch_one(&mut *tx)
        .await?;

        location_id_map.insert(l.local_id.clone(), lid);
    }

    // 6. Create departments (topological order)
    let dept_order = topological_order(&body.departments, |d| d.parent_local_id.as_deref());
    let mut dept_id_map: HashMap<String, Uuid> = HashMap::new();

    for idx in dept_order {
        let d = &body.departments[idx];
        let parent_id = d
            .parent_local_id
            .as_ref()
            .and_then(|plid| dept_id_map.get(plid).copied());

        let working_hours = d
            .working_hours
            .clone()
            .unwrap_or_else(|| serde_json::json!({}));

        let did: Uuid = sqlx::query_scalar(
            "INSERT INTO departments (tenant_id, parent_id, code, name, department_type, working_hours) \
             VALUES ($1, $2, $3, $4, $5::department_type, $6) \
             RETURNING id",
        )
        .bind(claims.tenant_id)
        .bind(parent_id)
        .bind(&d.code)
        .bind(&d.name)
        .bind(&d.department_type)
        .bind(&working_hours)
        .fetch_one(&mut *tx)
        .await?;

        dept_id_map.insert(d.local_id.clone(), did);
    }

    // 7. Create custom roles
    for role in &body.roles {
        sqlx::query(
            "INSERT INTO roles (tenant_id, code, name, description, permissions) \
             VALUES ($1, $2, $3, $4, '{}') \
             ON CONFLICT (tenant_id, code) DO NOTHING",
        )
        .bind(claims.tenant_id)
        .bind(&role.code)
        .bind(&role.name)
        .bind(&role.description)
        .execute(&mut *tx)
        .await?;
    }

    // 8. Create additional users (with optional doctor profile fields)
    for (i, user) in body.users.iter().enumerate() {
        // Resolve department_local_ids to real UUIDs
        let dept_ids: Vec<Uuid> = user
            .department_local_ids
            .as_ref()
            .map(|ids| {
                ids.iter()
                    .filter_map(|lid| dept_id_map.get(lid).copied())
                    .collect()
            })
            .unwrap_or_default();

        sqlx::query(
            "INSERT INTO users \
             (tenant_id, username, email, password_hash, full_name, role, \
              specialization, medical_registration_number, qualification, \
              consultation_fee, department_ids) \
             VALUES ($1, $2, $3, $4, $5, $6::user_role, $7, $8, $9, $10, $11) \
             ON CONFLICT (tenant_id, username) DO NOTHING",
        )
        .bind(claims.tenant_id)
        .bind(&user.username)
        .bind(&user.email)
        .bind(&password_hashes[i])
        .bind(&user.full_name)
        .bind(&user.role)
        .bind(&user.specialization)
        .bind(&user.medical_registration_number)
        .bind(&user.qualification)
        .bind(
            user.consultation_fee
                .and_then(|f| Decimal::try_from(f).ok()),
        )
        .bind(&dept_ids)
        .execute(&mut *tx)
        .await?;
    }

    // 9. Seed default modules + apply status overrides
    let default_modules = [
        (
            "registration",
            "Patient Registration",
            "Patient registration, UHID generation, demographics",
        ),
        (
            "opd",
            "OPD",
            "Outpatient department queues, consultations, prescriptions",
        ),
        (
            "ipd",
            "IPD",
            "Inpatient admissions, bed management, discharge",
        ),
        (
            "lab",
            "Laboratory / LIS",
            "Lab test catalog, orders, results, verification",
        ),
        (
            "pharmacy",
            "Pharmacy",
            "Drug catalog, dispensing, stock management",
        ),
        (
            "billing",
            "Billing & Revenue",
            "Invoices, payments, charge master, insurance",
        ),
        (
            "radiology",
            "Radiology / RIS",
            "Imaging orders, PACS integration, reporting",
        ),
        (
            "blood_bank",
            "Blood Bank",
            "Blood inventory, cross-match, transfusion",
        ),
        (
            "ot",
            "Operation Theatre",
            "Surgery scheduling, OT management",
        ),
        (
            "emergency",
            "Emergency",
            "Triage, emergency admissions, trauma protocols",
        ),
        (
            "nursing",
            "Nursing",
            "Nursing assessments, care plans, task management",
        ),
        (
            "diet",
            "Diet & Nutrition",
            "Meal planning, therapeutic diets, kitchen management",
        ),
        (
            "hr",
            "Human Resources",
            "Staff management, attendance, payroll",
        ),
        (
            "inventory",
            "Inventory & Stores",
            "Purchase orders, stock management, vendors",
        ),
        (
            "reports",
            "Reports & Analytics",
            "Dashboards, MIS reports, data analytics",
        ),
    ];

    for (code, name, desc) in default_modules {
        let status = body
            .module_statuses
            .get(code)
            .map_or("available", |s| s.as_str());

        sqlx::query(
            "INSERT INTO module_config (tenant_id, code, name, description, status) \
             VALUES ($1, $2, $3, $4, $5::module_status) \
             ON CONFLICT (tenant_id, code) DO UPDATE SET status = EXCLUDED.status",
        )
        .bind(claims.tenant_id)
        .bind(code)
        .bind(name)
        .bind(desc)
        .bind(status)
        .execute(&mut *tx)
        .await?;
    }

    // 10. Create sequences
    if let Some(ref seq) = body.sequences {
        sqlx::query(
            "INSERT INTO sequences (tenant_id, seq_type, prefix, current_val, pad_width) VALUES \
             ($1, 'UHID', $2, 0, $3), \
             ($1, 'INVOICE', $4, 0, $5) \
             ON CONFLICT (tenant_id, seq_type) \
             DO UPDATE SET prefix = EXCLUDED.prefix, pad_width = EXCLUDED.pad_width",
        )
        .bind(claims.tenant_id)
        .bind(&seq.uhid_prefix)
        .bind(seq.uhid_pad_width)
        .bind(&seq.invoice_prefix)
        .bind(seq.invoice_pad_width)
        .execute(&mut *tx)
        .await?;
    }

    // 11. Set branding
    if let Some(ref branding) = body.branding {
        for (key, value) in [
            ("primary_color", &branding.primary_color),
            ("secondary_color", &branding.secondary_color),
        ] {
            sqlx::query(
                "INSERT INTO tenant_settings (tenant_id, category, key, value) \
                 VALUES ($1, 'branding', $2, to_jsonb($3::text)) \
                 ON CONFLICT (tenant_id, category, key) \
                 DO UPDATE SET value = EXCLUDED.value",
            )
            .bind(claims.tenant_id)
            .bind(key)
            .bind(value)
            .execute(&mut *tx)
            .await?;
        }

        if let Some(ref logo_url) = branding.logo_url {
            if !logo_url.is_empty() {
                sqlx::query(
                    "INSERT INTO tenant_settings (tenant_id, category, key, value) \
                     VALUES ($1, 'branding', 'logo_url', to_jsonb($2::text)) \
                     ON CONFLICT (tenant_id, category, key) \
                     DO UPDATE SET value = EXCLUDED.value",
                )
                .bind(claims.tenant_id)
                .bind(logo_url)
                .execute(&mut *tx)
                .await?;
            }
        }
    }

    // 12. Insert additional sequences
    if let Some(ref additional_seqs) = body.additional_sequences {
        for seq in additional_seqs {
            sqlx::query(
                "INSERT INTO sequences (tenant_id, seq_type, prefix, current_val, pad_width) \
                 VALUES ($1, $2, $3, 0, $4) \
                 ON CONFLICT (tenant_id, seq_type) \
                 DO UPDATE SET prefix = EXCLUDED.prefix, pad_width = EXCLUDED.pad_width",
            )
            .bind(claims.tenant_id)
            .bind(&seq.seq_type)
            .bind(&seq.prefix)
            .bind(seq.pad_width)
            .execute(&mut *tx)
            .await?;
        }
    }

    // 13. Insert bed types
    if let Some(ref bed_types) = body.bed_types {
        for bt in bed_types {
            let rate = Decimal::try_from(bt.daily_rate).unwrap_or_default();
            sqlx::query(
                "INSERT INTO bed_types (tenant_id, code, name, daily_rate, description) \
                 VALUES ($1, $2, $3, $4, $5) \
                 ON CONFLICT (tenant_id, code) DO NOTHING",
            )
            .bind(claims.tenant_id)
            .bind(&bt.code)
            .bind(&bt.name)
            .bind(rate)
            .bind(&bt.description)
            .execute(&mut *tx)
            .await?;
        }
    }

    // 14. Insert tax categories
    if let Some(ref tax_cats) = body.tax_categories {
        for tc in tax_cats {
            let rate = Decimal::try_from(tc.rate_percent).unwrap_or_default();
            sqlx::query(
                "INSERT INTO tax_categories \
                 (tenant_id, code, name, rate_percent, applicability, description) \
                 VALUES ($1, $2, $3, $4, $5::tax_applicability, $6) \
                 ON CONFLICT (tenant_id, code) DO NOTHING",
            )
            .bind(claims.tenant_id)
            .bind(&tc.code)
            .bind(&tc.name)
            .bind(rate)
            .bind(&tc.applicability)
            .bind(&tc.description)
            .execute(&mut *tx)
            .await?;
        }
    }

    // 15. Insert payment methods
    if let Some(ref pay_methods) = body.payment_methods {
        for pm in pay_methods {
            sqlx::query(
                "INSERT INTO payment_methods (tenant_id, code, name, is_default) \
                 VALUES ($1, $2, $3, $4) \
                 ON CONFLICT (tenant_id, code) DO NOTHING",
            )
            .bind(claims.tenant_id)
            .bind(&pm.code)
            .bind(&pm.name)
            .bind(pm.is_default)
            .execute(&mut *tx)
            .await?;
        }
    }

    // 16. Insert services
    if let Some(ref services) = body.services {
        for svc in services {
            sqlx::query(
                "INSERT INTO services (tenant_id, code, name, service_type, description) \
                 VALUES ($1, $2, $3, $4::service_type, $5) \
                 ON CONFLICT (tenant_id, code) DO NOTHING",
            )
            .bind(claims.tenant_id)
            .bind(&svc.code)
            .bind(&svc.name)
            .bind(&svc.service_type)
            .bind(&svc.description)
            .execute(&mut *tx)
            .await?;
        }
    }

    // 17. Create compliance records (regulator links)
    if let Some(ref regulator_ids) = body.regulator_ids {
        for reg_id in regulator_ids {
            sqlx::query(
                "INSERT INTO facility_regulatory_compliance \
                 (tenant_id, facility_id, regulatory_body_id, status) \
                 VALUES ($1, $2, $3, 'pending') \
                 ON CONFLICT (tenant_id, facility_id, regulatory_body_id) DO NOTHING",
            )
            .bind(claims.tenant_id)
            .bind(main_facility_id)
            .bind(reg_id)
            .execute(&mut *tx)
            .await?;
        }
    }

    // 18. Mark onboarding complete
    sqlx::query(
        "UPDATE onboarding_progress \
         SET is_complete = true, completed_at = now() \
         WHERE tenant_id = $1",
    )
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    // 19. Audit log
    medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "onboarding_setup_complete",
            entity_type: "tenant",
            entity_id: Some(claims.tenant_id),
            old_values: None,
            new_values: None,
            ip_address: None,
        },
    )
    .await
    .map_err(AppError::from)?;

    tx.commit().await?;

    tracing::info!(tenant_id = %claims.tenant_id, "Onboarding setup completed");

    Ok(Json(serde_json::json!({ "status": "ok" })))
}

// ── GET /api/onboarding/progress ────────────────────────────

pub async fn get_progress(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<OnboardingProgress>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let progress = sqlx::query_as::<_, OnboardingProgress>(
        "SELECT * FROM onboarding_progress WHERE tenant_id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;

    progress.map_or_else(|| Err(AppError::NotFound), |p| Ok(Json(p)))
}

// ── PUT /api/onboarding/progress ────────────────────────────

#[derive(Debug, Deserialize)]
pub struct UpdateProgressRequest {
    pub current_step: i32,
    pub completed_steps: serde_json::Value,
}

pub async fn update_progress(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpdateProgressRequest>,
) -> Result<Json<OnboardingProgress>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let progress = sqlx::query_as::<_, OnboardingProgress>(
        "UPDATE onboarding_progress \
         SET current_step = $1, completed_steps = $2 \
         WHERE tenant_id = $3 \
         RETURNING *",
    )
    .bind(body.current_step)
    .bind(&body.completed_steps)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;

    progress.map_or_else(|| Err(AppError::NotFound), |p| Ok(Json(p)))
}

// ── POST /api/onboarding/complete ───────────────────────────

pub async fn complete(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query(
        "UPDATE onboarding_progress \
         SET is_complete = true, completed_at = now() \
         WHERE tenant_id = $1",
    )
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "onboarding_complete",
            entity_type: "tenant",
            entity_id: Some(claims.tenant_id),
            old_values: None,
            new_values: None,
            ip_address: None,
        },
    )
    .await
    .map_err(AppError::from)?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "status": "ok" })))
}
