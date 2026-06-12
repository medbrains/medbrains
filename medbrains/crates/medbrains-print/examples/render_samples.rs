//! Render every built-in document template against its sample context
//! via live Gotenberg — the manual verification harness for template
//! work.
//!
//! Usage: make dev (or docker compose up -d gotenberg), then
//!   cargo run -p medbrains-print --example render_samples
//! PDFs land in /tmp/medbrains-docs/.

use medbrains_print::codes;
use medbrains_print::engine::render_html;
use medbrains_print::gotenberg::GotenbergClient;
use medbrains_print::templates::SYSTEM_TEMPLATES;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let url = std::env::var("GOTENBERG_URL").unwrap_or_else(|_| "http://127.0.0.1:3005".to_owned());
    let client = GotenbergClient::new(&url, reqwest::Client::new());
    std::fs::create_dir_all("/tmp/medbrains-docs")?;

    let branding = serde_json::json!({
        "hospital_name": "Alagappa Medical College & Hospital",
        "address": "College Road, Karaikudi, Tamil Nadu 630003",
        "phone": "+91 4565 223344",
        "registration_no": "TN/MC/2026/0042",
    });

    for template in SYSTEM_TEMPLATES {
        let mut context: serde_json::Value = serde_json::from_str(template.sample_context)?;
        if let Some(obj) = context.as_object_mut() {
            obj.entry("branding").or_insert_with(|| branding.clone());
            obj.entry("generated_at")
                .or_insert_with(|| serde_json::json!("2026-06-12 10:30 UTC"));
            // Real barcodes/QRs in place of the grey placeholders.
            if let Some(band) = obj.get_mut("band").and_then(|b| b.as_object_mut()) {
                band.insert(
                    "barcode_svg".to_owned(),
                    serde_json::json!(codes::code128_svg("ACMS-2026-00042", 40)?),
                );
                band.insert(
                    "qr_svg".to_owned(),
                    serde_json::json!(codes::qr_svg("mb:admission:demo")?),
                );
            }
            if let Some(label) = obj.get_mut("label").and_then(|l| l.as_object_mut()) {
                label.insert(
                    "qr_svg".to_owned(),
                    serde_json::json!(codes::qr_svg("mb:rxitem:demo")?),
                );
            }
        }

        let html = render_html(template.html, &context)?;
        let pdf = client
            .html_to_pdf(&html, template.paper, template.margins)
            .await?;
        let path = format!("/tmp/medbrains-docs/{}.pdf", template.code);
        std::fs::write(&path, &pdf)?;
        println!("{:<28} {:>7} bytes  {}", template.code, pdf.len(), path);
    }

    Ok(())
}
