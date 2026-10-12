package com.medbrains.staff

import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextClearance
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.medbrains.testkit.Evidence
import org.junit.Rule
import org.junit.rules.RuleChain
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Sign-in and session on the device: sign-in starts with the hospital; a
 * wrong password is refused in words
 * with the username kept; a nurse provisioned this run lands on Nurse and
 * sees only her modules; sign-out ends the session; an account deactivated
 * server-side is signed out on its next request.
 */
@RunWith(AndroidJUnit4::class)
class SignInJourneyTest {
    val compose = createAndroidComposeRule<MainActivity>()

    @get:Rule
    val chain: RuleChain = RuleChain.outerRule(compose).around(Evidence { compose })
    private val api = Api.admin()

    private fun has(tag: String) = with(Session) { compose.has(tag) }
    private fun seesText(t: String) = compose.onAllNodes(hasText(t)).fetchSemanticsNodes().isNotEmpty()
    private fun type(username: String, password: String) {
        compose.onNodeWithTag("username").performTextInput(username)
        compose.onNodeWithTag("password").performTextInput(password)
        compose.onNodeWithTag("signIn").performClick()
    }

    private fun chooseHospital(code: String) {
        compose.waitUntil(10_000) { has("hospitalCode") }
        compose.onNodeWithTag("hospitalCode").performTextClearance()
        compose.onNodeWithTag("hospitalCode").performTextInput(code)
        compose.onNodeWithTag("continue").performClick()
    }

    private fun signOut() {
        compose.onNodeWithContentDescription("Account").performClick()
        compose.onNodeWithText("Sign out").performClick()
        compose.waitUntil(10_000) { has("username") || has("hospitalCode") }
    }

    /**
     * The hospital comes first: a code no hospital uses is refused before
     * anything else is asked, the right one names the hospital, the code that
     * signed in is kept so sign-out returns to that hospital's form, and
     * "Change hospital" goes back to the start.
     */
    @Test
    fun signInStartsWithTheHospitalAndRemembersIt() {
        val nurse = api.provision("nurse")
        try {
            with(Session) { compose.ensureSignedOut() }
            compose.onNodeWithTag("changeHospital").performClick()
            chooseHospital("NO-SUCH-HOSPITAL")
            compose.waitUntil(10_000) { seesText("No hospital uses the code \"NO-SUCH-HOSPITAL\". Check it with your IT desk.") }
            check(!has("username")) { "nothing else is asked before the hospital" }

            chooseHospital(Session.HOSPITAL_CODE)
            compose.waitUntil(10_000) { has("username") }
            check(!seesText("Start with your hospital.")) { "the hospital is named" }
            type(nurse.username, nurse.password)
            compose.waitUntil(15_000) { has("module-home-nurse") }
            signOut()
            compose.waitUntil(10_000) { has("changeHospital") }

            compose.onNodeWithTag("changeHospital").performClick()
            compose.waitUntil(5_000) { has("hospitalCode") }
        } finally { api.retire(nurse) }
    }

    @Test
    fun wrongPasswordIsRefusedInWordsAndTheUsernameStays() {
        val nurse = api.provision("nurse")
        try {
            with(Session) { compose.ensureSignedOut() }
            type(nurse.username, "wrong")
            compose.waitUntil(10_000) { seesText("Wrong username or password.") }
            compose.onAllNodes(hasText(nurse.username)).fetchSemanticsNodes().isNotEmpty().let { check(it) { "a refusal keeps what was typed" } }
        } finally { api.retire(nurse) }
    }

    @Test
    fun aProvisionedNurseLandsOnHerModulesAndOnlyHers() {
        val nurse = api.provision("nurse")
        try {
            with(Session) { compose.ensureSignedOut() }
            type(nurse.username, nurse.password)
            compose.waitUntil(15_000) { has("module-home-nurse") }
            compose.onNodeWithTag("module-nurse").assertIsSelected()
            check(has("module-lab")) { "lab.orders.list is held by a nurse" }
            check(!has("module-doctor")) { "opd.visit.update is not" }
            check(!has("module-billing"))
            compose.onNodeWithContentDescription("Account").performClick()
            compose.onNodeWithText("Sign out").performClick()
            compose.waitUntil(10_000) { has("username") || has("hospitalCode") }
        } finally { api.retire(nurse) }
    }

    @Test
    fun aDeactivatedAccountIsSignedOutOnItsNextRequest() {
        val nurse = api.provision("nurse")
        with(Session) { compose.ensureSignedOut() }
        type(nurse.username, nurse.password)
        compose.waitUntil(15_000) { has("module-home-nurse") }
        api.retire(nurse) // deactivated while the app holds a token
        // The next request answers 401 — the flash poll may make it before the tap does.
        if (has("module-action-calls")) runCatching { compose.onNodeWithTag("module-action-calls").performClick() }
        compose.waitUntil(15_000) { has("username") || has("hospitalCode") }
    }
}
