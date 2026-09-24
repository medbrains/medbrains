package com.medbrains.patient

import androidx.compose.runtime.compositionLocalOf
import com.medbrains.kit.ApiClient
import kotlinx.serialization.Serializable

// The patient portal — the only endpoints this app calls. Every read is
// subject-locked at the backend: the patient comes from the token.

@Serializable data class PortalSession(val token: String, val patient_id: String, val tenant_id: String, val expires_in_hours: Int = 0)
@Serializable data class PortalAppointment(val id: String, val appointment_date: String, val status: String, val department_name: String? = null)
@Serializable data class PortalLabReport(val order_id: String, val test_name: String, val parameter_name: String, val value: String, val unit: String? = null, val normal_range: String? = null, val flag: String? = null, val reported_at: String)
@Serializable data class PortalPrescriptionItem(val prescription_id: String, val drug_name: String, val dosage: String, val frequency: String, val duration: String, val prescribed_at: String)
@Serializable data class PortalInvoice(val id: String, val invoice_number: String, val status: String, val total_amount: String, val paid_amount: String = "0", val balance_due: String, val created_at: String)
@Serializable data class PortalEntitlements(val companion: Boolean = false)
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
}

val LocalPortalApi = compositionLocalOf<PortalApi> { error("PortalApi not provided") }
val LocalHospitalCode = compositionLocalOf { "DEFAULT" }
