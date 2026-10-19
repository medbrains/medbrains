package com.medbrains.kit

import android.app.NotificationManager
import android.media.AudioAttributes
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * The phone rings the way the browser does: the rules mirror
 * `packages/alert-sounds/alert-sounds.json`, and this reads that file.
 */
class AlertSoundTest {
    private val shared = Json.parseToJsonElement(File("../../../packages/alert-sounds/alert-sounds.json").readText()).jsonObject

    private fun list(key: String) = shared.getValue(key).jsonArray.map { it.jsonPrimitive.content }.toSet()
    private fun text(key: String) = shared.getValue(key).jsonPrimitive.content

    @Test fun theMirrorMatchesTheSharedRules() {
        assertEquals(list("sounds"), AlertSound.entries.map { it.key }.toSet())
        assertEquals(list("silent_scopes"), AlertSoundRules.SILENT_SCOPES)
        assertEquals(text("patient_sound"), AlertSoundRules.PATIENT_SOUND.key)
        assertEquals(list("urgent_kinds"), AlertSoundRules.URGENT_KINDS)
        assertEquals(list("calm_kinds"), AlertSoundRules.CALM_KINDS)
        assertEquals(list("urgent_entity_types"), AlertSoundRules.URGENT_ENTITY_TYPES)
        assertEquals(list("attention_entity_types"), AlertSoundRules.ATTENTION_ENTITY_TYPES)
        assertEquals(text("default_sound"), AlertSoundRules.DEFAULT_SOUND.key)
        assertEquals(shared.getValue("throttle_ms").jsonPrimitive.int.toLong(), AlertSoundRules.THROTTLE_MS)
    }

    @Test fun realNotificationsSoundAsTheWebDoes() {
        val staff = AlertAudience.STAFF
        assertEquals(AlertSound.URGENT, AlertSoundRules.sound("danger", "lab_order", audience = staff))
        assertEquals(AlertSound.URGENT, AlertSoundRules.sound("error", "code_blue", audience = staff))
        assertEquals(AlertSound.URGENT, AlertSoundRules.sound("sla_breach", "bedside_nurse_request", audience = staff))
        // A code blue standing down is news, not an alarm.
        assertEquals(AlertSound.CALM, AlertSoundRules.sound("info", "code_blue", audience = staff))
        assertEquals(AlertSound.ATTENTION, AlertSoundRules.sound("info", "lab_order", audience = staff))
        assertEquals(AlertSound.ATTENTION, AlertSoundRules.sound("break_glass", audience = staff))
        assertEquals(AlertSound.CALM, AlertSoundRules.sound("info", "appointment", audience = staff))
        assertNull(AlertSoundRules.sound("danger", scope = "board", audience = staff))
    }

    @Test fun incomingNotificationsMapToTheirChannel() {
        assertEquals("alerts_urgent_v1", AlertSoundRules.channelFor("danger", "lab_order", audience = AlertAudience.STAFF))
        assertEquals("alerts_attention_v1", AlertSoundRules.channelFor("warning", audience = AlertAudience.STAFF))
        assertEquals("alerts_calm_v1", AlertSoundRules.channelFor("danger", "code_blue", audience = AlertAudience.PATIENT))
        assertNull(AlertSoundRules.channelFor("info", scope = "board", audience = AlertAudience.STAFF))
    }

    @Test fun thePatientAppOnlyEverHearsCalm() {
        for (kind in listOf("danger", "error", "warning", "info")) {
            assertEquals(AlertSound.CALM, AlertSoundRules.sound(kind, "code_blue", audience = AlertAudience.PATIENT))
        }
        assertEquals(listOf(AlertSound.CALM), AlertSoundRules.soundsFor(AlertAudience.PATIENT))
        assertEquals(AlertSound.entries, AlertSoundRules.soundsFor(AlertAudience.STAFF))
    }

    @Test fun channelsHaveTheAgreedImportanceUsageAndDndPolicy() {
        assertEquals(NotificationManager.IMPORTANCE_DEFAULT, AlertChannel.CALM.importance)
        assertEquals(NotificationManager.IMPORTANCE_HIGH, AlertChannel.ATTENTION.importance)
        assertEquals(NotificationManager.IMPORTANCE_HIGH, AlertChannel.URGENT.importance)
        assertEquals(AudioAttributes.USAGE_NOTIFICATION, AlertChannel.CALM.usage)
        assertEquals(AudioAttributes.USAGE_NOTIFICATION, AlertChannel.ATTENTION.usage)
        assertEquals(AudioAttributes.USAGE_ALARM, AlertChannel.URGENT.usage)
        assertTrue(AlertChannel.URGENT.wantsDndBypass)
        assertFalse(AlertChannel.CALM.wantsDndBypass || AlertChannel.ATTENTION.wantsDndBypass)
        assertEquals(AlertChannel.entries.size, AlertChannel.entries.map { it.id }.toSet().size)
        AlertSound.entries.forEach { assertEquals(it.name, it.channel.name) }
    }

    @Test fun everySoundFileIsInTheSharedResourceFolder() {
        for (sound in AlertSound.entries) {
            assertTrue(sound.key, File("../../../packages/alert-sounds/android/raw/alert_${sound.key}.ogg").exists())
        }
    }
}
