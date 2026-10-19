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

/// When a patient may ask the parcel to come: their preference, not a
/// promise. Inferred, not from a spec; the hospital's runners work days.
pub const DELIVERY_SLOTS: [&str; 3] = ["morning", "afternoon", "evening"];

/// How a patient may pay for a delivery they ask for.
pub const PAY_ON_DELIVERY: &str = "cash_on_delivery";
pub const PAY_NOW: &str = "prepaid";

/// What a patient is offered when they ask for a refill: home delivery or
/// not, and if so how they may pay.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PatientOffer {
    pub available: bool,
    /// Why delivery isn't offered, in the patient's words.
    pub reason: Option<String>,
    /// [`PAY_ON_DELIVERY`] and/or [`PAY_NOW`]; empty when not available.
    pub payments: Vec<&'static str>,
}

/// Home delivery for a patient's own request. Stricter than what the
/// pharmacy may send: controlled and cold-chain medicines are collected.
/// `pay_on_delivery` is [`cash_on_delivery`]'s answer; `online_payment` is
/// whether the hospital can take a payment online.
#[must_use]
pub fn patient_offer(
    enabled: bool,
    lines: &[LineFacts],
    pay_on_delivery: bool,
    online_payment: bool,
) -> PatientOffer {
    let refuse = |reason: String| PatientOffer {
        available: false,
        reason: Some(reason),
        payments: Vec::new(),
    };
    if !enabled {
        return refuse("This hospital doesn't deliver medicines home yet".to_owned());
    }
    if let Some(l) = lines.iter().find(|l| l.controlled) {
        return refuse(format!(
            "{} is a controlled medicine: collect it at the pharmacy",
            l.name
        ));
    }
    if let Some(l) = lines.iter().find(|l| l.needs_cold_chain) {
        return refuse(format!(
            "{} must stay refrigerated: collect it at the pharmacy",
            l.name
        ));
    }
    let payments: Vec<&'static str> = [
        (pay_on_delivery, PAY_ON_DELIVERY),
        (online_payment, PAY_NOW),
    ]
    .into_iter()
    .filter_map(|(ok, p)| ok.then_some(p))
    .collect();
    if payments.is_empty() {
        return refuse(
            "Delivery is paid for first, and this hospital doesn't take payment online yet"
                .to_owned(),
        );
    }
    PatientOffer {
        available: true,
        reason: None,
        payments,
    }
}

/// Where a patient's delivery request stands, as the patient app shows it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PatientStage {
    Requested,
    AwaitingPayment,
    BeingPrepared,
    OutForDelivery,
    Delivered,
    Failed,
    Cancelled,
    /// The doctor declined the refill.
    Declined,
    /// The pharmacy found it can't travel; collect it instead.
    NotDeliverable,
}

impl PatientStage {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Requested => "requested",
            Self::AwaitingPayment => "awaiting_payment",
            Self::BeingPrepared => "being_prepared",
            Self::OutForDelivery => "out_for_delivery",
            Self::Delivered => "delivered",
            Self::Failed => "failed",
            Self::Cancelled => "cancelled",
            Self::Declined => "declined",
            Self::NotDeliverable => "not_deliverable",
        }
    }

    /// From the refill request's status, its delivery (once one exists),
    /// whether the pharmacy refused it, and whether a payment is owed.
    #[must_use]
    pub fn of(
        request_status: &str,
        delivery: Option<Status>,
        not_deliverable: bool,
        awaiting_payment: bool,
    ) -> Self {
        match delivery {
            Some(Status::Arranged) => Self::BeingPrepared,
            Some(Status::OutForDelivery) => Self::OutForDelivery,
            Some(Status::Delivered) => Self::Delivered,
            Some(Status::Failed) => Self::Failed,
            Some(Status::Cancelled) => Self::Cancelled,
            None if request_status == "declined" => Self::Declined,
            None if not_deliverable => Self::NotDeliverable,
            None if awaiting_payment => Self::AwaitingPayment,
            None => Self::Requested,
        }
    }
}

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
    fn patients_are_offered_delivery_only_when_it_can_go() {
        let plain = [line("Paracetamol", false, false)];
        let off = patient_offer(false, &plain, true, true);
        assert!(!off.available && off.reason.is_some_and(|r| r.contains("doesn't deliver")));
        let ndps = [
            line("Paracetamol", false, false),
            line("Tramadol", true, false),
        ];
        let refused = patient_offer(true, &ndps, true, true);
        assert!(!refused.available);
        assert!(refused.reason.is_some_and(|r| r.contains("Tramadol")));
        // A cold-chain medicine isn't sent home on the patient's request.
        let cold = [line("Insulin", false, true)];
        assert!(!patient_offer(true, &cold, true, true).available);
        // Pay on delivery is offered only when earned; online payment when set up.
        assert_eq!(
            patient_offer(true, &plain, true, true).payments,
            [PAY_ON_DELIVERY, PAY_NOW]
        );
        assert_eq!(patient_offer(true, &plain, false, true).payments, [PAY_NOW]);
        // A pay-first patient where nothing takes payment online: no delivery.
        let stuck = patient_offer(true, &plain, false, false);
        assert!(!stuck.available && stuck.reason.is_some_and(|r| r.contains("online")));
    }

    #[test]
    fn the_patient_sees_where_it_is() {
        use PatientStage as S;
        assert_eq!(S::of("sent_to_pharmacy", None, false, false), S::Requested);
        assert_eq!(S::of("with_doctor", None, false, true), S::AwaitingPayment);
        assert_eq!(S::of("declined", None, false, false), S::Declined);
        assert_eq!(
            S::of("sent_to_pharmacy", None, true, false),
            S::NotDeliverable
        );
        assert_eq!(
            S::of("sent_to_pharmacy", Some(Status::Arranged), false, false),
            S::BeingPrepared
        );
        assert_eq!(
            S::of(
                "sent_to_pharmacy",
                Some(Status::OutForDelivery),
                false,
                false
            )
            .as_str(),
            "out_for_delivery"
        );
        assert_eq!(
            S::of("sent_to_pharmacy", Some(Status::Failed), false, false),
            S::Failed
        );
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
