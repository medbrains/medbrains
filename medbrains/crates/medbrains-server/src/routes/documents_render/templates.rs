//! Context builders: bind live data for each built-in template by
//! reusing the existing print-data handlers verbatim — dynamic values
//! stay single-sourced with the browser-print paths. Template HTML and
//! sample contexts live in `medbrains_print::templates`.

use axum::{Extension, Json, extract::Path, extract::Query, extract::State};
use medbrains_print::codes;
use uuid::Uuid;

pub(crate) use medbrains_print::templates::{SYSTEM_TEMPLATES, SystemTemplate};

use crate::{error::AppError, middleware::auth::Claims, state::AppState};

async fn patient_id_for(
    state: &AppState,
    tenant_id: Uuid,
    table: &str,
    id: Uuid,
) -> Result<Option<Uuid>, AppError> {
    let sql = match table {
        "invoices" => "SELECT patient_id FROM invoices WHERE id = $1 AND tenant_id = $2",
        "payments" => {
            "SELECT i.patient_id FROM payments p JOIN invoices i ON i.id = p.invoice_id \
             WHERE p.id = $1 AND p.tenant_id = $2"
        }
        "encounters" => "SELECT patient_id FROM encounters WHERE id = $1 AND tenant_id = $2",
        "admissions" => "SELECT patient_id FROM admissions WHERE id = $1 AND tenant_id = $2",
        "lab_orders" => "SELECT patient_id FROM lab_orders WHERE id = $1 AND tenant_id = $2",
        "insurance_claims" => {
            "SELECT patient_id FROM insurance_claims WHERE id = $1 AND tenant_id = $2"
        }
        _ => return Ok(None),
    };
    Ok(sqlx::query_scalar(sql)
        .bind(id)
        .bind(tenant_id)
        .fetch_optional(&state.db)
        .await?)
}

/// Bind live data for a template. Returns (context, patient_id).
#[allow(clippy::too_many_lines)]
pub(crate) async fn build_context(
    state: &AppState,
    claims: &Claims,
    template_code: &str,
    source_id: Uuid,
) -> Result<(serde_json::Value, Option<Uuid>), AppError> {
    let context = match template_code {
        "invoice_gst" => {
            let Json(data) = crate::routes::print_data_billing::get_gst_invoice_print_data(
                State(state.clone()),
                Extension(claims.clone()),
                Path(source_id),
            )
            .await?;
            serde_json::json!({ "invoice": data })
        }
        "payment_receipt" => {
            let Json(data) = crate::routes::print_data_billing::get_receipt_print_data(
                State(state.clone()),
                Extension(claims.clone()),
                Path(source_id),
                Query(crate::routes::print_data_billing::ReceiptPrintQuery {
                    reprint_reason: None,
                }),
            )
            .await?;
            serde_json::json!({ "receipt": data })
        }
        "prescription" => {
            let Json(data) = crate::routes::print_data::get_prescription_print_data(
                State(state.clone()),
                Extension(claims.clone()),
                Path(source_id),
            )
            .await?;
            serde_json::json!({ "rx": data })
        }
        "discharge_summary" => {
            let Json(data) = crate::routes::print_data_clinical::get_discharge_print_data(
                State(state.clone()),
                Extension(claims.clone()),
                Path(source_id),
            )
            .await?;
            serde_json::json!({ "discharge": data })
        }
        "ipd_consolidated_bill" => {
            let Json(data) =
                crate::routes::print_data_billing::get_admission_consolidated_bill_print_data(
                    State(state.clone()),
                    Extension(claims.clone()),
                    Path(source_id),
                )
                .await?;
            serde_json::json!({ "bill": data })
        }
        "lab_report" => {
            let Json(data) = crate::routes::print_data::get_lab_report_print_data(
                State(state.clone()),
                Extension(claims.clone()),
                Path(source_id),
            )
            .await?;
            serde_json::json!({ "lab": data })
        }
        "pharmacy_label" => {
            #[derive(sqlx::FromRow)]
            struct LabelRow {
                drug_name: String,
                dosage: String,
                frequency: String,
                duration: String,
                instructions: Option<String>,
                patient_name: String,
                uhid: String,
                patient_id: Uuid,
            }
            let row: Option<LabelRow> = sqlx::query_as(
                "SELECT pi.drug_name, pi.dosage, pi.frequency, pi.duration, \
                        pi.instructions, \
                        COALESCE(p.first_name || ' ' || p.last_name, p.first_name) AS patient_name, \
                        p.uhid, p.id AS patient_id \
                 FROM prescription_items pi \
                 JOIN prescriptions pr ON pr.id = pi.prescription_id \
                 JOIN patients p ON p.id = pr.patient_id \
                 WHERE pi.id = $1 AND pi.tenant_id = $2",
            )
            .bind(source_id)
            .bind(claims.tenant_id)
            .fetch_optional(&state.db)
            .await?;
            let Some(label) = row else {
                return Err(AppError::NotFound);
            };
            let qr_svg = codes::qr_svg(&format!("mb:rxitem:{source_id}"))
                .map_err(|e| AppError::Internal(format!("label qr: {e}")))?;
            return Ok((
                serde_json::json!({
                    "label": {
                        "drug_name": label.drug_name,
                        "dosage": label.dosage,
                        "frequency": label.frequency,
                        "duration": label.duration,
                        "instructions": label.instructions,
                        "patient_name": label.patient_name,
                        "uhid": label.uhid,
                        "dispensed_date": chrono::Utc::now().format("%Y-%m-%d").to_string(),
                        "qr_svg": qr_svg,
                    }
                }),
                Some(label.patient_id),
            ));
        }
        "patient_wristband" => {
            let Json(data) = crate::routes::print_data_clinical::get_wristband_print_data(
                State(state.clone()),
                Extension(claims.clone()),
                Path(source_id),
                Query(crate::routes::print_data_clinical::WristbandPrintQuery {
                    reprint_reason: None,
                }),
            )
            .await?;
            let barcode_svg = codes::code128_svg(&data.uhid, 40)
                .map_err(|e| AppError::Internal(format!("wristband barcode: {e}")))?;
            let qr_svg = codes::qr_svg(&format!("mb:admission:{source_id}"))
                .map_err(|e| AppError::Internal(format!("wristband qr: {e}")))?;
            let mut band =
                serde_json::to_value(&data).map_err(|e| AppError::Internal(e.to_string()))?;
            if let Some(obj) = band.as_object_mut() {
                obj.insert("barcode_svg".to_owned(), serde_json::json!(barcode_svg));
                obj.insert("qr_svg".to_owned(), serde_json::json!(qr_svg));
            }
            serde_json::json!({ "band": band })
        }
        "insurance_cashless_claim" => {
            let Json(data) = crate::routes::print_data_billing::get_cashless_claim_print_data(
                State(state.clone()),
                Extension(claims.clone()),
                Path(source_id),
            )
            .await?;
            serde_json::json!({ "claim": data })
        }
        other => {
            return Err(AppError::BadRequest(format!(
                "no context builder for template '{other}'"
            )));
        }
    };

    let template = medbrains_print::templates::find_template(template_code)
        .ok_or_else(|| AppError::BadRequest(format!("unknown template '{template_code}'")))?;
    let patient_id =
        patient_id_for(state, claims.tenant_id, template.source_table, source_id).await?;
    Ok((context, patient_id))
}
