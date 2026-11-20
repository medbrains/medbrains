//! NHA's M1 rules for what the desk types, and its words when it is wrong.
//!
//! This is the one authoritative copy. The server refuses with these; the
//! web (`components/abha/abhaRules.ts`), iOS (`MedBrainsKit/AbhaRules.swift`)
//! and Android (`com.medbrains.kit.AbhaRules`) mirror them so the screen can
//! say so before anything is sent. Change all four together.
//!
//! Words and rules: NHA's M1 test sheet (ABHA creation, verification, Scan
//! and Share) — `CRT_ABHA_104`, `106`, `112`, `VRFY_ABHA_301`, `304`, `307`.

/// `CRT_ABHA_104`: an Aadhaar number that is the wrong length or fails its
/// Verhoeff check digit.
pub const AADHAAR_INVALID: &str = "Aadhaar Number is not valid";
/// `VRFY_ABHA_301`: a mobile that is short, long, has letters or symbols, or is blank.
pub const MOBILE_INVALID: &str = "Please enter a valid mobile number.";
/// `VRFY_ABHA_307`: a wrong OTP while finding an ABHA by mobile.
pub const OTP_INVALID: &str = "Invalid OTP. Please enter a valid OTP.";
/// `CRT_ABHA_106`, `VRFY_ABHA_304`, `VRFY_ABHA_405`: a third resend.
pub const RESEND_LOCKED: &str =
    "Maximum OTP resend attempts reached. Please try again after 30 mins";
/// `CRT_ABHA_112`: ABDM says the ABHA address is taken.
pub const ADDRESS_TAKEN: &str = "ABHA address already exists.";

/// How long resends stay refused after the last send, once both are used.
pub const RESEND_LOCKOUT_MINUTES: i32 = 30;
/// `CRT_ABHA_112`: offer at least this many ABHA addresses.
pub const MIN_ADDRESS_SUGGESTIONS: usize = 3;
/// `CRT_ABHA_112`: the whole address, `@sbx` or `@abdm` included.
pub const ADDRESS_MIN_LENGTH: usize = 8;
/// `CRT_ABHA_112`: the whole address, `@sbx` or `@abdm` included.
pub const ADDRESS_MAX_LENGTH: usize = 18;

const AADHAAR_LENGTH: usize = 12;
const MOBILE_LENGTH: usize = 10;

/// Verhoeff's dihedral-group multiplication table.
const D: [[u8; 10]; 10] = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
/// Verhoeff's position permutation table.
const P: [[u8; 10]; 8] = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 3, 2, 7, 6, 5, 8, 1, 0, 9],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 5, 8, 3, 2],
];

/// Whether `digits` (ASCII digits only, check digit last) passes Verhoeff —
/// the check UIDAI puts in the last digit of every Aadhaar number.
#[must_use]
pub fn verhoeff_ok(digits: &str) -> bool {
    if digits.is_empty() || !digits.bytes().all(|b| b.is_ascii_digit()) {
        return false;
    }
    let mut c = 0u8;
    for (i, b) in digits.bytes().rev().enumerate() {
        c = D[usize::from(c)][usize::from(P[i % 8][usize::from(b - b'0')])];
    }
    c == 0
}

/// The typed text without spaces — the only separator the desk may type.
fn without_spaces(typed: &str) -> String {
    typed.chars().filter(|c| !c.is_whitespace()).collect()
}

/// The 12 digits of a valid Aadhaar number, or `None` (`CRT_ABHA_104`):
/// spaces are allowed, anything else that is not a digit is not.
#[must_use]
pub fn aadhaar(typed: &str) -> Option<String> {
    let d = without_spaces(typed);
    (d.len() == AADHAAR_LENGTH && verhoeff_ok(&d)).then_some(d)
}

/// The 10 digits of a valid mobile, or `None` (`VRFY_ABHA_301`): spaces are
/// allowed; letters, symbols, a short or long number, or blank are not.
#[must_use]
pub fn mobile(typed: &str) -> Option<String> {
    let d = without_spaces(typed);
    (d.len() == MOBILE_LENGTH && d.bytes().all(|b| b.is_ascii_digit())).then_some(d)
}

/// Each `CRT_ABHA_112` rule for one ABHA address, met or not — the screen
/// lists them beside the field and the server refuses unless all are met.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[allow(clippy::struct_excessive_bools)] // ponytail: one flag per NHA rule, shown one per line.
pub struct AddressRules {
    /// 8–18 characters, the `@` part included.
    pub length: bool,
    /// Letters and numbers; a dot and an underscore are the only others.
    pub characters: bool,
    /// At most one dot.
    pub one_dot: bool,
    /// At most one underscore.
    pub one_underscore: bool,
    /// Neither a dot nor an underscore first or last.
    pub edges: bool,
}

impl AddressRules {
    /// Every rule is met.
    #[must_use]
    pub const fn all_met(self) -> bool {
        self.length && self.characters && self.one_dot && self.one_underscore && self.edges
    }
}

/// Each `CRT_ABHA_112` rule in the words the screen lists beside the field,
/// and whether `name@{domain}` meets it — in the order shown.
#[must_use]
pub fn address_checklist(name: &str, domain: &str) -> [(String, bool); 5] {
    let r = address_rules(name, domain);
    [
        (format!("8–18 characters, including @{domain}"), r.length),
        (
            "Letters and numbers only, besides . and _".to_owned(),
            r.characters,
        ),
        ("At most one dot (.)".to_owned(), r.one_dot),
        ("At most one underscore (_)".to_owned(), r.one_underscore),
        ("No . or _ at the start or end".to_owned(), r.edges),
    ]
}

/// The part before the `@`, whether or not the desk typed `@{domain}`.
#[must_use]
pub fn address_name<'a>(typed: &'a str, domain: &str) -> &'a str {
    let typed = typed.trim();
    typed
        .strip_suffix(domain)
        .and_then(|t| t.strip_suffix('@'))
        .unwrap_or(typed)
}

/// The rules for `name@{domain}` (`domain` is `sbx` or `abdm`).
#[must_use]
pub fn address_rules(name: &str, domain: &str) -> AddressRules {
    let total = name.chars().count() + 1 + domain.len();
    let special = |c: char| c == '.' || c == '_';
    AddressRules {
        length: (ADDRESS_MIN_LENGTH..=ADDRESS_MAX_LENGTH).contains(&total),
        characters: name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || special(c))
            && name.chars().any(|c| c.is_ascii_alphanumeric()),
        one_dot: name.matches('.').count() <= 1,
        one_underscore: name.matches('_').count() <= 1,
        edges: !name.starts_with(special) && !name.ends_with(special),
    }
}

/// Addresses made from the person's name and birth year.
///
/// They bring ABDM's suggestions up to [`MIN_ADDRESS_SUGGESTIONS`]. Only ones
/// that meet every rule; ABDM may still find one taken, which the desk is
/// then told.
#[must_use]
pub fn derive_addresses(first: &str, last: &str, year: &str, domain: &str) -> Vec<String> {
    let part = |s: &str| -> String {
        s.chars()
            .filter(char::is_ascii_alphanumeric)
            .collect::<String>()
            .to_ascii_lowercase()
    };
    let (f, l, y) = (part(first), part(last), part(year));
    let mut out: Vec<String> = Vec::new();
    for candidate in [
        format!("{f}.{l}"),
        format!("{f}_{l}"),
        format!("{f}{l}"),
        format!("{f}.{l}{y}"),
        format!("{f}{y}"),
        format!("{f}_{y}"),
        format!("{l}.{f}"),
    ] {
        if address_rules(&candidate, domain).all_met() && !out.contains(&candidate) {
            out.push(candidate);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::{aadhaar, address_name, address_rules, derive_addresses, mobile, verhoeff_ok};

    /// A valid Verhoeff number, and every single-digit change of it, fails.
    #[test]
    fn verhoeff_catches_every_one_digit_slip() {
        // ABDM's sandbox test Aadhaar number.
        let good = "999941057058";
        assert!(verhoeff_ok(good));
        assert!(
            verhoeff_ok("2363"),
            "Wikipedia's worked example 236 + check 3"
        );
        for i in 0..good.len() {
            for d in b'0'..=b'9' {
                let mut bad = good.as_bytes().to_vec();
                if bad[i] == d {
                    continue;
                }
                bad[i] = d;
                let bad = String::from_utf8(bad).unwrap_or_default();
                assert!(!verhoeff_ok(&bad), "{bad} must fail");
            }
        }
        assert!(!verhoeff_ok(""));
        assert!(!verhoeff_ok("23a3"));
    }

    /// `CRT_ABHA_104`: length, letters, symbols and the checksum all count.
    #[test]
    fn an_aadhaar_number_is_twelve_digits_that_pass_verhoeff() {
        assert_eq!(aadhaar("9999 4105 7058").as_deref(), Some("999941057058"));
        assert_eq!(aadhaar("999941057059"), None, "checksum");
        assert_eq!(
            aadhaar("123456789012"),
            None,
            "twelve digits, wrong checksum"
        );
        assert_eq!(aadhaar("99994105705"), None, "eleven digits");
        assert_eq!(aadhaar("9999410570580"), None, "thirteen digits");
        assert_eq!(aadhaar("9999-4105-7058"), None, "symbols");
        assert_eq!(aadhaar("99994105705A"), None, "letters");
        assert_eq!(aadhaar(""), None);
    }

    /// `VRFY_ABHA_301`: short, long, letters, symbols and blank all fail.
    #[test]
    fn a_mobile_is_ten_digits_and_nothing_else() {
        assert_eq!(mobile("98765 43210").as_deref(), Some("9876543210"));
        for bad in [
            "987654321",
            "98765432101",
            "98765abc10",
            "98765-43210",
            "+919876543210",
            "",
            "   ",
        ] {
            assert_eq!(mobile(bad), None, "{bad:?}");
        }
    }

    /// `CRT_ABHA_112`, every edge: 8 and 18 characters with the domain, one
    /// dot, one underscore, neither at an end, letters and digits.
    #[test]
    fn address_rules_hold_at_every_edge() {
        // "abc@sbx" is 7, "abcd@sbx" is 8.
        assert!(!address_rules("abc", "sbx").length);
        assert!(address_rules("abcd", "sbx").all_met());
        // 18 with "@sbx" is 14 before it; 13 before "@abdm".
        assert!(address_rules("abcdefghijklmn", "sbx").all_met());
        assert!(!address_rules("abcdefghijklmno", "sbx").length);
        assert!(address_rules("abcdefghijklm", "abdm").all_met());
        assert!(!address_rules("abcdefghijklmn", "abdm").length);
        assert!(address_rules("12345678", "sbx").all_met(), "digits only");
        assert!(address_rules("priyaven", "sbx").all_met(), "letters only");
        assert!(address_rules("priya.v_90", "sbx").all_met(), "one of each");
        assert!(!address_rules("pri.ya.v", "sbx").one_dot);
        assert!(!address_rules("pri_ya_v", "sbx").one_underscore);
        for edge in [".priyav", "priyav.", "_priyav", "priyav_"] {
            let r = address_rules(edge, "sbx");
            assert!(!r.edges && r.characters, "{edge}");
        }
        assert!(!address_rules("priya-v1", "sbx").characters);
        assert!(
            !address_rules("priyä.v1", "sbx").characters,
            "ASCII letters only"
        );
        assert!(
            !address_rules("._", "abdm").characters,
            "needs a letter or digit"
        );
    }

    /// The desk may type the `@` part or leave it to ABDM.
    #[test]
    fn the_domain_is_optional_when_typed() {
        assert_eq!(address_name(" priya.v@sbx ", "sbx"), "priya.v");
        assert_eq!(address_name("priya.v", "sbx"), "priya.v");
        assert_eq!(address_name("priya.v@abdm", "sbx"), "priya.v@abdm");
        assert!(!address_rules(address_name("priya@x@sbx", "sbx"), "sbx").characters);
    }

    /// The checklist the screens mirror: same words, same order, and each
    /// line follows its rule.
    #[test]
    fn the_checklist_names_each_rule() {
        let list = super::address_checklist("_ab", "sbx");
        let words: Vec<&str> = list.iter().map(|(w, _)| w.as_str()).collect();
        assert_eq!(
            words,
            [
                "8–18 characters, including @sbx",
                "Letters and numbers only, besides . and _",
                "At most one dot (.)",
                "At most one underscore (_)",
                "No . or _ at the start or end",
            ]
        );
        let met: Vec<bool> = list.iter().map(|(_, m)| *m).collect();
        assert_eq!(met, [false, true, true, true, false]);
    }

    /// Derived addresses meet every rule and never repeat.
    #[test]
    fn derived_addresses_meet_the_rules() {
        let got = derive_addresses("Priya", "Venkat", "1990", "sbx");
        assert!(got.len() >= 3, "{got:?}");
        assert_eq!(got[0], "priya.venkat");
        assert!(got.iter().all(|a| address_rules(a, "sbx").all_met()));
        assert!(derive_addresses("", "", "", "sbx").is_empty());
    }
}
