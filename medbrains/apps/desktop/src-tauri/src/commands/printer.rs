use serde::Serialize;

#[derive(Debug, Serialize)]
pub(crate) struct PrinterInfo {
    pub(crate) name: String,
    pub(crate) is_default: bool,
}

/// List system printers. Implementation is a thin wrapper that
/// returns whatever the OS provides; the SPA picks one and passes
/// it back via `print_pdf`.
#[tauri::command]
pub(crate) async fn list_printers() -> Result<Vec<PrinterInfo>, String> {
    // Phase A2 fills this in via the platform-specific crate
    // (printers crate on Win/Linux, CGContext on macOS). For now
    // return an empty list so the SPA falls back to the system
    // print dialog.
    Ok(vec![])
}

/// Send a PDF buffer to the named printer. The SPA generates PDF/A
/// documents (Rx, lab reports, invoices); the desktop hands them to
/// the OS without further interpretation.
#[tauri::command]
pub(crate) async fn print_pdf(
    _printer_name: Option<String>,
    _pdf_bytes: Vec<u8>,
) -> Result<(), String> {
    // Implementation lands in Phase A2 (desktop hardware bridge).
    // Until then, the SPA uses window.print() via the system print
    // dialog, which works through the Tauri webview.
    Err("print_pdf is unimplemented — use window.print() for now".into())
}
