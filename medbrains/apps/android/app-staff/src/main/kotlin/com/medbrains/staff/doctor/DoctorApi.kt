package com.medbrains.staff.doctor

import com.medbrains.kit.ApiClient
import com.medbrains.kit.ApiError
import kotlinx.serialization.Serializable

// Wire shapes mirror crates/medbrains-tokens, medbrains-opd and
// medbrains-core/consultation.rs, hand-written from packages/types.

@Serializable
data class WorklistToken(
    val id: String,
    val number: String,
    val seq: Int = 0,
    val status: String,
    val priority: String = "normal",
    val scope_label: String? = null,
    val counter_label: String? = null,
    val called_at: String? = null,
    val created_at: String,
    val patient_id: String? = null,
    val patient_name: String? = null,
    val uhid: String? = null,
    val encounter_id: String? = null,
) {
    val displayName: String get() = patient_name ?: "Unnamed patient"
}

@Serializable data class ModuleToken(val id: String, val status: String, val called_at: String? = null, val counter_label: String? = null)

@Serializable
data class Consultation(
    val id: String,
    val encounter_id: String,
    val chief_complaint: String? = null,
    val examination: String? = null,
    /** Assessment. The column is `notes`; the label a clinician reads is not. */
    val notes: String? = null,
    val plan: String? = null,
)

@Serializable data class ConsultationNotes(val chief_complaint: String, val examination: String, val notes: String, val plan: String)

@Serializable
data class AppointmentRow(
    val id: String,
    val patient_id: String,
    val patient_name: String? = null,
    val appointment_date: String,
    val start_time: String? = null,
    val status: String,
    val reason: String? = null,
)

@Serializable private data class CallBody(val counter_label: String? = null)
@Serializable private data class CallNextBody(val counter_label: String? = null, val module: String, val scope: String? = null, val scope_id: String? = null)

class DoctorApi(private val client: ApiClient) {
    suspend fun listWorklist(): List<WorklistToken> = client.get("/api/tokens/worklist?module=opd")

    /** Call whoever is next and let the server decide. `null` is a real answer: nobody is waiting. */
    suspend fun callNext(): ModuleToken? {
        val text = client.call("POST", "/api/tokens/call-next", client.json.encodeToString(CallNextBody.serializer(), CallNextBody(module = "opd")))
        return if (text.isBlank() || text == "null") null else client.json.decodeFromString(ModuleToken.serializer(), text)
    }
    suspend fun call(id: String): ModuleToken = client.post("/api/tokens/$id/call", CallBody())
    suspend fun serve(id: String): ModuleToken = client.post("/api/tokens/$id/serve")
    suspend fun complete(id: String): ModuleToken = client.post("/api/tokens/$id/complete")
    suspend fun noShow(id: String): ModuleToken = client.post("/api/tokens/$id/no-show")

    /**
     * The consultation, or null when none is written — the server answers a
     * bare `null` for that, so the decode is nullable. Narrowly 404 as well:
     * a refused read is never a blank note.
     */
    suspend fun getConsultation(encounterId: String): Consultation? = try {
        client.get<Consultation?>("/api/opd/encounters/$encounterId/consultation")
    } catch (e: ApiError) {
        if (e.status == 404) null else throw e
    }
    suspend fun createConsultation(encounterId: String, notes: ConsultationNotes): Consultation = client.post("/api/opd/encounters/$encounterId/consultation", notes)
    suspend fun updateConsultation(encounterId: String, id: String, notes: ConsultationNotes): Consultation = client.put("/api/opd/encounters/$encounterId/consultation/$id", notes)

    suspend fun listMyAppointments(doctorId: String, date: String): List<AppointmentRow> = client.get("/api/opd/appointments?doctor_id=$doctorId&date=$date")
}
