//! Working out what a payload is when nobody said.

use crate::Format;

/// Pick a format from the `Content-Type` header, falling back to the body.
///
/// The header is trusted first because it is the sender's own statement of
/// intent, but plenty of APIs send `text/plain` for JSON, so a header that
/// tells us nothing useful defers to the text itself.
#[must_use]
pub fn detect(content_type: &str, body: &str) -> Format {
    let header = content_type.to_ascii_lowercase();

    if header.contains("soap") {
        return Format::Soap;
    }
    if header.contains("json") {
        return Format::Json;
    }
    // Checked before XML on purpose: the OOXML content type contains the
    // substring "spreadsheetml", which the XML branch would otherwise claim.
    if header.contains("spreadsheetml") || header.contains("ms-excel") {
        return Format::Xlsx;
    }
    if header.contains("xml") {
        // A SOAP envelope is XML, and callers want the payload, not the wrapper.
        return if looks_like_soap(body) {
            Format::Soap
        } else {
            Format::Xml
        };
    }
    if header.contains("yaml") {
        return Format::Yaml;
    }
    if header.contains("toml") {
        return Format::Toml;
    }
    if header.contains("csv") {
        return Format::Csv;
    }
    if header.contains("x-www-form-urlencoded") {
        return Format::Form;
    }
    sniff(body)
}

/// Guess from the text alone. Deliberately conservative: anything it cannot
/// place confidently comes back as [`Format::Text`], because mis-parsing is
/// worse than not parsing.
#[must_use]
pub fn sniff(body: &str) -> Format {
    let trimmed = body.trim();
    if trimmed.is_empty() {
        return Format::Text;
    }

    if trimmed.starts_with('{') || trimmed.starts_with('[') {
        return Format::Json;
    }
    if trimmed.starts_with("<?xml") || trimmed.starts_with('<') {
        return if looks_like_soap(trimmed) {
            Format::Soap
        } else {
            Format::Xml
        };
    }
    if trimmed.starts_with("---") {
        return Format::Yaml;
    }
    if looks_like_form(trimmed) {
        return Format::Form;
    }
    Format::Text
}

fn looks_like_soap(body: &str) -> bool {
    let head: String = body
        .chars()
        .take(600)
        .collect::<String>()
        .to_ascii_lowercase();
    head.contains(":envelope") || head.contains("<envelope")
}

/// `a=1&b=2` with no whitespace and no newlines. The absence of whitespace is
/// what separates it from prose that happens to contain an equals sign.
fn looks_like_form(body: &str) -> bool {
    if body.contains(char::is_whitespace) || !body.contains('=') {
        return false;
    }
    body.split('&').all(|pair| {
        let mut parts = pair.splitn(2, '=');
        parts.next().is_some_and(|key| !key.is_empty()) && parts.next().is_some()
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_content_type_is_believed_first() {
        assert_eq!(
            detect("application/json; charset=utf-8", "not json"),
            Format::Json
        );
        assert_eq!(detect("text/csv", "a,b"), Format::Csv);
        assert_eq!(detect("application/yaml", "a: 1"), Format::Yaml);
    }

    #[test]
    fn a_soap_envelope_is_recognised_however_it_is_labelled() {
        let envelope =
            r#"<?xml version="1.0"?><soap:Envelope xmlns:soap="x"><soap:Body/></soap:Envelope>"#;
        assert_eq!(detect("application/soap+xml", envelope), Format::Soap);
        assert_eq!(detect("text/xml", envelope), Format::Soap);
        assert_eq!(detect("", envelope), Format::Soap);
    }

    #[test]
    fn plain_xml_is_not_mistaken_for_soap() {
        assert_eq!(detect("text/xml", "<order><id>1</id></order>"), Format::Xml);
    }

    #[test]
    fn a_useless_content_type_defers_to_the_body() {
        // Plenty of APIs send JSON as text/plain.
        assert_eq!(detect("text/plain", r#"{"a":1}"#), Format::Json);
        assert_eq!(detect("", "[1,2,3]"), Format::Json);
    }

    #[test]
    fn form_bodies_are_recognised_by_shape() {
        assert_eq!(
            sniff("grant_type=client_credentials&scope=read"),
            Format::Form
        );
        assert_eq!(sniff("a=1"), Format::Form);
    }

    #[test]
    fn prose_containing_an_equals_sign_is_not_a_form() {
        assert_eq!(sniff("the answer = 42"), Format::Text);
        assert_eq!(sniff("x=1\ny=2"), Format::Text);
    }

    #[test]
    fn an_empty_body_is_text_rather_than_a_parse_failure() {
        assert_eq!(sniff(""), Format::Text);
        assert_eq!(sniff("   \n "), Format::Text);
    }

    #[test]
    fn a_yaml_document_marker_is_recognised() {
        assert_eq!(sniff("---\nname: r8r\n"), Format::Yaml);
    }

    #[test]
    fn anything_unrecognised_stays_text() {
        assert_eq!(sniff("just a sentence"), Format::Text);
    }
}
