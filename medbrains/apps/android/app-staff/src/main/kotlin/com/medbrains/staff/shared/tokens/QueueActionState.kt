package com.medbrains.staff.shared.tokens

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.medbrains.kit.ApiError
import kotlinx.coroutines.CancellationException

/**
 * The state around one button that changes a queue: busy while it runs, the
 * sentence that says what happened, or why nothing did. One definition, so
 * every screen that calls a patient reports it the same way — and a call that
 * says nothing is a call pressed twice.
 */
class QueueActionState {
    var busy by mutableStateOf(false)
        private set
    var toast by mutableStateOf<String?>(null)
        private set
    var failure by mutableStateOf<String?>(null)
        private set

    /** Runs [op]; its answer is what the user is told happened. [unreachable] names what did not happen when the server could not be reached. */
    suspend fun run(unreachable: String, op: suspend () -> String) {
        busy = true
        failure = null
        try {
            toast = op()
        } catch (e: ApiError) {
            failure = e.message
        } catch (e: CancellationException) {
            throw e // leaving the screen is not a failure to report
        } catch (e: Exception) {
            failure = unreachable
        } finally {
            busy = false
        }
    }
}
