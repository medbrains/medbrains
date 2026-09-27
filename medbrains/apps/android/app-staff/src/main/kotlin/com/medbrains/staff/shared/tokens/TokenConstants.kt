package com.medbrains.staff.shared.tokens

import com.medbrains.ui.CarbonTone

// The token queue's wire names and timings, defined once. They mirror
// crates/medbrains-tokens; a value here that drifts from the server is a bug.

/** A queue's module, as the server names it. */
enum class TokenModule(val wire: String) { OPD("opd"), CAMP("camp") }

/** What a token's `scope_id` points at. */
enum class TokenScope(val wire: String) { DEPARTMENT("department"), COUNTER("counter") }

/** The worklist's `view` parameter. */
enum class WorklistView(val wire: String) { MINE("mine"), DEPARTMENT("department") }

/** The token routes. */
object TokenRoute {
    const val WORKLIST = "/api/tokens/worklist"
    const val CALL_NEXT = "/api/tokens/call-next"
    const val CAMP_STATIONS = "/api/tokens/camp-stations"

    enum class Action(val wire: String) { CALL("call"), SERVE("serve"), COMPLETE("complete"), FINISH("finish"), NO_SHOW("no-show") }

    fun action(id: String, action: Action): String = "/api/tokens/$id/${action.wire}"
}

/** How often a screen re-reads the server while it is open. */
object QueuePolling {
    /** A queue a desk or station is working: a new arrival shows within one beat. */
    const val QUEUE_MS = 5_000L

    /** The list of camp stations: a route started after the volunteer arrived appears without a restart. */
    const val CAMP_STATIONS_MS = 15_000L
}

/** A token's status as the server writes it. */
object TokenStatus {
    const val WAITING = "waiting"
    const val CALLED = "called"
    const val SERVING = "serving"
    const val COMPLETED = "completed"

    /** Someone is standing at the counter: the moment the actions apply. */
    fun isWithStaff(status: String): Boolean = status == CALLED || status == SERVING

    /** "no_show" → "no show", for a tag. */
    fun label(status: String): String = status.replace('_', ' ')
}

/** The colour a token status wears in a tag. */
fun tokenTone(status: String): CarbonTone = when (status) {
    TokenStatus.WAITING -> CarbonTone.Warning
    TokenStatus.CALLED, TokenStatus.SERVING -> CarbonTone.Info
    TokenStatus.COMPLETED -> CarbonTone.Success
    else -> CarbonTone.Neutral
}

/** How many rows are in [status] — the numbers on a queue's stat tiles and Call next. */
fun List<WorklistToken>.countIn(status: String): Int = count { it.status == status }
