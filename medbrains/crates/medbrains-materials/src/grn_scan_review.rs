//! Reviewing a scanned bill (#4861): everything the side-by-side screen
//! needs in one round trip — the draft, the image, the checks, the
//! duplicate findings and the item suggestions — and saving corrections.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::NaiveDate;
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::grn::{self, CatalogueFacts};
use crate::grn_match::{self, Suggestion};
use crate::grn_scan::{self, PurchaseBillScan};
use crate::grn_scan_contract::{Draft, DraftLine, EinvoiceQr, qr_mismatches, repeated_lines};
use crate::grn_validate::{self as v, Issue, LineFacts};

/// Lines at or above this confidence, passing every check, may be ticked
/// for the reviewer; nothing is ever committed without a person (brief
/// §12.2, `grn.scan.auto_tick_confidence`, inferred default).
pub const AUTO_TICK_CONFIDENCE: f64 = 0.95;
/// Soft duplicate: same supplier, total within 1%, dates within 7 days.
pub const NEAR_DUPLICATE_DAYS: i32 = 7;
pub const NEAR_DUPLICATE_PCT: i64 = 1;

pub fn draft_of(scan: &PurchaseBillScan) -> Result<Draft, AppError> {
    scan.draft_json
        .clone()
        .map(serde_json::from_value)
        .transpose()
        .map_err(|e| AppError::Internal(format!("stored draft unreadable: {e}")))
        .map(Option::unwrap_or_default)
}

pub fn facts_of_line(line: &DraftLine, cat: Option<&CatalogueFacts>) -> LineFacts {
    let qty = line.quantity.unwrap_or(0);
    LineFacts {
        name: line
            .product_name
            .clone()
            .unwrap_or_else(|| "Unnamed line".to_owned()),
        rate: line.rate.unwrap_or_default(),
        mrp: line.mrp,
        expiry: line.expiry_date,
        manufacture: line.manufacture_date,
        received: qty,
        accepted: qty - line.quantity_rejected.unwrap_or(0),
        discount: line.discount_amount.unwrap_or_default(),
        gst_rate: line.gst_rate,
        hsn: line.hsn_code.clone(),
        catalogue_gst: cat.and_then(|f| Some((f.hsn_code.clone()?, f.gst_rate?))),
    }
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct NearDuplicate {
    pub grn_id: Uuid,
    pub grn_number: String,
    pub invoice_number: Option<String>,
    pub invoice_date: Option<NaiveDate>,
    pub invoice_amount: Option<Decimal>,
}

#[derive(Debug, Serialize)]
pub struct RepeatedLine {
    pub line: usize,
    pub repeats: usize,
}

#[derive(Debug, Serialize)]
pub struct ReviewResponse {
    pub scan: PurchaseBillScan,
    pub draft: Draft,
    pub image_url: Option<String>,
    /// Validator findings; fields are `items[i].…` for draft line i.
    pub issues: Vec<Issue>,
    pub qr_mismatches: Vec<String>,
    /// A GRN already holding this invoice — committing would be refused.
    pub duplicate_grn: Option<String>,
    pub near_duplicates: Vec<NearDuplicate>,
    pub repeated_lines: Vec<RepeatedLine>,
    pub suggestions: Vec<Suggestion>,
    pub auto_tick_confidence: f64,
}

async fn exact_duplicate(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    draft: &Draft,
) -> Result<Option<String>, AppError> {
    let h = &draft.header;
    Ok(sqlx::query_scalar(
        "SELECT grn_number FROM goods_receipt_notes \
          WHERE tenant_id = $1 AND deleted_at IS NULL AND NOT legacy_duplicate \
            AND ((vendor_id = $2 AND invoice_no_norm = grn_invoice_no_norm($3) \
                  AND invoice_date IS NOT DISTINCT FROM $4) \
                 OR ($5::text IS NOT NULL AND irn = $5)) LIMIT 1",
    )
    .bind(tenant_id)
    .bind(h.vendor_id)
    .bind(h.invoice_number.as_deref())
    .bind(h.invoice_date)
    .bind(h.irn.as_deref())
    .fetch_optional(&mut **tx)
    .await?)
}

async fn near_duplicates(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    draft: &Draft,
) -> Result<Vec<NearDuplicate>, AppError> {
    let h = &draft.header;
    let (Some(vendor), Some(date), Some(amount)) = (h.vendor_id, h.invoice_date, h.invoice_amount)
    else {
        return Ok(Vec::new());
    };
    Ok(sqlx::query_as::<_, NearDuplicate>(
        "SELECT id AS grn_id, grn_number, invoice_number, invoice_date, invoice_amount \
           FROM goods_receipt_notes \
          WHERE tenant_id = $1 AND vendor_id = $2 AND deleted_at IS NULL \
            AND invoice_date BETWEEN $3::date - $5::int AND $3::date + $5::int \
            AND abs(COALESCE(invoice_amount, total_amount) - $4) <= abs($4) * $6 / 100 \
          ORDER BY invoice_date DESC LIMIT 5",
    )
    .bind(tenant_id)
    .bind(vendor)
    .bind(date)
    .bind(amount)
    .bind(NEAR_DUPLICATE_DAYS)
    .bind(Decimal::from(NEAR_DUPLICATE_PCT))
    .fetch_all(&mut **tx)
    .await?)
}

/// `GET /api/procurement/grn-scans/{id}/review`
pub async fn review_scan(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<ReviewResponse>, AppError> {
    require_permission(&claims, permissions::procurement::grn::SCAN)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let scan = grn_scan::load_scan(&mut tx, claims.tenant_id, id).await?;
    let draft = draft_of(&scan)?;
    let ids: Vec<Uuid> = draft
        .lines
        .iter()
        .filter_map(|l| l.catalog_item_id)
        .collect();
    let facts = grn::catalogue_facts(&mut tx, claims.tenant_id, &ids).await?;
    let rules = grn::load_rules(&mut tx, claims.tenant_id).await?;
    let lines: Vec<LineFacts> = draft
        .lines
        .iter()
        .map(|l| facts_of_line(l, l.catalog_item_id.and_then(|i| facts.get(&i))))
        .collect();
    let issues = v::check_bill(&lines, draft.header.invoice_amount, &rules);
    let qr: Option<EinvoiceQr> = scan
        .einvoice
        .clone()
        .and_then(|q| serde_json::from_value(q).ok());
    let unmatched: Vec<&DraftLine> = draft.lines.iter().collect();
    let suggestions = grn_match::suggest(
        &mut tx,
        claims.tenant_id,
        &unmatched,
        grn_match::SUGGESTIONS_PER_LINE,
    )
    .await?;
    let duplicate_grn = exact_duplicate(&mut tx, claims.tenant_id, &draft).await?;
    let near = near_duplicates(&mut tx, claims.tenant_id, &draft).await?;
    tx.commit().await?;
    let image_url = grn_scan::image_url(&state, &scan.file_key).await?;
    Ok(Json(ReviewResponse {
        qr_mismatches: qr.map(|q| qr_mismatches(&draft, &q)).unwrap_or_default(),
        repeated_lines: repeated_lines(&draft.lines)
            .into_iter()
            .map(|(line, repeats)| RepeatedLine { line, repeats })
            .collect(),
        scan,
        draft,
        image_url,
        issues,
        duplicate_grn,
        near_duplicates: near,
        suggestions,
        auto_tick_confidence: AUTO_TICK_CONFIDENCE,
    }))
}

/// `PUT /api/procurement/grn-scans/{id}/draft` — save the reviewer's
/// corrections. The reader's extraction is untouched.
pub async fn save_draft(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(mut draft): Json<Draft>,
) -> Result<Json<PurchaseBillScan>, AppError> {
    require_permission(&claims, permissions::procurement::grn::SCAN)?;
    if draft.lines.len() > grn::MAX_GRN_LINES {
        return Err(AppError::BadRequest(format!(
            "At most {} lines",
            grn::MAX_GRN_LINES
        )));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let scan = grn_scan::load_scan(&mut tx, claims.tenant_id, id).await?;
    if !matches!(scan.status.as_str(), "parsed" | "reviewing") {
        return Err(AppError::Conflict(format!("This scan is {}.", scan.status)));
    }
    // What the system proposed is not the reviewer's to rewrite.
    let stored = draft_of(&scan)?;
    for (i, line) in draft.lines.iter_mut().enumerate() {
        line.suggested_item_id = stored.lines.get(i).and_then(|l| l.suggested_item_id);
    }
    draft.confidence = stored.confidence;
    let scan = sqlx::query_as::<_, PurchaseBillScan>(
        "UPDATE purchase_bill_scans SET draft_json = $3, status = 'reviewing', \
                vendor_id = COALESCE($4, vendor_id) \
          WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(serde_json::to_value(&draft).map_err(|e| AppError::Internal(e.to_string()))?)
    .bind(draft.header.vendor_id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(scan))
}

#[derive(Debug, Deserialize)]
pub struct ItemSearchQuery {
    pub q: String,
}

/// `GET /api/procurement/grn-scans/item-search?q=` — the review screen's
/// item picker: catalogue items by name, best first.
pub async fn item_search(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ItemSearchQuery>,
) -> Result<Json<Vec<Suggestion>>, AppError> {
    require_permission(&claims, permissions::procurement::grn::SCAN)?;
    let term = q.q.trim();
    if term.len() < 2 {
        return Ok(Json(Vec::new()));
    }
    let probe = DraftLine {
        product_name: Some(term.chars().take(80).collect()),
        ..DraftLine::default()
    };
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let found = grn_match::suggest(&mut tx, claims.tenant_id, &[&probe], 10).await?;
    tx.commit().await?;
    Ok(Json(found))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SupplierAccuracy {
    pub vendor_id: Uuid,
    pub vendor_name: String,
    pub scans: i64,
    pub fields_total: i64,
    pub fields_corrected: i64,
    pub lines_total: i64,
    pub lines_auto_matched: i64,
    pub lines_rematched: i64,
}

/// `GET /api/procurement/grn-scans/accuracy` — per supplier: how much of
/// what the reader read was corrected, and how often a remembered match held.
pub async fn scan_accuracy(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<SupplierAccuracy>>, AppError> {
    require_permission(&claims, permissions::procurement::grn::SCAN)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, SupplierAccuracy>(
        "SELECT s.vendor_id, v.name AS vendor_name, COUNT(*) AS scans, \
                COALESCE(SUM(s.fields_total), 0)::bigint AS fields_total, \
                COALESCE(SUM(s.fields_corrected), 0)::bigint AS fields_corrected, \
                COALESCE(SUM(s.lines_total), 0)::bigint AS lines_total, \
                COALESCE(SUM(s.lines_auto_matched), 0)::bigint AS lines_auto_matched, \
                COALESCE(SUM(s.lines_rematched), 0)::bigint AS lines_rematched \
           FROM purchase_bill_scans s JOIN vendors v ON v.id = s.vendor_id \
          WHERE s.tenant_id = $1 AND s.status = 'committed' AND s.deleted_at IS NULL \
          GROUP BY s.vendor_id, v.name ORDER BY scans DESC LIMIT 200",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}
