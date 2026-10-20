//! `GET /api/billing/patients/{id}/dues` — what a patient owes, by bill,
//! by group and by department, and what this caller may collect of it.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use medbrains_core::permissions;
use medbrains_server_core::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_any_permission},
    state::AppState,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::bills::{DepartmentCharge, OpenBill, department_charges, open_bills};
use super::lanes::{ANY_COLLECT, is_lane, may_collect_bill, may_collect_lane};

#[derive(Debug, Deserialize)]
pub struct DuesQuery {
    /// The desk's lane: adds a "this department" figure.
    pub lane: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DueBill {
    #[serde(flatten)]
    pub bill: OpenBill,
    pub can_collect: bool,
}

#[derive(Debug, Serialize)]
pub struct DueGroup {
    /// `None` for the bills in no group.
    pub bill_group_id: Option<Uuid>,
    pub bill_count: usize,
    pub balance: Decimal,
}

#[derive(Debug, Serialize)]
pub struct LaneDue {
    pub lane: String,
    pub due: Decimal,
    pub can_collect: bool,
}

#[derive(Debug, Serialize)]
pub struct Dues {
    pub patient_id: Uuid,
    /// Amounts are hidden from this caller (field access); every figure is 0.
    pub amounts_hidden: bool,
    pub total_due: Decimal,
    pub collectable_due: Decimal,
    pub this_department: Option<LaneDue>,
    pub bills: Vec<DueBill>,
    pub groups: Vec<DueGroup>,
    pub by_department: Vec<DepartmentCharge>,
}

fn group_bills(bills: &[DueBill]) -> Vec<DueGroup> {
    let mut groups: Vec<DueGroup> = Vec::new();
    for b in bills {
        match groups
            .iter_mut()
            .find(|g| g.bill_group_id == b.bill.bill_group_id)
        {
            Some(g) => {
                g.bill_count += 1;
                g.balance += b.bill.balance;
            }
            None => groups.push(DueGroup {
                bill_group_id: b.bill.bill_group_id,
                bill_count: 1,
                balance: b.bill.balance,
            }),
        }
    }
    groups
}

fn lane_due(claims: &Claims, bills: &[DueBill], lane: &str) -> LaneDue {
    LaneDue {
        lane: lane.to_owned(),
        due: bills
            .iter()
            .filter(|b| b.bill.lanes.iter().any(|l| l == lane))
            .map(|b| b.bill.balance)
            .sum(),
        can_collect: may_collect_lane(claims, lane),
    }
}

fn scrub(mut dues: Dues) -> Dues {
    dues.total_due = Decimal::ZERO;
    dues.collectable_due = Decimal::ZERO;
    if let Some(d) = dues.this_department.as_mut() {
        d.due = Decimal::ZERO;
    }
    for b in &mut dues.bills {
        b.bill.total_amount = Decimal::ZERO;
        b.bill.paid_amount = Decimal::ZERO;
        b.bill.balance = Decimal::ZERO;
    }
    for g in &mut dues.groups {
        g.balance = Decimal::ZERO;
    }
    for c in &mut dues.by_department {
        c.charged = Decimal::ZERO;
    }
    dues.amounts_hidden = true;
    dues
}

pub async fn patient_dues(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
    Query(query): Query<DuesQuery>,
) -> Result<Json<Dues>, AppError> {
    let mut allowed = ANY_COLLECT.to_vec();
    allowed.push(permissions::billing::invoices::VIEW);
    require_any_permission(&claims, &allowed)?;
    if let Some(lane) = query.lane.as_deref().filter(|l| !is_lane(l)) {
        return Err(AppError::BadRequest(format!(
            "'{lane}' is not a billing lane"
        )));
    }
    medbrains_authz_gate::require_patient_billing_access(&state, &claims, patient_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let open = open_bills(&mut tx, claims.tenant_id, patient_id).await?;
    let ids: Vec<Uuid> = open.iter().map(|b| b.invoice_id).collect();
    let by_department = department_charges(&mut tx, claims.tenant_id, &ids).await?;
    tx.commit().await?;

    let bills: Vec<DueBill> = open
        .into_iter()
        .map(|bill| DueBill {
            can_collect: may_collect_bill(&claims, &bill.lanes),
            bill,
        })
        .collect();
    let dues = Dues {
        patient_id,
        amounts_hidden: false,
        total_due: bills.iter().map(|b| b.bill.balance).sum(),
        collectable_due: bills
            .iter()
            .filter(|b| b.can_collect)
            .map(|b| b.bill.balance)
            .sum(),
        this_department: query.lane.as_deref().map(|l| lane_due(&claims, &bills, l)),
        groups: group_bills(&bills),
        bills,
        by_department,
    };
    let restricted = crate::resolve_billing_restricted_fields(&state, &claims).await?;
    Ok(Json(if crate::should_scrub_billing_amount(&restricted) {
        scrub(dues)
    } else {
        dues
    }))
}
