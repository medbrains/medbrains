//! Client error telemetry redaction — strips UUID-like route identifiers from
//! error reports before they leave the server boundary.
//!
//! Prevents patient UUIDs and other sensitive identifiers from leaking into
//! client screen crash reports or external telemetry sinks.

use regex::Regex;

static UUID_RE: once_cell::sync::Lazy<Regex> = once_cell::sync::Lazy::new(|| {
    Regex::new(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
        .expect("valid UUID regex")
});

/// Redact UUID-like path segments from a URL or error message.
pub fn redact_uuid_path_segments(input: &str) -> String {
    UUID_RE.replace_all(input, "[redacted]").to_string()
}

/// Strip query string from a route before logging — prevents leaking
/// sensitive query params (tokens, patient IDs) into crash telemetry.
pub fn route_without_query(route: &str) -> &str {
    route.split('?').next().unwrap_or(route)
}

/// Format a client screen crash event for telemetry, applying all redaction
/// passes so no PHI reaches external systems.
pub fn redact_client_screen_crash(screen: &str, route: &str, message: &str) -> String {
    let safe_screen = redact_uuid_path_segments(screen);
    let safe_route = redact_uuid_path_segments(route_without_query(route));
    let safe_message = redact_uuid_path_segments(message);
    format!(
        "client screen crash: screen={safe_screen} route={safe_route} msg={safe_message}"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacts_patient_uuid_in_path() {
        let input = "/api/patients/550e8400-e29b-41d4-a716-446655440000/appointments";
        let result = redact_uuid_path_segments(input);
        assert_eq!(result, "/api/patients/[redacted]/appointments");
    }

    #[test]
    fn route_without_query_strips_params() {
        assert_eq!(route_without_query("/patients/123?tab=history"), "/patients/123");
    }

    #[test]
    fn client_screen_crash_redacts_all() {
        let out = redact_client_screen_crash(
            "PatientDetail/550e8400-e29b-41d4-a716-446655440000",
            "/patients/550e8400-e29b-41d4-a716-446655440000",
            "null pointer at line 42",
        );
        assert!(!out.contains("550e8400"));
        assert!(out.contains("[redacted]"));
    }
}
