import XCTest

/// Sign-in and session, on the device:
/// - sign-in starts with the hospital: a wrong code is refused before any
///   credentials, the right one names the hospital, and it is remembered;
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


    /// Past step 1 to the hospital's form, whichever step the app opened on.
    private func reachTheForm() {
        let field = app.textFields["Username or email"]
        let code = app.textFields["Hospital code"]
        let deadline = Date().addingTimeInterval(10)
        while !field.exists, !code.exists, Date() < deadline { RunLoop.current.run(until: Date().addingTimeInterval(0.25)) }
        if code.exists, !field.exists { chooseHospital("default") }
        XCTAssertTrue(field.waitForExistence(timeout: 10))
    }

    private func chooseHospital(_ value: String) {
        let code = app.textFields["Hospital code"]
        XCTAssertTrue(code.waitForExistence(timeout: 10))
        code.tap()
        code.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: ((code.value as? String) ?? "").count))
        code.typeText(value)
        app.buttons["hospitalContinue"].tap()
    }

    private func typeCredentials(_ username: String, _ password: String) {
        reachTheForm()
        let field = app.textFields["Username or email"]
        field.tap(); field.typeText(username)
        app.secureTextFields["Password"].tap(); app.secureTextFields["Password"].typeText(password)
        app.buttons["signIn"].tap()
    }

    private func signOut() {
        Session.declineSavePassword(app)
        app.navigationBars.buttons["Account"].firstMatch.tap()
        app.buttons["Sign out"].tap()
        XCTAssertTrue(app.textFields["Username or email"].waitForExistence(timeout: 10))
    }

    /// The hospital comes first. A code no hospital uses is refused before
    /// anything else is asked; the right one names the hospital; the code
    /// that signed in is kept, so sign-out returns to that hospital's form,
    /// and "Change hospital" goes back to the start.
    func testSignInStartsWithTheHospitalAndRemembersIt() {
        let nurse = api.provision("nurse"); defer { api.retire(nurse) }
        app.launch(); Session.ensureSignedOut(app)
        if el("changeHospital").waitForExistence(timeout: 5) { el("changeHospital").tap() }
        chooseHospital("NO-SUCH-HOSPITAL")
        XCTAssertTrue(
            app.staticTexts["No hospital uses the code \"NO-SUCH-HOSPITAL\". Check it with your IT desk."].waitForExistence(timeout: 10),
            "a wrong code is refused in words"
        )
        XCTAssertFalse(app.textFields["Username or email"].exists, "nothing else is asked before the hospital")

        chooseHospital("default")
        XCTAssertTrue(app.textFields["Username or email"].waitForExistence(timeout: 10))
        XCTAssertNotEqual(el("hospitalName").label, "Start with your hospital.", "the hospital is named")
        typeCredentials(nurse.username, nurse.password)
        XCTAssertTrue(app.tabBars.buttons["Nurse"].waitForExistence(timeout: 15), "the right hospital signs in")
        signOut()
        XCTAssertTrue(el("changeHospital").waitForExistence(timeout: 5), "sign-out returns to the same hospital")
        shoot("signin-hospital-remembered")

        el("changeHospital").tap()
        XCTAssertTrue(app.textFields["Hospital code"].waitForExistence(timeout: 5), "changing hospital starts again")
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
        // The next request answers 401: the flash poll makes one within seconds.
        let signedOut = Date().addingTimeInterval(30)
        while !app.textFields["Username or email"].exists, !app.textFields["Hospital code"].exists, Date() < signedOut {
            RunLoop.current.run(until: Date().addingTimeInterval(0.5))
        }
        XCTAssertTrue(app.textFields["Username or email"].exists || app.textFields["Hospital code"].exists, "a revoked account does not keep a ward screen")
        shoot("signin-revoked")
    }

    func testAnUnreachableServerIsNamedOnTheForm() {
        app.launchArguments = ["-baseURL", "http://127.0.0.1:9"]
        app.launch(); Session.signOutIfNeeded(app)
        // The hospital lookup is the first request: it must say the server
        // is unreachable, never that the code is wrong.
        if app.textFields["Hospital code"].waitForExistence(timeout: 10) == false { el("changeHospital").tap() }
        chooseHospital("default")
        let problem = app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "connection problem, not a wrong code")).firstMatch
        XCTAssertTrue(problem.waitForExistence(timeout: 30))
        shoot("signin-unreachable")
    }
}
