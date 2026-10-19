//! The payer-split screen's API (#294): one view of a bill with each line's
//! payer, the desk's overrides, and writing the result onto the claim.

use axum::{Extension, Json, extract::Path, extract::State};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

use crate::payer_split::{Line, Payer, Rule, Split, Terms, default_rules, split};

/// Claims past these can no longer have their amounts rewritten.
const CLOSED_CLAIMS: [&str; 3] = ["settled", "partially_settled", "claim_rejected"];

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ThirdParty {
    /// `insurer`, `scheme` or `corporate`.
    pub kind: String,
    pub name: String,
    pub claim_id: Option<Uuid>,
    pub claim_status: Option<String>,
    #[serde(skip)]
    pub copay_percent: Option<Decimal>,
    #[serde(skip)]
    pub deductible: Option<Decimal>,
    pub claimed_amount: Option<Decimal>,
}

#[derive(Debug, Serialize)]
pub struct LineView {
    pub id: Uuid,
    pub description: String,
    pub total: Decimal,
    pub payer: Payer,
    pub reason: String,
    pub automatic: bool,
}

#[derive(Debug, Serialize)]
pub struct PayerSplitView {
    pub invoice_id: Uuid,
    pub third_party: Option<ThirdParty>,
    pub lines: Vec<LineView>,
    #[serde(flatten)]
    pub totals: Split,
}

#[derive(sqlx::FromRow)]
struct ItemRow {
    id: Uuid,
    description: String,
    charge_code: String,
    category: Option<String>,
    total_price: Decimal,
    payer: Option<String>,
    payer_reason: Option<String>,
}

/// The hospital's non-payables list, or the default when it has none.
async fn rules(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
) -> Result<(Vec<Rule>, bool), AppError> {
    let saved: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings WHERE tenant_id = $1 AND category = 'billing' \
           AND key = 'non_payables' AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(
        match saved.and_then(|v| serde_json::from_value::<Vec<Rule>>(v).ok()) {
            Some(list) => (list, false),
            None => (default_rules(), true),
        },
    )
}

/// The bill's insurer or scheme (its primary, open-or-closed claim), else its corporate.
async fn third_party(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    invoice_id: Uuid,
) -> Result<Option<ThirdParty>, AppError> {
    Ok(sqlx::query_as::<_, ThirdParty>(
        "SELECT CASE WHEN c.scheme_type IS NULL OR c.scheme_type::text = 'private' THEN 'insurer' ELSE 'scheme' END AS kind, \
                concat_ws(' · ', NULLIF(c.insurance_provider, ''), NULLIF('TPA ' || c.tpa_name, 'TPA '), \
                          CASE WHEN c.scheme_type::text <> 'private' THEN upper(c.scheme_type::text) END) AS name, \
                c.id AS claim_id, c.status AS claim_status, c.co_pay_percent AS copay_percent, \
                c.deductible_amount AS deductible, c.claim_amount AS claimed_amount \
           FROM insurance_claims c \
          WHERE c.invoice_id = $1 AND c.tenant_id = $2 AND NOT c.is_secondary AND c.deleted_at IS NULL \
         UNION ALL \
         SELECT 'corporate', cc.name, NULL, NULL, NULL, NULL, NULL \
           FROM invoices i JOIN corporate_clients cc ON cc.id = i.corporate_id \
          WHERE i.id = $1 AND i.tenant_id = $2 \
         LIMIT 1",
    )
    .bind(invoice_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?)
}

pub async fn build_split(
    state: &AppState,
    claims: &Claims,
    invoice_id: Uuid,
) -> Result<PayerSplitView, AppError> {
    medbrains_authz_gate::require_access_via(
        state,
        claims,
        medbrains_authz_gate::links::INVOICE,
        invoice_id,
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let exists: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM invoices WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    exists.ok_or(AppError::NotFound)?;
    // Reversed lines and their reversals cancel out; neither is anybody's to pay.
    let items = sqlx::query_as::<_, ItemRow>(
        "SELECT ii.id, ii.description, ii.charge_code, ii.category, ii.total_price, ii.payer, ii.payer_reason \
           FROM invoice_items ii \
          WHERE ii.invoice_id = $1 AND ii.tenant_id = $2 AND ii.deleted_at IS NULL AND NOT ii.is_reversal \
            AND NOT EXISTS (SELECT 1 FROM invoice_items r WHERE r.reversal_of_id = ii.id AND r.deleted_at IS NULL) \
          ORDER BY ii.created_at LIMIT 2000",
    )
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    let (rules, _) = rules(&mut tx, claims.tenant_id).await?;
    let party = third_party(&mut tx, claims.tenant_id, invoice_id).await?;
    tx.commit().await?;

    let lines: Vec<Line> = items
        .iter()
        .map(|i| Line {
            id: i.id,
            description: i.description.clone(),
            charge_code: i.charge_code.clone(),
            category: i.category.clone(),
            total: i.total_price,
            payer: match i.payer.as_deref() {
                Some("third_party") => Some(Payer::ThirdParty),
                Some("patient") => Some(Payer::Patient),
                _ => None,
            },
            payer_reason: i.payer_reason.clone(),
        })
        .collect();
    let terms = party.as_ref().map(|p| Terms {
        copay_percent: p.copay_percent.unwrap_or_default(),
        deductible: p.deductible.unwrap_or_default(),
    });
    let totals = split(&lines, &rules, terms);
    let views = totals
        .lines
        .iter()
        .zip(&items)
        .map(|(s, i)| LineView {
            id: s.id,
            description: i.description.clone(),
            total: i.total_price,
            payer: s.payer,
            reason: s.reason.clone(),
            automatic: s.automatic,
        })
        .collect();
    Ok(PayerSplitView {
        invoice_id,
        third_party: party,
        lines: views,
        totals,
    })
}

/// `GET /api/billing/invoices/{id}/payer-split`
pub async fn get_payer_split(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PayerSplitView>, AppError> {
    require_permission(&claims, permissions::billing::invoices::VIEW)?;
    Ok(Json(build_split(&state, &claims, id).await?))
}

#[derive(Debug, Deserialize)]
pub struct AssignPayer {
    /// `None` returns the line to the automatic rule.
    pub payer: Option<Payer>,
    pub reason: Option<String>,
}

async fn audit(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    action: &str,
    entity: (&str, Uuid),
    values: &serde_json::Value,
) -> Result<(), AppError> {
    medbrains_db::audit::AuditLogger::log(
        tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action,
            entity_type: entity.0,
            entity_id: Some(entity.1),
            old_values: None,
            new_values: Some(values),
            ip_address: None,
        },
    )
    .await?;
    Ok(())
}

async fn require_open_claim(
    state: &AppState,
    claims: &Claims,
    invoice_id: Uuid,
) -> Result<Option<ThirdParty>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let party = third_party(&mut tx, claims.tenant_id, invoice_id).await?;
    tx.commit().await?;
    if let Some(status) = party.as_ref().and_then(|p| p.claim_status.as_deref())
        && CLOSED_CLAIMS.contains(&status)
    {
        return Err(AppError::Conflict(format!(
            "The claim is {}; its split can no longer change.",
            status.replace('_', " ")
        )));
    }
    Ok(party)
}

/// `PUT /api/billing/invoices/{id}/items/{iid}/payer`
pub async fn assign_item_payer(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, item_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<AssignPayer>,
) -> Result<Json<PayerSplitView>, AppError> {
    require_permission(&claims, permissions::billing::payer_split::MANAGE)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::INVOICE,
        id,
    )
    .await?;
    require_open_claim(&state, &claims, id).await?;
    let reason = body
        .reason
        .as_deref()
        .map(str::trim)
        .filter(|r| !r.is_empty());
    if body.payer.is_some() && reason.is_none_or(|r| r.len() < 3) {
        return Err(AppError::BadRequest(
            "Say why this line moves (e.g. \"policy covers it\")".to_owned(),
        ));
    }
    let payer = body.payer.map(|p| match p {
        Payer::ThirdParty => "third_party",
        Payer::Patient => "patient",
    });
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let changed = sqlx::query(
        "UPDATE invoice_items SET payer = $3, payer_reason = $4 \
          WHERE id = $1 AND invoice_id = $2 AND tenant_id = $5 AND deleted_at IS NULL",
    )
    .bind(item_id)
    .bind(id)
    .bind(payer)
    .bind(body.payer.and(reason))
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if changed == 0 {
        return Err(AppError::NotFound);
    }
    let values = serde_json::json!({ "invoice_id": id, "payer": payer, "reason": reason });
    audit(
        &mut tx,
        &claims,
        "billing.payer_split.line_assigned",
        ("invoice_items", item_id),
        &values,
    )
    .await?;
    tx.commit().await?;
    Ok(Json(build_split(&state, &claims, id).await?))
}

/// `POST /api/billing/invoices/{id}/payer-split/apply` — the insurer's share
/// becomes the claim's amount claimed.
pub async fn apply_payer_split(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PayerSplitView>, AppError> {
    require_permission(&claims, permissions::billing::payer_split::MANAGE)?;
    let party = require_open_claim(&state, &claims, id).await?;
    let Some(claim_id) = party.and_then(|p| p.claim_id) else {
        return Err(AppError::Conflict(
            "This bill has no insurance or scheme claim to write the split onto.".to_owned(),
        ));
    };
    let view = build_split(&state, &claims, id).await?;
    let t = &view.totals;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // Only the amount claimed: the claim's own trigger derives the bill
    // total, deductions and the patient's share from it and the invoice.
    sqlx::query(
        "UPDATE insurance_claims SET claim_amount = $3, updated_at = now() \
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(claim_id)
    .bind(claims.tenant_id)
    .bind(t.third_party_net)
    .execute(&mut *tx)
    .await?;
    let values = serde_json::json!({
        "invoice_id": id, "claim_amount": t.third_party_net, "patient_payable": t.patient_total,
        "copay": t.copay, "deductible": t.deductible, "non_payables": t.patient_lines,
    });
    audit(
        &mut tx,
        &claims,
        "billing.payer_split.applied",
        ("insurance_claims", claim_id),
        &values,
    )
    .await?;
    tx.commit().await?;
    Ok(Json(build_split(&state, &claims, id).await?))
}

#[derive(Debug, Serialize)]
pub struct NonPayables {
    pub rules: Vec<Rule>,
    /// True when the hospital has not set its own list yet.
    pub is_default: bool,
}

/// `GET /api/billing/non-payables` — the list in force, for the settings card.
pub async fn get_non_payables(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<NonPayables>, AppError> {
    require_permission(&claims, permissions::billing::invoices::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (rules, is_default) = rules(&mut tx, claims.tenant_id).await?;
    tx.commit().await?;
    Ok(Json(NonPayables { rules, is_default }))
}

#[derive(sqlx::FromRow)]
struct BillHead {
    invoice_number: String,
    patient_name: String,
    uhid: String,
    invoice_date: chrono::DateTime<chrono::Utc>,
}

/// The template context for the insurer's bill (`payer`) or the patient's
/// share (`Payer::Patient`) of one invoice.
pub async fn split_document_context(
    state: &AppState,
    claims: &Claims,
    invoice_id: Uuid,
    payer: Payer,
) -> Result<serde_json::Value, AppError> {
    require_permission(claims, permissions::billing::invoices::VIEW)?;
    let view = build_split(state, claims, invoice_id).await?;
    let mut conn = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let head = sqlx::query_as::<_, BillHead>(
        "SELECT i.invoice_number, concat_ws(' ', p.first_name, p.last_name) AS patient_name, p.uhid, \
                COALESCE(i.invoice_date, i.created_at) AS invoice_date \
           FROM invoices i JOIN patients p ON p.id = i.patient_id WHERE i.id = $1 AND i.tenant_id = $2",
    )
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *conn)
    .await?;
    let lines: Vec<&LineView> = view.lines.iter().filter(|l| l.payer == payer).collect();
    let t = &view.totals;
    Ok(serde_json::json!({
        "split": {
            "invoice_number": head.invoice_number, "patient_name": head.patient_name, "uhid": head.uhid,
            "date": head.invoice_date.format("%d %b %Y").to_string(),
            "payer_name": view.third_party.as_ref().map(|p| p.name.clone()),
            "lines": lines,
            "gross": t.third_party_gross, "copay": t.copay, "deductible": t.deductible,
            "net": t.third_party_net, "patient_lines": t.patient_lines, "patient_total": t.patient_total,
        }
    }))
}
