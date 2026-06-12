//! Server-side document rendering: Tera HTML templates with dynamic
//! data → PDF via a Gotenberg (headless Chromium) container.
//!
//! Decision record: docs/architecture/document-templating.md. This is
//! the industry-mainstream pipeline (Gotenberg is the production
//! reference for HTML→PDF; ERPNext/Frappe render the same way) — the
//! existing frontend print HTML ports nearly unchanged, CSS/colors are
//! pixel-faithful Chrome output, and `@page` rules give exact mm sizes
//! for labels, wristbands and thermal rolls.

pub mod codes;
pub mod engine;
pub mod gotenberg;
pub mod paper;
pub mod templates;

#[derive(Debug, thiserror::Error)]
pub enum PrintError {
    #[error("template error: {0}")]
    Template(#[from] tera::Error),

    #[error("gotenberg unavailable: {0}")]
    GotenbergUnavailable(String),

    #[error("gotenberg render failed: {0}")]
    Render(String),

    #[error("barcode error: {0}")]
    Barcode(String),
}
