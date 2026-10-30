//! Online stock holds and the choice of which pharmacy fills an online
//! order: pure rules, so the server, the settings screen and the tests agree.
//!
//! A hold keeps units for one order while the patient checks out, and again
//! while a pharmacist reviews the prescription. How long is the hospital's
//! choice and may depend on how much is left — a short hold when stock is
//! scarce, so an abandoned cart doesn't lock the last strips. Holds only ever
//! come out of what online may sell (stock above the online floor): the
//! counter and the wards never see them.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// One step of a hold ladder: while the units online may still sell are at
/// most `max_available` (or any amount, when `None`), hold for `minutes`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct HoldTier {
    pub max_available: Option<i32>,
    pub minutes: i64,
}

/// The hospital's hold ladders: at checkout, and through pharmacist review.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HoldTiers {
    pub checkout: Vec<HoldTier>,
    pub review: Vec<HoldTier>,
}

/// Units at or under which stock counts as scarce for the default ladders.
/// Inferred, not from a spec: the storefront's "few left" mark.
pub const SCARCE_UNITS: i32 = 10;

impl Default for HoldTiers {
    /// 10 minutes at checkout when scarce, else 15 (Shopify-style carts);
    /// 4 hours of review when scarce, else 24 (research brief §3). The
    /// scarce durations are inferred, not from a spec.
    fn default() -> Self {
        Self {
            checkout: vec![
                HoldTier {
                    max_available: Some(SCARCE_UNITS),
                    minutes: 10,
                },
                HoldTier {
                    max_available: None,
                    minutes: 15,
                },
            ],
            review: vec![
                HoldTier {
                    max_available: Some(SCARCE_UNITS),
                    minutes: 4 * 60,
                },
                HoldTier {
                    max_available: None,
                    minutes: 24 * 60,
                },
            ],
        }
    }
}

/// The longest hold a hospital may set: a week. Longer is a backorder.
pub const MAX_HOLD_MINUTES: i64 = 7 * 24 * 60;

/// Minutes to hold when `available` units are left for online: the first
/// tier that covers it, or the last tier's.
#[must_use]
pub fn hold_minutes(tiers: &[HoldTier], available: i32) -> i64 {
    tiers
        .iter()
        .find(|t| t.max_available.is_none_or(|max| available <= max))
        .or_else(|| tiers.last())
        .map_or(0, |t| t.minutes.clamp(1, MAX_HOLD_MINUTES))
}

/// What is wrong with a ladder the hospital typed in.
///
/// # Errors
/// The problem, in the hospital's words.
pub fn tiers_problem(tiers: &[HoldTier]) -> Result<(), String> {
    if tiers.is_empty() || tiers.last().is_some_and(|t| t.max_available.is_some()) {
        return Err("End each hold ladder with a step for any amount of stock".to_owned());
    }
    if tiers
        .iter()
        .any(|t| t.minutes < 1 || t.minutes > MAX_HOLD_MINUTES)
    {
        return Err("A hold lasts between a minute and a week".to_owned());
    }
    let limits: Vec<i32> = tiers.iter().filter_map(|t| t.max_available).collect();
    if limits.windows(2).any(|w| w[0] >= w[1]) || limits.iter().any(|l| *l < 0) {
        return Err("List the stock limits from smallest to largest".to_owned());
    }
    Ok(())
}

/// An Indian pincode: six digits, not starting with 0.
#[must_use]
pub fn is_pincode(s: &str) -> bool {
    s.len() == 6 && s.bytes().all(|b| b.is_ascii_digit()) && !s.starts_with('0')
}

/// A pharmacy location that takes online orders, as selection sees it.
#[derive(Debug, Clone)]
pub struct StoreCandidate {
    pub id: Uuid,
    /// The store's own pincode, for nearness.
    pub pincode: Option<String>,
    /// Where it delivers; empty means it delivers nowhere (pickup only).
    pub serviceable: Vec<String>,
    /// It holds every line of the order above its online floor.
    pub fills_all: bool,
}

/// Why no store was chosen.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Unchosen {
    /// No store delivers to that pincode; pickup is still offered.
    NotDeliveredHere,
    /// No single store holds every line.
    OutOfStock,
}

/// How far apart two pincodes are, for choosing the nearer store. Inferred,
/// not from a spec: pincodes run roughly by geography within a postal
/// circle, so the numeric gap orders nearby stores; a hospital with stores
/// far apart should keep one serviceable area per store.
#[must_use]
pub fn pincode_gap(a: Option<&str>, b: Option<&str>) -> u32 {
    match (
        a.and_then(|s| s.parse::<u32>().ok()),
        b.and_then(|s| s.parse::<u32>().ok()),
    ) {
        (Some(x), Some(y)) => x.abs_diff(y),
        _ => u32::MAX,
    }
}

/// The store to fill an order from, in the owner's order: enabled (only
/// enabled stores are passed in), serving the delivery pincode, holding
/// every line, then nearest. `delivery_pincode` is `None` for a pickup;
/// `near` is where the patient is, when known.
///
/// # Errors
/// Why none fits.
pub fn choose_store(
    candidates: &[StoreCandidate],
    delivery_pincode: Option<&str>,
    near: Option<&str>,
) -> Result<Uuid, Unchosen> {
    let serving: Vec<&StoreCandidate> = candidates
        .iter()
        .filter(|c| delivery_pincode.is_none_or(|p| c.serviceable.iter().any(|s| s == p)))
        .collect();
    if serving.is_empty() {
        return Err(Unchosen::NotDeliveredHere);
    }
    let near = delivery_pincode.or(near);
    serving
        .into_iter()
        .filter(|c| c.fills_all)
        .min_by_key(|c| (pincode_gap(c.pincode.as_deref(), near), c.id))
        .map(|c| c.id)
        .ok_or(Unchosen::OutOfStock)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn store(n: u128, pincode: &str, serves: &[&str], fills_all: bool) -> StoreCandidate {
        StoreCandidate {
            id: Uuid::from_u128(n),
            pincode: Some(pincode.to_owned()),
            serviceable: serves.iter().map(|s| (*s).to_owned()).collect(),
            fills_all,
        }
    }

    #[test]
    fn scarce_stock_holds_for_less() {
        let tiers = HoldTiers::default();
        assert_eq!(hold_minutes(&tiers.checkout, 3), 10);
        assert_eq!(hold_minutes(&tiers.checkout, 400), 15);
        assert_eq!(hold_minutes(&tiers.review, 3), 240);
        assert_eq!(hold_minutes(&tiers.review, 400), 1440);
        assert!(tiers_problem(&tiers.checkout).is_ok());
    }

    #[test]
    fn a_ladder_must_end_open_and_climb() {
        let open = HoldTier {
            max_available: None,
            minutes: 15,
        };
        let at = |max, minutes| HoldTier {
            max_available: Some(max),
            minutes,
        };
        assert!(tiers_problem(&[]).is_err());
        assert!(tiers_problem(&[at(5, 10)]).is_err());
        assert!(tiers_problem(&[at(10, 5), at(5, 10), open]).is_err());
        assert!(tiers_problem(&[at(5, 0), open]).is_err());
        assert!(tiers_problem(&[at(5, 5), at(10, 10), open]).is_ok());
    }

    #[test]
    fn pincode_then_stock_then_nearness() {
        let far = store(1, "560001", &["560034"], true);
        let near = store(2, "560030", &["560034"], true);
        let empty = store(3, "560034", &["560034"], false);
        let elsewhere = store(4, "600001", &["600001"], true);
        let all = [far.clone(), near.clone(), empty, elsewhere];
        assert_eq!(choose_store(&all, Some("560034"), None), Ok(near.id));
        assert_eq!(
            choose_store(&all, Some("110001"), None),
            Err(Unchosen::NotDeliveredHere)
        );
        assert_eq!(
            choose_store(
                &[store(3, "560034", &["560034"], false)],
                Some("560034"),
                None
            ),
            Err(Unchosen::OutOfStock)
        );
        // Pickup: any store that holds it, nearest the patient.
        assert_eq!(
            choose_store(&all, None, Some("600002")),
            Ok(Uuid::from_u128(4))
        );
        assert_eq!(choose_store(&[far.clone()], None, None), Ok(far.id));
    }

    #[test]
    fn pincodes_are_six_digits() {
        assert!(is_pincode("560034"));
        assert!(!is_pincode("060034"));
        assert!(!is_pincode("56003"));
        assert!(!is_pincode("56003a"));
    }
}
