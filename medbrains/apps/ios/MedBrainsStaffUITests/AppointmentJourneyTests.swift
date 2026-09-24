import XCTest

/// The desk's appointments, proven against the record. Mirrors AppointmentJourneyTest.kt.
final class AppointmentJourneyTests: JourneyCase {
    private var desk: Api.Identity!
    private var doctor: Api.Identity!
    private static var serial = 0

    override func setUp() {
        super.setUp()
        desk = api.provision("receptionist")
        doctor = api.provision("doctor")
        app.launch()
        Session.signIn(app, as: desk.username, password: desk.password, home: "module-home-reception")
    }

    override func tearDown() { api.retire(desk); api.retire(doctor) }

    private func freshPhone() -> String {
        Self.serial += 1
        return "95" + String(repeating: "0", count: max(0, 6 - Api.runId.count)) + Api.runId + String(format: "%02d", Self.serial)
    }

    private static func iso(_ date: Date) -> String {
        let f = DateFormatter(); f.calendar = Calendar(identifier: .gregorian); f.dateFormat = "yyyy-MM-dd"; return f.string(from: date)
    }
    private var today: String { Self.iso(Date()) }
    private var tomorrow: String { Self.iso(Calendar.current.date(byAdding: .day, value: 1, to: Date()) ?? Date()) }

    /// A booking through the real API. Who makes it decides whether the desk
    /// may act on it: its own booking, or a colleague's.
    private func book(_ with: Api, _ patientId: String, date: String, start: String, end: String) -> [String: Any] {
        let dept = api.firstDepartmentId() ?? ""
        let (status, body) = with.call("POST", "/api/opd/appointments", ["patient_id": patientId, "doctor_id": doctor.id, "department_id": dept, "appointment_date": date, "slot_start": start, "slot_end": end])
        XCTAssertTrue((200..<300).contains(status), "booked through the real API: \(status)")
        return (body as? [String: Any]) ?? [:]
    }

    private func appointment(_ id: String) -> [String: Any] { api.obj("GET", "/api/opd/appointments/\(id)") }

    func testCheckInIssuesTheTokenForTodaysBooking() {
        let asDesk = Api.signIn(desk.username, desk.password)
        let p = asDesk.patient("Booked", phone: freshPhone())
        guard let pid = p["id"] as? String, let id = book(asDesk, pid, date: today, start: "09:00:00", end: "09:15:00")["id"] as? String else { return XCTFail("seeded") }
        el("module-action-appointments").tap()
        XCTAssertTrue(el("screen-appointments").waitForExistence(timeout: 10))
        XCTAssertTrue(reveal("appt-row-\(id)"))
        el("appt-check-in-\(id)").tap()
        XCTAssertTrue(el("appt-token-\(id)").waitForExistence(timeout: 15), "the token the server issued is on the row")
        shoot("appointments-checked-in")
        let after = appointment(id)
        XCTAssertEqual(after["status"] as? String, "checked_in")
        XCTAssertNotNil(after["encounter_id"] as? String, "with the visit the server created")
        XCTAssertEqual(el("appt-token-\(id)").label, "Token \(after["token_number"] as? Int ?? -1)")
        XCTAssertEqual(api.worklistToken(patientId: pid)?["status"] as? String, "waiting", "and the patient is waiting on the floor")
        XCTAssertFalse(el("appt-check-in-\(id)").exists, "nothing more is offered once checked in")
    }

    func testNoShowIsRecordedAndOffersNothingMore() {
        let asDesk = Api.signIn(desk.username, desk.password)
        let p = asDesk.patient("Missing", phone: freshPhone())
        guard let pid = p["id"] as? String, let id = book(asDesk, pid, date: today, start: "09:15:00", end: "09:30:00")["id"] as? String else { return XCTFail("seeded") }
        el("module-action-appointments").tap()
        XCTAssertTrue(reveal("appt-row-\(id)"))
        el("appt-no-show-\(id)").tap()
        let gone = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: el("appt-no-show-\(id)"))
        XCTAssertEqual(XCTWaiter().wait(for: [gone], timeout: 15), .completed)
        XCTAssertEqual(appointment(id)["status"] as? String, "no_show", "no-show on the server")
        XCTAssertFalse(el("appt-check-in-\(id)").exists, "a missed booking cannot be checked in")
    }

    /// A booking another desk made: shown, because the list is not narrowed,
    /// but with no action, because the check-in call would answer 404. The row
    /// says why rather than offering a button the server refuses.
    func testAColleaguesBookingIsShownWithoutAnActionAndSaysWhy() {
        let p = api.patient("Colleague", phone: freshPhone()) // the admin's patient, not this desk's
        guard let pid = p["id"] as? String, let id = book(api, pid, date: today, start: "09:30:00", end: "09:45:00")["id"] as? String else { return XCTFail("seeded") }
        _ = pid
        el("module-action-appointments").tap()
        XCTAssertTrue(reveal("appt-row-\(id)"))
        XCTAssertTrue(el("appt-not-yours-\(id)").exists, "the row says why it offers nothing")
        XCTAssertFalse(el("appt-check-in-\(id)").exists || el("appt-no-show-\(id)").exists, "and offers nothing the server would refuse")
        shoot("appointments-not-yours")
    }

    func testBookFromThePatientScreenHoldsTheSlotOnTheServer() {
        let p = Api.signIn(desk.username, desk.password).patient("Slot", phone: freshPhone())
        guard let pid = p["id"] as? String, let phone = p["phone"] as? String else { return XCTFail("seeded") }
        let deptName = (api.list("/api/setup/departments").first { ($0["code"] as? String) == "GEN-MEDICINE" }?["name"] as? String) ?? "General Medicine"
        el("module-action-find").tap()
        XCTAssertTrue(el("find-search").waitForExistence(timeout: 10))
        type("find-search", phone)
        el("find-submit").tap()
        XCTAssertTrue(el("find-row-\(pid)").waitForExistence(timeout: 10))
        el("find-row-\(pid)").tap()
        XCTAssertTrue(el("patient-book").waitForExistence(timeout: 10))
        el("patient-book").tap()
        XCTAssertTrue(el("screen-book-appointment").waitForExistence(timeout: 10))
        app.buttons["picker-doctor"].firstMatch.tap()
        let doc = app.buttons["E2E doctor \(Api.runId)"].firstMatch
        XCTAssertTrue(doc.waitForExistence(timeout: 5), "the provisioned doctor is offered"); doc.tap()
        app.buttons["picker-department"].firstMatch.tap()
        let dept = app.buttons[deptName].firstMatch
        XCTAssertTrue(dept.waitForExistence(timeout: 5)); dept.tap()
        let anySlot = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'slot-'")).firstMatch
        XCTAssertTrue(anySlot.waitForExistence(timeout: 20), "the day offers a slot")
        let slots = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'slot-'"))
        XCTAssertTrue(slots.firstMatch.waitForExistence(timeout: 20), "the day offers slots")
        // The last slot sits directly above the button, so both are on screen
        // together — no scrolling between choosing and submitting.
        for _ in 0..<12 where !el("book-submit").isHittable { scrollDown() }
        guard let last = slots.allElementsBoundByIndex.last(where: \.isHittable) else {
            return XCTFail("a slot is within reach")
        }
        let slotStart = String(last.identifier.dropFirst("slot-".count))
        for attempt in 0..<3 where !el("book-submit").label.hasPrefix("Book") {
            last.tap()
            RunLoop.current.run(until: Date().addingTimeInterval(0.5))
            XCTAssertLessThan(attempt, 2, "the slot is chosen before it is booked")
        }
        el("book-submit").tap()
        XCTAssertTrue(el("booked-card").waitForExistence(timeout: 15))
        shoot("appointments-booked")
        let mine = api.list("/api/opd/appointments?patient_id=\(pid)&date=\(tomorrow)")
        XCTAssertEqual(mine.count, 1, "one booking on the server")
        XCTAssertEqual(mine.first?["doctor_id"] as? String, doctor.id)
        XCTAssertEqual(mine.first?["slot_start"] as? String, slotStart, "that doctor, that slot")
        XCTAssertEqual(el("booked-card").label, "\(tomorrow) at \(slotStart.prefix(5))", "the card reads what the server holds")
    }
}
