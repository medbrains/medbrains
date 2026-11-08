//! The Wards sheet: code, name, kind of ward, who it admits, its department.

use medbrains_server_core::error::AppError;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::{Problems, SheetTally, text};

const SHEET: &str = "Wards";
pub(crate) const WARD_TYPES: &[&str] = &[
    "general", "private", "semi_private", "icu", "hdu", "nicu", "picu", "emergency", "maternity",
    "isolation", "day_care",
];
pub(crate) const GENDERS: &[&str] = &["any", "male", "female"];

#[derive(Debug, Clone, Deserialize, Serialize, sqlx::FromRow)]
pub struct Row {
    #[serde(default)]
    #[sqlx(skip)]
    pub row: u32,
    pub code: Option<String>,
    pub name: Option<String>,
    pub ward_type: Option<String>,
    pub gender: Option<String>,
    pub department_code: Option<String>,
}

fn choice(value: Option<&String>, default: &str, allowed: &[&str]) -> Result<String, String> {
    let v = text(value).map_or_else(|| default.to_owned(), |v| v.to_lowercase().replace([' ', '-'], "_"));
    if allowed.contains(&v.as_str()) { Ok(v) } else { Err(format!("Use one of: {}", allowed.join(", "))) }
}

pub(crate) async fn import(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant: Uuid,
    rows: &[Row],
    problems: &mut Problems,
) -> Result<SheetTally, AppError> {
    let mut tally = SheetTally { sheet: SHEET, added: 0, updated: 0 };
    for r in rows {
        let (Some(code), Some(name)) = (text(r.code.as_ref()).map(|c| c.to_uppercase()), text(r.name.as_ref())) else {
            problems.add(SHEET, r.row, "Code / Name", "Every ward needs a code and a name");
            continue;
        };
        let ward_type = match choice(r.ward_type.as_ref(), "general", WARD_TYPES) {
            Ok(v) => v,
            Err(m) => { problems.add(SHEET, r.row, "Ward type", m); continue; }
        };
        let gender = match choice(r.gender.as_ref(), "any", GENDERS) {
            Ok(v) => v,
            Err(m) => { problems.add(SHEET, r.row, "Admits", m); continue; }
        };
        let department = match text(r.department_code.as_ref()) {
            None => None,
            Some(dept) => {
                let id: Option<Uuid> = sqlx::query_scalar(
                    "SELECT id FROM departments WHERE tenant_id = $1 AND code = $2 AND deleted_at IS NULL",
                )
                .bind(tenant)
                .bind(dept.to_uppercase())
                .fetch_optional(&mut **tx)
                .await?;
                if id.is_none() {
                    problems.add(SHEET, r.row, "Department code", format!("No department has the code {dept}"));
                    continue;
                }
                id
            }
        };
        let inserted: bool = sqlx::query_scalar(
            "INSERT INTO wards (tenant_id, code, name, department_id, ward_type, gender_restriction) \
             VALUES ($1, $2, $3, $4, $5, $6) \
             ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name, \
               department_id = EXCLUDED.department_id, ward_type = EXCLUDED.ward_type, \
               gender_restriction = EXCLUDED.gender_restriction, is_active = true, \
               deleted_at = NULL, deleted_by = NULL, delete_reason = NULL \
             RETURNING (xmax = 0)",
        )
        .bind(tenant)
        .bind(&code)
        .bind(&name)
        .bind(department)
        .bind(&ward_type)
        .bind(&gender)
        .fetch_one(&mut **tx)
        .await?;
        if inserted { tally.added += 1 } else { tally.updated += 1 }
    }
    Ok(tally)
}
