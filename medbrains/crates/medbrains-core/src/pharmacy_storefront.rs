//! The patient storefront: what a patient may order online from the
//! hospital's own pharmacy, at what price, and what each order needs before
//! it goes to fulfilment. Pure rules, so the portal, the apps and the server
//! agree.
//!
//! The model (research brief 2026-10-19): a remote ordering channel for the
//! hospital's licensed retail pharmacy, not an e-pharmacy. A registered
//! pharmacist verifies every prescription line; the sale concludes at the
//! licensed premises and delivery is a separate step.
//!
//! Drugs and Cosmetics Rules 1945, Rule 65: Schedule H and H1 are sold only
//! against a prescription; Schedule X, NDPS and controlled drugs are never
//! ordered remotely. H1 and habit-forming drugs are pickup only, a unit at a
//! time. H1 sales record the prescriber and the patient.

use rust_decimal::{Decimal, RoundingStrategy};

/// Shown on a Schedule X, NDPS or controlled item.
pub const COUNTER_ONLY: &str = "Available at the pharmacy counter only";
/// Lines in one cart, at most.
pub const MAX_CART_LINES: usize = 20;
/// Packs of one item per order when the catalogue sets no limit. Inferred,
/// not from a spec: a month's supply of most strips.
pub const DEFAULT_MAX_QTY: i32 = 10;
/// The highest online discount off MRP a hospital may set.
pub const MAX_DISCOUNT_PERCENT: u32 = 50;
/// Uploaded prescriptions: a photo or a PDF.
pub const RX_CONTENT_TYPES: [&str; 3] = ["image/jpeg", "image/png", "application/pdf"];
/// Largest uploaded prescription, in bytes. Inferred: a phone photo.
pub const MAX_RX_BYTES: usize = 8 * 1024 * 1024;

/// How an item may be sold online.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SaleClass {
    /// Over the counter: order it directly.
    Otc,
    /// Schedule H or H1: needs a prescription.
    Prescription,
    /// Schedule X, NDPS or controlled: never online.
    CounterOnly,
}

impl SaleClass {
    #[must_use]
    pub fn of(schedule: Option<&str>, controlled: bool) -> Self {
        match schedule {
            _ if controlled => Self::CounterOnly,
            Some("X" | "NDPS") => Self::CounterOnly,
            Some("H" | "H1") => Self::Prescription,
            _ => Self::Otc,
        }
    }

    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Otc => "otc",
            Self::Prescription => "prescription",
            Self::CounterOnly => "counter_only",
        }
    }
}

/// Units at or under which an item reads "few left". Inferred, not from a
/// spec.
pub const FEW_LEFT_UNITS: i32 = 10;
/// Days of shelf life a batch must have left to go out on an online order
/// (`pharmacy.min_shelf_life_days`), unless the hospital says otherwise.
pub const DEFAULT_MIN_SHELF_LIFE_DAYS: i32 = 90;
/// Units of an H1 or habit-forming drug in one online order
/// (`pharmacy.habit_forming_max_units`), unless the hospital says otherwise.
pub const DEFAULT_RESTRICTED_MAX_UNITS: i32 = 1;

/// Stock as the patient sees it, from the units online may still take
/// (shelf-life-fit batch stock above the online floor): never a count.
#[must_use]
pub const fn stock_level(available: i32) -> &'static str {
    if available <= 0 {
        "out"
    } else if available <= FEW_LEFT_UNITS {
        "low"
    } else {
        "available"
    }
}

/// The most of one item in an order: the item's own limit, and for an H1
/// or habit-forming drug the hospital's cap as well.
#[must_use]
pub fn max_units(item_max: i32, restricted: bool, restricted_cap: i32) -> i32 {
    if restricted {
        item_max.min(restricted_cap.max(1))
    } else {
        item_max
    }
}

/// The hospital's online discount, bounded to `0..=MAX_DISCOUNT_PERCENT`.
#[must_use]
pub fn clamp_discount(percent: Decimal) -> Decimal {
    percent.clamp(Decimal::ZERO, Decimal::from(MAX_DISCOUNT_PERCENT))
}

/// The selling price less the hospital's discount, to the paisa, and never
/// above the MRP printed on the batch (`cap`). Prices include GST.
#[must_use]
pub fn online_price(price: Decimal, discount_percent: Decimal, cap: Option<Decimal>) -> Decimal {
    let off = price * clamp_discount(discount_percent) / Decimal::ONE_HUNDRED;
    let discounted =
        (price - off).round_dp_with_strategy(2, RoundingStrategy::MidpointAwayFromZero);
    cap.map_or(discounted, |c| discounted.min(c))
}

/// The price before GST, which the bill adds back: a bill never charges
/// more than the tax-inclusive price.
#[must_use]
pub fn taxable_unit_price(inclusive: Decimal, gst_percent: Decimal) -> Decimal {
    (inclusive * Decimal::ONE_HUNDRED / (Decimal::ONE_HUNDRED + gst_percent.max(Decimal::ZERO)))
        .round_dp_with_strategy(2, RoundingStrategy::ToZero)
}

/// Where the prescription for an order's H/H1 lines comes from.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RxSource {
    None,
    /// One of the patient's own prescriptions from this hospital.
    Hospital,
    /// A photo or PDF the patient uploaded; a pharmacist verifies it.
    Upload,
}

impl RxSource {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::None => "none",
            Self::Hospital => "hospital",
            Self::Upload => "upload",
        }
    }
}

/// One cart line as checkout sees it.
#[derive(Debug, Clone)]
pub struct CartLine {
    pub name: String,
    pub class: SaleClass,
}

/// What happens to an order at checkout.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Release {
    /// Straight to fulfilment.
    Now,
    /// A pharmacist verifies the uploaded prescription first.
    AfterVerification,
}

/// Whether the cart may be ordered with this prescription source, and what
/// happens next; `Err` says why not, in the patient's words.
///
/// # Errors
/// The reason checkout is refused.
pub fn checkout(lines: &[CartLine], rx: RxSource) -> Result<Release, String> {
    if lines.is_empty() {
        return Err("Your cart is empty".to_owned());
    }
    if let Some(l) = lines.iter().find(|l| l.class == SaleClass::CounterOnly) {
        return Err(format!("{}: {}", l.name, COUNTER_ONLY.to_lowercase()));
    }
    let needing: Vec<&str> = lines
        .iter()
        .filter(|l| l.class == SaleClass::Prescription)
        .map(|l| l.name.as_str())
        .collect();
    // A pharmacist verifies every prescription line, the hospital's own
    // prescriptions included.
    match (needing.is_empty(), rx) {
        (true, _) => Ok(Release::Now),
        (false, RxSource::Hospital | RxSource::Upload) => Ok(Release::AfterVerification),
        (false, RxSource::None) => Err(format!(
            "{} need a prescription: choose one from this hospital or upload one",
            needing.join(", ")
        )),
    }
}

/// Why a pharmacist may refuse a line.
pub const REJECT_REASONS: [&str; 6] = [
    "expired",
    "illegible",
    "not_on_prescription",
    "quantity_exceeds_prescription",
    "needs_consultation",
    "other",
];

/// The pharmacist's verdict on one prescription line: approve, perhaps for
/// fewer units than asked, or refuse with a reason.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LineVerdict {
    Approve { quantity: i32 },
    Reject { reason: String },
}

/// Whether a verdict on a line of `requested` units is complete.
///
/// # Errors
/// What is wrong with it.
pub fn line_verdict_problem(verdict: &LineVerdict, requested: i32) -> Result<(), String> {
    match verdict {
        LineVerdict::Approve { quantity } if *quantity < 1 || *quantity > requested => Err(
            format!("Approve between 1 and {requested}: the patient asked for {requested}"),
        ),
        LineVerdict::Reject { reason } if !REJECT_REASONS.contains(&reason.as_str()) => {
            Err("Choose why the line is refused".to_owned())
        }
        _ => Ok(()),
    }
}

/// Schedule H1 needs the prescriber and the patient on record (Rule 65(3A)).
///
/// # Errors
/// What is missing.
pub fn h1_record_problem(
    prescriber_name: Option<&str>,
    prescriber_registration: Option<&str>,
    patient_address: Option<&str>,
) -> Result<(), String> {
    let blank = |v: Option<&str>| v.is_none_or(|s| s.trim().is_empty());
    if blank(prescriber_name) || blank(prescriber_registration) {
        return Err("Schedule H1: enter the prescriber's name and registration number".to_owned());
    }
    if blank(patient_address) {
        return Err("Schedule H1: enter the patient's address".to_owned());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn line(name: &str, class: SaleClass) -> CartLine {
        CartLine {
            name: name.to_owned(),
            class,
        }
    }

    #[test]
    fn schedules_decide_how_it_sells() {
        assert_eq!(SaleClass::of(None, false), SaleClass::Otc);
        assert_eq!(SaleClass::of(Some("G"), false), SaleClass::Otc);
        assert_eq!(SaleClass::of(Some("H"), false), SaleClass::Prescription);
        assert_eq!(SaleClass::of(Some("H1"), false), SaleClass::Prescription);
        assert_eq!(SaleClass::of(Some("X"), false), SaleClass::CounterOnly);
        assert_eq!(SaleClass::of(Some("NDPS"), false), SaleClass::CounterOnly);
        assert_eq!(SaleClass::of(Some("H"), true), SaleClass::CounterOnly);
    }

    #[test]
    fn stock_is_a_word_never_a_count() {
        assert_eq!(stock_level(0), "out");
        assert_eq!(stock_level(-3), "out");
        assert_eq!(stock_level(FEW_LEFT_UNITS), "low");
        assert_eq!(stock_level(FEW_LEFT_UNITS + 1), "available");
    }

    #[test]
    fn price_is_mrp_less_the_discount_and_the_bill_never_exceeds_it() {
        let mrp = Decimal::new(11_250, 2);
        assert_eq!(online_price(mrp, Decimal::ZERO, None), mrp);
        assert_eq!(
            online_price(mrp, Decimal::TEN, None),
            Decimal::new(10_125, 2)
        );
        // A discount past the cap is held at the cap.
        assert_eq!(
            online_price(mrp, Decimal::from(90), None),
            Decimal::new(5_625, 2)
        );
        // Never above the batch's printed MRP.
        let batch_mrp = Some(Decimal::new(10_000, 2));
        assert_eq!(
            online_price(mrp, Decimal::ZERO, batch_mrp),
            Decimal::new(10_000, 2)
        );
        let taxable = taxable_unit_price(Decimal::new(11_200, 2), Decimal::from(12));
        assert_eq!(taxable, Decimal::new(10_000, 2));
        let billed = taxable + taxable * Decimal::from(12) / Decimal::ONE_HUNDRED;
        assert!(billed <= Decimal::new(11_200, 2));
    }

    #[test]
    fn checkout_follows_the_schedules() {
        let otc = [line("Paracetamol", SaleClass::Otc)];
        assert_eq!(checkout(&otc, RxSource::None), Ok(Release::Now));
        let h = [
            line("Paracetamol", SaleClass::Otc),
            line("Azithromycin", SaleClass::Prescription),
        ];
        assert!(checkout(&h, RxSource::None).is_err_and(|e| e.contains("Azithromycin")));
        // The pharmacist verifies a hospital prescription's lines too.
        assert_eq!(
            checkout(&h, RxSource::Hospital),
            Ok(Release::AfterVerification)
        );
        assert_eq!(
            checkout(&h, RxSource::Upload),
            Ok(Release::AfterVerification)
        );
        let x = [line("Buprenorphine", SaleClass::CounterOnly)];
        assert!(checkout(&x, RxSource::Upload).is_err_and(|e| e.contains("counter only")));
        assert!(checkout(&[], RxSource::None).is_err());
    }

    #[test]
    fn each_line_has_a_verdict() {
        let ok = LineVerdict::Approve { quantity: 2 };
        assert!(line_verdict_problem(&ok, 3).is_ok());
        assert!(line_verdict_problem(&LineVerdict::Approve { quantity: 4 }, 3).is_err());
        assert!(line_verdict_problem(&LineVerdict::Approve { quantity: 0 }, 3).is_err());
        let why = LineVerdict::Reject {
            reason: "illegible".to_owned(),
        };
        assert!(line_verdict_problem(&why, 3).is_ok());
        let vague = LineVerdict::Reject {
            reason: "nope".to_owned(),
        };
        assert!(line_verdict_problem(&vague, 3).is_err());
    }

    #[test]
    fn restricted_drugs_go_a_unit_at_a_time() {
        assert_eq!(max_units(10, false, 1), 10);
        assert_eq!(max_units(10, true, 1), 1);
        assert_eq!(max_units(10, true, 0), 1);
    }

    #[test]
    fn h1_records_prescriber_and_patient() {
        assert!(h1_record_problem(None, Some("TN-1"), Some("12 Lake Rd")).is_err());
        assert!(h1_record_problem(Some("Dr A"), Some(" "), Some("12 Lake Rd")).is_err());
        assert!(h1_record_problem(Some("Dr A"), Some("TN-1"), None).is_err());
        assert!(h1_record_problem(Some("Dr A"), Some("TN-1"), Some("12 Lake Rd")).is_ok());
    }
}
