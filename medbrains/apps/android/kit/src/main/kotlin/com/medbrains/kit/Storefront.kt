package com.medbrains.kit

/**
 * The hospital pharmacy's storefront as the patient app applies it: what can
 * go in a cart, which prescription an order rides on, how statuses read. The
 * same rules as the web (`apps/web/src/pages/store/storefront.ts`) and iOS;
 * the server decides, this only shapes what is shown and sent.
 */
object Storefront {
    const val COUNTER_ONLY = "counter_only"
    val STOCK_LABELS = mapOf("available" to "In stock", "low" to "Few left", "out" to "Out of stock")
    val ORDER_STATUS_LABELS = mapOf(
        "awaiting_verification" to "With the pharmacist",
        "released" to "Being prepared",
        "rejected" to "Not approved",
        "cancelled" to "Cancelled",
    )
    val REJECT_REASON_LABELS = mapOf(
        "expired" to "Prescription expired",
        "illegible" to "Can't be read",
        "not_on_prescription" to "Not on the prescription",
        "quantity_exceeds_prescription" to "More than prescribed",
        "needs_consultation" to "Needs a consultation",
        "other" to "Other",
    )

    fun label(map: Map<String, String>, key: String): String = map[key] ?: key.replace('_', ' ')

    /** Whether a signed-in patient can put this in the cart now. */
    fun canAdd(onSale: Boolean, saleClass: String, price: String?, stock: String): Boolean =
        onSale && saleClass != COUNTER_ONLY && price != null && stock != "out"

    /** A quantity within 1 and the item's limit. */
    fun clamp(n: Int, max: Int): Int = n.coerceIn(1, max.coerceAtLeast(1))

    /** A prescription an order may ride on: not expired [today] (yyyy-MM-dd). */
    fun usable(validUntil: String?, today: String): Boolean = validUntil == null || validUntil >= today

    /** How a shared mobile's people are told apart. */
    fun personLabel(name: String, birthYear: Int?): String = birthYear?.let { "$name (born $it)" } ?: name

    /** The checkout's prescription, or why it can't be placed yet. */
    sealed interface Checkout {
        data class Ready(val source: String, val prescriptionId: String?) : Checkout
        data class Problem(val reason: String) : Checkout
    }

    /** Nothing needing a prescription goes without one; otherwise the hospital prescription picked wins over an upload. */
    fun checkout(lines: Int, allOnSale: Boolean, prescriptionNeeded: Boolean, hospitalId: String?, uploaded: Boolean): Checkout = when {
        lines == 0 -> Checkout.Problem("Your cart is empty")
        !allOnSale -> Checkout.Problem("Take out what can't be ordered online")
        !prescriptionNeeded -> Checkout.Ready("none", null)
        hospitalId != null -> Checkout.Ready("hospital", hospitalId)
        uploaded -> Checkout.Ready("upload", null)
        else -> Checkout.Problem("Choose one of your prescriptions, or upload one")
    }
}
