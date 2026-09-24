import XCTest

/// The front desk, proven against the record. Scenarios from
/// docs/plans/native-front-office.md; every outcome is read back through the
/// API. Mirrors ReceptionJourneyTest.kt.
final class ReceptionJourneyTests: JourneyCase {
    private var desk: Api.Identity!
    /// Outlives the test instance: one counter per process.
    private static var serial = 0

    override func setUp() {
        super.setUp()
        desk = api.provision("receptionist")
        app.launch()
        Session.signIn(app, as: desk.username, password: desk.password, home: "module-home-reception")
    }

    override func tearDown() { api.retire(desk) }

    /// A phone no other run or test can share.
    private func freshPhone() -> String {
        Self.serial += 1
        return "96" + String(repeating: "0", count: max(0, 6 - Api.runId.count)) + Api.runId + String(format: "%02d", Self.serial)
    }


    private func openRegister() {
        el("module-action-register").tap()
        XCTAssertTrue(el("screen-register-patient").waitForExistence(timeout: 10))
    }

    private func chooseDepartment(named name: String) {
        app.buttons["picker-department"].firstMatch.tap()
        let item = app.buttons[name].firstMatch
        XCTAssertTrue(item.waitForExistence(timeout: 5), "the department is offered")
        item.tap()
    }

    private func fillPerson(_ first: String, _ last: String, phone: String, age: String = "36") {
        type("field-first_name", first); type("field-last_name", last); type("field-phone", phone); type("field-age", age)
    }

    private func patient(byPhone phone: String) -> [String: Any]? {
        api.list("/api/patients?search=\(phone)&per_page=5").first { ($0["phone"] as? String) == phone }
    }

    private func fullRecord(_ id: String) -> [String: Any] {
        let d = api.obj("GET", "/api/patients/\(id)")
        return (d["patient"] as? [String: Any]) ?? d
    }

    private func registration(_ id: String) -> [String: Any]? {
        ((fullRecord(id)["attributes"] as? [String: Any])?["mobile_registration"] as? [String: Any])
    }

    func testRegisterACleanWalkInShowsTheServersUhidAndKeepsTheDesk() {
        let dept = api.list("/api/setup/departments").first { ($0["code"] as? String) == "GEN-MEDICINE" }
        let deptName = (dept?["name"] as? String) ?? "General Medicine"
        let phone = freshPhone()
        openRegister()
        fillPerson("Desk", "Walkin\(Api.runId)", phone: phone)
        chooseDepartment(named: deptName)
        el("register-submit").tap()
        XCTAssertTrue(el("registered-uhid").waitForExistence(timeout: 15))
        shoot("reception-registered")
        guard let row = patient(byPhone: phone), let id = row["id"] as? String else { return XCTFail("the record exists on the server") }
        XCTAssertEqual(el("registered-uhid").label, row["uhid"] as? String, "the UHID on screen is the server's")
        let full = fullRecord(id)
        XCTAssertEqual(full["is_dob_estimated"] as? Bool, true, "an age, not a date: the record says estimated")
        XCTAssertTrue((full["date_of_birth"] as? String)?.hasSuffix("-01-01") ?? false, "1 January of the birth year")
        XCTAssertEqual(registration(id)?["duplicate_check"] as? String, "none", "checked, nobody matched — and the record says so")
        el("register-next").tap()
        XCTAssertTrue(el("field-first_name").waitForExistence(timeout: 5))
        XCTAssertEqual((el("field-first_name").value as? String) ?? "", "First name", "the person is cleared (placeholder shows)")
        XCTAssertTrue(sees(deptName), "the desk's department survived the next walk-in")
    }

    /// A returning patient registered at another desk, reached the other way:
    /// the desk types them in fresh, and the duplicate check offers the record
    /// that already exists instead of creating a second one. Find reaches them
    /// too now (`patients.find`), but the desk that does not think to search
    /// must still be caught here.
    func testAReturningPatientFromAnotherDeskIsReachedThroughTheDuplicateCheck() {
        let deptName = (api.list("/api/setup/departments").first { ($0["code"] as? String) == "GEN-MEDICINE" }?["name"] as? String) ?? "General Medicine"
        let phone = freshPhone()
        let existing = api.patient("Twin", phone: phone) // registered by the admin, not this desk
        guard let id = existing["id"] as? String, let uhid = existing["uhid"] as? String else { return XCTFail("seeded a patient") }
        openRegister()
        fillPerson("Seeded", "Twin\(Api.runId)", phone: phone)
        el("register-submit").tap()
        XCTAssertTrue(el("duplicate-sheet").waitForExistence(timeout: 15), "a match is confirmed, never silently created")
        XCTAssertTrue(el("duplicate-use-\(uhid)").exists, "the record another desk made is the candidate, by UHID")
        shoot("reception-duplicate")
        XCTAssertEqual(api.list("/api/patients?search=\(phone)&per_page=5").count, 1, "nothing was created behind the sheet")
        el("duplicate-use-\(uhid)").tap()
        XCTAssertTrue(el("screen-reception-patient").waitForExistence(timeout: 10))
        XCTAssertTrue(sees(uhid), "the existing record, not a new one")
        el("patient-start-visit").tap()
        XCTAssertTrue(el("screen-start-visit").waitForExistence(timeout: 10))
        chooseDepartment(named: deptName)
        el("start-visit-submit").tap()
        XCTAssertTrue(el("token-number").waitForExistence(timeout: 15))
        XCTAssertEqual(api.worklistToken(patientId: id)?["status"] as? String, "waiting", "the returning patient is on the worklist, with no second UHID")
        XCTAssertEqual(api.list("/api/patients?search=\(phone)&per_page=5").count, 1, "still one record")
    }

    func testRegisterAsNewAnywayRecordsTheOverride() {
        let phone = freshPhone()
        let existing = api.patient("Same", phone: phone)
        guard let uhid = existing["uhid"] as? String else { return XCTFail("seeded a patient") }
        openRegister()
        fillPerson("Seeded", "Same\(Api.runId)", phone: phone)
        el("register-submit").tap()
        XCTAssertTrue(el("duplicate-sheet").waitForExistence(timeout: 15))
        el("duplicate-register-anyway").tap()
        XCTAssertTrue(el("registered-uhid").waitForExistence(timeout: 15))
        let rows = api.list("/api/patients?search=\(phone)&per_page=5")
        XCTAssertEqual(rows.count, 2, "a second record, on purpose")
        guard let created = rows.first(where: { ($0["uhid"] as? String) != uhid }), let id = created["id"] as? String else { return XCTFail("the new record") }
        let reg = registration(id)
        XCTAssertEqual(reg?["duplicate_check"] as? String, "overridden")
        XCTAssertEqual(reg?["matched_uhid"] as? String, uhid, "the override and what it overrode are on the record")
    }

    func testMedicoLegalNeedsItsNumberBeforeAnyRequest() {
        let phone = freshPhone()
        openRegister()
        fillPerson("Legal", "Case\(Api.runId)", phone: phone)
        el("switch-mlc").firstMatch.tap()
        el("register-submit").tap()
        XCTAssertTrue(sees("MLC number is required for a medico-legal registration"), "refused on the field")
        XCTAssertNil(patient(byPhone: phone), "no request left the phone")
        shoot("reception-mlc-refused")
        type("field-mlc_number", "MLC/\(Api.runId)")
        el("register-submit").tap()
        XCTAssertTrue(el("registered-uhid").waitForExistence(timeout: 15))
        guard let id = patient(byPhone: phone)?["id"] as? String else { return XCTFail("registered") }
        let full = fullRecord(id)
        XCTAssertEqual(full["is_medico_legal"] as? Bool, true)
        XCTAssertEqual(full["mlc_number"] as? String, "MLC/\(Api.runId)", "flag and number on the record")
    }

    func testFindByPhoneThenWalkInToToken() {
        let dept = api.list("/api/setup/departments").first { ($0["code"] as? String) == "GEN-MEDICINE" }
        let p = Api.signIn(desk.username, desk.password).patient("Token", phone: freshPhone())
        guard let phone = p["phone"] as? String, let id = p["id"] as? String, let uhid = p["uhid"] as? String else { return XCTFail("seeded a patient") }
        el("module-action-find").tap()
        XCTAssertTrue(el("screen-find-patient").waitForExistence(timeout: 10))
        type("find-search", "zzz-nobody-\(Api.runId)")
        el("find-submit").tap()
        XCTAssertTrue(el("find-empty").waitForExistence(timeout: 10))
        XCTAssertTrue(sees("No patient by that UHID, name or phone"), "nobody, in words")
        el("find-search").tap()
        el("find-search").typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: 30))
        el("find-search").typeText(phone)
        el("find-submit").tap()
        XCTAssertTrue(el("find-row-\(id)").waitForExistence(timeout: 10))
        XCTAssertTrue(sees(uhid), "the row carries the UHID")
        el("find-row-\(id)").tap()
        XCTAssertTrue(el("screen-reception-patient").waitForExistence(timeout: 10))
        shoot("reception-patient")
        el("patient-start-visit").tap()
        XCTAssertTrue(el("screen-start-visit").waitForExistence(timeout: 10))
        chooseDepartment(named: (dept?["name"] as? String) ?? "General Medicine")
        el("start-visit-submit").tap()
        XCTAssertTrue(el("token-number").waitForExistence(timeout: 15))
        shoot("reception-token")
        let queued = api.worklistToken(patientId: id)
        XCTAssertEqual(queued?["status"] as? String, "waiting", "waiting, on the server")
        if let n = api.list("/api/opd/queue").first(where: { ($0["patient_id"] as? String) == id })?["token_number"] as? Int {
            XCTAssertEqual(el("token-number").label, "\(n)", "the token on screen is the server's")
        }
        el("token-board").tap()
        XCTAssertTrue(el("screen-reception-queue").waitForExistence(timeout: 10))
        XCTAssertTrue(reveal("queue-row-\(id)"), "on the board")
    }

    func testCallNextIsTheServersChoice() {
        let dept = api.list("/api/setup/departments").first { ($0["code"] as? String) == "GEN-MEDICINE" }?["id"] as? String
        let p = api.patient("Next")
        guard let id = p["id"] as? String, let dept else { return XCTFail("seeded") }
        let (status, _) = api.call("POST", "/api/opd/encounters", ["patient_id": id, "department_id": dept, "visit_type": "walk_in"])
        XCTAssertTrue((200..<300).contains(status), "a waiting token")
        let calledBefore = api.list("/api/tokens/worklist?module=opd").filter { ($0["status"] as? String) == "called" }.count
        el("module-action-queue").tap()
        XCTAssertTrue(el("queue-call-next").waitForExistence(timeout: 10))
        el("queue-call-next").tap()
        XCTAssertTrue(el("queue-call-next-toast").waitForExistence(timeout: 10))
        let calledAfter = api.list("/api/tokens/worklist?module=opd").filter { ($0["status"] as? String) == "called" }.count
        XCTAssertEqual(calledAfter, calledBefore + 1, "exactly one token called, chosen by the server")
        shoot("reception-board")
    }

    func testFrontOfficeStaffSeesOnlyTheFrontOfficeDesk() {
        let gate = api.provision("front_office_staff")
        defer { api.retire(gate) }
        Session.ensureSignedOut(app)
        Session.signIn(app, as: gate.username, password: gate.password, home: "module-home-reception")
        XCTAssertTrue(el("module-action-enquiries").waitForExistence(timeout: 10), "the front-office codes it does hold are its whole desk")
        XCTAssertTrue(el("module-action-visitors").exists)
        XCTAssertFalse(el("module-action-register").exists || el("module-action-find").exists || el("module-action-queue").exists || el("module-action-appointments").exists, "no patients.* or opd.* code, no action — the grant gap is in roles.rs, not papered over here")
        shoot("reception-front-office-staff")
    }
    /// The morning shift registered them, this desk did not. `GET /api/patients`
    /// is scoped to patients the caller has a relationship with, so the search
    /// came back empty and the desk registered the same person a second time.
    /// `patients.find` is the narrower answer: the whole hospital, identity only.
    func testTheDeskFindsAPatientItDidNotRegister() {
        let seeded = api.patient("Colleague")   // seeded as the admin, not as this desk
        guard let uhid = seeded["uhid"] as? String, let id = seeded["id"] as? String else { return XCTFail("seeded a patient") }
        el("module-action-find").tap()
        XCTAssertTrue(el("screen-find-patient").waitForExistence(timeout: 10))
        type("find-search", uhid)
        tapWhenReady(el("find-submit"))
        XCTAssertTrue(reveal("find-row-\(id)"), "found by UHID although this desk never registered them")
        shoot("reception-find-colleague")
        tapWhenReady(el("find-row-\(id)"))
        XCTAssertTrue(el("screen-reception-patient").waitForExistence(timeout: 10))
        XCTAssertTrue(el("patient-start-visit").exists, "and the desk can take them through to a visit")
    }

    /// Three characters is the floor. Two matches half the register, and a desk
    /// lookup is a lookup for someone in particular, not a way to page through it.
    func testTwoCharactersAreNotASearch() {
        _ = api.patient("Floor")
        el("module-action-find").tap()
        XCTAssertTrue(el("screen-find-patient").waitForExistence(timeout: 10))
        type("find-search", "se")
        tapWhenReady(el("find-submit"))
        XCTAssertTrue(sees("No patient by that UHID, name or phone"), "answers empty rather than opening the register")
    }
    /// Finding someone is not the same as being allowed to read them, and the
    /// act that should grant it is starting their visit. `encounters.created_by`
    /// was never written and `encounter#owner` never granted, so the desk that
    /// registered a walk-in and sent them to a clinic could not open the record
    /// it had just created.
    func testStartingAVisitGivesTheDeskTheRecordItStarted() {
        let deptName = (api.list("/api/setup/departments").first { ($0["code"] as? String) == "GEN-MEDICINE" }?["name"] as? String) ?? "General Medicine"
        let seeded = api.patient("Reach")          // registered by the admin, not this desk
        guard let id = seeded["id"] as? String, let uhid = seeded["uhid"] as? String else { return XCTFail("seeded a patient") }
        let asDesk = Api.signIn(desk.username, desk.password)
        XCTAssertNotEqual(asDesk.call("GET", "/api/patients/\(id)").0, 200, "before the visit the desk has no relationship with them")

        el("module-action-find").tap()
        XCTAssertTrue(el("screen-find-patient").waitForExistence(timeout: 10))
        type("find-search", uhid)
        tapWhenReady(el("find-submit"))
        XCTAssertTrue(reveal("find-row-\(id)"))
        tapWhenReady(el("find-row-\(id)"))
        XCTAssertTrue(el("screen-reception-patient").waitForExistence(timeout: 10))
        tapWhenReady(el("patient-start-visit"))
        XCTAssertTrue(el("screen-start-visit").waitForExistence(timeout: 10))
        chooseDepartment(named: deptName)
        tapWhenReady(el("start-visit-submit"))
        XCTAssertTrue(el("token-number").waitForExistence(timeout: 15), "the visit started")

        XCTAssertEqual(asDesk.call("GET", "/api/patients/\(id)").0, 200, "and the desk can now open the visit it started")
        shoot("reception-reach-after-visit")
    }
}
