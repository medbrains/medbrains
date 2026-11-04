//! What setup accepts, and how it is written down. No I/O, so all of it is tested.

/// A problem with one field, in words for the screen.
pub(crate) type Problems = Vec<(&'static str, &'static str)>;

/// What a hospital name must be. The screen shows these as hints before anyone types.
const HOSPITAL_RULE: &str = "2 to 100 characters, on one line.";
/// What a username must be, matching what sign-in accepts.
const USERNAME_RULE: &str =
    "3 to 30 lowercase letters, digits, dots, dashes or underscores, starting with a letter.";
/// What a password must be, matching the server's `validate_password`.
const PASSWORD_RULE: &str =
    "At least 8 characters, with a capital letter, a small letter, a number and a symbol.";

/// Every line the server's seed reads once starts with this, so it can be taken out again.
const SEED_PREFIX: &str = "MEDBRAINS_SEED_";

/// Checks the three fields of a new hospital. A password accepted here is accepted later
/// too, because these are the server's rules.
pub(crate) fn check_new_hospital(hospital: &str, username: &str, password: &str) -> Problems {
    let mut problems = Problems::new();
    if !is_hospital_name(hospital) {
        problems.push(("hospital", HOSPITAL_RULE));
    }
    if !is_username(username) {
        problems.push(("username", USERNAME_RULE));
    }
    if !is_password(password) {
        problems.push(("password", PASSWORD_RULE));
    }
    problems
}

/// True for a name that fits the screen and cannot break the env file.
fn is_hospital_name(value: &str) -> bool {
    let length = value.trim().chars().count();
    (2..=100).contains(&length) && !value.chars().any(char::is_control)
}

/// True for a name the server would accept as a username.
fn is_username(value: &str) -> bool {
    (3..=30).contains(&value.len())
        && value.starts_with(|c: char| c.is_ascii_lowercase())
        && value
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || "._-".contains(c))
}

/// True for a password the server's rules accept. Control characters are refused too,
/// because this one travels through an env file.
fn is_password(value: &str) -> bool {
    value.len() >= 8
        && !value.chars().any(char::is_control)
        && value.chars().any(char::is_uppercase)
        && value.chars().any(char::is_lowercase)
        && value.chars().any(|c| c.is_ascii_digit())
        && value.chars().any(|c| !c.is_alphanumeric())
}

/// One `KEY="value"` line for a systemd `EnvironmentFile`, quoted so that no value
/// can end the line or start another setting.
fn env_line(key: &str, value: &str) -> String {
    let quoted = value.replace('\\', "\\\\").replace('"', "\\\"");
    format!("{key}=\"{quoted}\"\n")
}

/// The env file with no seed lines.
pub(crate) fn env_without_seed(env: &str) -> String {
    let kept = env.lines().filter(|line| !line.starts_with(SEED_PREFIX));
    kept.map(|line| format!("{line}\n")).collect()
}

/// The env file with this hospital's seed lines in place of any left by an interrupted attempt. It
/// carries the password's hash, never the password, so the disk never holds what was typed.
pub(crate) fn env_with_seed(
    env: &str,
    hospital: &str,
    username: &str,
    password_hash: &str,
) -> String {
    let mut out = env_without_seed(env);
    for (key, value) in [
        ("MEDBRAINS_SEED_HOSPITAL_NAME", hospital.trim()),
        ("MEDBRAINS_SEED_ADMIN_USERNAME", username),
        ("MEDBRAINS_SEED_ADMIN_PASSWORD_HASH", password_hash),
        ("MEDBRAINS_SEED_ADMIN_PASSWORD_CHOSEN", "true"),
    ] {
        out.push_str(&env_line(key, value));
    }
    out
}

/// The certificate in what the agent recorded on approval, or `None` if it is not one. It becomes
/// the only certificate the screen trusts, so anything else is refused.
pub(crate) fn joined_certificate(joined: &str) -> Option<String> {
    let parsed: serde_json::Value = serde_json::from_str(joined).ok()?;
    let certificate = parsed.get("certificate")?.as_str()?;
    (certificate.starts_with("-----BEGIN CERTIFICATE-----") && certificate.contains("-----END CERTIFICATE-----"))
        .then(|| certificate.to_owned())
}

/// The hospital's name in what the agent recorded, if it is fit to show.
pub(crate) fn joined_hospital(joined: &str) -> Option<String> {
    let parsed: serde_json::Value = serde_json::from_str(joined).ok()?;
    let name = parsed.get("hospital")?.as_str()?.trim();
    is_hospital_name(name).then(|| name.to_owned())
}

/// True for dotted IPv4 such as `192.168.1.20`.
fn is_ipv4(value: &str) -> bool {
    value.parse::<std::net::Ipv4Addr>().is_ok()
}

/// True for an IPv4 address with a prefix, such as `192.168.1.20/24`.
fn is_ipv4_prefix(value: &str) -> bool {
    value.split_once('/').is_some_and(|(ip, bits)| {
        is_ipv4(ip) && bits.parse::<u8>().is_ok_and(|b| (1..=32).contains(&b))
    })
}

/// True for a network interface name that is safe to put in a file and a command.
fn is_interface(value: &str) -> bool {
    (1..=15).contains(&value.len())
        && value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "._-".contains(c))
}

/// The networkd file for a fixed address, or `None` if a field is not valid. The gateway
/// and DNS may be empty: an isolated hospital network has neither.
pub(crate) fn fixed_network(
    interface: &str,
    address: &str,
    gateway: &str,
    dns: &str,
) -> Option<String> {
    let optional = |value: &str| value.is_empty() || is_ipv4(value);
    if !is_interface(interface) || !is_ipv4_prefix(address) || !optional(gateway) || !optional(dns)
    {
        return None;
    }
    let mut file =
        format!("[Match]\nName={interface}\n\n[Network]\nAddress={address}\nMulticastDNS=yes\n");
    if !gateway.is_empty() {
        file += &format!("Gateway={gateway}\n");
    }
    if !dns.is_empty() {
        file += &format!("DNS={dns}\n");
    }
    // mDNS needs a route, and an isolated hospital network has no gateway to supply one. The metric
    // puts the address a person chose ahead of any DHCP link.
    file += "\n[Route]\nDestination=224.0.0.0/4\nScope=link\nMetric=100\n";
    Some(file)
}

/// The networkd file that makes a link the one tried first: a lower route metric than the 1024 the
/// default file gives every link, or `None` if the name isn't safe. The rest stay up.
pub(crate) fn preferred_network(interface: &str) -> Option<String> {
    is_interface(interface).then(|| {
        format!(
            "[Match]\nName={interface}\n\n[Network]\nDHCP=yes\nMulticastDNS=yes\n\n\
             [DHCPv4]\nRouteMetric=100\n\n[IPv6AcceptRA]\nRouteMetric=100\n"
        )
    })
}

#[cfg(test)]
mod tests {
    use super::{check_new_hospital, env_with_seed, fixed_network, preferred_network};

    /// This file decides what the screen trusts: a bad one must not reach it.
    #[test]
    fn only_a_certificate_is_taken_from_what_the_agent_recorded() {
        let good = r#"{"certificate":"-----BEGIN CERTIFICATE-----\nx\n-----END CERTIFICATE-----\n"}"#;
        assert!(super::joined_certificate(good).is_some());
        assert_eq!(super::joined_certificate(r#"{"certificate":"anything"}"#), None);
        assert_eq!(super::joined_certificate(r#"{"other":1}"#), None);
        assert_eq!(super::joined_certificate("not json"), None);
        assert_eq!(super::joined_hospital(r#"{"hospital":"City"}"#).as_deref(), Some("City"));
        assert_eq!(super::joined_hospital("{\"hospital\":\"a\\nb\"}"), None);
    }

    
    const GOOD: &str = "Ward-Seven7";

    #[test]
    fn a_new_hospital_needs_a_name_a_username_and_a_real_password() {
        assert!(check_new_hospital("City Hospital", "admin", GOOD).is_empty());
        assert_eq!(check_new_hospital(" ", "admin", GOOD)[0].0, "hospital");
        assert_eq!(check_new_hospital("City", "Admin", GOOD)[0].0, "username");
        assert_eq!(
            check_new_hospital("City", "admin", "short")[0].0,
            "password"
        );
        assert_eq!(
            check_new_hospital("City", "admin", "alllowercase1!")[0].0,
            "password"
        );
    }

    /// A password must not be able to write a second setting into the env file.
    #[test]
    fn nothing_typed_can_add_a_line_to_the_env_file() {
        assert_eq!(
            check_new_hospital("City", "admin", "Ab1!\nEVIL=1")[0].0,
            "password"
        );
        assert_eq!(
            check_new_hospital("City\nEVIL=1", "admin", GOOD)[0].0,
            "hospital"
        );
        let env = env_with_seed("", "St \"Mary\" \\ Co", "admin", "Ab1!\"\\x$y");
        assert!(env.contains("HOSPITAL_NAME=\"St \\\"Mary\\\" \\\\ Co\""));
        assert!(env.contains("PASSWORD_HASH=\"Ab1!\\\"\\\\x$y\""));
        assert_eq!(env.lines().count(), 4);
    }

    /// A power cut mid-setup followed by a different password must not keep the first one.
    #[test]
    fn repeating_setup_replaces_the_seed_lines_and_keeps_everything_else() {
        let first = env_with_seed("MEDBRAINS_ENV=production\n", "City", "admin", "First-Pass1");
        let second = env_with_seed(&first, "City", "admin", "Other-Pass2");
        assert!(!second.contains("First-Pass1"));
        assert!(second.contains("Other-Pass2"));
        assert!(second.starts_with("MEDBRAINS_ENV=production\n"));
        assert_eq!(second.lines().count(), 5);
    }

    #[test]
    fn the_preferred_link_gets_a_lower_metric_and_a_safe_name() {
        let file = preferred_network("enp0s4").unwrap_or_default();
        assert!(file.contains("Name=enp0s4") && file.contains("RouteMetric=100"));
        assert_eq!(preferred_network("en0\n[Network]"), None);
    }

    #[test]
    fn a_fixed_address_is_checked_before_it_reaches_a_file() {
        let file = |address, gateway| fixed_network("en0", address, gateway, "");
        assert!(file("192.168.1.20/24", "192.168.1.1").is_some_and(|f| f.contains("Name=en0")));
        assert!(file("192.168.1.20/24", "").is_some_and(|f| !f.contains("Gateway")));
        // With no gateway, this route is the only way mDNS can find a main machine.
        assert!(file("192.168.1.20/24", "").is_some_and(|f| f.contains("Destination=224.0.0.0/4")));
        assert!(file("192.168.1.20", "192.168.1.1").is_none());
        assert!(file("192.168.1.20/33", "192.168.1.1").is_none());
        assert!(file("1.1.1.1/24\nDNS=9.9.9.9", "1.1.1.1").is_none());
        assert!(file("192.168.1.20/24", "1.1.1.1\nDNS=9.9.9.9").is_none());
        assert!(fixed_network("en0\n[Network]", "10.0.0.2/24", "", "").is_none());
    }
}
