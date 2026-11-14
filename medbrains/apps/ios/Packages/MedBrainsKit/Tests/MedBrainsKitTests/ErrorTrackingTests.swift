import Foundation
import Sentry
import XCTest
@testable import MedBrainsKit

final class ErrorTrackingTests: XCTestCase {
    private let server = URL(string: "https://hms.example-hospital.test:8443")!
    private let path = "/api/public/error-tracking/ios/1"
    private let patientName = "Lakshmi Narayanan"
    private let uhid = "MB-2026-000123"
    private let phone = "9876543210"

    // MARK: off without config

    func testOffWhenDisabledOrMissingDsnOrPath() {
        let off = [
            ErrorTrackingConfig(enabled: false, dsn: "https://k@rustrak/1", environment: nil, tunnelDsnPath: path),
            ErrorTrackingConfig(enabled: true, dsn: nil, environment: nil, tunnelDsnPath: path),
            ErrorTrackingConfig(enabled: true, dsn: "https://k@rustrak/1", environment: nil, tunnelDsnPath: nil),
        ]
        for config in off { XCTAssertNil(config.tunnelDSN(serverBase: server), "\(config)") }
    }

    func testFailedFetchLeavesSdkOff() async {
        // Nothing listens on port 9 (discard): the fetch fails, so no start.
        let client = ApiClient(baseURL: URL(string: "http://127.0.0.1:9")!, variant: "staff", secrets: SecretStore(service: "test.error-tracking"))
        await ErrorTracking.configure(client: client)
        XCTAssertFalse(SentrySDK.isEnabled)
    }

    func testConfigDecodesServerShape() throws {
        let json = #"{"enabled":true,"dsn":"https://k@127.0.0.1:8000/3","environment":"production","tunnel":"/api/public/error-tracking/envelope","tunnel_dsn_path":"/api/public/error-tracking/ios/1"}"#
        let config = try JSONDecoder.medbrains.decode(ErrorTrackingConfig.self, from: Data(json.utf8))
        XCTAssertEqual(config.tunnelDsnPath, path)
        XCTAssertEqual(config.environment, "production")
    }

    // MARK: DSN building

    func testDsnIsOnTheHospitalServerNeverTheRealHost() throws {
        let config = ErrorTrackingConfig(enabled: true, dsn: "https://secretkey@127.0.0.1:8000/3", environment: nil, tunnelDsnPath: path)
        let dsn = try XCTUnwrap(config.tunnelDSN(serverBase: server))
        XCTAssertEqual(dsn, "https://medbrains@hms.example-hospital.test:8443/api/public/error-tracking/ios/1")
        // The SDK posts to the server's app tunnel route.
        XCTAssertEqual(
            try SentryDsn(string: dsn).getEnvelopeEndpoint().absoluteString,
            "https://hms.example-hospital.test:8443/api/public/error-tracking/ios/api/1/envelope/"
        )
    }

    func testDsnWithoutPortKeepsSchemeAndHost() {
        let config = ErrorTrackingConfig(enabled: true, dsn: "x", environment: nil, tunnelDsnPath: path)
        XCTAssertEqual(
            config.tunnelDSN(serverBase: URL(string: "http://10.0.0.5")!),
            "http://medbrains@10.0.0.5/api/public/error-tracking/ios/1"
        )
    }

    func testDsnKeepsTheServersPathPrefix() {
        let config = ErrorTrackingConfig(enabled: true, dsn: "x", environment: nil, tunnelDsnPath: path)
        XCTAssertEqual(
            config.tunnelDSN(serverBase: URL(string: "https://hims.example.in/hims/")!),
            "https://medbrains@hims.example.in/hims/api/public/error-tracking/ios/1"
        )
    }

    // MARK: scrub

    func testUrlLosesQueryFragmentAndRecordIds() {
        XCTAssertEqual(
            ErrorTrackingScrub.url("https://h.test/api/patients/\(uhid)/visits/0b9f4c2e-8a3d-4c1e-9f7a-2d5b6e8c1a3f?phone=\(phone)#name=x"),
            "https://h.test/api/patients/:id/visits/:id"
        )
        XCTAssertEqual(ErrorTrackingScrub.url("/api/opd/queue?q=\(patientName)"), "/api/opd/queue")
    }

    func testNoPatientDataSurvivesTheScrub() throws {
        let typed = Breadcrumb(level: .info, category: "ui.input")
        typed.message = patientName
        let console = Breadcrumb(level: .info, category: "console")
        console.message = "\(uhid) \(phone)"
        let click = Breadcrumb(level: .info, category: "ui.click")
        click.message = "Button[\(patientName)]"
        let http = Breadcrumb(level: .info, category: "http")
        http.data = [
            "url": "https://h.test/api/patients/\(uhid)?phone=\(phone)",
            "method": "GET",
            "status_code": 500,
            "request_body": patientName,
        ]
        XCTAssertNil(ErrorTrackingScrub.breadcrumb(typed))
        XCTAssertNil(ErrorTrackingScrub.breadcrumb(console))

        let event = Event(level: .error)
        event.breadcrumbs = [click, http]
        let request = SentryRequest()
        request.method = "POST"
        request.url = "https://h.test/api/patients/\(uhid)?q=\(patientName)"
        request.queryString = "phone=\(phone)"
        request.headers = ["X-Patient": patientName]
        request.cookies = "session=\(phone)"
        event.request = request
        event.extra = ["patient": patientName, "uhid": uhid]
        let user = User(userId: ErrorTrackingScrub.hashUserId("user-1"))
        user.email = "\(phone)@example.test"
        user.name = patientName
        user.username = uhid
        event.user = user
        event.serverName = patientName
        event.context = ["device": ["name": "\(patientName)'s iPhone", "model": "iPhone17,1"]]

        let scrubbed = try XCTUnwrap(ErrorTrackingScrub.event(event))
        let serialized = String(describing: scrubbed.serialize())
        for secret in [patientName, uhid, phone] {
            XCTAssertFalse(serialized.contains(secret), "\(secret) survived: \(serialized)")
        }
        XCTAssertEqual(scrubbed.request?.method, "POST")
        XCTAssertEqual(scrubbed.request?.url, "https://h.test/api/patients/:id")
        XCTAssertEqual(scrubbed.user?.userId, ErrorTrackingScrub.hashUserId("user-1"))
        XCTAssertEqual(scrubbed.breadcrumbs?.last?.data?["status_code"] as? Int, 500)
        XCTAssertEqual(scrubbed.context?["device"]?["model"] as? String, "iPhone17,1")
    }

    func testUserHashMatchesTheWeb() {
        // sha256("user-1"), first 32 hex chars — the web's hashUserId gives the same.
        XCTAssertEqual(ErrorTrackingScrub.hashUserId("user-1"), "c6c289e49e9c05b2145860387b73bcb1")
    }
}
