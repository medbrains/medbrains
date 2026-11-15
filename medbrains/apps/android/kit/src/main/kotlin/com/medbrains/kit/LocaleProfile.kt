package com.medbrains.kit

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * The hospital's locale profile as `/api/auth/me` serves it (RFC-WORLD-READY
 * §2.3), resolved user › facility › hospital › country pack on the server, so
 * the app never picks a locale, currency or zone itself. Field names are the
 * wire's.
 */
@Serializable
data class LocaleProfile(
    val pack: String,
    val values: Values,
    val missing: List<String> = emptyList(),
) {
    /** A field nobody set is null and named in [missing]: neutral, never guessed. */
    @Serializable
    data class Values(
        val country: String? = null,
        val currency: String? = null,
        val locale: String? = null,
        val timezone: String? = null,
        val hour_cycle: String? = null,
        val name_order: String? = null,
        val calendars: Calendars? = null,
    )

    /** Gregorian always; [also] are shown beside it (Hijri in the Gulf). */
    @Serializable
    data class Calendars(val primary: String = "gregory", val also: List<String> = emptyList())

    companion object {
        /** Before any profile ever loaded here: the bare number, UTC labelled. */
        val NEUTRAL = LocaleProfile("world", Values(), listOf("country", "currency", "timezone"))
    }
}

/** Where the profile on screen came from, so a screen can say so. */
enum class LocaleProfileState { LOADING, READY, LAST_GOOD, UNAVAILABLE }

/** Somewhere to keep text across launches; SharedPreferences in the app, a map in tests. */
interface TextStore {
    /** The text saved under [key], if any. */
    fun read(key: String): String?

    /** Save [value] under [key]. */
    fun write(key: String, value: String)
}

/** [TextStore] on the app's private SharedPreferences: the profile is not a secret. */
class PrefsTextStore(context: Context) : TextStore {
    private val prefs = context.getSharedPreferences("medbrains.locale_profile", Context.MODE_PRIVATE)

    /** The saved text, if any. */
    override fun read(key: String): String? = prefs.getString(key, null)

    /** Save, asynchronously: the profile is a cache, the server holds the truth. */
    override fun write(key: String, value: String) {
        prefs.edit().putString(key, value).apply()
    }
}

@Serializable
private data class MeLocale(val locale_profile: LocaleProfile? = null)

/**
 * The signed-in hospital's profile, kept as last-good per tenant so an
 * offline ward still shows its own money and clock (RFC §2.3).
 */
class LocaleProfileStore(private val store: TextStore) {
    private val json = Json { ignoreUnknownKeys = true }
    private val _profile = MutableStateFlow(LocaleProfile.NEUTRAL)
    val profile: StateFlow<LocaleProfile> = _profile.asStateFlow()
    private val _state = MutableStateFlow(LocaleProfileState.LOADING)
    val state: StateFlow<LocaleProfileState> = _state.asStateFlow()

    /** One saved profile per hospital: another hospital's is never borrowed. */
    private fun key(tenantId: String) = "medbrains.locale_profile.$tenantId"

    /** Fetch the profile; on any failure fall back to the last good one. */
    suspend fun refresh(client: ApiClient, tenantId: String) {
        val fresh = runCatching { json.decodeFromString<MeLocale>(client.call("GET", "/api/auth/me")).locale_profile }
            .getOrNull()
        if (fresh != null) adopt(fresh, tenantId) else useLastGood(tenantId)
    }

    /** A profile the server sent: shown and saved as this tenant's last good. */
    fun adopt(fresh: LocaleProfile, tenantId: String) {
        _profile.value = fresh
        _state.value = LocaleProfileState.READY
        store.write(key(tenantId), json.encodeToString(LocaleProfile.serializer(), fresh))
    }

    /** The saved profile for this tenant, else neutral; [state] says which. */
    fun useLastGood(tenantId: String) {
        val saved = store.read(key(tenantId))?.let { runCatching { json.decodeFromString<LocaleProfile>(it) }.getOrNull() }
        _profile.value = saved ?: LocaleProfile.NEUTRAL
        _state.value = if (saved != null) LocaleProfileState.LAST_GOOD else LocaleProfileState.UNAVAILABLE
    }
}
