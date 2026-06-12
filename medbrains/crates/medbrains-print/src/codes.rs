//! Barcode/QR generation as inline SVG — embedded directly in template
//! HTML so Chromium renders them vector-sharp at any label size.

use qrcode::QrCode;
use qrcode::render::svg;

use crate::PrintError;

/// QR code as an SVG string. `data` may be an encrypted event token
/// (see `event_tokens`) — the QR layer doesn't care.
pub fn qr_svg(data: &str) -> Result<String, PrintError> {
    let code =
        QrCode::new(data.as_bytes()).map_err(|e| PrintError::Barcode(format!("qr encode: {e}")))?;
    Ok(code
        .render::<svg::Color<'_>>()
        .quiet_zone(true)
        .min_dimensions(96, 96)
        .build())
}

/// Code 128 barcode as an SVG string (UHIDs, sample numbers).
pub fn code128_svg(data: &str, height: u32) -> Result<String, PrintError> {
    use barcoders::sym::code128::Code128;

    // barcoders requires a character-set prefix; À selects set B
    // (full ASCII), right for alphanumeric UHIDs.
    let encoded = Code128::new(format!("\u{c0}{data}"))
        .map_err(|e| PrintError::Barcode(format!("code128 encode: {e:?}")))?
        .encode();

    let mut bars = String::new();
    for (i, bit) in encoded.iter().enumerate() {
        if *bit == 1 {
            bars.push_str(&format!(
                "<rect x=\"{i}\" y=\"0\" width=\"1\" height=\"{height}\" fill=\"#000\"/>"
            ));
        }
    }
    Ok(format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 {} {height}\" \
         preserveAspectRatio=\"none\" width=\"100%\" height=\"{height}\">{bars}</svg>",
        encoded.len()
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn qr_renders_svg() {
        let svg = qr_svg("ACMS-2026-00042").expect("qr");
        assert!(svg.contains("<svg"));
    }

    #[test]
    fn code128_renders_bars() {
        let svg = code128_svg("ACMS-2026-00042", 40).expect("barcode");
        assert!(svg.contains("<rect"));
    }
}
