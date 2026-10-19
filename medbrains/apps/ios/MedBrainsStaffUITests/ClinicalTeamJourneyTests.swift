import XCTest

/// One long shift across the clinical and team modules, signed in once: a
/// patient's records from other hospitals, back to the patient, a note
/// written and shared with the department board, the UHI queue, and back to
/// the patient again — each screen still holding what it held.
///
/// The UHI accept needs a request a patient's app sent, which a device test
/// cannot forge: seed one with `eval "$(scripts/seed_uhi_request.sh)"` and
/// pass `TEST_RUNNER_UHI_REQUEST_ID=$UHI_REQUEST_ID`. Without it the journey
/// still opens the queue and proves it loads, and says so.
final class ClinicalTeamJourneyTests: JourneyCase {
    private var doctor: Api.Identity!
    private var visit: (patientId: String, encounterId: String)!
    private let seededRequest = ProcessInfo.processInfo.environment["UHI_REQUEST_ID"]

    /// A doctor who also answers blood requests from patients' apps.
    private static let extra = ["uhi.requests.view", "uhi.requests.respond", "blood_bank.inventory.manage"]

    override func setUp() {
        super.setUp()
        api.endOpenCodeBlues()
        doctor = api.provision("doctor", extra: Self.extra)
        visit = api.waitingVisit(doctorId: doctor.id, last: "Journey")
        XCTAssertNotNil(visit, "a waiting patient for the doctor")
        app.launch()
        Session.signIn(app, as: doctor.username, password: doctor.password, home: "module-home-doctor")
    }

    override func tearDown() { api.retire(doctor) }

    /// A tab in the bar, or behind More when the role has more modules than fit.
    private func openTab(_ name: String) {
        let inBar = app.tabBars.buttons[name]
        if inBar.exists { inBar.tap(); return }
        app.tabBars.buttons["More"].tap()
        let row = app.cells.staticTexts[name].firstMatch
        if !row.waitForExistence(timeout: 5) {
            // The More stack may still show the module last opened there: back to its list.
            app.navigationBars.buttons["More"].firstMatch.tap()
        }
        XCTAssertTrue(row.waitForExistence(timeout: 5), "\(name) is listed under More")
        row.tap()
    }

    private func back() { app.navigationBars.buttons.element(boundBy: 0).tap() }

    func testAShiftAcrossRecordsNotesAndTheUhiQueueKeepsEachScreensState() {
        // Patient → records from other hospitals.
        el("module-action-queue").tap()
        XCTAssertTrue(reveal("queue-row-\(visit.patientId)"), "the seeded patient is on the queue")
        el("queue-row-\(visit.patientId)").tap()
        XCTAssertTrue(el("screen-queue-detail").waitForExistence(timeout: 10))
        tapWhenReady(el("open-other-hospital-records"))
        XCTAssertTrue(el("screen-abdm-records").waitForExistence(timeout: 10))
        XCTAssertTrue(el("abdm-requests-empty").waitForExistence(timeout: 10), "a new patient has no request yet, said in words")
        XCTAssertFalse(el("abdm-records-unavailable").exists, "the list loaded")
        XCTAssertFalse(el("abdm-records-not-available").exists, "the doctor may see this patient")
        // Either the hospital can ask ABDM, or the screen says why it cannot — never neither.
        XCTAssertTrue(el("abdm-request-records").exists || el("abdm-blocked").exists)
        shoot("journey-other-hospitals")

        // Back to the patient: the token is where it was.
        back()
        XCTAssertTrue(el("screen-queue-detail").waitForExistence(timeout: 10), "back lands on the patient")
        XCTAssertTrue(el("queue-call-patient").exists, "the token is still waiting")

        // Notes: write one, share it with the department board.
        openTab("Notes")
        XCTAssertTrue(el("module-home-notes").waitForExistence(timeout: 10))
        el("notes-new").tap()
        let text = "Linen short on ward 4 \(Api.runId)"
        type("note-body", text)
        el("note-save").tap()
        XCTAssertTrue(sees(text, timeout: 10), "the note is on my list")
        let doctorApi = Api.signIn(doctor.username, doctor.password)
        guard let noteId = doctorApi.myNotes().first(where: { ($0["body"] as? String) == text })?["id"] as? String else {
            return XCTFail("the note was saved on the server")
        }
        let dept = api.firstDepartment()
        let deptId = dept?["id"] as? String ?? ""
        tapWhenReady(el("note-share-\(noteId)"))
        let search = app.searchFields.firstMatch
        XCTAssertTrue(search.waitForExistence(timeout: 10))
        search.tap()
        search.typeText(dept?["name"] as? String ?? "")
        let board = app.switches["share-dept-\(deptId)"].firstMatch
        XCTAssertTrue(board.waitForExistence(timeout: 10), "the department is offered")
        board.coordinate(withNormalizedOffset: CGVector(dx: 0.93, dy: 0.5)).tap()
        el("share-save").tap()
        XCTAssertTrue(el("module-home-notes").waitForExistence(timeout: 10))
        let shared = doctorApi.myNotes().first { ($0["id"] as? String) == noteId }
        XCTAssertEqual((shared?["shares"] as? [[String: Any]])?.first?["department_id"] as? String, deptId, "shared with the board on the server")
        shoot("journey-note-shared")

        // UHI queue: accept the seeded blood request, or prove the queue loads.
        openTab("UHI requests")
        XCTAssertTrue(el("module-home-uhi").waitForExistence(timeout: 10))
        if let id = seededRequest {
            XCTAssertTrue(reveal("uhi-accept-\(id)"), "the seeded blood request offers accept")
            el("uhi-accept-\(id)").tap()
            XCTAssertTrue(el("uhi-toast").waitForExistence(timeout: 10), "the accept confirms itself")
            XCTAssertEqual(api.uhiRequest(id)?["state"] as? String, "confirmed", "confirmed on the server")
        } else {
            XCTAssertTrue(el("uhi-requests-list").waitForExistence(timeout: 10) || el("uhi-requests-empty").exists, "the queue loads (seed a request to prove accept)")
        }
        shoot("journey-uhi")

        // Back across the shift: each module is where it was left.
        openTab("Doctor")
        XCTAssertTrue(el("screen-queue-detail").waitForExistence(timeout: 10), "the doctor's stack kept the patient")
        openTab("Notes")
        XCTAssertTrue(sees(text, timeout: 10), "the note survived the trip")
    }
}
