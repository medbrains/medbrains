package com.medbrains.staff

import android.content.Intent
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.medbrains.testkit.Evidence
import org.junit.Rule
import org.junit.rules.RuleChain
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The server is unreachable. The form must say so, and a kept session's
 * ward screens must name the outage rather than render it as a quiet ward.
 */
@RunWith(AndroidJUnit4::class)
class OutageJourneyTest {
    val compose = createEmptyComposeRule()

    @get:Rule
    val chain: RuleChain = RuleChain.outerRule(compose).around(Evidence { compose })

    private fun has(tag: String) = compose.onAllNodes(hasTestTag(tag)).fetchSemanticsNodes().isNotEmpty()
    private fun launch(baseUrl: String): ActivityScenario<MainActivity> {
        val intent = Intent(InstrumentationRegistry.getInstrumentation().targetContext, MainActivity::class.java).putExtra("baseUrl", baseUrl)
        return ActivityScenario.launch(intent)
    }

    @Test
    fun anUnreachableServerIsNamedOnTheFormAndOnTheWardBoard() {
        // First a real session, so the second launch hydrates from the Keystore.
        val api = Api.admin()
        val nurse = api.provision("nurse")
        try {
            launch(Api.BACKEND).use {
                compose.waitUntil(10_000) { has("username") || has("module-home-nurse") || compose.onAllNodes(androidx.compose.ui.test.hasContentDescription("Account")).fetchSemanticsNodes().isNotEmpty() }
                if (!has("module-home-nurse")) {
                    if (!has("username")) { compose.onAllNodes(androidx.compose.ui.test.hasContentDescription("Account"))[0].performClick(); compose.onAllNodes(hasText("Sign out"))[0].performClick(); compose.waitUntil(10_000) { has("username") } }
                    compose.onNodeWithTag("username").performTextInput(nurse.username)
                    compose.onNodeWithTag("password").performTextInput(nurse.password)
                    compose.onNodeWithTag("signIn").performClick()
                    compose.waitUntil(15_000) { has("module-home-nurse") }
                }
            }
            launch("http://10.0.2.2:9").use {
                compose.waitUntil(15_000) { has("module-home-nurse") }
                compose.onNodeWithTag("module-action-calls").performClick()
                compose.waitUntil(30_000) { has("nurse-calls-unavailable") }
                check(compose.onAllNodes(hasText("Do not read this as a quiet ward", substring = true)).fetchSemanticsNodes().isNotEmpty()) { "an outage is named" }
                check(!has("nurse-calls-empty")) { "never rendered as emptiness" }
            }
        } finally { api.retire(nurse) }
    }

    @Test
    fun theReceptionBoardIsNeverAnEmptyFloor() {
        val api = Api.admin()
        val desk = api.provision("receptionist")
        try {
            launch(Api.BACKEND).use {
                compose.waitUntil(10_000) { has("username") || has("module-home-reception") || compose.onAllNodes(androidx.compose.ui.test.hasContentDescription("Account")).fetchSemanticsNodes().isNotEmpty() }
                if (!has("module-home-reception")) {
                    if (!has("username")) { compose.onAllNodes(androidx.compose.ui.test.hasContentDescription("Account"))[0].performClick(); compose.onAllNodes(hasText("Sign out"))[0].performClick(); compose.waitUntil(10_000) { has("username") } }
                    compose.onNodeWithTag("username").performTextInput(desk.username)
                    compose.onNodeWithTag("password").performTextInput(desk.password)
                    compose.onNodeWithTag("signIn").performClick()
                    compose.waitUntil(15_000) { has("module-home-reception") }
                }
            }
            launch("http://10.0.2.2:9").use {
                compose.waitUntil(15_000) { has("module-home-reception") }
                compose.onNodeWithTag("module-action-queue").performClick()
                compose.waitUntil(30_000) { has("reception-queue-unavailable") }
                check(compose.onAllNodes(hasText("Do not read this as an empty floor", substring = true)).fetchSemanticsNodes().isNotEmpty()) { "an outage is named, never an empty floor" }
            }
        } finally { api.retire(desk) }
    }
}
