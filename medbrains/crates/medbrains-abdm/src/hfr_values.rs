//! The value shapes behind the HFR workbook rules: codes, IDs, names,
//! coordinates, addresses, contact details and opening hours. Split from
//! `hfr_rules` so each file stays readable; the rules call these.

/// HFR-010: the name is more than four characters.
const MIN_NAME_CHARS: usize = 5;
/// HFR-011/012: one to six decimal places.
const MAX_DECIMALS: usize = 6;

/// Comma-joined codes, trimmed, empties dropped.
#[must_use]
pub fn codes(joined: &str) -> Vec<&str> {
    joined
        .split(',')
        .map(str::trim)
        .filter(|c| !c.is_empty())
        .collect()
}

/// HFR IDs are `IN` + 10 letters or digits.
#[must_use]
pub fn is_hfr_id(id: &str) -> bool {
    id.len() == 12
        && id.get(..2).is_some_and(|p| p.eq_ignore_ascii_case("IN"))
        && id.chars().all(|c| c.is_ascii_alphanumeric())
}

/// A master code: letters, digits, `-` or `_`, nothing that could bend a
/// query string.
#[must_use]
pub fn is_code(code: &str) -> bool {
    !code.is_empty()
        && code.len() <= 40
        && code
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

/// Empty passes; otherwise `rule` decides.
pub(super) fn optional(value: &str, rule: impl Fn(&str) -> bool) -> bool {
    let v = value.trim();
    v.is_empty() || rule(v)
}

/// Only ASCII digits, at least one.
pub(super) fn digits(v: &str) -> bool {
    !v.is_empty() && v.chars().all(|c| c.is_ascii_digit())
}

/// HFR-010.
pub(super) fn is_facility_name(name: &str) -> bool {
    let name = name.trim();
    name.chars().next().is_some_and(|c| c.is_ascii_alphabetic())
        && name.chars().count() >= MIN_NAME_CHARS
        && name.chars().all(|c| c.is_ascii_alphanumeric() || c == ' ')
}

/// HFR-011/012: a signed decimal within `limit` with 1–6 decimal places.
pub(super) fn is_coordinate(value: &str, limit: f64) -> bool {
    let v = value.trim();
    let unsigned = v.strip_prefix(['-', '+']).unwrap_or(v);
    let Some((whole, frac)) = unsigned.split_once('.') else {
        return false;
    };
    digits(whole)
        && digits(frac)
        && frac.len() <= MAX_DECIMALS
        && v.parse::<f64>().is_ok_and(|n| n.abs() <= limit)
}

/// HFR-017/018: letters, digits, spaces and `. - , / ( ) _`.
pub(super) fn is_address(v: &str) -> bool {
    v.chars()
        .all(|c| c.is_ascii_alphanumeric() || " .-,/()_".contains(c))
}

/// HFR-025: `local@domain.tld`, no spaces.
pub(super) fn is_email(v: &str) -> bool {
    let Some((local, domain)) = v.split_once('@') else {
        return false;
    };
    !local.is_empty()
        && !v.contains(char::is_whitespace)
        && domain.split('.').count() >= 2
        && domain.split('.').all(|part| !part.is_empty())
}

/// HFR-026: a host with a dot, optional `http(s)://`, no spaces.
pub(super) fn is_link(v: &str) -> bool {
    let rest = v
        .strip_prefix("https://")
        .or_else(|| v.strip_prefix("http://"))
        .unwrap_or(v);
    let host = rest.split('/').next().unwrap_or_default();
    !v.contains(char::is_whitespace) && host.contains('.') && host.split('.').all(|p| !p.is_empty())
}

/// HFR-021: `24*7`, or `h:mm AM - h:mm PM`.
pub(super) fn is_opening_hours(v: &str) -> bool {
    let v = v.trim();
    if v == "24*7" {
        return true;
    }
    let Some((from, to)) = v.split_once(" - ") else {
        return false;
    };
    is_clock(from) && is_clock(to)
}

/// `h:mm AM` / `hh:mm PM`, hour 1–12.
fn is_clock(v: &str) -> bool {
    let Some((time, half)) = v.trim().split_once(' ') else {
        return false;
    };
    let Some((h, m)) = time.split_once(':') else {
        return false;
    };
    matches!(half, "AM" | "PM")
        && h.parse::<u8>().is_ok_and(|h| (1..=12).contains(&h))
        && m.len() == 2
        && m.parse::<u8>().is_ok_and(|m| m < 60)
}
