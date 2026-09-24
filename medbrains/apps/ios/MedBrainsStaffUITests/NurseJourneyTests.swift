import XCTest

/// The nurse's shift, proven against the record. Every scenario seeds its own
/// rows and reads the server back after the tap.
final class NurseJourneyTests: JourneyCase {
    private var nurse: Api.Identity!
    private var admission: Api.Admission!

    override func setUp() {
        super.setUp()
        api.endOpenCodeBlues()
        nurse = api.provision("nurse")
        admission = api.admission("Ward")
        XCTAssertNotNil(admission, "an admitted patient in the nurse's department")
        app.launch()
        Session.signIn(app, as: nurse.username, password: nurse.password, home: "module-home-nurse")
    }

    override func tearDown() { api.endOpenCodeBlues(); api.retire(nurse) }

    private func openWorkspace() {
        el("module-action-mar").tap()
        XCTAssertTrue(el("screen-admissions").waitForExistence(timeout: 10))
        let row = el("admission-\(admission.id)")
        XCTAssertTrue(row.waitForExistence(timeout: 10), "the seeded admission is on My shift")
        XCTAssertTrue(app.staticTexts[admission.patientName].exists, "by name")
        row.tap()
        XCTAssertTrue(el("screen-patient-workspace").waitForExistence(timeout: 10))
    }

    func testCallBoardSeenKeepsTheCallAndDoneClearsItOnTheServer() {
        let callId = api.nurseCall(admission, notes: "Pain 7/10 after physio \(Api.runId)")!
        el("module-action-calls").tap()
        XCTAssertTrue(el("screen-nurse-calls").waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Pain 7/10 after physio \(Api.runId)"].waitForExistence(timeout: 10), "the seeded call, with the patient's own note")
        XCTAssertTrue(app.staticTexts["Pain"].exists, "the request type in words")
        shoot("nurse-calls-open")
        el("nurse-call-seen-\(callId)").tap()
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'seen'")).firstMatch.waitForExistence(timeout: 10), "seen is shown, the row stays")
        var row = api.nurseRequests(admission.id).first { ($0["id"] as? String) == callId }
        XCTAssertNotNil(row?["acknowledged_at"] as? String, "Seen wrote acknowledged_at")
        XCTAssertEqual(row?["status"] as? String, "acknowledged")
        shoot("nurse-calls-seen")
        el("nurse-call-done-\(callId)").tap()
        XCTAssertTrue(el("nurse-calls-empty").waitForExistence(timeout: 10) || !app.staticTexts["Pain 7/10 after physio \(Api.runId)"].exists, "Done takes the call off the board")
        row = api.nurseRequests(admission.id).first { ($0["id"] as? String) == callId }
        XCTAssertEqual(row?["status"] as? String, "completed", "Done completed it on the server")
        shoot("nurse-calls-done")
    }

    func testMarShowsSeededDosesAndAMismatchedScanIsRefusedByTheServer() {
        let plain = api.marDose(admission.id, drug: "Paracetamol \(Api.runId)", highAlert: false, minutesFromNow: -10)!
        _ = api.marDose(admission.id, drug: "Insulin \(Api.runId)", highAlert: true, minutesFromNow: 30)
        openWorkspace()
        el("workspace-mar").tap()
        XCTAssertTrue(el("screen-mar").waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Paracetamol \(Api.runId)"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Insulin \(Api.runId)"].exists)
        XCTAssertTrue(app.staticTexts["high alert"].exists, "high-alert is marked in words")
        shoot("nurse-mar")
        el("mar-take-to-bedside").firstMatch.tap()
        XCTAssertTrue(el("screen-administer-dose").waitForExistence(timeout: 10))
        XCTAssertFalse(el("bcma-give-now").exists, "no give before the server has verified")
        // Wristband right, drug wrong: the server names which right failed.
        let code = el("barcode-manual")
        XCTAssertTrue(code.waitForExistence(timeout: 5))
        code.tap(); code.typeText(admission.uhid); el("barcode-manual-submit").tap()
        code.tap(); code.typeText("NOT-A-BATCH"); el("barcode-manual-submit").tap()
        XCTAssertTrue(el("bcma-refused").waitForExistence(timeout: 15), "the refusal is a full stop")
        XCTAssertTrue(sees("Wristband matched. Drug did not match."), "both rights named, including the one that passed")
        XCTAssertFalse(el("bcma-give-now").exists, "and no give anyway")
        shoot("nurse-bcma-refused")
        XCTAssertEqual(api.mar(admission.id).first { ($0["id"] as? String) == plain }?["status"] as? String, "scheduled", "nothing was recorded")
    }

    func testHoldingADoseNeedsATypedReasonThatReachesTheRecord() {
        let dose = api.marDose(admission.id, drug: "Metformin \(Api.runId)", highAlert: false, minutesFromNow: 0)!
        openWorkspace()
        el("workspace-mar").tap()
        XCTAssertTrue(el("mar-take-to-bedside").waitForExistence(timeout: 10))
        el("mar-take-to-bedside").firstMatch.tap()
        XCTAssertTrue(el("screen-administer-dose").waitForExistence(timeout: 10))
        el("dose-hold").tap()
        XCTAssertTrue(el("dose-save").waitForExistence(timeout: 5))
        XCTAssertFalse(el("dose-save").isEnabled, "no reason, no save")
        let reason = el("dose-reason")
        XCTAssertTrue(reason.waitForExistence(timeout: 5))
        reason.tap(); reason.typeText("NBM before theatre")
        el("dose-save").tap()
        XCTAssertTrue(el("screen-mar").waitForExistence(timeout: 15), "back to the schedule, which refetches")
        let row = api.mar(admission.id).first { ($0["id"] as? String) == dose }
        XCTAssertEqual(row?["status"] as? String, "held")
        XCTAssertEqual(row?["hold_reason"] as? String, "NBM before theatre", "the reason the nurse typed, not a constant")
        XCTAssertTrue(app.staticTexts["held"].waitForExistence(timeout: 10), "and the schedule shows it")
        shoot("nurse-mar-held")
    }

    func testVitalsOutOfRangeAreRefusedOnTheFieldAndInRangeAreRecorded() {
        openWorkspace()
        el("workspace-vitals").tap()
        XCTAssertTrue(el("screen-bedside-vitals").waitForExistence(timeout: 10))
        let pulse = app.textFields["Pulse"].firstMatch
        pulse.tap(); pulse.typeText("999")
        el("bedside-save").tap()
        XCTAssertTrue(app.staticTexts["Pulse must be 0-300"].waitForExistence(timeout: 5), "refused on the field, value kept")
        shoot("nurse-vitals-refused")
        pulse.tap(); pulse.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: 3)); pulse.typeText("76")
        let spo2 = app.textFields["SpO2"].firstMatch
        spo2.tap(); spo2.typeText("97")
        el("bedside-save").tap()
        XCTAssertTrue(app.staticTexts["Saved to bedside chart."].waitForExistence(timeout: 15))
        shoot("nurse-vitals-saved")
    }

    func testCodeBlueListsTheArrestAndRespondingIsAnArrivalOnTheServer() {
        let arrest = api.codeBlue(admission, location: "Ward 3 bed 4 \(Api.runId)")!
        defer { api.endCodeBlue(arrest) }
        // The flash covers the app while the arrest is open; a triple-tap silences this phone only.
        XCTAssertTrue(el("emergency-flash").waitForExistence(timeout: 15), "the whole phone becomes the alarm")
        XCTAssertTrue(app.staticTexts["CODE BLUE"].exists, "the word, beside the colour")
        shoot("nurse-flash")
        let flashTree = XCTAttachment(string: app.debugDescription); flashTree.name = "hierarchy-flash"; flashTree.lifetime = .keepAlways; add(flashTree)
        el("emergency-flash-silence").tap()
        let gone = NSPredicate(format: "exists == false")
        let silenced = XCTNSPredicateExpectation(predicate: gone, object: el("emergency-flash"))
        XCTAssertEqual(XCTWaiter().wait(for: [silenced], timeout: 5), .completed, "silenced on this phone")
        XCTAssertTrue(api.responders().filter { ($0["code_blue_id"] as? String) == arrest }.isEmpty, "silencing is not responding")
        el("module-action-code-blue").tap()
        XCTAssertTrue(el("screen-code-blue").waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Ward 3 bed 4 \(Api.runId)"].waitForExistence(timeout: 10))
        XCTAssertTrue(el("code-blue-nobody-\(arrest)").waitForExistence(timeout: 5), "nobody yet is words, never a blank")
        el("code-blue-respond").firstMatch.tap()
        let mineNow = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'You are responding'")).firstMatch
        XCTAssertTrue(mineNow.waitForExistence(timeout: 10), "the button now says so")
        let mine = api.responders().filter { ($0["code_blue_id"] as? String) == arrest && ($0["user_id"] as? String) == nurse.id }
        XCTAssertEqual(mine.count, 1, "Responding is recorded as an arrival on the server")
        shoot("nurse-code-blue-responding")
    }

    func testTransfusionChartOwesTheFifteenMinuteCheck() {
        let witness = api.provision("nurse"); defer { api.retire(witness) }
        XCTAssertNotNil(api.transfusion(admission, secondNurseId: witness.id), "a unit hung on the bed")
        openWorkspace()
        el("workspace-transfusions").tap()
        XCTAssertTrue(el("screen-transfusions").waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["BAG BAG-\(Api.runId)"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["15 minutes in"].exists, "the phase that catches a haemolytic reaction has its own name")
        XCTAssertTrue(app.staticTexts["running"].exists)
        shoot("nurse-transfusion")
    }

    func testAnOutageIsNeverAQuietWard() {
        app.terminate()
        app.launchArguments = ["-baseURL", "http://127.0.0.1:9"]
        app.launch()
        // The kept session hydrates without the network; the board must then say it could not ask.
        XCTAssertTrue(el("module-home-nurse").waitForExistence(timeout: 15))
        el("module-action-calls").tap()
        XCTAssertTrue(el("nurse-calls-unavailable").waitForExistence(timeout: 30), "an outage is named, not rendered as emptiness")
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Do not read this as a quiet ward'")).firstMatch.exists)
        XCTAssertFalse(el("nurse-calls-empty").exists)
        shoot("nurse-calls-unavailable")
    }
}
