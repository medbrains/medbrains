//! Auto-billing service — transaction-scoped helpers that post charges to
//! invoices, generate invoice numbers, recalculate totals, and reverse charges.
//!
//! Extracted from `routes/billing.rs` so domain crates (lab, pharmacy, opd, ipd,
//! radiology, ot, blood_bank, diet, cssd, emergency, camp, ambulance, …) can
//! auto-charge without depending back on `medbrains-server`. These are pure DB
//! helpers over a `sqlx::Transaction` — no `AppState`, no auth, and no response
//! masking (the billing-amount field-access/masking layer stays with the billing
//! routes, which is a presentation concern).
#![allow(clippy::too_many_lines)]

use chrono::NaiveDate;
use rust_decimal::Decimal;
use serde::Deserialize;
use uuid::Uuid;

use medbrains_server_core::error::AppError;

#[derive(Debug)]
pub struct AutoChargeInput {
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub charge_code: String,
    pub source: String,
    pub source_id: Uuid,
    pub quantity: i32,
    pub description_override: Option<String>,
    pub unit_price_override: Option<Decimal>,
    pub tax_percent_override: Option<Decimal>,
}

/// NABH 27 traceability: pharmacy dispenses propagate batch + expiry
/// so a recall query can identify affected patients from the invoice
/// line. Lab, radiology, room charges, etc. don't carry this and call
/// `auto_charge` (which threads `BatchTrace::default()` internally).
#[derive(Debug, Default, Clone)]
pub struct BatchTrace {
    pub batch_number: Option<String>,
    pub expiry_date: Option<NaiveDate>,
}

#[derive(Debug)]
pub struct AutoChargeResult {
    pub invoice_id: Uuid,
    #[allow(dead_code)]
    pub item_id: Uuid,
    #[allow(dead_code)]
    pub was_new_invoice: bool,
    pub skipped_duplicate: bool,
}

#[derive(Debug, sqlx::FromRow)]
struct ResolvedPrice {
    description: String,
    unit_price: Decimal,
    tax_percent: Decimal,
}

pub async fn admission_id_for_encounter_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    encounter_id: Option<Uuid>,
) -> Result<Option<Uuid>, AppError> {
    let Some(encounter_id) = encounter_id else {
        return Ok(None);
    };

    sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM admissions WHERE tenant_id = $1 AND encounter_id = $2 LIMIT 1",
    )
    .bind(tenant_id)
    .bind(encounter_id)
    .fetch_optional(&mut **tx)
    .await
    .map_err(AppError::from)
}

pub async fn verified_admission_id_for_invoice_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    patient_id: Uuid,
    encounter_id: Option<Uuid>,
    admission_id: Option<Uuid>,
) -> Result<Option<Uuid>, AppError> {
    if let Some(admission_id) = admission_id {
        let linked_patient_id = sqlx::query_scalar::<_, Uuid>(
            "SELECT patient_id FROM admissions WHERE id = $1 AND tenant_id = $2",
        )
        .bind(admission_id)
        .bind(tenant_id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or_else(|| AppError::BadRequest("billing.error.admissionNotFound".to_owned()))?;

        if linked_patient_id != patient_id {
            return Err(AppError::BadRequest(
                "billing.error.admissionPatientMismatch".to_owned(),
            ));
        }

        if let Some(encounter_admission_id) =
            admission_id_for_encounter_in_tx(tx, tenant_id, encounter_id).await?
        {
            if encounter_admission_id != admission_id {
                return Err(AppError::BadRequest(
                    "billing.error.encounterAdmissionMismatch".to_owned(),
                ));
            }
        } else if encounter_id.is_some() {
            return Err(AppError::BadRequest(
                "billing.error.encounterAdmissionMismatch".to_owned(),
            ));
        }

        return Ok(Some(admission_id));
    }

    admission_id_for_encounter_in_tx(tx, tenant_id, encounter_id).await
}

/// Check if auto-billing is enabled for a specific module.
pub async fn is_auto_billing_enabled(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    module: &str,
) -> Result<bool, AppError> {
    let key = format!("auto_charge_{module}");
    let val = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'billing' AND key = $2",
    )
    .bind(tenant_id)
    .bind(&key)
    .fetch_optional(&mut **tx)
    .await?;

    match val {
        Some(v) => Ok(v.as_bool().unwrap_or_else(|| v.as_str() == Some("true"))),
        // Default-on: auto-billing should be the standard behaviour
        // when a clinical action (lab order completed, Rx dispensed,
        // imaging reported) emits its event. Operators can disable
        // per-module by writing `auto_charge_<module> = false` to
        // tenant_settings. This is opposite to the prior default
        // (false) which silently dropped charges and triggered the
        // "consumption report not affected after dispense" feedback.
        None => Ok(true),
    }
}

/// Resolve price from `charge_master` + `rate_plan` overrides.
async fn resolve_price(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    patient_id: &Uuid,
    charge_code: &str,
) -> Result<Option<ResolvedPrice>, AppError> {
    // Get base price from charge_master
    let base = sqlx::query_as::<_, ResolvedPrice>(
        "SELECT name AS description, base_price AS unit_price, tax_percent \
         FROM charge_master \
         WHERE tenant_id = $1 AND code = $2 AND is_active = true",
    )
    .bind(tenant_id)
    .bind(charge_code)
    .fetch_optional(&mut **tx)
    .await?;

    let Some(mut price) = base else {
        return Ok(None);
    };

    // Try rate plan override: patient_category match first, then is_default
    let patient_category = sqlx::query_scalar::<_, Option<String>>(
        "SELECT category FROM patients WHERE id = $1 AND tenant_id = $2",
    )
    .bind(patient_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .flatten();

    // Look for category-specific rate plan first
    let rate_override = if let Some(ref cat) = patient_category {
        sqlx::query_as::<_, RatePlanOverride>(
            "SELECT rpi.override_price, rpi.override_tax_percent \
             FROM rate_plan_items rpi \
             JOIN rate_plans rp ON rp.id = rpi.rate_plan_id AND rp.tenant_id = rpi.tenant_id \
             WHERE rp.tenant_id = $1 AND rpi.charge_code = $2 \
               AND rp.is_active = true AND rp.patient_category = $3 \
             LIMIT 1",
        )
        .bind(tenant_id)
        .bind(charge_code)
        .bind(cat)
        .fetch_optional(&mut **tx)
        .await?
    } else {
        None
    };

    // Fall back to default rate plan
    let rate_override = match rate_override {
        Some(r) => Some(r),
        None => {
            sqlx::query_as::<_, RatePlanOverride>(
                "SELECT rpi.override_price, rpi.override_tax_percent \
                 FROM rate_plan_items rpi \
                 JOIN rate_plans rp ON rp.id = rpi.rate_plan_id AND rp.tenant_id = rpi.tenant_id \
                 WHERE rp.tenant_id = $1 AND rpi.charge_code = $2 \
                   AND rp.is_active = true AND rp.is_default = true \
                 LIMIT 1",
            )
            .bind(tenant_id)
            .bind(charge_code)
            .fetch_optional(&mut **tx)
            .await?
        }
    };

    if let Some(ovr) = rate_override {
        price.unit_price = ovr.override_price;
        if let Some(tax) = ovr.override_tax_percent {
            price.tax_percent = tax;
        }
    }

    Ok(Some(price))
}

#[derive(Debug, sqlx::FromRow)]
struct RatePlanOverride {
    override_price: Decimal,
    override_tax_percent: Option<Decimal>,
}

/// Auto-charge: find or create a draft invoice for the encounter, or a
/// patient-only draft invoice when the source workflow is not encounter-linked.
/// Fails gracefully (returns Ok) — caller should not let billing errors block module operations.
/// Standard auto_charge — no batch traceability (lab, radiology,
/// room rent, etc.). Pharmacy uses `auto_charge_with_batch` instead.
pub async fn auto_charge(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    input: AutoChargeInput,
) -> Result<AutoChargeResult, AppError> {
    auto_charge_with_batch(tx, tenant_id, input, BatchTrace::default()).await
}

pub async fn auto_charge_with_batch(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    input: AutoChargeInput,
    batch: BatchTrace,
) -> Result<AutoChargeResult, AppError> {
    // 1. Idempotency: check if this source_id is already charged
    let existing = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM invoice_items \
         WHERE tenant_id = $1 AND source = $2::charge_source AND source_id = $3 \
         LIMIT 1",
    )
    .bind(tenant_id)
    .bind(&input.source)
    .bind(input.source_id)
    .fetch_optional(&mut **tx)
    .await?;

    if let Some(item_id) = existing {
        // Already charged — find its invoice
        let inv_id = sqlx::query_scalar::<_, Uuid>(
            "SELECT invoice_id FROM invoice_items WHERE id = $1 AND tenant_id = $2",
        )
        .bind(item_id)
        .bind(tenant_id)
        .fetch_one(&mut **tx)
        .await?;

        return Ok(AutoChargeResult {
            invoice_id: inv_id,
            item_id,
            was_new_invoice: false,
            skipped_duplicate: true,
        });
    }

    // 2. Find or create draft invoice for this encounter
    let admission_id = admission_id_for_encounter_in_tx(tx, tenant_id, input.encounter_id).await?;
    let draft_invoice = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM invoices \
         WHERE tenant_id = $1 \
           AND status = 'draft'::invoice_status \
           AND ( \
             ($2::uuid IS NOT NULL AND encounter_id = $2) \
             OR ($2::uuid IS NULL AND encounter_id IS NULL AND patient_id = $3) \
           ) \
         LIMIT 1",
    )
    .bind(tenant_id)
    .bind(input.encounter_id)
    .bind(input.patient_id)
    .fetch_optional(&mut **tx)
    .await?;

    let (invoice_id, was_new) = if let Some(id) = draft_invoice {
        if let Some(admission_id) = admission_id {
            sqlx::query(
                "UPDATE invoices SET admission_id = COALESCE(admission_id, $3) \
                 WHERE id = $1 AND tenant_id = $2",
            )
            .bind(id)
            .bind(tenant_id)
            .bind(admission_id)
            .execute(&mut **tx)
            .await?;
        }
        (id, false)
    } else {
        let inv_number = generate_invoice_number(tx, tenant_id).await?;
        let id = sqlx::query_scalar::<_, Uuid>(
            "INSERT INTO invoices \
             (tenant_id, invoice_number, patient_id, encounter_id, admission_id, status, \
              subtotal, tax_amount, discount_amount, total_amount, paid_amount, notes) \
             VALUES ($1, $2, $3, $4, $5, 'draft'::invoice_status, 0, 0, 0, 0, 0, 'Auto-generated') \
             RETURNING id",
        )
        .bind(tenant_id)
        .bind(&inv_number)
        .bind(input.patient_id)
        .bind(input.encounter_id)
        .bind(admission_id)
        .fetch_one(&mut **tx)
        .await?;
        (id, true)
    };

    // 3. Resolve price
    let (unit_price, tax_pct, description) = if let Some(price) = input.unit_price_override {
        (
            price,
            input.tax_percent_override.unwrap_or(Decimal::ZERO),
            input
                .description_override
                .unwrap_or_else(|| input.charge_code.clone()),
        )
    } else {
        match resolve_price(tx, tenant_id, &input.patient_id, &input.charge_code).await? {
            Some(resolved) => (
                resolved.unit_price,
                resolved.tax_percent,
                input.description_override.unwrap_or(resolved.description),
            ),
            None => {
                // No charge_master entry — use zero price with description
                (
                    Decimal::ZERO,
                    Decimal::ZERO,
                    input
                        .description_override
                        .unwrap_or_else(|| input.charge_code.clone()),
                )
            }
        }
    };

    let total =
        unit_price * Decimal::from(input.quantity) * (Decimal::ONE + tax_pct / Decimal::from(100));

    // 4. Insert item — including batch_number + expiry_date when the
    // source carries them (pharmacy dispense). Migration 0109.
    let item_id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO invoice_items \
         (tenant_id, invoice_id, charge_code, description, source, source_id, \
          quantity, unit_price, tax_percent, total_price, batch_number, expiry_date) \
         VALUES ($1, $2, $3, $4, $5::charge_source, $6, $7, $8, $9, $10, $11, $12) \
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(invoice_id)
    .bind(&input.charge_code)
    .bind(&description)
    .bind(&input.source)
    .bind(input.source_id)
    .bind(input.quantity)
    .bind(unit_price)
    .bind(tax_pct)
    .bind(total)
    .bind(&batch.batch_number)
    .bind(batch.expiry_date)
    .fetch_one(&mut **tx)
    .await?;

    // 5. Recalculate invoice totals
    recalculate_invoice_totals(tx, invoice_id, *tenant_id).await?;

    Ok(AutoChargeResult {
        invoice_id,
        item_id,
        was_new_invoice: was_new,
        skipped_duplicate: false,
    })
}
// ══════════════════════════════════════════════════════════
//  Invoice number generation
// ══════════════════════════════════════════════════════════

#[derive(Debug, sqlx::FromRow)]
pub struct SeqResult {
    pub current_val: i64,
    pub prefix: String,
    pub pad_width: i32,
}

pub async fn generate_invoice_number(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
) -> Result<String, AppError> {
    let seq = sqlx::query_as::<_, SeqResult>(
        "UPDATE sequences SET current_val = current_val + 1 \
         WHERE tenant_id = $1 AND seq_type = 'INVOICE' \
         RETURNING current_val, prefix, pad_width",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;

    let seq =
        seq.ok_or_else(|| AppError::Internal("INVOICE sequence not configured".to_owned()))?;

    let pad = usize::try_from(seq.pad_width).unwrap_or(6);
    Ok(format!("{}{:0>pad$}", seq.prefix, seq.current_val))
}

// ══════════════════════════════════════════════════════════
//  Recalculate invoice totals
// ══════════════════════════════════════════════════════════

pub async fn recalculate_invoice_totals(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    invoice_id: Uuid,
    tenant_id: Uuid,
) -> Result<(), AppError> {
    sqlx::query!(
        "UPDATE invoices SET \
         subtotal = COALESCE((SELECT SUM(unit_price * quantity) FROM invoice_items \
           WHERE invoice_id = $1 AND tenant_id = $2), 0), \
         tax_amount = COALESCE((SELECT SUM(unit_price * quantity * tax_percent / 100) \
           FROM invoice_items WHERE invoice_id = $1 AND tenant_id = $2), 0), \
         total_amount = COALESCE((SELECT SUM(total_price) FROM invoice_items \
           WHERE invoice_id = $1 AND tenant_id = $2), 0), \
         updated_at = now() \
         WHERE id = $1 AND tenant_id = $2",
        invoice_id,
        tenant_id,
    )
    .execute(&mut **tx)
    .await?;

    Ok(())
}

pub async fn reverse_auto_charge_for_source(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    source: &str,
    source_id: Uuid,
    reversed_by: Uuid,
    reason: &str,
) -> Result<Option<Uuid>, AppError> {
    reverse_auto_charge_quantity_for_source(
        tx,
        tenant_id,
        source,
        source_id,
        None,
        reversed_by,
        reason,
        source,
        source_id,
    )
    .await
}

#[allow(clippy::too_many_arguments)]
pub async fn reverse_auto_charge_quantity_for_source(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    source: &str,
    source_id: Uuid,
    reversal_quantity: Option<i32>,
    reversed_by: Uuid,
    reason: &str,
    reversal_source_module: &str,
    reversal_source_id: Uuid,
) -> Result<Option<Uuid>, AppError> {
    let original_id = sqlx::query_scalar!(
        "SELECT id
         FROM invoice_items
         WHERE tenant_id = $1
           AND source::text = $2
           AND source_id = $3
           AND reversal_of_id IS NULL
           AND total_price > 0
         ORDER BY created_at
         LIMIT 1",
        tenant_id,
        source,
        source_id,
    )
    .fetch_optional(&mut **tx)
    .await?;

    match original_id {
        Some(item_id) => {
            reverse_invoice_item_by_id_in_tx(
                tx,
                tenant_id,
                item_id,
                reversal_quantity,
                reversed_by,
                reason,
                reversal_source_module,
                reversal_source_id,
            )
            .await
        }
        None => Ok(None),
    }
}

#[allow(clippy::too_many_arguments)]
pub async fn reverse_invoice_item_by_id_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    item_id: Uuid,
    reversal_quantity: Option<i32>,
    reversed_by: Uuid,
    reason: &str,
    reversal_source_module: &str,
    reversal_source_id: Uuid,
) -> Result<Option<Uuid>, AppError> {
    let original = sqlx::query!(
        r#"SELECT id, invoice_id, charge_code, description, source::text AS "source!",
                  source_id, quantity, unit_price, tax_percent, total_price,
                  gst_rate, gst_type::text AS "gst_type!", cgst_amount, sgst_amount,
                  igst_amount, hsn_sac_code, ordering_doctor_id, department_id,
                  pharmacy_order_id, pharmacy_batch_id, batch_number, expiry_date,
                  source_module
           FROM invoice_items
           WHERE id = $1
             AND tenant_id = $2
             AND reversal_of_id IS NULL
             AND total_price > 0
           LIMIT 1"#,
        item_id,
        tenant_id,
    )
    .fetch_optional(&mut **tx)
    .await?;

    let Some(original) = original else {
        return Ok(None);
    };

    if let Some(existing) = sqlx::query!(
        "SELECT id
         FROM invoice_items
         WHERE tenant_id = $1
           AND reversal_source_module = $2
           AND reversal_source_id = $3
         LIMIT 1",
        tenant_id,
        reversal_source_module,
        reversal_source_id,
    )
    .fetch_optional(&mut **tx)
    .await?
    {
        recalculate_invoice_totals(tx, original.invoice_id, *tenant_id).await?;
        return Ok(Some(existing.id));
    }

    let already_reversed = sqlx::query_scalar!(
        "SELECT COALESCE(SUM(ABS(quantity)), 0)::BIGINT
         FROM invoice_items
         WHERE tenant_id = $1 AND reversal_of_id = $2",
        tenant_id,
        original.id,
    )
    .fetch_one(&mut **tx)
    .await?
    .unwrap_or(0);
    let already_reversed = i32::try_from(already_reversed).unwrap_or(i32::MAX);
    let remaining_quantity = original.quantity.saturating_sub(already_reversed);
    let requested_quantity = reversal_quantity.unwrap_or(remaining_quantity);
    let quantity_to_reverse = requested_quantity.min(remaining_quantity).max(0);

    if quantity_to_reverse == 0 {
        return Ok(None);
    }

    let original_quantity = Decimal::from(original.quantity);
    let reversal_quantity_decimal = Decimal::from(quantity_to_reverse);
    let gross_multiplier = Decimal::ONE + original.tax_percent / Decimal::from(100);
    let reversal_total = original.unit_price * reversal_quantity_decimal * gross_multiplier;
    let reversal_ratio = reversal_quantity_decimal / original_quantity;
    let reversal_cgst = original.cgst_amount.unwrap_or(Decimal::ZERO) * reversal_ratio;
    let reversal_sgst = original.sgst_amount.unwrap_or(Decimal::ZERO) * reversal_ratio;
    let reversal_igst = original.igst_amount.unwrap_or(Decimal::ZERO) * reversal_ratio;
    let negative_quantity = -quantity_to_reverse;
    let negative_total = -reversal_total;
    let negative_cgst = -reversal_cgst;
    let negative_sgst = -reversal_sgst;
    let negative_igst = -reversal_igst;

    sqlx::query!(
        "UPDATE invoice_items
         SET reversed_at = COALESCE(reversed_at, now()),
             reversed_by = COALESCE(reversed_by, $3),
             reversal_reason = COALESCE(reversal_reason, $4)
         WHERE id = $1 AND tenant_id = $2",
        original.id,
        tenant_id,
        reversed_by,
        reason,
    )
    .execute(&mut **tx)
    .await?;

    let reversal_id = sqlx::query_scalar!(
        r#"INSERT INTO invoice_items
           (tenant_id, invoice_id, charge_code, description, source, source_id,
            quantity, unit_price, tax_percent, total_price, gst_rate, gst_type,
            cgst_amount, sgst_amount, igst_amount, hsn_sac_code, ordering_doctor_id,
            department_id, pharmacy_order_id, pharmacy_batch_id, batch_number, expiry_date,
            source_module, reversal_of_id, is_reversal, reversed_at, reversed_by,
            reversal_reason, reversal_source_module, reversal_source_id)
           VALUES ($1, $2, $3, $4, $5::text::charge_source, $6,
                   $7, $8, $9, $10, $11, $12::text::gst_type,
                   $13, $14, $15, $16, $17,
                   $18, $19, $20, $21, $22,
                   COALESCE($23, 'manual'), $24, true, now(), $25,
                   $26, $27, $28)
           RETURNING id"#,
        tenant_id,
        original.invoice_id,
        original.charge_code,
        format!(
            "Reversal - {} x {}",
            original.description, quantity_to_reverse
        ),
        original.source,
        original.source_id,
        negative_quantity,
        original.unit_price,
        original.tax_percent,
        negative_total,
        original.gst_rate,
        original.gst_type,
        negative_cgst,
        negative_sgst,
        negative_igst,
        original.hsn_sac_code,
        original.ordering_doctor_id,
        original.department_id,
        original.pharmacy_order_id,
        original.pharmacy_batch_id,
        original.batch_number,
        original.expiry_date,
        original.source_module,
        original.id,
        reversed_by,
        reason,
        reversal_source_module,
        reversal_source_id,
    )
    .fetch_one(&mut **tx)
    .await?;

    recalculate_invoice_totals(tx, original.invoice_id, *tenant_id).await?;
    Ok(Some(reversal_id))
}
#[derive(Debug)]
pub struct ServiceChargeInput<'a> {
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub encounter_id: Uuid,
    pub charge_code: &'a str,
    pub quantity: i32,
    pub source_module: &'a str,
    pub source_entity_id: Uuid,
    pub requested_by: Uuid,
}

/// Create a service charge on behalf of another module.
/// Resolves price from charge_master + rate_plan, checks auto-concession rules,
/// creates invoice_item, and logs any concession applied.
/// Fails gracefully — callers should not let billing failures block module ops.
pub async fn create_service_charge(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    inp: ServiceChargeInput<'_>,
) -> Result<AutoChargeResult, AppError> {
    let charge_input = AutoChargeInput {
        patient_id: inp.patient_id,
        encounter_id: Some(inp.encounter_id),
        charge_code: inp.charge_code.to_owned(),
        source: inp.source_module.to_owned(),
        source_id: inp.source_entity_id,
        quantity: inp.quantity,
        description_override: None,
        unit_price_override: None,
        tax_percent_override: None,
    };

    let result = auto_charge(tx, &inp.tenant_id, charge_input).await?;

    // Check auto-concession rules from tenant_settings
    if !result.skipped_duplicate {
        let concession_inp = ConcessionCheckInput {
            tenant_id: inp.tenant_id,
            patient_id: inp.patient_id,
            invoice_id: result.invoice_id,
            invoice_item_id: result.item_id,
            source_module: inp.source_module,
            source_entity_id: inp.source_entity_id,
            requested_by: inp.requested_by,
        };
        apply_auto_concessions(tx, concession_inp).await.ok(); // best-effort — don't fail the charge if concession logic fails
    }

    Ok(result)
}

#[derive(Debug)]
struct ConcessionCheckInput<'a> {
    tenant_id: Uuid,
    patient_id: Uuid,
    invoice_id: Uuid,
    invoice_item_id: Uuid,
    source_module: &'a str,
    source_entity_id: Uuid,
    requested_by: Uuid,
}

/// Apply auto-concession rules defined in tenant_settings.
async fn apply_auto_concessions(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    inp: ConcessionCheckInput<'_>,
) -> Result<(), AppError> {
    let tenant_id = &inp.tenant_id;
    let patient_id = &inp.patient_id;
    let invoice_id = inp.invoice_id;
    let invoice_item_id = inp.invoice_item_id;
    let source_module = inp.source_module;
    let source_entity_id = &inp.source_entity_id;
    let requested_by = &inp.requested_by;
    // Read auto-concession rules from tenant_settings
    let rules_json = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'billing' AND key = 'auto_concession_rules'",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;

    let Some(rules_val) = rules_json else {
        return Ok(());
    };

    let rules: Vec<AutoConcessionRule> = serde_json::from_value(rules_val).unwrap_or_default();

    if rules.is_empty() {
        return Ok(());
    }

    // Get patient category for rule matching
    let patient_category = sqlx::query_scalar::<_, Option<String>>(
        "SELECT category FROM patients WHERE id = $1 AND tenant_id = $2",
    )
    .bind(patient_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .flatten();

    // Get the item amount
    let item = sqlx::query_as::<_, ItemAmount>(
        "SELECT total_price FROM invoice_items WHERE id = $1 AND tenant_id = $2",
    )
    .bind(invoice_item_id)
    .bind(tenant_id)
    .fetch_one(&mut **tx)
    .await?;

    for rule in &rules {
        if !rule.is_active {
            continue;
        }
        // Match by module
        if let Some(ref modules) = rule.applicable_modules {
            if !modules.iter().any(|m| m == source_module) {
                continue;
            }
        }
        // Match by patient category
        if let Some(ref cats) = rule.patient_categories {
            let cat_str = patient_category.as_deref().unwrap_or("");
            if !cats.iter().any(|c| c == cat_str) {
                continue;
            }
        }
        // Apply the concession
        let concession_amount = item.total_price * rule.percent / Decimal::from(100);
        let final_amount = item.total_price - concession_amount;

        sqlx::query(
            "INSERT INTO billing_concessions \
             (tenant_id, invoice_id, invoice_item_id, patient_id, concession_type, \
              original_amount, concession_percent, concession_amount, final_amount, \
              reason, status, requested_by, approved_by, approved_at, auto_rule, \
              source_module, source_entity_id) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, \
                     'auto_applied'::concession_status, $11, $11, now(), $12, $13, $14)",
        )
        .bind(tenant_id)
        .bind(invoice_id)
        .bind(invoice_item_id)
        .bind(patient_id)
        .bind(&rule.concession_type)
        .bind(item.total_price)
        .bind(rule.percent)
        .bind(concession_amount)
        .bind(final_amount)
        .bind(&rule.reason)
        .bind(requested_by)
        .bind(&rule.name)
        .bind(source_module)
        .bind(source_entity_id)
        .execute(&mut **tx)
        .await?;

        // Update item price to reflect concession
        sqlx::query(
            "UPDATE invoice_items SET total_price = $2 \
             WHERE id = $1 AND tenant_id = $3",
        )
        .bind(invoice_item_id)
        .bind(final_amount)
        .bind(tenant_id)
        .execute(&mut **tx)
        .await?;

        recalculate_invoice_totals(tx, invoice_id, *tenant_id).await?;

        // Only apply first matching rule
        break;
    }

    Ok(())
}
#[derive(Debug, sqlx::FromRow)]
struct ItemAmount {
    total_price: Decimal,
}

#[derive(Debug, Deserialize)]
struct AutoConcessionRule {
    name: String,
    concession_type: String,
    percent: Decimal,
    reason: Option<String>,
    is_active: bool,
    applicable_modules: Option<Vec<String>>,
    patient_categories: Option<Vec<String>>,
}
