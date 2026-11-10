import Foundation
import XCTest
@testable import MedBrainsKit

/// Signing asks for the password again. The app must recognise the server's
/// question, send the proof it gets back on the requests that follow, and
/// drop a proof the server has stopped accepting so it asks again.
final class StepUpTests: XCTestCase {
    override func tearDown() {
        StubProtocol.reset()
        super.tearDown()
    }

    private func client() -> ApiClient {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [StubProtocol.self]
        return ApiClient(
            baseURL: URL(string: "https://hospital.test")!,
            variant: "staff",
            secrets: SecretStore(service: "com.medbrains.tests.\(UUID().uuidString)"),
            session: URLSession(configuration: config)
        )
    }

    func testTheServersStepUpQuestionIsRecognised() {
        let body = Data(#"{"error":"step_up_required","detail":"Re-authenticate to continue."}"#.utf8)
        let error = ApiClient.apiError(from: body, status: 403)
        XCTAssertTrue(error.isStepUpRequired)
        XCTAssertEqual(error.message, "Re-authenticate to continue.")
        XCTAssertFalse(ApiClient.apiError(from: Data(#"{"error":"forbidden"}"#.utf8), status: 403).isStepUpRequired)
    }

    func testTheProofIsSentAfterStepUpAndDroppedWhenRefused() async throws {
        let api = client()
        StubProtocol.answer = { request in
            if request.url?.path == "/api/auth/step-up" {
                return (200, #"{"status":"ok","step_up_token":"proof-1"}"#)
            }
            return request.value(forHTTPHeaderField: "X-Step-Up-Token") == "proof-1"
                ? (403, #"{"error":"step_up_required","detail":"Re-authenticate to continue."}"#)
                : (404, #"{"error":"not found","detail":"not found"}"#)
        }
        try await api.stepUp(password: "secret")
        do {
            let _: Empty = try await api.request(.post, "/api/clinical-notes/n1/sign", body: Empty())
            XCTFail("the stub refuses")
        } catch let error as ApiError {
            XCTAssertTrue(error.isStepUpRequired, "the proof travelled in X-Step-Up-Token")
        }
        do {
            let _: Empty = try await api.request(.post, "/api/clinical-notes/n1/sign", body: Empty())
        } catch let error as ApiError {
            XCTAssertEqual(error.status, 404, "a refused proof is not sent again")
        }
    }
}

/// Answers every request from `answer`, recording nothing else.
final class StubProtocol: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var answer: (URLRequest) -> (Int, String) = { _ in (500, "{}") }

    static func reset() { answer = { _ in (500, "{}") } }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        let (status, body) = Self.answer(request)
        let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(body.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}
