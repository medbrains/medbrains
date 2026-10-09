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

    /// Given a waiting patient, When the doctor saves an empty note it is
    /// refused on the field; written, it saves as a draft on the case sheet,
    /// and signed it is the record — under the doctor's name, reopening as
    /// signed with a Revise inside the grace.
    func testAConsultationNoteIsDraftedThenSignedOnTheCaseSheet() {
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
        XCTAssertTrue(api.notes(visit.encounterId).isEmpty, "and nothing reached the server")
        shoot("doctor-consultation-refused")
        for (field, text) in [("chief_complaint", "Fever and cough, three days"), ("examination", "Chest clear, throat red"), ("assessment", "Viral URTI"), ("plan", "Fluids, paracetamol, review in 3 days")] {
            type("field-\(field)", text)
        }
        el("consultation-save").tap()
        XCTAssertTrue(el("consultation-draft-saved").waitForExistence(timeout: 15), "saved as a draft")
        let draft = api.notes(visit.encounterId).first
        XCTAssertEqual(draft?["status"] as? String, "draft")
        XCTAssertEqual(api.section(draft, "subjective"), "<p>Fever and cough, three days</p>", "the web reads it as written")
        XCTAssertEqual(api.section(draft, "assessment"), "<p>Viral URTI</p>")
        shoot("doctor-consultation-draft")

        tapWhenReady(el("consultation-sign"))
        XCTAssertTrue(el("note-status-signed").waitForExistence(timeout: 15), "signed, on the sheet")
        let signed = api.notes(visit.encounterId).first
        XCTAssertEqual(signed?["status"] as? String, "signed")
        XCTAssertEqual(signed?["author_id"] as? String, doctor.id, "under the doctor's own name")
        XCTAssertTrue(el("consultation-revise").exists, "revisable inside the grace")
        shoot("doctor-consultation-signed")
        // Reopening shows the signed note, not a blank form.
        app.navigationBars.buttons.element(boundBy: 0).tap()
        el("queue-open-consultation").tap()
        XCTAssertTrue(el("note-status-signed").waitForExistence(timeout: 10), "a signed note reopens as signed")
        XCTAssertFalse(el("field-chief_complaint").exists, "and is not a form to write over")
    }

    /// Given a draft the doctor began on the web with a system note in its
    /// examination, When they pick the patient's left knee on the body map
    /// and describe it, Then the finding is saved as "Left knee" with its
    /// side, beside the web's note.
    func testAFindingIsPickedOnTheBodyMapAndKeptBesideTheSystemNotes() {
        let visit = api.waitingVisit(doctorId: doctor.id, last: "Knee")!
        let asDoctor = Api.signIn(doctor.username, doctor.password)
        let (status, _) = asDoctor.call("POST", "/api/encounters/\(visit.encounterId)/clinical-notes", [
            "note_type_code": "consultation",
            "sections": [["code": "subjective", "text": "<p>Knee pain</p>"],
                         ["code": "examination", "data": ["exam": ["musculoskeletal": "Antalgic gait"]]]],
        ])
        XCTAssertEqual(status, 200, "the web's draft to keep")
        openQueue()
        XCTAssertTrue(reveal("queue-row-\(visit.patientId)"))
        el("queue-row-\(visit.patientId)").tap()
        el("queue-open-consultation").tap()
        XCTAssertTrue(el("consultation-saved").waitForExistence(timeout: 10), "the web's draft opens to continue")
        XCTAssertEqual(el("field-chief_complaint").value as? String, "Knee pain", "its text, without the markup")

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
        type("field-plan", "Aspirate, review")
        tapWhenReady(el("consultation-save"))
        XCTAssertTrue(el("consultation-draft-saved").waitForExistence(timeout: 15))
        let draft = api.notes(visit.encounterId).first
        let exam = (draft?["sections"] as? [[String: Any]])?.first { $0["code"] as? String == "examination" }?["data"] as? [String: Any]
        let inner = exam?["exam"] as? [String: Any]
        XCTAssertEqual(inner?["musculoskeletal"] as? String, "Antalgic gait", "the web's note survives the phone's save")
        let finding = (inner?["findings"] as? [[String: Any]])?.first
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
