package com.medbrains.kit

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Signing asks for the password again. The app must recognise the server's
 * question (and nothing else as it), and read the proof the server hands back.
 */
class StepUpTest {
    private val json = Json { ignoreUnknownKeys = true; explicitNulls = false }

    @Test
    fun theServersStepUpQuestionIsRecognised() {
        val error = readApiError(json, """{"error":"step_up_required","detail":"Re-authenticate to continue."}""", 403)
        assertTrue(error.isStepUpRequired)
        assertEquals("Re-authenticate to continue.", error.message)
    }

    @Test
    fun aPlainRefusalIsNotAStepUp() {
        assertFalse(readApiError(json, """{"error":"forbidden","detail":"No."}""", 403).isStepUpRequired)
        assertFalse(readApiError(json, "not json", 403).isStepUpRequired)
        assertEquals("HTTP 502", readApiError(json, "<html>", 502).message)
    }

    @Test
    fun theProofIsReadFromTheAnswer() {
        assertEquals("proof-1", readStepUpToken(json, """{"status":"ok","step_up_token":"proof-1"}"""))
    }
}
