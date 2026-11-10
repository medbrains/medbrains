package com.medbrains.kit

import kotlinx.serialization.Serializable

/**
 * The early-warning score charted with every bedside vitals reading. The
 * server scores it (NEWS2 adults, PEWS children by age band, MEOWS pregnant and
 * post-partum — `crates/medbrains-clinical-scores/src/ews`); this only shapes
 * what is sent and how the answer reads. Same labels as the web
 * (`apps/web/src/components/EarlyWarning/ews-display.ts`) and iOS.
 */
object EarlyWarning {
    data class Option(val code: String, val label: String)

    /** ACVPU. */
    val CONSCIOUSNESS = listOf(
        Option("A", "Alert"), Option("C", "New confusion"), Option("V", "Voice"),
        Option("P", "Pain"), Option("U", "Unresponsive"),
    )
    const val ROOM_AIR = "room_air"
    const val HIGH_FLOW = "high_flow"
    val OXYGEN_DEVICES = listOf(
        Option(ROOM_AIR, "Room air"), Option("nasal_prongs", "Nasal prongs"), Option("mask", "Mask"),
        Option(HIGH_FLOW, "High flow"), Option("other", "Other support"),
    )
    val DISTRESS = listOf(Option("nil", "Nil"), Option("mild", "Mild"), Option("moderate", "Moderate"), Option("severe", "Severe"))

    /** The server's accepted ranges. */
    val FLOW_RANGE = 0.0..80.0
    val FIO2_RANGE = 21..100
    val CAPILLARY_REFILL_RANGE = 0.0..20.0

    /** What a score needs beyond the classic vitals. Blank is not charted — never normal. */
    @Serializable
    data class Inputs(
        val consciousness: String? = null,
        val oxygen_device: String? = null,
        val oxygen_flow_lpm: Double? = null,
        val fio2_percent: Int? = null,
        val capillary_refill_seconds: Double? = null,
        val respiratory_distress: String? = null,
    )

    class Problem(message: String) : IllegalArgumentException(message)

    /** Check and shape the typed text; flow is sent only on low-flow devices, FiO₂ only on high flow. */
    fun inputs(consciousness: String?, device: String?, flow: String, fio2: String, capillaryRefill: String, distress: String?): Inputs {
        fun number(s: String, label: String): Double? {
            val t = s.trim()
            if (t.isEmpty()) return null
            return t.toDoubleOrNull() ?: throw Problem("$label must be a number")
        }
        val flowValue = number(flow, "Oxygen flow")
        val fio2Value = number(fio2, "FiO₂")
        val crt = number(capillaryRefill, "Capillary refill")
        val onLowFlow = device != null && device != ROOM_AIR && device != HIGH_FLOW
        val sentFlow = if (onLowFlow) flowValue else null
        val sentFio2 = if (device == HIGH_FLOW) fio2Value?.toInt() else null
        if (sentFlow != null && sentFlow !in FLOW_RANGE) throw Problem("Oxygen flow must be 0–80 L/min")
        if (sentFio2 != null && sentFio2 !in FIO2_RANGE) throw Problem("FiO₂ must be 21–100%")
        if (crt != null && crt !in CAPILLARY_REFILL_RANGE) throw Problem("Capillary refill must be 0–20 seconds")
        return Inputs(consciousness, device, sentFlow, sentFio2, crt, distress)
    }

    /** The `ews` the server returns with a charted reading. */
    @Serializable
    data class Score(
        val tool: String,
        val total: Int,
        val band: String,
        val incomplete: Boolean,
        val missing: List<String> = emptyList(),
        val next_due_at: String,
        val escalation_id: String? = null,
    )

    val TOOL_LABELS = mapOf("news2" to "NEWS2", "pews" to "PEWS", "meows" to "MEOWS")
    val BAND_LABELS = mapOf("routine" to "Routine", "low" to "Low", "low_medium" to "Low–medium", "urgent" to "Urgent", "emergency" to "Emergency")
    val PARAM_LABELS = mapOf(
        "respiratory_rate" to "Respiratory rate", "spo2" to "SpO₂", "air_or_oxygen" to "Air or oxygen",
        "oxygen" to "Oxygen", "systolic_bp" to "Systolic BP", "diastolic_bp" to "Diastolic BP",
        "pulse" to "Heart rate", "consciousness" to "Consciousness", "temperature" to "Temperature",
        "respiratory_distress" to "Respiratory distress", "capillary_refill" to "Capillary refill",
        "age" to "Date of birth",
    )

    fun toolLabel(tool: String) = TOOL_LABELS[tool] ?: tool.uppercase()
    fun bandLabel(band: String) = BAND_LABELS[band] ?: band

    /** Unknown bands read as danger: a band this build does not know is never calm. */
    fun bandTone(band: String): Tone = when (band) {
        "routine" -> Tone.Success
        "low" -> Tone.Neutral
        "low_medium", "urgent" -> Tone.Warning
        else -> Tone.Danger
    }

    /** "6", or "3+" for an incomplete set — the score can only rise. */
    fun totalText(total: Int, incomplete: Boolean) = if (incomplete) "$total+" else "$total"

    /** "NEWS2 6 · Urgent". */
    fun headline(s: Score) = "${toolLabel(s.tool)} ${totalText(s.total, s.incomplete)} · ${bandLabel(s.band)}"

    fun missingText(missing: List<String>) = missing.joinToString(", ") { PARAM_LABELS[it] ?: it }
}
