package com.medbrains.staff.reception

import com.medbrains.kit.ApiClient
import kotlinx.serialization.Serializable
import java.net.URLEncoder

/** A patient as the desk needs them: the two identifiers, the phone, the safety flags. */
@Serializable
data class PatientSummary(
    val id: String,
    val uhid: String,
    val first_name: String,
    val last_name: String,
    val date_of_birth: String? = null,
    val phone: String,
    val gender: String,
    val is_medico_legal: Boolean? = null,
    val mlc_number: String? = null,
    val is_vip: Boolean? = null,
    val is_dob_estimated: Boolean? = null,
    val last_visit_date: String? = null,
    val total_visits: Int? = null,
    val outstanding_balance: String? = null,
    val middle_name: String? = null,
) {
    val fullName: String get() = "$first_name $last_name"
    /** "UHID · DOB · phone": the line the desk reads back. */
    val identifiers: String get() = listOf(uhid, date_of_birth ?: "DOB unknown", phone).joinToString(" · ")
}

/** A possible duplicate from `POST /api/patients/match`, scored by the server. */
@Serializable
data class MatchCandidate(val id: String, val uhid: String, val first_name: String, val last_name: String, val date_of_birth: String? = null, val phone: String, val score: Double) {
    fun asSummary() = PatientSummary(id, uhid, first_name, last_name, date_of_birth, phone, "unknown")
    fun asMatch() = com.medbrains.kit.PatientMatch(id, uhid, first_name, last_name, date_of_birth, phone, score)
}

/** `phone` is absent when none is known (a share may carry none). */
@Serializable data class MatchQuery(val first_name: String, val last_name: String, val date_of_birth: String?, val phone: String?)



@Serializable data class DepartmentRow(val id: String, val code: String, val name: String)
/** A campaign the desk can say a patient came through. */
@Serializable
data class CampaignOption(val id: String, val name: String, val channel: String? = null)

/** A camp a registration can name. */
@Serializable
data class CampSummary(val id: String, val name: String, val organizing_department_id: String? = null, val venue_name: String? = null, val status: String = "planned") {
    /** Open for registration: not finished, not called off. */
    val isOpen: Boolean get() = status !in setOf("completed", "cancelled")
}

/** A camp registration for a patient the wizard just registered: the link that puts them on the camp's route with a camp number. */
@Serializable
data class CampRegistrationLink(
    val camp_id: String,
    val person_name: String,
    val gender: String?,
    val phone: String?,
    val patient_id: String,
    val clinical_department_id: String?,
    val attending_doctor_id: String?,
    val chief_complaint: String?,
    val is_walk_in: Boolean,
)

@Serializable data class DoctorRow(val id: String, val full_name: String, val specialization: String? = null)
/** A returning patient's last OPD visit. An id is null when that doctor or department no longer takes patients: named, not offered. */
@Serializable
data class LastVisit(
    val encounter_date: String,
    val doctor_id: String? = null,
    val doctor_name: String? = null,
    val department_id: String? = null,
    val department_name: String? = null,
) {
    val summary: String get() = listOfNotNull(encounter_date, doctor_name, department_name).joinToString(" · ")
}

@Serializable data class StartVisitBody(val patient_id: String, val department_id: String, val doctor_id: String?, val chief_complaint: String?, val visit_type: String)

/** The visit and the token the server issued for it, in one answer. */
@Serializable
data class VisitStarted(val encounter: Encounter, val queue: Queue) {
    @Serializable data class Encounter(val id: String)
    @Serializable data class Queue(val id: String, val token_number: Int, val status: String)
}

@Serializable private data class PatientPage(val patients: List<PatientSummary>)

class ReceptionApi(private val client: ApiClient) {
    suspend fun matchPatients(q: MatchQuery): List<MatchCandidate> = client.post("/api/patients/match", q)
    /** The request is the shared core's (`registrationRequestJson`), sent as built. */
    suspend fun createPatient(body: String): PatientSummary =
        client.json.decodeFromString(PatientSummary.serializer(), client.call("POST", "/api/patients", body))
    /// The desk's lookup, not the caller's own list. `/api/patients` is scoped
    /// to patients this user has a relationship with, so a receptionist could
    /// not find one a colleague registered; `/find` reaches the whole hospital
    /// and answers with identity only.
    suspend fun searchPatients(text: String): List<PatientSummary> =
        client.get<List<PatientSummary>>("/api/patients/find?q=${URLEncoder.encode(text, "UTF-8")}")
    /** One record, for the desk's compare and open (`patients.view`). */
    suspend fun patient(id: String): PatientSummary = client.get("/api/patients/$id")
    suspend fun departments(): List<DepartmentRow> = client.get("/api/setup/departments")
    suspend fun doctors(): List<DoctorRow> = client.get("/api/setup/doctors")
    suspend fun camps(): List<CampSummary> = client.get("/api/camp/camps")
    suspend fun campaigns(): List<CampaignOption> = client.get("/api/marketing/campaigns/lookup")
    suspend fun linkToCamp(body: CampRegistrationLink): com.medbrains.staff.camp.CampRegistered = client.post(com.medbrains.staff.camp.CampEndpoint.REGISTRATIONS, body)
    suspend fun lastVisit(patientId: String): LastVisit? = client.get("/api/opd/patients/$patientId/last-visit")
    suspend fun startVisit(body: StartVisitBody): VisitStarted = client.post("/api/opd/encounters", body)
}
