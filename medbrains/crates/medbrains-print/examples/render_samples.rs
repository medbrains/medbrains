//! Render the built-in sample documents against a live Gotenberg —
//! the manual verification harness for template work.
//!
//! Usage: docker compose up -d gotenberg, then
//!   cargo run -p medbrains-print --example render_samples
//! PDFs land in /tmp/medbrains-docs/.

use medbrains_print::engine::render_html;
use medbrains_print::gotenberg::GotenbergClient;
use medbrains_print::paper::{MarginsMm, Paper};

const INVOICE_TEMPLATE: &str = r#"{% extends "base.html" %}
{% block content %}
<h2 class="brand">TAX INVOICE</h2>
<table style="margin-bottom:8px;"><tr>
  <td><div><strong>Invoice:</strong> <span class="mono">{{ invoice.invoice_number }}</span></div>
      <div><strong>Date:</strong> {{ invoice.date }}</div></td>
  <td class="right"><div><strong>Patient:</strong> {{ invoice.patient_name }}</div>
      <div><strong>UHID:</strong> <span class="mono">{{ invoice.uhid }}</span></div></td>
</tr></table>
<table>
  <thead><tr><th>#</th><th>Description</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Amount</th></tr></thead>
  <tbody>
  {% for item in invoice.items %}
    <tr><td>{{ loop.index }}</td><td>{{ item.description }}</td>
        <td class="right">{{ item.quantity }}</td><td class="right">{{ item.unit_price }}</td>
        <td class="right">{{ item.total_price }}</td></tr>
  {% endfor %}
  </tbody>
</table>
<table style="margin-top:8px;"><tr><td></td><td style="width:38%;">
  <table><tr><td><strong>Total</strong></td><td class="right"><strong>{{ invoice.total_amount }}</strong></td></tr></table>
</td></tr></table>
{% endblock content %}"#;

const LABEL_TEMPLATE: &str = r#"{% extends "base.html" %}
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
    <div class="muted">{{ label.instructions }}</div>
    <div style="margin-top:1mm;">{{ label.patient_name }} <span class="mono">{{ label.uhid }}</span></div>
  </div>
  <div class="qr">{{ label.qr_svg | safe }}</div>
</div>
{% endblock content %}
{% block footer %}{% endblock footer %}"#;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let url =
        std::env::var("GOTENBERG_URL").unwrap_or_else(|_| "http://127.0.0.1:3005".to_owned());
    let client = GotenbergClient::new(&url, reqwest::Client::new());
    std::fs::create_dir_all("/tmp/medbrains-docs")?;

    let branding = serde_json::json!({
        "hospital_name": "Alagappa Medical College & Hospital",
        "address": "College Road, Karaikudi, Tamil Nadu 630003",
        "phone": "+91 4565 223344",
        "registration_no": "TN/MC/2026/0042",
    });

    // ── GST invoice, A4 ──
    let invoice_ctx = serde_json::json!({
        "branding": branding,
        "watermark": "none",
        "document_number": "BIL-GST-20260612-0001",
        "generated_at": "2026-06-12 10:30 UTC",
        "invoice": {
            "invoice_number": "INV-000123",
            "date": "2026-06-12",
            "patient_name": "R. Lakshmi",
            "uhid": "ACMS-2026-00042",
            "total_amount": "1,500.00",
            "items": [
                {"description": "OPD Consultation — General Medicine", "quantity": 1, "unit_price": "500.00", "total_price": "500.00"},
                {"description": "Complete Blood Count", "quantity": 1, "unit_price": "350.00", "total_price": "350.00"},
                {"description": "Room charges (1 day)", "quantity": 1, "unit_price": "650.00", "total_price": "650.00"},
            ],
        },
    });
    let html = render_html(INVOICE_TEMPLATE, &invoice_ctx)?;
    let pdf = client
        .html_to_pdf(&html, Paper::A4, MarginsMm::default())
        .await?;
    std::fs::write("/tmp/medbrains-docs/invoice_gst.pdf", &pdf)?;
    println!("invoice_gst.pdf  {} bytes", pdf.len());

    // ── Pharmacy label, 50×25 mm with QR ──
    let qr = medbrains_print::codes::qr_svg("mb:rxitem:8e7c2a1f-demo")?;
    let label_ctx = serde_json::json!({
        "branding": { "hospital_name": "Alagappa MCH" },
        "label": {
            "drug_name": "Amoxicillin 500mg",
            "dosage": "1 cap", "frequency": "TID", "duration": "5 days",
            "instructions": "After food",
            "patient_name": "R. Lakshmi", "uhid": "ACMS-2026-00042",
            "qr_svg": qr,
        },
    });
    let html = render_html(LABEL_TEMPLATE, &label_ctx)?;
    let pdf = client
        .html_to_pdf(&html, Paper::Label50x25, MarginsMm::zero())
        .await?;
    std::fs::write("/tmp/medbrains-docs/pharmacy_label.pdf", &pdf)?;
    println!("pharmacy_label.pdf  {} bytes", pdf.len());

    Ok(())
}
