package com.medbrains.staff

import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.medbrains.testkit.Evidence
import org.json.JSONObject
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.RuleChain
import org.junit.runner.RunWith

/**
 * A guard's visiting hours, in one sign-in: passes at the gate, who is
 * inside, an incident on the round, a tag alert. Every screen is left and
 * come back to, and must still hold what it held. Plan:
 * docs/native/UI-PLANS-PLACEHOLDER-MODULES.md §1; mirrors SecurityJourneyTests.swift.
 */
@RunWith(AndroidJUnit4::class)
class SecurityJourneyTest {
    val compose = createAndroidComposeRule<MainActivity>()

    @get:Rule
    val chain: RuleChain = RuleChain.outerRule(compose).around(Evidence { compose })

    private val api = Api.admin()
    private lateinit var guard: Api.Identity

    private fun has(tag: String) = with(Session) { compose.has(tag) }
    private fun seesText(t: String) = compose.onAllNodes(hasText(t, substring = true)).fetchSemanticsNodes().isNotEmpty()
    private fun tap(tag: String) = compose.onNodeWithTag(tag).performScrollTo().performClick()
    /** A control in a lazy list or a bar: clicked where it is. */
    private fun click(tag: String) = compose.onNodeWithTag(tag).performClick()
    private fun type(tag: String, text: String) = compose.onNodeWithTag(tag).performScrollTo().performTextInput(text)
    private fun back() = compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
    private fun gone(tag: String, ms: Long = 15_000) = compose.waitUntil(ms) { !has(tag) }

    /** Bring a lazy row into the tree, then wait for it. */
    private fun reveal(list: String, row: String) {
        compose.waitUntil(15_000) { has(list) }
        compose.onNodeWithTag(list).performScrollToNode(hasTestTag(row))
        compose.waitUntil(5_000) { has(row) }
    }

    private fun scan(code: String) {
        type("barcode-manual", code)
        tap("barcode-manual-submit")
        compose.waitUntil(15_000) { has("security-verdict-band") }
    }

    private fun openLog(passId: String) = api.visitorLogs().firstOrNull { it.optString("pass_id") == passId && it.isNull("check_out_at") }

    @Before
    fun seed() {
        guard = api.provision("security_guard")
        with(Session) { compose.signInAs(guard.username, guard.password, "screen-security") }
    }

    @After
    fun retire() { api.retire(guard) }

    @Test
    fun aGuardWorksVisitingHours() {
        val good = api.pass(api.visitor("Gate").getString("id"))
        val bad = api.pass(api.visitor("Barred").getString("id"))
        val goodId = good.getString("id")
        api.revokePass(bad.getString("id"), "Banned by ward ${Api.RUN}")
        val seededIncident = api.securityIncident("Seeded round ${Api.RUN}").getString("id")
        val alertId = checkNotNull(api.tagAlert()) { "seeded a tag alert" }

        // 1–2. The gate: a good pass lets in, and entry is recorded on the server.
        scan(good.getString("pass_number"))
        check(seesText("Let in")) { "the band says let in" }
        compose.waitUntil(10_000) { has("security-record-entry") }
        tap("security-record-entry")
        compose.waitUntil(15_000) { has("security-recorded") }
        checkNotNull(openLog(goodId)) { "the entry is on the server" }
        tap("security-scan-next")

        // 3. A revoked pass is refused in words, and offers nothing to record.
        scan(bad.getString("pass_number"))
        check(seesText("Do not let in — Revoked")) { "the band names why" }
        check(seesText("Banned by ward ${Api.RUN}")) { "with the desk's reason" }
        check(!has("security-record-entry")) { "no way to let a revoked pass in" }
        tap("security-scan-next")

        // 4. Inside now lists the visitor; opening the row and closing it changes nothing.
        click("security-desk-inside")
        reveal("security-inside-rows", "security-inside-$goodId")
        click("security-inside-$goodId")
        compose.waitUntil(15_000) { has("security-record-exit") }
        tap("security-scan-next")
        reveal("security-inside-rows", "security-inside-$goodId")

        // 5. A report abandoned with Back is discarded: nothing reaches the server.
        click("security-desk-incidents")
        reveal("security-incident-rows", "security-incident-$seededIncident")
        click("security-incident-report")
        compose.waitUntil(10_000) { has("screen-security-report") }
        val abandoned = "Abandoned report ${Api.RUN}"
        type("field-incident-description", abandoned)
        back()
        reveal("security-incident-rows", "security-incident-$seededIncident")
        check(api.securityIncidents().none { it.optString("description") == abandoned }) { "nothing was saved" }

        // 6. Reported for real, it is on the server and on the list.
        click("security-incident-report")
        compose.waitUntil(10_000) { has("screen-security-report") }
        with(Session) { compose.choose("picker-incident-category", "theft", "Theft") }
        val reported = "Bag left at gate 2 ${Api.RUN}"
        type("field-incident-description", reported)
        type("field-incident-location", "Gate 2")
        tap("security-incident-submit")
        compose.waitUntil(15_000) { has("screen-security") }
        val newId = checkNotNull(api.securityIncidents().firstOrNull { it.optString("description") == reported }) { "the report is on the server" }.getString("id")
        reveal("security-incident-rows", "security-incident-$newId")

        // 7. An update on the new incident, then back.
        click("security-incident-$newId")
        compose.waitUntil(10_000) { has("screen-security-incident") }
        val update = "Owner found, bag returned ${Api.RUN}"
        type("field-incident-update", update)
        tap("security-incident-add-update")
        compose.waitUntil(15_000) { seesText(update) }
        check(api.list("/api/security/incidents/$newId/updates").any { it.optString("description") == update }) { "the update is on the server" }
        back()

        // 8. Away to another desk and back: the register still holds both incidents.
        click("security-desk-gate")
        compose.waitUntil(10_000) { has("barcode-manual") }
        click("security-desk-incidents")
        reveal("security-incident-rows", "security-incident-$newId")

        // 9. The Code Pink banner leads to the alert; resolving it is recorded with the reason.
        compose.waitUntil(20_000) { has("security-code-pink-banner") }
        click("security-code-pink-banner")
        compose.waitUntil(10_000) { has("screen-security-tag-alerts") }
        reveal("security-tag-alert-rows", "security-tag-alert-resolve-$alertId")
        click("security-tag-alert-resolve-$alertId")
        type("field-tag-alert-notes", "Patient back on the ward ${Api.RUN}")
        tap("security-tag-alert-resolve-submit")
        gone("security-tag-alert-$alertId")
        check(api.list("/api/security/tag-alerts?is_resolved=true").any { it.optString("id") == alertId }) { "resolved on the server" }
        back()

        // 10. Exit recorded from Inside now; the row leaves.
        compose.waitUntil(10_000) { has("screen-security") }
        click("security-desk-inside")
        reveal("security-inside-rows", "security-inside-$goodId")
        click("security-inside-$goodId")
        compose.waitUntil(15_000) { has("security-record-exit") }
        tap("security-record-exit")
        compose.waitUntil(15_000) { has("security-recorded") }
        check(openLog(goodId) == null) { "the exit is on the server" }
        tap("security-scan-next")
        gone("security-inside-$goodId")

        // 11. Sign out.
        with(Session) { compose.ensureSignedOut() }
    }
}

private fun Api.securityIncident(description: String): JSONObject = obj("POST", "/api/security/incidents", JSONObject()
    .put("category", "trespass").put("severity", "low").put("description", description).put("location_description", "Main gate"))

private fun Api.securityIncidents(): List<JSONObject> = list("/api/security/incidents")

/**
 * A wander-guard tag on a seeded patient, walked out of its zone: an open
 * alert without starting a Code Pink that would flash every device.
 */
private fun Api.tagAlert(): String? {
    val patientId = patient("Tagged").optString("id").ifEmpty { return null }
    val tag = "E2E-TAG-${Api.RUN}"
    call("POST", "/api/security/patient-tags", JSONObject().put("patient_id", patientId).put("tag_type", "wander_guard").put("tag_identifier", tag))
    val event = obj("POST", "/api/security/tag-events", JSONObject().put("tag_identifier", tag).put("event_type", "exit_zone").put("location_description", "Gate 2"))
    return event.optJSONObject("alert")?.optString("id")?.ifEmpty { null }
}
