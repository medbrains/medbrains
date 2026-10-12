package com.medbrains.staff.deliveries

import com.medbrains.kit.ApiClient
import kotlinx.serialization.Serializable

// Wire shapes mirror crates/medbrains-pharmacy-delivery. Money arrives as
// decimal strings ("40.00"); kept as strings and shown as written.

@Serializable
data class Delivery(
    val id: String,
    val order_id: String,
    val patient_id: String,
    val mode: String,
    val address: String,
    val landmark: String? = null,
    val pincode: String? = null,
    val contact_phone: String,
    val payment: String,
    val amount_due: String,
    val status: String,
    val failure_reason: String? = null,
) {
    val isCashOnDelivery: Boolean get() = payment == "cash_on_delivery"
    /** "12 Lake Road · Near the temple · 630001" */
    val addressLine: String get() = listOfNotNull(address, landmark, pincode).joinToString(" · ")
}

/** The patient as the list may name them, masked per the runner's field access. */
@Serializable
data class DeliveryPatient(val id: String, val uhid: String, val full_name: String)

@Serializable
data class DeliveryList(val deliveries: List<Delivery>, val patients: List<DeliveryPatient>)

/** The statuses a runner works with. */
object DeliveryStatus {
    const val OUT = "out_for_delivery"
    const val DELIVERED = "delivered"
}

@Serializable private data class Handover(val code: String, val cash_collected: Double? = null)
@Serializable private data class NotDelivered(val reason: String)

class DeliveriesApi(private val client: ApiClient) {
    /** A runner is sent only their own deliveries; the server decides that. */
    suspend fun list(status: String): DeliveryList = client.get("/api/pharmacy/deliveries?status=$status")

    /** Handed over against the patient's code, with the cash taken for cash on delivery. */
    suspend fun complete(id: String, code: String, cash: Double?): Delivery =
        client.post("/api/pharmacy/deliveries/$id/complete", Handover(code, cash))

    suspend fun fail(id: String, reason: String): Delivery =
        client.post("/api/pharmacy/deliveries/$id/fail", NotDelivered(reason))
}
