package com.medbrains.patient

import android.content.Intent
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsOff
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.printToString
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextClearance
import androidx.compose.ui.test.performTextInput
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.medbrains.testkit.Evidence
import java.io.File
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.rules.RuleChain
import org.junit.runner.RunWith

/**
 * The patient's way in and the hospital's record of them, proven against the
 * server. See PatientJourneyTests.swift for the scenarios. The code is spent
 * by the one sign-in, so the signed-in scenarios share a test. Each run signs
 * in as a fresh patient: `PHONE=$(scripts/seed_portal_patient.sh 424242)`, passed
 * as `-Pandroid.testInstrumentationRunnerArguments.portalPhone=$PHONE`.
 */
@RunWith(AndroidJUnit4::class)
class PatientJourneyTest {
    val compose = createEmptyComposeRule()

    @get:Rule
    val chain: RuleChain = RuleChain.outerRule(compose).around(Evidence { compose })
    private val phone = InstrumentationRegistry.getArguments().getString("portalPhone") ?: "9876500777"
    private var scenario: ActivityScenario<MainActivity>? = null

    private val backend = InstrumentationRegistry.getArguments().getString("baseUrl") ?: "http://10.0.2.2:3000"

    private fun launch(baseUrl: String = backend) {
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

    /**
     * From the record, the patient changes what they agree to and makes a
     * request — part of the signed-in walk, because the seeded code signs in once.
     */
    private fun privacyStep(seed: PortalSeed, patientId: String) {
        val reminders = "health_reminders"
        val hadReminders = reminders in seed.dpdpConsent(patientId).first
        val requestsBefore = seed.privacyRequests(patientId).length()
        compose.onNodeWithTag("module-consent").performClick()
        compose.waitUntil(10_000) { has("privacy-save") }
        compose.onNodeWithTag("privacy-save").assertIsNotEnabled()

        // The patient changes their mind about reminders, and saves it themselves.
        compose.onNodeWithTag("purpose-$reminders").performScrollTo().performClick()
        compose.onNodeWithTag("privacy-save").performScrollTo().assertIsEnabled().performClick()
        compose.waitUntil(10_000) { has("privacy-outcome") }
        val (purposes, source) = seed.dpdpConsent(patientId)
        check((reminders in purposes) == !hadReminders) { "the server holds the patient's new choice" }
        check(source == "portal") { "recorded as the patient's own decision" }

        // Their record, downloaded to hand on — the share sheet is the phone's own.
        compose.onNodeWithTag("privacy-export").performScrollTo().performClick()
        // The notification speaks its message as a content description, not as text.
        fun outcome() = compose.onAllNodes(hasTestTag("privacy-outcome")).fetchSemanticsNodes().joinToString { it.config.toString() }
        runCatching { compose.waitUntil(30_000) { has("privacy-share-export") || "didn't download" in outcome() } }
        check(has("privacy-share-export")) {
            val tree = compose.onRoot(useUnmergedTree = true).printToString().lines()
                .filter { "privacy" in it || "Download" in it || "Preparing" in it || "Share" in it || "Text =" in it }
                .take(40).joinToString("\n")
            "the record downloads: ${outcome()}\n$tree"
        }
        val saved = File(InstrumentationRegistry.getInstrumentation().targetContext.cacheDir, "$EXPORT_DIR/$EXPORT_FILE").readText()
        check(saved.contains("\"resourceType\":\"Bundle\"") && saved.contains(patientId)) { "the file is the patient's FHIR record" }

        // A request, made from the phone, reaches the privacy officer's register.
        compose.onNodeWithTag("privacy-make-request").performScrollTo().performClick()
        compose.waitUntil(5_000) { has("request-details") }
        compose.onNodeWithTag("request-details").performScrollTo().performTextInput("Please show me everything you hold about me")
        compose.onNodeWithTag("request-send").performScrollTo().performClick()
        compose.waitUntil(10_000) { seed.privacyRequests(patientId).length() == requestsBefore + 1 }
        check(seed.privacyRequests(patientId).getJSONObject(0).optString("received_via") == "portal") { "on the register as a portal request" }
    }

    /**
     * Sharing from Health Connect starts off: every kind is off until the
     * patient turns it on, so there is nothing to share yet.
     */
    private fun healthDataStep() {
        launch()
        compose.waitUntil(15_000) { has("module-health-data") }
        compose.onNodeWithTag("module-health-data").performScrollTo().performClick()
        compose.waitUntil(10_000) { has("share-heart_rate") }
        for (kind in listOf("blood_pressure", "glucose", "weight", "spo2", "heart_rate")) {
            compose.onNodeWithTag("share-$kind").performScrollTo().assertIsOff()
        }
        compose.onNodeWithTag("share-now").performScrollTo().assertIsNotEnabled()
    }

    /** Sharing from Health Connect, alone: sign in and find every kind off. Spends the seeded code. */
    @Test
    fun healthDataSharingStartsOff() {
        launch(); signOutIfSignedIn()
        compose.onNodeWithTag("phone").performTextInput(phone)
        compose.onNodeWithTag("haveCode").performClick()
        compose.waitUntil(5_000) { has("code") }
        compose.onNodeWithTag("code").performTextInput("424242")
        compose.onNodeWithTag("verify").performClick()
        compose.waitUntil(15_000) { has("tab-hospital") }
        healthDataStep()
    }

    @Test
    fun theSeededCodeOpensTheRecordTheDeskHolds() {
        val seed = PortalSeed.admin()
        val patientId = checkNotNull(seed.patientId(phone)) { "the seeded phone belongs to a patient on DEFAULT" }
        seed.setModule("companion", enabled = false)
        var deliveryWas: Any? = null
        var codWas: Any? = null
        try {
            val bill = checkNotNull(seed.invoice(patientId, 1234.50)) { "the desk raises a bill through the real API" }
            check(bill.total == 1234.50) { "the server holds the charge" }
            val owed = seed.outstanding(patientId)
            val (rx, drug) = seed.dispensedPrescription(patientId)
            val waitingBefore = seed.refillRequestsAwaiting(drug)
            // The hospital delivers, and offers pay-on-delivery to everyone — put back after.
            deliveryWas = seed.pharmacySetting("home_delivery_enabled") ?: false
            codWas = seed.pharmacySetting("cod_min_deliveries") ?: 2
            seed.setPharmacySetting("home_delivery_enabled", true)
            seed.setPharmacySetting("cod_min_deliveries", 0)

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

            // The supply runs out: the patient asks, and it goes to the doctor.
            launch()
            compose.waitUntil(15_000) { has("module-prescriptions") }
            compose.onNodeWithTag("module-prescriptions").performClick()
            compose.waitUntil(10_000) { has("refill-$rx") }
            check(seesText("approves it first", sub = true)) { "told the doctor decides, before asking" }
            compose.onNodeWithTag("request-refill-$rx").performScrollTo().performClick()
            // Asking opens the choice: they want it brought home, and pay at the door.
            compose.waitUntil(10_000) { has("fulfilment-delivery") }
            compose.onNodeWithTag("fulfilment-delivery").performScrollTo().performClick()
            compose.waitUntil(5_000) { has("delivery-new-address") }
            compose.onNodeWithTag("delivery-new-address").performScrollTo().performTextInput("14 Lake Road, Karaikudi")
            check(has("pay-cash_on_delivery")) { "pay-on-delivery is offered" }
            compose.onNodeWithTag("refill-send").performScrollTo().performClick()
            compose.waitUntil(10_000) { has("refill-outcome") }
            compose.waitUntil(10_000) { seesText("With your doctor") }
            check(seed.refillRequestsAwaiting(drug) == waitingBefore + 1) { "and it is in the prescriber's sign-offs" }
            // Back and in again: the delivery is tracked, as the server holds it.
            scenario?.onActivity { it.onBackPressedDispatcher.onBackPressed() }
            compose.waitUntil(10_000) { has("module-prescriptions") }
            compose.onNodeWithTag("module-prescriptions").performClick()
            compose.waitUntil(10_000) { has("deliveries-list") }
            check(seesText("14 Lake Road", sub = true)) { "to the address they gave" }
            check(seesText("Requested")) { "waiting for the doctor and the pharmacy" }
            check(!has("delivery-code")) { "no handover code before it is on its way" }
            // Back to the record the way the walk does it: the session survives a relaunch.
            launch()
            compose.waitUntil(15_000) { has("module-consent") }
            privacyStep(seed, patientId)
            healthDataStep()

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
        } finally {
            seed.setModule("companion", enabled = false)
            deliveryWas?.let { seed.setPharmacySetting("home_delivery_enabled", it) }
            codWas?.let { seed.setPharmacySetting("cod_min_deliveries", it) }
        }
    }
}
