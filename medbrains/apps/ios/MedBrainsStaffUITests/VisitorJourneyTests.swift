import XCTest

/// The visitor and enquiry desks, proven against the record. Scenarios from
/// docs/plans/native-front-office.md; mirrors VisitorJourneyTest.kt.
final class VisitorJourneyTests: JourneyCase {
    private var desk: Api.Identity!

    override func setUp() {
        super.setUp()
        desk = api.provision("receptionist")
        app.launch()
        Session.signIn(app, as: desk.username, password: desk.password, home: "module-home-reception")
    }

    override func tearDown() { api.retire(desk) }

    private func openVisitors() {
        el("module-action-visitors").tap()
        XCTAssertTrue(el("screen-visitor-desk").waitForExistence(timeout: 10))
    }

    private func passOnServer(_ id: String) -> [String: Any]? {
        api.passes().first { ($0["id"] as? String) == id }
    }

    func testRegisteringAVisitorIssuesTheirPassInOneAct() {
        openVisitors()
        el("visitor-register").tap()
        XCTAssertTrue(el("screen-register-visitor").waitForExistence(timeout: 10))
        type("field-visitor-name", "Asha Visitor \(Api.runId)")
        type("field-visitor-phone", "9812\(Api.runId)")
        type("field-visitor-relationship", "daughter")
        tapWhenReady(el("visitor-submit"))
        XCTAssertTrue(el("issued-pass").waitForExistence(timeout: 15), "the pass is issued in the same act")
        shoot("visitor-pass-issued")
        let number = el("issued-pass").label
        guard let registered = api.list("/api/front-office/visitors").first(where: { ($0["visitor_name"] as? String)?.contains("Asha Visitor \(Api.runId)") ?? false }),
              let regId = registered["id"] as? String else { return XCTFail("the visitor is on the server") }
        guard let pass = api.passes().first(where: { ($0["registration_id"] as? String) == regId }) else { return XCTFail("a pass was issued against them") }
        XCTAssertEqual(pass["pass_number"] as? String, number, "the number on screen is the server's")
        XCTAssertEqual(pass["status"] as? String, "active")
    }

    func testCheckingInThenOutMovesTheCountInside() {
        let visitor = api.visitor("Inside")
        guard let regId = visitor["id"] as? String, let passId = api.pass(regId)["id"] as? String else { return XCTFail("seeded a pass") }
        openVisitors()
        XCTAssertTrue(reveal("pass-row-\(passId)"), "the pass is on the board")
        tapWhenReady(el("pass-check-in-\(passId)"))
        XCTAssertTrue(el("pass-check-out-\(passId)").waitForExistence(timeout: 15), "signed in, so the way out is what is offered")
        guard let log = api.visitorLogs().first(where: { ($0["pass_id"] as? String) == passId }) else { return XCTFail("the log records the arrival") }
        XCTAssertNotNil(log["check_in_at"] as? String)
        shoot("visitor-inside")
        tapWhenReady(el("pass-check-out-\(passId)"))
        XCTAssertTrue(el("pass-check-in-\(passId)").waitForExistence(timeout: 15), "signed out, so the way in is offered again")
        let after = api.visitorLogs().first { ($0["pass_id"] as? String) == passId }
        XCTAssertNotNil(after?["check_out_at"] as? String, "the log carries both times")
    }

    /// A pass whose hours ran out but which nobody revoked. The person is
    /// very likely still upstairs, and the desk is the only place that finds out.
    func testALapsedPassIsCalledOverdueAndStillCountsAsInside() {
        let visitor = api.visitor("Overdue")
        guard let regId = visitor["id"] as? String, let passId = api.pass(regId, hours: -1)["id"] as? String else { return XCTFail("seeded a lapsed pass") }
        // They came in while the pass was good; nobody signed them out.
        api.call("POST", "/api/front-office/visitor-logs/\(passId)/check-in")
        openVisitors()
        XCTAssertTrue(reveal("pass-row-\(passId)"))
        XCTAssertEqual(passOnServer(passId)?["status"] as? String, "active", "the server still stores it as active — that is the point")
        XCTAssertTrue(el("pass-overdue-\(passId)").exists, "the desk calls it overdue, not expired")
        XCTAssertTrue(sees("still counted as inside"), "and says the person has not been signed out")
        shoot("visitor-overdue")
        XCTAssertTrue(el("pass-check-in-\(passId)").exists || el("pass-check-out-\(passId)").exists, "there is still a way to end the visit")
    }

    func testARevokedPassOffersNothingAndKeepsItsReason() {
        let visitor = api.visitor("Revoked")
        guard let regId = visitor["id"] as? String, let passId = api.pass(regId)["id"] as? String else { return XCTFail("seeded a pass") }
        api.revokePass(passId, reason: "Wrong ward \(Api.runId)")
        openVisitors()
        XCTAssertTrue(reveal("pass-row-\(passId)"))
        XCTAssertTrue(el("pass-revoked-\(passId)").exists, "the reason is on the row")
        XCTAssertTrue(sees("Wrong ward \(Api.runId)"))
        XCTAssertFalse(el("pass-check-in-\(passId)").exists || el("pass-check-out-\(passId)").exists, "a revoked pass offers nothing the server would accept")
        XCTAssertEqual(passOnServer(passId)?["status"] as? String, "revoked")
        shoot("visitor-revoked")
    }

    func testLoggingAnEnquiryThenResolvingIt() {
        el("module-action-enquiries").tap()
        XCTAssertTrue(el("screen-enquiry-desk").waitForExistence(timeout: 10))
        el("enquiry-log").tap()
        XCTAssertTrue(el("screen-log-enquiry").waitForExistence(timeout: 10))
        type("field-caller-name", "Ramesh \(Api.runId)")
        type("field-caller-phone", "9700\(Api.runId)")
        let said = "Visiting hours are four to six \(Api.runId)"
        type("field-enquiry-response", said)
        tapWhenReady(el("enquiry-submit"))
        XCTAssertTrue(el("screen-enquiry-desk").waitForExistence(timeout: 15), "back at the desk with it logged")
        guard let logged = api.enquiries().first(where: { ($0["response_text"] as? String) == said }), let id = logged["id"] as? String else { return XCTFail("the enquiry is on the server") }
        XCTAssertEqual(logged["resolved"] as? Bool, false, "logged open")
        XCTAssertTrue(reveal("enquiry-row-\(id)"))
        shoot("enquiry-open")
        tapWhenReady(el("enquiry-resolve-\(id)"))
        let gone = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: el("enquiry-resolve-\(id)"))
        XCTAssertEqual(XCTWaiter().wait(for: [gone], timeout: 15), .completed, "resolved, so it offers nothing more")
        XCTAssertEqual(api.enquiries().first { ($0["id"] as? String) == id }?["resolved"] as? Bool, true, "resolved on the server")
    }

    /// `front_office_staff` holds `enquiry.list` and nothing else on this desk.
    func testFrontOfficeStaffReadsTheEnquiryDeskButCannotLogOrResolve() {
        let gate = api.provision("front_office_staff")
        defer { api.retire(gate) }
        let said = "Told them the ward number \(Api.runId)"
        guard let id = api.enquiry(said)["id"] as? String else { return XCTFail("seeded an enquiry") }
        Session.ensureSignedOut(app)
        Session.signIn(app, as: gate.username, password: gate.password, home: "module-home-reception")
        el("module-action-enquiries").tap()
        XCTAssertTrue(el("screen-enquiry-desk").waitForExistence(timeout: 10))
        XCTAssertTrue(el("enquiry-read-only").exists, "the desk says what this account may not do")
        XCTAssertFalse(el("enquiry-log").exists, "no logging without the code for it")
        XCTAssertTrue(reveal("enquiry-row-\(id)"), "but it can still read the desk")
        XCTAssertFalse(el("enquiry-resolve-\(id)").exists, "and cannot resolve")
        shoot("enquiry-read-only")
    }
}
