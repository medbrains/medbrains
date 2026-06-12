//! Built-in document templates + context builders.
//!
//! Each template is Tera HTML extending the shared `base.html`
//! letterhead layout (medbrains-print). Context builders reuse the
//! existing print-data fetchers so dynamic values stay single-sourced.

use axum::{Extension, Json, extract::Path, extract::State};
use medbrains_print::codes;
use medbrains_print::paper::{MarginsMm, Paper};
use uuid::Uuid;

use crate::{error::AppError, middleware::auth::Claims, state::AppState};

pub(crate) struct SystemTemplate {
    pub code: &'static str,
    pub title: &'static str,
    pub module_code: &'static str,
    pub source_table: &'static str,
    pub number_prefix: &'static str,
    pub paper: Paper,
    pub margins: MarginsMm,
    pub html: &'static str,
}

pub(crate) const SYSTEM_TEMPLATES: &[SystemTemplate] = &[
    SystemTemplate {
        code: "invoice_gst",
        title: "GST Invoice",
        module_code: "billing",
        source_table: "invoices",
        number_prefix: "BIL-GST",
        paper: Paper::A4,
        margins: MarginsMm {
            top: 12.0,
            right: 12.0,
            bottom: 14.0,
            left: 12.0,
        },
        html: INVOICE_GST_HTML,
    },
    SystemTemplate {
        code: "pharmacy_label",
        title: "Dispensing Label",
        module_code: "pharmacy",
        source_table: "prescription_items",
        number_prefix: "PH-LBL",
        paper: Paper::Label50x25,
        margins: MarginsMm::zero(),
        html: PHARMACY_LABEL_HTML,
    },
];

const INVOICE_GST_HTML: &str = r#"{% extends "base.html" %}
{% block content %}
<h2 class="brand" style="margin-bottom:2px;">TAX INVOICE</h2>
<table style="margin-bottom:8px;"><tr>
  <td>
    <div><strong>Invoice:</strong> <span class="mono">{{ invoice.invoice_number }}</span></div>
    <div><strong>Date:</strong> {{ invoice.date }}</div>
    {% if invoice.hospital_gstin %}<div><strong>GSTIN:</strong> <span class="mono">{{ invoice.hospital_gstin }}</span></div>{% endif %}
  </td>
  <td class="right">
    <div><strong>Patient:</strong> {{ invoice.patient_name }}</div>
    <div><strong>UHID:</strong> <span class="mono">{{ invoice.uhid }}</span></div>
  </td>
</tr></table>
<table>
  <thead><tr>
    <th>#</th><th>Description</th><th>HSN/SAC</th>
    <th class="right">Qty</th><th class="right">Rate</th>
    <th class="right">GST %</th><th class="right">Amount</th>
  </tr></thead>
  <tbody>
  {% for item in invoice.items %}
    <tr>
      <td>{{ loop.index }}</td>
      <td>{{ item.description }}</td>
      <td class="mono">{{ item.hsn_code | default(value="9993") }}</td>
      <td class="right">{{ item.quantity }}</td>
      <td class="right">{{ item.unit_price }}</td>
      <td class="right">{{ item.tax_percent }}</td>
      <td class="right">{{ item.total_price }}</td>
    </tr>
  {% endfor %}
  </tbody>
</table>
<table style="margin-top:8px;"><tr><td></td><td style="width:38%;">
  <table>
    <tr><td>Subtotal</td><td class="right">{{ invoice.subtotal }}</td></tr>
    <tr><td>GST</td><td class="right">{{ invoice.tax_amount }}</td></tr>
    <tr><td><strong>Total</strong></td><td class="right"><strong>{{ invoice.total_amount }}</strong></td></tr>
  </table>
</td></tr></table>
<p class="muted small" style="margin-top:10px;">
  Healthcare services are exempt under GST Notification 12/2017 where applicable.
  This is a system-generated invoice.
</p>
{% endblock content %}"#;

const PHARMACY_LABEL_HTML: &str = r#"{% extends "base.html" %}
{% block extra_css %}
  html, body { font-size: 6.5pt; }
  .label { padding: 1.5mm 2mm; display: flex; gap: 1.5mm; height: 25mm; }
  .label .info { flex: 1; overflow: hidden; }
  .label .qr svg { width: 13mm; height: 13mm; }
  .drug { font-size: 8pt; font-weight: 700; }
{% endblock extra_css %}
{% block letterhead %}{% endblock letterhead %}
{% block content %}
<div class="label">
  <div class="info">
    <div class="drug">{{ label.drug_name }}</div>
    <div>{{ label.dosage }} · {{ label.frequency }} · {{ label.duration }}</div>
    {% if label.instructions %}<div class="muted">{{ label.instructions }}</div>{% endif %}
    <div style="margin-top:1mm;">{{ label.patient_name }} <span class="mono">{{ label.uhid }}</span></div>
    <div class="muted">{{ label.dispensed_date }} · {{ branding.hospital_name }}</div>
  </div>
  <div class="qr">{{ label.qr_svg | safe }}</div>
</div>
{% endblock content %}
{% block footer %}{% endblock footer %}"#;

/// Sample contexts for the template editor's live preview.
pub(crate) const SAMPLE_CONTEXTS: &[(&str, &str)] = &[
    (
        "invoice_gst",
        r#"{
          "invoice": {
            "invoice_number": "INV-000123", "date": "2026-06-12",
            "patient_name": "Sample Patient", "uhid": "ACMS-2026-00042",
            "hospital_gstin": "33AAAAA0000A1Z5",
            "subtotal": "1,500.00", "tax_amount": "0.00", "total_amount": "1,500.00",
            "items": [
              {"description": "OPD Consultation — General Medicine", "hsn_code": "9993", "quantity": 1, "unit_price": "500.00", "tax_percent": "0", "total_price": "500.00"},
              {"description": "Complete Blood Count", "hsn_code": "9993", "quantity": 1, "unit_price": "350.00", "tax_percent": "0", "total_price": "350.00"},
              {"description": "Room charges (1 day)", "hsn_code": "9993", "quantity": 1, "unit_price": "650.00", "tax_percent": "0", "total_price": "650.00"}
            ]
          },
          "document_number": "BIL-GST-20260612-0001"
        }"#,
    ),
    (
        "pharmacy_label",
        r#"{
          "label": {
            "drug_name": "Amoxicillin 500mg", "dosage": "1 cap", "frequency": "TID",
            "duration": "5 days", "instructions": "After food",
            "patient_name": "Sample Patient", "uhid": "ACMS-2026-00042",
            "dispensed_date": "2026-06-12",
            "qr_svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'><rect width='10' height='10' fill='#eee'/></svg>"
          }
        }"#,
    ),
];

/// Bind live data for a template. Returns (context, patient_id).
pub(crate) async fn build_context(
    state: &AppState,
    claims: &Claims,
    template_code: &str,
    source_id: Uuid,
) -> Result<(serde_json::Value, Option<Uuid>), AppError> {
    match template_code {
        "invoice_gst" => {
            // Reuse the existing print-data handler verbatim.
            let Json(data) = crate::routes::print_data_billing::get_gst_invoice_print_data(
                State(state.clone()),
                Extension(claims.clone()),
                Path(source_id),
            )
            .await?;
            let patient_id: Option<Uuid> = sqlx::query_scalar(
                "SELECT patient_id FROM invoices WHERE id = $1 AND tenant_id = $2",
            )
            .bind(source_id)
            .bind(claims.tenant_id)
            .fetch_optional(&state.db)
            .await?;
            Ok((serde_json::json!({ "invoice": data }), patient_id))
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
            let row: Option<LabelRow> =
                sqlx::query_as(
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

            Ok((
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
            ))
        }
        other => Err(AppError::BadRequest(format!(
            "no context builder for template '{other}'"
        ))),
    }
}
