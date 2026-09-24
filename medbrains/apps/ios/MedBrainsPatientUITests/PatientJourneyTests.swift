import XCTest

/// The patient's way in and the hospital's record of them, proven against
/// the server. Only one sign-in is possible per run — the seeded code
/// (`scripts/seed_portal_otp.sh 9876500777 424242`) is spent by it — so the
/// signed-in scenarios share one test and the refusals stand alone.
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
    private let phone = "9876500777"
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

    private func sees(_ text: String) -> Bool { app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", text)).firstMatch.exists }

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
