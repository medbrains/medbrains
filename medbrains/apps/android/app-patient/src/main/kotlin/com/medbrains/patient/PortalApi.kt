package com.medbrains.patient

import androidx.compose.runtime.compositionLocalOf
import com.medbrains.kit.ApiClient
import com.medbrains.kit.HomeDelivery
import kotlinx.serialization.Serializable

// The patient portal — the only endpoints this app calls. Every read is
// subject-locked at the backend: the patient comes from the token.

@Serializable data class PortalSession(val token: String, val patient_id: String, val tenant_id: String, val expires_in_hours: Int = 0)
@Serializable data class PortalAppointment(val id: String, val appointment_date: String, val status: String, val department_name: String? = null)
@Serializable data class PortalLabReport(val order_id: String, val test_name: String, val parameter_name: String, val value: String, val unit: String? = null, val normal_range: String? = null, val flag: String? = null, val reported_at: String)
@Serializable data class PortalPrescriptionItem(val prescription_id: String, val drug_name: String, val dosage: String, val frequency: String, val duration: String, val prescribed_at: String)
@Serializable data class PortalInvoice(val id: String, val invoice_number: String, val status: String, val total_amount: String, val paid_amount: String = "0", val balance_due: String, val created_at: String)
@Serializable data class PortalEntitlements(val companion: Boolean = false)
/** A refill the patient asked for; the doctor's note shows when declined. */
@Serializable data class PortalRefillRequest(val id: String, val prescription_id: String, val status: String, val decision_note: String? = null, val created_at: String)
/** A recent prescription and what asking for a refill of it would do; `goes_to` is null when it can't be asked for now. */
@Serializable data class PortalRefill(
    val prescription_id: String,
    val prescribed_at: String,
    val doctor_name: String? = null,
    val drugs: List<String>,
    val refills_left: Int,
    val valid_until: String? = null,
    val goes_to: String? = null,
    val message: String,
    val latest_request: PortalRefillRequest? = null,
)
/** Home delivery rides on the refill request; null for pickup at the pharmacy. */
@Serializable private data class RefillAsk(val note: String? = null, val delivery: HomeDelivery.Choice? = null)
@Serializable data class PortalSavedAddress(val label: String, val address: String, val pincode: String? = null)
/** What the patient may choose for a refill of one prescription; the server decides. */
@Serializable data class PortalDeliveryOffer(
    val available: Boolean,
    val reason: String? = null,
    val payments: List<String> = emptyList(),
    val addresses: List<PortalSavedAddress> = emptyList(),
    val contact_phone: String = "",
    val delivery_fee: String = "0",
    val slots: List<String> = emptyList(),
)
/** A delivery the patient asked for. Never carries the runner's phone. */
@Serializable data class PortalDelivery(
    val id: String,
    val prescription_id: String,
    val drugs: List<String> = emptyList(),
    val stage: String,
    val address: String? = null,
    val preferred_slot: String? = null,
    val payment: String? = null,
    val requested_at: String,
    val prepared_at: String? = null,
    val dispatched_at: String? = null,
    val delivered_at: String? = null,
    val note: String? = null,
    val carrier: String? = null,
    val tracking_ref: String? = null,
    val amount_due: String? = null,
    val pay_amount: String? = null,
    val payment_url: String? = null,
    /** The code to give the runner, only while it is on its way. */
    val handover_code: String? = null,
)
/** One decision on the patient's DPDP consent ledger; the newest is current. */
@Serializable data class DpdpConsentRecord(val purposes: List<String>, val notice_language: String? = null, val source: String, val created_at: String)
@Serializable data class PatientDpdpConsent(val notice_version: String, val purposes: List<String>, val history: List<DpdpConsentRecord>)
/** A request the patient made under the DPDP Act, and its answer. */
@Serializable data class PrivacyRequestRow(val id: String, val request_type: String, val details: String, val due_at: String, val status: String, val decision: String? = null)
@Serializable data class HeldData(val category: String, val count: Int)
@Serializable data class PatientDataSummary(val held: List<HeldData>, val staff_who_viewed: Int, val insurers: List<String> = emptyList())
/** The patient's privacy page: consent, their requests, what is held. */
@Serializable data class PortalPrivacy(val consent: PatientDpdpConsent, val requests: List<PrivacyRequestRow>, val held: PatientDataSummary)
@Serializable data class DpdpConsentChoice(val notice_version: String, val notice_language: String, val purposes: List<String>)
@Serializable data class PrivacyRequestAsk(val request_type: String, val details: String, val nominee_name: String? = null)
@Serializable private data class OtpRequest(val tenant_code: String, val phone: String)
@Serializable private data class OtpVerify(val tenant_code: String, val phone: String, val code: String)
@Serializable data class Ack(val ok: Boolean = true)

class PortalApi(private val client: ApiClient) {
    /** The reply is the same whether or not the number is registered — do not branch on it. */
    suspend fun requestCode(tenantCode: String, phone: String) { client.call("POST", "/api/portal/auth/request-otp", client.json.encodeToString(OtpRequest.serializer(), OtpRequest(tenantCode, phone))) }
    suspend fun verifyCode(tenantCode: String, phone: String, code: String): PortalSession = client.post("/api/portal/auth/verify", OtpVerify(tenantCode, phone, code))
    suspend fun appointments(): List<PortalAppointment> = client.get("/api/portal/appointments")
    suspend fun labReports(): List<PortalLabReport> = client.get("/api/portal/lab-reports")
    suspend fun prescriptions(): List<PortalPrescriptionItem> = client.get("/api/portal/prescriptions")
    suspend fun bills(): List<PortalInvoice> = client.get("/api/portal/bills")
    suspend fun entitlements(): PortalEntitlements = client.get("/api/portal/entitlements")
    suspend fun refills(): List<PortalRefill> = client.get("/api/portal/refills")
    /** The server decides where it goes and refuses, with the reason, when it can't be asked for. */
    suspend fun requestRefill(prescriptionId: String, delivery: HomeDelivery.Choice? = null): PortalRefillRequest =
        client.post("/api/portal/prescriptions/$prescriptionId/refill-request", RefillAsk(delivery = delivery))
    /** Home delivery or not for this prescription, the ways to pay, saved addresses. */
    suspend fun deliveryOptions(prescriptionId: String): PortalDeliveryOffer = client.get("/api/portal/prescriptions/$prescriptionId/delivery-options")
    /** The patient's own deliveries, newest first. */
    suspend fun deliveries(): List<PortalDelivery> = client.get("/api/portal/deliveries")
    suspend fun privacy(): PortalPrivacy = client.get("/api/portal/privacy")
    /** The patient's own record as a FHIR R4 bundle, exactly as the server sent it. */
    suspend fun exportRecord(): String = client.call("GET", "/api/portal/privacy/export")
    /** The patient's own change of mind — a new decision on the ledger. */
    suspend fun setConsent(choice: DpdpConsentChoice): PatientDpdpConsent = client.put("/api/portal/dpdp-consent", choice)
    /** Answered within 90 days; the server applies the same rules as the desk. */
    suspend fun makePrivacyRequest(ask: PrivacyRequestAsk): PrivacyRequestRow = client.post("/api/portal/privacy-requests", ask)
}

val LocalPortalApi = compositionLocalOf<PortalApi> { error("PortalApi not provided") }
val LocalHospitalCode = compositionLocalOf { "DEFAULT" }
