package com.medbrains.staff

import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput

/**
 * The Keystore keeps whoever signed in last, so a suite's order would decide
 * what each test sees. Every journey therefore starts from a known session:
 * signed out, or signed in as the role it needs.
 */
object Session {
    fun ComposeTestRule.has(tag: String) = onAllNodes(hasTestTag(tag)).fetchSemanticsNodes().isNotEmpty()

    private fun ComposeTestRule.onAHome() = has("module-home-nurse") || has("module-home-doctor") || onAllNodes(hasTestTag("module-more")).fetchSemanticsNodes().isNotEmpty() || onAllNodes(androidx.compose.ui.test.hasContentDescription("Account")).fetchSemanticsNodes().isNotEmpty()

    /**
     * Choose option [id] in a `CarbonPicker` tagged [picker]: a short one is a
     * menu, a long one has a search field — type [label] to narrow it first,
     * as a desk would.
     */
    fun ComposeTestRule.choose(picker: String, id: String, label: String) {
        onNodeWithTag(picker).performClick()
        waitUntil(5_000) { has("$picker-$id") || has("$picker-search") }
        if (has("$picker-search")) onNodeWithTag("$picker-search").performTextInput(label)
        waitUntil(5_000) { has("$picker-$id") }
        onNodeWithTag("$picker-$id").performClick()
    }

    /** The hospital the test server's staff belong to. */
    const val HOSPITAL_CODE = "default"

    /** Past sign-in's first step, onto the hospital's username form. */
    fun ComposeTestRule.reachSignInForm() {
        waitUntil(10_000) { has("username") || has("hospitalCode") }
        if (has("username")) return
        onNodeWithTag("hospitalCode").performTextInput(HOSPITAL_CODE)
        onNodeWithTag("continue").performClick()
        waitUntil(10_000) { has("username") }
    }

    /** Signed out, on the username form of the test hospital. */
    fun ComposeTestRule.ensureSignedOut() {
        waitUntil(10_000) { has("username") || has("hospitalCode") || onAHome() }
        if (onAHome()) {
            onNodeWithContentDescription("Account").performClick()
            onNodeWithText("Sign out").performClick()
        }
        reachSignInForm()
    }

    fun ComposeTestRule.signInAs(username: String, password: String, homeTag: String) {
        // Never reuse a home already showing: identities are provisioned per
        // test, so the kept session belongs to an account the last test
        // retired, and its next request signs the app out mid-journey.
        ensureSignedOut()
        onNodeWithTag("username").performTextInput(username)
        onNodeWithTag("password").performTextInput(password)
        onNodeWithTag("signIn").performClick()
        waitUntil(15_000) { has(homeTag) }
    }
}
