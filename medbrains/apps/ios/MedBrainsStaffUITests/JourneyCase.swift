import XCTest

/// What every journey suite shares: the app under test pointed at the run's
/// backend, the admin API, screenshots as evidence, and — on the first
/// failure — a screenshot and the accessibility hierarchy attached, so a
/// "not found" names what the screen held instead. Suites override `setUp`
/// and call `super`.
class JourneyCase: XCTestCase {
    var app: XCUIApplication!
    var api: Api!

    override func setUp() {
        continueAfterFailure = false
        api = Api.admin()
        app = XCUIApplication()
        app.launchArguments = ["-baseURL", Api.backend.absoluteString]
    }

    func el(_ id: String) -> XCUIElement { app.descendants(matching: .any)[id] }

    func shoot(_ name: String) {
        let s = XCTAttachment(screenshot: app.screenshot())
        s.name = name
        s.lifetime = .keepAlways
        add(s)
    }

    /// Move a long screen along. The swipe must land on the scroll view, not
    /// on the app: with the keyboard up, a swipe aimed at the screen's middle
    /// starts on the keyboard and scrolls nothing at all.
    func scrollDown() {
        // Drag from the upper third, which is above the keyboard: a swipe on
        // the app lands on the keys, and the scroll view reports itself
        // unreachable while the keyboard covers its centre. The screens set
        // `.scrollDismissesKeyboard(.interactively)`, so this also puts the
        // keyboard away.
        let from = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.35))
        let to = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.08))
        from.press(forDuration: 0.05, thenDragTo: to)
        // A list still gliding swallows the next tap to stop itself, so the
        // control never fires. Let it come to rest.
        RunLoop.current.run(until: Date().addingTimeInterval(0.6))
    }

    /// Bring something into view and tap it. Existing in the tree is not the
    /// same as being tappable: a scroll view can hold it off-screen and the
    /// keyboard can cover it, and a tap on either lands nowhere.
    func tapWhenReady(_ element: XCUIElement, swipes: Int = 8, file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertTrue(element.waitForExistence(timeout: 10), "element is on screen", file: file, line: line)
        for _ in 0..<swipes {
            if element.isHittable { element.tap(); return }
            scrollDown()
        }
        XCTAssertTrue(element.isHittable, "element never came into view", file: file, line: line)
        element.tap()
    }

    /// Type into a field, having first brought it above the keyboard.
    func type(_ id: String, _ text: String, file: StaticString = #filePath, line: UInt = #line) {
        let field = el(id)
        tapWhenReady(field, file: file, line: line)
        for attempt in 0..<3 where !((field.value(forKey: "hasKeyboardFocus") as? Bool) ?? app.keyboards.firstMatch.exists) {
            field.tap()
            XCTAssertLessThan(attempt, 2, "\(id) never took keyboard focus", file: file, line: line)
        }
        field.typeText(text)
    }

    /// A row a lazy list has not rendered yet: swipe until it exists (a long
    /// queue keeps the newest token below the first screen).
    @discardableResult
    func reveal(_ id: String, swipes: Int = 12) -> Bool {
        if el(id).waitForExistence(timeout: 3) { return true }
        for _ in 0..<swipes {
            scrollDown()
            if el(id).exists { return true }
        }
        return el(id).waitForExistence(timeout: 2)
    }

    /// Any static text whose label contains `text`, waited for.
    func sees(_ text: String, timeout: TimeInterval = 5) -> Bool {
        app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", text)).firstMatch.waitForExistence(timeout: timeout)
    }

    private var dumped = false

    override func record(_ issue: XCTIssue) {
        if !dumped, let app, issue.type == .assertionFailure || issue.type == .thrownError || issue.type == .uncaughtException {
            dumped = true
            let shot = XCTAttachment(screenshot: app.screenshot())
            shot.name = "at-failure"
            shot.lifetime = .keepAlways
            add(shot)
            let tree = XCTAttachment(string: app.debugDescription)
            tree.name = "hierarchy-at-failure"
            tree.lifetime = .keepAlways
            add(tree)
        }
        super.record(issue)
    }
}
