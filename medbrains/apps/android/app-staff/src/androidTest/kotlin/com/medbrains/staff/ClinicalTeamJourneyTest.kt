package com.medbrains.staff

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import android.content.Intent
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextInput
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.medbrains.testkit.Evidence
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.RuleChain
import org.junit.runner.RunWith

/**
 * One long shift across the clinical and team modules, signed in once. Mirrors
 * ClinicalTeamJourneyTests.swift: a patient's records from other hospitals,
 * back to the patient, a note written and shared with the department board,
 * the UHI queue, then back across the shift with each screen still holding
 * what it held.
 *
 * The UHI accept needs a request a patient's app sent, which a device test
 * cannot forge: seed one with `scripts/seed_uhi_request.sh` and pass it as the
 * instrumentation argument `uhiRequestId`. Without it the journey still opens
 * the queue and proves it loads.
 */
@RunWith(AndroidJUnit4::class)
class ClinicalTeamJourneyTest {
    // Launched by hand so the app is pointed at the same server as the test's API (`baseUrl`).
    val compose = createEmptyComposeRule()
    private lateinit var scenario: ActivityScenario<MainActivity>

    @get:Rule
    val chain: RuleChain = RuleChain.outerRule(compose).around(Evidence { compose })
    private val api = Api.admin()
    private lateinit var doctor: Api.Identity
    private lateinit var patientId: String
    private val seededRequest: String? = InstrumentationRegistry.getArguments().getString("uhiRequestId")

    private fun has(tag: String) = with(Session) { compose.has(tag) }
    private fun seesText(t: String) = compose.onAllNodes(hasText(t, substring = true)).fetchSemanticsNodes().isNotEmpty()
    private fun hasTestTagPrefix(prefix: String) =
        SemanticsMatcher("test tag starts with $prefix") { it.config.getOrElseNullable(SemanticsProperties.TestTag) { null }?.startsWith(prefix) == true }
    private fun back() { scenario.onActivity { it.onBackPressedDispatcher.onBackPressed() } }

    @Before
    fun seed() {
        api.endOpenCodeBlues()
        // A doctor who also answers blood requests from patients' apps.
        doctor = api.provision("doctor", listOf("uhi.requests.view", "uhi.requests.respond", "blood_bank.inventory.manage"))
        patientId = checkNotNull(api.waitingVisit(doctor.id, "Journey")).first
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        scenario = ActivityScenario.launch(Intent(context, MainActivity::class.java).putExtra("baseUrl", Api.BACKEND))
        with(Session) { compose.signInAs(doctor.username, doctor.password, "module-home-doctor") }
    }

    @After
    fun retire() {
        scenario.close()
        api.retire(doctor)
    }

    /** A module in the bar, or behind More when the role has more than fit. */
    private fun openModule(id: String) {
        if (!has("module-$id")) {
            compose.onNodeWithTag("module-more").performClick()
            compose.waitUntil(5_000) { has("module-$id") }
        }
        compose.onNodeWithTag("module-$id").performClick()
    }

    @Test
    fun aShiftAcrossRecordsNotesAndTheUhiQueueKeepsEachScreensState() {
        // Patient → records from other hospitals.
        compose.onNodeWithTag("module-action-queue").performClick()
        compose.waitUntil(10_000) { has("queue-tokens") }
        compose.onNodeWithTag("queue-tokens").performScrollToNode(hasTestTag("queue-row-$patientId"))
        compose.onNodeWithTag("queue-row-$patientId").performClick()
        compose.waitUntil(10_000) { has("screen-queue-detail") }
        compose.onNodeWithTag("open-other-hospital-records").performScrollTo().performClick()
        compose.waitUntil(10_000) { has("abdm-requests-empty") || has("abdm-records-unavailable") }
        check(has("abdm-requests-empty")) { "a new patient has no request yet, said in words — not an outage" }
        check(!has("abdm-records-not-available")) { "the doctor may see this patient" }
        // Either the hospital can ask ABDM, or the screen says why it cannot — never neither.
        check(has("abdm-request-records") || has("abdm-blocked"))

        // Back to the patient: the token is where it was.
        back()
        compose.waitUntil(10_000) { has("screen-queue-detail") }
        check(has("queue-call-patient")) { "the token is still waiting" }

        // Notes: write one, share it with the department board.
        openModule("notes")
        compose.waitUntil(10_000) { has("notes-new") }
        compose.onNodeWithTag("notes-new").performClick()
        val text = "Linen short on ward 4 ${Api.RUN}"
        compose.onNodeWithTag("note-body").performTextInput(text)
        compose.onNodeWithTag("note-save").performClick()
        compose.waitUntil(10_000) { seesText(text) }
        // Read from the screen, not by signing in as the doctor through the API:
        // a second sign-in ends the app's session.
        // The text alone could still be the closing editor's field: wait for the saved card.
        compose.waitUntil(10_000) { !has("note-save") && compose.onAllNodes(hasTestTagPrefix("note-share-")).fetchSemanticsNodes().isNotEmpty() }
        val shareTag = compose.onAllNodes(hasTestTagPrefix("note-share-")).fetchSemanticsNodes().first().config[SemanticsProperties.TestTag]
        val dept = checkNotNull(api.firstDepartment())
        val deptId = dept.optString("id")
        compose.onNodeWithTag(shareTag).performScrollTo().performClick()
        compose.waitUntil(10_000) { has("share-search") }
        compose.onNodeWithTag("share-search").performTextInput(dept.optString("name"))
        compose.waitUntil(10_000) { has("share-dept-$deptId") }
        compose.onNodeWithTag("share-dept-$deptId").performScrollTo().performClick()
        compose.onNodeWithTag("share-save").performScrollTo().performClick()
        compose.waitUntil(10_000) { !has("share-save") }
        // The board is the server's answer: the note is on it only once the share is saved.
        compose.onNodeWithTag("notes-scope-boards").performClick()
        compose.waitUntil(10_000) { seesText(text) }

        // UHI queue: accept the seeded blood request, or prove the queue loads.
        openModule("uhi")
        compose.waitUntil(10_000) { has("uhi-requests-list") || has("uhi-requests-empty") || has("uhi-requests-unavailable") }
        val id = seededRequest
        if (id != null) {
            compose.waitUntil(10_000) { has("uhi-accept-$id") }
            compose.onNodeWithTag("uhi-accept-$id").performScrollTo().performClick()
            compose.waitUntil(10_000) { has("uhi-toast") }
            check(api.uhiRequest(id)?.optString("state") == "confirmed") { "confirmed on the server" }
        } else {
            check(!has("uhi-requests-unavailable")) { "the queue loads (seed a request to prove accept)" }
        }

        // Back across the shift: each module opens where its data still is.
        openModule("doctor")
        compose.waitUntil(10_000) { has("module-home-doctor") }
        openModule("notes")
        compose.waitUntil(10_000) { seesText(text) }
    }
}
