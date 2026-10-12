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
        // A save-password prompt from the last sign-in covers the Account
        // menu, and while it fades the menu cannot be reached: keep declining
        // it until the menu can be tapped.
        // It arrives seconds after sign-in: wait it out first, or it opens
        // over the menu and closes it.
        declineSavePassword(app)
        if username.exists { return }
        let account = app.navigationBars.buttons["Account"].firstMatch
        let reachBy = Date().addingTimeInterval(15)
        while !(account.exists && account.isHittable), Date() < reachBy {
            // A retired account is signed out by the app itself meanwhile.
            if username.exists { return }
            let notNow = app.buttons["Not Now"].firstMatch
            if notNow.exists, notNow.isHittable { notNow.tap() }
            RunLoop.current.run(until: Date().addingTimeInterval(0.3))
        }
        account.tap()
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
    static func declineSavePassword(_ app: XCUIApplication) {
        // It can come in the app's tree or the system's (SpringBoard), and
        // later than the home screen: after a slow first load it arrived over
        // the list a runner was about to tap, and the tap landed on it.
        // A tap while it animates in is ignored and it stays, so keep
        // declining until it has been gone for a moment.
        let system = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let start = Date()
        let deadline = start.addingTimeInterval(10)
        var lastSeen: Date?
        while Date() < deadline {
            let shown = [app.buttons["Not Now"].firstMatch, system.buttons["Not Now"].firstMatch].first { $0.exists }
            if let shown {
                if shown.isHittable { shown.tap() }
                lastSeen = Date()
            } else if let seen = lastSeen, Date().timeIntervalSince(seen) > 1.5 {
                return
            } else if lastSeen == nil, Date().timeIntervalSince(start) > 6 {
                return
            }
            RunLoop.current.run(until: Date().addingTimeInterval(0.3))
        }
    }
}
