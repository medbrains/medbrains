package com.medbrains.staff

import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextClearance
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.medbrains.testkit.Evidence
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.RuleChain
import org.junit.runner.RunWith

/**
 * A runner at the door. Mirrors DeliveryJourneyTests.swift: the pharmacy has
 * given them a dispatched delivery and the patient has been texted a code
 * (`scripts/seed_delivery_run.sh`, passed as instrumentation arguments
 * runnerUser, runnerPass, deliveryId, deliveryCode). A wrong code is refused;
 * the patient's code hands it over and the server holds it as delivered.
 */
@RunWith(AndroidJUnit4::class)
class DeliveryJourneyTest {
    val compose = createAndroidComposeRule<MainActivity>()

    @get:Rule
    val chain: RuleChain = RuleChain.outerRule(compose).around(Evidence { compose })

    private val args = InstrumentationRegistry.getArguments()
    private fun has(tag: String) = with(Session) { compose.has(tag) }
    private fun seesText(t: String) = compose.onAllNodes(hasText(t, substring = true)).fetchSemanticsNodes().isNotEmpty()

    @Test
    fun aRunnerHandsOverAgainstThePatientsCode() {
        val user = args.getString("runnerUser")
        val password = args.getString("runnerPass")
        val delivery = args.getString("deliveryId")
        val code = args.getString("deliveryCode")
        assumeTrue("seed a delivery first: scripts/seed_delivery_run.sh", user != null && password != null && delivery != null && code != null)

        with(Session) { compose.signInAs(user!!, password!!, "screen-deliveries") }
        compose.waitUntil(15_000) { has("delivery-$delivery") }
        compose.onNodeWithTag("delivery-$delivery").performClick()
        compose.waitUntil(10_000) { has("screen-handover") }

        compose.onNodeWithTag("handover-code").performTextInput("000000")
        compose.onNodeWithTag("handover-delivered").performScrollTo().performClick()
        compose.waitUntil(10_000) { has("handover-error") }
        check(seesText("doesn't match")) { "a wrong code is refused in words" }

        compose.onNodeWithTag("handover-code").performTextClearance()
        compose.onNodeWithTag("handover-code").performTextInput(code!!)
        compose.onNodeWithTag("handover-delivered").performScrollTo().performClick()
        compose.waitUntil(10_000) { has("screen-deliveries") }
        compose.waitUntil(15_000) { !has("delivery-$delivery") }

        val delivered = Api.admin().delivered()
        check(delivery in delivered) { "the server holds it as delivered" }
    }
}
