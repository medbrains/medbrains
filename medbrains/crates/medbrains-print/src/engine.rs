//! Tera template engine with the shared letterhead/base layout.
//!
//! Document templates extend `base.html` and fill `content` (plus
//! optional `header_extra`). Tenant branding (hospital name, address,
//! logo, colors) and watermark arrive through the render context under
//! `branding` / `watermark` — populated by the server from
//! `tenant_settings` `print_templates` config.

use std::sync::LazyLock;

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD;
use tera::Tera;

use crate::PrintError;

/// `MedBrains Sans` for printed documents: the Latin static files built by
/// `tools/fonts/build_medbrains_sans.py` (normal is the easy-read Regular, cut at weight 440).
/// Embedded as data URIs so the PDF renderer needs no network and no installed font; Chromium
/// keeps only the glyphs a page uses when it writes the PDF.
static SANS_FACES: LazyLock<String> = LazyLock::new(|| {
    [
        (
            400,
            include_bytes!("../fonts/MedBrainsSans-Regular.ttf").as_slice(),
        ),
        (
            600,
            include_bytes!("../fonts/MedBrainsSans-SemiBold.ttf").as_slice(),
        ),
        (
            700,
            include_bytes!("../fonts/MedBrainsSans-Bold.ttf").as_slice(),
        ),
    ]
    .iter()
    .map(|(weight, data)| font_face("MedBrains Sans", *weight, "truetype", data, ARIAL_LINE_BOX))
    .collect()
});

/// IBM Plex Mono for `.mono` text (UHIDs, codes): IBM's own Latin-1 file, unmodified.
static MONO_FACE: LazyLock<String> = LazyLock::new(|| {
    font_face(
        "IBM Plex Mono",
        400,
        "woff2",
        include_bytes!("../fonts/IBMPlexMono-Regular-Latin1.woff2"),
        "",
    )
});

/// Arial's line box (ascent, descent, line gap as a share of the em), the previous print default.
/// Printed documents keep it so a page, a label or a wristband stays the height it was laid out
/// for: `MedBrains Sans`' own line box (1.3 em) is taller than Arial's (1.15 em).
const ARIAL_LINE_BOX: &str =
    "ascent-override: 90.5%; descent-override: 21.2%; line-gap-override: 3.3%;";

/// One `@font-face` rule with the font inlined as a base64 data URI.
fn font_face(family: &str, weight: u16, format: &str, data: &[u8], metrics: &str) -> String {
    let mime = if format == "woff2" {
        "font/woff2"
    } else {
        "font/ttf"
    };
    format!(
        "@font-face {{ font-family: \"{family}\"; font-weight: {weight}; {metrics} src: url(data:{mime};base64,{}) format(\"{format}\"); }}\n",
        STANDARD.encode(data)
    )
}

/// Shared page chrome: letterhead, watermark layer, print CSS reset.
/// Forest + Copper defaults; every value overridable via `branding`.
const BASE_TEMPLATE: &str = r##"<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  {% if not branding.font_family %}{{ print_sans_faces | safe }}{% endif %}
  {{ print_mono_face | safe }}
  :root {
    --brand: {{ branding.brand_color | default(value="#1F4332") }};
    --ink: #0F1412;
    --rule: #e7ebe8;
    --copper: #B8924A;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { color: var(--ink); font-family: {{ branding.font_family | default(value="MedBrains Sans, Arial, Helvetica, sans-serif") }}; font-size: {{ branding.font_size_pt | default(value=10) }}pt; }
  table { border-collapse: collapse; width: 100%; }
  th, td { padding: 4px 6px; text-align: left; }
  thead th { border-bottom: 1.5px solid var(--brand); font-weight: 600; }
  tbody td { border-bottom: 0.5px solid var(--rule); }
  .mono { font-family: "IBM Plex Mono", "Courier New", monospace; }
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
  {% if signature.verify_qr_svg %}<div class="signature-qr"><div style="width:72px;margin-left:auto;">{{ signature.verify_qr_svg | safe }}</div><div class="muted small">Scan to check this document is unchanged</div></div>{% endif %}
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
    let mut ctx = tera::Context::from_value(context.clone())?;
    ctx.insert("print_sans_faces", SANS_FACES.as_str());
    ctx.insert("print_mono_face", MONO_FACE.as_str());
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
            "branding": { "hospital_name": "Example Hospital" },
            "watermark": "duplicate",
            "invoice": { "number": "INV-000123", "total": "1,250.00" },
            "document_number": "BIL-20260612-0001",
        });
        let html = render_html(template, &ctx).expect("render");
        assert!(html.contains("Invoice INV-000123"));
        assert!(html.contains("1,250.00"));
        assert!(html.contains("Example Hospital"));
        assert!(html.contains("DUPLICATE"));
    }

    /// Printed doses and IDs use MedBrains Sans and IBM Plex Mono, inlined so the
    /// renderer needs nothing installed.
    #[test]
    fn default_print_font_is_embedded_medbrains_sans() {
        let template = r#"{% extends "base.html" %}{% block content %}<p class="mono">MB-1</p>{% endblock content %}"#;
        let html = render_html(template, &serde_json::json!({ "branding": {} })).expect("render");
        // Unquoted: the base template is HTML-escaped, and a quoted family would reach the CSS as &quot;.
        assert!(html.contains("font-family: MedBrains Sans, Arial, Helvetica, sans-serif;"));
        assert_eq!(
            html.matches(r#"font-family: "MedBrains Sans"; font-weight"#)
                .count(),
            3
        );
        assert!(html.contains("data:font/ttf;base64,"));
        assert!(html.contains(r#".mono { font-family: "IBM Plex Mono""#));
        assert!(html.contains("data:font/woff2;base64,"));
    }

    /// A hospital's own font choice wins, and the unused MedBrains Sans faces are
    /// left out so the renderer is not sent them; Plex Mono stays for `.mono`.
    #[test]
    fn hospital_font_override_still_wins() {
        let template =
            r#"{% extends "base.html" %}{% block content %}<p>x</p>{% endblock content %}"#;
        let ctx = serde_json::json!({ "branding": { "font_family": "Georgia, serif" } });
        let html = render_html(template, &ctx).expect("render");
        assert!(html.contains("font-family: Georgia, serif;"));
        assert!(!html.contains(r#"font-family: "MedBrains Sans"; font-weight"#));
        assert!(html.contains(r#"font-family: "IBM Plex Mono"; font-weight"#));
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
