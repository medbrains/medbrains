import XCTest

/// The Keychain keeps whoever signed in last, so a suite's order would decide
/// what each test sees. Every journey therefore starts from a known session:
/// signed out, or signed in as the role it needs.
enum Session {
    static func el(_ app: XCUIApplication, _ id: String) -> XCUIElement { app.descendants(matching: .any)[id] }

    private static func onAHome(_ app: XCUIApplication) -> Bool {
        app.navigationBars.buttons["Account"].firstMatch.exists || app.tabBars.firstMatch.exists
    }

    static func ensureSignedOut(_ app: XCUIApplication) {
        let username = app.textFields["Username or email"]
        let deadline = Date().addingTimeInterval(10)
        while !username.exists, !onAHome(app), Date() < deadline { RunLoop.current.run(until: Date().addingTimeInterval(0.25)) }
        if username.exists { return }
        app.navigationBars.buttons["Account"].firstMatch.tap()
        app.buttons["Sign out"].tap()
        XCTAssertTrue(username.waitForExistence(timeout: 10), "signed out")
    }

    static func signIn(_ app: XCUIApplication, as username: String, password: String, home: String) {
        let field = app.textFields["Username or email"]
        let deadline = Date().addingTimeInterval(10)
        while !field.exists, !onAHome(app), Date() < deadline { RunLoop.current.run(until: Date().addingTimeInterval(0.25)) }
        // Never reuse a home already showing: identities are provisioned per
        // test, so the kept session belongs to an account the last test
        // retired, and its next request signs the app out mid-journey.
        if !field.exists { ensureSignedOut(app) }
        field.tap()
        field.typeText(username)
        if (field.value as? String) != username {
            // A keystroke from the previous screen can land first; clear and say it again.
            field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: ((field.value as? String) ?? "").count))
            field.typeText(username)
        }
        app.secureTextFields["Password"].tap()
        app.secureTextFields["Password"].typeText(password)
        app.buttons["signIn"].tap()
        XCTAssertTrue(el(app, home).waitForExistence(timeout: 15), "lands on \(home)")
        declineSavePassword(app)
    }

    /// iOS 26 offers to save the password after every sign-in, in a system
    /// sheet over the app that takes the first tap of the journey. The sheet
    /// is hosted remotely but sits in the app's own element tree.
    private static func declineSavePassword(_ app: XCUIApplication) {
        let notNow = app.sheets.buttons["Not Now"]
        guard notNow.waitForExistence(timeout: 3) else { return }
        notNow.tap()
        // A tap while it slides away lands on nothing.
        _ = app.sheets.firstMatch.waitForNonExistence(timeout: 5)
    }
}
