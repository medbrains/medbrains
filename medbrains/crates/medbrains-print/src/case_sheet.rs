//! The visit's clinical-notes case sheet on paper: one block per note,
//! headed by who wrote it and when, signed, addenda beneath it, notes in
//! error struck through.

pub(crate) const CASE_SHEET_HTML: &str = r#"{% extends "base.html" %}
{% block content %}
<h2 class="brand" style="margin-bottom:2px;">CASE SHEET — CLINICAL NOTES</h2>
<table style="margin-bottom:8px;"><tr>
  <td>
    <div><strong>{{ sheet.visit_kind }}:</strong> {% if sheet.visit_number %}<span class="mono">{{ sheet.visit_number }}</span>{% endif %}{% if sheet.visit_date %} · {{ sheet.visit_date }}{% endif %}</div>
    {% if sheet.department %}<div><strong>Department:</strong> {{ sheet.department }}</div>{% endif %}
  </td>
  <td class="right">
    <div><strong>Patient:</strong> {{ sheet.patient_name }}{% if sheet.age %} · {{ sheet.age }}{% endif %}{% if sheet.gender %} · {{ sheet.gender }}{% endif %}</div>
    <div><strong>UHID:</strong> <span class="mono">{{ sheet.uhid }}</span></div>
  </td>
</tr></table>
{% if sheet.notes | length == 0 %}<p class="muted">No signed notes on this visit.</p>{% endif %}
{% for n in sheet.notes %}
<div style="page-break-inside:avoid;margin-top:10px;{% if n.addendum %}margin-left:18px;border-left:2px solid #999;padding-left:8px;{% else %}border-top:1px solid #ccc;padding-top:6px;{% endif %}">
  <div{% if n.in_error %} style="text-decoration:line-through;"{% endif %}>
    <strong>{{ n.title }}</strong> — {{ n.author }}, {{ n.role }}{% if n.registration %}, Reg. {{ n.registration }}{% endif %}{% if n.department %}, {{ n.department }}{% endif %}
  </div>
  <div class="muted small">
    Care at {{ n.service_at }} ·
    {% if n.recorded %}Recorded{% else %}Signed{% endif %} {{ n.signed_at }}{% if n.revised %} · revised{% endif %}
    {% if n.cosign %} · {{ n.cosign }}{% endif %}
  </div>
  {% if n.in_error %}<div class="small" style="color:#C8102E;">ENTERED IN ERROR — {{ n.in_error_reason }}</div>{% endif %}
  {% if n.late_entry_reason %}<div class="small">Late entry: {{ n.late_entry_reason }}</div>{% endif %}
  <div{% if n.in_error %} style="text-decoration:line-through;opacity:0.6;"{% endif %}>
  {% for s in n.sections %}
    <div style="margin-top:4px;"><span class="small" style="text-transform:uppercase;font-weight:700;">{{ s.title }}</span>
    {% for line in s.lines %}<div>{{ line }}</div>{% endfor %}
    {% for p in s.paragraphs %}<div>{{ p }}</div>{% endfor %}
    </div>
  {% endfor %}
  </div>
</div>
{% endfor %}
<p class="muted small" style="margin-top:16px;">Drafts are not part of the record and are not printed.</p>
{% endblock content %}"#;

pub(crate) const CASE_SHEET_SAMPLE: &str = r#"{
  "sheet": {
    "patient_name": "R. Kumar", "uhid": "ACMS-2026-00412", "age": "52 yrs", "gender": "male",
    "visit_kind": "OPD visit", "visit_number": "OPD-20261005-0031", "visit_date": "05 Oct 2026",
    "department": "General Medicine",
    "notes": [
      { "title": "Consultation", "author": "Dr. A. Rao", "role": "doctor", "registration": "TN-12345",
        "department": "General Medicine", "service_at": "05 Oct 2026 10:42", "signed_at": "05 Oct 2026 10:58",
        "recorded": false, "revised": false, "in_error": false, "addendum": false,
        "cosign": "Countersigned by Dr. S. Iyer 05 Oct 2026 12:10",
        "sections": [
          { "title": "History", "lines": ["HPI: Cough for three weeks", "Past medical: Diabetes (controlled)"], "paragraphs": [] },
          { "title": "Plan", "lines": [], "paragraphs": ["Chest X-ray", "Review with report"] }
        ] },
      { "title": "Addendum", "author": "Dr. A. Rao", "role": "doctor", "registration": "TN-12345",
        "department": "General Medicine", "service_at": "05 Oct 2026 16:20", "signed_at": "05 Oct 2026 16:25",
        "recorded": false, "revised": false, "in_error": false, "addendum": true,
        "sections": [ { "title": "Addendum", "lines": [], "paragraphs": ["CXR normal"] } ] }
    ]
  },
  "watermark": "",
  "document_number": "CS-NOTES-20261005-0001"
}"#;
