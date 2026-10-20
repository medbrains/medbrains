package com.medbrains.kit

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.temporal.ChronoUnit

/**
 * The rules behind the clinical and team modules — other hospitals' records,
 * sticky notes, the UHI queue — pinned to the web's and iOS's decisions so the
 * phone never offers what the browser (or the server) would refuse.
 */
class ClinicalModuleRulesTest {
    /** The client's own settings: a null is left out, as the server expects. */
    private val wire = Json { explicitNulls = false }

    // sticky notes (notes-logic.test.ts)

    private fun note(id: String = "n", system: Boolean = false, canAutoResolve: Boolean = false, resolvedAt: String? = null, shareId: String? = null, author: String = "me") =
        StickyNotes.Note(id = id, body = "Critical lab value", colour = "pink", author_id = author, author_name = "Me", created_at = "2026-10-19T08:00:00Z",
            updated_at = "2026-10-19T08:00:00Z", share_id = shareId, is_system = system, can_auto_resolve = canAutoResolve, resolved_at = resolvedAt)

    @Test fun aResolvedNoteIsOutOfTheActiveListAndUnderResolved() {
        val open = note("open")
        val done = note("done", resolvedAt = "2026-10-19T09:00:00Z")
        assertEquals(listOf(open), StickyNotes.filter(listOf(open, done), StickyNotes.Filter.Active))
        assertEquals(listOf(done), StickyNotes.filter(listOf(open, done), StickyNotes.Filter.Resolved))
    }

    @Test fun aNoteFromANotificationIsNeverEditedOrSharedOnlyDismissed() {
        val system = note(system = true, canAutoResolve = true)
        assertEquals(StickyNotes.Actions(canEdit = false, canShare = false, canToggleAutoResolve = true), StickyNotes.actions(system))
        assertEquals("Dismiss note", StickyNotes.removeLabel(system))
        assertEquals("Delete note", StickyNotes.removeLabel(note()))
    }

    @Test fun autoResolveIsOfferedOnlyWhileThereIsAResolvableSourceStillOpen() {
        assertFalse(StickyNotes.actions(note()).canToggleAutoResolve)
        assertFalse(StickyNotes.actions(note(canAutoResolve = true, resolvedAt = "2026-10-19T09:00:00Z")).canToggleAutoResolve)
    }

    @Test fun onlyAModeratorOrTheAuthorTakesANoteOffABoard() {
        val onBoard = note(shareId = "s1", author = "someone")
        assertFalse(StickyNotes.canTakeOff(onBoard, canModerate = false, me = "me"))
        assertTrue(StickyNotes.canTakeOff(onBoard, canModerate = true, me = "me"))
        assertTrue(StickyNotes.canTakeOff(note(shareId = "s1"), canModerate = false, me = "me"))
        assertFalse("nothing to take off without a share", StickyNotes.canTakeOff(note(), canModerate = true, me = "me"))
    }

    @Test fun aNoteNeedsWordsWithinTheLimitAndAFutureClearTime() {
        val now = Instant.ofEpochSecond(1_800_000_000)
        assertEquals("Write something first", StickyNotes.problem("  ", StickyNotes.Clear.Never, null, now))
        assertEquals("Keep it under 1000 characters", StickyNotes.problem("a".repeat(StickyNotes.MAX_CHARS + 1), StickyNotes.Clear.Never, null, now))
        assertEquals("Pick a time in the future", StickyNotes.problem("OT 3 closed", StickyNotes.Clear.OnDate, now.minusSeconds(60), now))
        assertNull(StickyNotes.problem("OT 3 closed", StickyNotes.Clear.OnDate, now.plusSeconds(60), now))
    }

    @Test fun theDraftIsTrimmedClearsWhenAskedAndOmitsANullExpiry() {
        val now = Instant.ofEpochSecond(1_800_000_000)
        val d = StickyNotes.draft(" Ward 4 short of linen ", "blue", true, StickyNotes.Clear.Shortly, null, now)
        assertEquals("Ward 4 short of linen", d.body)
        assertEquals(now.plus(8, ChronoUnit.HOURS), ServerTime.parse(d.expires_at))
        val keep = StickyNotes.draft("x", "blue", false, StickyNotes.Clear.Never, null, now)
        val json = wire.encodeToString(StickyNotes.Draft.serializer(), keep)
        assertFalse("a kept note sends no expiry", "expires_at" in json)
    }

    // UHI gates (uhi-requests.tsx)

    private fun request(service: String, state: String = UhiRequests.PENDING, home: Boolean = false, paymentType: String? = null, paymentStatus: String? = null) =
        UhiRequests.Request(id = "r", service = service, state = state, customer_name = "Asha", updated_at = "2026-10-19T08:00:00Z",
            payment_type = paymentType, payment_status = paymentStatus, home_collection = home)

    private fun staff(permissions: List<String>, role: String = "receptionist") = TenantIdentity("t", "u", "s", "Staff", role, permissions, emptyList())

    @Test fun eachAnswerNeedsTheQueuePermissionAndTheServicesOwn() {
        val respond = UhiRequests.Permission.RESPOND
        assertFalse("respond alone does not dispatch", UhiRequests.mayAnswer(request(UhiRequests.Service.AMBULANCE), staff(listOf(respond))))
        assertTrue(UhiRequests.mayAnswer(request(UhiRequests.Service.AMBULANCE), staff(listOf(respond, UhiRequests.Permission.DISPATCH_AMBULANCE))))
        assertFalse("the module permission alone does not answer", UhiRequests.mayAnswer(request(UhiRequests.Service.AMBULANCE), staff(listOf(UhiRequests.Permission.DISPATCH_AMBULANCE))))
        assertTrue(UhiRequests.mayAnswer(request(UhiRequests.Service.BLOOD_BANK), staff(listOf(respond, UhiRequests.Permission.ISSUE_BLOOD))))
        assertFalse(UhiRequests.mayAnswer(request(UhiRequests.Service.BLOOD_BANK), staff(listOf(respond, UhiRequests.Permission.DISPATCH_AMBULANCE))))
    }

    @Test fun aHomeCollectionAlsoNeedsSamplesManage() {
        val orderOnly = listOf(UhiRequests.Permission.RESPOND, UhiRequests.Permission.ORDER_LAB)
        assertTrue(UhiRequests.mayAnswer(request(UhiRequests.Service.LAB_TESTS), staff(orderOnly)))
        assertFalse(UhiRequests.mayAnswer(request(UhiRequests.Service.LAB_TESTS, home = true), staff(orderOnly)))
        assertTrue(UhiRequests.mayAnswer(request(UhiRequests.Service.LAB_TESTS, home = true), staff(orderOnly + UhiRequests.Permission.BOOK_COLLECTION)))
    }

    @Test fun consultationsAndSettledRequestsAreNeverAnsweredEvenByAnAdministrator() {
        val admin = staff(emptyList(), role = "hospital_admin")
        assertTrue(UhiRequests.mayAnswer(request(UhiRequests.Service.AMBULANCE), admin))
        assertFalse(UhiRequests.mayAnswer(request(UhiRequests.Service.TELECONSULTATION), admin))
        assertFalse(UhiRequests.mayAnswer(request(UhiRequests.Service.AMBULANCE, state = "confirmed"), admin))
        assertFalse(UhiRequests.mayAnswer(request(UhiRequests.Service.AMBULANCE), null))
    }

    @Test fun moneyTakenForABookingThatNoLongerStandsIsARefundDue() {
        assertNull(UhiRequests.payment(request(UhiRequests.Service.TELECONSULTATION)))
        assertEquals("Paid — refund due", UhiRequests.payment(request(UhiRequests.Service.TELECONSULTATION, "cancelled", paymentType = "ON-ORDER", paymentStatus = "PAID"))?.text)
        assertEquals("Not paid yet", UhiRequests.payment(request(UhiRequests.Service.TELECONSULTATION, UhiRequests.AWAITING_PAYMENT, paymentType = "ON-ORDER", paymentStatus = "NOT-PAID"))?.text)
        assertEquals("Pay at the hospital", UhiRequests.payment(request(UhiRequests.Service.TELECONSULTATION, paymentType = "ON-FULFILLMENT"))?.text)
        assertNull("a decline needs a reason the patient can read", UhiRequests.declineReason("   "))
    }

    // records from other hospitals

    private fun consent(status: String, received: Int = 0, held: Int = 0) = AbdmRecords.ConsentRequest(
        id = status, purpose_code = "CAREMGT", date_from = "", date_to = "", data_erase_at = "", status = status, requester_name = "Dr",
        requested_at = "", status_at = "", records_received = received, records_held = held,
    )

    private fun record(id: String, hip: String, name: String?) =
        AbdmRecords.ReceivedRecordItem(id, "c", null, id, hip, name, null, null, "", "")

    @Test fun recordsAreGroupedByTheHospitalThatSentThemInTheServersOrder() {
        val groups = AbdmRecords.byFacility(listOf(record("a", "H2", "City"), record("b", "H1", null), record("c", "H2", "City")))
        assertEquals("an unnamed hospital reads as its id", listOf("City", "H1"), groups.map { it.name })
        assertEquals(listOf("a", "c"), groups[0].records.map { it.id })
    }

    @Test fun aRevokedConsentsCopiesReadAsErasedAndOnlyAWaitingRequestIsCheckable() {
        assertEquals(3, AbdmRecords.erased(consent("revoked", received = 3, held = 0)))
        assertEquals(0, AbdmRecords.erased(consent("granted", received = 2, held = 2)))
        assertTrue(AbdmRecords.isCheckable(consent(AbdmRecords.AWAITING_PATIENT)))
        assertFalse(AbdmRecords.isCheckable(consent("granted")))
    }

    @Test fun aRequestNeedsARecordTypeAndARangeThatRunsForwards() {
        val today = LocalDate.of(2026, 10, 19)
        assertEquals("Choose at least one record type", AbdmRecords.problem(emptySet(), today, today))
        assertEquals("The range ends before it starts", AbdmRecords.problem(setOf("Prescription"), today, today.minusDays(1)))
        assertNull(AbdmRecords.problem(setOf("Prescription"), today, today))
        assertFalse(AbdmRecords.canRaise(AbdmRecords.PatientView(configured = false, blocked_reason = "ABDM is not set up for this hospital"), holdsRequest = true))
    }

    @Test fun theRequestIsSentInTheServersShapeWithWholeDays() {
        val now = Instant.ofEpochSecond(1_800_000_000)
        val day = now.atZone(ZoneOffset.UTC).toLocalDate()
        val body = AbdmRecords.newRequest("CAREMGT", setOf("Prescription", "DiagnosticReport"), day, day, 30, now, ZoneOffset.UTC)
        assertEquals(listOf("DiagnosticReport", "Prescription"), body.hi_types)
        assertEquals(day.atStartOfDay(ZoneOffset.UTC).toInstant(), ServerTime.parse(body.date_from))
        assertEquals(now.plus(30, ChronoUnit.DAYS), ServerTime.parse(body.data_erase_at))
        val keys = Json.parseToJsonElement(Json.encodeToString(AbdmRecords.NewRequest.serializer(), body)).jsonObject.keys
        assertEquals(setOf("purpose_code", "hi_types", "date_from", "date_to", "data_erase_at"), keys)
    }
}
