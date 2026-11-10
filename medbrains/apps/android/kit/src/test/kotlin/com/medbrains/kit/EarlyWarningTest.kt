package com.medbrains.kit

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** The phone sends what the web and iOS send, and reads the score the same way. */
class EarlyWarningTest {
    // As ApiClient encodes and decodes.
    private val json = Json { explicitNulls = false; ignoreUnknownKeys = true }

    @Test fun inputsAreSentInTheServersShape() {
        val i = EarlyWarning.inputs("C", "nasal_prongs", "1.5", "40", "2.5", "mild")
        assertEquals(
            """{"consciousness":"C","oxygen_device":"nasal_prongs","oxygen_flow_lpm":1.5,"capillary_refill_seconds":2.5,"respiratory_distress":"mild"}""",
            json.encodeToString(EarlyWarning.Inputs.serializer(), i),
        )
        val hf = EarlyWarning.inputs(null, "high_flow", "20", "35", "", null)
        assertEquals("""{"oxygen_device":"high_flow","fio2_percent":35}""", json.encodeToString(EarlyWarning.Inputs.serializer(), hf))
        assertEquals("{}", json.encodeToString(EarlyWarning.Inputs.serializer(), EarlyWarning.inputs(null, null, "", "", "", null)))
    }

    @Test fun outOfRangeValuesAreRefused() {
        val p = runCatching { EarlyWarning.inputs(null, "high_flow", "", "15", "", null) }.exceptionOrNull()
        assertEquals("FiO₂ must be 21–100%", p?.message)
        assertEquals("Capillary refill must be a number", runCatching { EarlyWarning.inputs(null, null, "", "", "abc", null) }.exceptionOrNull()?.message)
    }

    @Test fun theScoreReadsInWords() {
        val s = json.decodeFromString(
            EarlyWarning.Score.serializer(),
            """{"tool":"news2","total":3,"band":"low_medium","incomplete":true,"missing":["consciousness","spo2"],"params":[],"spo2_scale":1,"age_band":null,"next_due_at":"2026-10-26T10:00:00Z","escalation_id":null}""",
        )
        assertEquals("NEWS2 3+ · Low–medium", EarlyWarning.headline(s))
        assertEquals("Consciousness, SpO₂", EarlyWarning.missingText(s.missing))
        assertNull(s.escalation_id)
        assertEquals("6", EarlyWarning.totalText(6, false))
        assertEquals(Tone.Danger, EarlyWarning.bandTone("emergency"))
        assertEquals(Tone.Danger, EarlyWarning.bandTone("something_new"))
    }
}
