package com.medbrains.staff.doctor

import com.medbrains.kit.ApiClient
import com.medbrains.staff.shared.bodysite.Laterality
import kotlinx.serialization.Serializable

// Wire shapes mirror medbrains-opd, hand-written from packages/types. The
// case sheet lives in NotesApi.kt, the token queue in shared/tokens/TokenApi.kt.

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
    suspend fun listMyAppointments(doctorId: String, date: String): List<AppointmentRow> = client.get("/api/opd/appointments?doctor_id=$doctorId&date=$date")
}
