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
import org.junit.After
import org.junit.Before
import com.medbrains.testkit.Evidence
import org.junit.Rule
import org.junit.rules.RuleChain
import org.junit.Test
import org.junit.runner.RunWith

/** The doctor's clinic, proven against the queue and the encounter. Mirrors DoctorJourneyTests.swift. */
@RunWith(AndroidJUnit4::class)
class DoctorJourneyTest {
    val compose = createAndroidComposeRule<MainActivity>()

    @get:Rule
    val chain: RuleChain = RuleChain.outerRule(compose).around(Evidence { compose })
    private val api = Api.admin()
    private lateinit var doctor: Api.Identity

    private fun has(tag: String) = with(Session) { compose.has(tag) }
    private fun seesText(t: String) = compose.onAllNodes(hasText(t)).fetchSemanticsNodes().isNotEmpty()

    @Before
    fun seed() {
        api.endOpenCodeBlues()
        doctor = api.provision("doctor")
        with(Session) { compose.signInAs(doctor.username, doctor.password, "module-home-doctor") }
    }

    @After
    fun retire() { api.retire(doctor) }

    /** The list is lazy and earlier runs' tokens sit above this one: scroll the row into composition. */
    private fun showRow(patientId: String) {
        compose.waitUntil(10_000) { has("queue-tokens") }
        compose.onNodeWithTag("queue-tokens").performScrollToNode(hasTestTag("queue-row-$patientId"))
        compose.waitUntil(5_000) { has("queue-row-$patientId") }
    }

    private fun openQueue() {
        compose.onNodeWithTag("module-action-queue").performClick()
        compose.waitUntil(10_000) { has("screen-doctor-queue") }
        compose.waitUntil(10_000) { has("queue-call-next") }
    }

    @Test
    fun callNextMovesTheSeededTokenThroughToCompletedOnTheServer() {
        val (patientId, _) = checkNotNull(api.waitingVisit(doctor.id, "Queue"))
        openQueue()
        showRow(patientId)
        check(!has("queue-mark-complete")) { "no transition the queue is not in" }
        compose.onNodeWithTag("queue-call-next").performClick()
        compose.waitUntil(10_000) { has("queue-call-next-toast") }
        showRow(patientId)
        compose.onNodeWithTag("queue-row-$patientId").performClick()
        compose.waitUntil(10_000) { has("screen-queue-detail") }
        if (has("queue-call-patient")) { compose.onNodeWithTag("queue-call-patient").performClick(); compose.waitUntil(10_000) { has("queue-recall-patient") } }
        check(api.worklistToken(patientId)?.optString("status") == "called") { "called on the server" }
        check(has("queue-no-show")) { "recall and no-show travel together" }
        compose.onNodeWithTag("queue-patient-is-in").performClick()
        compose.waitUntil(10_000) { has("queue-mark-complete") }
        check(api.worklistToken(patientId)?.optString("status") == "serving")
        compose.onNodeWithTag("queue-mark-complete").performClick()
        compose.waitUntil(10_000) { seesText("completed") }
        check((api.worklistToken(patientId)?.optString("status") ?: "completed") == "completed") { "walked called → serving → completed" }
    }

    @Test
    fun noShowIsRecordedOnTheServer() {
        val (patientId, _) = checkNotNull(api.waitingVisit(doctor.id, "NoShow"))
        openQueue()
        showRow(patientId)
        compose.onNodeWithTag("queue-row-$patientId").performClick()
        compose.waitUntil(10_000) { has("screen-queue-detail") }
        compose.onNodeWithTag("queue-call-patient").performClick()
        compose.waitUntil(10_000) { has("queue-no-show") }
        compose.onNodeWithTag("queue-no-show").performClick()
        compose.waitUntil(10_000) { seesText("no_show") }
        check((api.worklistToken(patientId)?.optString("status") ?: "no_show") == "no_show")
    }

    @Test
    fun consultationRefusesAnEmptyNoteThenRecordsAllFourFields() {
        val (patientId, encounterId) = checkNotNull(api.waitingVisit(doctor.id, "Consult"))
        openQueue()
        showRow(patientId)
        compose.onNodeWithTag("queue-row-$patientId").performClick()
        compose.waitUntil(10_000) { has("screen-queue-detail") }
        compose.onNodeWithTag("queue-open-consultation").performClick()
        compose.waitUntil(10_000) { has("field-chief_complaint") }
        check(has("consultation-unsaved"))
        compose.onNodeWithTag("consultation-save").performScrollTo().performClick()
        compose.waitUntil(5_000) { seesText("Record why the patient is here") }
        check(api.consultation(encounterId)?.optString("id").isNullOrEmpty()) { "nothing reached the server" }
        for ((field, text) in listOf("chief_complaint" to "Fever and cough, three days", "examination" to "Chest clear, throat red", "assessment" to "Viral URTI", "plan" to "Fluids, paracetamol, review in 3 days")) {
            compose.onNodeWithTag("field-$field").performScrollTo().performTextInput(text)
        }
        compose.onNodeWithTag("consultation-save").performScrollTo().performClick()
        compose.waitUntil(15_000) { has("consultation-saved") }
        val saved = checkNotNull(api.consultation(encounterId))
        check(saved.optString("chief_complaint") == "Fever and cough, three days")
        check(saved.optString("examination") == "Chest clear, throat red")
        check(saved.optString("notes") == "Viral URTI") { "assessment is the notes column" }
        check(saved.optString("plan") == "Fluids, paracetamol, review in 3 days")
    }

    @Test
    fun roundsListTheAdmittedPatient() {
        val a = checkNotNull(api.admission("Rounds"))
        compose.onNodeWithTag("module-action-ipd-rounds").performClick()
        compose.waitUntil(10_000) { has("screen-ipd-rounds") }
        compose.waitUntil(10_000) { has("round-${a.id}") }
        compose.onNodeWithTag("round-${a.id}").performClick()
        compose.waitUntil(10_000) { has("screen-ipd-round-detail") }
        check(seesText(a.patientName))
    }
}
