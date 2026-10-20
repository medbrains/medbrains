//! The one state machine every answer from a card machine goes through.

use super::{Approval, PosError, SaleState};

/// What to do with a sale after hearing from (or not hearing from) the machine.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Step {
    /// Still at the machine; `waiting` once the machine has it.
    Keep {
        waiting: bool,
    },
    Settle(Approval),
    Fail {
        code: &'static str,
        why: String,
    },
    Expire(String),
    /// The machine never gave a definite answer in time. Not a decline: the
    /// card may have been charged, so a person checks the machine's slip.
    Unknown(String),
}

/// `error_code` of a sale whose outcome nobody knows yet.
pub const UNKNOWN: &str = "unknown";

pub const NO_ANSWER: &str = "No definite answer from the card machine in time. Check the \
                             machine's last slip: if it shows approved, a supervisor records \
                             its RRN or approval code here; until then do not charge again";

/// The one state machine: an answer (or the lack of one) to a step.
/// `overdue` is whether the sale has outlived [`super::ANSWER_WITHIN_SECS`];
/// `cancel_confirmed` whether the provider confirmed a cancel of it.
///
/// Only a definite outcome closes a sale. A blip, a refusal to say, or an
/// answer we do not recognise keeps it open; past the window it becomes
/// [`Step::Unknown`] — never a decline — unless the provider confirmed the
/// cancel, which is a definite "no money taken".
pub fn next_step(
    answer: Result<SaleState, PosError>,
    overdue: bool,
    cancel_confirmed: bool,
) -> Step {
    match answer {
        Ok(SaleState::Approved(a)) => Step::Settle(a),
        Ok(SaleState::Declined(why)) => Step::Fail {
            code: "declined",
            why,
        },
        Ok(SaleState::Cancelled) => cancelled(),
        Ok(SaleState::TimedOut) => Step::Expire(
            "The machine timed out waiting for the card — no money was taken".to_owned(),
        ),
        Ok(SaleState::Waiting) | Err(_) if overdue && cancel_confirmed => cancelled(),
        Ok(SaleState::Waiting) | Err(_) if overdue => Step::Unknown(NO_ANSWER.to_owned()),
        Ok(SaleState::Waiting) => Step::Keep { waiting: true },
        // A blip or a refusal to say: keep asking until the sale is overdue.
        Err(_) => Step::Keep { waiting: false },
    }
}

/// The provider confirmed the cancel, or the machine says it was cancelled.
pub fn cancelled() -> Step {
    Step::Fail {
        code: "cancelled",
        why: "Cancelled — no money was taken".to_owned(),
    }
}

#[cfg(test)]
mod tests {
    use super::{Approval, PosError, SaleState, Step, next_step};
    use crate::pos::Tender;

    fn approval() -> Approval {
        Approval {
            reference: "PTR-1".to_owned(),
            approved_paise: None,
            card_last4: Some("4242".to_owned()),
            auth_code: Some("A1".to_owned()),
            ..Approval::default()
        }
    }

    #[test]
    fn an_approval_settles_even_when_it_comes_late() {
        assert_eq!(
            next_step(Ok(SaleState::Approved(approval())), false, false),
            Step::Settle(approval())
        );
        assert_eq!(
            next_step(Ok(SaleState::Approved(approval())), true, true),
            Step::Settle(approval())
        );
    }

    #[test]
    fn a_decline_or_cancel_fails_with_its_reason_and_posts_nothing() {
        let declined = next_step(
            Ok(SaleState::Declined("Insufficient funds".into())),
            false,
            false,
        );
        assert_eq!(
            declined,
            Step::Fail {
                code: "declined",
                why: "Insufficient funds".into()
            }
        );
        assert!(matches!(
            next_step(Ok(SaleState::Cancelled), false, false),
            Step::Fail {
                code: "cancelled",
                ..
            }
        ));
        assert!(matches!(
            next_step(Ok(SaleState::TimedOut), false, false),
            Step::Expire(_)
        ));
    }

    #[test]
    fn waiting_blips_and_refusals_keep_the_sale_open_then_become_unknown_never_declined() {
        let unknown = Step::Unknown(super::NO_ANSWER.to_owned());
        for answer in [
            Ok(SaleState::Waiting),
            Err(PosError::Offline("timeout".into())),
            Err(PosError::Refused("errorCode EZETAP_1".into())),
        ] {
            let open = next_step(answer.clone(), false, false);
            assert!(matches!(open, Step::Keep { .. }), "{answer:?} closed early");
            assert_eq!(next_step(answer, true, false), unknown);
        }
        assert_eq!(
            next_step(Ok(SaleState::Waiting), false, false),
            Step::Keep { waiting: true }
        );
    }

    #[test]
    fn a_confirmed_cancel_with_no_answer_by_the_deadline_is_a_cancel() {
        assert_eq!(
            next_step(Ok(SaleState::Waiting), true, true),
            super::cancelled()
        );
        // An approval that lands after the cancel still settles.
        assert_eq!(
            next_step(Ok(SaleState::Approved(approval())), true, true),
            Step::Settle(approval())
        );
    }

    #[test]
    fn tender_falls_back_to_what_the_cashier_asked_for() {
        assert_eq!(Tender::fallback_method(Some("upi")), "upi");
        assert_eq!(Tender::fallback_method(Some("either")), "card");
        assert_eq!(Tender::fallback_method(None), "card");
    }
}
