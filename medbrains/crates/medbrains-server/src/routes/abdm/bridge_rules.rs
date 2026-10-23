//! The pure rules of bridge registration: HFR's `hipName` limits, which
//! bridge service ids belong to a campus, and reading HFR's answers.
//! Sources: the HFR documentation (sandboxcms.abdm.gov.in) and OHC
//! care-abdm's sandbox measurements (MIT, docs/findings.md B18/B20).

use serde_json::Value;

/// HFR: "HIP name can not be more than 15 characters".
pub(super) const HIP_NAME_MAX: usize = 15;

/// HFR's rules for `hipName`: no special characters, at most 15 characters.
pub(super) fn hip_name(name: &str) -> String {
    let kept: String = name
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { ' ' })
        .collect();
    let words = kept.split_whitespace().collect::<Vec<_>>().join(" ");
    words
        .chars()
        .take(HIP_NAME_MAX)
        .collect::<String>()
        .trim_end()
        .to_owned()
}

/// Whether `service` is this facility's: the HFR ID itself, or `<HFR ID>_<n>`.
pub(super) fn belongs_to(service: &str, hfr_facility_id: &str) -> bool {
    let (service, hfr) = (service.to_uppercase(), hfr_facility_id.to_uppercase());
    service == hfr
        || service
            .strip_prefix(&format!("{hfr}_"))
            .is_some_and(|n| !n.is_empty() && n.chars().all(|c| c.is_ascii_digit()))
}

/// The service id an HFR answer names, when it is this facility's: in
/// `servicesLinked.id`, or in an "already associated" refusal — the HFR
/// documentation's "…with service id:IN28…" or the sandbox's
/// "…for Service-Id=IN32…, Service-Name=…" (care-abdm B20).
fn service_named(item: &Value, facility: &str) -> Option<String> {
    let linked = item["servicesLinked"]["id"].as_str().map(str::to_owned);
    let message = item["error"]["message"].as_str().unwrap_or_default();
    let refused = ["Service-Id=", "service id:", "service id: "]
        .iter()
        .find_map(|tag| message.split(tag).nth(1))
        .map(|rest| {
            rest.trim()
                .split([',', ' '])
                .next()
                .unwrap_or_default()
                .to_owned()
        });
    linked.or(refused).filter(|id| belongs_to(id, facility))
}

/// What HFR said about each HRP entry (`servicesLinked` or `error`), and
/// the service id it named. "Already associated" with this facility is
/// success: registration is once per bridge and facility (care-abdm B20).
pub(super) fn read_hfr_answer(answer: &Value, facility: &str) -> (bool, String, Option<String>) {
    let items = answer
        .as_array()
        .cloned()
        .unwrap_or_else(|| vec![answer.clone()]);
    let mut ok = !items.is_empty();
    let mut service = None;
    let mut lines = Vec::with_capacity(items.len());
    for item in &items {
        let named = service_named(item, facility);
        if let Some(linked) = item.get("servicesLinked") {
            lines.push(format!("Linked as {}", linked["types"]));
        } else {
            let message = item["error"]["message"]
                .as_str()
                .unwrap_or("HFR gave no answer");
            ok &= named.is_some() && message.contains("already associated");
            lines.push(message.to_owned());
        }
        service = service.or(named);
    }
    (ok, lines.join("; "), service)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{belongs_to, hip_name, read_hfr_answer};

    #[test]
    fn a_hip_name_follows_hfrs_rules() {
        assert_eq!(
            hip_name("St. Mary's Hospital & Research"),
            "St Mary s Hospi"
        );
        assert_eq!(hip_name("  City   Clinic "), "City Clinic");
        assert!(hip_name("Alagappa Multispeciality").chars().count() <= 15);
    }

    /// The HFR documentation's three samples (linked, already linked here,
    /// already linked elsewhere) and the sandbox's own "already associated"
    /// refusal, which names the service id (care-abdm B20).
    #[test]
    fn hfrs_answers_are_read_per_entry() {
        let linked = json!([{ "servicesLinked": { "id": "IN2810000008_1", "types": ["HIP"], "active": true } }]);
        assert_eq!(
            read_hfr_answer(&linked, "IN2810000008"),
            (
                true,
                "Linked as [\"HIP\"]".to_owned(),
                Some("IN2810000008_1".to_owned())
            )
        );
        let here = json!([{ "error": { "code": "2500",
            "message": "Bridge Id SBX_1 is already associated with service id:IN2810000008" } }]);
        assert!(read_hfr_answer(&here, "IN2810000008").0);
        let sandbox = json!([{ "error": { "code": "2500", "message":
            "Bridge-Id=SBXID_035123 is already associated with Hfr-Id=IN3210000772 for Service-Id=IN3210000772_2, Service-Name=SECONDARY FACIL" } }]);
        let (ok, _, service) = read_hfr_answer(&sandbox, "IN3210000772");
        assert!(ok);
        assert_eq!(service.as_deref(), Some("IN3210000772_2"));
        let elsewhere = json!([{ "error": { "code": "2506",
            "message": "Bridge id: SBX_1 is already associated with service id: IN2400000002" } }]);
        let (ok, message, service) = read_hfr_answer(&elsewhere, "IN2810000008");
        assert!(!ok && service.is_none());
        assert!(message.contains("IN2400000002"));
        assert!(!read_hfr_answer(&json!([]), "IN2810000008").0);
    }

    #[test]
    fn a_service_id_is_the_hfr_id_or_it_with_a_number() {
        assert!(belongs_to("IN1410000232_1", "IN1410000232"));
        assert!(belongs_to("in1410000232", "IN1410000232"));
        assert!(!belongs_to("IN14100002321", "IN1410000232"));
        assert!(!belongs_to("IN1410000232_x", "IN1410000232"));
    }
}
