package com.medbrains.staff

import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.medbrains.testkit.Evidence
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.RuleChain
import org.junit.runner.RunWith

/**
 * A camp run from a phone (RFCs/modules/RFC-MODULE-token-queues.md, P4c):
 * the registration table gives a number, each station calls it, and the
 * doctor in the second room finishes a patient who needs no medicine.
 * Mirrors CampJourneyTests.swift.
 */
@RunWith(AndroidJUnit4::class)
class CampJourneyTest {
    val compose = createAndroidComposeRule<MainActivity>()

    @get:Rule
    val chain: RuleChain = RuleChain.outerRule(compose).around(Evidence { compose })

    private val api = Api.admin()
    private lateinit var team: Api.Identity

    private fun has(tag: String) = with(Session) { compose.has(tag) }
    private fun seesText(t: String) = compose.onAllNodes(hasText(t, substring = true)).fetchSemanticsNodes().isNotEmpty()
    private fun tap(tag: String) = compose.onNodeWithTag(tag).performScrollTo().performClick()
    /** A control on a screen that does not scroll, or a row already on screen. */
    private fun click(tag: String) = compose.onNodeWithTag(tag).performClick()
    private fun type(tag: String, text: String) = compose.onNodeWithTag(tag).performScrollTo().performTextInput(text)
    private fun number(q: List<JSONObject>, n: String) = q.firstOrNull { it.optString("number") == n }

    @Before
    fun seed() { team = api.provision("camp_coordinator") }

    @After
    fun retire() { api.retire(team) }

    /** Signed in once the camp is set up, as a volunteer arriving at it would be. */
    private fun arrive() = with(Session) { compose.signInAs(team.username, team.password, "module-home-camp") }

    private fun open(station: String) {
        compose.waitUntil(20_000) { has("camp-station-list") }
        compose.onNodeWithTag("camp-station-list").performScrollToNode(hasTestTag("camp-station-$station"))
        compose.onNodeWithTag("camp-station-$station").performClick()
    }

    @Test
    fun theNumberRegistrationGivesIsTheOneVitalsCalls() {
        val (_, stations) = api.campRoute("Phone camp")
        arrive()
        open(stations[0])
        compose.waitUntil(10_000) { has("screen-camp-register") }
        type("field-camp-name", "Meena ${Api.RUN}")
        type("field-camp-age", "61")
        tap("camp-register-submit")
        compose.waitUntil(15_000) { has("camp-issued-number") }
        val issued = compose.onNodeWithTag("camp-issued-number").fetchSemanticsNode().config
        val shown = issued[androidx.compose.ui.semantics.SemanticsProperties.Text].joinToString("") { it.text }
        compose.onNodeWithText("Meena ${Api.RUN}").assertExists("the number says whose it is once the form clears")
        assertNotNull("they wait at Vitals under that number", number(api.campQueue(stations[1]), shown))

        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        open(stations[1])
        compose.waitUntil(15_000) { seesText("1 waiting") }
        click("camp-call-next")
        compose.waitUntil(15_000) { has("camp-complete-$shown") }
        click("camp-complete-$shown")
        compose.waitUntil(10_000) { seesText("Sent to the next station") }
        assertEquals("the doctor's queue has them next", "waiting", number(api.campQueue(stations[2]), shown)?.optString("status"))
    }

    @Test
    fun theSecondDoctorCallsToTheirRoomAndFinishesWithoutPharmacy() {
        val (campId, stations) = api.campRoute("Rooms camp")
        api.call("POST", "/api/camp/camps/$campId/counters", JSONObject().put("counter_name", "Doctor room 2")
            .put("department_id", api.firstDepartmentId()).put("counter_type", "consultation").put("flow_position", 3))
        val reg = api.obj("POST", "/api/camp/registrations", JSONObject().put("camp_id", campId).put("person_name", "Ravi ${Api.RUN}"))
        val n = reg.getString("token_number")
        val atVitals = number(api.campQueue(stations[1]), n)!!.getString("id")
        api.call("POST", "/api/tokens/$atVitals/call", JSONObject())
        api.call("POST", "/api/tokens/$atVitals/complete")
        arrive()

        open(stations[2])
        compose.waitUntil(15_000) { has("camp-room-picker") }
        click("camp-room-picker")
        compose.onNodeWithTag("camp-room-picker-Doctor room 2").performClick()
        compose.waitUntil(15_000) { seesText("1 waiting") }
        click("camp-call-next")
        compose.waitUntil(15_000) { has("camp-finish-$n") }
        assertEquals("the call names the room", "Doctor room 2", number(api.campQueue(stations[2]), n)?.optString("counter_label"))
        click("camp-finish-$n")
        compose.waitUntil(10_000) { seesText("Finished — not sent on") }
        assertFalse("Pharmacy never sees them", api.campQueue(stations[3]).any { it.optString("number") == n })
    }
}
