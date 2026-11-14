package com.medbrains.kit

import io.sentry.Breadcrumb
import io.sentry.JsonSerializer
import io.sentry.SentryEvent
import io.sentry.SentryOptions
import io.sentry.protocol.Request
import io.sentry.protocol.User
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test
import java.io.IOException
import java.io.StringWriter

/** Error tracking stays off unless the server says on, and no patient data leaves the phone. */
class ErrorTrackingTest {
    private val base = "https://hospital.example"
    private val on = ErrorTrackingConfig(
        enabled = true,
        dsn = "http://key@127.0.0.1:8000/3",
        environment = "production",
        tunnel_dsn_path = "/api/public/error-tracking/android/1",
    )

    @Test
    fun offWhenTheServerSaysOffOrLeavesOutTheDsnOrPath() {
        assertNull(tunnelDsn(base, on.copy(enabled = false)))
        assertNull(tunnelDsn(base, on.copy(dsn = null)))
        assertNull(tunnelDsn(base, on.copy(tunnel_dsn_path = null)))
        assertNull(tunnelDsn(base, null))
    }

    @Test
    fun aFailedFetchIsOffNotACrash() = runBlocking {
        assertNull(loadTunnelTarget(base) { throw IOException("unreachable") })
        assertNull(loadTunnelTarget(base) { ErrorTrackingConfig() })
    }

    @Test
    fun theDsnPointsAtTheHospitalServerNeverTheRealHost() = runBlocking {
        val target = loadTunnelTarget(base) { on }
        assertEquals("https://medbrains@hospital.example/api/public/error-tracking/android/1", target?.dsn)
        assertEquals("production", target?.environment)
        assertEquals(
            "http://medbrains@10.0.2.2:3000/api/public/error-tracking/android/1",
            tunnelDsn("http://10.0.2.2:3000/", on)
        )
        assertEquals(
            "https://medbrains@h.example:8443/hms/api/public/error-tracking/android/1",
            tunnelDsn("https://h.example:8443/hms", on)
        )
    }

    @Test
    fun urlsLoseQueriesAndRecordIds() {
        assertEquals(
            "https://h.example/api/patients/:id/visits/:id",
            scrubUrl("https://h.example/api/patients/MB-2026-000123/visits/0f8fad5b-d9cb-469f-a165-70867728950e?q=9876543210#x")
        )
        assertEquals("/api/opd/queue", scrubUrl("/api/opd/queue?name=Ravi"))
    }

    @Test
    fun noPatientNameUhidOrPhoneSurvivesTheScrub() {
        val event = SentryEvent().apply {
            breadcrumbs = listOf(
                Breadcrumb("Ravi Kumar MB-2026-000123").apply { category = "console" },
                Breadcrumb("typed 9876543210").apply { category = "ui.input" },
                Breadcrumb("Button text=Ravi Kumar").apply { category = "ui.click" },
                Breadcrumb().apply {
                    category = "http"
                    setData("url", "https://h.example/api/patients/MB-2026-000123?phone=9876543210")
                    setData("method", "GET")
                    setData("body", "Ravi Kumar")
                },
            )
            request = Request().apply {
                method = "POST"
                url = "https://h.example/api/patients/MB-2026-000123?name=Ravi+Kumar"
                queryString = "phone=9876543210"
                data = mapOf("name" to "Ravi Kumar")
                headers = mapOf("Authorization" to "Bearer t")
            }
            user = User().apply {
                id = hashUserId("user-1")
                username = "Ravi Kumar"
                email = "ravi@example.com"
                ipAddress = "10.1.2.3"
            }
            setExtra("patient", "Ravi Kumar MB-2026-000123 9876543210")
            serverName = "ravis-phone"
        }
        event.breadcrumbs = event.breadcrumbs?.mapNotNull(::scrubBreadcrumb)
        val out = StringWriter().also { JsonSerializer(SentryOptions()).serialize(scrubEvent(event), it) }.toString()
        for (leak in listOf("Ravi", "MB-2026-000123", "9876543210", "ravi@", "10.1.2.3", "Bearer", "ravis-phone")) {
            assertFalse("$leak survived: $out", out.contains(leak))
        }
        assertEquals(2, event.breadcrumbs?.size)
        assertEquals(hashUserId("user-1"), event.user?.id)
    }

    @Test
    fun theUserHashMatchesTheWebAndServer() {
        // sha256("user-1"), first 32 hex chars.
        assertEquals("c6c289e49e9c05b2145860387b73bcb1", hashUserId("user-1"))
        assertEquals(32, hashUserId("x").length)
    }
}
