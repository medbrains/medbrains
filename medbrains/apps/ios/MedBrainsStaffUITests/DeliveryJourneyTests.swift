import XCTest

/// A runner at the door. The pharmacy has given them a dispatched delivery
/// and the patient has been texted a code (`scripts/seed_delivery_run.sh`
/// does both through the real API and passes the run's values in):
///
/// - the runner opens on their deliveries, and this one is there;
/// - a wrong code is refused in words, and nothing is recorded;
/// - the patient's code hands it over, it leaves "Out with me", and the
///   server holds it as delivered.
final class DeliveryJourneyTests: JourneyCase {
    private let env = ProcessInfo.processInfo.environment

    func testARunnerHandsOverAgainstThePatientsCode() throws {
        guard let user = env["RUNNER_USER"], let password = env["RUNNER_PASS"],
              let delivery = env["DELIVERY_ID"], let code = env["DELIVERY_CODE"] else {
            throw XCTSkip("Seed a delivery first: eval \"$(scripts/seed_delivery_run.sh)\", passed as TEST_RUNNER_*")
        }
        app.launch()
        Session.signIn(app, as: user, password: password, home: "screen-deliveries")
        XCTAssertTrue(app.tabBars.buttons["Deliveries"].firstMatch.isSelected, "a runner opens on their deliveries")
        let row = el("delivery-\(delivery)")
        XCTAssertTrue(row.waitForExistence(timeout: 15), "the dispatched delivery is out with them")
        shoot("delivery-01-mine")
        row.tap()
        XCTAssertTrue(el("screen-handover").waitForExistence(timeout: 10))

        let field = el("handover-code")
        field.tap()
        field.typeText("000000")
        el("handover-delivered").tap()
        XCTAssertTrue(el("handover-error").waitForExistence(timeout: 10), "a wrong code is refused")
        XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "doesn't match")).firstMatch.exists)
        shoot("delivery-02-wrong-code")

        field.tap()
        field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: 6))
        field.typeText(code)
        el("handover-delivered").tap()
        XCTAssertTrue(el("screen-deliveries").waitForExistence(timeout: 10), "back on the list once handed over")
        let gone = NSPredicate(format: "exists == false")
        expectation(for: gone, evaluatedWith: el("delivery-\(delivery)"))
        waitForExpectations(timeout: 15)
        let delivered = (api.obj("GET", "/api/pharmacy/deliveries?status=delivered")["deliveries"] as? [[String: Any]]) ?? []
        XCTAssertTrue(delivered.contains { ($0["id"] as? String) == delivery }, "the server holds it as delivered")
        shoot("delivery-03-handed-over")
    }
}
