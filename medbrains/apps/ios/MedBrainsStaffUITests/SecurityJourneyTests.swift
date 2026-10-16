import XCTest

/// A guard's visiting hours, in one sign-in: passes at the gate, who is
/// inside, an incident on the round, a tag alert. Every screen is left and
/// come back to, and must still hold what it held. Plan:
/// docs/native/UI-PLANS-PLACEHOLDER-MODULES.md §1; mirrors SecurityJourneyTest.kt.
final class SecurityJourneyTests: JourneyCase {
    private var guardian: Api.Identity!

    override func setUp() {
        super.setUp()
        guardian = api.provision("security_guard")
        app.launch()
        Session.signIn(app, as: guardian.username, password: guardian.password, home: "screen-security")
    }

    override func tearDown() { api.retire(guardian) }

    private func scan(_ code: String) {
        type("barcode-manual", code)
        tapWhenReady(el("barcode-manual-submit"))
        XCTAssertTrue(el("security-verdict-band").waitForExistence(timeout: 15), "the server answers for \(code)")
    }

    private func band() -> String { el("security-verdict-band").label }

    private func openLog(_ passId: String) -> [String: Any]? {
        api.visitorLogs().first { ($0["pass_id"] as? String) == passId && ($0["check_out_at"] as? String) == nil }
    }

    private func back() { app.navigationBars.buttons.element(boundBy: 0).tap() }

    func testAGuardWorksVisitingHours() {
        let good = (api.visitor("Gate")["id"] as? String).map { api.pass($0) } ?? [:]
        let bad = (api.visitor("Barred")["id"] as? String).map { api.pass($0) } ?? [:]
        guard let goodId = good["id"] as? String, let goodNumber = good["pass_number"] as? String,
              let badId = bad["id"] as? String, let badNumber = bad["pass_number"] as? String
        else { return XCTFail("seeded two passes") }
        api.revokePass(badId, reason: "Banned by ward \(Api.runId)")
        guard let seededIncident = api.securityIncident("Seeded round \(Api.runId)")["id"] as? String else { return XCTFail("seeded an incident") }
        guard let alertId = api.tagAlert() else { return XCTFail("seeded a tag alert") }

        // 1–2. The gate: a good pass lets in, and entry is recorded on the server.
        XCTAssertTrue(app.tabBars.buttons["Security"].firstMatch.isSelected, "a guard opens on Security")
        scan(goodNumber)
        XCTAssertTrue(band().contains("Let in"), "the band says let in: \(band())")
        tapWhenReady(el("security-record-entry"))
        XCTAssertTrue(el("security-recorded").waitForExistence(timeout: 15))
        XCTAssertNotNil(openLog(goodId), "the entry is on the server")
        shoot("security-let-in")
        tapWhenReady(el("security-scan-next"))

        // 3. A revoked pass is refused in words, and offers nothing to record.
        scan(badNumber)
        XCTAssertTrue(band().contains("Revoked"), "the band names why: \(band())")
        XCTAssertTrue(sees("Banned by ward \(Api.runId)"), "with the desk's reason")
        XCTAssertFalse(el("security-record-entry").exists, "no way to let a revoked pass in")
        shoot("security-revoked")
        tapWhenReady(el("security-scan-next"))

        // 4. Inside now lists the visitor; opening the row and closing it changes nothing.
        app.buttons["Inside now"].firstMatch.tap()
        XCTAssertTrue(reveal("security-inside-\(goodId)"), "the visitor let in is inside")
        tapWhenReady(el("security-inside-\(goodId)"))
        XCTAssertTrue(el("security-record-exit").waitForExistence(timeout: 15), "inside, so the way out is offered")
        tapWhenReady(el("security-scan-next"))
        XCTAssertTrue(el("security-inside-\(goodId)").waitForExistence(timeout: 10), "still listed after the sheet closes")

        // 5. A report abandoned with Back is discarded: nothing reaches the server.
        app.buttons["Incidents"].firstMatch.tap()
        XCTAssertTrue(reveal("security-incident-\(seededIncident)"), "the open incident is listed")
        tapWhenReady(el("security-incident-report"))
        XCTAssertTrue(el("screen-security-report").waitForExistence(timeout: 10))
        let abandoned = "Abandoned report \(Api.runId)"
        type("field-incident-description", abandoned)
        back()
        XCTAssertTrue(el("security-incident-\(seededIncident)").waitForExistence(timeout: 10), "the list is intact")
        XCTAssertFalse(api.securityIncidents().contains { ($0["description"] as? String) == abandoned }, "nothing was saved")

        // 6. Reported for real, it is on the server and on the list.
        tapWhenReady(el("security-incident-report"))
        XCTAssertTrue(el("screen-security-report").waitForExistence(timeout: 10))
        XCTAssertTrue(choose("picker-incident-category", "Theft"), "the category is offered")
        let reported = "Bag left at gate 2 \(Api.runId)"
        type("field-incident-description", reported)
        type("field-incident-location", "Gate 2")
        tapWhenReady(el("security-incident-submit"))
        XCTAssertTrue(el("screen-security").waitForExistence(timeout: 15), "back on the register")
        guard let newId = api.securityIncidents().first(where: { ($0["description"] as? String) == reported })?["id"] as? String
        else { return XCTFail("the report is on the server") }
        XCTAssertTrue(reveal("security-incident-\(newId)"), "and on the list")
        shoot("security-incident-reported")

        // 7. An update on the new incident, then back.
        tapWhenReady(el("security-incident-\(newId)"))
        XCTAssertTrue(el("screen-security-incident").waitForExistence(timeout: 10))
        let update = "Owner found, bag returned \(Api.runId)"
        type("field-incident-update", update)
        tapWhenReady(el("security-incident-add-update"))
        XCTAssertTrue(sees(update, timeout: 15), "the update is on the timeline")
        XCTAssertTrue(api.list("/api/security/incidents/\(newId)/updates").contains { ($0["description"] as? String) == update }, "and on the server")
        back()

        // 8. Away to another desk and back: the register still holds both incidents.
        app.buttons["Gate scan"].firstMatch.tap()
        XCTAssertTrue(el("barcode-manual").waitForExistence(timeout: 10))
        app.buttons["Incidents"].firstMatch.tap()
        XCTAssertTrue(reveal("security-incident-\(newId)"), "the new incident survived the desk switch")

        // 9. The Code Pink banner leads to the alert; resolving it is recorded with the reason.
        XCTAssertTrue(el("security-code-pink-banner").waitForExistence(timeout: 20), "an open tag alert shows above every desk")
        tapWhenReady(el("security-code-pink-banner"))
        XCTAssertTrue(el("screen-security-tag-alerts").waitForExistence(timeout: 10))
        XCTAssertTrue(reveal("security-tag-alert-resolve-\(alertId)"))
        tapWhenReady(el("security-tag-alert-resolve-\(alertId)"))
        type("field-tag-alert-notes", "Patient back on the ward \(Api.runId)")
        tapWhenReady(el("security-tag-alert-resolve-submit"))
        let gone = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: el("security-tag-alert-\(alertId)"))
        XCTAssertEqual(XCTWaiter().wait(for: [gone], timeout: 15), .completed, "resolved, so it leaves the open list")
        XCTAssertTrue(api.list("/api/security/tag-alerts?is_resolved=true").contains { ($0["id"] as? String) == alertId }, "resolved on the server")
        back()

        // 10. Exit recorded from Inside now; the row leaves.
        app.buttons["Inside now"].firstMatch.tap()
        XCTAssertTrue(reveal("security-inside-\(goodId)"))
        tapWhenReady(el("security-inside-\(goodId)"))
        tapWhenReady(el("security-record-exit"))
        XCTAssertTrue(el("security-recorded").waitForExistence(timeout: 15))
        XCTAssertNil(openLog(goodId), "the exit is on the server")
        tapWhenReady(el("security-scan-next"))
        let left = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: el("security-inside-\(goodId)"))
        XCTAssertEqual(XCTWaiter().wait(for: [left], timeout: 15), .completed, "the visitor is no longer inside")
        shoot("security-shift-end")

        // 11. Sign out.
        Session.ensureSignedOut(app)
    }
}

extension Api {
    func securityIncident(_ description: String) -> [String: Any] {
        obj("POST", "/api/security/incidents", ["category": "trespass", "severity": "low", "description": description, "location_description": "Main gate"])
    }

    func securityIncidents() -> [[String: Any]] { list("/api/security/incidents") }

    /// A wander-guard tag on a seeded patient, walked out of its zone: an open
    /// alert without starting a Code Pink that would flash every device.
    func tagAlert() -> String? {
        guard let patientId = patient("Tagged")["id"] as? String else { return nil }
        let tag = "E2E-TAG-\(Self.runId)"
        call("POST", "/api/security/patient-tags", ["patient_id": patientId, "tag_type": "wander_guard", "tag_identifier": tag])
        return (obj("POST", "/api/security/tag-events", ["tag_identifier": tag, "event_type": "exit_zone", "location_description": "Gate 2"])["alert"] as? [String: Any])?["id"] as? String
    }
}
