//! What setup accepts, and how it is written down. No I/O, so all of it is tested.

/// A problem with one field, in words for the screen.
pub type Problems = Vec<(&'static str, String)>;

/// Checks the three fields of a new hospital. The password rules match the server's
/// `validate_password`, so a password accepted here is accepted later too.
pub fn check_new_hospital(hospital: &str, username: &str, password: &str) -> Problems {
    let mut problems = Problems::new();
    let name = hospital.trim();
    if name.chars().count() < 2 || name.chars().count() > 100 {
        problems.push(("hospital", "Enter the hospital's name.".to_owned()));
    }
    if hospital.chars().any(char::is_control) {
        problems.push(("hospital", "The name has a character that cannot be used.".to_owned()));
    }
    if !is_username(username) {
        let rule = "Use 3 to 30 lowercase letters, digits, dots, dashes or underscores, \
                    starting with a letter.";
        problems.push(("username", rule.to_owned()));
    }
    if let Some(rule) = password_problem(password) {
        problems.push(("password", rule.to_owned()));
    }
    problems
}

/// True for a name the server would accept as a username.
fn is_username(value: &str) -> bool {
    (3..=30).contains(&value.len())
        && value.starts_with(|c: char| c.is_ascii_lowercase())
        && value
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || "._-".contains(c))
}

/// The first rule a password breaks, if any.
fn password_problem(value: &str) -> Option<&'static str> {
    if value.chars().any(char::is_control) {
        return Some("The password has a character that cannot be used.");
    }
    if value.len() < 8 {
        return Some("Use at least 8 characters.");
    }
    let classes = [
        value.chars().any(char::is_uppercase),
        value.chars().any(char::is_lowercase),
        value.chars().any(|c| c.is_ascii_digit()),
        value.chars().any(|c| !c.is_alphanumeric()),
    ];
    (!classes.iter().all(|has| *has))
        .then_some("Use a capital letter, a small letter, a number and a symbol.")
}

/// One `KEY="value"` line for a systemd `EnvironmentFile`, quoted so that no value
/// can end the line or start another setting.
fn env_line(key: &str, value: &str) -> String {
    let quoted = value.replace('\\', "\\\\").replace('"', "\\\"");
    format!("{key}=\"{quoted}\"\n")
}

/// The lines the server's seed reads once. `console-status` removes them after that.
pub fn seed_env(hospital: &str, username: &str, password: &str) -> String {
    [
        ("MEDBRAINS_SEED_HOSPITAL_NAME", hospital.trim()),
        ("MEDBRAINS_SEED_ADMIN_USERNAME", username),
        ("MEDBRAINS_SEED_ADMIN_PASSWORD", password),
        ("MEDBRAINS_SEED_ADMIN_PASSWORD_CHOSEN", "true"),
    ]
    .iter()
    .map(|(key, value)| env_line(key, value))
    .collect()
}

/// True for dotted IPv4 such as `192.168.1.20`.
pub fn is_ipv4(value: &str) -> bool {
    value.parse::<std::net::Ipv4Addr>().is_ok()
}

/// True for an IPv4 address with a prefix, such as `192.168.1.20/24`.
pub fn is_ipv4_prefix(value: &str) -> bool {
    value
        .split_once('/')
        .is_some_and(|(ip, bits)| is_ipv4(ip) && bits.parse::<u8>().is_ok_and(|b| (1..=32).contains(&b)))
}

/// True for a network interface name that is safe to put in a file name and a command.
pub fn is_interface(value: &str) -> bool {
    (1..=15).contains(&value.len())
        && value.chars().all(|c| c.is_ascii_alphanumeric() || "._-".contains(c))
}

/// The networkd file for a fixed address.
pub fn fixed_network(interface: &str, address: &str, gateway: &str, dns: &str) -> String {
    format!(
        "[Match]\nName={interface}\n\n[Network]\nAddress={address}\nGateway={gateway}\nDNS={dns}\nMulticastDNS=yes\n"
    )
}

#[cfg(test)]
mod tests {
    use super::{check_new_hospital, fixed_network, is_interface, is_ipv4_prefix, seed_env};

    const GOOD: &str = "Ward-Seven7";

    #[test]
    fn a_new_hospital_needs_a_name_a_username_and_a_real_password() {
        assert!(check_new_hospital("City Hospital", "admin", GOOD).is_empty());
        assert_eq!(check_new_hospital(" ", "admin", GOOD)[0].0, "hospital");
        assert_eq!(check_new_hospital("City", "Admin", GOOD)[0].0, "username");
        assert_eq!(check_new_hospital("City", "admin", "short")[0].0, "password");
        assert_eq!(check_new_hospital("City", "admin", "alllowercase1!")[0].0, "password");
    }

    /// A password must not be able to write a second setting into the env file.
    #[test]
    fn nothing_typed_can_add_a_line_to_the_env_file() {
        assert_eq!(check_new_hospital("City", "admin", "Ab1!\nEVIL=1")[0].0, "password");
        assert_eq!(check_new_hospital("City\nEVIL=1", "admin", GOOD)[0].0, "hospital");
        let env = seed_env("St \"Mary\" \\ Co", "admin", "Ab1!\"\\x$y");
        assert!(env.contains("HOSPITAL_NAME=\"St \\\"Mary\\\" \\\\ Co\""));
        assert!(env.contains("ADMIN_PASSWORD=\"Ab1!\\\"\\\\x$y\""));
        assert_eq!(env.lines().count(), 4);
    }

    #[test]
    fn a_fixed_address_is_checked_before_it_reaches_a_file() {
        assert!(is_ipv4_prefix("192.168.1.20/24"));
        assert!(!is_ipv4_prefix("192.168.1.20"));
        assert!(!is_ipv4_prefix("192.168.1.20/33"));
        assert!(!is_ipv4_prefix("1.1.1.1/24\nDNS=9.9.9.9"));
        assert!(is_interface("enp0s1"));
        assert!(!is_interface("en0\n[Network]"));
        assert!(fixed_network("en0", "10.0.0.2/24", "10.0.0.1", "10.0.0.1").contains("Name=en0"));
    }
}
