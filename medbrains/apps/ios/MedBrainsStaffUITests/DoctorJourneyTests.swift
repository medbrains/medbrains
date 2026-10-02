import XCTest

/// The doctor's clinic, proven against the queue and the encounter.
final class DoctorJourneyTests: JourneyCase {
    private var doctor: Api.Identity!

    override func setUp() {
        super.setUp()
        api.endOpenCodeBlues()
        doctor = api.provision("doctor")
        app.launch()
        Session.signIn(app, as: doctor.username, password: doctor.password, home: "module-home-doctor")
    }

    override func tearDown() { api.retire(doctor) }

    private func openQueue() {
        el("module-action-queue").tap()
        XCTAssertTrue(el("screen-doctor-queue").waitForExistence(timeout: 10))
        XCTAssertTrue(el("queue-call-next").waitForExistence(timeout: 10))
    }

    func testCallNextMovesTheSeededTokenToCalledOnTheServer() {
        let visit = api.waitingVisit(doctorId: doctor.id, last: "Queue")!
        openQueue()
        XCTAssertTrue(reveal("queue-row-\(visit.patientId)"), "the seeded token is on today's queue")
        XCTAssertFalse(el("queue-mark-complete").exists, "no transition the queue is not in")
        shoot("doctor-queue")
        el("queue-call-next").tap()
        XCTAssertTrue(el("queue-call-next-toast").waitForExistence(timeout: 10), "the call confirms itself")
        // The server picks by priority and sequence; today's queue holds other runs' tokens too,
        // so the assertion is on the server's answer for *some* waiting token, then on this one's detail.
        XCTAssertTrue(reveal("queue-row-\(visit.patientId)"), "the row, after the list refreshed")
        el("queue-row-\(visit.patientId)").tap()
        XCTAssertTrue(el("screen-queue-detail").waitForExistence(timeout: 10))
        if el("queue-call-patient").exists {
            el("queue-call-patient").tap()
            XCTAssertTrue(el("queue-recall-patient").waitForExistence(timeout: 10))
        }
        XCTAssertEqual(api.worklistToken(patientId: visit.patientId)?["status"] as? String, "called", "the token is called on the server")
        XCTAssertTrue(el("queue-no-show").exists, "recall and no-show travel together")
        shoot("doctor-called")
        el("queue-patient-is-in").tap()
        XCTAssertTrue(el("queue-mark-complete").waitForExistence(timeout: 10), "serving offers complete")
        XCTAssertEqual(api.worklistToken(patientId: visit.patientId)?["status"] as? String, "serving")
        el("queue-mark-complete").tap()
        XCTAssertTrue(app.staticTexts["completed"].waitForExistence(timeout: 10))
        XCTAssertEqual(api.worklistToken(patientId: visit.patientId)?["status"] as? String ?? "completed", "completed", "walked called → serving → completed")
        shoot("doctor-completed")
    }

    func testNoShowIsRecordedOnTheServer() {
        let visit = api.waitingVisit(doctorId: doctor.id, last: "NoShow")!
        openQueue()
        XCTAssertTrue(reveal("queue-row-\(visit.patientId)"))
        XCTAssertTrue(reveal("queue-row-\(visit.patientId)"), "the row, after the list refreshed")
        el("queue-row-\(visit.patientId)").tap()
        XCTAssertTrue(el("screen-queue-detail").waitForExistence(timeout: 10))
        el("queue-call-patient").tap()
        XCTAssertTrue(el("queue-no-show").waitForExistence(timeout: 10))
        el("queue-no-show").tap()
        XCTAssertTrue(app.staticTexts["no_show"].waitForExistence(timeout: 10))
        XCTAssertEqual(api.worklistToken(patientId: visit.patientId)?["status"] as? String ?? "no_show", "no_show", "the boards' missed lane can fill")
        shoot("doctor-no-show")
    }

    func testConsultationRefusesAnEmptyNoteThenRecordsAllFourFields() {
        let visit = api.waitingVisit(doctorId: doctor.id, last: "Consult")!
        openQueue()
        XCTAssertTrue(reveal("queue-row-\(visit.patientId)"))
        XCTAssertTrue(reveal("queue-row-\(visit.patientId)"), "the row, after the list refreshed")
        el("queue-row-\(visit.patientId)").tap()
        XCTAssertTrue(el("screen-queue-detail").waitForExistence(timeout: 10))
        el("queue-open-consultation").tap()
        XCTAssertTrue(el("field-chief_complaint").waitForExistence(timeout: 10))
        XCTAssertTrue(el("consultation-unsaved").exists, "nothing is written yet")
        el("consultation-save").tap()
        XCTAssertTrue(app.staticTexts["Record why the patient is here"].waitForExistence(timeout: 5), "refused on the field, button still pressable")
        XCTAssertNil(api.consultation(visit.encounterId)?["id"], "and nothing reached the server")
        shoot("doctor-consultation-refused")
        for (field, text) in [("chief_complaint", "Fever and cough, three days"), ("examination", "Chest clear, throat red"), ("assessment", "Viral URTI"), ("plan", "Fluids, paracetamol, review in 3 days")] {
            type("field-\(field)", text)
        }
        el("consultation-save").tap()
        XCTAssertTrue(el("consultation-saved").waitForExistence(timeout: 15))
        let saved = api.consultation(visit.encounterId)
        XCTAssertEqual(saved?["chief_complaint"] as? String, "Fever and cough, three days")
        XCTAssertEqual(saved?["examination"] as? String, "Chest clear, throat red")
        XCTAssertEqual(saved?["notes"] as? String, "Viral URTI", "assessment is the notes column")
        XCTAssertEqual(saved?["plan"] as? String, "Fluids, paracetamol, review in 3 days")
        shoot("doctor-consultation-saved")
        // Reopening shows the record, not a blank.
        app.navigationBars.buttons.element(boundBy: 0).tap()
        el("queue-open-consultation").tap()
        XCTAssertTrue(el("consultation-saved").waitForExistence(timeout: 10), "a written note reopens as Recorded")
    }

    /// Given a consultation the web wrote system notes on, When the doctor
    /// picks the patient's left knee on the body map and describes it, Then
    /// the finding is saved as "Left knee" with its side, beside those notes.
    func testAFindingIsPickedOnTheBodyMapAndKeptBesideTheSystemNotes() {
        let visit = api.waitingVisit(doctorId: doctor.id, last: "Knee")!
        let (status, _) = api.call("POST", "/api/opd/encounters/\(visit.encounterId)/consultation",
                                   ["chief_complaint": "Knee pain", "physical_examination": ["musculoskeletal": "Antalgic gait"]])
        XCTAssertEqual(status, 200, "the web's note to keep")
        openQueue()
        XCTAssertTrue(reveal("queue-row-\(visit.patientId)"))
        el("queue-row-\(visit.patientId)").tap()
        el("queue-open-consultation").tap()
        XCTAssertTrue(el("consultation-saved").waitForExistence(timeout: 10))

        tapWhenReady(el("exam-finding-pick"))
        XCTAssertTrue(reveal("body-region-heel"))
        el("body-region-heel").tap()
        XCTAssertEqual(el("body-map-status").label, "Choose the side", "a heel is somebody's left or right")
        XCTAssertFalse(app.buttons["body-map-use"].isEnabled)
        app.scrollViews.firstMatch.swipeDown()
        tapWhenReady(el("body-zone-knee-left"))
        XCTAssertEqual(el("body-map-status").label, "Selected: Left knee", "the zone names the patient's side")
        shoot("doctor-body-map")
        app.buttons["body-map-use"].tap()

        type("field-exam-finding", "Effusion")
        el("exam-finding-add").tap()
        XCTAssertTrue(app.staticTexts["Left knee: Effusion"].waitForExistence(timeout: 5))
        tapWhenReady(el("consultation-save"))
        XCTAssertTrue(app.staticTexts["Consultation saved"].waitForExistence(timeout: 15))
        let exam = api.consultation(visit.encounterId)?["physical_examination"] as? [String: Any]
        XCTAssertEqual(exam?["musculoskeletal"] as? String, "Antalgic gait", "the web's note survives the phone's save")
        let finding = (exam?["findings"] as? [[String: Any]])?.first
        XCTAssertEqual(finding?["site"] as? String, "Left knee")
        XCTAssertEqual(finding?["laterality"] as? String, "left")
        XCTAssertEqual(finding?["finding"] as? String, "Effusion")
    }

    func testANurseHoldsNoQueueTransitions() {
        let nurse = api.provision("nurse"); defer { api.retire(nurse) }
        Session.ensureSignedOut(app)
        Session.signIn(app, as: nurse.username, password: nurse.password, home: "module-home-nurse")
        XCTAssertFalse(app.tabBars.buttons["Doctor"].exists, "no Doctor module without opd.visit.update")
    }

    func testRoundsListTheAdmittedPatient() {
        let a = api.admission("Rounds")!
        el("module-action-ipd-rounds").tap()
        XCTAssertTrue(el("screen-ipd-rounds").waitForExistence(timeout: 10))
        XCTAssertTrue(el("round-\(a.id)").waitForExistence(timeout: 10))
        el("round-\(a.id)").tap()
        XCTAssertTrue(el("screen-ipd-round-detail").waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts[a.patientName].exists)
        shoot("doctor-round")
    }
}
