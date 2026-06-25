//! Built-in document templates: pure presentation (Tera HTML extending
//! `base.html`) plus a sample context per template for previews and the
//! render harness. Live data binding lives in the server's context
//! builders — field names here match the `*PrintData` structs verbatim.

use crate::paper::{MarginsMm, Paper};

#[derive(Debug)]
pub struct SystemTemplate {
    pub code: &'static str,
    pub title: &'static str,
    pub module_code: &'static str,
    pub source_table: &'static str,
    pub number_prefix: &'static str,
    pub paper: Paper,
    pub margins: MarginsMm,
    pub html: &'static str,
    pub sample_context: &'static str,
}

const A4_MARGINS: MarginsMm = MarginsMm {
    top: 12.0,
    right: 12.0,
    bottom: 14.0,
    left: 12.0,
};

pub const SYSTEM_TEMPLATES: &[SystemTemplate] = &[
    SystemTemplate {
        code: "invoice_gst",
        title: "GST Invoice",
        module_code: "billing",
        source_table: "invoices",
        number_prefix: "BIL-GST",
        paper: Paper::A4,
        margins: A4_MARGINS,
        html: INVOICE_GST_HTML,
        sample_context: INVOICE_GST_SAMPLE,
    },
    SystemTemplate {
        code: "payment_receipt",
        title: "Payment Receipt",
        module_code: "billing",
        source_table: "payments",
        number_prefix: "BIL-RCT",
        paper: Paper::A5,
        margins: A4_MARGINS,
        html: RECEIPT_HTML,
        sample_context: RECEIPT_SAMPLE,
    },
    SystemTemplate {
        code: "prescription",
        title: "Prescription",
        module_code: "opd",
        source_table: "encounters",
        number_prefix: "OPD-RX",
        paper: Paper::A4,
        margins: A4_MARGINS,
        html: PRESCRIPTION_HTML,
        sample_context: PRESCRIPTION_SAMPLE,
    },
    SystemTemplate {
        code: "discharge_summary",
        title: "Discharge Summary",
        module_code: "ipd",
        source_table: "admissions",
        number_prefix: "IPD-DSC",
        paper: Paper::A4,
        margins: A4_MARGINS,
        html: DISCHARGE_HTML,
        sample_context: DISCHARGE_SAMPLE,
    },
    SystemTemplate {
        code: "er_discharge_summary",
        title: "ER Discharge Summary",
        module_code: "emergency",
        source_table: "er_visits",
        number_prefix: "ER-DSC",
        paper: Paper::A4,
        margins: A4_MARGINS,
        html: ER_DISCHARGE_HTML,
        sample_context: ER_DISCHARGE_SAMPLE,
    },
    SystemTemplate {
        code: "ipd_consolidated_bill",
        title: "Consolidated Discharge Bill",
        module_code: "ipd",
        source_table: "admissions",
        number_prefix: "IPD-BILL",
        paper: Paper::A4,
        margins: A4_MARGINS,
        html: IPD_CONSOLIDATED_BILL_HTML,
        sample_context: IPD_CONSOLIDATED_BILL_SAMPLE,
    },
    SystemTemplate {
        code: "no_dues_certificate",
        title: "No-Dues Certificate",
        module_code: "ipd",
        source_table: "admissions",
        number_prefix: "IPD-NOC",
        paper: Paper::A4,
        margins: A4_MARGINS,
        html: NO_DUES_HTML,
        sample_context: NO_DUES_SAMPLE,
    },
    SystemTemplate {
        code: "lab_report",
        title: "Laboratory Report",
        module_code: "lab",
        source_table: "lab_orders",
        number_prefix: "LAB-RPT",
        paper: Paper::A4,
        margins: A4_MARGINS,
        html: LAB_REPORT_HTML,
        sample_context: LAB_REPORT_SAMPLE,
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
        sample_context: PHARMACY_LABEL_SAMPLE,
    },
    SystemTemplate {
        code: "patient_wristband",
        title: "Patient Wristband",
        module_code: "ipd",
        source_table: "admissions",
        number_prefix: "IPD-WB",
        paper: Paper::Wristband25x280,
        margins: MarginsMm::zero(),
        html: WRISTBAND_HTML,
        sample_context: WRISTBAND_SAMPLE,
    },
    SystemTemplate {
        code: "insurance_cashless_claim",
        title: "Cashless Claim Summary",
        module_code: "insurance",
        source_table: "insurance_claims",
        number_prefix: "INS-CLM",
        paper: Paper::A4,
        margins: A4_MARGINS,
        html: CASHLESS_CLAIM_HTML,
        sample_context: CASHLESS_CLAIM_SAMPLE,
    },
];

#[must_use]
pub fn find_template(code: &str) -> Option<&'static SystemTemplate> {
    SYSTEM_TEMPLATES.iter().find(|t| t.code == code)
}

// ── Billing ─────────────────────────────────────────────────

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

const INVOICE_GST_SAMPLE: &str = r#"{
  "invoice": {
    "invoice_number": "INV-000123", "date": "2026-06-12",
    "patient_name": "R. Lakshmi", "uhid": "ACMS-2026-00042",
    "hospital_gstin": "33AAAAA0000A1Z5",
    "subtotal": "1,500.00", "tax_amount": "0.00", "total_amount": "1,500.00",
    "items": [
      {"description": "OPD Consultation — General Medicine", "hsn_code": "9993", "quantity": 1, "unit_price": "500.00", "tax_percent": "0", "total_price": "500.00"},
      {"description": "Complete Blood Count", "hsn_code": "9993", "quantity": 1, "unit_price": "350.00", "tax_percent": "0", "total_price": "350.00"},
      {"description": "Room charges (1 day)", "hsn_code": "9993", "quantity": 1, "unit_price": "650.00", "tax_percent": "0", "total_price": "650.00"}
    ]
  },
  "document_number": "BIL-GST-20260612-0001"
}"#;

const RECEIPT_HTML: &str = r#"{% extends "base.html" %}
{% block content %}
<h2 class="brand">PAYMENT RECEIPT</h2>
<table style="margin-top:6px;">
  <tr><td style="width:40%;"><strong>Receipt No.</strong></td><td class="mono">{{ receipt.receipt_number | default(value=receipt.document_number) }}</td></tr>
  <tr><td><strong>Date</strong></td><td>{{ receipt.paid_at }}</td></tr>
  <tr><td><strong>Patient</strong></td><td>{{ receipt.patient_name }} <span class="mono">({{ receipt.uhid }})</span></td></tr>
  <tr><td><strong>Against Invoice</strong></td><td class="mono">{{ receipt.invoice_number }}</td></tr>
  <tr><td><strong>Payment Mode</strong></td><td>{{ receipt.payment_mode }}</td></tr>
  {% if receipt.reference_number %}<tr><td><strong>Reference</strong></td><td class="mono">{{ receipt.reference_number }}</td></tr>{% endif %}
  <tr><td><strong>Amount Received</strong></td><td style="font-size:13pt;"><strong>₹ {{ receipt.amount }}</strong></td></tr>
  {% if receipt.received_by %}<tr><td><strong>Received By</strong></td><td>{{ receipt.received_by }}</td></tr>{% endif %}
</table>
<p class="muted small" style="margin-top:10px;">Subject to realisation of instrument. System-generated receipt.</p>
{% endblock content %}"#;

const RECEIPT_SAMPLE: &str = r#"{
  "receipt": {
    "document_number": "BIL-RCT-20260612-0001", "receipt_number": "RCT-00891",
    "patient_name": "R. Lakshmi", "uhid": "ACMS-2026-00042",
    "invoice_number": "INV-000123", "amount": "1,500.00",
    "payment_mode": "UPI", "reference_number": "UPI/512345678901",
    "received_by": "Cashier Desk 1", "paid_at": "2026-06-12 10:42"
  },
  "document_number": "BIL-RCT-20260612-0001"
}"#;

// ── Clinical ────────────────────────────────────────────────

const PRESCRIPTION_HTML: &str = r#"{% extends "base.html" %}
{% block content %}
<table style="margin-bottom:6px;"><tr>
  <td>
    <div><strong>{{ rx.patient_name }}</strong> <span class="mono">({{ rx.uhid }})</span></div>
    <div class="muted">{{ rx.age | default(value="") }} {{ rx.gender }} · {{ rx.phone }}</div>
  </td>
  <td class="right">
    <div>{{ rx.date }}</div>
    <div class="muted">{{ rx.doctor_name }}{% if rx.department %} · {{ rx.department }}{% endif %}</div>
  </td>
</tr></table>
{% if rx.diagnosis %}<div style="margin-bottom:6px;"><strong>Diagnosis:</strong> {{ rx.diagnosis }}</div>{% endif %}
<div style="font-size:18pt;" class="brand">℞</div>
<table>
  <thead><tr><th>#</th><th>Medication</th><th>Dose</th><th>Route</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead>
  <tbody>
  {% for med in rx.medications %}
    <tr>
      <td>{{ loop.index }}</td>
      <td><strong>{{ med.drug_name }}</strong></td>
      <td>{{ med.dosage }}</td>
      <td>{{ med.route | default(value="PO") }}</td>
      <td>{{ med.frequency }}</td>
      <td>{{ med.duration }}</td>
      <td>{{ med.instructions | default(value="") }}</td>
    </tr>
  {% endfor %}
  </tbody>
</table>
{% if rx.advice %}<p style="margin-top:8px;"><strong>Advice:</strong> {{ rx.advice }}</p>{% endif %}
{% if rx.follow_up %}<p><strong>Follow-up:</strong> {{ rx.follow_up }}</p>{% endif %}
{% endblock content %}"#;

const PRESCRIPTION_SAMPLE: &str = r#"{
  "rx": {
    "patient_name": "R. Lakshmi", "uhid": "ACMS-2026-00042",
    "age": "42y", "gender": "F", "phone": "+91 98400 12345",
    "doctor_name": "Dr. S. Ravi", "department": "General Medicine",
    "diagnosis": "Acute pharyngitis (J02.9)", "date": "2026-06-12",
    "medications": [
      {"drug_name": "Amoxicillin 500mg", "dosage": "1 cap", "route": "PO", "frequency": "TID", "duration": "5 days", "instructions": "After food"},
      {"drug_name": "Paracetamol 650mg", "dosage": "1 tab", "route": "PO", "frequency": "SOS", "duration": "3 days", "instructions": "If fever > 100°F"}
    ],
    "advice": "Warm saline gargles. Adequate hydration.",
    "follow_up": "Review after 5 days or earlier if symptoms worsen"
  },
  "document_number": "OPD-RX-20260612-0001"
}"#;

const DISCHARGE_HTML: &str = r#"{% extends "base.html" %}
{% block content %}
<h2 class="brand">DISCHARGE SUMMARY</h2>
<table style="margin:6px 0;">
  <tr>
    <td><strong>Patient:</strong> {{ discharge.patient_name }} <span class="mono">({{ discharge.uhid }})</span></td>
    <td class="right">{{ discharge.age | default(value="") }} {{ discharge.gender }}</td>
  </tr>
  <tr>
    <td><strong>Admitted:</strong> {{ discharge.admission_date }}</td>
    <td class="right"><strong>Discharged:</strong> {{ discharge.discharge_date | default(value="—") }}</td>
  </tr>
  <tr>
    <td>{% if discharge.ward_name %}<strong>Ward:</strong> {{ discharge.ward_name }}{% endif %}
        {% if discharge.bed_number %} · Bed {{ discharge.bed_number }}{% endif %}</td>
    <td class="right">{% if discharge.doctor_name %}<strong>Consultant:</strong> {{ discharge.doctor_name }}{% endif %}</td>
  </tr>
  {% if discharge.discharge_type %}<tr><td colspan="2"><strong>Discharge type:</strong> {{ discharge.discharge_type }}</td></tr>{% endif %}
</table>
{% if discharge.diagnosis %}
<h3 class="brand" style="margin-top:8px;">Diagnosis</h3>
<p>{{ discharge.diagnosis }}</p>
{% endif %}
{% if discharge.discharge_summary %}
<h3 class="brand" style="margin-top:8px;">Course in Hospital & Summary</h3>
<p style="white-space:pre-wrap;">{{ discharge.discharge_summary }}</p>
{% endif %}
{% endblock content %}"#;

const DISCHARGE_SAMPLE: &str = r#"{
  "discharge": {
    "patient_name": "R. Lakshmi", "uhid": "ACMS-2026-00042",
    "age": "42y", "gender": "F",
    "admission_date": "2026-06-08", "discharge_date": "2026-06-12",
    "department": "General Medicine", "doctor_name": "Dr. S. Ravi",
    "bed_number": "GW-12", "ward_name": "General Ward A",
    "discharge_type": "Normal",
    "diagnosis": "Community-acquired pneumonia (J18.9)",
    "discharge_summary": "Admitted with fever, productive cough and breathlessness. CXR showed right lower zone consolidation. Treated with IV ceftriaxone for 4 days, switched to oral amoxicillin-clavulanate. Afebrile for 48h, oxygen saturation 98% on room air at discharge.\n\nMedications on discharge: Amoxicillin-clavulanate 625mg TID x 5 days.\nAdvice: Review in OPD after 1 week with repeat CXR."
  },
  "watermark": "draft",
  "document_number": "IPD-DSC-20260612-0001"
}"#;

const ER_DISCHARGE_HTML: &str = r#"{% extends "base.html" %}
{% block content %}
<h2 class="brand" style="margin-bottom:2px;">EMERGENCY DISCHARGE SUMMARY</h2>
{% if discharge.status != "finalized" %}<p class="muted small" style="margin-top:0;color:#b45309;">DRAFT — not finalized</p>{% endif %}
<table style="margin-bottom:8px;"><tr>
  <td>
    <div><strong>Visit:</strong> <span class="mono">{{ discharge.visit_number }}</span></div>
    <div><strong>Arrival:</strong> {{ discharge.arrival_time }}</div>
    {% if discharge.discharge_date %}<div><strong>Discharged:</strong> {{ discharge.discharge_date }}</div>{% endif %}
  </td>
  <td class="right">
    <div><strong>Patient:</strong> {{ discharge.patient_name }}{% if discharge.age %} · {{ discharge.age }}{% endif %} · {{ discharge.gender }}</div>
    <div><strong>UHID:</strong> <span class="mono">{{ discharge.uhid }}</span></div>
    {% if discharge.triage_level %}<div><strong>Triage:</strong> {{ discharge.triage_level }}</div>{% endif %}
  </td>
</tr></table>
{% if discharge.chief_complaint %}<p><strong>Presenting complaint:</strong> {{ discharge.chief_complaint }}</p>{% endif %}
{% if discharge.final_diagnosis %}<p><strong>Diagnosis:</strong> {{ discharge.final_diagnosis }}</p>{% endif %}
{% if discharge.clinical_course %}<p><strong>Clinical course:</strong> {{ discharge.clinical_course }}</p>{% endif %}
{% if discharge.treatment_given %}<p><strong>Treatment given:</strong> {{ discharge.treatment_given }}</p>{% endif %}
{% if discharge.condition_at_discharge %}<p><strong>Condition at discharge:</strong> {{ discharge.condition_at_discharge }}</p>{% endif %}
{% if discharge.disposition %}<p><strong>Disposition:</strong> {{ discharge.disposition }}</p>{% endif %}
{% if discharge.medications_on_discharge %}<p><strong>Medications to continue:</strong><br/>{{ discharge.medications_on_discharge }}</p>{% endif %}
{% if discharge.follow_up_instructions %}<p><strong>Follow-up:</strong> {{ discharge.follow_up_instructions }}{% if discharge.follow_up_date %} (by {{ discharge.follow_up_date }}){% endif %}</p>{% endif %}
{% if discharge.warning_signs %}
<div style="border:1px solid #C8102E;border-radius:4px;padding:6px 10px;margin-top:8px;">
  <strong style="color:#C8102E;">Return immediately if:</strong> {{ discharge.warning_signs }}
</div>
{% endif %}
<table style="margin-top:24px;"><tr>
  <td>{% if discharge.doctor_name %}Attending: <strong>{{ discharge.doctor_name }}</strong>{% endif %}</td>
  <td class="right muted small">System-generated discharge summary.</td>
</tr></table>
{% endblock content %}"#;

const ER_DISCHARGE_SAMPLE: &str = r#"{
  "discharge": {
    "visit_number": "ER-20260625-0007", "patient_name": "M. Suresh", "uhid": "ACMS-2026-00318",
    "age": "34 yrs", "gender": "M",
    "arrival_time": "25-Jun-2026 21:40", "discharge_date": "25-Jun-2026 23:55",
    "chief_complaint": "Laceration to left forearm", "triage_level": "less_urgent",
    "disposition": "Discharged home", "doctor_name": "Dr. P. Nair", "status": "finalized",
    "final_diagnosis": "Superficial laceration, left forearm (S51.8)",
    "condition_at_discharge": "Stable, ambulatory",
    "clinical_course": "Wound cleaned and irrigated; 4 sutures placed under local anaesthesia.",
    "treatment_given": "Tetanus toxoid; wound toilet + suturing.",
    "medications_on_discharge": "Amoxicillin-clavulanate 625mg TID x 5 days; Paracetamol 500mg PRN.",
    "follow_up_instructions": "Suture removal in OPD after 7 days", "follow_up_date": "02-Jul-2026",
    "warning_signs": "increasing pain, redness, swelling, pus, or fever",
    "hospital_name": "Alagappa Hospital"
  },
  "watermark": "",
  "document_number": "ER-DSC-20260625-0001"
}"#;

const IPD_CONSOLIDATED_BILL_HTML: &str = r#"{% extends "base.html" %}
{% block content %}
<h2 class="brand" style="margin-bottom:2px;">CONSOLIDATED DISCHARGE BILL</h2>
<table style="margin-bottom:8px;"><tr>
  <td>
    <div><strong>Bill Ref:</strong> <span class="mono">{{ bill.invoice_number }}</span></div>
    <div><strong>Date:</strong> {{ bill.invoice_date }}</div>
    {% if bill.hospital_gstin %}<div><strong>GSTIN:</strong> <span class="mono">{{ bill.hospital_gstin }}</span></div>{% endif %}
  </td>
  <td class="right">
    <div><strong>Patient:</strong> {{ bill.patient_name }}{% if bill.age %} · {{ bill.age }}{% endif %} · {{ bill.gender }}</div>
    <div><strong>UHID:</strong> <span class="mono">{{ bill.uhid }}</span></div>
    {% if bill.ward_name %}<div><strong>Ward/Bed:</strong> {{ bill.ward_name }}{% if bill.bed_number %} / {{ bill.bed_number }}{% endif %}</div>{% endif %}
  </td>
</tr></table>
<table style="margin-bottom:8px;"><tr>
  <td>
    <div><strong>Admitted:</strong> {{ bill.admission_date }}</div>
    {% if bill.discharge_date %}<div><strong>Discharged:</strong> {{ bill.discharge_date }}</div>{% endif %}
    <div><strong>LOS:</strong> {{ bill.los_days }} day(s)</div>
  </td>
  <td class="right">
    {% if bill.doctor_name %}<div><strong>Doctor:</strong> {{ bill.doctor_name }}</div>{% endif %}
    {% if bill.department %}<div><strong>Dept:</strong> {{ bill.department }}</div>{% endif %}
    {% if bill.diagnosis %}<div><strong>Diagnosis:</strong> {{ bill.diagnosis }}</div>{% endif %}
  </td>
</tr></table>
{% if bill.category_breakup %}
<table style="margin-bottom:8px;">
  <thead><tr><th>Category</th><th class="right">Amount</th></tr></thead>
  <tbody>
  {% for cat in bill.category_breakup %}
    <tr><td>{{ cat.category }}</td><td class="right">{{ cat.amount }}</td></tr>
  {% endfor %}
  </tbody>
</table>
{% endif %}
<table>
  <thead><tr>
    <th>#</th><th>Description</th><th>Code</th>
    <th class="right">Qty</th><th class="right">Rate</th>
    <th class="right">Disc</th><th class="right">GST %</th><th class="right">Amount</th>
  </tr></thead>
  <tbody>
  {% for item in bill.items %}
    <tr>
      <td>{{ loop.index }}</td>
      <td>{{ item.description }}</td>
      <td class="mono">{{ item.service_code | default(value="") }}</td>
      <td class="right">{{ item.quantity }}</td>
      <td class="right">{{ item.unit_price }}</td>
      <td class="right">{{ item.discount }}</td>
      <td class="right">{{ item.tax_percent }}</td>
      <td class="right">{{ item.total }}</td>
    </tr>
  {% endfor %}
  </tbody>
</table>
<table style="margin-top:8px;"><tr><td></td><td style="width:42%;">
  <table>
    <tr><td>Subtotal</td><td class="right">{{ bill.subtotal }}</td></tr>
    <tr><td>Discount</td><td class="right">{{ bill.discount_amount }}</td></tr>
    <tr><td>GST</td><td class="right">{{ bill.tax_amount }}</td></tr>
    <tr><td><strong>Total</strong></td><td class="right"><strong>{{ bill.total_amount }}</strong></td></tr>
    <tr><td>Advance paid</td><td class="right">{{ bill.advance_paid }}</td></tr>
    <tr><td>Insurance approved</td><td class="right">{{ bill.insurance_approved }}</td></tr>
    <tr><td>Amount paid</td><td class="right">{{ bill.amount_paid }}</td></tr>
    <tr><td><strong>Balance due</strong></td><td class="right"><strong>{{ bill.balance_due }}</strong></td></tr>
  </table>
</td></tr></table>
<p class="muted small" style="margin-top:10px;">
  Consolidated across every invoice raised during this admission. System-generated; subject to final audit.
</p>
{% endblock content %}"#;

const NO_DUES_HTML: &str = r#"{% extends "base.html" %}
{% block content %}
<h2 class="brand" style="margin-bottom:2px;">NO-DUES CERTIFICATE</h2>
<p class="muted small" style="margin-top:0;">Financial clearance — Inpatient discharge</p>
<table style="margin-bottom:8px;"><tr>
  <td>
    <div><strong>Patient:</strong> {{ cert.patient_name }}{% if cert.age %} · {{ cert.age }}{% endif %} · {{ cert.gender }}</div>
    <div><strong>UHID:</strong> <span class="mono">{{ cert.uhid }}</span></div>
    {% if cert.ward_name %}<div><strong>Ward/Bed:</strong> {{ cert.ward_name }}{% if cert.bed_number %} / {{ cert.bed_number }}{% endif %}</div>{% endif %}
  </td>
  <td class="right">
    <div><strong>Admitted:</strong> {{ cert.admission_date }}</div>
    {% if cert.discharge_date %}<div><strong>Discharged:</strong> {{ cert.discharge_date }}</div>{% endif %}
    <div><strong>Issued:</strong> {{ cert.issued_at }}</div>
  </td>
</tr></table>
<p style="margin:12px 0;">
  This certifies that all hospital charges for the above admission have been
  reconciled and settled in full. The patient is cleared for discharge with
  <strong>no outstanding dues</strong>.
</p>
<table style="margin-top:8px;"><tr><td></td><td style="width:42%;">
  <table>
    <tr><td>Total billed</td><td class="right">{{ cert.total_billed }}</td></tr>
    <tr><td>Total paid</td><td class="right">{{ cert.total_paid }}</td></tr>
    <tr><td><strong>Balance due</strong></td><td class="right"><strong>{{ cert.balance }}</strong></td></tr>
  </table>
</td></tr></table>
{% if cert.notes %}<p class="muted small"><strong>Notes:</strong> {{ cert.notes }}</p>{% endif %}
<p style="margin-top:28px;">
  {% if cert.issued_by %}Cleared by: <strong>{{ cert.issued_by }}</strong>{% endif %}
</p>
<p class="muted small" style="margin-top:24px;">
  System-generated financial clearance. Valid with the official hospital seal.
</p>
{% endblock content %}"#;

const NO_DUES_SAMPLE: &str = r#"{
  "cert": {
    "patient_name": "R. Lakshmi", "uhid": "ACMS-2026-00042",
    "age": "42 Y", "gender": "F",
    "admission_date": "08-Jun-2026", "discharge_date": "12-Jun-2026",
    "ward_name": "General Ward A", "bed_number": "GW-12",
    "total_billed": "7350.00", "total_paid": "7350.00", "balance": "0.00",
    "issued_by": "Anita Kumar (Billing)", "issued_at": "12-Jun-2026 14:30",
    "notes": null, "hospital_name": "Alagappa Hospital"
  },
  "watermark": "",
  "document_number": "IPD-NOC-20260612-0001"
}"#;

const IPD_CONSOLIDATED_BILL_SAMPLE: &str = r#"{
  "bill": {
    "invoice_number": "IP/3F2A9B1C", "invoice_date": "12-Jun-2026",
    "patient_name": "R. Lakshmi", "uhid": "ACMS-2026-00042",
    "age": "42 Y", "gender": "F",
    "admission_date": "08-Jun-2026", "discharge_date": "12-Jun-2026",
    "bed_number": "GW-12", "ward_name": "General Ward A",
    "doctor_name": "Dr. S. Ravi", "department": "General Medicine",
    "diagnosis": "Community-acquired pneumonia (J18.9)", "discharge_type": "Normal",
    "category_breakup": [
      { "category": "Room", "amount": "4000.00" },
      { "category": "Consumable", "amount": "1250.00" },
      { "category": "Pharmacy", "amount": "2100.00" }
    ],
    "items": [
      { "description": "Room rent - General Ward", "service_code": "ROOM_IPD", "quantity": 4, "unit_price": "1000.00", "discount": "0", "tax_percent": "0", "total": "4000.00" },
      { "description": "IV cannula 20G", "service_code": "CONS-IV20", "quantity": 3, "unit_price": "150.00", "discount": "0", "tax_percent": "0", "total": "450.00" }
    ],
    "subtotal": "7350.00", "discount_amount": "0.00", "tax_amount": "0.00",
    "total_amount": "7350.00", "advance_paid": "5000.00", "insurance_approved": "0.00",
    "patient_payable": "7350.00", "amount_paid": "5000.00", "balance_due": "2350.00",
    "los_days": 4, "hospital_name": "Alagappa Hospital", "hospital_gstin": "33ABCDE1234F1Z5"
  },
  "watermark": "",
  "document_number": "IPD-BILL-20260612-0001"
}"#;

const LAB_REPORT_HTML: &str = r#"{% extends "base.html" %}
{% block extra_css %}
  .flag-high, .flag-critical_high { color: #b42828; font-weight: 700; }
  .flag-low, .flag-critical_low { color: #1e63b8; font-weight: 700; }
{% endblock extra_css %}
{% block content %}
<h2 class="brand">LABORATORY REPORT</h2>
<table style="margin:6px 0;">
  <tr>
    <td><strong>Patient:</strong> {{ lab.patient_name }} <span class="mono">({{ lab.uhid }})</span></td>
    <td class="right">{{ lab.age | default(value="") }} {{ lab.gender }}</td>
  </tr>
  <tr>
    <td><strong>Test:</strong> {{ lab.test_name }}{% if lab.sample_type %} ({{ lab.sample_type }}){% endif %}</td>
    <td class="right">{% if lab.order_number %}<span class="mono">{{ lab.order_number }}</span>{% endif %}</td>
  </tr>
  <tr>
    <td class="muted">Collected: {{ lab.collected_at | default(value="—") }}</td>
    <td class="right muted">Reported: {{ lab.reported_at | default(value="—") }}</td>
  </tr>
</table>
<table>
  <thead><tr><th>Parameter</th><th class="right">Result</th><th>Unit</th><th>Reference Range</th><th>Flag</th></tr></thead>
  <tbody>
  {% for r in lab.results %}
    <tr>
      <td>{{ r.parameter_name }}</td>
      <td class="right flag-{{ r.flag | default(value='normal') }}">{{ r.value }}</td>
      <td>{{ r.unit | default(value="") }}</td>
      <td>{{ r.normal_range | default(value="") }}</td>
      <td class="flag-{{ r.flag | default(value='normal') }}">{{ r.flag | default(value="") | upper }}</td>
    </tr>
  {% endfor %}
  </tbody>
</table>
{% if lab.pathologist_name %}<p class="right" style="margin-top:14px;">{{ lab.pathologist_name }}<br><span class="muted small">Pathologist</span></p>{% endif %}
{% endblock content %}"#;

const LAB_REPORT_SAMPLE: &str = r#"{
  "lab": {
    "patient_name": "R. Lakshmi", "uhid": "ACMS-2026-00042",
    "age": "42y", "gender": "F",
    "order_number": "LAB-2026-08812", "test_name": "Complete Blood Count",
    "sample_type": "EDTA Whole Blood",
    "collected_at": "2026-06-12 08:10", "reported_at": "2026-06-12 11:30",
    "referring_doctor": "Dr. S. Ravi",
    "pathologist_name": "Dr. K. Meena, MD (Path)",
    "results": [
      {"parameter_name": "Haemoglobin", "value": "9.8", "unit": "g/dL", "normal_range": "12.0 – 15.5", "flag": "low"},
      {"parameter_name": "Total WBC", "value": "11,400", "unit": "/µL", "normal_range": "4,000 – 11,000", "flag": "high"},
      {"parameter_name": "Platelets", "value": "2.4", "unit": "lakh/µL", "normal_range": "1.5 – 4.5", "flag": null},
      {"parameter_name": "Neutrophils", "value": "78", "unit": "%", "normal_range": "40 – 70", "flag": "high"}
    ]
  },
  "document_number": "LAB-RPT-20260612-0001"
}"#;

// ── Pharmacy / IPD labels ───────────────────────────────────

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

const PHARMACY_LABEL_SAMPLE: &str = r#"{
  "label": {
    "drug_name": "Amoxicillin 500mg", "dosage": "1 cap", "frequency": "TID",
    "duration": "5 days", "instructions": "After food",
    "patient_name": "R. Lakshmi", "uhid": "ACMS-2026-00042",
    "dispensed_date": "2026-06-12",
    "qr_svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'><rect width='10' height='10' fill='#eee'/></svg>"
  }
}"#;

const WRISTBAND_HTML: &str = r#"{% extends "base.html" %}
{% block extra_css %}
  html, body { font-size: 7pt; }
  .band { display: flex; align-items: center; gap: 3mm; height: 25mm; padding: 1.5mm 3mm; }
  .band .who { min-width: 52mm; }
  .band .name { font-size: 9.5pt; font-weight: 700; }
  .band .barcode { flex: 1; }
  .band .barcode svg { width: 100%; height: 12mm; }
  .band .qr svg { width: 16mm; height: 16mm; }
  .alert { color: #b42828; font-weight: 700; }
{% endblock extra_css %}
{% block letterhead %}{% endblock letterhead %}
{% block content %}
<div class="band">
  <div class="who">
    <div class="name">{{ band.patient_name }}</div>
    <div><span class="mono">{{ band.uhid }}</span> · {{ band.age | default(value="") }} {{ band.gender }}{% if band.blood_group %} · <strong>{{ band.blood_group }}</strong>{% endif %}</div>
    <div class="muted">Adm {{ band.admission_date }}{% if band.ward_name %} · {{ band.ward_name }}{% endif %}{% if band.bed_number %} · {{ band.bed_number }}{% endif %}</div>
    {% if band.allergies and band.allergies | length > 0 %}<div class="alert">⚠ {{ band.allergies | join(sep=", ") }}</div>{% endif %}
  </div>
  <div class="barcode">{{ band.barcode_svg | safe }}</div>
  <div class="qr">{{ band.qr_svg | safe }}</div>
</div>
{% endblock content %}
{% block footer %}{% endblock footer %}"#;

const WRISTBAND_SAMPLE: &str = r#"{
  "band": {
    "patient_name": "R. Lakshmi", "uhid": "ACMS-2026-00042",
    "age": "42y", "gender": "F", "blood_group": "B+",
    "admission_date": "2026-06-08", "ward_name": "GW-A", "bed_number": "12",
    "allergies": ["Penicillin"],
    "barcode_svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 20'><rect width='100' height='20' fill='#eee'/></svg>",
    "qr_svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'><rect width='10' height='10' fill='#eee'/></svg>"
  }
}"#;

// ── Insurance ───────────────────────────────────────────────

const CASHLESS_CLAIM_HTML: &str = r#"{% extends "base.html" %}
{% block content %}
<h2 class="brand">CASHLESS CLAIM SUMMARY</h2>
<table style="margin:6px 0;">
  <tr><td><strong>Claim No.</strong></td><td class="mono">{{ claim.claim_number }}</td>
      <td class="right"><strong>Date</strong></td><td class="right">{{ claim.claim_date }}</td></tr>
  <tr><td><strong>Patient</strong></td><td>{{ claim.patient_name }} <span class="mono">({{ claim.uhid }})</span></td>
      <td class="right"><strong>Status</strong></td><td class="right">{{ claim.claim_status | upper }}</td></tr>
  <tr><td><strong>Insurer</strong></td><td>{{ claim.insurance_company }}</td>
      <td class="right"><strong>Policy</strong></td><td class="right mono">{{ claim.policy_number }}</td></tr>
  {% if claim.tpa_name %}<tr><td><strong>TPA</strong></td><td colspan="3">{{ claim.tpa_name }}</td></tr>{% endif %}
  <tr><td><strong>Admitted</strong></td><td>{{ claim.admission_date }}</td>
      <td class="right"><strong>Discharged</strong></td><td class="right">{{ claim.discharge_date | default(value="—") }}</td></tr>
  {% if claim.treating_doctor %}<tr><td><strong>Treating Doctor</strong></td><td colspan="3">{{ claim.treating_doctor }}</td></tr>{% endif %}
</table>
{% if claim.diagnosis %}<p><strong>Diagnosis:</strong> {{ claim.diagnosis }}</p>{% endif %}
{% if claim.procedures_performed and claim.procedures_performed | length > 0 %}
<p><strong>Procedures:</strong> {{ claim.procedures_performed | join(sep="; ") }}</p>
{% endif %}
<table style="margin-top:10px; width:55%;">
  <tr><td>Total Bill Amount</td><td class="right">₹ {{ claim.total_bill_amount }}</td></tr>
  <tr><td>Approved Amount</td><td class="right">₹ {{ claim.approved_amount }}</td></tr>
  <tr><td>Deductions</td><td class="right">₹ {{ claim.deductions }}</td></tr>
  <tr><td><strong>Patient Payable</strong></td><td class="right"><strong>₹ {{ claim.patient_payable }}</strong></td></tr>
</table>
{% endblock content %}"#;

const CASHLESS_CLAIM_SAMPLE: &str = r#"{
  "claim": {
    "claim_number": "CLM-2026-04471", "claim_date": "2026-06-12",
    "patient_name": "R. Lakshmi", "uhid": "ACMS-2026-00042",
    "policy_number": "POL-88412290", "insurance_company": "Star Health Insurance",
    "tpa_name": "MediAssist TPA", "claim_status": "approved",
    "admission_date": "2026-06-08", "discharge_date": "2026-06-12",
    "diagnosis": "Community-acquired pneumonia (J18.9)",
    "procedures_performed": ["Chest X-ray PA", "IV antibiotic therapy"],
    "total_bill_amount": "48,500.00", "approved_amount": "42,000.00",
    "deductions": "6,500.00", "patient_payable": "6,500.00",
    "treating_doctor": "Dr. S. Ravi"
  },
  "document_number": "INS-CLM-20260612-0001"
}"#;
