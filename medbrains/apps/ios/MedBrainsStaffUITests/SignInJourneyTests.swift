import XCTest

/// Sign-in and session, on the device:
/// - wrong password refused in words, values kept;
/// - a nurse provisioned this run lands on the Nurse module and sees only her modules;
/// - the session survives a relaunch (Keychain), and sign-out ends it;
/// - an account deactivated server-side is signed out on its next request — a
///   revoked nurse must not keep a live ward screen;
/// - an unreachable server says so on the form, never a spinner forever.
final class SignInJourneyTests: JourneyCase {

    override func setUp() {
        super.setUp()
    }


    private func typeCredentials(_ username: String, _ password: String) {
        let field = app.textFields["Username or email"]
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        field.tap(); field.typeText(username)
        app.secureTextFields["Password"].tap(); app.secureTextFields["Password"].typeText(password)
        app.buttons["signIn"].tap()
    }

    private func setHospitalCode(_ code: String) {
        let field = app.textFields["Hospital code"]
        XCTAssertTrue(field.waitForExistence(timeout: 5))
        field.tap()
        field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: ((field.value as? String) ?? "").count))
        if !code.isEmpty { field.typeText(code) }
    }

    private func signOut() {
        app.navigationBars.buttons["Account"].firstMatch.tap()
        app.buttons["Sign out"].tap()
        XCTAssertTrue(app.textFields["Username or email"].waitForExistence(timeout: 10))
    }

    /// Staff of more than one hospital name theirs; the code that signed in
    /// is kept for next time, a wrong one is refused in words, and clearing
    /// it forgets it.
    func testTheHospitalCodeSignsInIsRememberedAndCanBeForgotten() {
        let nurse = api.provision("nurse"); defer { api.retire(nurse) }
        app.launch(); Session.ensureSignedOut(app)
        tapWhenReady(el("enterHospitalCode"))
        setHospitalCode("NO-SUCH-HOSPITAL")
        typeCredentials(nurse.username, nurse.password)
        XCTAssertTrue(app.staticTexts["Wrong username, password or hospital code."].waitForExistence(timeout: 10))

        app.secureTextFields["Password"].tap()
        setHospitalCode("default")
        app.buttons["signIn"].tap()
        XCTAssertTrue(app.tabBars.buttons["Nurse"].waitForExistence(timeout: 15), "the right hospital signs in")
        signOut()
        XCTAssertEqual(app.textFields["Hospital code"].value as? String, "default", "kept for next time")
        shoot("signin-hospital-code")

        setHospitalCode("")
        typeCredentials(nurse.username, nurse.password)
        XCTAssertTrue(app.tabBars.buttons["Nurse"].waitForExistence(timeout: 15))
        signOut()
        XCTAssertTrue(el("enterHospitalCode").exists, "a cleared code is forgotten")
    }

    func testWrongPasswordIsRefusedInWordsAndTheUsernameStays() {
        app.launch(); Session.ensureSignedOut(app)
        let nurse = api.provision("nurse"); defer { api.retire(nurse) }
        typeCredentials(nurse.username, "wrong")
        XCTAssertTrue(app.staticTexts["Wrong username or password."].waitForExistence(timeout: 10))
        XCTAssertEqual(app.textFields["Username or email"].value as? String, nurse.username, "a refusal keeps what was typed")
        shoot("signin-wrong-password")
    }

    func testAProvisionedNurseLandsOnHerModulesAndOnlyHers() {
        let nurse = api.provision("nurse"); defer { api.retire(nurse) }
        app.launch(); Session.ensureSignedOut(app)
        typeCredentials(nurse.username, nurse.password)
        XCTAssertTrue(app.tabBars.buttons["Nurse"].waitForExistence(timeout: 15), "a nurse lands on Nurse")
        XCTAssertTrue(app.tabBars.buttons["Nurse"].isSelected, "registry order decides the landing")
        XCTAssertTrue(app.tabBars.buttons["Lab"].exists, "lab.orders.list is held by a nurse")
        XCTAssertFalse(app.tabBars.buttons["Doctor"].exists, "opd.visit.update is not")
        XCTAssertFalse(app.tabBars.buttons["Billing"].exists)
        shoot("signin-nurse-home")
        // The session survives a relaunch.
        app.terminate(); app.launch()
        XCTAssertTrue(app.tabBars.buttons["Nurse"].waitForExistence(timeout: 15), "the Keychain kept the session")
        app.navigationBars.buttons["Account"].firstMatch.tap()
        app.buttons["Sign out"].tap()
        XCTAssertTrue(app.textFields["Username or email"].waitForExistence(timeout: 10), "sign-out returns to the form")
        app.terminate(); app.launch()
        XCTAssertTrue(app.textFields["Username or email"].waitForExistence(timeout: 10), "and the session is gone for good")
    }

    func testADeactivatedAccountIsSignedOutOnItsNextRequest() {
        let nurse = api.provision("nurse")
        app.launch(); Session.ensureSignedOut(app)
        typeCredentials(nurse.username, nurse.password)
        XCTAssertTrue(app.tabBars.buttons["Nurse"].waitForExistence(timeout: 15))
        api.retire(nurse) // deactivated server-side while the app holds a token
        // The next request answers 401 — the flash poll may make it before the tap does.
        if el("module-action-calls").isHittable { el("module-action-calls").tap() }
        XCTAssertTrue(app.textFields["Username or email"].waitForExistence(timeout: 15), "a revoked account does not keep a ward screen")
        shoot("signin-revoked")
    }

    func testAnUnreachableServerIsNamedOnTheForm() {
        app.launchArguments = ["-baseURL", "http://127.0.0.1:9"]
        app.launch(); Session.ensureSignedOut(app)
        typeCredentials("native_nurse", "NativeNurse#2026")
        XCTAssertTrue(app.staticTexts["Could not reach the hospital server."].waitForExistence(timeout: 30))
        shoot("signin-unreachable")
    }
}
