//! Checks on a typed profile value, shared by the change-set adapter and the
//! pack loader, so a value the server saves is one every platform can format.

use serde_json::Value;

use crate::pack::Calendars;
use crate::profile::Field;

/// Calendars shown beside the Gregorian date (CLDR ids every platform's
/// engine knows). Storage is always Gregorian (RFC §4.3).
pub const DISPLAY_CALENDARS: [&str; 8] = [
    "islamic-umalqura",
    "islamic-civil",
    "persian",
    "buddhist",
    "hebrew",
    "indian",
    "ethiopic",
    "japanese",
];

/// Exactly `len` ASCII capitals: the shape of an ISO country or currency code.
fn upper_code(s: &str, len: usize) -> bool {
    s.len() == len && s.bytes().all(|b| b.is_ascii_uppercase())
}

/// The value a person typed for `field` is one the platforms can format
/// with. Shape first ([`Field::accepts`]), then the field's own format.
///
/// # Errors
/// What is wrong, in words for the form.
pub fn check_value(field: Field, value: &Value) -> Result<(), String> {
    if !field.accepts(value) {
        return Err(format!("{} has the wrong kind of value", field.key()));
    }
    let text = value.as_str().unwrap_or_default();
    let one_of = |allowed: &[&str]| {
        if allowed.contains(&text) {
            Ok(())
        } else {
            Err(format!(
                "{} must be one of {}",
                field.key(),
                allowed.join(", ")
            ))
        }
    };
    match field {
        Field::Country if !upper_code(text, 2) => {
            Err("Country is an ISO 3166 code such as IN or AE".to_owned())
        }
        Field::Currency if !upper_code(text, 3) => {
            Err("Currency is an ISO 4217 code such as INR or AED".to_owned())
        }
        Field::Region => match text.split_once('-') {
            Some((cc, sub))
                if upper_code(cc, 2)
                    && (1..=3).contains(&sub.len())
                    && sub
                        .bytes()
                        .all(|b| b.is_ascii_uppercase() || b.is_ascii_digit()) =>
            {
                Ok(())
            }
            _ => Err("Region is an ISO 3166-2 code such as AE-DU".to_owned()),
        },
        Field::Locale => check_locale(text),
        Field::Timezone => check_zone_name(text),
        Field::Languages => value
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(Value::as_str)
            .try_for_each(check_locale),
        Field::HourCycle => one_of(&["h12", "h23"]),
        Field::WeekStart => one_of(&["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
        Field::NameOrder => one_of(&["given_family", "family_given"]),
        Field::Calendars => {
            let cal: Calendars =
                serde_json::from_value(value.clone()).map_err(|e| e.to_string())?;
            if cal.primary != "gregory" {
                return Err(
                    "Dates are kept in the Gregorian calendar; others are shown beside it"
                        .to_owned(),
                );
            }
            cal.also
                .iter()
                .find(|c| !DISPLAY_CALENDARS.contains(&c.as_str()))
                .map_or(Ok(()), |c| {
                    Err(format!("\"{c}\" is not a calendar the screens can show"))
                })
        }
        _ => Ok(()),
    }
}

/// The IANA areas real region zones live under.
const ZONE_AREAS: [&str; 9] = [
    "Africa",
    "America",
    "Antarctica",
    "Asia",
    "Atlantic",
    "Australia",
    "Europe",
    "Indian",
    "Pacific",
];

/// A real region zone (`Asia/Kolkata`, `America/Argentina/Buenos_Aires`) or
/// `UTC` / `Etc/UTC`: the names every platform accepts and reads right.
///
/// Refused: abbreviations (`IST` is three zones), POSIX strings (`GMT+4`
/// means four hours *behind* to Postgres) and `Etc/GMT±N`, whose sign is
/// inverted. The database guard applies the same rule and also asks
/// Postgres whether it knows the name (migration 1462 `locale_profile_zone_ok`).
///
/// # Errors
/// What is wrong, in words for the form.
pub fn check_zone_name(zone: &str) -> Result<(), String> {
    let mut parts = zone.split('/');
    let area = parts.next().unwrap_or_default();
    let rest: Vec<&str> = parts.collect();
    let region = ZONE_AREAS.contains(&area)
        && !rest.is_empty()
        && rest.iter().all(|p| {
            !p.is_empty()
                && p.bytes()
                    .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'_' | b'-' | b'+'))
        });
    if region || matches!(zone, "UTC" | "Etc/UTC") {
        Ok(())
    } else {
        Err(format!(
            "\"{zone}\" is not a time zone every screen accepts; use a region name such as Asia/Kolkata"
        ))
    }
}

/// Refuse a locale tag the browsers' `Intl` would refuse, so a value saved
/// here can never break formatting on every screen.
///
/// # Errors
/// The reason, in words.
pub fn check_locale(tag: &str) -> Result<(), String> {
    icu_locale_core::Locale::try_from_str(tag)
        .map(drop)
        .map_err(|e| format!("\"{tag}\" is not a BCP 47 locale ({e})"))
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn typed_values_are_checked_before_they_are_saved() {
        assert!(check_value(Field::Country, &json!("AE")).is_ok());
        assert!(check_value(Field::Country, &json!("UAE")).is_err());
        assert!(check_value(Field::Currency, &json!("KWD")).is_ok());
        assert!(check_value(Field::Currency, &json!("₹")).is_err());
        assert!(check_value(Field::Region, &json!("AE-DU")).is_ok());
        assert!(check_value(Field::Region, &json!("Dubai")).is_err());
        assert!(check_value(Field::Languages, &json!(["ar", "en"])).is_ok());
        assert!(check_value(Field::Languages, &json!(["arabic"])).is_err());
        assert!(check_value(Field::FiscalYearStart, &json!(0)).is_err());
        let hijri = json!({"primary": "gregory", "also": ["islamic-umalqura"]});
        assert!(check_value(Field::Calendars, &hijri).is_ok());
        let wrong = json!({"primary": "islamic", "also": []});
        assert!(check_value(Field::Calendars, &wrong).is_err());
    }

    #[test]
    fn only_iana_zone_names_are_accepted() {
        for good in [
            "Asia/Kolkata",
            "America/Argentina/Buenos_Aires",
            "UTC",
            "Etc/UTC",
            "America/Port-au-Prince",
        ] {
            assert!(check_value(Field::Timezone, &json!(good)).is_ok(), "{good}");
        }
        for bad in [
            "IST",
            "GMT+4",
            "EST",
            "Etc/GMT+4",
            "Etc/GMT-5",
            "Asia/",
            "/UTC",
            "posix/Asia/Kolkata",
            "Asia Kolkata",
            "+05:30",
        ] {
            assert!(check_value(Field::Timezone, &json!(bad)).is_err(), "{bad}");
        }
    }

    #[test]
    fn locale_tags_are_checked_like_intl_does() {
        for good in ["en-IN", "ar-AE", "de-DE", "fr-FR", "id-ID", "en-US", "ar"] {
            assert!(check_locale(good).is_ok(), "{good}");
        }
        for bad in ["", "en_IN", "english", "en--IN"] {
            assert!(check_locale(bad).is_err(), "{bad}");
        }
    }
}
