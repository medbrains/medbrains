package com.medbrains.staff.doctor

import com.medbrains.kit.ApiClient
import com.medbrains.kit.ApiError
import com.medbrains.staff.shared.bodysite.Laterality
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
    /** Only the site findings are read here; the web's system notes ride along untouched. */
    val physical_examination: SiteFindings? = null,
)

/**
 * `physical_examination` is sent only when the findings changed; the server
 * merges it into the examination by key, so the system notes are kept.
 */
@Serializable
data class ConsultationNotes(val chief_complaint: String, val examination: String, val notes: String, val plan: String, val physical_examination: SiteFindings? = null)

@Serializable data class SiteFindings(val findings: List<ExamFinding>? = null)

/** medbrains-core `ExamFinding`: what was found at a place on the body. */
@Serializable
data class ExamFinding(
    val site: String,
    /** FMA code when picked on the web's 3D model; a region has none. */
    val site_code: String? = null,
    val laterality: Laterality? = null,
    val finding: String,
) {
    /** "Left knee: Effusion" — the side is added when the label does not name it. */
    val line: String get() {
        val side = laterality?.name?.lowercase()
        return if (side == null || site.contains(side, ignoreCase = true)) "$site: $finding" else "$site ($side): $finding"
    }
}

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
