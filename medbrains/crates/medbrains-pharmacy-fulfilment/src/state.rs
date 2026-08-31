//! The transition table, and nothing else.
//!
//! Kept free of `sqlx`, `axum` and `AppState` on purpose: which moves are legal
//! is the part of fulfilment that has to be *provably* right, and a rule that
//! can only be exercised by standing up Postgres and posting HTTP is a rule
//! nobody exercises. Everything here is decided by constructing values.

use std::fmt;

/// Where an order is.
///
/// One column, not two, so the two operating models cannot disagree about the
/// answer. The mode decides which moves are legal, not which vocabulary is used.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Stage {
    Ordered,
    Picking,
    Packed,
    Verified,
    Ready,
    Collected,
    Released,
    Dispensed,
    PartiallyDispensed,
    Cancelled,
    Returned,
}

impl Stage {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Ordered => "ordered",
            Self::Picking => "picking",
            Self::Packed => "packed",
            Self::Verified => "verified",
            Self::Ready => "ready",
            Self::Collected => "collected",
            Self::Released => "released",
            Self::Dispensed => "dispensed",
            Self::PartiallyDispensed => "partially_dispensed",
            Self::Cancelled => "cancelled",
            Self::Returned => "returned",
        }
    }

    pub fn parse(raw: &str) -> Option<Self> {
        Some(match raw {
            "ordered" => Self::Ordered,
            "picking" => Self::Picking,
            "packed" => Self::Packed,
            "verified" => Self::Verified,
            "ready" => Self::Ready,
            "collected" => Self::Collected,
            "released" => Self::Released,
            "dispensed" => Self::Dispensed,
            "partially_dispensed" => Self::PartiallyDispensed,
            "cancelled" => Self::Cancelled,
            "returned" => Self::Returned,
            _ => return None,
        })
    }

    /// Has the medicine reached the patient, or gone back on the shelf?
    ///
    /// The states from which nothing further happens. Used to answer "is this
    /// order still in flight" without enumerating the live states, which is the
    /// list that keeps growing.
    pub const fn is_terminal(self) -> bool {
        matches!(
            self,
            Self::Collected
                | Self::Released
                | Self::Dispensed
                | Self::Cancelled
                | Self::Returned
                | Self::PartiallyDispensed
        )
    }

    /// Is the stock for this order committed but not yet handed over?
    ///
    /// True for every state between billing and the counter. This is the set
    /// that has to give the stock back if the order ends without a handover —
    /// an uncollected bag is off the books and on the shelf at the same time.
    pub const fn holds_committed_stock(self) -> bool {
        matches!(
            self,
            Self::Ordered | Self::Picking | Self::Packed | Self::Verified | Self::Ready
        )
    }
}

impl fmt::Display for Stage {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// How a store hands medicine over.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Mode {
    /// Paid for and handed across the same counter. No orchestration, and none
    /// wanted.
    Direct,
    /// Paid at the counter, picked and packed in the back, collected against a
    /// token.
    PackAndCollect,
}

impl Mode {
    pub fn parse(raw: &str) -> Self {
        match raw {
            "pack_and_collect" => Self::PackAndCollect,
            // Anything unrecognised falls back to the mode that needs no
            // machinery. A store with a typo in its config should still be able
            // to hand medicine to a patient.
            _ => Self::Direct,
        }
    }

    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Direct => "direct",
            Self::PackAndCollect => "pack_and_collect",
        }
    }
}

/// The mode this *order* runs in, which is not always the mode its store runs in.
///
/// A controlled drug is forced to `Direct` whatever the store is set to. The
/// whole control on a narcotic is dual custody at the moment it leaves the
/// cabinet; a packed bag sitting on a shelf with a token on it has neither
/// custody nor a witness. It is handed over by a pharmacist, at the counter,
/// with a witness, as the SOP already requires and as `dispense_order` already
/// enforces.
pub const fn effective_mode(store_mode: Mode, has_controlled_line: bool) -> Mode {
    if has_controlled_line {
        Mode::Direct
    } else {
        store_mode
    }
}

/// Why a move was refused.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Refusal {
    /// The order is not in a state this move can start from.
    WrongStage { from: Stage, to: Stage },
    /// The store hands over at the counter; there is no pack to pick.
    NotPackAndCollect { to: Stage },
    /// Lines on this order have not been checked against the order.
    Unverified { outstanding: usize },
}

impl fmt::Display for Refusal {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::WrongStage { from, to } => {
                write!(f, "an order that is {from} cannot become {to}")
            }
            Self::NotPackAndCollect { to } => write!(
                f,
                "this pharmacy hands medicine over at the counter — {to} does not apply. \
                 A controlled line also forces counter handover whatever the store is set to."
            ),
            Self::Unverified { outstanding } => write!(
                f,
                "{outstanding} line(s) have not been checked against the order — \
                 verification cannot be skipped"
            ),
        }
    }
}

/// May this order move from `from` to `to`?
///
/// `unverified_lines` is only consulted for the move that depends on it, but is
/// taken unconditionally so no caller can reach `Ready` by not looking.
pub fn may_transition(
    mode: Mode,
    from: Stage,
    to: Stage,
    unverified_lines: usize,
) -> Result<(), Refusal> {
    // Every pack-and-collect stage needs the store to actually be in that mode.
    // Asked first so a direct-mode caller gets told the truth about why, rather
    // than a stage complaint that sends them looking at the order.
    if matches!(
        to,
        Stage::Picking | Stage::Packed | Stage::Verified | Stage::Ready | Stage::Collected
    ) && mode != Mode::PackAndCollect
    {
        return Err(Refusal::NotPackAndCollect { to });
    }

    let legal = match to {
        Stage::Picking => from == Stage::Ordered,
        Stage::Packed => from == Stage::Picking,
        Stage::Verified => from == Stage::Packed,
        Stage::Ready => from == Stage::Verified,
        Stage::Collected => from == Stage::Ready,
        // Same source stage as `collected` and deliberately a separate arm:
        // one is the medicine reaching the patient and the other is it going
        // back on the shelf. Merging them would read as if they were the same
        // event.
        #[allow(clippy::match_same_arms)]
        // Only from `ready`: released means the order was waiting to be
        // collected and nobody came. An order abandoned earlier is cancelled,
        // which returns the stock the same way.
        Stage::Released => from == Stage::Ready,
        Stage::Cancelled => from.holds_committed_stock(),
        // Not this module's business — `dispense_order` owns the counter path,
        // and returns are their own flow.
        _ => false,
    };

    if !legal {
        return Err(Refusal::WrongStage { from, to });
    }

    // The gate that is the point of the whole exercise. `verified` is the state
    // that says a human compared the bag to the order; reaching `ready` without
    // it would make the check optional, and an optional check is not a check.
    if to == Stage::Verified && unverified_lines > 0 {
        return Err(Refusal::Unverified {
            outstanding: unverified_lines,
        });
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    #![allow(
        clippy::expect_used,
        clippy::unwrap_used,
        clippy::panic,
        clippy::indexing_slicing
    )]

    use super::*;

    const CLEAN: usize = 0;

    #[test]
    fn the_happy_path_walks_end_to_end() {
        let path = [
            (Stage::Ordered, Stage::Picking),
            (Stage::Picking, Stage::Packed),
            (Stage::Packed, Stage::Verified),
            (Stage::Verified, Stage::Ready),
            (Stage::Ready, Stage::Collected),
        ];
        for (from, to) in path {
            assert!(
                may_transition(Mode::PackAndCollect, from, to, CLEAN).is_ok(),
                "{from} → {to} should be legal"
            );
        }
    }

    #[test]
    fn verification_cannot_be_skipped() {
        // The one that matters. If packing could reach `ready` directly, the
        // check against the order would be advisory, and an unchecked bag would
        // go out looking identical to a checked one.
        assert_eq!(
            may_transition(Mode::PackAndCollect, Stage::Packed, Stage::Ready, CLEAN),
            Err(Refusal::WrongStage {
                from: Stage::Packed,
                to: Stage::Ready
            })
        );
    }

    #[test]
    fn a_pack_with_unchecked_lines_cannot_be_called_verified() {
        assert_eq!(
            may_transition(Mode::PackAndCollect, Stage::Packed, Stage::Verified, 2),
            Err(Refusal::Unverified { outstanding: 2 })
        );
        assert!(may_transition(Mode::PackAndCollect, Stage::Packed, Stage::Verified, 0).is_ok());
    }

    #[test]
    fn a_counter_pharmacy_has_no_picking_queue() {
        assert_eq!(
            may_transition(Mode::Direct, Stage::Ordered, Stage::Picking, CLEAN),
            Err(Refusal::NotPackAndCollect { to: Stage::Picking })
        );
    }

    #[test]
    fn a_controlled_line_forces_counter_handover() {
        // The single most important rule here. Dual custody is the whole control
        // on a narcotic, and a bag on a shelf with a token on it has no custody
        // at all — so a controlled order never enters the pack route, however
        // the store is configured.
        assert_eq!(effective_mode(Mode::PackAndCollect, true), Mode::Direct);
        assert_eq!(
            effective_mode(Mode::PackAndCollect, false),
            Mode::PackAndCollect
        );

        let mode = effective_mode(Mode::PackAndCollect, true);
        assert!(may_transition(mode, Stage::Ordered, Stage::Picking, CLEAN).is_err());
    }

    #[test]
    fn a_collected_order_is_finished_with() {
        for to in [
            Stage::Picking,
            Stage::Packed,
            Stage::Ready,
            Stage::Cancelled,
        ] {
            assert!(
                may_transition(Mode::PackAndCollect, Stage::Collected, to, CLEAN).is_err(),
                "collected → {to} must be refused"
            );
        }
    }

    #[test]
    fn release_is_only_for_an_order_that_was_waiting_to_be_collected() {
        assert!(may_transition(Mode::PackAndCollect, Stage::Ready, Stage::Released, CLEAN).is_ok());
        for from in [
            Stage::Ordered,
            Stage::Picking,
            Stage::Packed,
            Stage::Verified,
        ] {
            assert!(
                may_transition(Mode::PackAndCollect, from, Stage::Released, CLEAN).is_err(),
                "{from} → released must be refused; cancel returns the stock instead"
            );
        }
    }

    #[test]
    fn an_order_can_be_cancelled_at_any_point_before_handover() {
        for from in [
            Stage::Ordered,
            Stage::Picking,
            Stage::Packed,
            Stage::Verified,
            Stage::Ready,
        ] {
            assert!(
                may_transition(Mode::PackAndCollect, from, Stage::Cancelled, CLEAN).is_ok(),
                "{from} → cancelled should be legal"
            );
        }
        assert!(may_transition(
            Mode::PackAndCollect,
            Stage::Released,
            Stage::Cancelled,
            CLEAN
        )
        .is_err());
    }

    #[test]
    fn every_state_that_holds_stock_is_one_that_must_give_it_back() {
        // Stock is deducted at billing, so it is committed from `ordered`.
        // If this set and the set of states that can reach `cancelled` ever
        // disagree, an order ends without a handover and without a restock.
        for stage in [
            Stage::Ordered,
            Stage::Picking,
            Stage::Packed,
            Stage::Verified,
            Stage::Ready,
        ] {
            assert!(stage.holds_committed_stock(), "{stage} holds stock");
            assert!(!stage.is_terminal(), "{stage} is still in flight");
        }
        for stage in [
            Stage::Collected,
            Stage::Released,
            Stage::Cancelled,
            Stage::Dispensed,
        ] {
            assert!(!stage.holds_committed_stock(), "{stage} has settled");
            assert!(stage.is_terminal(), "{stage} is finished");
        }
    }

    #[test]
    fn stage_round_trips_through_its_database_spelling() {
        // These strings are the CHECK constraint in 0989. A typo here writes a
        // status the database will reject at runtime and nowhere else.
        for stage in [
            Stage::Ordered,
            Stage::Picking,
            Stage::Packed,
            Stage::Verified,
            Stage::Ready,
            Stage::Collected,
            Stage::Released,
            Stage::Dispensed,
            Stage::PartiallyDispensed,
            Stage::Cancelled,
            Stage::Returned,
        ] {
            assert_eq!(Stage::parse(stage.as_str()), Some(stage));
        }
        assert_eq!(Stage::parse("nonsense"), None);
    }

    #[test]
    fn an_unrecognised_mode_still_dispenses_medicine() {
        assert_eq!(Mode::parse("pack_and_collect"), Mode::PackAndCollect);
        assert_eq!(Mode::parse("direct"), Mode::Direct);
        assert_eq!(Mode::parse(""), Mode::Direct);
        assert_eq!(Mode::parse("paks_and_collekt"), Mode::Direct);
    }
}
