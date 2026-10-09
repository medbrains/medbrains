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

    /// The start-visit screen's department.
    private func chooseDepartment(named name: String) {
        XCTAssertTrue(choose("picker-department", name), "the department is offered")
    }

    /// The registration wizard's department (a catalogue field).
    private func chooseRegistrationDepartment(named name: String) {
        XCTAssertTrue(choose("field-department_id", name), "the department is offered")
    }

    /// Next through the remaining steps to Review, then register.
    private func submitRegistration() {
        for _ in 0..<5 where !el("register-submit").exists {
            tapWhenReady(el("register-step-next"))
        }
        tapWhenReady(el("register-submit"))
    }

    /// The person, as the desk types them — including a sex actually chosen:
    /// the form has no default. Pass `sex: nil` to leave it untouched.
    private func fillPerson(_ first: String, _ last: String, phone: String, age: String = "36", sex: String? = "Female") {
        type("field-first_name", first); type("field-last_name", last); type("field-phone", phone); type("field-age_years", age)
        if let sex { tapWhenReady(app.segmentedControls["field-gender"].buttons[sex]) }
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
        chooseRegistrationDepartment(named: deptName)
        submitRegistration()
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
        submitRegistration()
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
        submitRegistration()
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

    /// An untouched sex used to be recorded as female. Now it stops the tap,
    /// and the allergy answer travels with the record.
    func testSexMustBeChosenAndAllergiesAreRecorded() {
        let phone = freshPhone()
        openRegister()
        fillPerson("Sex", "Choice\(Api.runId)", phone: phone, sex: nil)
        tapWhenReady(el("register-step-next"))
        XCTAssertTrue(sees("Choose the patient's sex"), "refused on the step")
        XCTAssertNil(patient(byPhone: phone), "no request left the phone")
        tapWhenReady(app.segmentedControls["field-gender"].buttons["Male"])
        tapWhenReady(app.segmentedControls["field-attributes.allergy_status"].buttons["No known allergies"])
        submitRegistration()
        XCTAssertTrue(el("registered-uhid").waitForExistence(timeout: 15))
        guard let id = patient(byPhone: phone)?["id"] as? String else { return XCTFail("registered") }
        let full = fullRecord(id)
        XCTAssertEqual(full["gender"] as? String, "male", "the sex the desk chose")
        let attrs = full["attributes"] as? [String: Any]
        XCTAssertEqual(attrs?["allergy_status"] as? String, "no_known_allergies")
        XCTAssertEqual(attrs?["no_known_allergies"] as? Bool, true, "the same keys the web writes")
    }

    /// Brought in unconscious: registered now, named later. The wizard asks
    /// nothing personal, the review says so, and the record is "Unknown".
    func testAnUnknownPatientIsRegisteredWithoutAName() {
        openRegister()
        flip("field-is_unknown_patient")
        XCTAssertFalse(el("field-first_name").exists, "no name is asked of an unknown patient")
        XCTAssertFalse(el("field-phone").exists, "nor a phone")
        for _ in 0..<4 where !el("register-submit").exists { tapWhenReady(el("register-step-next")) }
        XCTAssertTrue(sees("Unknown patient"), "the review says who this is not")
        shoot("reception-unknown-review")
        tapWhenReady(el("register-submit"))
        XCTAssertTrue(el("registered-uhid").waitForExistence(timeout: 15))
        let uhid = el("registered-uhid").label
        guard let row = api.list("/api/patients?search=\(uhid)&per_page=5").first(where: { ($0["uhid"] as? String) == uhid }),
              let id = row["id"] as? String else { return XCTFail("registered") }
        let full = fullRecord(id)
        XCTAssertEqual(full["first_name"] as? String, "Unknown")
        XCTAssertEqual(full["gender"] as? String, "unknown")
        XCTAssertEqual(full["is_unknown_patient"] as? Bool, true)
    }

    /// A diagnosis chosen from ICD-11 as the desk types, and the drug the
    /// patient reacts to — both on the record, in the web's own keys.
    func testTheDeskRecordsAnIcd11DiagnosisAndADrugAllergy() {
        let phone = freshPhone()
        openRegister()
        fillPerson("Coded", "Fever\(Api.runId)", phone: phone)
        type("icd11_code-search", "fever")
        tapWhenReady(el("icd11_code-hit-MG26"))
        XCTAssertTrue(sees("MG26"), "the chosen code is shown")
        tapWhenReady(app.segmentedControls["field-attributes.allergy_status"].buttons["Known allergies"])
        for _ in 0..<3 { tapWhenReady(el("register-step-next")) }
        type("field-attributes.known_allergies", "Penicillin — rash")
        type("tags-entry", "Penicillin")
        tapWhenReady(el("tags-add"))
        submitRegistration()
        XCTAssertTrue(el("registered-uhid").waitForExistence(timeout: 15))
        guard let id = patient(byPhone: phone)?["id"] as? String,
              let json = try? JSONSerialization.data(withJSONObject: fullRecord(id)),
              let record = String(data: json, encoding: .utf8) else { return XCTFail("registered") }
        XCTAssertTrue(record.contains("MG26"), "the ICD-11 code is on the record")
        XCTAssertTrue(record.contains("Penicillin"), "and the drug allergy")
    }

    func testMedicoLegalNeedsItsNumberBeforeAnyRequest() {
        let phone = freshPhone()
        openRegister()
        fillPerson("Legal", "Case\(Api.runId)", phone: phone)
        // Safety flags are on step 3: family, address & safety.
        tapWhenReady(el("register-step-next"))
        tapWhenReady(el("register-step-next"))
        flip("field-is_medico_legal")
        tapWhenReady(el("register-step-next"))
        XCTAssertTrue(sees("MLC number is required for a medico-legal registration"), "refused on the step")
        XCTAssertNil(patient(byPhone: phone), "no request left the phone")
        shoot("reception-mlc-refused")
        type("field-mlc_number", "MLC/\(Api.runId)")
        submitRegistration()
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
        // The department holds every earlier run's waiting tokens today; this
        // patient took the last number, so the row is at the end of a long list.
        XCTAssertTrue(reveal("queue-row-\(id)", swipes: 60), "on the board")
    }

    func testCallNextIsTheServersChoice() {
        let dept = api.list("/api/setup/departments").first { ($0["code"] as? String) == "GEN-MEDICINE" }?["id"] as? String
        let p = api.patient("Next")
        guard let id = p["id"] as? String, let dept else { return XCTFail("seeded") }
        let (status, _) = api.call("POST", "/api/opd/encounters", ["patient_id": id, "department_id": dept, "visit_type": "walk_in"])
        XCTAssertTrue((200..<300).contains(status), "a waiting token")
        let deptQueue = "/api/tokens/worklist?module=opd&scope=department&scope_id=\(dept)"
        let calledBefore = api.list(deptQueue).filter { ($0["status"] as? String) == "called" }.count
        el("module-action-queue").tap()
        // The board is the desk's department, never the whole hospital.
        XCTAssertTrue(el("reception-queue-choose-department").waitForExistence(timeout: 10), "asks which department first")
        XCTAssertTrue(choose("picker-board-department", "General Medicine"), "the department is offered")
        XCTAssertTrue(el("queue-call-next").waitForExistence(timeout: 10))
        el("queue-call-next").tap()
        XCTAssertTrue(el("queue-call-next-toast").waitForExistence(timeout: 10))
        let calledAfter = api.list(deptQueue).filter { ($0["status"] as? String) == "called" }.count
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

    /// A returning patient goes back to the doctor who saw them: starting the
    /// visit names the last one and has that consultant chosen.
    func testAReturningPatientIsOfferedTheDoctorWhoSawThemLast() {
        let dept = api.list("/api/setup/departments").first { ($0["code"] as? String) == "GEN-MEDICINE" }?["id"] as? String
        guard let doctor = api.list("/api/setup/doctors").first, let doctorId = doctor["id"] as? String,
              let doctorName = doctor["full_name"] as? String, let dept else { return XCTFail("a doctor and a department") }
        let p = api.patient("Return")
        guard let id = p["id"] as? String, let uhid = p["uhid"] as? String else { return XCTFail("seeded a patient") }
        let (status, _) = api.call("POST", "/api/opd/encounters", ["patient_id": id, "department_id": dept, "doctor_id": doctorId, "visit_type": "walk_in"])
        XCTAssertTrue((200..<300).contains(status), "an earlier visit with that doctor")
        el("module-action-find").tap()
        XCTAssertTrue(el("screen-find-patient").waitForExistence(timeout: 10))
        type("find-search", uhid)
        tapWhenReady(el("find-submit"))
        XCTAssertTrue(reveal("find-row-\(id)"))
        tapWhenReady(el("find-row-\(id)"))
        tapWhenReady(el("patient-start-visit"))
        XCTAssertTrue(el("last-visit").waitForExistence(timeout: 10), "the last visit is named")
        XCTAssertTrue(sees(doctorName), "with the doctor who saw them")
        shoot("reception-last-visit")
        let consultant = app.buttons["picker-consultant"].firstMatch
        XCTAssertTrue(consultant.label.contains(doctorName), "and that doctor is chosen: \(consultant.label)")
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
