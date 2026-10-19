//! Committing a reviewed bill (#4861): one transaction writes the GRN
//! through the same draft path as manual entry, posts it (stock moves now,
//! once), remembers the confirmed item matches, and keeps every corrected
//! field as original-vs-final.

use std::collections::{BTreeSet, HashMap};

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use medbrains_server_core::validation::ValidationErrors;
use serde::Deserialize;
use uuid::Uuid;

use crate::grn::{self, CreateGrnItemInput, CreateGrnRequest, GrnDetailResponse};
use crate::grn_match;
use crate::grn_post;
use crate::grn_scan::PurchaseBillScan;
use crate::grn_scan_contract::{Draft, DraftLine, ParseResult, to_draft};
use crate::grn_scan_review::draft_of;

const fn yes() -> bool {
    true
}

#[derive(Debug, Deserialize)]
pub struct CommitScanRequest {
    /// Remember each confirmed supplier-name → item match (default on).
    #[serde(default = "yes")]
    pub remember_matches: bool,
}

/// One corrected field: path, what was read, what was kept, read confidence.
pub type Correction = (String, Option<String>, Option<String>, Option<f64>);

/// Field-level differences between the reader's draft and the final one.
#[derive(Debug, Default)]
pub struct Diff {
    pub total: i32,
    pub changed: Vec<Correction>,
}

/// Keys the reader never reads: choices made on the screen.
const NOT_READ: [&str; 7] = [
    "catalog_item_id",
    "suggested_item_id",
    "po_item_id",
    "quantity_rejected",
    "vendor_id",
    "po_id",
    "store_location_id",
];

fn leaf(v: Option<&serde_json::Value>) -> Option<String> {
    match v? {
        serde_json::Value::Null => None,
        serde_json::Value::String(s) => Some(s.clone()),
        other => Some(other.to_string()),
    }
}

fn json<T: serde::Serialize>(v: &T) -> serde_json::Value {
    serde_json::to_value(v).unwrap_or_default()
}

fn compare(
    prefix: &str,
    a: &serde_json::Value,
    b: &serde_json::Value,
    original: &Draft,
    diff: &mut Diff,
) {
    let keys: BTreeSet<&String> = a
        .as_object()
        .into_iter()
        .chain(b.as_object())
        .flat_map(|o| o.keys())
        .collect();
    for key in keys.into_iter().filter(|k| !NOT_READ.contains(&k.as_str())) {
        let (was, now) = (leaf(a.get(key)), leaf(b.get(key)));
        if was.is_none() && now.is_none() {
            continue;
        }
        diff.total += 1;
        if was != now {
            let path = format!("{prefix}.{key}");
            let conf = original.confidence.get(&path).copied();
            diff.changed.push((path, was, now, conf));
        }
    }
}

/// What the reviewer changed, field by field, against the reader's draft.
pub fn diff_drafts(original: &Draft, fin: &Draft) -> Diff {
    let mut diff = Diff::default();
    compare(
        "header",
        &json(&original.header),
        &json(&fin.header),
        original,
        &mut diff,
    );
    for i in 0..original.lines.len().max(fin.lines.len()) {
        let a = original.lines.get(i).map(json).unwrap_or_default();
        let b = fin.lines.get(i).map(json).unwrap_or_default();
        compare(&format!("lines[{i}]"), &a, &b, original, &mut diff);
    }
    diff
}

fn require_matched(draft: &Draft) -> Result<(Uuid, Uuid), AppError> {
    let mut errors = ValidationErrors::new();
    if draft.header.vendor_id.is_none() {
        errors.add("header.vendor_id", "Choose the supplier");
    }
    if draft.header.po_id.is_none() {
        errors.add(
            "header.po_id",
            "Choose the purchase order this bill is against",
        );
    }
    if draft.lines.is_empty() {
        errors.add("lines", "The bill has no lines");
    }
    for (i, l) in draft.lines.iter().enumerate() {
        if l.catalog_item_id.is_none() {
            errors.add(
                &format!("lines[{i}].catalog_item_id"),
                "Pick the catalogue item",
            );
        }
        if l.quantity.unwrap_or(0) <= 0 || l.rate.is_none() {
            errors.add(
                &format!("lines[{i}].quantity"),
                "Enter the billed quantity and rate",
            );
        }
    }
    match (draft.header.vendor_id, draft.header.po_id) {
        (Some(v), Some(p)) if !errors.has_errors() => Ok((v, p)),
        _ => Err(AppError::ValidationFailed(errors)),
    }
}

/// PO line for each scanned line: the one PO line with the same item.
async fn po_lines_by_item(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    po_id: Uuid,
) -> Result<HashMap<Uuid, Uuid>, AppError> {
    let rows: Vec<(Uuid, Uuid)> = sqlx::query_as(
        "SELECT catalog_item_id, MIN(id::text)::uuid FROM purchase_order_items \
          WHERE tenant_id = $1 AND po_id = $2 AND catalog_item_id IS NOT NULL \
          GROUP BY catalog_item_id HAVING COUNT(*) = 1",
    )
    .bind(tenant_id)
    .bind(po_id)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows.into_iter().collect())
}

fn grn_request(draft: &Draft, po_id: Uuid, po_lines: &HashMap<Uuid, Uuid>) -> CreateGrnRequest {
    let h = &draft.header;
    let items = draft.lines.iter().map(|l: &DraftLine| {
        let received = l.quantity.unwrap_or(0);
        let rejected = l.quantity_rejected.unwrap_or(0);
        CreateGrnItemInput {
            po_item_id: l
                .po_item_id
                .or_else(|| l.catalog_item_id.and_then(|c| po_lines.get(&c).copied())),
            catalog_item_id: l.catalog_item_id,
            item_name: l.product_name.clone().unwrap_or_default(),
            quantity_received: received,
            quantity_accepted: received - rejected,
            quantity_rejected: Some(rejected),
            batch_number: l.batch_number.clone(),
            expiry_date: l.expiry_date,
            manufacture_date: l.manufacture_date,
            unit_price: l.rate.unwrap_or_default(),
            mrp: l.mrp,
            ptr: l.ptr,
            free_quantity: l.free_quantity,
            discount_amount: l.discount_amount,
            gst_rate: l.gst_rate,
            hsn_code: l.hsn_code.clone(),
            rejection_reason: None,
            notes: None,
        }
    });
    CreateGrnRequest {
        po_id,
        store_location_id: h.store_location_id,
        invoice_number: h.invoice_number.clone(),
        invoice_date: h.invoice_date,
        invoice_amount: h.invoice_amount,
        irn: h.irn.clone(),
        notes: Some("Entered from a scanned supplier bill".to_owned()),
        items: items.collect(),
    }
}

async fn keep_corrections(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    scan: &PurchaseBillScan,
    vendor_id: Uuid,
    user_id: Uuid,
    diff: &Diff,
) -> Result<(), AppError> {
    let col = |f: fn(&Correction) -> Option<String>| diff.changed.iter().map(f).collect::<Vec<_>>();
    sqlx::query(
        "INSERT INTO grn_scan_corrections (tenant_id, scan_id, vendor_id, field_path, \
             original_value, final_value, confidence, corrected_by) \
         SELECT $1, $2, $3, u.path, u.was, u.now, u.conf::numeric(5,4), $4 \
           FROM UNNEST($5::text[], $6::text[], $7::text[], $8::float8[]) AS u(path, was, now, conf)",
    )
    .bind(scan.tenant_id)
    .bind(scan.id)
    .bind(vendor_id)
    .bind(user_id)
    .bind(col(|c| Some(c.0.clone())))
    .bind(col(|c| c.1.clone()))
    .bind(col(|c| c.2.clone()))
    .bind(diff.changed.iter().map(|c| c.3.map(|v| v.clamp(0.0, 1.0))).collect::<Vec<_>>())
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// `POST /api/procurement/grn-scans/{id}/commit` — post the reviewed bill.
pub async fn commit_scan(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CommitScanRequest>,
) -> Result<Json<GrnDetailResponse>, AppError> {
    require_permission(&claims, permissions::procurement::grn::SCAN)?;
    require_permission(&claims, permissions::procurement::grn::POST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let scan: PurchaseBillScan = sqlx::query_as(
        "SELECT * FROM purchase_bill_scans WHERE id = $1 AND tenant_id = $2 \
           AND deleted_at IS NULL FOR UPDATE",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    if !matches!(scan.status.as_str(), "parsed" | "reviewing") {
        return Err(AppError::Conflict(format!("This scan is {}.", scan.status)));
    }
    let draft = draft_of(&scan)?;
    let (vendor_id, po_id) = require_matched(&draft)?;
    let po_vendor: Option<Uuid> = sqlx::query_scalar(
        "SELECT vendor_id FROM purchase_orders WHERE id = $1 AND tenant_id = $2",
    )
    .bind(po_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    if po_vendor != Some(vendor_id) {
        return Err(AppError::BadRequest(
            "This bill's supplier is not the supplier on the chosen purchase order.".into(),
        ));
    }
    let po_lines = po_lines_by_item(&mut tx, claims.tenant_id, po_id).await?;
    let request = grn_request(&draft, po_id, &po_lines);
    let (grn, warnings) = grn::insert_draft(&mut tx, &claims, &request).await?;
    let grn = grn_post::post_grn(&mut tx, claims.tenant_id, claims.sub, grn.id).await?;
    if body.remember_matches {
        grn_match::learn_aliases(
            &mut tx,
            claims.tenant_id,
            vendor_id,
            claims.sub,
            &draft.lines,
        )
        .await?;
    }
    let read: ParseResult = scan
        .extracted_json
        .clone()
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();
    let diff = diff_drafts(&to_draft(&read), &draft);
    keep_corrections(&mut tx, &scan, vendor_id, claims.sub, &diff).await?;
    let suggested = draft.lines.iter().filter(|l| l.suggested_item_id.is_some());
    let held = suggested
        .clone()
        .filter(|l| l.suggested_item_id == l.catalog_item_id)
        .count();
    let rematched = suggested.count() - held;
    sqlx::query(
        "UPDATE purchase_bill_scans SET status = 'committed', grn_id = $3, committed_by = $4, \
                committed_at = now(), fields_total = $5, fields_corrected = $6, \
                lines_total = $7, lines_auto_matched = $8, lines_rematched = $9, vendor_id = $10 \
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(grn.id)
    .bind(claims.sub)
    .bind(diff.total)
    .bind(i32::try_from(diff.changed.len()).unwrap_or(i32::MAX))
    .bind(i32::try_from(draft.lines.len()).unwrap_or(i32::MAX))
    .bind(i32::try_from(held).unwrap_or(i32::MAX))
    .bind(i32::try_from(rematched).unwrap_or(i32::MAX))
    .bind(vendor_id)
    .execute(&mut *tx)
    .await?;
    let items = grn::load_items(&mut tx, claims.tenant_id, grn.id).await?;
    tx.commit().await?;
    Ok(Json(GrnDetailResponse {
        grn,
        items,
        warnings,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_corrected_batch_is_one_change_and_screen_choices_are_not_counted() {
        let mut original = Draft::default();
        original.header.invoice_number = Some("INV-1".into());
        original.lines.push(DraftLine {
            batch_number: Some("B1Z".into()),
            quantity: Some(10),
            ..DraftLine::default()
        });
        original
            .confidence
            .insert("lines[0].batch_number".into(), 0.4);
        let mut fin = original.clone();
        fin.header.vendor_id = Some(Uuid::nil());
        fin.lines[0].batch_number = Some("B12".into());
        fin.lines[0].catalog_item_id = Some(Uuid::nil());
        let diff = diff_drafts(&original, &fin);
        assert_eq!(diff.total, 3);
        assert_eq!(diff.changed.len(), 1);
        assert_eq!(diff.changed[0].0, "lines[0].batch_number");
        assert_eq!(diff.changed[0].3, Some(0.4));
    }
}
