import Foundation
import XCTest
@testable import MedBrainsKit

/// A username shared by two hospitals is answered with a question, never a
/// session; the app must read the question, not fail to decode a session.
final class LoginAnswerTests: XCTestCase {
    private func decode(_ json: String) throws -> LoginAnswer {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode(LoginAnswer.self, from: Data(json.utf8))
    }

    func testTheServerAskingForTheHospitalIsNotASession() throws {
        guard case .hospitalRequired = try decode(#"{"hospital_required":true}"#) else {
            return XCTFail("read as a session")
        }
    }

    func testASessionIsStillASession() throws {
        let json = #"{"token":"t","user":{"id":"u","tenant_id":"h","username":"n","full_name":"N"},"permissions":[],"department_ids":[]}"#
        guard case .signedIn(let session) = try decode(json) else {
            return XCTFail("read as a question")
        }
        XCTAssertEqual(session.user.tenantId, "h")
    }

    func testTheHospitalCodeIsSentOnlyWhenNamed() throws {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        let named = String(decoding: try encoder.encode(LoginRequest(username: "n", password: "p", hospitalCode: "AMH")), as: UTF8.self)
        let unnamed = String(decoding: try encoder.encode(LoginRequest(username: "n", password: "p", hospitalCode: nil)), as: UTF8.self)
        XCTAssertTrue(named.contains(#""hospital_code":"AMH""#))
        XCTAssertFalse(unnamed.contains("hospital_code"))
    }
}
