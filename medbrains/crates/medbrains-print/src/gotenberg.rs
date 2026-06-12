//! Gotenberg client — HTML → PDF via the Chromium convert route.

use reqwest::multipart::{Form, Part};

use crate::PrintError;
use crate::paper::{MarginsMm, Paper};

const MM_PER_INCH: f64 = 25.4;

#[derive(Debug, Clone)]
pub struct GotenbergClient {
    base_url: String,
    http: reqwest::Client,
}

impl GotenbergClient {
    #[must_use]
    pub fn new(base_url: &str, http: reqwest::Client) -> Self {
        Self {
            base_url: base_url.trim_end_matches('/').to_owned(),
            http,
        }
    }

    /// Render an HTML document to PDF bytes at exact paper geometry.
    pub async fn html_to_pdf(
        &self,
        html: &str,
        paper: Paper,
        margins: MarginsMm,
    ) -> Result<Vec<u8>, PrintError> {
        let (width_in, height_in) = paper.size_inches();
        let form = Form::new()
            .part(
                "files",
                Part::text(html.to_owned())
                    .file_name("index.html")
                    .mime_str("text/html")
                    .map_err(|e| PrintError::Render(format!("mime: {e}")))?,
            )
            .text("paperWidth", format!("{width_in:.4}"))
            .text("paperHeight", format!("{height_in:.4}"))
            .text("marginTop", format!("{:.4}", margins.top / MM_PER_INCH))
            .text(
                "marginBottom",
                format!("{:.4}", margins.bottom / MM_PER_INCH),
            )
            .text("marginLeft", format!("{:.4}", margins.left / MM_PER_INCH))
            .text("marginRight", format!("{:.4}", margins.right / MM_PER_INCH))
            .text("printBackground", "true")
            .text("preferCssPageSize", "false");

        let url = format!("{}/forms/chromium/convert/html", self.base_url);
        let response = self
            .http
            .post(&url)
            .multipart(form)
            .send()
            .await
            .map_err(|e| PrintError::GotenbergUnavailable(e.to_string()))?;

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(PrintError::Render(format!("gotenberg {status}: {body}")));
        }

        response
            .bytes()
            .await
            .map(|b| b.to_vec())
            .map_err(|e| PrintError::Render(format!("body read: {e}")))
    }

    /// Liveness probe — used by /api/health to report the renderer.
    pub async fn healthy(&self) -> bool {
        let url = format!("{}/health", self.base_url);
        self.http
            .get(&url)
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false)
    }
}
