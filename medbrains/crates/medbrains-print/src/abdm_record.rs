//! The printed copy of a record shared over ABDM: the hospital's own
//! letterhead, fonts and footer (`base.html`), a header with the patient's
//! demographics and the treating doctor, then the record's sections. The
//! context is `medbrains_fhir::nrces::rendition`'s, with the ABHA address
//! and the doctor's speciality added by the HIP. Not a `SYSTEM_TEMPLATES`
//! entry: it prints from a shared bundle, not from a source row.

use crate::paper::{MarginsMm, Paper};

/// Paper the rendition prints on, as the hospital's A4 documents do.
pub const PAPER: Paper = Paper::A4;
/// Margins of the hospital's A4 documents.
pub const MARGINS: MarginsMm = MarginsMm {
    top: 12.0,
    right: 12.0,
    bottom: 14.0,
    left: 12.0,
};

/// The template (Tera, extends `base.html`).
pub const HTML: &str = r#"{% extends "base.html" %}
{% block content %}
<h2 class="brand">{{ record.title }}</h2>
<p class="muted small">{{ record.kind }} · {{ record.date }}</p>
<table style="margin:6px 0 8px;"><tr>
  <td>
    <div><strong>{{ record.patient.name }}</strong>{% if record.patient.uhid %} <span class="mono">({{ record.patient.uhid }})</span>{% endif %}</div>
    <div>{% if record.patient.age %}Age {{ record.patient.age }} · {% endif %}Gender {{ record.patient.gender }}{% if record.patient.mobile %} · Mobile {{ record.patient.mobile }}{% endif %}</div>
    <div>ABHA number: <span class="mono">{% if record.patient.abha_number %}{{ record.patient.abha_number }}{% else %}not linked{% endif %}</span></div>
    <div>ABHA address: <span class="mono">{% if record.patient.abha_address %}{{ record.patient.abha_address }}{% else %}not linked{% endif %}</span></div>
  </td>
  <td class="right">
    {% if record.doctor %}<div><strong>{{ record.doctor.name }}</strong></div>
    {% if record.doctor.speciality %}<div>{{ record.doctor.speciality }}</div>{% endif %}{% endif %}
    {% if record.hospital %}<div class="muted">{{ record.hospital }}</div>{% endif %}
  </td>
</tr></table>
{% for s in record.sections %}{% if s.lines %}
<h3 class="brand" style="margin-top:8px;">{{ s.title }}</h3>
{% for line in s.lines %}<p style="white-space:pre-wrap;">{{ line }}</p>{% endfor %}
{% endif %}{% endfor %}
{% endblock content %}"#;

#[cfg(test)]
mod tests {
    use crate::engine::render_html;

    fn context() -> serde_json::Value {
        serde_json::json!({
            "branding": { "hospital_name": "Example Hospital" },
            "record": {
                "kind": "Prescription record", "title": "Prescription", "date": "2026-11-15",
                "hospital": "Example Hospital",
                "patient": { "name": "Test Patient", "uhid": "UH-77", "age": "36 years",
                             "gender": "female", "mobile": "+91 90000 00001",
                             "abha_number": "91-1111-2222-3333", "abha_address": "test.patient@sbx" },
                "doctor": { "id": "x", "name": "Dr Sample Doctor", "speciality": "General Medicine" },
                "sections": [
                    { "title": "Prescription", "lines": ["Paracetamol 500 mg <b> 1 tab TDS"] },
                    { "title": "Empty", "lines": [] }
                ]
            }
        })
    }

    /// The printed copy carries what M2 asks of it: name, age, gender,
    /// mobile, ABHA number and address, the doctor's name and speciality.
    #[test]
    fn the_printed_copy_shows_patient_demographics_and_the_doctor() {
        let html = render_html(super::HTML, &context()).expect("render");
        for want in [
            "Test Patient",
            "Age 36 years",
            "Gender female",
            "Mobile +91 90000 00001",
            "91-1111-2222-3333",
            "test.patient@sbx",
            "Dr Sample Doctor",
            "General Medicine",
            "Example Hospital",
        ] {
            assert!(html.contains(want), "missing {want}");
        }
        assert!(
            html.contains("&lt;b&gt;"),
            "record text is escaped, not markup"
        );
        assert!(!html.contains("Empty"), "an empty section is not printed");
    }

    /// A patient with no ABHA linked says so instead of printing a blank.
    #[test]
    fn an_unlinked_patient_reads_not_linked() {
        let mut ctx = context();
        ctx["record"]["patient"]["abha_number"] = serde_json::Value::Null;
        ctx["record"]["patient"]["abha_address"] = serde_json::Value::Null;
        ctx["record"]["doctor"] = serde_json::Value::Null;
        let html = render_html(super::HTML, &ctx).expect("render");
        assert_eq!(html.matches("not linked").count(), 2);
        assert!(!html.contains("Dr Sample Doctor"));
    }
}
