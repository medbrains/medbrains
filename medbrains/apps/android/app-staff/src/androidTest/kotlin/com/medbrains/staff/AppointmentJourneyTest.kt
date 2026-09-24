package com.medbrains.staff

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.medbrains.testkit.Evidence
import org.json.JSONObject
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.RuleChain
import org.junit.runner.RunWith
import java.time.LocalDate

/** The desk's appointments, proven against the record. Mirrors AppointmentJourneyTests.swift. */
@RunWith(AndroidJUnit4::class)
class AppointmentJourneyTest {
    val compose = createAndroidComposeRule<MainActivity>()

    @get:Rule
    val chain: RuleChain = RuleChain.outerRule(compose).around(Evidence { compose })

    private val api = Api.admin()
    private lateinit var desk: Api.Identity
    private lateinit var doctor: Api.Identity

    private fun has(tag: String) = with(Session) { compose.has(tag) }
    private fun seesText(t: String, sub: Boolean = false) = compose.onAllNodes(hasText(t, substring = sub)).fetchSemanticsNodes().isNotEmpty()
    private fun tap(tag: String) = compose.onNodeWithTag(tag).performScrollTo().performClick()
    private fun freshPhone() = "95" + Api.RUN.padStart(6, '0') + (++serial).toString().padStart(2, '0')
    companion object { private var serial = 0 }

    /** The earliest slot the screen is offering, read off its tag. */
    private fun firstSlot(): String? = compose
        .onAllNodes(SemanticsMatcher("a slot tag") { it.config.getOrNull(SemanticsProperties.TestTag)?.startsWith("slot-") == true })
        .fetchSemanticsNodes()
        .mapNotNull { it.config.getOrNull(SemanticsProperties.TestTag)?.removePrefix("slot-") }
        .minOrNull()

    @Before
    fun seed() {
        desk = api.provision("receptionist")
        doctor = api.provision("doctor")
        with(Session) { compose.signInAs(desk.username, desk.password, "module-home-reception") }
    }

    @After
    fun retire() { api.retire(desk); api.retire(doctor) }

    /**
     * A booking through the real API. `as` decides who makes it: the desk's
     * own booking is one it may act on, the admin's is a colleague's.
     */
    private fun book(with: Api, patientId: String, date: String, start: String, end: String): JSONObject {
        val dept = checkNotNull(api.firstDepartmentId())
        val (status, text) = with.call("POST", "/api/opd/appointments", JSONObject().put("patient_id", patientId).put("doctor_id", doctor.id).put("department_id", dept).put("appointment_date", date).put("slot_start", start).put("slot_end", end))
        check(status in 200..299) { "booked through the real API: $status $text" }
        return JSONObject(text)
    }

    private fun appointment(id: String) = api.obj("GET", "/api/opd/appointments/$id")

    @Test
    fun checkInIssuesTheTokenForTodaysBooking() {
        val asDesk = Api.signIn(desk.username, desk.password)
        val p = asDesk.patient("Booked", freshPhone())
        val a = book(asDesk, p.getString("id"), LocalDate.now().toString(), "09:00:00", "09:15:00")
        val id = a.getString("id")
        tap("module-action-appointments")
        compose.waitUntil(10_000) { has("screen-appointments") }
        compose.waitUntil(10_000) { has("appt-row-$id") }
        tap("appt-check-in-$id")
        compose.waitUntil(15_000) { has("appt-token-$id") }
        val after = appointment(id)
        check(after.optString("status") == "checked_in" && after.optString("encounter_id").isNotEmpty()) { "checked in, with the visit the server created" }
        check(seesText("Token ${after.optInt("token_number")}")) { "the token the server issued is on the row" }
        check(api.worklistToken(p.getString("id"))?.optString("status") == "waiting") { "and the patient is waiting on the floor" }
        check(!has("appt-check-in-$id")) { "nothing more is offered once checked in" }
    }

    @Test
    fun noShowIsRecordedAndOffersNothingMore() {
        val asDesk = Api.signIn(desk.username, desk.password)
        val p = asDesk.patient("Missing", freshPhone())
        val id = book(asDesk, p.getString("id"), LocalDate.now().toString(), "09:15:00", "09:30:00").getString("id")
        tap("module-action-appointments")
        compose.waitUntil(10_000) { has("appt-row-$id") }
        tap("appt-no-show-$id")
        compose.waitUntil(15_000) { !has("appt-no-show-$id") }
        check(appointment(id).optString("status") == "no_show") { "no-show on the server" }
        check(!has("appt-check-in-$id")) { "a missed booking cannot be checked in" }
    }

    /**
     * A booking another desk made: shown, because the list is not narrowed,
     * but with no action, because the check-in call would answer 404. The row
     * says why rather than offering a button the server refuses.
     */
    @Test
    fun aColleaguesBookingIsShownWithoutAnActionAndSaysWhy() {
        val p = api.patient("Colleague", freshPhone()) // the admin's patient, not this desk's
        val id = book(api, p.getString("id"), LocalDate.now().toString(), "09:30:00", "09:45:00").getString("id")
        tap("module-action-appointments")
        compose.waitUntil(10_000) { has("appt-row-$id") }
        check(has("appt-not-yours-$id")) { "the row says why it offers nothing" }
        check(!has("appt-check-in-$id") && !has("appt-no-show-$id")) { "and offers nothing the server would refuse" }
    }

    @Test
    fun bookFromThePatientScreenHoldsTheSlotOnTheServer() {
        val p = Api.signIn(desk.username, desk.password).patient("Slot", freshPhone())
        val pid = p.getString("id")
        tap("module-action-find")
        compose.waitUntil(10_000) { has("find-search") }
        compose.onNodeWithTag("find-search").performScrollTo().performTextInput(p.getString("phone"))
        tap("find-submit")
        compose.waitUntil(10_000) { has("find-row-$pid") }
        tap("find-row-$pid")
        compose.waitUntil(10_000) { has("patient-book") }
        tap("patient-book")
        compose.waitUntil(10_000) { has("screen-book-appointment") }
        tap("picker-doctor")
        compose.waitUntil(5_000) { has("picker-doctor-${doctor.id}") }
        compose.onNodeWithTag("picker-doctor-${doctor.id}").performClick()
        val dept = checkNotNull(api.firstDepartmentId())
        tap("picker-department")
        compose.waitUntil(5_000) { has("picker-department-$dept") }
        compose.onNodeWithTag("picker-department-$dept").performClick()
        // The first slot the day offers, whatever time it is: the screen hides
        // the ones that have passed, so a fixed time is an assumption about the clock.
        compose.waitUntil(20_000) { firstSlot() != null }
        val slotStart = checkNotNull(firstSlot()) { "the day offers a slot" }
        tap("slot-$slotStart")
        tap("book-submit")
        compose.waitUntil(15_000) { has("booked-card") }
        val tomorrow = LocalDate.now().plusDays(1).toString()
        val mine = api.list("/api/opd/appointments?patient_id=$pid&date=$tomorrow")
        check(mine.size == 1) { "one booking on the server" }
        check(mine[0].optString("doctor_id") == doctor.id && mine[0].optString("slot_start") == slotStart) { "that doctor, that slot" }
        check(seesText("$tomorrow at ${slotStart.take(5)}")) { "the card reads what the server holds" }
    }
}
