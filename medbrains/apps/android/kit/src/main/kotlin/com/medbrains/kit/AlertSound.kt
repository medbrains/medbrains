package com.medbrains.kit

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.ContentResolver
import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.net.Uri
import android.os.SystemClock

/**
 * The three alert sounds (issue #4862). Which one a notification makes is
 * `packages/alert-sounds/alert-sounds.json`, shared with web and iOS;
 * [AlertSoundRules] mirrors it and `AlertSoundTest` reads the JSON to catch
 * drift. The Ogg files come from `packages/alert-sounds/android/raw` (this
 * module's `res` source set).
 */
enum class AlertSound(val rawRes: Int, val channel: AlertChannel) {
    CALM(R.raw.alert_calm, AlertChannel.CALM),
    ATTENTION(R.raw.alert_attention, AlertChannel.ATTENTION),
    URGENT(R.raw.alert_urgent, AlertChannel.URGENT),
    ;

    val key: String get() = name.lowercase()
}

/** Who is listening: patient-facing apps never hear attention or urgent. */
enum class AlertAudience { STAFF, PATIENT }

object AlertSoundRules {
    val SILENT_SCOPES = setOf("board")
    val PATIENT_SOUND = AlertSound.CALM
    val URGENT_KINDS = setOf("danger", "error", "critical", "emergency")
    val CALM_KINDS = setOf("info", "success")
    val URGENT_ENTITY_TYPES = setOf("code_blue", "mass_casualty_event", "bedside_nurse_request")
    val ATTENTION_ENTITY_TYPES = setOf("lab_order", "radiology_order")
    val DEFAULT_SOUND = AlertSound.ATTENTION

    /** One sound per category per window, so a burst rings once. */
    const val THROTTLE_MS = 4_000L

    /** First matching rule wins, in the order the JSON documents. null = silent. */
    fun sound(kind: String, entityType: String? = null, scope: String? = null, audience: AlertAudience): AlertSound? {
        if (scope != null && scope in SILENT_SCOPES) return null
        if (audience == AlertAudience.PATIENT) return PATIENT_SOUND
        if (kind in URGENT_KINDS) return AlertSound.URGENT
        val entity = entityType.orEmpty()
        if (entity in URGENT_ENTITY_TYPES && kind !in CALM_KINDS) return AlertSound.URGENT
        if (entity in ATTENTION_ENTITY_TYPES) return AlertSound.ATTENTION
        if (kind in CALM_KINDS) return AlertSound.CALM
        return DEFAULT_SOUND
    }

    /** The channel an incoming notification posts to; null = post nothing audible. */
    fun channelFor(kind: String, entityType: String? = null, scope: String? = null, audience: AlertAudience): String? =
        sound(kind, entityType, scope, audience)?.channel?.id

    /** The sounds an audience can ever hear: the channels its app registers. */
    fun soundsFor(audience: AlertAudience): List<AlertSound> =
        if (audience == AlertAudience.PATIENT) listOf(PATIENT_SOUND) else AlertSound.entries
}

/**
 * One notification channel per sound. Channel sound and importance are fixed
 * once created (the person owns them after that), so the ids carry a version.
 * Urgent plays as an alarm and may bypass Do Not Disturb only where the app
 * already holds policy access — it never asks for it.
 */
enum class AlertChannel(val id: String, val label: String, val description: String, val importance: Int, val usage: Int) {
    CALM("alerts_calm_v1", "Information", "Token calls and other information", NotificationManager.IMPORTANCE_DEFAULT, AudioAttributes.USAGE_NOTIFICATION),
    ATTENTION("alerts_attention_v1", "New notifications", "Results ready and new requests", NotificationManager.IMPORTANCE_HIGH, AudioAttributes.USAGE_NOTIFICATION),
    URGENT("alerts_urgent_v1", "Urgent alerts", "Critical values and emergency codes", NotificationManager.IMPORTANCE_HIGH, AudioAttributes.USAGE_ALARM),
    ;

    val wantsDndBypass: Boolean get() = this == URGENT

    val attributes: AudioAttributes
        get() = AudioAttributes.Builder()
            .setUsage(usage)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
}

object AlertChannels {
    private fun soundUri(context: Context, sound: AlertSound): Uri =
        Uri.parse("${ContentResolver.SCHEME_ANDROID_RESOURCE}://${context.packageName}/${sound.rawRes}")

    /** Create (or keep) the channels an app's audience can hear. Safe to call on every start. */
    fun register(context: Context, audience: AlertAudience) {
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        val canBypassDnd = manager.isNotificationPolicyAccessGranted
        val channels = AlertSoundRules.soundsFor(audience).map { sound ->
            val spec = sound.channel
            NotificationChannel(spec.id, spec.label, spec.importance).apply {
                description = spec.description
                setSound(soundUri(context, sound), spec.attributes)
                if (spec.wantsDndBypass && canBypassDnd) setBypassDnd(true)
            }
        }
        manager.createNotificationChannels(channels)
    }
}

/**
 * Plays an alert sound while the app is in the foreground. Each play is a
 * one-shot MediaPlayer released when it completes or fails, so nothing is
 * held between alerts and nothing leaks. Throttled per sound.
 */
class AlertSoundPlayer(private val context: Context, private val clock: () -> Long = SystemClock::elapsedRealtime) {
    private val lastPlayed = mutableMapOf<AlertSound, Long>()

    fun play(sound: AlertSound): Boolean {
        val now = clock()
        val last = lastPlayed[sound]
        if (last != null && now - last < AlertSoundRules.THROTTLE_MS) return false
        lastPlayed[sound] = now
        val player = MediaPlayer.create(context, sound.rawRes, sound.channel.attributes, AudioManager.AUDIO_SESSION_ID_GENERATE) ?: return false
        player.setOnCompletionListener { it.release() }
        player.setOnErrorListener { mp, _, _ -> mp.release(); true }
        player.start()
        return true
    }
}
