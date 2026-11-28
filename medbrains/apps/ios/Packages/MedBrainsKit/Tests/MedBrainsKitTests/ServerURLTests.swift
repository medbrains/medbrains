import XCTest

@testable import MedBrainsKit

/// Which server a launch reaches: override, then binding, then the build's default.
final class ServerURLTests: XCTestCase {
    private let release = "https://hospital.example"

    func testABoundHospitalWinsOverTheBuildDefault() {
        let url = chooseServerURL(
            debugOverride: nil, boundApiBase: "https://bound.example", buildDefault: release)
        XCTAssertEqual(url?.absoluteString, "https://bound.example")
    }

    func testWithNoBindingTheBuildDefaultIsUsed() {
        let url = chooseServerURL(debugOverride: nil, boundApiBase: nil, buildDefault: release)
        XCTAssertEqual(url?.absoluteString, release)
    }

    func testADebugOverrideWinsOverEverything() {
        let url = chooseServerURL(
            debugOverride: "http://127.0.0.1:3000", boundApiBase: "https://bound.example",
            buildDefault: release)
        XCTAssertEqual(url?.absoluteString, "http://127.0.0.1:3000")
    }

    func testABlankOverrideOrBindingIsIgnoredRatherThanUsedAsAServer() {
        let url = chooseServerURL(debugOverride: "", boundApiBase: " ", buildDefault: release)
        XCTAssertEqual(url?.absoluteString, release)
    }

    func testABuildWithNoServerGivesNoneRatherThanTheDevMachine() {
        XCTAssertNil(chooseServerURL(debugOverride: nil, boundApiBase: nil, buildDefault: ""))
    }
}
