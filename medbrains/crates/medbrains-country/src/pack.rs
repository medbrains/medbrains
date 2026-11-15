//! Country packs: data compiled in, parsed once, floor-checked on load.
//!
//! RFC-WORLD-READY §3.2. A pack that does not parse or lowers the floor is
//! refused, so a broken pack fails the tests and the server's start, never a
//! ward.

use std::collections::{BTreeMap, HashMap};
use std::sync::LazyLock;

use serde::Deserialize;

use crate::floor;

/// The pack used when a hospital's country has none yet.
pub const WORLD: &str = "world";

/// The packs this build carries, as (file, text). The id inside each file is
/// what the registry keys on.
const SOURCES: [(&str, &str); 2] = [
    (
        "packs/world/pack.toml",
        include_str!("../../../packs/world/pack.toml"),
    ),
    (
        "packs/in/pack.toml",
        include_str!("../../../packs/in/pack.toml"),
    ),
];

/// A controlled-drug gate. The vocabulary is fixed in code (each gate is
/// tested code in the pharmacy); a pack can switch gates on, never invent one.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Gate {
    RxRequired,
    RegisterEntry,
    DualSign,
    DualLockStorage,
    DuplicateCopy,
    MaxSupplyDays,
    NoRefill,
    IdCheck,
}

impl Gate {
    /// The gate's id as packs spell it.
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::RxRequired => "rx_required",
            Self::RegisterEntry => "register_entry",
            Self::DualSign => "dual_sign",
            Self::DualLockStorage => "dual_lock_storage",
            Self::DuplicateCopy => "duplicate_copy",
            Self::MaxSupplyDays => "max_supply_days",
            Self::NoRefill => "no_refill",
            Self::IdCheck => "id_check",
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Meta {
    pub id: String,
    /// ISO 3166-1 alpha-2; absent only for the `world` pack.
    pub country: Option<String>,
    pub name: String,
    pub version: String,
    pub status: Status,
}

/// Honesty rule (#4917): a pack is "built for" until an authority certifies.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Status {
    BuiltFor,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, serde::Serialize)]
#[serde(deny_unknown_fields)]
pub struct Calendars {
    pub primary: String,
    #[serde(default)]
    pub also: Vec<String>,
}

/// The values that feed a profile field no scope sets (RFC §2.2 "default source").
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Defaults {
    pub currency: Option<String>,
    pub locale: String,
    pub languages: Vec<String>,
    /// The country's zones; a default only when there is exactly one.
    pub timezones: Vec<String>,
    pub calendars: Calendars,
    pub hour_cycle: Option<String>,
    pub week_start: Option<String>,
    pub fiscal_year_start: u8,
    pub name_order: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Schedule {
    pub code: String,
    pub label: String,
    pub controlled: bool,
    pub gates: Vec<Gate>,
}

/// The rules the floor is checked against. Each flag is one floor row
/// (RFC §1a), so they stay separate booleans a reviewer can read in the TOML.
#[derive(Debug, Clone, Deserialize)]
#[allow(clippy::struct_excessive_bools)]
#[serde(deny_unknown_fields)]
pub struct Rules {
    pub audit_append_only: bool,
    pub audit_phi_reads: bool,
    pub consent_required: bool,
    pub encryption_at_rest: bool,
    pub encryption_in_transit: bool,
    pub ai_per_item_accept: bool,
    pub retention_years: BTreeMap<String, u16>,
    pub controlled_schedules: Vec<Schedule>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Pack {
    pub pack: Meta,
    pub defaults: Defaults,
    pub rules: Rules,
}

/// Why a pack was refused.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum PackError {
    #[error("{file}: {reason}")]
    Parse { file: String, reason: String },
    #[error("{file} lowers the security and compliance floor: {}", .violations.join("; "))]
    BelowFloor {
        file: String,
        violations: Vec<String>,
    },
    #[error("{file}: {reason}")]
    Invalid { file: String, reason: String },
}

/// Parse one pack and refuse it unless it is a superset of the floor.
///
/// # Errors
/// [`PackError`] naming the file and every reason it was refused.
pub fn load(file: &str, text: &str) -> Result<Pack, PackError> {
    let pack: Pack = toml::from_str(text).map_err(|e| PackError::Parse {
        file: file.to_owned(),
        reason: e.to_string(),
    })?;
    let violations = floor::check(&pack.rules);
    if !violations.is_empty() {
        return Err(PackError::BelowFloor {
            file: file.to_owned(),
            violations: violations.into_iter().map(|v| v.0).collect(),
        });
    }
    let invalid = |reason: String| PackError::Invalid {
        file: file.to_owned(),
        reason,
    };
    if (pack.pack.id == WORLD) != pack.pack.country.is_none() {
        return Err(invalid("only the world pack has no country".to_owned()));
    }
    crate::validate::check_locale(&pack.defaults.locale).map_err(invalid)?;
    if !(1..=12).contains(&pack.defaults.fiscal_year_start) {
        return Err(invalid("fiscal_year_start is a month, 1 to 12".to_owned()));
    }
    Ok(pack)
}

/// Every compiled-in pack: the `world` pack and the rest keyed by id.
#[derive(Debug)]
pub struct Packs {
    pub world: Pack,
    pub by_id: HashMap<String, Pack>,
}

/// Load every source; all of them or none, and the `world` pack must be one.
fn load_all(sources: &[(&str, &str)]) -> Result<Packs, PackError> {
    let mut by_id: HashMap<String, Pack> = sources
        .iter()
        .map(|(file, text)| load(file, text).map(|p| (p.pack.id.clone(), p)))
        .collect::<Result<_, _>>()?;
    let world = by_id.remove(WORLD).ok_or_else(|| PackError::Invalid {
        file: "packs/world/pack.toml".to_owned(),
        reason: "the world pack is missing".to_owned(),
    })?;
    Ok(Packs { world, by_id })
}

static PACKS: LazyLock<Result<Packs, PackError>> = LazyLock::new(|| load_all(&SOURCES));

/// The compiled-in packs, parsed once per process.
///
/// # Errors
/// The first pack that failed to load; the server refuses to start on it.
pub fn packs() -> Result<&'static Packs, &'static PackError> {
    PACKS.as_ref()
}

/// The pack for an ISO country code, else the `world` pack. One hash lookup.
///
/// # Errors
/// As [`packs`].
pub fn for_country(country: Option<&str>) -> Result<&'static Pack, &'static PackError> {
    let all = packs()?;
    Ok(country
        .and_then(|c| all.by_id.get(&c.to_ascii_lowercase()))
        .unwrap_or(&all.world))
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    #[test]
    fn every_compiled_pack_loads_and_meets_the_floor() {
        let all = packs().expect("compiled packs load");
        assert_eq!(all.world.pack.id, WORLD);
        assert!(all.by_id.contains_key("in"));
    }

    #[test]
    fn a_pack_that_lowers_the_floor_fails_to_load() {
        let text = include_str!("../tests/fixtures/lowers_floor.toml");
        let Err(PackError::BelowFloor { violations, .. }) = load("lowers_floor.toml", text) else {
            unreachable!("a pack below the floor loaded");
        };
        let all = violations.join("\n");
        assert!(all.contains("AI text"), "{all}");
        assert!(all.contains("audit_log is kept 1 years"), "{all}");
        assert!(all.contains("drops the dual_sign gate"), "{all}");
    }

    #[test]
    fn a_registry_with_a_bad_pack_loads_nothing() {
        let bad = include_str!("../tests/fixtures/lowers_floor.toml");
        let sources = [SOURCES[0], ("lowers_floor.toml", bad)];
        assert!(matches!(
            load_all(&sources),
            Err(PackError::BelowFloor { .. })
        ));
    }

    #[test]
    fn an_unknown_gate_is_refused_not_ignored() {
        let text = include_str!("../../../packs/world/pack.toml").replace(
            "\"register_entry\"]",
            "\"register_entry\", \"wave_through\"]",
        );
        assert!(matches!(load("w", &text), Err(PackError::Parse { .. })));
    }

    #[test]
    fn a_country_without_a_pack_gets_world() {
        assert_eq!(for_country(Some("AE")).unwrap().pack.id, WORLD);
        assert_eq!(for_country(None).unwrap().pack.id, WORLD);
        assert_eq!(for_country(Some("IN")).unwrap().pack.id, "in");
    }
}
