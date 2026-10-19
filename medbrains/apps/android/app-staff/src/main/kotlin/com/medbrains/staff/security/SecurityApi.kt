package com.medbrains.staff.security

import com.medbrains.kit.ApiClient
import com.medbrains.kit.ApiError
import com.medbrains.staff.reception.PassRow
import com.medbrains.staff.reception.VisitorLogRow
import kotlinx.serialization.Serializable
import java.net.URLEncoder

// Wire shapes mirror crates/medbrains-ancillary (pass_check, front_office)
// and crates/medbrains-security (incidents, tag alerts, band match).

/** The codes this module checks, named once. */
object SecurityPermission {
    const val VERIFY_PASS = "front_office.passes.verify"
    const val LIST_PASSES = "front_office.passes.list"
    const val LIST_VISITORS = "front_office.visitors.list"
    /** The desk that issues passes may also record entry and exit. */
    val RECORD_VISITS = listOf("front_office.passes.manage", "front_office.visitor_logs.record")
    const val LIST_INCIDENTS = "security.incidents.list"
    const val CREATE_INCIDENT = "security.incidents.create"
    const val UPDATE_INCIDENT = "security.incidents.update"
    const val LIST_TAG_ALERTS = "security.patient_safety.list"
    const val RESOLVE_TAG_ALERT = "security.patient_safety.manage"
    const val VERIFY_BAND_MATCH = "security.patient_safety.verify_match"
}

/** How often each list refreshes while on screen. */
object SecurityRefresh {
    const val QUEUE_MS = 30_000L
    const val ALARM_MS = 15_000L
}

/** `GET /api/front-office/passes/scan`: the server's verdict, never the client's. */
@Serializable
data class PassVerdict(
    val valid: Boolean,
    /** "revoked", "expired" or "not_yet_valid" when it does not let the holder in. */
    val reason: String? = null,
    val pass_number: String,
    val visitor_name: String,
    val relationship: String? = null,
    val category: String,
    val id_type: String? = null,
    val id_number: String? = null,
    val photo_url: String? = null,
    val ward_name: String? = null,
    val bed_number: String? = null,
    val valid_until: String,
    val revoked_reason: String? = null,
) {
    /** The verdict in words, for the band at the top of the sheet. */
    val headline: String get() = if (valid) "Let in" else when (reason) {
        "revoked" -> "Do not let in — Revoked"
        "expired" -> "Do not let in — Expired"
        "not_yet_valid" -> "Do not let in — Not yet valid"
        else -> "Do not let in"
    }
}

@Serializable
data class SecurityIncidentRow(
    val id: String,
    val incident_number: String,
    val severity: String,
    val status: String,
    val category: String,
    val location_description: String? = null,
    val occurred_at: String,
    val description: String,
) {
    val isOpen: Boolean get() = status == "reported" || status == "investigating"
    val categoryLabel: String get() = IncidentCategory.label(category)
}

@Serializable
data class IncidentUpdateRow(val id: String, val update_type: String, val description: String, val updated_by_name: String? = null, val created_at: String)

@Serializable
data class TagAlertRow(val id: String, val tag_id: String, val alert_type: String, val triggered_at: String, val location_description: String? = null) {
    /** "exit_zone" → "Exit zone": the event in words, never a code. */
    val alertLabel: String get() = alert_type.replace('_', ' ').replaceFirstChar { it.uppercase() }
}

@Serializable data class BandMatchResult(val matched: Boolean)

/** The categories the web register offers, in the same words. */
object IncidentCategory {
    val all = listOf(
        "theft" to "Theft", "assault" to "Assault", "trespass" to "Trespass",
        "property_damage" to "Property damage", "policy_violation" to "Policy violation",
        "elopement" to "Elopement", "other" to "Other",
    )

    fun label(id: String): String = all.firstOrNull { it.first == id }?.second ?: id.replace('_', ' ')
}

object IncidentSeverity {
    val all = listOf("low", "medium", "high", "critical")
}

@Serializable
data class NewIncidentBody(val category: String, val severity: String, val location_description: String?, val description: String, val persons_involved: List<String>?)

@Serializable private data class NoteBody(val description: String)
@Serializable private data class StatusBody(val status: String)
@Serializable private data class ResolveAlertBody(val was_false_alarm: Boolean, val resolution_notes: String)
@Serializable private data class BandMatchBody(val infant_tag: String, val mother_band: String, val purpose: String)

class SecurityApi(private val client: ApiClient) {
    /** The pass number as the QR carries it; the server compares. */
    suspend fun scan(code: String): PassVerdict = client.get("/api/front-office/passes/scan?code=${URLEncoder.encode(code, "UTF-8")}")

    /** Active passes, to find the id a scan does not return and to name who is inside. */
    suspend fun activePasses(): List<PassRow> = client.get("/api/front-office/passes?status=active")

    /** Entries with no exit yet. */
    suspend fun openVisits(): List<VisitorLogRow> = client.get("/api/front-office/visitor-logs?active_only=true")

    suspend fun incidents(): List<SecurityIncidentRow> = client.get("/api/security/incidents")
    suspend fun report(body: NewIncidentBody): SecurityIncidentRow = client.post("/api/security/incidents", body)
    suspend fun updates(id: String): List<IncidentUpdateRow> = client.get("/api/security/incidents/$id/updates")
    suspend fun addUpdate(id: String, text: String): IncidentUpdateRow = client.post("/api/security/incidents/$id/updates", NoteBody(text))
    suspend fun resolveIncident(id: String): SecurityIncidentRow = client.put("/api/security/incidents/$id", StatusBody("resolved"))

    suspend fun openTagAlerts(): List<TagAlertRow> = client.get("/api/security/tag-alerts?is_resolved=false")
    suspend fun resolveTagAlert(id: String, notes: String, falseAlarm: Boolean): TagAlertRow =
        client.put("/api/security/tag-alerts/$id/resolve", ResolveAlertBody(falseAlarm, notes))

    /** Baby's band against mother's band; a mismatch answers 409 in the server's words. */
    suspend fun verifyBandMatch(infant: String, mother: String): BandMatchResult =
        client.post("/api/security/patient-tags/verify-match", BandMatchBody(infant, mother, "nursery_exit"))
}

/**
 * A write that did not land, in words: a lost permission, the server's own
 * reason, or no connection — and in every case, that nothing was saved.
 */
fun securityWriteFailure(e: Throwable): String = when {
    e is ApiError && e.status == 403 -> "You no longer have access to this — ask your administrator."
    e is ApiError -> e.message ?: "The hospital server refused this."
    else -> "Not saved — no connection. Nothing was recorded."
}
