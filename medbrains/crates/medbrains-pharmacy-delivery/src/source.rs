//! Where a patient's delivery choice is kept: on a refill request, or on an
//! order from the online storefront. Both carry the same delivery columns,
//! so one delivery and payment path serves both.

use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Source {
    /// `prescription_refill_requests`
    Refill(Uuid),
    /// `pharmacy_store_orders`
    Store(Uuid),
}

impl Source {
    #[must_use]
    pub const fn id(self) -> Uuid {
        match self {
            Self::Refill(id) | Self::Store(id) => id,
        }
    }

    /// The table holding the choice.
    pub(crate) const fn table(self) -> &'static str {
        match self {
            Self::Refill(_) => "prescription_refill_requests",
            Self::Store(_) => "pharmacy_store_orders",
        }
    }

    /// The column on `pharmacy_deliveries`, and on the payment's notes, that
    /// names it.
    pub(crate) const fn key(self) -> &'static str {
        match self {
            Self::Refill(_) => "refill_request_id",
            Self::Store(_) => "store_order_id",
        }
    }
}
