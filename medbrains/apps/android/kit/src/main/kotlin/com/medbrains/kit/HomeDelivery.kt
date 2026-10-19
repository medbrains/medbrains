package com.medbrains.kit

import kotlinx.serialization.Serializable

/**
 * A patient's pickup-or-delivery choice for a refill, and how a delivery's
 * progress reads. The same rules as the web portal
 * (`apps/web/src/pages/portal/portal-delivery.ts`) and iOS; the server decides
 * what is offered, this only checks and shapes what is sent.
 */
object HomeDelivery {
    const val PAY_ON_DELIVERY = "cash_on_delivery"
    const val PAY_NOW = "prepaid"
    /** Digits in a phone number, as the server checks. */
    val PHONE_DIGITS = 10..15
    /** The shortest address worth sending a runner to. */
    const val MIN_ADDRESS_LENGTH = 5

    val PAYMENT_LABELS = mapOf(PAY_ON_DELIVERY to "Pay on delivery", PAY_NOW to "Pay now")
    val SLOT_LABELS = mapOf("morning" to "Morning", "afternoon" to "Afternoon", "evening" to "Evening")
    val STAGE_LABELS = mapOf(
        "requested" to "Requested",
        "awaiting_payment" to "Waiting for payment",
        "being_prepared" to "Being prepared",
        "out_for_delivery" to "Out for delivery",
        "delivered" to "Delivered",
        "failed" to "Not delivered",
        "cancelled" to "Cancelled",
        "declined" to "Declined by your doctor",
        "not_deliverable" to "Collect at the pharmacy",
    )

    fun stageLabel(stage: String): String = STAGE_LABELS[stage] ?: stage.replace('_', ' ')

    /** The home-delivery choice sent with a refill request. */
    @Serializable
    data class Choice(
        val address: String,
        val landmark: String? = null,
        val pincode: String? = null,
        val contact_phone: String,
        val preferred_slot: String? = null,
        val payment: String,
    )

    /** The first thing wrong with a delivery choice, or null when it can go. */
    fun problem(address: String, phone: String, payment: String?, offered: List<String>): String? = when {
        address.trim().length < MIN_ADDRESS_LENGTH -> "Enter the full address"
        phone.count { it.isDigit() } !in PHONE_DIGITS -> "Enter a 10-digit phone number"
        payment == null || payment !in offered -> "Choose how to pay"
        else -> null
    }

    /** The choice as sent: trimmed, and blanks left out. */
    fun choice(address: String, landmark: String, pincode: String?, phone: String, slot: String?, payment: String): Choice {
        fun text(s: String?) = s?.trim()?.takeIf { it.isNotEmpty() }
        return Choice(
            address = address.trim(),
            landmark = text(landmark),
            pincode = text(pincode),
            contact_phone = phone.trim(),
            preferred_slot = text(slot),
            payment = payment,
        )
    }

    data class Step(val label: String, val at: String)

    /** The steps a delivery has reached, with when, oldest first. */
    fun steps(requestedAt: String, preparedAt: String?, dispatchedAt: String?, deliveredAt: String?): List<Step> =
        listOf("Requested" to requestedAt, "Being prepared" to preparedAt, "Out for delivery" to dispatchedAt, "Delivered" to deliveredAt)
            .mapNotNull { (label, at) -> at?.let { Step(label, it) } }
}
