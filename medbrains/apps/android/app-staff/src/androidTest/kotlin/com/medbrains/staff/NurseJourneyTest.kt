package com.medbrains.staff

import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextClearance
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Before
import com.medbrains.testkit.Evidence
import org.junit.Rule
import org.junit.rules.RuleChain
import org.junit.Test
import org.junit.runner.RunWith

/** The nurse's shift, proven against the record. Mirrors NurseJourneyTests.swift. */
@RunWith(AndroidJUnit4::class)
class NurseJourneyTest {
    val compose = createAndroidComposeRule<MainActivity>()

    @get:Rule
    val chain: RuleChain = RuleChain.outerRule(compose).around(Evidence { compose })
    private val api = Api.admin()
    private lateinit var nurse: Api.Identity
    private lateinit var admission: Api.Admission

    private fun has(tag: String) = with(Session) { compose.has(tag) }
    private fun seesText(t: String, sub: Boolean = false) = compose.onAllNodes(hasText(t, substring = sub)).fetchSemanticsNodes().isNotEmpty()

    @Before
    fun seed() {
        api.endOpenCodeBlues()
        nurse = api.provision("nurse")
        admission = checkNotNull(api.admission("Ward")) { "an admitted patient in the nurse's department" }
        with(Session) { compose.signInAs(nurse.username, nurse.password, "module-home-nurse") }
    }

    @After
    fun retire() { api.endOpenCodeBlues(); api.retire(nurse) }

    private fun openWorkspace() {
        compose.onNodeWithTag("module-action-mar").performClick()
        compose.waitUntil(10_000) { has("screen-admissions") }
        compose.waitUntil(10_000) { has("admission-${admission.id}") }
        check(seesText(admission.patientName)) { "by name" }
        compose.onNodeWithTag("admission-${admission.id}").performClick()
        compose.waitUntil(10_000) { has("screen-patient-workspace") }
    }

    @Test
    fun callBoardSeenKeepsTheCallAndDoneClearsItOnTheServer() {
        val note = "Pain 7/10 after physio ${Api.RUN}"
        val callId = checkNotNull(api.nurseCall(admission, note))
        compose.onNodeWithTag("module-action-calls").performClick()
        compose.waitUntil(10_000) { has("screen-nurse-calls") }
        compose.waitUntil(10_000) { seesText(note) }
        check(seesText("Pain")) { "the request type in words" }
        compose.onNodeWithTag("nurse-call-seen-$callId").performScrollTo().performClick()
        compose.waitUntil(10_000) { seesText("seen", sub = true) }
        var row = api.nurseRequests(admission.id).firstOrNull { it.optString("id") == callId }
        check(row?.optString("acknowledged_at").orEmpty().isNotEmpty()) { "Seen wrote acknowledged_at" }
        check(row?.optString("status") == "acknowledged")
        compose.onNodeWithTag("nurse-call-done-$callId").performScrollTo().performClick()
        compose.waitUntil(10_000) { !seesText(note) }
        row = api.nurseRequests(admission.id).firstOrNull { it.optString("id") == callId }
        check(row?.optString("status") == "completed") { "Done completed it on the server" }
    }

    @Test
    fun marShowsSeededDosesAndAMismatchedScanIsRefusedByTheServer() {
        val plain = checkNotNull(api.marDose(admission.id, "Paracetamol ${Api.RUN}", false, -10))
        api.marDose(admission.id, "Insulin ${Api.RUN}", true, 30)
        openWorkspace()
        compose.onNodeWithTag("workspace-mar").performClick()
        compose.waitUntil(10_000) { has("screen-mar") }
        compose.waitUntil(10_000) { seesText("Paracetamol ${Api.RUN}") }
        check(seesText("Insulin ${Api.RUN}")); check(seesText("high alert")) { "marked in words" }
        compose.onAllNodes(hasTestTag("mar-take-to-bedside"))[0].performClick()
        compose.waitUntil(10_000) { has("screen-administer-dose") }
        check(!has("bcma-give-now")) { "no give before the server has verified" }
        compose.waitUntil(5_000) { has("barcode-manual") }
        compose.onNodeWithTag("barcode-manual").performTextInput(admission.uhid)
        compose.onNodeWithTag("barcode-manual-submit").performClick()
        compose.waitUntil(5_000) { has("barcode-manual") }
        compose.onNodeWithTag("barcode-manual").performTextInput("NOT-A-BATCH")
        compose.onNodeWithTag("barcode-manual-submit").performClick()
        compose.waitUntil(15_000) { has("bcma-refused") }
        check(seesText("Wristband matched. Drug did not match.")) { "both rights named" }
        check(!has("bcma-give-now")) { "and no give anyway" }
        check(api.mar(admission.id).first { it.optString("id") == plain }.optString("status") == "scheduled") { "nothing was recorded" }
    }

    @Test
    fun holdingADoseNeedsATypedReasonThatReachesTheRecord() {
        val dose = checkNotNull(api.marDose(admission.id, "Metformin ${Api.RUN}", false, 0))
        openWorkspace()
        compose.onNodeWithTag("workspace-mar").performClick()
        compose.waitUntil(10_000) { has("mar-take-to-bedside") }
        compose.onAllNodes(hasTestTag("mar-take-to-bedside"))[0].performClick()
        compose.waitUntil(10_000) { has("screen-administer-dose") }
        compose.onNodeWithTag("dose-hold").performScrollTo().performClick()
        compose.waitUntil(5_000) { seesText("Why was it held?") }
        compose.onNodeWithTag("dose-reason").performScrollTo().performTextInput("NBM before theatre")
        compose.onNodeWithTag("dose-save").performScrollTo().performClick()
        compose.waitUntil(15_000) { has("screen-mar") }
        val row = api.mar(admission.id).first { it.optString("id") == dose }
        check(row.optString("status") == "held"); check(row.optString("hold_reason") == "NBM before theatre") { "the reason the nurse typed" }
    }

    @Test
    fun vitalsOutOfRangeAreRefusedOnTheFieldAndInRangeAreRecorded() {
        openWorkspace()
        compose.onNodeWithTag("workspace-vitals").performClick()
        compose.waitUntil(10_000) { has("screen-bedside-vitals") }
        compose.onNodeWithTag("field-pulse").performScrollTo().performTextInput("999")
        compose.onNodeWithTag("bedside-save").performScrollTo().performClick()
        compose.waitUntil(5_000) { seesText("Pulse must be 0-300") }
        compose.onNodeWithTag("field-pulse").performScrollTo().performTextClearance()
        compose.onNodeWithTag("field-pulse").performTextInput("76")
        compose.onNodeWithTag("field-spo2").performScrollTo().performTextInput("97")
        compose.onNodeWithTag("bedside-save").performScrollTo().performClick()
        compose.waitUntil(15_000) { seesText("Saved to bedside chart.") }
    }

    @Test
    fun codeBlueListsTheArrestAndRespondingIsAnArrivalOnTheServer() {
        val arrest = checkNotNull(api.codeBlue(admission, "Ward 3 bed 4 ${Api.RUN}"))
        try {
            compose.waitUntil(15_000) { has("emergency-flash") }
            check(seesText("CODE BLUE")) { "the word, beside the colour" }
            compose.onNodeWithTag("emergency-flash-silence").performClick()
            compose.waitUntil(5_000) { !has("emergency-flash") }
            check(api.responders().none { it.optString("code_blue_id") == arrest }) { "silencing is not responding" }
            compose.onNodeWithTag("module-action-code-blue").performClick()
            compose.waitUntil(10_000) { has("screen-code-blue") }
            compose.waitUntil(10_000) { seesText("Ward 3 bed 4 ${Api.RUN}") }
            compose.waitUntil(5_000) { has("code-blue-nobody-$arrest") }
            compose.onAllNodes(hasTestTag("code-blue-respond"))[0].performClick()
            compose.waitUntil(10_000) { seesText("You are responding") }
            check(api.responders().count { it.optString("code_blue_id") == arrest && it.optString("user_id") == nurse.id } == 1) { "an arrival on the server" }
        } finally { api.endCodeBlue(arrest) }
    }

    @Test
    fun transfusionChartOwesTheFifteenMinuteCheck() {
        val witness = api.provision("nurse")
        try {
            checkNotNull(api.transfusion(admission, witness.id)) { "a unit hung on the bed" }
            openWorkspace()
            compose.onNodeWithTag("workspace-transfusions").performClick()
            compose.waitUntil(10_000) { has("screen-transfusions") }
            compose.waitUntil(10_000) { seesText("BAG BAG-${Api.RUN}") }
            check(seesText("15 minutes in")); check(seesText("running"))
        } finally { api.retire(witness) }
    }
}
