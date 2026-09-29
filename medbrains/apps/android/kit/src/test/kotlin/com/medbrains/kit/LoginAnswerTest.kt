package com.medbrains.kit

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * A username shared by two hospitals is answered with a question, never a
 * session; the app must read the question, not fail to decode a session.
 */
class LoginAnswerTest {
    private val json = Json { ignoreUnknownKeys = true; explicitNulls = false }
    private fun read(text: String) = readLoginAnswer(json, json.decodeFromString<JsonObject>(text))

    @Test
    fun theServerAskingForTheHospitalIsNotASession() {
        assertEquals(LoginAnswer.HospitalRequired, read("""{"hospital_required":true}"""))
    }

    @Test
    fun aSessionIsStillASession() {
        val answer = read("""{"token":"t","user":{"id":"u","tenant_id":"h","username":"n","full_name":"N"},"permissions":[]}""")
        assertTrue(answer is LoginAnswer.SignedIn)
        assertEquals("h", (answer as LoginAnswer.SignedIn).session.user.tenant_id)
    }

    @Test
    fun theHospitalCodeIsSentOnlyWhenNamed() {
        assertTrue(json.encodeToString(LoginRequest("n", "p", "AMH")).contains("\"hospital_code\":\"AMH\""))
        assertFalse(json.encodeToString(LoginRequest("n", "p")).contains("hospital_code"))
    }
}
