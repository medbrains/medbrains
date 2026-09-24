package com.medbrains.kit

import androidx.compose.runtime.compositionLocalOf
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlin.coroutines.coroutineContext

/**
 * A value fetched from the server, with the three states a screen must tell
 * apart. `Failed` is not `Loaded(empty)`: an outage rendered as an empty ward
 * tells a nurse the ward is quiet, and the device-surface rules forbid it.
 */
sealed interface RemoteState<out T> {
    data object Loading : RemoteState<Nothing>
    data class Loaded<T>(val value: T) : RemoteState<T>
    data class Failed(val message: String) : RemoteState<Nothing>
}

val <T> RemoteState<T>.value: T? get() = (this as? RemoteState.Loaded<T>)?.value

/**
 * The fetch-once-and-refetch hook the React Native screens used. `poll`
 * re-asks on a cadence for as long as the calling coroutine lives — start it
 * in a `LaunchedEffect` and Compose cancels it when the screen leaves.
 */
class Remote<T> {
    private val _state = MutableStateFlow<RemoteState<T>>(RemoteState.Loading)
    val state: StateFlow<RemoteState<T>> = _state.asStateFlow()
    private val _staleSince = MutableStateFlow<Instant?>(null)
    /** Set when a refresh failed but an earlier answer is still shown. */
    val staleSince: StateFlow<Instant?> = _staleSince.asStateFlow()

    val value: T? get() = _state.value.value

    suspend fun load(op: suspend () -> T) {
        try {
            _state.value = RemoteState.Loaded(op())
            _staleSince.value = null
        } catch (e: Exception) {
            // The class and message, never the body: a decode failure names a
            // field, an outage names a host, and both are what a support call needs.
            android.util.Log.w("MedBrains", "fetch failed: ${e::class.simpleName}: ${e.message}")
            // Keep the last good answer if there is one; an alarm must not
            // clear because one poll dropped.
            if (_state.value is RemoteState.Loaded) {
                if (_staleSince.value == null) _staleSince.value = Instant.now()
            } else {
                _state.value = RemoteState.Failed((e as? ApiError)?.message ?: "Could not reach the hospital server.")
            }
        }
    }

    suspend fun poll(everyMs: Long, op: suspend () -> T) {
        while (coroutineContext.isActive) {
            load(op)
            delay(everyMs)
        }
    }
}

/** The server writes RFC 3339 with fractional seconds; timestamps travel as strings. */
object ServerTime {
    fun parse(text: String?): Instant? = text?.let { runCatching { OffsetDateTime.parse(it).toInstant() }.getOrNull() }
    fun format(instant: Instant): String = DateTimeFormatter.ISO_INSTANT.format(instant)
    private val short = DateTimeFormatter.ofPattern("d MMM, HH:mm")
    /** "12 Sep, 14:05" in the device's zone. */
    fun short(text: String?): String = parse(text)?.let { short.format(it.atZone(ZoneId.systemDefault())) } ?: "—"
}

/** The app's client and session, for module screens deep in the tree. */
val LocalApiClient = compositionLocalOf<ApiClient> { error("ApiClient not provided") }
val LocalAuthStore = compositionLocalOf<AuthStore> { error("AuthStore not provided") }
val LocalIdentity = compositionLocalOf<TenantIdentity?> { null }
