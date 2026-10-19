//! What a consultation costs, quoted to a patient app before the hospital
//! knows the patient.
//!
//! The doctor's own consultation fee when one is set — what OPD and
//! telemedicine billing charge — else the charge master's rate under the
//! hospital's default rate plan: `TELECONSULT` for a teleconsultation,
//! `OPD-CONSULT-{department code}` for a visit (the code OPD billing uses).
//! GST is the charge master's own (healthcare services are generally exempt,
//! so usually nil); a doctor's own fee carries none, as billing charges it.
//!
//! With no fee anywhere the quote says the fee is paid at the hospital. It
//! never names ₹0 as if that were the price.

use std::collections::HashMap;

use rust_decimal::Decimal;
use serde_json::{Value, json};
use uuid::Uuid;

use super::protocol::{PAYMENT_NOT_PAID, PAYMENT_ON_FULFILMENT, PAYMENT_ON_ORDER, Service};
use crate::error::AppError;

/// The charge-master code a teleconsultation is priced under.
pub const TELECONSULT_CODE: &str = "TELECONSULT";
/// How a quote without a fee says so — the wording is ours (**inferred**:
/// UHI has no field for "priced at the counter").
pub const FEE_AT_HOSPITAL: &str = "Consultation fee payable at the hospital";

/// A fee, before tax.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Fee {
    pub amount: Decimal,
    pub tax_percent: Decimal,
}

/// Rupees with two decimals, as UHI's prices are written.
pub fn money(value: Decimal) -> String {
    let mut v = value.round_dp(2);
    v.rescale(2);
    v.to_string()
}

impl Fee {
    pub fn tax(&self) -> Decimal {
        (self.amount * self.tax_percent / Decimal::ONE_HUNDRED).round_dp(2)
    }

    pub fn total(&self) -> Decimal {
        self.amount + self.tax()
    }
}

/// The item's `price`: the fee, or the currency alone when it is set at the
/// hospital.
pub fn item_price(fee: Option<&Fee>) -> Value {
    fee.map_or_else(
        || json!({ "currency": "INR" }),
        |f| json!({ "currency": "INR", "value": money(f.total()) }),
    )
}

/// The order's `quote`: the fee and its GST as separate lines.
pub fn quote(title: &str, fee: Option<&Fee>) -> Value {
    let Some(f) = fee else {
        return json!({ "price": { "currency": "INR" }, "breakup": [{ "title": FEE_AT_HOSPITAL }] });
    };
    let mut breakup =
        vec![json!({ "title": title, "price": { "currency": "INR", "value": money(f.amount) } })];
    if f.tax() > Decimal::ZERO {
        breakup.push(
            json!({ "title": format!("GST {}%", f.tax_percent.normalize()),
            "price": { "currency": "INR", "value": money(f.tax()) } }),
        );
    }
    json!({ "price": { "currency": "INR", "value": money(f.total()) }, "breakup": breakup })
}

/// The order's `payment` before it is paid: online (`ON-ORDER`) or at the
/// hospital (`ON-FULFILLMENT`).
pub fn payment(online: bool, fee: Option<&Fee>) -> Value {
    let kind = if online {
        PAYMENT_ON_ORDER
    } else {
        PAYMENT_ON_FULFILMENT
    };
    let mut params = json!({ "currency": "INR" });
    if let Some(f) = fee {
        params["amount"] = json!(money(f.total()));
    }
    json!({ "type": kind, "status": PAYMENT_NOT_PAID, "params": params })
}

/// The charge-master code a consultation of `service` in a department falls
/// back to when the doctor has no fee of their own.
pub fn charge_code(service: Service, department_code: &str) -> String {
    if service == Service::Teleconsultation {
        TELECONSULT_CODE.to_owned()
    } else {
        format!("OPD-CONSULT-{department_code}")
    }
}

/// The doctor's fee when it is set and positive, else the charge master's.
pub fn pick(doctor_fee: Option<Decimal>, charge: Option<&Fee>) -> Option<Fee> {
    doctor_fee
        .filter(|f| *f > Decimal::ZERO)
        .map(|amount| Fee {
            amount,
            tax_percent: Decimal::ZERO,
        })
        .or_else(|| charge.copied().filter(|f| f.amount > Decimal::ZERO))
}

/// Charge-master rates for `codes`, the default rate plan applied — one query
/// for every code a search needs.
pub async fn charge_rates(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    codes: &[String],
) -> Result<HashMap<String, Fee>, AppError> {
    if codes.is_empty() {
        return Ok(HashMap::new());
    }
    let rows = sqlx::query_as::<_, (String, Decimal, Decimal)>(
        "SELECT cm.code, COALESCE(rp.override_price, cm.base_price), \
                COALESCE(rp.override_tax_percent, cm.tax_percent) \
           FROM charge_master cm \
           LEFT JOIN LATERAL ( \
                SELECT rpi.override_price, rpi.override_tax_percent FROM rate_plan_items rpi \
                  JOIN rate_plans p ON p.id = rpi.rate_plan_id AND p.tenant_id = rpi.tenant_id \
                 WHERE p.tenant_id = cm.tenant_id AND rpi.charge_code = cm.code \
                   AND p.is_active AND p.is_default \
                   AND p.deleted_at IS NULL AND rpi.deleted_at IS NULL \
                 LIMIT 1) rp ON true \
          WHERE cm.tenant_id = $1 AND cm.code = ANY($2) AND cm.is_active \
            AND cm.deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(codes)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows
        .into_iter()
        .map(|(code, amount, tax_percent)| {
            (
                code,
                Fee {
                    amount,
                    tax_percent,
                },
            )
        })
        .collect())
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::{FEE_AT_HOSPITAL, Fee, money, payment, pick, quote};
    use rust_decimal::Decimal;

    #[test]
    fn the_doctors_own_fee_beats_the_charge_master_and_zero_is_no_fee() {
        let cm = Fee {
            amount: Decimal::from(300),
            tax_percent: Decimal::from(18),
        };
        assert_eq!(
            pick(Some(Decimal::from(500)), Some(&cm)).unwrap().amount,
            Decimal::from(500)
        );
        assert_eq!(pick(Some(Decimal::ZERO), Some(&cm)), Some(cm));
        assert_eq!(pick(None, None), None);
        let free = Fee {
            amount: Decimal::ZERO,
            tax_percent: Decimal::ZERO,
        };
        assert_eq!(
            pick(None, Some(&free)),
            None,
            "₹0 is never quoted as the price"
        );
    }

    #[test]
    fn a_quote_carries_the_fee_and_its_gst_or_says_it_is_at_the_hospital() {
        let fee = Fee {
            amount: Decimal::from(500),
            tax_percent: Decimal::from(18),
        };
        let q = quote("Consultation", Some(&fee));
        assert_eq!(q["price"]["value"], "590.00");
        assert_eq!(q["breakup"][1]["title"], "GST 18%");
        let none = quote("Consultation", None);
        assert!(none["price"].get("value").is_none());
        assert_eq!(none["breakup"][0]["title"], FEE_AT_HOSPITAL);
        assert_eq!(payment(true, Some(&fee))["type"], "ON-ORDER");
        assert_eq!(payment(false, None)["type"], "ON-FULFILLMENT");
        assert_eq!(money(Decimal::from(7)), "7.00");
    }
}
