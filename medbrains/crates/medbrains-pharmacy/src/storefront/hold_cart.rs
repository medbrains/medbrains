//! Holding the cart at the store that will fill it, when the patient opens
//! checkout and again through pharmacist review (owner decision 1), on the
//! hospital's hold ladders. The store is chosen by the owner's order:
//! enabled, serving the pincode, holding every line, nearest.

use medbrains_server_core::error::AppError;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use super::checkout::{Line, cart_lines};
use super::holds::{HoldLine, HoldRequest};
use super::settings::StoreSettings;

/// Where the patient wants it: delivered to a pincode, or picked up.
#[derive(Debug)]
pub struct StorePick<'a> {
    pub delivery_pincode: Option<&'a str>,
    pub pickup_store: Option<Uuid>,
}

/// The hospital's storefront settings and order rules, read once.
pub(super) struct Ctx<'a> {
    pub(super) settings: &'a StoreSettings,
    pub(super) rules: &'a super::rules::OrderRules,
}

/// Choose the store that fills the cart and hold its lines there on the
/// checkout ladder. Returns the store (`None` for a one-pharmacy hospital).
pub(super) async fn hold(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    cart: Uuid,
    lines: &[Line],
    ctx: &Ctx<'_>,
    pick: &StorePick<'_>,
) -> Result<Option<Uuid>, AppError> {
    let settings = ctx.settings;
    let mut stores = super::stores::enabled(tx, tenant_id).await?;
    if let Some(chosen) = pick.pickup_store {
        stores.retain(|s| s.id == chosen);
        if stores.is_empty() {
            return Err(AppError::BadRequest(
                "Choose one of the pharmacies shown for pickup".to_owned(),
            ));
        }
    }
    let ids: Vec<Uuid> = lines.iter().map(|l| l.row.id).collect();
    let stock = super::stores::stock(
        tx,
        tenant_id,
        &ids,
        settings.min_shelf_life_days,
        Some(cart),
    )
    .await?;
    let wants: Vec<super::stores::Want> = lines
        .iter()
        .filter(|l| !l.short)
        .map(|l| super::stores::Want {
            item: l.row.id,
            quantity: l.quantity,
            floor: l.row.floor,
        })
        .collect();
    let near = super::limits::patient_pincode(tx, tenant_id, cart).await?;
    let store = super::stores::choose(
        &stores,
        &stock,
        &wants,
        pick.delivery_pincode,
        near.as_deref(),
    )?;
    let target = Target {
        cart,
        store,
        kind: "checkout",
        lines,
    };
    hold_lines(tx, tenant_id, &target, ctx).await?;
    Ok(store)
}

/// An order's lines to hold at a store, on the `kind` ladder.
pub(super) struct Target<'a> {
    pub(super) cart: Uuid,
    pub(super) store: Option<Uuid>,
    pub(super) kind: &'a str,
    pub(super) lines: &'a [Line],
}

/// Hold every line of the target.
pub(super) async fn hold_lines(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    target: &Target<'_>,
    ctx: &Ctx<'_>,
) -> Result<super::holds::Expiries, AppError> {
    let Target {
        cart,
        store,
        kind,
        lines,
    } = *target;
    let (settings, rules) = (ctx.settings, ctx.rules);
    let ids: Vec<Uuid> = lines.iter().map(|l| l.row.id).collect();
    let stock = super::stores::stock(
        tx,
        tenant_id,
        &ids,
        settings.min_shelf_life_days,
        Some(cart),
    )
    .await?;
    // A line out of stock isn't held: there is nothing to hold.
    let hold_lines: Vec<HoldLine> = lines
        .iter()
        .filter(|l| !l.short)
        .map(|l| HoldLine {
            item: l.row.id,
            name: l.row.name.clone(),
            quantity: l.quantity,
            floor: l.row.floor,
        })
        .collect();
    let tiers = if kind == "review" {
        &rules.hold_tiers.review
    } else {
        &rules.hold_tiers.checkout
    };
    let req = HoldRequest {
        store_order_id: cart,
        store,
        kind,
        lines: &hold_lines,
    };
    super::holds::place(tx, tenant_id, &req, &stock, tiers).await
}

/// `POST /api/portal/store/cart/hold` — the patient opened checkout: choose
/// the store and hold the cart there for the checkout ladder's time.
pub async fn hold_cart(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
    pick: &StorePick<'_>,
) -> Result<HeldCart, AppError> {
    let settings = super::settings::require_open(tx, tenant_id).await?;
    let cart = super::cart_id(tx, tenant_id, patient_id)
        .await?
        .ok_or_else(|| AppError::BadRequest("Your cart is empty".to_owned()))?;
    let lines = cart_lines(tx, tenant_id, cart, &settings).await?;
    if lines.is_empty() {
        return Err(AppError::BadRequest("Your cart is empty".to_owned()));
    }
    let rules = super::rules::load(tx, tenant_id).await?;
    let ctx = Ctx {
        settings: &settings,
        rules: &rules,
    };
    let store = hold(tx, tenant_id, cart, &lines, &ctx, pick).await?;
    let held_until: Option<chrono::DateTime<chrono::Utc>> = sqlx::query_scalar(
        "SELECT MIN(expires_at) FROM pharmacy_stock_holds \
          WHERE tenant_id = $1 AND store_order_id = $2 AND released_at IS NULL",
    )
    .bind(tenant_id)
    .bind(cart)
    .fetch_one(&mut **tx)
    .await?;
    Ok(HeldCart { store, held_until })
}

/// The cart held for checkout.
#[derive(Debug, serde::Serialize)]
pub struct HeldCart {
    /// The pharmacy that will fill it; none for a one-pharmacy hospital.
    pub store: Option<Uuid>,
    pub held_until: Option<chrono::DateTime<chrono::Utc>>,
}
