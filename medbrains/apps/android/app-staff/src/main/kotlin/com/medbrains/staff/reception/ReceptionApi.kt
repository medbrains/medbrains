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
) {
    val fullName: String get() = "$first_name $last_name"
    /** "UHID · DOB · phone": the line the desk reads back. */
    val identifiers: String get() = listOf(uhid, date_of_birth ?: "DOB unknown", phone).joinToString(" · ")
}

/** A possible duplicate from `POST /api/patients/match`, scored by the server. */
@Serializable
data class MatchCandidate(val id: String, val uhid: String, val first_name: String, val last_name: String, val date_of_birth: String? = null, val phone: String, val score: Double) {
    fun asSummary() = PatientSummary(id, uhid, first_name, last_name, date_of_birth, phone, "unknown")
}

@Serializable data class MatchQuery(val first_name: String, val last_name: String, val date_of_birth: String?, val phone: String)

/** What the phone records about how this registration was checked, so a second UHID is never silent. */
@Serializable data class MobileRegistration(val source: String, val duplicate_check: String, val matched_uhid: String?)
@Serializable data class RegistrationAttributes(val mobile_registration: MobileRegistration)

@Serializable
data class CreatePatientBody(
    val first_name: String,
    val last_name: String,
    val gender: String,
    val phone: String,
    val date_of_birth: String,
    val is_dob_estimated: Boolean,
    val registration_type: String,
    val registration_source: String,
    val referred_by_name: String?,
    val department_id: String?,
    val consultant_id: String?,
    val abha_number: String?,
    val is_medico_legal: Boolean,
    val mlc_number: String?,
    val is_vip: Boolean,
    val attributes: RegistrationAttributes,
)

@Serializable data class DepartmentRow(val id: String, val code: String, val name: String)
@Serializable data class DoctorRow(val id: String, val full_name: String, val specialization: String? = null)
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
    suspend fun createPatient(body: CreatePatientBody): PatientSummary = client.post("/api/patients", body)
    /// The desk's lookup, not the caller's own list. `/api/patients` is scoped
    /// to patients this user has a relationship with, so a receptionist could
    /// not find one a colleague registered; `/find` reaches the whole hospital
    /// and answers with identity only.
    suspend fun searchPatients(text: String): List<PatientSummary> =
        client.get<List<PatientSummary>>("/api/patients/find?q=${URLEncoder.encode(text, "UTF-8")}")
    suspend fun departments(): List<DepartmentRow> = client.get("/api/setup/departments")
    suspend fun doctors(): List<DoctorRow> = client.get("/api/setup/doctors")
    suspend fun startVisit(body: StartVisitBody): VisitStarted = client.post("/api/opd/encounters", body)
}
