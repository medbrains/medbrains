//! Tauri bindings for `medbrains-printing`.
//!
//! Nothing but translation: the SPA's `invoke` shape in, the crate's types
//! out, errors flattened to strings because that is all the bridge carries.
//! The logic — spooling, filter selection, the empty-document guard — lives in
//! the crate so it is testable without a printer and reusable by any other
//! surface that grows one.

use medbrains_printing::PrinterInfo;

#[tauri::command]
pub(crate) async fn list_printers() -> Result<Vec<PrinterInfo>, String> {
    Ok(medbrains_printing::list_printers())
}

#[tauri::command]
pub(crate) async fn print_pdf(
    printer_name: Option<String>,
    pdf_bytes: Vec<u8>,
) -> Result<(), String> {
    medbrains_printing::print_pdf(printer_name.as_deref(), &pdf_bytes)
        .map_err(|error| error.to_string())
}
