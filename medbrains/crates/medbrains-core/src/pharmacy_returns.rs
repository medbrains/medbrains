//! What happens to a medicine that comes back to the pharmacy — from the
//! counter or from an online order — decided in one place, by the law that
//! governs it. The full legal basis, with what still needs confirming, is
//! `docs/compliance/pharmacy-returns.md`; each rule below names its source.
//! `[verify]` marks a citation not yet read against the primary text.
//!
//! A returned pack goes back on the shelf only when every condition holds:
//!
//! 1. **Sealed.** The manufacturer's seal is unbroken. Drugs and Cosmetics
//!    Rules 1945, Rule 65 makes the licensee answerable for what it sells
//!    and how it was stored; an opened pack's contents can't be vouched for.
//!    The Drugs and Cosmetics Act 1940 s.18(a) forbids selling a drug that is
//!    not of standard quality or is adulterated. `[verify]` sub-rule.
//! 2. **In date, above the shelf-life floor.** An expired drug may not be
//!    sold (Act s.18(a)(i), not of standard quality `[verify]`); the online
//!    floor (`min_shelf_life_days`) keeps a short-dated pack from going out
//!    again on an order that promised more.
//! 3. **Not cold-chain.** Storage between 2 and 8 °C can't be verified once
//!    the pack has left the premises (Rule 65 storage conditions; Schedule
//!    C/C(1) items under a Form 21 licence `[verify]`).
//! 4. **Not controlled.** NDPS Act 1985 and NDPS Rules 1985: a narcotic or
//!    psychotropic that left the pharmacy is never re-issued; it is entered
//!    in the register and destroyed before a witness.
//! 5. **Batch traceable.** Rule 65 records tie every sale to its batch; a
//!    pack whose batch can't be named can't be recalled, so it can't be sold.
//! 6. **Within the return window.** Consumer Protection (E-Commerce) Rules
//!    2020: the return policy shown before purchase is the policy applied.
//!
//! Everything else is quarantined, then destroyed: as biomedical waste
//! (Bio-Medical Waste Management Rules 2016, Schedule I, Yellow category (d)
//! "expired or discarded medicines", via an authorised CBMWTF) or, for a
//! controlled drug, through the NDPS register with a witness.

use chrono::{Days, NaiveDate};

/// Days a delivered online order may be returned, unless the hospital says
/// otherwise. The research brief's default (1mg and PharmEasy use 7).
pub const DEFAULT_ONLINE_RETURN_WINDOW_DAYS: i64 = 7;
/// Hours within which a grievance is acknowledged. Consumer Protection
/// (E-Commerce) Rules 2020, Rule 4(4) `[verify]` sub-rule.
pub const GRIEVANCE_ACK_HOURS: i64 = 48;
/// Days within which a grievance is resolved: "one month" in the same rule.
pub const GRIEVANCE_RESOLVE_DAYS: i64 = 30;
/// BMW Rules 2016, Schedule I: expired or discarded medicines.
pub const BMW_CATEGORY: &str = "Yellow (d): expired or discarded medicines";
/// The bag such waste is segregated into (Schedule I).
pub const BMW_BAG_COLOUR: &str = "yellow";

/// Why an online order line may come back. Change of mind is not one.
pub const ONLINE_RETURN_REASONS: [&str; 4] = ["wrong_item", "damaged", "short_dated", "excess"];

/// One returned pack as the pharmacist found it.
#[derive(Debug, Clone, Copy)]
pub struct ReturnedPack {
    pub sealed: bool,
    /// The batch's expiry; `None` when the batch can't be traced.
    pub expiry: Option<NaiveDate>,
    pub cold_chain: bool,
    pub controlled: bool,
    pub sold_on: NaiveDate,
    pub returned_on: NaiveDate,
    pub window_days: i64,
    /// Days of shelf life a pack must still have to be sold again.
    pub shelf_life_floor_days: i64,
}

/// Why a pack is quarantined; every one that applies is recorded.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum QuarantineReason {
    Opened,
    Expired,
    BelowShelfLifeFloor,
    ColdChain,
    Controlled,
    Untraceable,
    OutsideWindow,
}

impl QuarantineReason {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Opened => "opened",
            Self::Expired => "expired",
            Self::BelowShelfLifeFloor => "below_shelf_life_floor",
            Self::ColdChain => "cold_chain",
            Self::Controlled => "controlled",
            Self::Untraceable => "untraceable",
            Self::OutsideWindow => "outside_window",
        }
    }
}

/// How quarantined stock is destroyed.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DestructionRoute {
    /// Biomedical waste, Yellow (d), handed to an authorised CBMWTF.
    Bmw,
    /// NDPS register entry and a witnessed destruction.
    Ndps,
}

impl DestructionRoute {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Bmw => "bmw",
            Self::Ndps => "ndps",
        }
    }
}

/// Where a returned pack goes.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Disposition {
    /// Back to the batch it came from.
    Restock,
    Quarantine {
        reasons: Vec<QuarantineReason>,
        route: DestructionRoute,
    },
}

/// Whether the return is inside its window: the sale day is day 0.
#[must_use]
pub fn within_window(sold_on: NaiveDate, returned_on: NaiveDate, window_days: i64) -> bool {
    let days = u64::try_from(window_days.max(0)).unwrap_or(0);
    sold_on
        .checked_add_days(Days::new(days))
        .is_some_and(|last| returned_on <= last)
}

/// The one rule for a returned pack: restock only when every legal
/// condition holds, else quarantine with every reason that applied.
#[must_use]
pub fn disposition(p: &ReturnedPack) -> Disposition {
    let floor = u64::try_from(p.shelf_life_floor_days.max(0)).unwrap_or(0);
    let mut reasons = Vec::new();
    if !p.sealed {
        reasons.push(QuarantineReason::Opened);
    }
    match p.expiry {
        None => reasons.push(QuarantineReason::Untraceable),
        Some(expiry) if expiry <= p.returned_on => reasons.push(QuarantineReason::Expired),
        Some(expiry)
            if p.returned_on
                .checked_add_days(Days::new(floor))
                .is_none_or(|needed| expiry < needed) =>
        {
            reasons.push(QuarantineReason::BelowShelfLifeFloor);
        }
        Some(_) => {}
    }
    if p.cold_chain {
        reasons.push(QuarantineReason::ColdChain);
    }
    if p.controlled {
        reasons.push(QuarantineReason::Controlled);
    }
    if !within_window(p.sold_on, p.returned_on, p.window_days) {
        reasons.push(QuarantineReason::OutsideWindow);
    }
    if reasons.is_empty() {
        return Disposition::Restock;
    }
    Disposition::Quarantine {
        reasons,
        route: if p.controlled {
            DestructionRoute::Ndps
        } else {
            DestructionRoute::Bmw
        },
    }
}

/// The policy shown before purchase, at the counter and online (E-Commerce
/// Rules 2020: return, refund and grievance terms displayed up front).
#[must_use]
pub fn return_policy_text(window_days: i64) -> String {
    format!(
        "Returns within {window_days} days for a wrong, damaged, short-dated or excess \
         medicine; refunds go back to how you paid. A returned medicine goes back on the shelf \
         only if its pack is sealed, in date and was never refrigerated or controlled; anything \
         else is destroyed safely. Complaints are acknowledged within \
         {GRIEVANCE_ACK_HOURS} hours and resolved within {GRIEVANCE_RESOLVE_DAYS} days."
    )
}

/// Longest credit-note number GST allows: CGST Rules 2017, Rule 53(1A)
/// with Rule 46(b) — at most 16 characters, unique in the financial year.
pub const CREDIT_NOTE_MAX_CHARS: usize = 16;

/// A credit note number in the legal entity's own series for the financial
/// year starting in `fy_start`: `<prefix>C<yy><00001>`, within 16 characters.
#[must_use]
pub fn credit_note_number(prefix: &str, fy_start: i32, seq: i64) -> String {
    let room = CREDIT_NOTE_MAX_CHARS - 8;
    let prefix: String = prefix.chars().take(room).collect();
    format!("{prefix}C{:02}{seq:05}", fy_start.rem_euclid(100))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn day(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap_or(NaiveDate::MIN)
    }

    fn sealed_in_date() -> ReturnedPack {
        ReturnedPack {
            sealed: true,
            expiry: Some(day("2027-12-31")),
            cold_chain: false,
            controlled: false,
            sold_on: day("2026-10-01"),
            returned_on: day("2026-10-05"),
            window_days: 7,
            shelf_life_floor_days: 90,
        }
    }

    fn reasons(p: &ReturnedPack) -> Vec<QuarantineReason> {
        match disposition(p) {
            Disposition::Restock => Vec::new(),
            Disposition::Quarantine { reasons, .. } => reasons,
        }
    }

    #[test]
    fn a_sealed_in_date_pack_goes_back() {
        assert_eq!(disposition(&sealed_in_date()), Disposition::Restock);
    }

    #[test]
    fn each_legal_condition_quarantines_on_its_own() {
        let cases: [(fn(&mut ReturnedPack), QuarantineReason); 7] = [
            (|p| p.sealed = false, QuarantineReason::Opened),
            (
                |p| p.expiry = Some(day("2026-10-05")),
                QuarantineReason::Expired,
            ),
            (
                |p| p.expiry = Some(day("2026-12-01")),
                QuarantineReason::BelowShelfLifeFloor,
            ),
            (|p| p.cold_chain = true, QuarantineReason::ColdChain),
            (|p| p.controlled = true, QuarantineReason::Controlled),
            (|p| p.expiry = None, QuarantineReason::Untraceable),
            (
                |p| p.returned_on = day("2026-10-09"),
                QuarantineReason::OutsideWindow,
            ),
        ];
        for (change, reason) in cases {
            let mut p = sealed_in_date();
            change(&mut p);
            assert_eq!(reasons(&p), vec![reason]);
        }
    }

    #[test]
    fn controlled_drugs_go_to_the_ndps_register_the_rest_to_bmw() {
        let mut p = sealed_in_date();
        p.controlled = true;
        assert!(matches!(
            disposition(&p),
            Disposition::Quarantine {
                route: DestructionRoute::Ndps,
                ..
            }
        ));
        p.controlled = false;
        p.sealed = false;
        assert!(matches!(
            disposition(&p),
            Disposition::Quarantine {
                route: DestructionRoute::Bmw,
                ..
            }
        ));
    }

    #[test]
    fn the_last_day_of_the_window_still_counts() {
        assert!(within_window(day("2026-10-01"), day("2026-10-08"), 7));
        assert!(!within_window(day("2026-10-01"), day("2026-10-09"), 7));
    }

    #[test]
    fn credit_notes_fit_the_gst_limit() {
        assert_eq!(credit_note_number("PHARM", 2026, 7), "PHARMC2600007");
        let long = credit_note_number("ABCDEFGH", 2026, 99_999);
        assert!(long.len() <= CREDIT_NOTE_MAX_CHARS);
    }
}
