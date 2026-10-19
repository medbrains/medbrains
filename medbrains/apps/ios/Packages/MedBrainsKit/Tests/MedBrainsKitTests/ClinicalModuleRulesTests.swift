import XCTest
@testable import MedBrainsKit

/// The rules behind the clinical and team modules — other hospitals'
/// records, sticky notes, the UHI queue — pinned to the web's decisions so
/// the phone never offers what the browser (or the server) would refuse.
final class ClinicalModuleRulesTests: XCTestCase {
    // MARK: sticky notes (notes-logic.test.ts)

    private func note(id: String = "n", isSystem: Bool = false, canAutoResolve: Bool = false, resolvedAt: String? = nil, shareId: String? = nil, author: String = "me") -> StickyNotes.Note {
        StickyNotes.Note(id: id, body: "Critical lab value", colour: "pink", pinned: false, expiresAt: nil, authorId: author, authorName: "Me",
                         createdAt: "2026-10-19T08:00:00Z", updatedAt: "2026-10-19T08:00:00Z", shareId: shareId, shares: [], isSystem: isSystem,
                         sourceUrl: nil, autoResolve: false, canAutoResolve: canAutoResolve, resolvedAt: resolvedAt)
    }

    func testAResolvedNoteIsOutOfTheActiveListAndUnderResolved() {
        let open = note(id: "open"), done = note(id: "done", resolvedAt: "2026-10-19T09:00:00Z")
        XCTAssertEqual(StickyNotes.filter([open, done], .active), [open])
        XCTAssertEqual(StickyNotes.filter([open, done], .resolved), [done])
    }

    func testANoteFromANotificationIsNeverEditedOrSharedOnlyDismissed() {
        let system = note(isSystem: true, canAutoResolve: true)
        XCTAssertEqual(StickyNotes.actions(system), StickyNotes.Actions(canEdit: false, canShare: false, canToggleAutoResolve: true))
        XCTAssertEqual(StickyNotes.removeLabel(system), "Dismiss note")
        XCTAssertEqual(StickyNotes.removeLabel(note()), "Delete note")
    }

    func testAutoResolveIsOfferedOnlyWhileThereIsAResolvableSourceStillOpen() {
        XCTAssertFalse(StickyNotes.actions(note()).canToggleAutoResolve)
        XCTAssertFalse(StickyNotes.actions(note(canAutoResolve: true, resolvedAt: "2026-10-19T09:00:00Z")).canToggleAutoResolve)
    }

    func testOnlyAModeratorOrTheAuthorTakesANoteOffABoard() {
        let onBoard = note(shareId: "s1", author: "someone")
        XCTAssertFalse(StickyNotes.canTakeOff(onBoard, canModerate: false, me: "me"))
        XCTAssertTrue(StickyNotes.canTakeOff(onBoard, canModerate: true, me: "me"))
        XCTAssertTrue(StickyNotes.canTakeOff(note(shareId: "s1"), canModerate: false, me: "me"))
        XCTAssertFalse(StickyNotes.canTakeOff(note(), canModerate: true, me: "me"), "nothing to take off without a share")
    }

    func testANoteNeedsWordsWithinTheLimitAndAFutureClearTime() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        XCTAssertEqual(StickyNotes.problem(body: "  ", clear: .never, at: nil, now: now), "Write something first")
        XCTAssertEqual(StickyNotes.problem(body: String(repeating: "a", count: StickyNotes.maxChars + 1), clear: .never, at: nil, now: now), "Keep it under 1000 characters")
        XCTAssertEqual(StickyNotes.problem(body: "OT 3 closed", clear: .onDate, at: now.addingTimeInterval(-60), now: now), "Pick a time in the future")
        XCTAssertNil(StickyNotes.problem(body: "OT 3 closed", clear: .onDate, at: now.addingTimeInterval(60), now: now))
    }

    func testTheDraftIsTrimmedAndClearsWhenAsked() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let d = StickyNotes.draft(body: " Ward 4 short of linen ", colour: "blue", pinned: true, clear: .shortly, at: nil, now: now)
        XCTAssertEqual(d.body, "Ward 4 short of linen")
        XCTAssertEqual(ServerTime.parse(d.expiresAt), now.addingTimeInterval(8 * 3_600))
        XCTAssertNil(StickyNotes.draft(body: "x", colour: "blue", pinned: false, clear: .never, at: nil, now: now).expiresAt)
    }

    // MARK: UHI gates (uhi-requests.tsx)

    private func request(_ service: String, state: String = UhiRequests.pending, home: Bool = false, paymentType: String? = nil, paymentStatus: String? = nil) -> UhiRequests.Request {
        UhiRequests.Request(id: "r", service: service, state: state, customerName: "Asha", customerPhone: nil, customerAbha: nil, summary: "", appointmentId: nil,
                            ambulanceTripId: nil, declineReason: nil, confirmedAt: nil, respondedAt: nil, updatedAt: "2026-10-19T08:00:00Z",
                            paymentType: paymentType, paymentStatus: paymentStatus, amount: nil, holdExpiresAt: nil, labOrderIds: [], homeCollection: home)
    }

    private func staff(_ permissions: [String], role: String = "receptionist") -> TenantIdentity {
        TenantIdentity(tenantId: "t", userId: "u", username: "s", fullName: "Staff", role: role, permissions: permissions, departmentIds: [])
    }

    func testEachAnswerNeedsTheQueuePermissionAndTheServicesOwn() {
        let respond = UhiRequests.Permission.respond
        XCTAssertFalse(UhiRequests.mayAnswer(request(UhiRequests.Service.ambulance), staff([respond])), "respond alone does not dispatch")
        XCTAssertTrue(UhiRequests.mayAnswer(request(UhiRequests.Service.ambulance), staff([respond, UhiRequests.Permission.dispatchAmbulance])))
        XCTAssertFalse(UhiRequests.mayAnswer(request(UhiRequests.Service.ambulance), staff([UhiRequests.Permission.dispatchAmbulance])), "the module permission alone does not answer")
        XCTAssertTrue(UhiRequests.mayAnswer(request(UhiRequests.Service.bloodBank), staff([respond, UhiRequests.Permission.issueBlood])))
        XCTAssertFalse(UhiRequests.mayAnswer(request(UhiRequests.Service.bloodBank), staff([respond, UhiRequests.Permission.dispatchAmbulance])))
    }

    func testAHomeCollectionAlsoNeedsSamplesManage() {
        let orderOnly = staff([UhiRequests.Permission.respond, UhiRequests.Permission.orderLab])
        XCTAssertTrue(UhiRequests.mayAnswer(request(UhiRequests.Service.labTests), orderOnly))
        XCTAssertFalse(UhiRequests.mayAnswer(request(UhiRequests.Service.labTests, home: true), orderOnly))
        XCTAssertTrue(UhiRequests.mayAnswer(request(UhiRequests.Service.labTests, home: true), staff(orderOnly.permissions + [UhiRequests.Permission.bookCollection])))
    }

    func testConsultationsAndSettledRequestsAreNeverAnsweredEvenByAnAdministrator() {
        let admin = staff([], role: "hospital_admin")
        XCTAssertTrue(UhiRequests.mayAnswer(request(UhiRequests.Service.ambulance), admin))
        XCTAssertFalse(UhiRequests.mayAnswer(request(UhiRequests.Service.teleconsultation), admin))
        XCTAssertFalse(UhiRequests.mayAnswer(request(UhiRequests.Service.ambulance, state: "confirmed"), admin))
        XCTAssertFalse(UhiRequests.mayAnswer(request(UhiRequests.Service.ambulance), nil))
    }

    func testMoneyTakenForABookingThatNoLongerStandsIsARefundDue() {
        XCTAssertNil(UhiRequests.payment(request(UhiRequests.Service.teleconsultation)))
        XCTAssertEqual(UhiRequests.payment(request(UhiRequests.Service.teleconsultation, state: "cancelled", paymentType: "ON-ORDER", paymentStatus: "PAID"))?.text, "Paid — refund due")
        XCTAssertEqual(UhiRequests.payment(request(UhiRequests.Service.teleconsultation, state: UhiRequests.awaitingPayment, paymentType: "ON-ORDER", paymentStatus: "NOT-PAID"))?.text, "Not paid yet")
        XCTAssertEqual(UhiRequests.payment(request(UhiRequests.Service.teleconsultation, paymentType: "ON-FULFILLMENT"))?.text, "Pay at the hospital")
        XCTAssertNil(UhiRequests.declineReason("   "), "a decline needs a reason the patient can read")
    }

    // MARK: records from other hospitals

    private func consent(_ status: String, received: Int = 0, held: Int = 0) -> AbdmRecords.ConsentRequest {
        AbdmRecords.ConsentRequest(id: status, purposeCode: "CAREMGT", hiTypes: [], dateFrom: "", dateTo: "", dataEraseAt: "", status: status, error: nil,
                                   requesterName: "Dr", requestedAt: "", statusAt: "", statusCheckedAt: nil, recordsReceived: received, recordsHeld: held)
    }

    private func record(_ id: String, hip: String, name: String?) -> AbdmRecords.ReceivedRecordItem {
        AbdmRecords.ReceivedRecordItem(id: id, consentRequestId: "c", hiType: nil, careContextReference: id, sourceHipId: hip, sourceHipName: name,
                                       recordDate: nil, title: nil, receivedAt: "", eraseAt: "")
    }

    func testRecordsAreGroupedByTheHospitalThatSentThemInTheServersOrder() {
        let groups = AbdmRecords.byFacility([record("a", hip: "H2", name: "City"), record("b", hip: "H1", name: nil), record("c", hip: "H2", name: "City")])
        XCTAssertEqual(groups.map(\.name), ["City", "H1"], "an unnamed hospital reads as its id")
        XCTAssertEqual(groups[0].records.map(\.id), ["a", "c"])
    }

    func testARevokedConsentsCopiesReadAsErasedAndOnlyAWaitingRequestIsCheckable() {
        XCTAssertEqual(AbdmRecords.erased(consent("revoked", received: 3, held: 0)), 3)
        XCTAssertEqual(AbdmRecords.erased(consent("granted", received: 2, held: 2)), 0)
        XCTAssertTrue(AbdmRecords.isCheckable(consent(AbdmRecords.awaitingPatient)))
        XCTAssertFalse(AbdmRecords.isCheckable(consent("granted")))
    }

    func testARequestNeedsARecordTypeAndARangeThatRunsForwards() {
        let day: TimeInterval = 86_400
        let today = Date()
        XCTAssertEqual(AbdmRecords.problem(hiTypes: [], from: today, to: today), "Choose at least one record type")
        XCTAssertEqual(AbdmRecords.problem(hiTypes: ["Prescription"], from: today, to: today.addingTimeInterval(-day)), "The range ends before it starts")
        XCTAssertNil(AbdmRecords.problem(hiTypes: ["Prescription"], from: today, to: today))
        let blocked = AbdmRecords.PatientView(configured: false, blockedReason: "ABDM is not set up for this hospital", requests: [], records: [])
        XCTAssertFalse(AbdmRecords.canRaise(blocked, holdsRequest: true))
    }

    func testTheRequestIsSentInTheServersShapeWithWholeDays() throws {
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC")!
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let body = AbdmRecords.newRequest(purpose: "CAREMGT", hiTypes: ["Prescription", "DiagnosticReport"], from: now, to: now, keepDays: 30, now: now, calendar: utc)
        XCTAssertEqual(body.hiTypes, ["DiagnosticReport", "Prescription"])
        XCTAssertEqual(ServerTime.parse(body.dateFrom), utc.startOfDay(for: now))
        XCTAssertEqual(ServerTime.parse(body.dataEraseAt), now.addingTimeInterval(30 * 86_400))
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        let keys = try JSONSerialization.jsonObject(with: encoder.encode(body)) as? [String: Any]
        XCTAssertEqual(Set(keys?.keys.map { $0 } ?? []), ["purpose_code", "hi_types", "date_from", "date_to", "data_erase_at"])
    }
}
