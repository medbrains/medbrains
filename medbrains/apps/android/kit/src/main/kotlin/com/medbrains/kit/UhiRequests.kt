package com.medbrains.kit

import kotlinx.serialization.Serializable

/**
 * UHI requests: what patient apps booked or asked for through NHA's Unified
 * Health Interface. Consultations are booked straight into the day's
 * appointments; ambulance, blood and lab requests wait for someone to say
 * whether the hospital can help. Wire shape mirrors `packages/types/src/uhi.ts`;
 * the words and gates mirror `apps/web/src/pages/uhi-requests.tsx`, and iOS.
 */
object UhiRequests {
    object Permission {
        const val VIEW = "uhi.requests.view"
        const val RESPOND = "uhi.requests.respond"
        const val DISPATCH_AMBULANCE = "ambulance.trips.create"
        const val ISSUE_BLOOD = "blood_bank.inventory.manage"
        const val ORDER_LAB = "lab.orders.direct"
        const val BOOK_COLLECTION = "lab.samples.manage"
    }

    object Service {
        const val TELECONSULTATION = "teleconsultation"
        const val VISIT = "physical_consultation"
        const val LAB_TESTS = "lab_tests"
        const val AMBULANCE = "ambulance"
        const val BLOOD_BANK = "blood_bank"
    }

    const val PENDING = "pending"
    const val AWAITING_PAYMENT = "awaiting_payment"
    private const val PAID = "PAID"
    private const val PAID_ONLINE = "ON-ORDER"
    /** States in which a booking no longer stands: money taken is a refund due. */
    private val LET_GO = setOf("cancelled", "expired", "declined")

    @Serializable
    data class Request(
        val id: String,
        val service: String,
        val state: String,
        val customer_name: String? = null,
        val customer_phone: String? = null,
        val customer_abha: String? = null,
        /** What was asked for, in a line: the doctor and time, the blood, the pickup. */
        val summary: String = "",
        val appointment_id: String? = null,
        val ambulance_trip_id: String? = null,
        val decline_reason: String? = null,
        val confirmed_at: String? = null,
        val responded_at: String? = null,
        val updated_at: String,
        val payment_type: String? = null,
        val payment_status: String? = null,
        val amount: String? = null,
        /** A held booking lets go of its slot at this time unless paid. */
        val hold_expires_at: String? = null,
        val lab_order_ids: List<String> = emptyList(),
        /** A lab request for a home collection (accepting it books one). */
        val home_collection: Boolean = false,
    )

    enum class Filter(val label: String) { Waiting("Waiting for us"), All("All") }

    data class Label(val text: String, val tone: Tone)

    private val SERVICE_LABELS = mapOf(
        Service.TELECONSULTATION to "Teleconsultation",
        Service.VISIT to "Visit",
        Service.LAB_TESTS to "Lab tests",
        Service.AMBULANCE to "Ambulance",
        Service.BLOOD_BANK to "Blood",
    )

    private val STATES = mapOf(
        AWAITING_PAYMENT to Label("Held — waiting for payment", Tone.Warning),
        PENDING to Label("Waiting for us", Tone.Warning),
        "confirmed" to Label("Confirmed", Tone.Success),
        "declined" to Label("Declined", Tone.Danger),
        "cancelled" to Label("Cancelled by patient", Tone.Neutral),
        "expired" to Label("Not paid in time", Tone.Neutral),
    )

    private val ACCEPT_LABELS = mapOf(Service.AMBULANCE to "Accept and dispatch", Service.LAB_TESTS to "Accept and order the tests")

    fun serviceLabel(service: String): String = SERVICE_LABELS[service] ?: service
    fun state(state: String): Label = STATES[state] ?: Label(state, Tone.Neutral)
    fun acceptLabel(service: String): String = ACCEPT_LABELS[service] ?: "Accept"

    /** Consultations land in the OPD appointments for their day. */
    fun isInAppointments(r: Request): Boolean = (r.service == Service.TELECONSULTATION || r.service == Service.VISIT) && r.appointment_id != null

    /**
     * Whether this person may accept or decline: the queue's own permission,
     * the request still waiting, and each service's module permission as well —
     * the server checks the same. Consultations are never answered here.
     */
    fun mayAnswer(r: Request, who: TenantIdentity?): Boolean {
        if (who == null || !who.can(Permission.RESPOND) || r.state != PENDING) return false
        return when (r.service) {
            Service.AMBULANCE -> who.can(Permission.DISPATCH_AMBULANCE)
            Service.BLOOD_BANK -> who.can(Permission.ISSUE_BLOOD)
            Service.LAB_TESTS -> who.can(Permission.ORDER_LAB) && (!r.home_collection || who.can(Permission.BOOK_COLLECTION))
            else -> false
        }
    }

    /** How a booking is paid, in words: money taken for a booking that no longer stands is a refund due. Null when not paid through UHI. */
    fun payment(r: Request): Label? {
        val type = r.payment_type ?: return null
        val isPaid = r.payment_status == PAID
        return when {
            isPaid && r.state in LET_GO -> Label("Paid — refund due", Tone.Danger)
            isPaid -> Label("Paid online", Tone.Success)
            type == PAID_ONLINE -> Label("Not paid yet", Tone.Warning)
            else -> Label("Pay at the hospital", Tone.Neutral)
        }
    }

    fun amountLine(r: Request): String = r.amount?.let { "₹$it" } ?: "Fee set at the hospital"

    /** The trimmed reason, or null when there is none worth sending. */
    fun declineReason(text: String): String? = text.trim().ifEmpty { null }
}

/** The UHI queue calls, one per route the screen uses. */
class UhiRequestsApi(private val client: ApiClient) {
    @Serializable private data class DeclineBody(val reason: String)

    /** Bounded by the server (its newest page). */
    suspend fun list(filter: UhiRequests.Filter): List<UhiRequests.Request> =
        client.get(if (filter == UhiRequests.Filter.Waiting) "/api/uhi/requests?state=${UhiRequests.PENDING}" else "/api/uhi/requests")
    suspend fun accept(id: String): UhiRequests.Request = client.post("/api/uhi/requests/$id/accept")
    suspend fun decline(id: String, reason: String): UhiRequests.Request =
        client.json.decodeFromString(UhiRequests.Request.serializer(), client.call("POST", "/api/uhi/requests/$id/decline", client.json.encodeToString(DeclineBody.serializer(), DeclineBody(reason))))
}
