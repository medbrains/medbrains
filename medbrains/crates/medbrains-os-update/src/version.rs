//! Image versions: only dotted numbers, so our order and systemd-boot's can never disagree.

use std::fmt;

const MIN_FIELDS: usize = 2;
const MAX_FIELDS: usize = 4;

/// An image version such as `3.33.0`. Longer is newer when the shared fields are equal, as in
/// systemd-boot's version comparison, and leading zeros are refused because it reads them differently.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct Version(Vec<u32>);

impl Version {
    /// Parses a version, or `None` for anything that is not plain dotted numbers.
    pub fn parse(text: &str) -> Option<Self> {
        let fields: Vec<&str> = text.split('.').collect();
        if !(MIN_FIELDS..=MAX_FIELDS).contains(&fields.len()) {
            return None;
        }
        let mut numbers = Vec::with_capacity(fields.len());
        for field in fields {
            let plain = !field.is_empty() && field.bytes().all(|b| b.is_ascii_digit());
            if !plain || (field.len() > 1 && field.starts_with('0')) {
                return None;
            }
            numbers.push(field.parse().ok()?);
        }
        Some(Self(numbers))
    }
}

impl fmt::Display for Version {
    /// Writes the version the way it was parsed.
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let words: Vec<String> = self.0.iter().map(ToString::to_string).collect();
        f.write_str(&words.join("."))
    }
}

#[cfg(test)]
mod tests {
    use super::Version;

    /// Shorthand for a parsed version.
    fn v(text: &str) -> Option<Version> {
        Version::parse(text)
    }

    /// The order is numeric, not by text: `3.9` is older than `3.33`.
    #[test]
    fn versions_order_by_number() {
        assert!(v("3.9.0") < v("3.33.0"));
        assert!(v("3.33.0") < v("3.33.0.1"));
        assert!(v("3.33.1") > v("3.33.0.9"));
        assert_eq!(
            v("0.0.1762300000").map(|x| x.to_string()).as_deref(),
            Some("0.0.1762300000")
        );
    }

    /// Anything systemd-boot might order differently must not get in.
    #[test]
    fn only_plain_dotted_numbers_parse() {
        for bad in [
            "",
            "3",
            "3.",
            ".3",
            "3.33.0-beta.1",
            "a.b",
            "3.033",
            "1.2.3.4.5",
            "3..1",
            "abc1234",
            "+1.2",
            "1.99999999999",
        ] {
            assert!(Version::parse(bad).is_none(), "{bad} parsed");
        }
    }
}
