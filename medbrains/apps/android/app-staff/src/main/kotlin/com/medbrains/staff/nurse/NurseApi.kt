package com.medbrains.staff.nurse

import com.medbrains.kit.ApiClient
import kotlinx.serialization.Serializable

// Wire shapes mirror crates/medbrains-ipd, medbrains-nursing, medbrains-care-mgmt
// and medbrains-blood-bank, hand-written from packages/types per the RFC.
// Field names are the wire's snake_case; timestamps stay strings.

@Serializable
data class AdmissionRow(
    val id: String,
    val encounter_id: String,
    val patient_id: String,
    val patient_name: String,
    val uhid: String,
    val bed_label: String? = null,
    val ward_name: String? = null,
    val ward_id: String? = null,
    val status: String,
    val admitted_at: String,
) {
    val bedLine: String get() = "UHID $uhid" + (bed_label?.let { " · BED $it" } ?: "")
}

@Serializable private data class AdmissionList(val admissions: List<AdmissionRow>)

@Serializable
data class MarRow(
    val id: String,
    val admission_id: String,
    val drug_name: String,
    val dose: String,
    val route: String,
    val frequency: String? = null,
    val scheduled_at: String,
    val administered_at: String? = null,
    val status: String,
    val is_high_alert: Boolean = false,
    val barcode_verified: Boolean = false,
    val hold_reason: String? = null,
)

@Serializable
data class UpdateMarPayload(
    val status: String,
    val administered_at: String? = null,
    val witnessed_by: String? = null,
    val hold_reason: String? = null,
    val refused_reason: String? = null,
)

@Serializable data class BarcodeVerifyResult(val verified: Boolean, val right_patient: Boolean, val right_drug: Boolean, val reason: String? = null)

@Serializable
data class WardOnDutyRow(val nurse_user_id: String, val nurse_name: String, val shift_type: String = "", val primary_assigned: Boolean = false, val is_charge: Boolean = false, val patient_count: Int = 0)

@Serializable
data class ActiveNurseCall(
    val id: String,
    val admission_id: String,
    val ward_id: String? = null,
    val ward_name: String? = null,
    val bed_number: String? = null,
    val request_type: String,
    val status: String,
    val notes: String? = null,
    val created_at: String,
    val acknowledged_at: String? = null,
    val waiting_seconds: Long,
    val escalation: String,
)

@Serializable data class NurseCallBoard(val calls: List<ActiveNurseCall>, val escalate_secs: Long = 0, val supervisor_secs: Long = 0)

@Serializable data class CodeBlueEvent(val id: String, val patient_id: String, val location: String, val started_at: String, val ended_at: String? = null)
@Serializable data class CodeBlueResponder(val code_blue_id: String, val user_id: String, val user_name: String, val seconds_after_call: Long)
@Serializable data class EmergencyCodeActivation(val id: String, val code_type: String, val activated_at: String, val deactivated_at: String? = null, val location: String? = null)

@Serializable data class HandoffAlert(val kind: String, val note: String)

@Serializable
data class ShiftHandoff(
    val id: String,
    val encounter_id: String,
    val outgoing_nurse_id: String,
    val incoming_nurse_id: String,
    val incoming_signed_at: String? = null,
    val situation: String? = null,
    val background: String? = null,
    val assessment: String? = null,
    val recommendation: String? = null,
    val alerts: List<HandoffAlert>? = null,
    val completed_at: String? = null,
    val created_at: String,
)

@Serializable
data class CreateHandoffPayload(
    val encounter_id: String,
    val incoming_nurse_id: String,
    val situation: String? = null,
    val background: String? = null,
    val assessment: String? = null,
    val recommendation: String? = null,
)

@Serializable
data class BedsideTransfusion(
    val id: String,
    val product_type: String? = null,
    val bag_number: String? = null,
    val blood_group: String? = null,
    val rh_factor: String? = null,
    val transfusion_start_time: String? = null,
    val transfusion_end_time: String? = null,
    val adverse_reaction: Boolean = false,
)

@Serializable
data class TransfusionObservation(
    val id: String,
    val phase: String,
    val temperature_c: Double? = null,
    val pulse: Int? = null,
    val adverse_signs: Boolean = false,
    /** Server-computed, never sent. */
    val reaction_suspected: Boolean = false,
    val observed_at: String,
)

@Serializable
data class RecordObservationPayload(
    val phase: String,
    val temperature_c: Double? = null,
    val pulse: Int? = null,
    val systolic_bp: Int? = null,
    val diastolic_bp: Int? = null,
    val adverse_signs: Boolean,
    val notes: String? = null,
)

@Serializable
data class CreateVitalsPayload(
    val encounter_id: String,
    val temperature: String? = null,
    val pulse: Int? = null,
    val systolic_bp: Int? = null,
    val diastolic_bp: Int? = null,
    val respiratory_rate: Int? = null,
    val spo2: Int? = null,
    val notes: String? = null,
)

@Serializable data class CreateIoEntryPayload(val encounter_id: String, val category: String, val direction: String, val volume_ml: Int, val notes: String? = null)
@Serializable data class IoBalance(val intake_total: Double = 0.0, val output_total: Double = 0.0, val balance: Double = 0.0)
@Serializable data class CreatePainEntryPayload(val encounter_id: String, val scale: String, val score: Int, val location: String? = null, val character: String? = null, val intervention_taken: String? = null)
@Serializable data class CreateFallRiskPayload(val encounter_id: String, val scale: String, val score: Int, val risk_level: String, val interventions: List<String>)

@Serializable private data class Responded(val responded: Boolean = false)
@Serializable private data class StatusBody(val status: String)
@Serializable private data class VerifyBody(val patient_barcode: String, val drug_barcode: String)
@Serializable private data class CompleteBody(val total_volume_infused_ml: Int? = null)
@Serializable data class Ignored(val ok: Boolean = true)

/** The nurse module's calls, one per route it uses. */
class NurseApi(private val client: ApiClient) {
    suspend fun listActiveAdmissions(): List<AdmissionRow> =
        client.get<AdmissionList>("/api/ipd/admissions?status=admitted&per_page=100").admissions.map { it.copy(bed_label = it.bed_label ?: it.ward_name) }

    suspend fun listNurseCalls(): NurseCallBoard = client.get("/api/bedside/nurse-calls/active")
    suspend fun updateNurseCall(id: String, status: String): Ignored = client.put("/api/bedside/nurse-requests/$id/status", StatusBody(status))

    suspend fun listActiveCodeBlues(): List<CodeBlueEvent> = client.get("/api/nurse/code-blue?active_only=true")
    suspend fun listCodeBlueResponders(): List<CodeBlueResponder> = client.get("/api/nurse/code-blue/responders")
    suspend fun respondToCodeBlue(id: String) { client.post<Responded>("/api/nurse/code-blue/$id/respond") }
    suspend fun listOpenEmergencyCodes(): List<EmergencyCodeActivation> = client.get<List<EmergencyCodeActivation>>("/api/emergency/codes").filter { it.deactivated_at == null }

    suspend fun listMar(admissionId: String): List<MarRow> = client.get("/api/ipd/admissions/$admissionId/mar")
    suspend fun updateMar(admissionId: String, marId: String, payload: UpdateMarPayload): MarRow = client.put("/api/ipd/admissions/$admissionId/mar/$marId", payload)
    suspend fun verifyMarBarcode(marId: String, patient: String, drug: String): BarcodeVerifyResult = client.post("/api/nurse/mar/$marId/verify-barcode", VerifyBody(patient, drug))
    suspend fun wardOnDuty(wardId: String): List<WardOnDutyRow> = client.get("/api/ipd/wards/$wardId/on-duty")

    suspend fun listHandoffs(encounterId: String): List<ShiftHandoff> = client.get("/api/nurse/handoffs/encounter/$encounterId")
    suspend fun createHandoff(payload: CreateHandoffPayload): ShiftHandoff = client.post("/api/nurse/handoffs", payload)
    suspend fun acceptHandoff(id: String): ShiftHandoff = client.put("/api/nurse/handoffs/$id/accept")

    suspend fun listTransfusions(admissionId: String): List<BedsideTransfusion> = client.get("/api/ipd/admissions/$admissionId/transfusions")
    suspend fun listObservations(transfusionId: String): List<TransfusionObservation> = client.get("/api/blood-bank/transfusions/$transfusionId/observations")
    suspend fun recordObservation(transfusionId: String, payload: RecordObservationPayload): TransfusionObservation = client.post("/api/blood-bank/transfusions/$transfusionId/observations", payload)
    suspend fun completeTransfusion(id: String): BedsideTransfusion = client.put("/api/ipd/transfusions/$id/complete", CompleteBody())

    suspend fun createVitals(p: CreateVitalsPayload): Ignored = client.post("/api/nurse/vitals", p)
    suspend fun createIoEntry(p: CreateIoEntryPayload): Ignored = client.post("/api/nurse/io-entries", p)
    suspend fun ioBalance(encounterId: String): IoBalance = client.get("/api/nurse/io-entries/encounter/$encounterId/balance?since_hours=8")
    suspend fun createPain(p: CreatePainEntryPayload): Ignored = client.post("/api/nurse/pain-entries", p)
    suspend fun createFallRisk(p: CreateFallRiskPayload): Ignored = client.post("/api/nurse/fall-risk", p)
}
