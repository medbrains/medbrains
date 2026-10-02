package com.medbrains.staff.shared.bodysite

import android.content.Context
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/** The server's `body_site::Laterality`. */
@Serializable
enum class Laterality(val choice: String, val word: String?) {
    @SerialName("left") Left("Left", "Left"),
    @SerialName("right") Right("Right", "Right"),
    @SerialName("bilateral") Bilateral("Both", null),
    @SerialName("midline") Midline("Midline", null),
}

/**
 * A body region as a clinician charts it ("Left knee"), read from
 * `packages/anatomy/body-regions.json` — the same list the web picker uses.
 */
@Serializable
data class BodyRegion(val id: String, val label: String, val sided: Boolean, val zone: Zone) {
    @Serializable enum class View { @SerialName("front") Front, @SerialName("back") Back }

    /** Where the patient's right instance sits on its view, in fractions of the figure. */
    @Serializable
    data class Zone(val view: View, val x: Float, val y: Float, val w: Float, val h: Float) {
        /** The patient's left: the same zone across the midline. */
        val mirrored: Zone get() = copy(x = 1 - x - w)
    }

    /** The zones a view draws: one per unsided region, a right and a left per sided one. */
    fun zones(on: View): List<Pair<Laterality?, Zone>> = when {
        zone.view != on -> emptyList()
        sided -> listOf(Laterality.Right to zone, Laterality.Left to zone.mirrored)
        else -> listOf(null to zone)
    }

    /** "Left knee", or "Knee" until its side is chosen. */
    fun label(side: Laterality?): String {
        val word = side?.word
        return if (sided && word != null) "$word ${label.lowercase()}" else label
    }

    companion object {
        @Serializable private data class File(val regions: List<BodyRegion>)
        private val json = Json { ignoreUnknownKeys = true }
        @Volatile private var cached: List<BodyRegion>? = null

        /** The list, bundled with the app as an asset; read once. */
        fun all(context: Context): List<BodyRegion> = cached ?: context.assets.open("body-regions.json")
            .bufferedReader().use { json.decodeFromString<File>(it.readText()).regions }
            .also { cached = it }
    }
}
