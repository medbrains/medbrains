package com.medbrains.patient

import android.content.Intent
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextClearance
import androidx.compose.ui.test.performTextInput
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.After
import com.medbrains.testkit.Evidence
import org.junit.Rule
import org.junit.rules.RuleChain
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The patient's way in and the hospital's record of them, proven against the
 * server. See PatientJourneyTests.swift for the scenarios; the code is seeded
 * with `scripts/seed_portal_otp.sh 9876500777 424242` before the run and is
 * spent by the one sign-in, so the signed-in scenarios share a test.
 */
@RunWith(AndroidJUnit4::class)
class PatientJourneyTest {
    val compose = createEmptyComposeRule()

    @get:Rule
    val chain: RuleChain = RuleChain.outerRule(compose).around(Evidence { compose })
    private val phone = "9876500777"
    private var scenario: ActivityScenario<MainActivity>? = null

    private fun launch(baseUrl: String = "http://10.0.2.2:3000") {
        scenario?.close()
        val intent = Intent(InstrumentationRegistry.getInstrumentation().targetContext, MainActivity::class.java).putExtra("baseUrl", baseUrl).putExtra("hospitalCode", "DEFAULT")
        scenario = ActivityScenario.launch(intent)
    }

    @After
    fun close() { scenario?.close() }

    private fun has(tag: String) = compose.onAllNodes(hasTestTag(tag)).fetchSemanticsNodes().isNotEmpty()
    private fun seesText(t: String, sub: Boolean = false) = compose.onAllNodes(hasText(t, substring = sub)).fetchSemanticsNodes().isNotEmpty()

    private fun signOutIfSignedIn() {
        compose.waitUntil(10_000) { has("phone") || has("patient-home") }
        if (has("phone")) return
        compose.onNodeWithContentDescription("Account").performClick()
        compose.onNodeWithText("Sign out").performClick()
        compose.waitUntil(10_000) { has("phone") }
    }

    // ── refusals

    @Test
    fun unregisteredAndRegisteredNumbersGetTheSameReply() {
        val registered = checkNotNull(PortalSeed.admin().registeredPhone()) { "a patient registered this run" }
        launch(); signOutIfSignedIn()
        compose.onNodeWithTag("phone").performTextInput("9876599999")
        compose.onNodeWithTag("sendCode").performClick()
        compose.waitUntil(10_000) { has("code") }
        check(!seesText("not registered", sub = true) && !seesText("unknown", sub = true)) { "no existence oracle on the screen" }
        compose.onNodeWithTag("changePhone").performClick()
        compose.waitUntil(5_000) { has("phone") }
        compose.onNodeWithTag("phone").performTextClearance()
        compose.onNodeWithTag("phone").performTextInput(registered)
        compose.onNodeWithTag("sendCode").performClick()
        compose.waitUntil(10_000) { has("code") }
    }

    @Test
    fun aWrongCodeIsRefusedAndTheNumberIsKept() {
        launch(); signOutIfSignedIn()
        compose.onNodeWithTag("phone").performTextInput(phone)
        compose.onNodeWithTag("haveCode").performClick()
        compose.waitUntil(5_000) { has("code") }
        compose.onNodeWithTag("code").performTextInput("000000")
        compose.onNodeWithTag("verify").performClick()
        compose.waitUntil(10_000) { seesText("That code did not work. Check it, or ask for a new one.") }
        check(has("code")) { "still on the code step: the patient corrects the code, not the number" }
        compose.onNodeWithTag("changePhone").performClick()
        compose.waitUntil(5_000) { has("phone") }
        compose.onNodeWithTag("phone").assert(hasText(phone))
    }

    @Test
    fun anUnreachableHospitalNamesItself() {
        launch(baseUrl = "http://10.0.2.2:9")
        compose.waitUntil(10_000) { has("phone") }
        compose.onNodeWithTag("phone").performTextInput(phone)
        compose.onNodeWithTag("sendCode").performClick()
        compose.waitUntil(15_000) { seesText("Could not reach the hospital server.") }
        check(!seesText("Check the number", sub = true)) { "the number was fine" }
    }

    // ── the record

    @Test
    fun theSeededCodeOpensTheRecordTheDeskHolds() {
        val seed = PortalSeed.admin()
        val patientId = checkNotNull(seed.patientId(phone)) { "the seeded phone belongs to a patient on DEFAULT" }
        seed.setModule("companion", enabled = false)
        try {
            val bill = checkNotNull(seed.invoice(patientId, 1234.50)) { "the desk raises a bill through the real API" }
            check(bill.total == 1234.50) { "the server holds the charge" }
            val owed = seed.outstanding(patientId)

            launch(); signOutIfSignedIn()
            compose.onNodeWithTag("phone").performTextInput(phone)
            compose.onNodeWithTag("haveCode").performClick()
            compose.waitUntil(5_000) { has("code") }
            compose.onNodeWithTag("code").performTextInput("424242")
            compose.onNodeWithTag("verify").performClick()
            compose.waitUntil(15_000) { has("tab-hospital") }
            for (m in listOf("appointments", "lab-reports", "prescriptions", "bills", "consent", "family-share")) check(has("module-$m")) { "$m is offered" }
            check(!has("tab-health-item")) { "the companion stays hidden while the hospital has not licensed it" }

            compose.onNodeWithTag("module-bills").performClick()
            compose.waitUntil(10_000) { has("screen-bills") }
            compose.waitUntil(10_000) { has("bills-list") || has("bills-empty") || has("bills-unavailable") }
            check(has("bills-list")) { "the bill raised this run is on the phone" }
            check(seesText(bill.number, sub = true)) { "named by the server's invoice number" }
            check(seesText("₹%.2f".format(bill.total), sub = true)) { "the server's total, not a client sum" }
            check(seesText("₹%.2f due".format(bill.balance), sub = true)) { "unpaid, and says so" }
            check(seesText("₹%.2f".format(owed))) { "still to pay = the sum of the server's balances" }

            seed.setModule("companion", enabled = true)
            launch()
            compose.waitUntil(15_000) { has("patient-home") }
            compose.waitUntil(10_000) { has("tab-health-item") }
            compose.onNodeWithTag("tab-health-item").performClick()
            compose.waitUntil(10_000) { has("tab-health") }

            seed.setModule("companion", enabled = false)
            launch()
            compose.waitUntil(15_000) { has("patient-home") }
            compose.waitUntil(10_000) { !has("tab-health-item") }

            compose.onNodeWithContentDescription("Account").performClick()
            compose.onNodeWithText("Sign out").performClick()
            compose.waitUntil(10_000) { has("phone") }
            launch()
            compose.waitUntil(10_000) { has("phone") || has("patient-home") }
            check(has("phone")) { "nothing of the session survives a sign-out" }
        } finally { seed.setModule("companion", enabled = false) }
    }
}
