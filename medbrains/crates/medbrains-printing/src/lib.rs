//! Printing without a dialog.
//!
//! A check-in kiosk cannot show a print dialog. There is nobody standing at it
//! to click "OK", and a modal left open blocks the next patient. So the token
//! slip, the label and the receipt have to reach a named printer with no
//! interaction at all — which the webview's `window.print()` cannot do.
//!
//! Both backends are the ones the OS print dialog itself uses: CUPS on macOS
//! and Linux, winspool on Windows. Reaching them directly is not a workaround,
//! it is the same path without the dialog.
//!
//! Its own crate rather than a module inside the desktop shell, so the logic is
//! testable on its own and reusable by any surface that grows a printer — a
//! ward label station, the edge appliance, a second kiosk build.

use std::io::Write as _;

use printers::common::base::job::PrinterJobOptions;
use printers::common::base::printer::Printer;
use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum PrintError {
    #[error("nothing to print: the document was empty")]
    EmptyDocument,

    #[error("no printer named {0:?} is installed")]
    UnknownPrinter(String),

    #[error("no default printer is configured on this machine")]
    NoDefaultPrinter,

    #[error("could not prepare the document for printing: {0}")]
    Spool(String),

    #[error("{printer} rejected the job: {reason}")]
    Rejected { printer: String, reason: String },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PrinterInfo {
    pub name: String,
    pub is_default: bool,
    /// What the spooler says — `READY`, `OFFLINE`, `PAUSED`, `PRINTING`.
    ///
    /// Surfaced because the failure a ward actually hits is a printer out of
    /// paper, and a kiosk that reports "printed" into a queue nobody collects
    /// from is worse than one that reports it could not.
    pub state: String,
    /// The spooler's own explanation — "media-empty", "toner-low".
    ///
    /// `state` says a printer is down; this says why, which is the difference
    /// between a porter refilling paper and an engineer being called.
    pub state_reasons: Vec<String>,
}

impl From<&Printer> for PrinterInfo {
    fn from(printer: &Printer) -> Self {
        Self {
            name: printer.name.clone(),
            is_default: printer.is_default,
            state: format!("{:?}", printer.state),
            state_reasons: printer.state_reasons.clone(),
        }
    }
}

/// Every printer the system knows about.
///
/// An empty list is a legitimate answer — a fresh kiosk with nothing installed
/// — and is not an error, so a caller can say "no printer configured" rather
/// than "printing failed".
#[must_use]
pub fn list_printers() -> Vec<PrinterInfo> {
    printers::get_printers()
        .iter()
        .map(PrinterInfo::from)
        .collect()
}

/// Send a PDF to a printer, with no dialog.
///
/// `printer_name` omitted means the system default, which is the sane
/// behaviour for a kiosk configured with exactly one printer.
///
/// # Errors
///
/// If the document is empty, the named printer is not installed, there is no
/// default, the spool file cannot be written, or the spooler rejects the job.
pub fn print_pdf(printer_name: Option<&str>, pdf_bytes: &[u8]) -> Result<(), PrintError> {
    if let Some(problem) = document_problem(pdf_bytes) {
        return Err(problem);
    }

    let printer = match printer_name {
        Some(name) => printers::get_printer_by_name(name)
            .ok_or_else(|| PrintError::UnknownPrinter(name.to_owned()))?,
        None => printers::get_default_printer().ok_or(PrintError::NoDefaultPrinter)?,
    };

    let spooled = spool(pdf_bytes)?;
    let path = spooled
        .path()
        .to_str()
        .ok_or_else(|| PrintError::Spool("spool path is not valid UTF-8".to_owned()))?;

    printer
        .print_file(path, PrinterJobOptions::none())
        .map_err(|e| PrintError::Rejected {
            printer: printer.name.clone(),
            // `PrintersError` carries no Display impl — the operator-facing
            // text is in `message`; `failure` is a coarse enum and the
            // backtrace is not for a kiosk screen.
            reason: e.message,
        })
        // The spooler returns a job id. Nothing downstream tracks jobs yet, so
        // it is dropped rather than surfaced as an API nobody consumes.
        .map(|_job_id| ())
}

/// Why this byte string cannot be printed, or `None`.
///
/// Separated from the spooler so the guard can be tested without a printer
/// attached — which is every CI machine.
#[must_use]
pub fn document_problem(pdf_bytes: &[u8]) -> Option<PrintError> {
    if pdf_bytes.is_empty() {
        return Some(PrintError::EmptyDocument);
    }
    None
}

/// Write the document somewhere the spooler can open it.
///
/// A temp file rather than raw bytes on purpose. On CUPS a file goes through
/// the filter chain that knows how to rasterise a PDF for a printer that
/// cannot interpret one; raw bytes bypass that and emit pages of PostScript
/// source on cheaper hardware. The `.pdf` suffix is load-bearing — both CUPS
/// and winspool choose their filter from the extension, and an unnamed temp
/// file is treated as plain text.
fn spool(pdf_bytes: &[u8]) -> Result<tempfile::NamedTempFile, PrintError> {
    let mut file = tempfile::Builder::new()
        .prefix("medbrains-")
        .suffix(".pdf")
        .tempfile()
        .map_err(|e| PrintError::Spool(e.to_string()))?;

    file.write_all(pdf_bytes)
        .map_err(|e| PrintError::Spool(e.to_string()))?;
    // Flush before the spooler opens it by name: an unflushed buffer prints a
    // truncated document rather than failing, which is the worse outcome.
    file.flush().map_err(|e| PrintError::Spool(e.to_string()))?;

    Ok(file)
}

#[cfg(test)]
#[allow(clippy::expect_used)]
mod tests {
    use super::{PrintError, document_problem, list_printers, spool};

    /// An empty buffer means the caller's PDF render failed upstream. Sending
    /// it produces a blank page and a patient who thinks they have a token.
    #[test]
    fn an_empty_document_is_refused_before_reaching_a_printer() {
        assert!(matches!(
            document_problem(&[]),
            Some(PrintError::EmptyDocument)
        ));
    }

    #[test]
    fn a_document_with_content_passes_the_guard() {
        assert!(document_problem(b"%PDF-1.7\n").is_none());
    }

    /// The suffix is load-bearing: CUPS and winspool pick their filter from it,
    /// and without `.pdf` the document prints as its own source text.
    #[test]
    fn the_spool_file_is_named_as_a_pdf() {
        let file = spool(b"%PDF-1.7\n").expect("spool");
        let name = file.path().to_str().expect("utf-8 path").to_owned();
        assert!(name.ends_with(".pdf"), "spool file was {name}");
    }

    #[test]
    fn the_spool_file_holds_the_whole_document() {
        // Larger than one buffer, so an unflushed write would truncate it.
        let doc: Vec<u8> = std::iter::repeat_n(b'x', 128 * 1024).collect();
        let file = spool(&doc).expect("spool");
        let written = std::fs::read(file.path()).expect("read back");
        assert_eq!(written.len(), doc.len());
    }

    /// Runs on a CI machine with no printers. Zero is a valid answer and must
    /// not panic or error — the caller needs to distinguish "none configured"
    /// from "printing failed".
    #[test]
    fn listing_printers_is_safe_with_none_attached() {
        let _ = list_printers();
    }
}
