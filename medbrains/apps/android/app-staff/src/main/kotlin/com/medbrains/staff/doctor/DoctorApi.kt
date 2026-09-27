package com.medbrains.staff.doctor

import com.medbrains.kit.ApiClient
import com.medbrains.kit.ApiError
import kotlinx.serialization.Serializable

// Wire shapes mirror medbrains-opd and medbrains-core/consultation.rs,
// hand-written from packages/types. The token queue lives in
// shared/tokens/TokenApi.kt.

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

class DoctorApi(private val client: ApiClient) {
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
