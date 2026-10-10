//! Home delivery of pharmacy orders: what may go, how, and who may pay at
//! the door. Pure rules, so the pharmacy screen and the server agree.

/// How the parcel travels.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Mode {
    /// The hospital's own delivery runner, with a cool box.
    Runner,
    /// An outside courier.
    Courier,
}

impl Mode {
    #[must_use]
    pub fn parse(raw: &str) -> Option<Self> {
        match raw {
            "runner" => Some(Self::Runner),
            "courier" => Some(Self::Courier),
            _ => None,
        }
    }
}

/// What delivery cares about on one line of the order.
#[derive(Debug, Clone)]
pub struct LineFacts {
    pub name: String,
    /// Schedule X, H1, NDPS or flagged controlled.
    pub controlled: bool,
    pub needs_cold_chain: bool,
}

/// Why this order can't go out this way, one reason per line; empty when it can.
///
/// Controlled drugs are collected at the pharmacy, against the register and
/// the patient's identity. A drug that needs refrigeration travels only with
/// the hospital's runner, never by courier.
#[must_use]
pub fn blockers(lines: &[LineFacts], mode: Mode) -> Vec<String> {
    lines
        .iter()
        .filter_map(|l| {
            if l.controlled {
                Some(format!(
                    "{} is a controlled drug: collection at the pharmacy only",
                    l.name
                ))
            } else if l.needs_cold_chain && mode == Mode::Courier {
                Some(format!(
                    "{} needs refrigeration: send it with a runner, not a courier",
                    l.name
                ))
            } else {
                None
            }
        })
        .collect()
}

/// A patient's record with home deliveries, from which cash on delivery is
/// earned.
#[derive(Debug, Clone, Copy, Default)]
pub struct History {
    /// Delivered and paid in full.
    pub delivered: i64,
    /// Attempts that failed at the door.
    pub failed: i64,
    /// Delivered with less cash collected than was due.
    pub short_paid: i64,
}

/// Deliveries a patient completes before they may pay at the door, unless the
/// hospital sets otherwise.
pub const DEFAULT_COD_MIN_DELIVERIES: i64 = 2;

/// Whether this patient may pay on delivery; `Err` says why not, for the
/// pharmacist, who then takes payment before dispatch.
///
/// # Errors
/// The reason cash on delivery isn't offered.
pub fn cash_on_delivery(history: History, min_delivered: i64) -> Result<(), String> {
    if history.failed > 0 || history.short_paid > 0 {
        return Err(format!(
            "Pay before dispatch: {} failed and {} short-paid deliveries on record",
            history.failed, history.short_paid
        ));
    }
    if history.delivered < min_delivered {
        return Err(format!(
            "Pay before dispatch: cash on delivery after {min_delivered} paid deliveries ({} so far)",
            history.delivered
        ));
    }
    Ok(())
}

/// Where a delivery is.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Status {
    Arranged,
    OutForDelivery,
    Delivered,
    Failed,
    Cancelled,
}

impl Status {
    #[must_use]
    pub fn parse(raw: &str) -> Option<Self> {
        Some(match raw {
            "arranged" => Self::Arranged,
            "out_for_delivery" => Self::OutForDelivery,
            "delivered" => Self::Delivered,
            "failed" => Self::Failed,
            "cancelled" => Self::Cancelled,
            _ => return None,
        })
    }

    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Arranged => "arranged",
            Self::OutForDelivery => "out_for_delivery",
            Self::Delivered => "delivered",
            Self::Failed => "failed",
            Self::Cancelled => "cancelled",
        }
    }

    /// Arranged → out → delivered or failed; only an arranged delivery is
    /// cancelled. Delivered, failed and cancelled are final — a failed one is
    /// arranged afresh.
    #[must_use]
    pub const fn may_move_to(self, to: Self) -> bool {
        matches!(
            (self, to),
            (Self::Arranged, Self::OutForDelivery | Self::Cancelled)
                | (Self::OutForDelivery, Self::Delivered | Self::Failed)
        )
    }
}

/// Wrong codes allowed at the door before the delivery has to be re-sent.
pub const MAX_OTP_ATTEMPTS: i32 = 5;

#[cfg(test)]
mod tests {
    use super::*;

    fn line(name: &str, controlled: bool, cold: bool) -> LineFacts {
        LineFacts {
            name: name.to_owned(),
            controlled,
            needs_cold_chain: cold,
        }
    }

    #[test]
    fn controlled_drugs_never_go_out() {
        let lines = [
            line("Paracetamol", false, false),
            line("Tramadol", true, false),
        ];
        let runner = blockers(&lines, Mode::Runner);
        assert_eq!(runner.len(), 1);
        assert!(runner[0].contains("Tramadol"));
    }

    #[test]
    fn cold_chain_goes_with_a_runner_only() {
        let lines = [line("Insulin glargine", false, true)];
        assert!(blockers(&lines, Mode::Runner).is_empty());
        assert!(blockers(&lines, Mode::Courier)[0].contains("refrigeration"));
    }

    #[test]
    fn cash_on_delivery_is_earned() {
        let new = History::default();
        assert!(cash_on_delivery(new, 2).is_err_and(|m| m.contains("0 so far")));
        let trusted = History {
            delivered: 2,
            ..History::default()
        };
        assert!(cash_on_delivery(trusted, 2).is_ok());
        let refused = History {
            delivered: 5,
            failed: 1,
            ..History::default()
        };
        assert!(cash_on_delivery(refused, 2).is_err());
        let short = History {
            delivered: 5,
            short_paid: 1,
            ..History::default()
        };
        assert!(cash_on_delivery(short, 2).is_err());
        // A hospital may offer it to everyone.
        assert!(cash_on_delivery(new, 0).is_ok());
    }

    #[test]
    fn deliveries_move_one_way() {
        assert!(Status::Arranged.may_move_to(Status::OutForDelivery));
        assert!(Status::OutForDelivery.may_move_to(Status::Delivered));
        assert!(Status::OutForDelivery.may_move_to(Status::Failed));
        assert!(!Status::OutForDelivery.may_move_to(Status::Cancelled));
        assert!(!Status::Delivered.may_move_to(Status::Failed));
        assert!(!Status::Arranged.may_move_to(Status::Delivered));
    }
}
