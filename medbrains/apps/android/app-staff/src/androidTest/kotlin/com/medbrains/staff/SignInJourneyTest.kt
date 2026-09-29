package com.medbrains.staff

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performImeAction
import androidx.compose.ui.test.performTextClearance
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.medbrains.testkit.Evidence
import org.junit.Rule
import org.junit.rules.RuleChain
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Sign-in and session on the device: a wrong password is refused in words
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

    private fun setHospitalCode(code: String) {
        compose.onNodeWithTag("hospitalCode").performTextClearance()
        if (code.isNotEmpty()) compose.onNodeWithTag("hospitalCode").performTextInput(code)
    }

    private fun signOut() {
        compose.onNodeWithContentDescription("Account").performClick()
        compose.onNodeWithText("Sign out").performClick()
        compose.waitUntil(10_000) { has("username") }
    }

    /**
     * Staff of more than one hospital name theirs; the code that signed in is
     * kept for next time, a wrong one is refused in words, and clearing it
     * forgets it.
     */
    @Test
    fun theHospitalCodeSignsInIsRememberedAndCanBeForgotten() {
        val nurse = api.provision("nurse")
        try {
            with(Session) { compose.ensureSignedOut() }
            compose.onNodeWithTag("enterHospitalCode").performClick()
            setHospitalCode("NO-SUCH-HOSPITAL")
            type(nurse.username, nurse.password)
            compose.waitUntil(10_000) { seesText("Wrong username, password or hospital code.") }

            // The refusal shows a beat before the form is live again; then Go on
            // the keyboard, as on a phone (the open keyboard covers the button).
            compose.waitUntil(5_000) { compose.onNodeWithTag("signIn").fetchSemanticsNode().config.getOrNull(SemanticsProperties.Disabled) == null }
            setHospitalCode("default")
            compose.onNodeWithTag("hospitalCode").performImeAction()
            compose.waitUntil(15_000) { has("module-home-nurse") }
            signOut()
            check(seesText("default")) { "kept for next time" }

            setHospitalCode("")
            type(nurse.username, nurse.password)
            compose.waitUntil(15_000) { has("module-home-nurse") }
            signOut()
            check(has("enterHospitalCode")) { "a cleared code is forgotten" }
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
            compose.waitUntil(10_000) { has("username") }
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
        compose.waitUntil(15_000) { has("username") }
    }
}
