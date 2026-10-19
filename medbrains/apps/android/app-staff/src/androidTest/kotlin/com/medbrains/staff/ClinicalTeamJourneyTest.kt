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
    val compose = createAndroidComposeRule<MainActivity>()

    @get:Rule
    val chain: RuleChain = RuleChain.outerRule(compose).around(Evidence { compose })
    private val api = Api.admin()
    private lateinit var doctor: Api.Identity
    private lateinit var patientId: String
    private val seededRequest: String? = InstrumentationRegistry.getArguments().getString("uhiRequestId")

    private fun has(tag: String) = with(Session) { compose.has(tag) }
    private fun seesText(t: String) = compose.onAllNodes(hasText(t, substring = true)).fetchSemanticsNodes().isNotEmpty()
    private fun back() = compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }

    @Before
    fun seed() {
        api.endOpenCodeBlues()
        // A doctor who also answers blood requests from patients' apps.
        doctor = api.provision("doctor", listOf("uhi.requests.view", "uhi.requests.respond", "blood_bank.inventory.manage"))
        patientId = checkNotNull(api.waitingVisit(doctor.id, "Journey")).first
        with(Session) { compose.signInAs(doctor.username, doctor.password, "module-home-doctor") }
    }

    @After
    fun retire() { api.retire(doctor) }

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
        val doctorApi = Api.signIn(doctor.username, doctor.password)
        val noteId = checkNotNull(doctorApi.myNotes().firstOrNull { it.optString("body") == text }?.optString("id")) { "the note was saved on the server" }
        val dept = checkNotNull(api.firstDepartment())
        val deptId = dept.optString("id")
        compose.onNodeWithTag("note-share-$noteId").performScrollTo().performClick()
        compose.waitUntil(10_000) { has("share-search") }
        compose.onNodeWithTag("share-search").performTextInput(dept.optString("name"))
        compose.waitUntil(10_000) { has("share-dept-$deptId") }
        compose.onNodeWithTag("share-dept-$deptId").performScrollTo().performClick()
        compose.onNodeWithTag("share-save").performScrollTo().performClick()
        compose.waitUntil(10_000) { !has("share-save") }
        val shares = doctorApi.myNotes().firstOrNull { it.optString("id") == noteId }?.optJSONArray("shares")
        check(shares?.optJSONObject(0)?.optString("department_id") == deptId) { "shared with the board on the server" }

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
