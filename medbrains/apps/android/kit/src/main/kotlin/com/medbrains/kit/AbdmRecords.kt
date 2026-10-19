package com.medbrains.kit

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.temporal.ChronoUnit

/**
 * Records from other hospitals (ABDM Milestone 3, this hospital as a Health
 * Information User): consent requests raised for a patient and the copies
 * other facilities sent under them. Wire shapes mirror
 * `packages/types/src/abdm-hiu.ts`; words and rules mirror the web's
 * `components/Patient/abdm/abdmStatus.ts` and `ConsentRequestModal.tsx`, and iOS.
 */
object AbdmRecords {
    object Permission {
        /** See the requests and the records received. */
        const val VIEW = "abdm.consent.view"
        /** Raise a request, and ask ABDM where one stands. */
        const val REQUEST = "abdm.consent.request"
    }

    @Serializable
    data class ConsentRequest(
        val id: String,
        val purpose_code: String,
        val hi_types: List<String> = emptyList(),
        val date_from: String,
        val date_to: String,
        val data_erase_at: String,
        val status: String,
        val error: String? = null,
        val requester_name: String,
        val requested_at: String,
        val status_at: String,
        /** When ABDM was last asked where the request stands; null if never. */
        val status_checked_at: String? = null,
        val records_received: Int = 0,
        /** Copies still held — zero once the consent is revoked or expires. */
        val records_held: Int = 0,
    )

    @Serializable
    data class ReceivedRecordItem(
        val id: String,
        val consent_request_id: String,
        val hi_type: String? = null,
        val care_context_reference: String,
        val source_hip_id: String,
        val source_hip_name: String? = null,
        val record_date: String? = null,
        val title: String? = null,
        val received_at: String,
        val erase_at: String,
    )

    @Serializable
    data class PatientView(
        val configured: Boolean,
        /** Why records cannot be requested, in words for staff. */
        val blocked_reason: String? = null,
        val requests: List<ConsentRequest> = emptyList(),
        val records: List<ReceivedRecordItem> = emptyList(),
    )

    @Serializable
    data class ReceivedRecord(
        val id: String,
        val patient_id: String,
        val hi_type: String? = null,
        val source_hip_id: String,
        val source_hip_name: String? = null,
        val received_at: String,
        val erase_at: String,
        /** The FHIR document bundle as the other facility sent it. */
        val bundle: JsonElement? = null,
    )

    /** What `POST …/consent-requests` takes. */
    @Serializable
    data class NewRequest(
        val purpose_code: String,
        val hi_types: List<String>,
        val date_from: String,
        val date_to: String,
        /** When the received copies must be erased (ABDM's `dataEraseAt`). */
        val data_erase_at: String,
    )

    data class Status(val label: String, val tone: Tone, val hint: String)
    data class Choice<T>(val value: T, val label: String)
    data class FacilityGroup(val id: String, val name: String, val records: List<ReceivedRecordItem>)

    const val AWAITING_PATIENT = "awaiting_patient"
    /** ABDM refused the request outright. */
    const val FAILED = "failed"
    const val DEFAULT_PURPOSE = "CAREMGT"
    const val DEFAULT_KEEP_DAYS = 30
    /** How far back the form starts by default. */
    const val DEFAULT_YEARS_BACK = 5L

    /** ABDM's consent purposes, in the order the form offers them. */
    val PURPOSES = listOf(
        Choice("CAREMGT", "Care management"),
        Choice("BTG", "Break the glass (emergency)"),
        Choice("PUBHLTH", "Public health"),
        Choice("HPAYMT", "Healthcare payment"),
        Choice("DSRCH", "Disease-specific research"),
        Choice("PATRQT", "Requested by the patient"),
    )

    /** ABDM's HI types in words staff use. */
    val HI_TYPES = listOf(
        Choice("OPConsultation", "OP consultation"),
        Choice("Prescription", "Prescription"),
        Choice("DiagnosticReport", "Diagnostic report"),
        Choice("DischargeSummary", "Discharge summary"),
        Choice("ImmunizationRecord", "Immunisation"),
        Choice("HealthDocumentRecord", "Health document"),
        Choice("WellnessRecord", "Wellness record"),
        Choice("Invoice", "Invoice"),
    )
    val DEFAULT_HI_TYPES = setOf("OPConsultation", "Prescription", "DiagnosticReport", "DischargeSummary")

    /** How long the copies may be kept, in days. */
    val KEEP_OPTIONS = listOf(Choice(7, "7 days"), Choice(30, "30 days"), Choice(90, "90 days"), Choice(365, "1 year"))

    private val STATUSES = mapOf(
        "requested" to Status("Sent to ABDM", Tone.Info, "Waiting for ABDM to accept it."),
        AWAITING_PATIENT to Status("Waiting for the patient", Tone.Info, "The patient approves or declines it in their ABHA app."),
        "granted" to Status("Granted", Tone.Success, "Records appear as each hospital sends them."),
        "denied" to Status("Denied", Tone.Danger, "The patient declined. Nothing was shared."),
        "revoked" to Status("Revoked", Tone.Warning, "The patient withdrew consent. The records received were erased."),
        "expired" to Status("Expired", Tone.Neutral, "The consent ended. The records received were erased."),
        FAILED to Status("Not sent", Tone.Danger, "ABDM did not accept the request."),
    )

    fun status(code: String): Status = STATUSES[code] ?: Status(code.replace('_', ' '), Tone.Neutral, "")
    fun purposeLabel(code: String): String = PURPOSES.firstOrNull { it.value == code }?.label ?: code
    fun hiTypeLabel(code: String?): String = code?.let { c -> HI_TYPES.firstOrNull { it.value == c }?.label ?: c } ?: "Record"

    /** Only a request still waiting for the patient can be asked about again. */
    fun isCheckable(r: ConsentRequest): Boolean = r.status == AWAITING_PATIENT

    /** Raised only by someone who holds the permission, for a patient the server says can be asked about. */
    fun canRaise(view: PatientView, holdsRequest: Boolean): Boolean = holdsRequest && view.blocked_reason == null

    /** Copies a revoked or expired consent took with it: received, no longer held. */
    fun erased(r: ConsentRequest): Int = maxOf(0, r.records_received - r.records_held)

    /** Received records grouped by the hospital that sent them, in the server's order. */
    fun byFacility(records: List<ReceivedRecordItem>): List<FacilityGroup> =
        records.groupBy { it.source_hip_id }.map { (id, rows) -> FacilityGroup(id, rows.first().source_hip_name ?: id, rows) }

    /** The first thing wrong with a request, or null when it can go. */
    fun problem(hiTypes: Set<String>, from: LocalDate, to: LocalDate): String? = when {
        hiTypes.isEmpty() -> "Choose at least one record type"
        from.isAfter(to) -> "The range ends before it starts"
        else -> null
    }

    /** The request as sent: whole days from the first to the last, and the copies erased [keepDays] from now. */
    fun newRequest(purpose: String, hiTypes: Set<String>, from: LocalDate, to: LocalDate, keepDays: Int, now: Instant = Instant.now(), zone: ZoneId = ZoneId.systemDefault()) =
        NewRequest(
            purpose_code = purpose,
            hi_types = hiTypes.sorted(),
            date_from = ServerTime.format(from.atStartOfDay(zone).toInstant()),
            date_to = ServerTime.format(to.atTime(LocalTime.of(23, 59, 59)).atZone(zone).toInstant()),
            data_erase_at = ServerTime.format(now.plus(keepDays.toLong(), ChronoUnit.DAYS)),
        )
}

/** The ABDM records calls, one per route the screens use. */
class AbdmRecordsApi(private val client: ApiClient) {
    suspend fun patientView(patientId: String): AbdmRecords.PatientView = client.get("/api/abdm/patients/$patientId/received-records")
    suspend fun raise(patientId: String, body: AbdmRecords.NewRequest): AbdmRecords.ConsentRequest =
        client.post("/api/abdm/patients/$patientId/consent-requests", body)
    suspend fun checkStatus(requestId: String): AbdmRecords.ConsentRequest = client.post("/api/abdm/consent-requests/$requestId/check-status")
    /** 404 once the consent ended or the erase date passed: the copy is gone. */
    suspend fun record(id: String): AbdmRecords.ReceivedRecord = client.get("/api/abdm/received-records/$id")
}
