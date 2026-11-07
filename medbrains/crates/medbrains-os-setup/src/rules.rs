//! What setup accepts, and how it is written down. No I/O, so all of it is tested.

/// A problem with one field, in words for the screen.
pub(crate) type Problems = Vec<(&'static str, &'static str)>;

/// What a hospital name must be. The screen shows these as hints before anyone types.
const HOSPITAL_RULE: &str = "2 to 100 characters, on one line.";
/// What a username must be, matching what sign-in accepts.
const USERNAME_RULE: &str = "3 to 30 lowercase letters, digits or underscores, starting with a letter. Not admin, idm_admin or anonymous: the identity provider keeps those.";
/// What a password must be: the server's `validate_password` and Kanidm's rule together, because the same
/// password signs in to both. Kanidm's rule for a password with no second step: 15 characters, its strength
/// check at its top score, and not holding the username. Whole phrases pass it.
pub(crate) const PASSWORD_RULE: &str = "At least 15 characters, with a capital letter, a small letter, a number and a symbol. It can't contain your username, and it must be hard to guess. A short phrase works: Blue river walks at 7!";
/// Kanidm's shortest password with no second step. In its source: `PW_SFA_MIN_LENGTH_NIST`.
const KANIDM_MIN_CHARACTERS: usize = 15;
/// Names Kanidm keeps for itself, so a person cannot have them.
const KANIDM_RESERVED: [&str; 3] = ["admin", "idm_admin", "anonymous"];

/// Every line the server's seed reads once starts with this, so it can be taken out again.
const SEED_PREFIX: &str = "MEDBRAINS_SEED_";

/// Checks the three fields of a new hospital. A password accepted here is accepted later
/// too, because these are the server's rules.
pub(crate) fn check_new_hospital(hospital: &str, username: &str, password: &str) -> Problems {
    let mut problems = Problems::new();
    if !is_hospital_name(hospital) {
        problems.push(("hospital", HOSPITAL_RULE));
    }
    if !is_username(username) || KANIDM_RESERVED.contains(&username) {
        problems.push(("username", USERNAME_RULE));
    }
    if !is_password(password) || !kanidm_accepts(password, username) {
        problems.push(("password", PASSWORD_RULE));
    }
    problems
}

/// True for a name that fits the screen and cannot break the env file.
fn is_hospital_name(value: &str) -> bool {
    let length = value.trim().chars().count();
    (2..=100).contains(&length) && !value.chars().any(char::is_control)
}

/// True for a name the server would accept as a username: its database's `chk_users_username_pattern`.
fn is_username(value: &str) -> bool {
    (3..=30).contains(&value.len())
        && value.starts_with(|c: char| c.is_ascii_lowercase())
        && value
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
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

/// True for a password Kanidm's own check would take for this username. Its list of banned passwords is
/// not here, so Kanidm can still refuse one, and setup then says so.
fn kanidm_accepts(password: &str, username: &str) -> bool {
    password.chars().count() >= KANIDM_MIN_CHARACTERS
        && (username.is_empty() || !password.contains(username))
        && zxcvbn::zxcvbn(password, &[username]).score() == zxcvbn::Score::Four
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

    const GOOD: &str = "Blue-River-Walks-At-7!";
    const NAME: &str = "asha_admin";

    /// The fields that failed, for a password and a username.
    fn failed(username: &str, password: &str) -> Vec<&'static str> {
        check_new_hospital("City", username, password)
            .into_iter()
            .map(|(field, _)| field)
            .collect()
    }

    #[test]
    fn a_new_hospital_needs_a_name_a_username_and_a_real_password() {
        assert!(check_new_hospital("City Hospital", NAME, GOOD).is_empty());
        assert_eq!(check_new_hospital(" ", NAME, GOOD)[0].0, "hospital");
        assert_eq!(failed("Admin", GOOD), ["username"]);
        assert_eq!(failed(NAME, "short"), ["password"]);
        assert_eq!(failed(NAME, "alllowercase1!"), ["password"]);
    }

    /// The server's database would refuse these, and the machine would never start.
    #[test]
    fn a_name_the_database_would_refuse_is_refused_here() {
        for name in ["asha.admin", "asha-admin", "Asha", "as", "1asha"] {
            assert_eq!(failed(name, GOOD), ["username"], "{name}");
        }
    }

    /// Kanidm keeps these names, so a person could not sign in with one.
    #[test]
    fn a_name_kanidm_keeps_for_itself_is_refused() {
        for name in ["admin", "idm_admin", "anonymous"] {
            assert_eq!(failed(name, GOOD), ["username"], "{name}");
        }
    }

    /// The owner asked what ordinary passwords do: this is the rule, with examples.
    #[test]
    fn kanidms_rule_takes_a_phrase_and_refuses_what_it_would_refuse() {
        for accepted in [
            "Blue-River-Walks-At-7!",
            "My dog Rocky eats 3 apples",
            "Sunflower ward 7 is bright",
        ] {
            assert!(failed(NAME, accepted).is_empty(), "{accepted}");
        }
        for refused in [
            "Test@1234",
            "Nurse@2026",
            "Short-1!",
            "Password@1234567",
            "P@ssw0rd1234567!",
            "Aaaaaaaaaaaaaaa1!",
            "asha_admin-Blue-River-7!",
            "blue river walks at seven",
        ] {
            assert_eq!(failed(NAME, refused), ["password"], "{refused}");
        }
    }

    /// A password must not be able to write a second setting into the env file.
    #[test]
    fn nothing_typed_can_add_a_line_to_the_env_file() {
        assert_eq!(failed(NAME, "Blue-River-Walks\nEVIL=1!"), ["password"]);
        assert_eq!(
            check_new_hospital("City\nEVIL=1", NAME, GOOD)[0].0,
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
        assert!(file("192.168.1.20", "192.168.1.1").is_none());
        assert!(file("192.168.1.20/33", "192.168.1.1").is_none());
        assert!(file("1.1.1.1/24\nDNS=9.9.9.9", "1.1.1.1").is_none());
        assert!(file("192.168.1.20/24", "1.1.1.1\nDNS=9.9.9.9").is_none());
        assert!(fixed_network("en0\n[Network]", "10.0.0.2/24", "", "").is_none());
    }
}
