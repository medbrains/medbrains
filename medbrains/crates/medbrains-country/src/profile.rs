//! The tenant locale profile (RFC-WORLD-READY §2.2): the fields, which scope
//! may set each, and resolution `user › facility › hospital › pack default`.
//!
//! Pure: [`resolve`] takes stored values and a pack lookup and never touches
//! the database, so every rule here is unit-tested.

use std::collections::BTreeMap;

use medbrains_kernel::config::ScopedValue;
use serde::Serialize;
use serde_json::Value;

use crate::pack::{self, Calendars, Pack};

/// The configuration category every profile field lives in.
pub const CATEGORY: &str = "locale";

/// Measurement units, served with the profile so a screen needs no second
/// settings fetch (RFC §2.3: one round trip).
pub const UNITS: &str = "units";

/// The date pattern some screens still read, kept beside the profile.
const DATE_FORMAT: &str = "date_format";

/// One field of the profile, stored at `locale/<key>`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Field {
    Country,
    Region,
    PackVersion,
    Currency,
    Locale,
    Languages,
    Timezone,
    Calendars,
    HourCycle,
    WeekStart,
    FiscalYearStart,
    NameOrder,
}

/// The shape a stored value must have.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Kind {
    Text,
    TextList,
    Month,
    Calendars,
}

impl Field {
    pub const ALL: [Self; 12] = [
        Self::Country,
        Self::Region,
        Self::PackVersion,
        Self::Currency,
        Self::Locale,
        Self::Languages,
        Self::Timezone,
        Self::Calendars,
        Self::HourCycle,
        Self::WeekStart,
        Self::FiscalYearStart,
        Self::NameOrder,
    ];

    /// The key under [`CATEGORY`]; also the field's name on the wire.
    #[must_use]
    pub const fn key(self) -> &'static str {
        match self {
            Self::Country => "country",
            Self::Region => "region",
            Self::PackVersion => "pack_version",
            Self::Currency => "currency",
            Self::Locale => "locale",
            Self::Languages => "languages",
            Self::Timezone => "timezone",
            Self::Calendars => "calendars",
            Self::HourCycle => "hour_cycle",
            Self::WeekStart => "week_start",
            Self::FiscalYearStart => "fiscal_year_start",
            Self::NameOrder => "name_order",
        }
    }

    /// The field stored at `key`, if it is one.
    #[must_use]
    pub fn from_key(key: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|f| f.key() == key)
    }

    const fn kind(self) -> Kind {
        match self {
            Self::Languages => Kind::TextList,
            Self::FiscalYearStart => Kind::Month,
            Self::Calendars => Kind::Calendars,
            _ => Kind::Text,
        }
    }

    /// Whether `scope` may set this field (RFC §2.2 scope table). Country,
    /// currency, tax year and pack are hospital-wide; a facility sets its own
    /// region, zone, language and display; a person sets only how things look
    /// to them.
    #[must_use]
    pub const fn settable_at(self, scope: &str) -> bool {
        match scope.as_bytes() {
            b"hospital" => true,
            b"facility" => matches!(
                self,
                Self::Region
                    | Self::Timezone
                    | Self::Locale
                    | Self::Languages
                    | Self::HourCycle
                    | Self::Calendars
            ),
            b"user" => matches!(self, Self::Languages | Self::HourCycle | Self::Calendars),
            _ => false,
        }
    }

    /// Whether a stored value has this field's shape; anything else is
    /// skipped and the field resolves as if that scope had not set it.
    #[must_use]
    pub fn accepts(self, value: &Value) -> bool {
        match self.kind() {
            Kind::Text => value.as_str().is_some_and(|s| !s.trim().is_empty()),
            Kind::TextList => value
                .as_array()
                .is_some_and(|a| !a.is_empty() && a.iter().all(Value::is_string)),
            Kind::Month => value.as_u64().is_some_and(|m| (1..=12).contains(&m)),
            Kind::Calendars => serde_json::from_value::<Calendars>(value.clone()).is_ok(),
        }
    }

    /// The pack's default for this field, when it has one.
    fn pack_default(self, pack: &Pack) -> Option<Value> {
        let d = &pack.defaults;
        let text = |s: &str| Some(Value::String(s.to_owned()));
        match self {
            Self::Country => pack.pack.country.as_deref().and_then(text),
            Self::Region => None,
            Self::PackVersion => text(&pack.pack.version),
            Self::Currency => d.currency.as_deref().and_then(text),
            Self::Locale => text(&d.locale),
            Self::Languages => serde_json::to_value(&d.languages).ok(),
            // A country with several zones has no default: the hospital picks.
            Self::Timezone => match d.timezones.as_slice() {
                [only] => text(only),
                _ => None,
            },
            Self::Calendars => serde_json::to_value(&d.calendars).ok(),
            Self::HourCycle => d.hour_cycle.as_deref().and_then(text),
            Self::WeekStart => d.week_start.as_deref().and_then(text),
            Self::FiscalYearStart => Some(Value::from(d.fiscal_year_start)),
            Self::NameOrder => text(&d.name_order),
        }
    }
}

/// The resolved profile, as `/api/auth/me` serves it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct LocaleProfile {
    /// The pack in force: the country's, or `world`.
    pub pack: String,
    /// `field → value`; a field nobody set and the pack has no default for is
    /// absent here and named in [`missing`](Self::missing).
    pub values: BTreeMap<&'static str, Value>,
    /// `field → "user" | "facility" | "hospital" | "pack"`.
    pub sources: BTreeMap<&'static str, &'static str>,
    /// Fields with no value: the screens render them neutrally (ISO code,
    /// UTC labelled) and say the profile is incomplete. Never an India guess.
    pub missing: Vec<&'static str>,
    /// `units/*`, most specific scope first, unchanged from today's keys.
    pub units: BTreeMap<String, Value>,
    /// `locale/date_format`, when set.
    pub date_format: Option<String>,
}

/// The first value per field a scope may set, from `rows` ordered most
/// specific scope first (as `kernel::config::categories_in` returns them).
fn stored(rows: &[ScopedValue]) -> BTreeMap<Field, (&'static str, &Value)> {
    let mut out = BTreeMap::new();
    for row in rows.iter().filter(|r| r.category == CATEGORY) {
        let Some(field) = Field::from_key(&row.key) else {
            continue;
        };
        if out.contains_key(&field) || !field.settable_at(row.scope) {
            continue;
        }
        if field.accepts(&row.value) {
            out.insert(field, (row.scope, &row.value));
        } else {
            tracing::warn!(key = %row.key, scope = row.scope, "locale profile value has the wrong shape; ignored");
        }
    }
    out
}

/// Resolve a profile from stored values. The pack follows the country the
/// hospital set (only the hospital sets a country), so a facility can never
/// switch the rules in force.
///
/// # Errors
/// The pack registry's load error: a fault, never an empty profile.
pub fn resolve(rows: &[ScopedValue]) -> Result<LocaleProfile, &'static pack::PackError> {
    let set = stored(rows);
    let country = set.get(&Field::Country).and_then(|(_, v)| v.as_str());
    let pack = pack::for_country(country)?;
    let mut profile = LocaleProfile {
        pack: pack.pack.id.clone(),
        values: BTreeMap::new(),
        sources: BTreeMap::new(),
        missing: Vec::new(),
        units: BTreeMap::new(),
        date_format: None,
    };
    for row in rows {
        if row.category == UNITS {
            profile
                .units
                .entry(row.key.clone())
                .or_insert_with(|| row.value.clone());
        } else if row.category == CATEGORY
            && row.key == DATE_FORMAT
            && profile.date_format.is_none()
        {
            profile.date_format = row.value.as_str().map(ToOwned::to_owned);
        }
    }
    for field in Field::ALL {
        let found = set
            .get(&field)
            .map(|(scope, v)| (*scope, (*v).clone()))
            .or_else(|| field.pack_default(pack).map(|v| ("pack", v)));
        match found {
            Some((source, value)) => {
                profile.values.insert(field.key(), value);
                profile.sources.insert(field.key(), source);
            }
            None if field != Field::Region => profile.missing.push(field.key()),
            None => {}
        }
    }
    Ok(profile)
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use serde_json::json;

    use super::*;

    fn row(scope: &'static str, key: &str, value: Value) -> ScopedValue {
        ScopedValue {
            category: CATEGORY.to_owned(),
            key: key.to_owned(),
            scope,
            value,
        }
    }

    #[test]
    fn an_indian_hospital_keeps_todays_values() {
        let rows = [
            row("hospital", "country", json!("IN")),
            row("hospital", "currency", json!("INR")),
            row("hospital", "locale", json!("en-IN")),
            row("hospital", "timezone", json!("Asia/Kolkata")),
            row("hospital", "fiscal_year_start", json!(4)),
        ];
        let p = resolve(&rows).unwrap();
        assert_eq!(p.pack, "in");
        assert_eq!(p.values["currency"], json!("INR"));
        assert_eq!(p.values["locale"], json!("en-IN"));
        assert_eq!(p.values["timezone"], json!("Asia/Kolkata"));
        assert_eq!(p.values["fiscal_year_start"], json!(4));
        assert_eq!(p.sources["languages"], "pack");
        assert!(p.missing.is_empty(), "{:?}", p.missing);
    }

    #[test]
    fn no_country_never_means_india() {
        let p = resolve(&[]).unwrap();
        assert_eq!(p.pack, pack::WORLD);
        for field in ["country", "currency", "timezone"] {
            assert!(p.missing.contains(&field), "{field} should be missing");
            assert!(!p.values.contains_key(field));
        }
        assert_eq!(p.values["locale"], json!("en"));
    }

    #[test]
    fn most_specific_scope_wins_where_it_may_set_the_field() {
        let rows = [
            row("user", "hour_cycle", json!("h23")),
            row("facility", "hour_cycle", json!("h12")),
            row("hospital", "hour_cycle", json!("h12")),
            row("facility", "timezone", json!("Asia/Dubai")),
            row("hospital", "timezone", json!("Asia/Kolkata")),
            row("hospital", "country", json!("IN")),
        ];
        let p = resolve(&rows).unwrap();
        assert_eq!(
            (p.values["hour_cycle"].clone(), p.sources["hour_cycle"]),
            (json!("h23"), "user")
        );
        assert_eq!(
            (p.values["timezone"].clone(), p.sources["timezone"]),
            (json!("Asia/Dubai"), "facility")
        );
    }

    #[test]
    fn a_narrow_scope_cannot_set_a_hospital_wide_field() {
        let rows = [
            row("user", "timezone", json!("UTC")),
            row("facility", "currency", json!("AED")),
            row("facility", "country", json!("AE")),
            row("hospital", "country", json!("IN")),
            row("hospital", "currency", json!("INR")),
        ];
        let p = resolve(&rows).unwrap();
        assert_eq!(p.pack, "in");
        assert_eq!(p.values["currency"], json!("INR"));
        assert_eq!(p.sources["timezone"], "pack");
    }

    #[test]
    fn a_value_of_the_wrong_shape_falls_through() {
        let rows = [
            row("hospital", "fiscal_year_start", json!(13)),
            row("hospital", "languages", json!("en")),
        ];
        let p = resolve(&rows).unwrap();
        assert_eq!(p.sources["fiscal_year_start"], "pack");
        assert_eq!(p.values["languages"], json!(["en"]));
    }

    #[test]
    fn units_and_date_format_ride_along() {
        let mut units = row("facility", "weight_unit", json!("lbs"));
        units.category = UNITS.to_owned();
        let mut hospital_units = row("hospital", "weight_unit", json!("kg"));
        hospital_units.category = UNITS.to_owned();
        let rows = [
            units,
            hospital_units,
            row("hospital", "date_format", json!("DD/MM/YYYY")),
        ];
        let p = resolve(&rows).unwrap();
        assert_eq!(p.units["weight_unit"], json!("lbs"));
        assert_eq!(p.date_format.as_deref(), Some("DD/MM/YYYY"));
    }
}
