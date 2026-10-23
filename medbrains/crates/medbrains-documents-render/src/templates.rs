//! Context builders: bind live data for each built-in template by
//! reusing the existing print-data handlers verbatim — dynamic values
//! stay single-sourced with the browser-print paths. Template HTML and
//! sample contexts live in `medbrains_print::templates`.

use axum::{Extension, Json, extract::Path, extract::Query, extract::State};
use medbrains_print::codes;
use uuid::Uuid;

pub(crate) use medbrains_print::templates::{SYSTEM_TEMPLATES, SystemTemplate};

use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState};

async fn patient_id_for(
    state: &AppState,
    tenant_id: Uuid,
    table: &str,
    id: Uuid,
) -> Result<Option<Uuid>, AppError> {
    let mut conn = medbrains_db::pool::tenant_conn(&state.db, &tenant_id).await?;
    let sql = match table {
        "invoices" => "SELECT patient_id FROM invoices WHERE id = $1 AND tenant_id = $2",
        "payments" => {
            "SELECT i.patient_id FROM payments p JOIN invoices i ON i.id = p.invoice_id \
             WHERE p.id = $1 AND p.tenant_id = $2"
        }
        "encounters" => "SELECT patient_id FROM encounters WHERE id = $1 AND tenant_id = $2",
        "admissions" => "SELECT patient_id FROM admissions WHERE id = $1 AND tenant_id = $2",
        "er_visits" => "SELECT patient_id FROM er_visits WHERE id = $1 AND tenant_id = $2",
        "lab_orders" => "SELECT patient_id FROM lab_orders WHERE id = $1 AND tenant_id = $2",
        "ophtho_exams" => "SELECT patient_id FROM ophtho_exams WHERE id = $1 AND tenant_id = $2",
        "queue_tokens" => "SELECT patient_id FROM queue_tokens WHERE id = $1 AND tenant_id = $2",
        "insurance_claims" => {
            "SELECT patient_id FROM insurance_claims WHERE id = $1 AND tenant_id = $2"
        }
        _ => return Ok(None),
    };
    Ok(sqlx::query_scalar(sql)
        .bind(id)
        .bind(tenant_id)
        .fetch_optional(&mut *conn)
        .await?)
}

/// Bind live data for a template. Returns (context, `patient_id`).
#[allow(clippy::too_many_lines)]
pub(crate) async fn build_context(
    state: &AppState,
    claims: &Claims,
    template_code: &str,
    source_id: Uuid,
) -> Result<(serde_json::Value, Option<Uuid>), AppError> {
    let mut conn = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let context = match template_code {
        "invoice_gst" => {
            let Json(data) = medbrains_print_data::gst_invoice::get_gst_invoice_print_data(
                State(state.clone()),
                Extension(claims.clone()),
                Path(source_id),
            )
            .await?;
            // The bill's two links print as QR codes: pay the balance by
            // UPI, and check the bill is genuine.
            let qr = |link: &Option<String>| -> Result<Option<String>, AppError> {
                link.as_deref()
                    .map(|l| {
                        codes::qr_svg(l).map_err(|e| AppError::Internal(format!("bill qr: {e}")))
                    })
                    .transpose()
            };
            let upi_qr_svg = qr(&data.upi_link)?;
            let verify_qr_svg = qr(&data.verify_url)?;
            let mut invoice =
                serde_json::to_value(&data).map_err(|e| AppError::Internal(e.to_string()))?;
            if let Some(obj) = invoice.as_object_mut() {
                obj.insert("upi_qr_svg".to_owned(), serde_json::json!(upi_qr_svg));
                obj.insert("verify_qr_svg".to_owned(), serde_json::json!(verify_qr_svg));
            }
            serde_json::json!({ "invoice": invoice })
        }
        "payment_receipt" => {
            let Json(data) = medbrains_print_data::billing::get_receipt_print_data(
                State(state.clone()),
                Extension(claims.clone()),
                Path(source_id),
                Query(medbrains_print_data::billing::ReceiptPrintQuery {
                    reprint_reason: None,
                }),
            )
            .await?;
            serde_json::json!({ "receipt": data })
        }
        "prescription" => {
            let Json(data) = medbrains_print_data::general::get_prescription_print_data(
                State(state.clone()),
                Extension(claims.clone()),
                Path(source_id),
            )
            .await?;
            serde_json::json!({ "rx": data })
        }
        "discharge_summary" => {
            let Json(data) = medbrains_print_data::clinical::get_discharge_print_data(
                State(state.clone()),
                Extension(claims.clone()),
                Path(source_id),
            )
            .await?;
            serde_json::json!({ "discharge": data })
        }
        "er_discharge_summary" => {
            let Json(data) = medbrains_print_data::clinical::get_er_discharge_print_data(
                State(state.clone()),
                Extension(claims.clone()),
                Path(source_id),
            )
            .await?;
            serde_json::json!({ "discharge": data })
        }
        "ipd_consolidated_bill" => {
            let Json(data) =
                medbrains_print_data::billing::get_admission_consolidated_bill_print_data(
                    State(state.clone()),
                    Extension(claims.clone()),
                    Path(source_id),
                )
                .await?;
            serde_json::json!({ "bill": data })
        }
        "no_dues_certificate" => {
            let Json(data) = medbrains_print_data::billing::get_no_dues_certificate_print_data(
                State(state.clone()),
                Extension(claims.clone()),
                Path(source_id),
            )
            .await?;
            serde_json::json!({ "cert": data })
        }
        "lab_report" => {
            // The template is the full NABL report; the short print-data
            // shape lacks its header fields and failed every render.
            let Json(data) = medbrains_print_data::clinical::get_lab_report_full_print_data(
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
            .fetch_optional(&mut *conn)
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
            let Json(data) = medbrains_print_data::clinical::get_wristband_print_data(
                State(state.clone()),
                Extension(claims.clone()),
                Path(source_id),
                Query(medbrains_print_data::clinical::WristbandPrintQuery {
                    reprint_reason: None,
                }),
            )
            .await?;
            // The data already carries the UHID barcode and QR (BCMA reads them).
            let band =
                serde_json::to_value(&data).map_err(|e| AppError::Internal(e.to_string()))?;
            serde_json::json!({ "band": band })
        }
        "queue_token_slip" => {
            let Json(data) = medbrains_print_data::clinical::get_token_slip_print_data(
                State(state.clone()),
                Extension(claims.clone()),
                Path(source_id),
            )
            .await?;
            // The handler hands back the QR *payload*; the slip needs the
            // drawn code, exactly as the wristband does.
            let qr_svg = codes::qr_svg(&data.qr_code_data)
                .map_err(|e| AppError::Internal(format!("token slip qr: {e}")))?;
            let mut token =
                serde_json::to_value(&data).map_err(|e| AppError::Internal(e.to_string()))?;
            if let Some(obj) = token.as_object_mut() {
                obj.insert("qr_svg".to_owned(), serde_json::json!(qr_svg));
            }
            serde_json::json!({ "token": token })
        }
        "insurance_cashless_claim" => {
            let Json(data) = medbrains_print_data::billing::get_cashless_claim_print_data(
                State(state.clone()),
                Extension(claims.clone()),
                Path(source_id),
            )
            .await?;
            serde_json::json!({ "claim": data })
        }
        "payer_split_insurer" | "payer_split_patient" => {
            let payer = if template_code == "payer_split_insurer" {
                medbrains_billing::payer_split::Payer::ThirdParty
            } else {
                medbrains_billing::payer_split::Payer::Patient
            };
            medbrains_billing::payer_split_api::split_document_context(
                state, claims, source_id, payer,
            )
            .await?
        }
        "spectacle_prescription" => {
            medbrains_specialty::ophtho_print::spectacle_rx_context(state, claims, source_id)
                .await?
        }
        "clinical_notes" => {
            medbrains_clinical_notes::print::case_sheet_context(state, claims, source_id)
                .await?
                .0
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

#[cfg(test)]
mod render_tests {
    use medbrains_core::print_data::{
        DischargeSummaryPrintData, LabParameter, LabReportFullPrintData,
    };

    /// Render a built-in template with `entity` bound under `key`, as the
    /// render path binds it.
    fn render(code: &str, key: &str, entity: serde_json::Value) -> Result<String, String> {
        let template = super::SYSTEM_TEMPLATES
            .iter()
            .find(|t| t.code == code)
            .ok_or_else(|| format!("{code} is not registered"))?;
        let mut context = serde_json::json!({
            "branding": { "hospital_name": "Alagappa Hospital" },
        });
        context[key] = entity;
        medbrains_print::engine::render_html(template.html, &context)
            .map_err(|e| super::super::error_chain(&e))
    }

    /// A released report as `get_lab_report_full_print_data` returns it for
    /// a test with no department: every optional field empty, the section
    /// null. The template must print it, not fail on the nulls.
    #[test]
    fn a_lab_report_renders_from_the_data_its_handler_returns() {
        let data = LabReportFullPrintData {
            patient_name: "R Lakshmi".to_owned(),
            uhid: "UH-1".to_owned(),
            age_display: "42y".to_owned(),
            gender: "female".to_owned(),
            sample_id: String::new(),
            accession_number: String::new(),
            order_date: "19-10-2026".to_owned(),
            collection_date: None,
            report_date: "19-10-2026 10:00".to_owned(),
            referring_doctor: None,
            department: None,
            ward_name: None,
            bed_number: None,
            test_name: "Haemoglobin".to_owned(),
            test_code: None,
            loinc_code: None,
            specimen_type: None,
            report_status: None,
            parameters: vec![LabParameter {
                parameter_name: "Haemoglobin".to_owned(),
                result_value: "10.2".to_owned(),
                unit: None,
                reference_range: None,
                is_abnormal: true,
                is_critical: false,
                critical_flag: None,
                method: None,
                previous_value: None,
                delta_percent: None,
                is_delta_flagged: false,
                sample_type: None,
                section: None,
            }],
            interpretation: None,
            comments: None,
            pathologist_name: String::new(),
            pathologist_registration_number: None,
            pathologist_signature_url: None,
            technician_name: None,
            verified_at: None,
            nabl_accredited: false,
            nabl_certificate_number: None,
            nabl_logo_url: None,
            barcode_data: String::new(),
            hospital_name: "Alagappa Hospital".to_owned(),
            hospital_logo_url: None,
            signatures: Vec::new(),
            amendments: Vec::new(),
        };
        let entity = serde_json::to_value(&data).unwrap_or_default();
        let html = render("lab_report", "lab", entity).unwrap_or_else(|e| e);
        assert!(html.contains("10.2"), "the result prints: {html}");
        assert!(
            html.contains("INVESTIGATIONS"),
            "a null section files under the default"
        );
    }

    /// The discharge summary carries the structured summary, not only the
    /// legacy free text — a payer reads the final diagnosis off it.
    #[test]
    fn the_discharge_summary_prints_the_structured_summary() {
        let data = DischargeSummaryPrintData {
            patient_name: "R Lakshmi".to_owned(),
            uhid: "UH-1".to_owned(),
            admission_number: None,
            age: None,
            gender: "female".to_owned(),
            admission_date: "15-Oct-2026".to_owned(),
            discharge_date: None,
            department: None,
            doctor_name: None,
            bed_number: None,
            ward_name: None,
            discharge_type: None,
            discharge_summary: None,
            diagnosis: None,
            final_diagnosis: Some("Acute appendicitis".to_owned()),
            course_in_hospital: Some("Laparoscopic appendicectomy".to_owned()),
            treatment_given: None,
            procedures_performed: Some("Appendicectomy".to_owned()),
            investigation_summary: None,
            condition_at_discharge: Some("Stable".to_owned()),
            follow_up_instructions: None,
            signatures: Vec::new(),
        };
        let entity = serde_json::to_value(&data).unwrap_or_default();
        let html = render("discharge_summary", "discharge", entity).unwrap_or_else(|e| e);
        for text in [
            "Acute appendicitis",
            "Laparoscopic appendicectomy",
            "Appendicectomy",
            "Stable",
        ] {
            assert!(html.contains(text), "{text} is on the summary: {html}");
        }
    }
}
