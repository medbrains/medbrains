//! Tera template engine with the shared letterhead/base layout.
//!
//! Document templates extend `base.html` and fill `content` (plus
//! optional `header_extra`). Tenant branding (hospital name, address,
//! logo, colors) and watermark arrive through the render context under
//! `branding` / `watermark` — populated by the server from
//! `tenant_settings` print_templates config.

use tera::Tera;

use crate::PrintError;

/// Shared page chrome: letterhead, watermark layer, print CSS reset.
/// Forest + Copper defaults; every value overridable via `branding`.
const BASE_TEMPLATE: &str = r##"<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  :root {
    --brand: {{ branding.brand_color | default(value="#1F4332") }};
    --ink: #0F1412;
    --rule: #e7ebe8;
    --copper: #B8924A;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { color: var(--ink); font-family: {{ branding.font_family | default(value="Arial, Helvetica, sans-serif") }}; font-size: {{ branding.font_size_pt | default(value=10) }}pt; }
  table { border-collapse: collapse; width: 100%; }
  th, td { padding: 4px 6px; text-align: left; }
  thead th { border-bottom: 1.5px solid var(--brand); font-weight: 600; }
  tbody td { border-bottom: 0.5px solid var(--rule); }
  .mono { font-family: "Courier New", monospace; }
  .right { text-align: right; }
  .muted { color: #5b6660; }
  .brand { color: var(--brand); }
  .small { font-size: 8pt; }
  .letterhead { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid var(--brand); padding-bottom: 8px; margin-bottom: 10px; }
  .letterhead h1 { font-size: 14pt; color: var(--brand); }
  .letterhead .addr { font-size: 8pt; color: #5b6660; max-width: 60%; }
  .letterhead img.logo { max-height: 44px; }
  .doc-footer { border-top: 1px solid var(--rule); margin-top: 12px; padding-top: 6px; font-size: 7.5pt; color: #5b6660; display: flex; justify-content: space-between; }
  .signature-block { margin-top: 18px; text-align: right; font-size: 8.5pt; }
  .signature-block img { max-height: 36px; display: block; margin-left: auto; }
  .watermark { position: fixed; top: 40%; left: 0; right: 0; text-align: center; font-size: 56pt; font-weight: 700; color: rgba(180, 40, 40, 0.12); transform: rotate(-24deg); z-index: 0; pointer-events: none; }
  .content { position: relative; z-index: 1; }
  {% block extra_css %}{% endblock extra_css %}
</style>
</head>
<body>
{% if watermark and watermark != "none" %}<div class="watermark">{{ watermark | upper }}</div>{% endif %}
<div class="content">
{% block letterhead %}
{% if branding.show_letterhead | default(value=true) %}
<div class="letterhead">
  <div>
    <h1>{{ branding.hospital_name | default(value="") }}</h1>
    <div class="addr">{{ branding.address | default(value="") }}
      {% if branding.phone %} · {{ branding.phone }}{% endif %}
      {% if branding.registration_no %} · Reg: {{ branding.registration_no }}{% endif %}
    </div>
  </div>
  {% if branding.logo_url %}<img class="logo" src="{{ branding.logo_url }}" alt="">{% endif %}
</div>
{% endif %}
{% endblock letterhead %}
{% block content %}{% endblock content %}
{% if signature %}
<div class="signature-block">
  {% if signature.display_image_url %}<img src="{{ signature.display_image_url }}" alt="">{% endif %}
  <div>{{ signature.display_block }}</div>
  <div class="muted small">Verify: {{ signature.verify_ref }}</div>
</div>
{% endif %}
{% block footer %}
<div class="doc-footer">
  <span>{{ document_number | default(value="") }}</span>
  <span>Generated {{ generated_at | default(value="") }}{% if generated_by_name %} by {{ generated_by_name }}{% endif %}</span>
</div>
{% endblock footer %}
</div>
</body>
</html>"##;

/// Build a Tera instance holding the base layout plus the document
/// template (registered as `doc.html`, expected to `{% extends "base.html" %}`).
pub fn build_engine(document_template_html: &str) -> Result<Tera, PrintError> {
    let mut tera = Tera::default();
    tera.add_raw_template("base.html", BASE_TEMPLATE)?;
    tera.add_raw_template("doc.html", document_template_html)?;
    Ok(tera)
}

/// Render the document template against a JSON context.
pub fn render_html(
    document_template_html: &str,
    context: &serde_json::Value,
) -> Result<String, PrintError> {
    let tera = build_engine(document_template_html)?;
    let ctx = tera::Context::from_value(context.clone())?;
    Ok(tera.render("doc.html", &ctx)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_dynamic_values_in_base_layout() {
        let template = r#"{% extends "base.html" %}{% block content %}
            <h2>Invoice {{ invoice.number }}</h2>
            <p>Total: {{ invoice.total }}</p>
        {% endblock content %}"#;
        let ctx = serde_json::json!({
            "branding": { "hospital_name": "Alagappa Hospital" },
            "watermark": "duplicate",
            "invoice": { "number": "INV-000123", "total": "1,250.00" },
            "document_number": "BIL-20260612-0001",
        });
        let html = render_html(template, &ctx).expect("render");
        assert!(html.contains("Invoice INV-000123"));
        assert!(html.contains("1,250.00"));
        assert!(html.contains("Alagappa Hospital"));
        assert!(html.contains("DUPLICATE"));
    }

    #[test]
    fn missing_optional_sections_render_clean() {
        let template =
            r#"{% extends "base.html" %}{% block content %}<p>{{ msg }}</p>{% endblock content %}"#;
        let ctx = serde_json::json!({ "branding": {}, "msg": "hello" });
        let html = render_html(template, &ctx).expect("render");
        assert!(html.contains("hello"));
        assert!(!html.contains("watermark\">"));
    }
}
