import XCTest

/// The front desk's ABDM work in one long session — signed in once, then
/// Scan & Share → compare → Back → registration from a share → Verify ABHA
/// → Back, and a tab switch — asserting at every return that the screen still
/// holds what it held. Mirrors AbdmDeskJourneyTest.kt.
///
/// Needs a live backend with the Scan & Share routes and two shares in
/// today's queue, which only ABDM's signed callback can create:
///
///     eval "$(scripts/seed_scan_share.sh)"
///     TEST_RUNNER_SHARE_MATCHED=$SHARE_MATCHED TEST_RUNNER_SHARE_NEW=$SHARE_NEW \
///     TEST_RUNNER_SHARE_MATCHED_ID=$SHARE_MATCHED_ID TEST_RUNNER_SHARE_NEW_ID=$SHARE_NEW_ID \
///       xcodebuild test -only-testing:MedBrainsStaffUITests/AbdmDeskJourneyTests …
final class AbdmDeskJourneyTests: JourneyCase {
    private let env = ProcessInfo.processInfo.environment
    private var desk: Api.Identity?
    private var shareIds: [String] = []

    override func tearDown() {
        // Dealt with, so the next run's queue is only its own.
        for id in shareIds { api.call("POST", "/api/abdm/scan-share/\(id)/dismiss") }
        api.retire(desk)
    }

    private func back() { app.navigationBars.buttons.element(boundBy: 0).tap() }

    private func fieldValue(_ id: String) -> String { (el(id).value as? String) ?? "" }

    func testAReceptionistWorksTheShareQueueAndRegistrationInOneSession() throws {
        guard let matched = env["SHARE_MATCHED"], let fresh = env["SHARE_NEW"],
              let matchedId = env["SHARE_MATCHED_ID"], let freshId = env["SHARE_NEW_ID"] else {
            throw XCTSkip("Seed two shares first: eval \"$(scripts/seed_scan_share.sh)\", passed as TEST_RUNNER_SHARE_*")
        }
        shareIds = [matchedId, freshId]
        let who = api.provision("receptionist")
        desk = who
        app.launchArguments += ["-module", "scan-share"]
        app.launch()
        Session.signIn(app, as: who.username, password: who.password, home: "module-home-scan-share")

        // The queue: both shares, the matched one carrying its patient.
        XCTAssertTrue(reveal("share-row-\(matchedId)"), "the matched share is queued")
        XCTAssertTrue(reveal("share-row-\(freshId)"), "the new share is queued")
        XCTAssertTrue(sees(matched))
        shoot("abdm-01-queue")

        // Compare: ABHA's details beside the record, nothing linked yet.
        tapWhenReady(el("share-compare-\(matchedId)"))
        XCTAssertTrue(el("screen-share-compare").waitForExistence(timeout: 15), "compare opens")
        XCTAssertTrue(el("share-compare-patient").waitForExistence(timeout: 10), "the record it compares against loads")
        XCTAssertTrue(el("abha-compare-name").exists, "name side by side")
        XCTAssertTrue(el("share-link").exists, "linking waits for the desk")
        shoot("abdm-02-compare")

        // Back: the queue is as it was — not reloading, not blank.
        back()
        XCTAssertTrue(el("module-home-scan-share").waitForExistence(timeout: 10))
        XCTAssertTrue(reveal("share-row-\(freshId)"), "the queue survived Back")
        XCTAssertTrue(el("share-row-\(matchedId)").exists, "the matched share is still waiting")

        // Register from the new share; a likely match is shown first, and passed.
        tapWhenReady(el("share-register-\(freshId)"))
        if el("screen-share-find").waitForExistence(timeout: 8) {
            shoot("abdm-03-likely-match")
            tapWhenReady(el("share-register-anyway"))
        }
        XCTAssertTrue(el("screen-register-patient").waitForExistence(timeout: 15), "registration opens from the share")
        XCTAssertEqual(fieldValue("field-last_name"), fresh, "filled from the share the server verified")
        XCTAssertTrue(el("register-abha-verified").waitForExistence(timeout: 5), "the share's ABHA rides on the registration")
        shoot("abdm-04-register-from-share")

        // Verify ABHA over it: the lookup says what is missing before asking ABDM.
        tapWhenReady(el("register-abha-verify"))
        XCTAssertTrue(el("abha-verify-sheet").waitForExistence(timeout: 10))
        app.segmentedControls["abha-method"].buttons["Mobile"].tap()
        type("abha-lookup-value", "98765")
        tapWhenReady(el("abha-send-otp"))
        XCTAssertTrue(sees("Enter the 10-digit mobile"), "a short mobile is refused on the phone")
        shoot("abdm-05-verify-sheet")
        app.buttons["abha-close"].firstMatch.tap()

        // Back from the sheet: the registration still holds the share's person and proof.
        XCTAssertTrue(el("screen-register-patient").waitForExistence(timeout: 10))
        XCTAssertEqual(fieldValue("field-last_name"), fresh, "the form survived the sheet")
        XCTAssertTrue(el("register-abha-verified").exists, "the verified ABHA survived the sheet")

        // Back to the queue, through the find screen when there was one.
        back()
        if el("screen-share-find").waitForExistence(timeout: 3) { back() }
        XCTAssertTrue(el("module-home-scan-share").waitForExistence(timeout: 10))
        XCTAssertTrue(reveal("share-row-\(freshId)"), "nothing was registered, so the share still waits")

        // A tab away and back: Scan & Share keeps its queue.
        app.tabBars.buttons["Reception"].firstMatch.tap()
        XCTAssertTrue(el("module-home-reception").waitForExistence(timeout: 10))
        app.tabBars.buttons["Scan & Share"].firstMatch.tap()
        XCTAssertTrue(reveal("share-row-\(matchedId)"), "the queue survived the tab switch")
        shoot("abdm-06-back-on-queue")
    }

    /// Runs against any server, seeded or not: the queue answers with rows,
    /// the words for none, or the outage named — never a blank — and the
    /// ABHA sheet opened over a half-typed registration leaves it as it was.
    func testTheQueueNeverBlanksAndTheAbhaSheetKeepsTheForm() {
        let who = api.provision("receptionist")
        desk = who
        app.launch()
        Session.signIn(app, as: who.username, password: who.password, home: "module-home-reception")

        // A hospital whose receptionist role predates `abdm.scanshare.view`
        // has no Scan & Share tab: the gate, working. The form half still runs.
        let shareTab = app.tabBars.buttons["Scan & Share"].firstMatch
        let hasQueue = shareTab.waitForExistence(timeout: 5)
        if hasQueue {
            shareTab.tap()
            XCTAssertTrue(el("module-home-scan-share").waitForExistence(timeout: 10))
            let answered = NSPredicate { _, _ in ["scan-share-list", "scan-share-empty", "scan-share-unavailable"].contains { self.el($0).exists } }
            XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: answered, object: nil)], timeout: 20), .completed, "rows, none, or the outage named")
            shoot("abdm-queue-answer")
        }

        app.tabBars.buttons["Reception"].firstMatch.tap()
        tapWhenReady(el("module-action-register"))
        XCTAssertTrue(el("screen-register-patient").waitForExistence(timeout: 10))
        type("field-last_name", "Abhasheet\(Api.runId)")
        tapWhenReady(el("register-abha-verify"))
        XCTAssertTrue(el("abha-verify-sheet").waitForExistence(timeout: 10))
        app.segmentedControls["abha-method"].buttons["Mobile"].tap()
        type("abha-lookup-value", "98765")
        tapWhenReady(el("abha-send-otp"))
        XCTAssertTrue(sees("Enter the 10-digit mobile"), "a short mobile is refused on the phone")
        app.buttons["abha-close"].firstMatch.tap()
        XCTAssertTrue(el("screen-register-patient").waitForExistence(timeout: 10))
        XCTAssertEqual(fieldValue("field-last_name"), "Abhasheet\(Api.runId)", "the form survived the sheet")
        XCTAssertTrue(el("register-abha-none").exists, "nothing verified, nothing claimed")

        guard hasQueue else { return }
        shareTab.tap()
        XCTAssertTrue(el("module-home-scan-share").waitForExistence(timeout: 10), "the tab is where it was left")
        app.tabBars.buttons["Reception"].firstMatch.tap()
        XCTAssertEqual(fieldValue("field-last_name"), "Abhasheet\(Api.runId)", "the registration survived the tab switch")
    }
}
