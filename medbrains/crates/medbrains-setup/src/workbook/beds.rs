//! The Beds sheet: each bed's code, its ward, and the room it is in.
//!
//! A bed is a `bed` location (the bed board derives its state from it), in a
//! `room` location, mapped to its ward — the same shape the ward screen makes.

use medbrains_server_core::error::AppError;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::{Problems, SheetTally, text};

const SHEET: &str = "Beds";

#[derive(Debug, Clone, Deserialize, Serialize, sqlx::FromRow)]
pub struct Row {
    #[serde(default)]
    #[sqlx(skip)]
    pub row: u32,
    pub code: Option<String>,
    pub ward_code: Option<String>,
    pub room: Option<String>,
}

async fn upsert_location(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant: Uuid,
    level: &str,
    code: &str,
    parent: Option<Uuid>,
) -> Result<(Uuid, bool), AppError> {
    Ok(sqlx::query_as(
        "INSERT INTO locations (tenant_id, level, code, name, parent_id) \
         VALUES ($1, $2::location_level, $3, $3, $4) \
         ON CONFLICT (tenant_id, code) WHERE deleted_at IS NULL \
         DO UPDATE SET parent_id = COALESCE(EXCLUDED.parent_id, locations.parent_id), is_active = true \
         RETURNING id, (xmax = 0)",
    )
    .bind(tenant)
    .bind(level)
    .bind(code)
    .bind(parent)
    .fetch_one(&mut **tx)
    .await?)
}

pub(crate) async fn import(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant: Uuid,
    rows: &[Row],
    problems: &mut Problems,
) -> Result<SheetTally, AppError> {
    let mut tally = SheetTally { sheet: SHEET, added: 0, updated: 0 };
    let mut wards_touched: Vec<Uuid> = Vec::new();
    for r in rows {
        let (Some(code), Some(ward_code)) =
            (text(r.code.as_ref()).map(|c| c.to_uppercase()), text(r.ward_code.as_ref()).map(|c| c.to_uppercase()))
        else {
            problems.add(SHEET, r.row, "Bed code / Ward code", "Every bed needs its code and its ward");
            continue;
        };
        let ward: Option<Uuid> = sqlx::query_scalar(
            "SELECT id FROM wards WHERE tenant_id = $1 AND code = $2 AND deleted_at IS NULL",
        )
        .bind(tenant)
        .bind(&ward_code)
        .fetch_optional(&mut **tx)
        .await?;
        let Some(ward) = ward else {
            problems.add(SHEET, r.row, "Ward code", format!("No ward has the code {ward_code}"));
            continue;
        };
        // A code already used by a non-bed location would be silently turned into a bed.
        let clash: Option<String> = sqlx::query_scalar(
            "SELECT level::text FROM locations WHERE tenant_id = $1 AND code = $2 \
               AND deleted_at IS NULL AND level <> 'bed'",
        )
        .bind(tenant)
        .bind(&code)
        .fetch_optional(&mut **tx)
        .await?;
        if let Some(level) = clash {
            problems.add(SHEET, r.row, "Bed code", format!("{code} is already a {level}, not a bed"));
            continue;
        }
        let room = match text(r.room.as_ref()) {
            Some(room) => Some(upsert_location(tx, tenant, "room", &room.to_uppercase(), None).await?.0),
            None => None,
        };
        let (bed, inserted) = upsert_location(tx, tenant, "bed", &code, room).await?;
        sqlx::query(
            "INSERT INTO ward_bed_mappings (tenant_id, ward_id, bed_location_id) VALUES ($1, $2, $3) \
             ON CONFLICT (tenant_id, bed_location_id) WHERE deleted_at IS NULL \
             DO UPDATE SET ward_id = EXCLUDED.ward_id, is_active = true",
        )
        .bind(tenant)
        .bind(ward)
        .bind(bed)
        .execute(&mut **tx)
        .await?;
        if inserted { tally.added += 1 } else { tally.updated += 1 }
        if !wards_touched.contains(&ward) {
            wards_touched.push(ward);
        }
    }
    // The ward's bed count follows its mapped beds.
    sqlx::query(
        "UPDATE wards w SET total_beds = (SELECT COUNT(*) FROM ward_bed_mappings m \
            WHERE m.tenant_id = w.tenant_id AND m.ward_id = w.id AND m.deleted_at IS NULL) \
          WHERE w.tenant_id = $1 AND w.id = ANY($2)",
    )
    .bind(tenant)
    .bind(&wards_touched)
    .execute(&mut **tx)
    .await?;
    Ok(tally)
}
