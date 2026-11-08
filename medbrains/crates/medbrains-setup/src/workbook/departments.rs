//! The Departments sheet: code, name, type, and the department it sits under.

use medbrains_server_core::error::AppError;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::{Problems, SheetTally, text};

const SHEET: &str = "Departments";
pub(crate) const TYPES: &[&str] =
    &["clinical", "pre_clinical", "para_clinical", "administrative", "support", "academic"];

#[derive(Debug, Clone, Deserialize, Serialize, sqlx::FromRow)]
pub struct Row {
    #[serde(default)]
    #[sqlx(skip)]
    pub row: u32,
    pub code: Option<String>,
    pub name: Option<String>,
    #[serde(rename = "type")]
    #[sqlx(rename = "type")]
    pub kind: Option<String>,
    pub parent_code: Option<String>,
}

pub(crate) async fn import(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant: Uuid,
    rows: &[Row],
    problems: &mut Problems,
) -> Result<SheetTally, AppError> {
    let mut tally = SheetTally { sheet: SHEET, added: 0, updated: 0 };
    let mut parents = Vec::new();
    for r in rows {
        let code = text(r.code.as_ref()).map(|c| c.to_uppercase());
        let name = text(r.name.as_ref());
        let kind = text(r.kind.as_ref()).map_or_else(|| "clinical".to_owned(), |k| k.to_lowercase().replace([' ', '-'], "_"));
        let (Some(code), Some(name)) = (code, name) else {
            problems.add(SHEET, r.row, "Code / Name", "Every department needs a code and a name");
            continue;
        };
        if !TYPES.contains(&kind.as_str()) {
            problems.add(SHEET, r.row, "Type", format!("Use one of: {}", TYPES.join(", ")));
            continue;
        }
        let inserted: bool = sqlx::query_scalar(
            "INSERT INTO departments (tenant_id, code, name, department_type) \
             VALUES ($1, $2, $3, $4::department_type) \
             ON CONFLICT (tenant_id, code) WHERE deleted_at IS NULL \
             DO UPDATE SET name = EXCLUDED.name, department_type = EXCLUDED.department_type \
             RETURNING (xmax = 0)",
        )
        .bind(tenant)
        .bind(&code)
        .bind(&name)
        .bind(&kind)
        .fetch_one(&mut **tx)
        .await?;
        if inserted { tally.added += 1 } else { tally.updated += 1 }
        if let Some(parent) = text(r.parent_code.as_ref()) {
            parents.push((r.row, code, parent.to_uppercase()));
        }
    }
    // Parents last: a department may sit under one further down the sheet.
    for (row, code, parent) in parents {
        let linked = sqlx::query(
            "UPDATE departments d SET parent_id = p.id FROM departments p \
              WHERE d.tenant_id = $1 AND d.code = $2 AND d.deleted_at IS NULL \
                AND p.tenant_id = $1 AND p.code = $3 AND p.deleted_at IS NULL AND p.id <> d.id",
        )
        .bind(tenant)
        .bind(&code)
        .bind(&parent)
        .execute(&mut **tx)
        .await?
        .rows_affected();
        if linked == 0 {
            problems.add(SHEET, row, "Parent code", format!("No department has the code {parent}"));
        }
    }
    Ok(tally)
}
