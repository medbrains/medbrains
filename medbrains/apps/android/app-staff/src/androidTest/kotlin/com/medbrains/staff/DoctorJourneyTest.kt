package com.medbrains.staff

import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextEquals
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
import org.json.JSONArray
import org.json.JSONObject

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

    /**
     * Given a waiting patient, When the doctor saves an empty note it is
     * refused on the field; written, it saves as a draft on the case sheet,
     * and signed it is the record — under the doctor's name, reopening as
     * signed with a Revise inside the grace.
     */
    @Test
    fun aConsultationNoteIsDraftedThenSignedOnTheCaseSheet() {
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
        check(api.notes(encounterId).isEmpty()) { "nothing reached the server" }
        for ((field, text) in listOf("chief_complaint" to "Fever and cough, three days", "examination" to "Chest clear, throat red", "assessment" to "Viral URTI", "plan" to "Fluids, paracetamol, review in 3 days")) {
            compose.onNodeWithTag("field-$field").performScrollTo().performTextInput(text)
        }
        compose.onNodeWithTag("consultation-save").performScrollTo().performClick()
        compose.waitUntil(15_000) { has("consultation-draft-saved") }
        val draft = api.notes(encounterId).first()
        check(draft.optString("status") == "draft")
        check(api.section(draft, "subjective") == "<p>Fever and cough, three days</p>") { "the web reads it as written" }
        check(api.section(draft, "assessment") == "<p>Viral URTI</p>")

        compose.onNodeWithTag("consultation-sign").performScrollTo().performClick()
        compose.waitUntil(15_000) { has("note-status-signed") }
        val signed = api.notes(encounterId).first()
        check(signed.optString("status") == "signed")
        check(signed.optString("author_id") == doctor.id) { "under the doctor's own name" }
        check(has("consultation-revise")) { "revisable inside the grace" }
        check(!has("field-chief_complaint")) { "a signed note is not a form to write over" }
    }

    /**
     * Given a draft the doctor began on the web with a system note in its
     * examination, When they pick the patient's left knee on the body map and
     * describe it, Then the finding is saved as "Left knee" with its side,
     * beside the web's note.
     */
    @Test
    fun aFindingIsPickedOnTheBodyMapAndKeptBesideTheSystemNotes() {
        val (patientId, encounterId) = checkNotNull(api.waitingVisit(doctor.id, "Knee"))
        val asDoctor = Api.signIn(doctor.username, doctor.password)
        val (status, _) = asDoctor.call("POST", "/api/encounters/$encounterId/clinical-notes", JSONObject()
            .put("note_type_code", "consultation")
            .put("sections", JSONArray()
                .put(JSONObject().put("code", "subjective").put("text", "<p>Knee pain</p>"))
                .put(JSONObject().put("code", "examination").put("data", JSONObject().put("exam", JSONObject().put("musculoskeletal", "Antalgic gait"))))))
        check(status == 200) { "the web's draft to keep" }
        openQueue()
        showRow(patientId)
        compose.onNodeWithTag("queue-row-$patientId").performClick()
        compose.waitUntil(10_000) { has("screen-queue-detail") }
        compose.onNodeWithTag("queue-open-consultation").performClick()
        compose.waitUntil(10_000) { has("consultation-saved") }
        check(seesText("Knee pain")) { "the web's draft opens to continue, without the markup" }

        compose.onNodeWithTag("exam-finding-pick").performScrollTo().performClick()
        compose.waitUntil(10_000) { has("body-map") }
        compose.onNodeWithTag("body-region-heel").performScrollTo().performClick()
        compose.onNodeWithTag("body-map-status").assertTextEquals("Choose the side")
        compose.onNodeWithTag("body-map-use").assertIsNotEnabled()
        compose.onNodeWithTag("body-zone-knee-left").performScrollTo().performClick()
        compose.onNodeWithTag("body-map-status").assertTextEquals("Selected: Left knee")
        compose.onNodeWithTag("body-map-use").performScrollTo().performClick()

        compose.waitUntil(10_000) { has("field-exam-finding") }
        compose.onNodeWithTag("field-exam-finding").performScrollTo().performTextInput("Effusion")
        compose.onNodeWithTag("exam-finding-add").performScrollTo().performClick()
        compose.waitUntil(5_000) { seesText("Left knee: Effusion") }
        compose.onNodeWithTag("field-plan").performScrollTo().performTextInput("Aspirate, review")
        compose.onNodeWithTag("consultation-save").performScrollTo().performClick()
        compose.waitUntil(15_000) { has("consultation-draft-saved") }
        val exam = api.notes(encounterId).first().getJSONArray("sections").let { sections ->
            (0 until sections.length()).map { sections.getJSONObject(it) }.first { it.optString("code") == "examination" }
        }.getJSONObject("data").getJSONObject("exam")
        check(exam.optString("musculoskeletal") == "Antalgic gait") { "the web's note survives the phone's save" }
        val finding = exam.getJSONArray("findings").getJSONObject(0)
        check(finding.optString("site") == "Left knee")
        check(finding.optString("laterality") == "left")
        check(finding.optString("finding") == "Effusion")
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
