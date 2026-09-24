package com.medbrains.staff

import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.medbrains.testkit.Evidence
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.RuleChain
import org.junit.runner.RunWith

/**
 * The visitor and enquiry desks, proven against the record. Scenarios from
 * docs/plans/native-front-office.md; mirrors VisitorJourneyTests.swift.
 */
@RunWith(AndroidJUnit4::class)
class VisitorJourneyTest {
    val compose = createAndroidComposeRule<MainActivity>()

    @get:Rule
    val chain: RuleChain = RuleChain.outerRule(compose).around(Evidence { compose })

    private val api = Api.admin()
    private lateinit var desk: Api.Identity

    private fun has(tag: String) = with(Session) { compose.has(tag) }
    private fun seesText(t: String, sub: Boolean = false) = compose.onAllNodes(hasText(t, substring = sub)).fetchSemanticsNodes().isNotEmpty()
    private fun tap(tag: String) = compose.onNodeWithTag(tag).performScrollTo().performClick()
    private fun type(tag: String, text: String) = compose.onNodeWithTag(tag).performScrollTo().performTextInput(text)

    @Before
    fun seed() {
        desk = api.provision("receptionist")
        with(Session) { compose.signInAs(desk.username, desk.password, "module-home-reception") }
    }

    @After
    fun retire() { api.retire(desk) }

    private fun openVisitors() {
        tap("module-action-visitors")
        compose.waitUntil(10_000) { has("screen-visitor-desk") }
    }

    private fun passOnServer(id: String) = api.passes().firstOrNull { it.optString("id") == id }

    @Test
    fun registeringAVisitorIssuesTheirPassInOneAct() {
        openVisitors()
        tap("visitor-register")
        compose.waitUntil(10_000) { has("screen-register-visitor") }
        type("field-visitor-name", "Asha Visitor ${Api.RUN}")
        type("field-visitor-phone", "9812${Api.RUN}")
        type("field-visitor-relationship", "daughter")
        tap("visitor-submit")
        compose.waitUntil(15_000) { has("issued-pass") }
        val registered = checkNotNull(api.list("/api/front-office/visitors").firstOrNull { it.optString("visitor_name").contains("Asha Visitor ${Api.RUN}") }) { "the visitor is on the server" }
        val pass = checkNotNull(api.passes().firstOrNull { it.optString("registration_id") == registered.getString("id") }) { "a pass was issued against them" }
        check(seesText(pass.getString("pass_number"))) { "the number on screen is the server's" }
        check(pass.optString("status") == "active")
    }

    @Test
    fun checkingInThenOutMovesTheCountInside() {
        val reg = api.visitor("Inside").getString("id")
        val passId = api.pass(reg).getString("id")
        openVisitors()
        compose.waitUntil(10_000) { has("pass-row-$passId") }
        tap("pass-check-in-$passId")
        compose.waitUntil(15_000) { has("pass-check-out-$passId") }
        val log = checkNotNull(api.visitorLogs().firstOrNull { it.optString("pass_id") == passId }) { "the log records the arrival" }
        check(log.optString("check_in_at").isNotEmpty())
        tap("pass-check-out-$passId")
        compose.waitUntil(15_000) { has("pass-check-in-$passId") }
        val after = api.visitorLogs().firstOrNull { it.optString("pass_id") == passId }
        check(!after?.optString("check_out_at").isNullOrEmpty()) { "the log carries both times" }
    }

    /**
     * A pass whose hours ran out but which nobody revoked. The person is very
     * likely still upstairs, and the desk is the only place that finds out.
     */
    @Test
    fun aLapsedPassIsCalledOverdueAndStillCountsAsInside() {
        val reg = api.visitor("Overdue").getString("id")
        val passId = api.pass(reg, hours = -1).getString("id")
        // They came in while the pass was good; nobody signed them out.
        api.call("POST", "/api/front-office/visitor-logs/$passId/check-in")
        openVisitors()
        compose.waitUntil(10_000) { has("pass-row-$passId") }
        check(passOnServer(passId)?.optString("status") == "active") { "the server still stores it as active — that is the point" }
        check(has("pass-overdue-$passId")) { "the desk calls it overdue, not expired" }
        check(seesText("still counted as inside", sub = true)) { "and says the person has not been signed out" }
        check(has("pass-check-in-$passId") || has("pass-check-out-$passId")) { "there is still a way to end the visit" }
    }

    @Test
    fun aRevokedPassOffersNothingAndKeepsItsReason() {
        val reg = api.visitor("Revoked").getString("id")
        val passId = api.pass(reg).getString("id")
        api.revokePass(passId, "Wrong ward ${Api.RUN}")
        openVisitors()
        compose.waitUntil(10_000) { has("pass-row-$passId") }
        check(has("pass-revoked-$passId")) { "the reason is on the row" }
        check(seesText("Wrong ward ${Api.RUN}", sub = true))
        check(!has("pass-check-in-$passId") && !has("pass-check-out-$passId")) { "a revoked pass offers nothing the server would accept" }
        check(passOnServer(passId)?.optString("status") == "revoked")
    }

    @Test
    fun loggingAnEnquiryThenResolvingIt() {
        tap("module-action-enquiries")
        compose.waitUntil(10_000) { has("screen-enquiry-desk") }
        tap("enquiry-log")
        compose.waitUntil(10_000) { has("screen-log-enquiry") }
        type("field-caller-name", "Ramesh ${Api.RUN}")
        type("field-caller-phone", "9700${Api.RUN}")
        val said = "Visiting hours are four to six ${Api.RUN}"
        type("field-enquiry-response", said)
        tap("enquiry-submit")
        compose.waitUntil(15_000) { has("screen-enquiry-desk") }
        val logged = checkNotNull(api.enquiries().firstOrNull { it.optString("response_text") == said }) { "the enquiry is on the server" }
        check(!logged.optBoolean("resolved")) { "logged open" }
        val id = logged.getString("id")
        compose.waitUntil(10_000) { has("enquiry-row-$id") }
        tap("enquiry-resolve-$id")
        compose.waitUntil(15_000) { !has("enquiry-resolve-$id") }
        check(api.enquiries().firstOrNull { it.optString("id") == id }?.optBoolean("resolved") == true) { "resolved on the server" }
    }

    /** `front_office_staff` holds `enquiry.list` and nothing else on this desk. */
    @Test
    fun frontOfficeStaffReadsTheEnquiryDeskButCannotLogOrResolve() {
        val gate = api.provision("front_office_staff")
        try {
            val id = api.enquiry("Told them the ward number ${Api.RUN}").getString("id")
            with(Session) { compose.ensureSignedOut(); compose.signInAs(gate.username, gate.password, "module-home-reception") }
            tap("module-action-enquiries")
            compose.waitUntil(10_000) { has("screen-enquiry-desk") }
            check(has("enquiry-read-only")) { "the desk says what this account may not do" }
            check(!has("enquiry-log")) { "no logging without the code for it" }
            compose.waitUntil(10_000) { has("enquiry-row-$id") }
            check(!has("enquiry-resolve-$id")) { "and cannot resolve" }
        } finally { api.retire(gate) }
    }
}
