package com.medbrains.staff

import androidx.compose.ui.test.assert
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import android.content.Intent
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.test.core.app.ActivityScenario
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.medbrains.testkit.Evidence
import org.junit.After
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.RuleChain
import org.junit.runner.RunWith

/**
 * The front desk's ABDM work in one long session — signed in once, then
 * Scan & Share → compare → Back → registration from a share → Verify ABHA →
 * Back — asserting at every return that the screen still holds what it held.
 * Mirrors AbdmDeskJourneyTests.swift.
 *
 * Needs a live backend with the Scan & Share routes and two shares in today's
 * queue, which only ABDM's signed callback can create: run
 * `scripts/seed_scan_share.sh` and pass its values as instrumentation
 * arguments (the script's header has the command).
 */
@RunWith(AndroidJUnit4::class)
class AbdmDeskJourneyTest {
    // Launched by hand so the app talks to the same server as the test's API (`baseUrl`).
    val compose = createEmptyComposeRule()
    private var scenario: ActivityScenario<MainActivity>? = null

    @get:Rule
    val chain: RuleChain = RuleChain.outerRule(compose).around(Evidence { compose })

    private val api = Api.admin()
    private val args = InstrumentationRegistry.getArguments()
    private var desk: Api.Identity? = null
    private var shareIds: List<String> = emptyList()

    private fun has(tag: String) = with(Session) { compose.has(tag) }
    private fun seesText(t: String) = compose.onAllNodes(hasText(t, substring = true)).fetchSemanticsNodes().isNotEmpty()
    private fun tap(tag: String) = compose.onNodeWithTag(tag).performScrollTo().performClick()
    private fun back() { scenario?.onActivity { it.onBackPressedDispatcher.onBackPressed() } }
    private fun launch() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        scenario = ActivityScenario.launch(Intent(context, MainActivity::class.java).putExtra("baseUrl", Api.BACKEND))
    }
    private fun waitFor(tag: String, ms: Long = 10_000) = compose.waitUntil(ms) { has(tag) }

    /** A share row the lazy queue has not composed yet: scrolled to, then there. */
    private fun reveal(id: String): Boolean {
        compose.waitUntil(15_000) { has("scan-share-rows") }
        compose.onNodeWithTag("scan-share-rows").performScrollToNode(hasTestTag("share-row-$id"))
        return has("share-row-$id")
    }

    /** The module's tab, in the bar or behind More. */
    private fun openModule(id: String) {
        if (!has("module-$id")) compose.onNodeWithTag("module-more").performClick()
        compose.onNodeWithTag("module-$id").performClick()
    }

    @After
    fun tidy() {
        scenario?.close()
        // Dealt with, so the next run's queue is only its own.
        shareIds.forEach { api.call("POST", "/api/abdm/scan-share/$it/dismiss") }
        api.retire(desk)
    }

    @Test
    fun aReceptionistWorksTheShareQueueAndRegistrationInOneSession() {
        val matched = args.getString("shareMatched")
        val fresh = args.getString("shareNew")
        val matchedId = args.getString("shareMatchedId")
        val freshId = args.getString("shareNewId")
        assumeTrue("seed two shares first: scripts/seed_scan_share.sh", matched != null && fresh != null && matchedId != null && freshId != null)
        shareIds = listOf(matchedId!!, freshId!!)
        val who = api.provision("receptionist").also { desk = it }
        launch()
        with(Session) { compose.signInAs(who.username, who.password, "module-home-reception") }

        // The queue: both shares, the matched one carrying its patient.
        openModule("scan-share")
        check(reveal(freshId)) { "the new share is queued" }
        check(reveal(matchedId)) { "the matched share is queued" }
        check(seesText(matched!!)) { "the matched share names its person" }

        // Compare: ABHA's details beside the record, nothing linked yet.
        tap("share-compare-$matchedId")
        waitFor("share-compare-patient", 15_000)
        check(has("abha-compare-name")) { "name side by side" }
        check(has("share-link")) { "linking waits for the desk" }

        // Back: the queue is as it was — not reloading, not blank.
        back()
        waitFor("module-home-scan-share")
        check(reveal(freshId) && reveal(matchedId)) { "the queue survived Back" }

        // Register from the new share; a likely match is shown first, and passed.
        reveal(freshId)
        tap("share-register-$freshId")
        compose.waitUntil(15_000) { has("screen-share-find") || has("screen-register-patient") }
        if (has("screen-share-find")) tap("share-register-anyway")
        waitFor("screen-register-patient", 15_000)
        compose.onNodeWithTag("field-last_name").performScrollTo().assert(hasText(fresh!!))
        check(has("register-abha-verified")) { "the share's ABHA rides on the registration" }

        // Verify ABHA over it: the lookup says what is missing before asking ABDM.
        tap("register-abha-verify")
        waitFor("abha-verify-sheet")
        compose.onNodeWithTag("abha-method-MOBILE").performClick()
        compose.onNodeWithTag("abha-lookup-value").performTextInput("98765")
        tap("abha-send-otp")
        compose.waitUntil(5_000) { seesText("Enter the 10-digit mobile") }
        tap("abha-close")

        // Back from the sheet: the registration still holds the share's person and proof.
        compose.waitUntil(10_000) { !has("abha-verify-sheet") }
        compose.onNodeWithTag("field-last_name").performScrollTo().assert(hasText(fresh))
        check(has("register-abha-verified")) { "the verified ABHA survived the sheet" }

        // Back to the queue, through the find screen when there was one.
        back()
        compose.waitUntil(10_000) { has("screen-share-find") || has("module-home-scan-share") }
        if (has("screen-share-find")) back()
        waitFor("module-home-scan-share")
        check(reveal(freshId)) { "nothing was registered, so the share still waits" }
    }

    /**
     * Runs against any server, seeded or not: the queue answers with rows,
     * the words for none, or the outage named — never a blank — and the ABHA
     * sheet opened over a half-typed registration leaves it as it was.
     */
    @Test
    fun theQueueNeverBlanksAndTheAbhaSheetKeepsTheForm() {
        val who = api.provision("receptionist").also { desk = it }
        launch()
        with(Session) { compose.signInAs(who.username, who.password, "module-home-reception") }
        // A hospital whose receptionist role predates `abdm.scanshare.view` has no
        // Scan & Share module: the gate, working. The form half still runs.
        if (has("module-scan-share") || has("module-more")) runCatching { openModule("scan-share") }.onSuccess {
            compose.waitUntil(20_000) { has("scan-share-list") || has("scan-share-empty") || has("scan-share-unavailable") }
            openModule("reception")
        }
        tap("module-action-register")
        waitFor("screen-register-patient")
        val last = "Abhasheet${Api.RUN}"
        compose.onNodeWithTag("field-last_name").performScrollTo().performTextInput(last)
        tap("register-abha-verify")
        waitFor("abha-verify-sheet")
        compose.onNodeWithTag("abha-method-MOBILE").performClick()
        compose.onNodeWithTag("abha-lookup-value").performTextInput("98765")
        tap("abha-send-otp")
        compose.waitUntil(5_000) { seesText("Enter the 10-digit mobile") }
        tap("abha-close")
        compose.waitUntil(10_000) { !has("abha-verify-sheet") }
        compose.onNodeWithTag("field-last_name").performScrollTo().assert(hasText(last))
        check(has("register-abha-none")) { "nothing verified, nothing claimed" }
    }
}
