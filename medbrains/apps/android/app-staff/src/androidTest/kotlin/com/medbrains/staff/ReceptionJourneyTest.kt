package com.medbrains.staff

import androidx.compose.ui.test.assert
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextClearance
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
 * The front desk, proven against the record. Scenarios from
 * docs/plans/native-front-office.md; every outcome is read back through the
 * API. Mirrors ReceptionJourneyTests.swift.
 */
@RunWith(AndroidJUnit4::class)
class ReceptionJourneyTest {
    val compose = createAndroidComposeRule<MainActivity>()

    @get:Rule
    val chain: RuleChain = RuleChain.outerRule(compose).around(Evidence { compose })

    private val api = Api.admin()
    private lateinit var desk: Api.Identity

    private fun has(tag: String) = with(Session) { compose.has(tag) }
    private fun seesText(t: String, sub: Boolean = false) = compose.onAllNodes(hasText(t, substring = sub)).fetchSemanticsNodes().isNotEmpty()
    private fun tap(tag: String) = compose.onNodeWithTag(tag).performScrollTo().performClick()
    private fun type(tag: String, text: String) = compose.onNodeWithTag(tag).performScrollTo().performTextInput(text)
    /** A phone no other run or test can share: the run, then a counter that outlives the test instance. */
    private fun freshPhone() = "96" + Api.RUN.padStart(6, '0') + (++serial).toString().padStart(2, '0')
    companion object { private var serial = 0 }

    @Before
    fun seed() {
        desk = api.provision("receptionist")
        with(Session) { compose.signInAs(desk.username, desk.password, "module-home-reception") }
    }

    @After
    fun retire() { api.retire(desk) }

    private fun openRegister() {
        tap("module-action-register")
        compose.waitUntil(10_000) { has("screen-register-patient") }
    }

    private fun chooseDepartment(id: String) {
        tap("picker-department")
        compose.waitUntil(5_000) { has("picker-department-$id") }
        compose.onNodeWithTag("picker-department-$id").performClick()
    }

    private fun fillPerson(first: String, last: String, phone: String, age: String = "36") {
        type("field-first_name", first); type("field-last_name", last); type("field-phone", phone); type("field-age", age)
    }

    private fun patientByPhone(phone: String) = api.list("/api/patients?search=$phone&per_page=5").firstOrNull { it.optString("phone") == phone }

    @Test
    fun registerACleanWalkInShowsTheServersUhidAndKeepsTheDesk() {
        val dept = checkNotNull(api.firstDepartmentId())
        val phone = freshPhone()
        openRegister()
        fillPerson("Desk", "Walkin${Api.RUN}", phone)
        chooseDepartment(dept)
        tap("register-submit")
        compose.waitUntil(15_000) { has("registered-uhid") }
        val row = checkNotNull(patientByPhone(phone)) { "the record exists on the server" }
        check(seesText(row.getString("uhid"))) { "the UHID on screen is the server's" }
        val full = api.obj("GET", "/api/patients/${row.getString("id")}").let { it.optJSONObject("patient") ?: it }
        check(full.optBoolean("is_dob_estimated")) { "an age, not a date: the record says estimated" }
        check(full.optString("date_of_birth").endsWith("-01-01")) { "1 January of the birth year" }
        check(full.optJSONObject("attributes")?.optJSONObject("mobile_registration")?.optString("duplicate_check") == "none") { "checked, nobody matched — and the record says so" }
        tap("register-next")
        compose.waitUntil(5_000) { has("field-first_name") }
        compose.onNodeWithTag("field-first_name").performScrollTo().assert(hasText(""))
        check(seesText(api.list("/api/setup/departments").first { it.optString("id") == dept }.optString("name"))) { "the desk's department survived the next walk-in" }
    }

    /** A returning patient registered at another desk: reached the other way: the desk types them in fresh and the duplicate check offers the record that already exists. Find reaches them too now (`patients.find`), but the desk that does not think to search must still be caught here. */
    @Test
    fun aReturningPatientFromAnotherDeskIsReachedThroughTheDuplicateCheck() {
        val dept = checkNotNull(api.firstDepartmentId())
        val phone = freshPhone()
        val existing = api.patient("Twin", phone) // registered by the admin, not this desk
        val id = existing.getString("id"); val uhid = existing.getString("uhid")
        openRegister()
        fillPerson("Seeded", "Twin${Api.RUN}", phone)
        tap("register-submit")
        compose.waitUntil(15_000) { has("duplicate-sheet") }
        check(has("duplicate-use-$uhid")) { "the record another desk made is the candidate, by UHID" }
        check(api.list("/api/patients?search=$phone&per_page=5").size == 1) { "nothing was created behind the sheet" }
        compose.onNodeWithTag("duplicate-use-$uhid").performScrollToNode(hasText("Use this record"))
        compose.onAllNodes(hasText("Use this record"))[0].performClick()
        compose.waitUntil(10_000) { has("screen-reception-patient") }
        check(seesText(uhid, sub = true)) { "the existing record, not a new one" }
        tap("patient-start-visit")
        compose.waitUntil(10_000) { has("screen-start-visit") }
        chooseDepartment(dept)
        tap("start-visit-submit")
        compose.waitUntil(15_000) { has("token-number") }
        check(api.worklistToken(id)?.optString("status") == "waiting") { "the returning patient is on the worklist, with no second UHID" }
        check(api.list("/api/patients?search=$phone&per_page=5").size == 1) { "still one record" }
    }

    @Test
    fun registerAsNewAnywayRecordsTheOverride() {
        val phone = freshPhone()
        val existing = api.patient("Same", phone)
        openRegister()
        fillPerson("Seeded", "Same${Api.RUN}", phone)
        tap("register-submit")
        compose.waitUntil(15_000) { has("duplicate-sheet") }
        tap("duplicate-register-anyway")
        compose.waitUntil(15_000) { has("registered-uhid") }
        val rows = api.list("/api/patients?search=$phone&per_page=5")
        check(rows.size == 2) { "a second record, on purpose" }
        val created = rows.first { it.optString("uhid") != existing.getString("uhid") }
        val reg = api.obj("GET", "/api/patients/${created.getString("id")}").let { it.optJSONObject("patient") ?: it }.optJSONObject("attributes")?.optJSONObject("mobile_registration")
        check(reg?.optString("duplicate_check") == "overridden" && reg.optString("matched_uhid") == existing.getString("uhid")) { "the override and what it overrode are on the record" }
    }

    @Test
    fun medicoLegalNeedsItsNumberBeforeAnyRequest() {
        val phone = freshPhone()
        openRegister()
        fillPerson("Legal", "Case${Api.RUN}", phone)
        tap("switch-mlc")
        tap("register-submit")
        compose.waitUntil(5_000) { seesText("MLC number is required for a medico-legal registration") }
        check(patientByPhone(phone) == null) { "refused on the field: no request left the phone" }
        type("field-mlc_number", "MLC/${Api.RUN}")
        tap("register-submit")
        compose.waitUntil(15_000) { has("registered-uhid") }
        val full = api.obj("GET", "/api/patients/${checkNotNull(patientByPhone(phone)).getString("id")}").let { it.optJSONObject("patient") ?: it }
        check(full.optBoolean("is_medico_legal") && full.optString("mlc_number") == "MLC/${Api.RUN}") { "flag and number on the record" }
    }

    @Test
    fun findByPhoneThenWalkInToToken() {
        val dept = checkNotNull(api.firstDepartmentId())
        // The list is scoped to the desk, so the patient it finds is one it registered.
        val p = Api.signIn(desk.username, desk.password).patient("Token", freshPhone())
        val phone = p.getString("phone"); val id = p.getString("id")
        tap("module-action-find")
        compose.waitUntil(10_000) { has("screen-find-patient") }
        type("find-search", "zzz-nobody-${Api.RUN}")
        tap("find-submit")
        compose.waitUntil(10_000) { has("find-empty") }
        check(seesText("No patient by that UHID, name or phone")) { "nobody, in words — and the scope is named" }
        compose.onNodeWithTag("find-search").performScrollTo().performTextClearance()
        compose.onNodeWithTag("find-search").performTextInput(phone)
        tap("find-submit")
        compose.waitUntil(10_000) { has("find-row-$id") }
        check(seesText(p.getString("uhid"), sub = true)) { "the row carries the UHID" }
        tap("find-row-$id")
        compose.waitUntil(10_000) { has("screen-reception-patient") }
        tap("patient-start-visit")
        compose.waitUntil(10_000) { has("screen-start-visit") }
        chooseDepartment(dept)
        tap("start-visit-submit")
        compose.waitUntil(15_000) { has("token-number") }
        val queued = checkNotNull(api.worklistToken(id)) { "the patient is on the worklist" }
        check(queued.optString("status") == "waiting") { "waiting, on the server" }
        val queueRow = api.list("/api/opd/queue").firstOrNull { it.optString("patient_id") == id }
        queueRow?.optInt("token_number")?.let { n -> check(seesText("$n")) { "the token on screen is the server's" } }
        tap("token-board")
        compose.waitUntil(10_000) { has("screen-reception-queue") }
        compose.waitUntil(10_000) { has("reception-queue-tokens") }
        compose.onNodeWithTag("reception-queue-tokens").performScrollToNode(hasTestTag("queue-row-$id"))
    }

    @Test
    fun callNextIsTheServersChoice() {
        val dept = checkNotNull(api.firstDepartmentId())
        val p = api.patient("Next")
        val id = p.getString("id")
        check(api.call("POST", "/api/opd/encounters", org.json.JSONObject().put("patient_id", id).put("department_id", dept).put("visit_type", "walk_in")).first in 200..299)
        val calledBefore = api.list("/api/tokens/worklist?module=opd").count { it.optString("status") == "called" }
        tap("module-action-queue")
        compose.waitUntil(10_000) { has("screen-reception-queue") }
        compose.waitUntil(10_000) { has("queue-call-next") }
        compose.onNodeWithTag("queue-call-next").performClick()
        compose.waitUntil(10_000) { has("queue-call-next-toast") }
        val calledAfter = api.list("/api/tokens/worklist?module=opd").count { it.optString("status") == "called" }
        check(calledAfter == calledBefore + 1) { "exactly one token called, chosen by the server" }
    }

    @Test
    fun frontOfficeStaffSeesOnlyTheFrontOfficeDesk() {
        val gate = api.provision("front_office_staff")
        try {
            with(Session) { compose.ensureSignedOut(); compose.signInAs(gate.username, gate.password, "module-home-reception") }
            compose.waitUntil(10_000) { has("module-action-enquiries") }
            check(has("module-action-visitors")) { "the front-office codes it does hold are its whole desk" }
            check(!has("module-action-register") && !has("module-action-find") && !has("module-action-queue") && !has("module-action-appointments")) { "no patients.* or opd.* code, no action — the grant gap is in roles.rs, not papered over here" }
        } finally { api.retire(gate) }
    }

    /**
     * The morning shift registered them, this desk did not. `GET /api/patients`
     * is scoped to patients the caller has a relationship with, so the search
     * came back empty and the desk registered the same person a second time.
     * `patients.find` is the narrower answer: the whole hospital, identity only.
     */
    @Test
    fun theDeskFindsAPatientItDidNotRegister() {
        val seeded = api.patient("Colleague")   // seeded as the admin, not as this desk
        val uhid = seeded.getString("uhid")
        val id = seeded.getString("id")
        tap("module-action-find")
        compose.waitUntil(10_000) { has("screen-find-patient") }
        type("find-search", uhid)
        tap("find-submit")
        compose.waitUntil(15_000) { has("find-row-$id") }
        tap("find-row-$id")
        compose.waitUntil(10_000) { has("screen-reception-patient") }
        check(has("patient-start-visit")) { "and the desk can take them through to a visit" }
    }

    /**
     * Three characters is the floor. Two matches half the register, and a desk
     * lookup is a lookup for someone in particular, not a way to page through it.
     */
    @Test
    fun twoCharactersAreNotASearch() {
        api.patient("Floor")
        tap("module-action-find")
        compose.waitUntil(10_000) { has("screen-find-patient") }
        type("find-search", "se")
        tap("find-submit")
        compose.waitUntil(10_000) { seesText("No patient by that UHID, name or phone", sub = true) }
    }
    /**
     * Finding someone is not the same as being allowed to read them, and the act
     * that should grant it is starting their visit. `encounters.created_by` was
     * never written and `encounter#owner` never granted, so the desk that
     * registered a walk-in and sent them to a clinic could not open the record
     * it had just created.
     */
    @Test
    fun startingAVisitGivesTheDeskTheRecordItStarted() {
        val deptId = checkNotNull(api.list("/api/setup/departments").firstOrNull { it.optString("code") == "GEN-MEDICINE" }?.optString("id")) { "a department to send them to" }
        val seeded = api.patient("Reach")          // registered by the admin, not this desk
        val id = seeded.getString("id")
        val uhid = seeded.getString("uhid")
        val asDesk = Api.signIn(desk.username, desk.password)
        check(asDesk.call("GET", "/api/patients/$id").first != 200) { "before the visit the desk has no relationship with them" }

        tap("module-action-find")
        compose.waitUntil(10_000) { has("screen-find-patient") }
        type("find-search", uhid)
        tap("find-submit")
        compose.waitUntil(15_000) { has("find-row-$id") }
        tap("find-row-$id")
        compose.waitUntil(10_000) { has("screen-reception-patient") }
        tap("patient-start-visit")
        compose.waitUntil(10_000) { has("screen-start-visit") }
        chooseDepartment(deptId)
        tap("start-visit-submit")
        compose.waitUntil(15_000) { has("token-number") }

        check(asDesk.call("GET", "/api/patients/$id").first == 200) { "and the desk can now open the visit it started" }
    }
}