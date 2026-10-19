import XCTest

/// The patient's way in and the hospital's record of them, proven against
/// the server. Only one sign-in is possible per run — the seeded code is
/// spent by it — so the signed-in scenarios share one test and the refusals
/// stand alone. Each run signs in as a fresh patient:
/// `TEST_RUNNER_PORTAL_PHONE=$(scripts/seed_portal_patient.sh 424242)`
/// (a fixed phone drifts — one run admitted it, and nothing opens an OPD
/// visit for a patient in hospital).
///
/// - An unregistered number and a registered one get the same reply: the code
///   step, and no wording that says which it was.
/// - A wrong code is refused with the number kept, so the patient corrects the
///   code rather than starting over.
/// - The seeded code opens the hospital record; a bill the desk raised this
///   run appears with the server's total, the outstanding figure is the sum of
///   the server's balances, the Health tab appears only after the hospital
///   licenses the companion (and survives a relaunch, which the session does
///   too), and signing out returns to the phone step.
/// - An unreachable hospital names itself; it never blames the number.
final class PatientJourneyTests: XCTestCase {
    private var app: XCUIApplication!
    private let phone = ProcessInfo.processInfo.environment["PORTAL_PHONE"] ?? "9876500777"
    private let backend = ProcessInfo.processInfo.environment["MEDBRAINS_BASE_URL"] ?? "http://127.0.0.1:3000"

    override func setUp() {
        continueAfterFailure = false
        app = XCUIApplication()
    }

    private func launch(baseURL: String? = nil) {
        app.launchArguments = ["-baseURL", baseURL ?? backend, "-hospitalCode", "DEFAULT"]
        app.launch()
    }

    private func el(_ id: String) -> XCUIElement { app.descendants(matching: .any)[id] }

    private func waitAny(_ ids: [String], timeout: TimeInterval = 10) -> String? {
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            if let hit = ids.first(where: { el($0).exists }) { return hit }
            RunLoop.current.run(until: Date().addingTimeInterval(0.25))
        }
        return nil
    }

    /// The Keychain keeps the session between launches; hydration takes a moment either way.
    private func signOutIfSignedIn() {
        let where_ = waitAny(["phone", "patient-home"])
        if where_ == "phone" { return }
        XCTAssertEqual(where_, "patient-home", "the app opens on the phone step or the record, nothing else")
        app.navigationBars.buttons["Account"].firstMatch.tap()
        app.buttons["Sign out"].tap()
        XCTAssertTrue(el("phone").waitForExistence(timeout: 10))
    }

    private func enterPhone(_ number: String) {
        el("phone").tap()
        el("phone").typeText(number)
    }

    private func shoot(_ name: String) {
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = name
        shot.lifetime = .keepAlways
        add(shot)
    }

    /// Wait for `element`; when it never comes, keep the screen and its tree.
    private func waitOrDump(_ id: String, timeout: TimeInterval = 10) -> Bool {
        if el(id).waitForExistence(timeout: timeout) { return true }
        shoot("missing-\(id)")
        let tree = XCTAttachment(string: app.debugDescription)
        tree.name = "tree"
        tree.lifetime = .keepAlways
        add(tree)
        return false
    }

    private func sees(_ text: String) -> Bool { app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", text)).firstMatch.exists }

    // MARK: privacy
    /// From the record, the patient changes what they agree to and makes a
    /// request — part of the signed-in walk, because the seeded code signs in once.
    private func privacyStep(_ seed: PortalSeed, patientId: String) {
        let reminders = "health_reminders"
        let hadReminders = seed.dpdpConsent(patientId: patientId).purposes.contains(reminders)
        let requestsBefore = seed.privacyRequests(patientId: patientId).count
        el("module-consent").tap()
        XCTAssertTrue(waitOrDump("screen-privacy"))
        XCTAssertTrue(waitOrDump("privacy-save"), "the notice and the choices load")
        XCTAssertFalse(el("privacy-save").isEnabled, "nothing to save until a choice changes")

        // The patient changes their mind about reminders, and saves it themselves.
        let toggle = app.switches["purpose-\(reminders)"]
        XCTAssertTrue(toggle.waitForExistence(timeout: 5))
        // The switch itself, not its label: a tap on the text does not flip it.
        if toggle.switches.firstMatch.exists { toggle.switches.firstMatch.tap() } else { toggle.tap() }
        XCTAssertTrue(el("privacy-save").isEnabled)
        el("privacy-save").tap()
        XCTAssertTrue(waitOrDump("privacy-outcome"))
        let after = seed.dpdpConsent(patientId: patientId)
        XCTAssertEqual(after.purposes.contains(reminders), !hadReminders, "the server holds the patient's new choice")
        XCTAssertEqual(after.source, "portal", "recorded as the patient's own decision")
        shoot("patient-06c-privacy-saved")

        // Their record, downloaded to hand on — the share sheet is the phone's own.
        el("privacy-export").tap()
        XCTAssertTrue(waitOrDump("privacy-share-export", timeout: 15), "the record downloaded and can be shared")

        // A request, made from the phone, reaches the privacy officer's register.
        el("privacy-make-request").tap()
        XCTAssertTrue(waitOrDump("request-details"))
        el("request-details").tap()
        el("request-details").typeText("Please show me everything you hold about me")
        app.buttons["request-send"].firstMatch.tap()
        XCTAssertTrue(waitOrDump("privacy-outcome"))
        let requests = seed.privacyRequests(patientId: patientId)
        XCTAssertEqual(requests.count, requestsBefore + 1)
        XCTAssertEqual(requests.first?["received_via"] as? String, "portal")
        shoot("patient-06d-privacy-request")
        app.navigationBars.buttons.element(boundBy: 0).tap()
    }

    // MARK: refusals

    func testUnregisteredAndRegisteredNumbersGetTheSameReply() {
        guard let registered = PortalSeed.admin().registeredPhone() else { return XCTFail("a patient registered this run") }
        launch()
        signOutIfSignedIn()
        shoot("patient-01-login")
        enterPhone("9876599999")
        el("sendCode").tap()
        XCTAssertTrue(el("code").waitForExistence(timeout: 10), "an unknown number is not told it is unknown")
        XCTAssertFalse(sees("not registered") || sees("no patient") || sees("unknown"), "no existence oracle on the screen")
        shoot("patient-02-code-step-unregistered")
        el("changePhone").tap()
        XCTAssertTrue(el("phone").waitForExistence(timeout: 5))
        el("phone").tap()
        el("phone").typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: 10))
        el("phone").typeText(registered)
        el("sendCode").tap()
        XCTAssertTrue(el("code").waitForExistence(timeout: 10), "a known number gets exactly the same step")
    }

    func testAWrongCodeIsRefusedAndTheNumberIsKept() {
        launch()
        signOutIfSignedIn()
        enterPhone(phone)
        el("haveCode").tap()
        XCTAssertTrue(el("code").waitForExistence(timeout: 5))
        el("code").tap()
        el("code").typeText("000000")
        el("verify").tap()
        XCTAssertTrue(app.staticTexts["That code did not work. Check it, or ask for a new one."].waitForExistence(timeout: 10), "refused in the patient's words")
        XCTAssertTrue(el("code").exists, "still on the code step: the patient corrects the code, not the number")
        shoot("patient-03-wrong-code")
        el("changePhone").tap()
        XCTAssertTrue(el("phone").waitForExistence(timeout: 5))
        XCTAssertEqual(el("phone").value as? String, phone, "the number the patient typed is kept")
    }

    func testAnUnreachableHospitalNamesItself() {
        launch(baseURL: "http://127.0.0.1:9")
        XCTAssertEqual(waitAny(["phone", "patient-home"]), "phone", "no cached session on this phone for a server that never answered")
        enterPhone(phone)
        el("sendCode").tap()
        XCTAssertTrue(app.staticTexts["Could not reach the hospital server."].waitForExistence(timeout: 15), "an outage is named, never blamed on the number")
        XCTAssertFalse(sees("Check the number"), "the number was fine")
        shoot("patient-04-unreachable")
    }

    // MARK: the record

    func testTheSeededCodeOpensTheRecordTheDeskHolds() {
        let seed = PortalSeed.admin()
        guard let patientId = seed.patientId(phone: phone) else { return XCTFail("the seeded phone belongs to a patient on DEFAULT") }
        seed.setModule("companion", enabled: false)
        defer { seed.setModule("companion", enabled: false) }
        guard let bill = seed.invoice(patientId: patientId, amount: 1_234.50) else { return XCTFail("the desk raises a bill through the real API") }
        XCTAssertEqual(bill.total, 1_234.50, accuracy: 0.001, "the server holds the charge")
        let owed = seed.outstanding(patientId: patientId)
        guard let rx = seed.dispensedPrescription(patientId: patientId) else { return XCTFail("a prescription written and dispensed through the real API") }
        let waitingBefore = seed.refillRequestsAwaiting(drug: rx.drug)

        launch()
        signOutIfSignedIn()
        enterPhone(phone)
        el("haveCode").tap()
        XCTAssertTrue(el("code").waitForExistence(timeout: 5))
        el("code").tap()
        el("code").typeText("424242")
        el("verify").tap()
        XCTAssertTrue(el("tab-hospital").waitForExistence(timeout: 15), "the hospital record opens")
        shoot("patient-05-hospital")
        for module in ["appointments", "lab-reports", "prescriptions", "bills", "consent", "family-share"] {
            XCTAssertTrue(el("module-\(module)").exists, "\(module) is offered")
        }
        XCTAssertFalse(app.tabBars.buttons["Health"].exists, "the companion stays hidden while the hospital has not licensed it")

        el("module-bills").tap()
        XCTAssertTrue(el("screen-bills").waitForExistence(timeout: 10))
        XCTAssertEqual(waitAny(["bills-list", "bills-empty", "bills-unavailable"]), "bills-list", "the bill raised this run is on the phone")
        XCTAssertTrue(sees(bill.number), "named by the server's invoice number")
        XCTAssertTrue(sees(String(format: "₹%.2f", bill.total)), "the server's total, not a client sum")
        XCTAssertTrue(sees(String(format: "₹%.2f due", bill.balance)), "unpaid, and says so")
        XCTAssertTrue(sees(String(format: "₹%.2f", owed)), "still to pay = the sum of the server's balances")
        shoot("patient-06-bills")
        app.navigationBars.buttons.element(boundBy: 0).tap()

        // The month's supply runs out: the patient asks, and it goes to the doctor.
        el("module-prescriptions").tap()
        XCTAssertTrue(el("screen-prescriptions").waitForExistence(timeout: 10))
        // The button names the prescription it asks for.
        XCTAssertTrue(waitOrDump("request-refill-\(rx.id)"), "the dispensed prescription is offered for refill")
        let ask = el("request-refill-\(rx.id)")
        XCTAssertTrue(sees("approves it first"), "told the doctor decides, before asking")
        ask.tap()
        XCTAssertTrue(el("refill-outcome").waitForExistence(timeout: 10))
        XCTAssertTrue(sees("With your doctor"), "the request shows where it is")
        XCTAssertEqual(seed.refillRequestsAwaiting(drug: rx.drug), waitingBefore + 1, "and it is in the prescriber's sign-offs")
        shoot("patient-06b-refill-requested")
        app.navigationBars.buttons.element(boundBy: 0).tap()
        privacyStep(seed, patientId: patientId)

        seed.setModule("companion", enabled: true)
        app.terminate()
        launch()
        XCTAssertTrue(el("patient-home").waitForExistence(timeout: 15), "the session survived the relaunch")
        XCTAssertTrue(app.tabBars.buttons["Health"].waitForExistence(timeout: 10), "licensing the companion at the hospital puts Health on the phone")
        app.tabBars.buttons["Health"].tap()
        XCTAssertTrue(el("tab-health").waitForExistence(timeout: 10))
        shoot("patient-07-health-licensed")

        seed.setModule("companion", enabled: false)
        app.terminate()
        launch()
        XCTAssertTrue(el("patient-home").waitForExistence(timeout: 15))
        XCTAssertFalse(app.tabBars.buttons["Health"].waitForExistence(timeout: 5), "dropping the licence takes Health away again")

        app.navigationBars.buttons["Account"].firstMatch.tap()
        app.buttons["Sign out"].tap()
        XCTAssertTrue(el("phone").waitForExistence(timeout: 10), "signed out: back to the phone step")
        app.terminate()
        launch()
        XCTAssertEqual(waitAny(["phone", "patient-home"]), "phone", "nothing of the session survives a sign-out")
        shoot("patient-08-signed-out")
    }
}
