package com.medbrains.staff.shared.tokens

import com.medbrains.kit.ApiClient
import kotlinx.serialization.Serializable

// The unified token queue (crates/medbrains-tokens) as every module reads and
// works it — the OPD doctor, the reception desk and the camp stations call
// the same routes, so they are written once here.

/** One row of the unified token queue with the patient behind it (`/api/tokens/worklist`). */
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

/** The token as a transition returns it; only what a screen merges back. */
@Serializable data class ModuleToken(val id: String, val status: String, val called_at: String? = null, val counter_label: String? = null)

/**
 * Which part of a module's queue a screen reads and calls from. Never the
 * whole hospital: a large OPD runs past the server's 500-row page, and the
 * patient being looked for falls off the end of it.
 */
sealed interface QueueSlice {
    /** The doctor's own patients, then their departments' unassigned. */
    data object Mine : QueueSlice
    /** Everyone in the caller's departments. */
    data object MyDepartments : QueueSlice
    /** One department — a desk's. */
    data class Department(val id: String) : QueueSlice
    /** One counter — a camp station. */
    data class Counter(val id: String) : QueueSlice
}

private data class SliceParams(val scope: TokenScope?, val id: String?, val view: WorklistView?)

private val QueueSlice.params: SliceParams get() = when (this) {
    QueueSlice.Mine -> SliceParams(null, null, WorklistView.MINE)
    QueueSlice.MyDepartments -> SliceParams(null, null, WorklistView.DEPARTMENT)
    is QueueSlice.Department -> SliceParams(TokenScope.DEPARTMENT, id, null)
    is QueueSlice.Counter -> SliceParams(TokenScope.COUNTER, id, null)
}

// No defaults on request bodies: the client does not encode them.
@Serializable private data class CallBody(val counter_label: String?)
@Serializable private data class CallNextBody(val module: String, val scope: String?, val scope_id: String?, val view: String?, val counter_label: String?)

/** The token routes for one module's queue. */
class TokenApi(private val client: ApiClient, private val module: TokenModule) {
    suspend fun worklist(slice: QueueSlice): List<WorklistToken> {
        val p = slice.params
        val query = listOfNotNull(
            "module=${module.wire}",
            p.scope?.let { "scope=${it.wire}" },
            p.id?.let { "scope_id=$it" },
            p.view?.let { "view=${it.wire}" },
        ).joinToString("&")
        return client.get("${TokenRoute.WORKLIST}?$query")
    }

    /** Call whoever is next in [slice] and let the server decide, under its lock. `null` is a real answer: nobody is waiting. */
    suspend fun callNext(slice: QueueSlice, counterLabel: String? = null): ModuleToken? {
        val p = slice.params
        val body = CallNextBody(module.wire, p.scope?.wire, p.id, p.view?.wire, counterLabel)
        val text = client.call("POST", TokenRoute.CALL_NEXT, client.json.encodeToString(CallNextBody.serializer(), body))
        return if (text.isBlank() || text == "null") null else client.json.decodeFromString(ModuleToken.serializer(), text)
    }

    suspend fun call(id: String, counterLabel: String? = null): ModuleToken = client.post(TokenRoute.action(id, TokenRoute.Action.CALL), CallBody(counterLabel))
    suspend fun serve(id: String): ModuleToken = client.post(TokenRoute.action(id, TokenRoute.Action.SERVE))
    /** Done here — a camp patient goes on to the next station. */
    suspend fun complete(id: String): ModuleToken = client.post(TokenRoute.action(id, TokenRoute.Action.COMPLETE))
    /** Done, and needs no further station — no medicine, so no pharmacy queue. */
    suspend fun finish(id: String): ModuleToken = client.post(TokenRoute.action(id, TokenRoute.Action.FINISH))
    suspend fun noShow(id: String): ModuleToken = client.post(TokenRoute.action(id, TokenRoute.Action.NO_SHOW))
}
