package com.medbrains.staff

import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.AndroidComposeTestRule
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
    fun AndroidComposeTestRule<*, *>.has(tag: String) = onAllNodes(hasTestTag(tag)).fetchSemanticsNodes().isNotEmpty()

    private fun AndroidComposeTestRule<*, *>.onAHome() = has("module-home-nurse") || has("module-home-doctor") || onAllNodes(hasTestTag("module-more")).fetchSemanticsNodes().isNotEmpty() || onAllNodes(androidx.compose.ui.test.hasContentDescription("Account")).fetchSemanticsNodes().isNotEmpty()

    fun AndroidComposeTestRule<*, *>.ensureSignedOut() {
        waitUntil(10_000) { has("username") || onAHome() }
        if (has("username")) return
        onNodeWithContentDescription("Account").performClick()
        onNodeWithText("Sign out").performClick()
        waitUntil(10_000) { has("username") }
    }

    fun AndroidComposeTestRule<*, *>.signInAs(username: String, password: String, homeTag: String) {
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
