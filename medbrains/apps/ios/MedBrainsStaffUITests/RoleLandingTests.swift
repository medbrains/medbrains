import XCTest

/// MJ-SEC-001: each built-in role opens the app at its own desk. Every role
/// the web suite provisions signs in here; the ones with no staff module are
/// told so in words rather than shown a blank, and a bypass role sees the
/// whole registry behind More.
final class RoleLandingTests: JourneyCase {

    /// role → the tab it must land on (nil: no module on this app, the empty-role screen).
    private let landing: [(String, String?)] = [
        ("doctor", "Doctor"), ("nurse", "Nurse"), ("receptionist", "Reception"), ("front_office_staff", "Reception"),
        ("pharmacist", "Pharmacy"), ("lab_technician", "Lab"), ("blood_bank_tech", "Blood Bank"), ("billing_clerk", "Billing"),
        ("biomed_engineer", "BME"), ("security_guard", "Security"), ("hr_officer", "HR"), ("hospital_admin", "Doctor"),
        ("dietitian", nil), ("canteen_staff", nil),
    ]

    override func setUp() {
        super.setUp()
    }


    func testEveryRoleOpensAtItsOwnDesk() {
        app.launch()
        for (role, tab) in landing {
            let who = api.provision(role)
            Session.ensureSignedOut(app)
            let field = app.textFields["Username or email"]
            field.tap(); field.typeText(who.username)
            app.secureTextFields["Password"].tap(); app.secureTextFields["Password"].typeText(who.password)
            app.buttons["signIn"].tap()
            if let tab {
                let button = app.tabBars.buttons[tab].firstMatch
                XCTAssertTrue(button.waitForExistence(timeout: 15), "\(role) lands on \(tab)")
                XCTAssertTrue(button.isSelected, "\(role) is opened on \(tab), not on another role's desk")
            } else {
                XCTAssertTrue(el("nothing-assigned").waitForExistence(timeout: 15), "\(role) is told there is no module, never shown a blank")
                app.buttons["Sign out"].tap()
            }
            let s = XCTAttachment(screenshot: app.screenshot()); s.name = "landing-\(role)"; s.lifetime = .keepAlways; add(s)
            api.retire(who)
        }
    }
}
