//! Accrual: turn a bill into ledger rows. Convergent and append-only — for
//! every (line x doctor x role) the engine works out what should have been
//! earned by now under the agreement's basis, compares it with what the ledger
//! already holds, and appends the difference. A payment, a refund, a cancelled
//! line or an insurer settlement each just call `sync_invoice` again; the
//! difference comes out positive (earned) or negative (a reversal row). The
//! rate, base and share are frozen on the first row, so a later rate change
//! never re-prices a line already earned.

use std::collections::{HashMap, HashSet};

use chrono::NaiveDate;
use medbrains_server_core::error::AppError;
use rust_decimal::Decimal;
use uuid::Uuid;

use crate::accrual_sql::{BILL_SQL, HELD_SQL, LINES_SQL, Rows, insert_rows};
use crate::agreements::{self, Agreement};
use crate::engine::{self, BillState, Line};
use crate::rate_cards::{self, RuleRow};
use crate::{Tx, settings};

#[derive(Debug, sqlx::FromRow)]
struct Bill {
    status: String,
    total_amount: Decimal,
    paid_amount: Decimal,
    discount_amount: Decimal,
    claim_amount: Option<Decimal>,
    settled_amount: Option<Decimal>,
    claim_status: Option<String>,
    scheme: Option<String>,
    visit_kind: Option<String>,
}

impl Bill {
    fn payer_class(&self) -> String {
        match (self.claim_status.as_ref(), self.scheme.as_deref()) {
            (None, _) => "cash".to_owned(),
            (Some(_), Some("private") | None) => "tpa".to_owned(),
            (Some(_), Some(s)) => s.to_owned(),
        }
    }

    fn state(&self) -> BillState<'_> {
        let claim = self.claim_status.as_deref().map(|st| {
            let settled = matches!(st, "settled" | "partially_settled")
                .then(|| self.settled_amount.unwrap_or_default());
            (self.claim_amount.unwrap_or(self.total_amount), settled)
        });
        BillState {
            status: &self.status,
            total: self.total_amount,
            paid: self.paid_amount,
            claim,
        }
    }
}

#[derive(Debug, sqlx::FromRow)]
struct BillLine {
    id: Uuid,
    charge_code: String,
    category: String,
    source: String,
    department_id: Option<Uuid>,
    performing_doctor_id: Option<Uuid>,
    quantity: i32,
    gross: Decimal,
    discount: Decimal,
    reversed: Decimal,
    service_date: NaiveDate,
    anesthetist_id: Option<Uuid>,
    assistants: Vec<Uuid>,
}

impl BillLine {
    /// Everyone credited on this line, with their role.
    fn performers(&self) -> Vec<(Uuid, &'static str)> {
        let mut seen = HashSet::new();
        let mut out = Vec::new();
        let roles = self
            .performing_doctor_id
            .map(|d| (d, "primary"))
            .into_iter()
            .chain(self.anesthetist_id.map(|d| (d, "anaesthetist")))
            .chain(self.assistants.iter().map(|d| (*d, "assistant")));
        for (doctor, role) in roles {
            if seen.insert(doctor) {
                out.push((doctor, role));
            }
        }
        out
    }
}

/// What the ledger already holds for one (line, doctor, role).
#[derive(Debug, sqlx::FromRow)]
struct Held {
    invoice_item_id: Uuid,
    doctor_id: Uuid,
    role: String,
    rule_id: Option<Uuid>,
    agreement_id: Option<Uuid>,
    line_amount: Decimal,
    base_amount: Decimal,
    share_amount: Decimal,
    earned: Decimal,
    last_id: Uuid,
}

/// Everything one sync needs, loaded once per bill (no per-line queries).
struct Context {
    settings: settings::Settings,
    agreements: Vec<Agreement>,
    versions: Vec<rate_cards::Version>,
    rules: HashMap<Uuid, Vec<engine::Rule>>,
}

impl Context {
    async fn load(tx: &mut Tx<'_>, tenant_id: Uuid, doctors: &[Uuid]) -> Result<Self, AppError> {
        let settings = settings::load(tx, tenant_id).await?;
        let agreements = agreements::for_doctors(tx, doctors).await?;
        let plans: Vec<Uuid> = agreements
            .iter()
            .map(|a| a.plan_id)
            .collect::<HashSet<_>>()
            .into_iter()
            .collect();
        let versions = rate_cards::versions_of(tx, &plans).await?;
        let ids: Vec<Uuid> = versions.iter().map(|v| v.id).collect();
        let mut rules: HashMap<Uuid, Vec<engine::Rule>> = HashMap::new();
        for r in rate_cards::rules_for(tx, &ids).await? {
            rules
                .entry(r.plan_id)
                .or_default()
                .push(RuleRow::to_rule(&r));
        }
        Ok(Self {
            settings,
            agreements,
            versions,
            rules,
        })
    }

    fn excluded(&self, line: &BillLine) -> bool {
        self.settings
            .excluded_categories
            .iter()
            .any(|c| *c == line.category || *c == line.source)
    }
}

/// Fill in performers known only after the charge was raised: a lab result
/// verified, a radiology report signed, a procedure marked performed.
async fn backfill_performers(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    invoice_id: Uuid,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE invoice_items SET performing_doctor_id = invoice_item_performer(source::text, source_id) \
          WHERE invoice_id = $1 AND tenant_id = $2 AND performing_doctor_id IS NULL \
            AND source_id IS NOT NULL AND reversal_of_id IS NULL \
            AND invoice_item_performer(source::text, source_id) IS NOT NULL",
    )
    .bind(invoice_id)
    .bind(tenant_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Bring the ledger for one bill up to date. Returns the rows appended.
pub async fn sync_invoice(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    invoice_id: Uuid,
) -> Result<usize, AppError> {
    backfill_performers(tx, tenant_id, invoice_id).await?;
    let Some(bill) = sqlx::query_as::<_, Bill>(BILL_SQL)
        .bind(invoice_id)
        .bind(tenant_id)
        .fetch_optional(&mut **tx)
        .await?
    else {
        return Ok(0);
    };
    let lines = sqlx::query_as::<_, BillLine>(LINES_SQL)
        .bind(invoice_id)
        .bind(tenant_id)
        .fetch_all(&mut **tx)
        .await?;
    let doctors: Vec<Uuid> = lines
        .iter()
        .flat_map(|l| l.performers().into_iter().map(|p| p.0))
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();
    if doctors.is_empty() {
        return Ok(0);
    }
    let held: HashMap<(Uuid, Uuid, String), Held> = sqlx::query_as::<_, Held>(HELD_SQL)
        .bind(tenant_id)
        .bind(invoice_id)
        .fetch_all(&mut **tx)
        .await?
        .into_iter()
        .map(|h| ((h.invoice_item_id, h.doctor_id, h.role.clone()), h))
        .collect();
    let ctx = Context::load(tx, tenant_id, &doctors).await?;
    let (rows, used_plans) = plan_rows(&ctx, &bill, &lines, &held);
    let count = rows.amount.len();
    if count > 0 {
        insert_rows(tx, tenant_id, invoice_id, &bill.payer_class(), &rows).await?;
        sqlx::query(
            "UPDATE incentive_plans SET frozen_at = now() WHERE id = ANY($1) AND frozen_at IS NULL",
        )
        .bind(&used_plans)
        .execute(&mut **tx)
        .await?;
    }
    Ok(count)
}

/// Run `sync_invoice` inside a savepoint so a fault in the payout engine
/// never refuses a patient's payment. The fault is logged, not hidden: the
/// next sync of the bill — at the latest when a statement is prepared —
/// appends what was missed, because the ledger converges.
pub async fn sync_after_money(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    invoice_id: Uuid,
) -> Result<(), AppError> {
    sqlx::query("SAVEPOINT doctor_payout_sync")
        .execute(&mut **tx)
        .await?;
    match sync_invoice(tx, tenant_id, invoice_id).await {
        Ok(_) => {
            sqlx::query("RELEASE SAVEPOINT doctor_payout_sync")
                .execute(&mut **tx)
                .await?;
        }
        Err(err) => {
            tracing::error!(%invoice_id, error = %err, "doctor payout accrual failed; the next sync will catch up");
            sqlx::query("ROLLBACK TO SAVEPOINT doctor_payout_sync")
                .execute(&mut **tx)
                .await?;
        }
    }
    Ok(())
}

fn plan_rows(
    ctx: &Context,
    bill: &Bill,
    lines: &[BillLine],
    held: &HashMap<(Uuid, Uuid, String), Held>,
) -> (Rows, Vec<Uuid>) {
    let mut rows = Rows::default();
    let mut used = HashSet::new();
    let line_discounts: Decimal = lines.iter().map(|l| l.discount).sum();
    let subtotal: Decimal = lines.iter().map(|l| l.gross).sum();
    let extra = (bill.discount_amount - line_discounts).max(Decimal::ZERO);
    let state = bill.state();
    let payer = bill.payer_class();
    for line in lines {
        let share_of_extra = if subtotal > Decimal::ZERO {
            extra * line.gross / subtotal
        } else {
            Decimal::ZERO
        };
        let discount = line.discount + share_of_extra;
        let effective = (line.gross + line.reversed).max(Decimal::ZERO);
        for (doctor, role) in line.performers() {
            let snap = held.get(&(line.id, doctor, role.to_owned()));
            let agreement = snap
                .and_then(|h| h.agreement_id)
                .and_then(|id| ctx.agreements.iter().find(|a| a.id == id))
                .or_else(|| {
                    ctx.agreements
                        .iter()
                        .find(|a| a.doctor_id == doctor && a.covers(line.service_date))
                });
            let Some(agreement) = agreement.filter(|a| a.engagement_type != "salaried") else {
                continue;
            };
            let terms = agreement.terms(&ctx.settings);
            let priced = match snap {
                Some(h) => Some((h.share_amount, h.base_amount, h.line_amount, h.rule_id)),
                None => {
                    let ask = Pricing {
                        line,
                        payer: &payer,
                        visit_kind: bill.visit_kind.as_deref(),
                        role,
                        discount,
                        effective,
                    };
                    price(ctx, agreement, &ask, &terms, &mut used)
                }
            };
            let Some((share, base, line_amount, rule_id)) = priced else {
                continue;
            };
            let scale = if line_amount > Decimal::ZERO {
                (effective / line_amount).min(Decimal::ONE)
            } else {
                Decimal::ONE
            };
            let target = engine::earned_now(share * scale, effective - discount, &state, &terms);
            let earned = snap.map_or(Decimal::ZERO, |h| h.earned);
            let delta = engine::money(target - earned);
            if delta == Decimal::ZERO {
                continue;
            }
            let reversing = delta < Decimal::ZERO;
            rows.doctor.push(doctor);
            rows.agreement.push(agreement.id);
            rows.item.push(line.id);
            rows.role.push(role.to_owned());
            rows.rule.push(rule_id);
            rows.event.push(if reversing {
                "reversal".to_owned()
            } else {
                terms.basis.as_str().to_owned()
            });
            rows.basis.push(terms.basis.as_str().to_owned());
            rows.day.push(line.service_date);
            rows.line_amount.push(line_amount);
            rows.base.push(base);
            rows.share.push(share);
            rows.fraction.push(if share > Decimal::ZERO {
                (target / share).round_dp(6)
            } else {
                Decimal::ZERO
            });
            rows.amount.push(delta);
            rows.reversal_of.push(if reversing {
                snap.map(|h| h.last_id)
            } else {
                None
            });
            rows.reason.push(
                reversing.then(|| "Bill refunded, cancelled, reduced or disallowed".to_owned()),
            );
        }
    }
    (rows, used.into_iter().collect())
}

/// One line seen from one doctor in one role, to be priced.
#[derive(Debug, Clone, Copy)]
struct Pricing<'a> {
    line: &'a BillLine,
    payer: &'a str,
    visit_kind: Option<&'a str>,
    role: &'a str,
    discount: Decimal,
    effective: Decimal,
}

/// Price a line for the first time: the rate-card version in force on the
/// day, the most specific rule, the share. `None` when nothing applies.
fn price(
    ctx: &Context,
    agreement: &Agreement,
    ask: &Pricing<'_>,
    terms: &engine::Terms,
    used: &mut HashSet<Uuid>,
) -> Option<(Decimal, Decimal, Decimal, Option<Uuid>)> {
    let Pricing {
        line,
        payer,
        visit_kind,
        role,
        discount,
        effective,
    } = *ask;
    let version = rate_cards::version_on(&ctx.versions, agreement.plan_id, line.service_date)?;
    let rules = ctx.rules.get(&version)?;
    let view = Line {
        charge_code: &line.charge_code,
        category: &line.category,
        department_id: line.department_id,
        payer_class: payer,
        visit_kind,
        role,
        quantity: line.quantity,
        gross: effective,
        discount,
    };
    let rule = engine::pick_rule(rules, &view)?;
    // Implants, consumables and pharmacy are never shared unless a rule names
    // the exact charge code.
    if ctx.excluded(line) && rule.charge_code.is_none() {
        return None;
    }
    used.insert(version);
    let share = engine::compute_share(rule, &view, terms);
    Some((share.amount, share.base, effective, Some(rule.id)))
}
