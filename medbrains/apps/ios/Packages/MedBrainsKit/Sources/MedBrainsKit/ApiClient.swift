import Foundation

/// The wire contract every MedBrains device app keeps. Mirrors
/// apps/mobile-staff/src/api/client.ts: bearer token from the secret store,
/// `X-MedBrains-Client: mobile-<variant>` on every request (which is what
/// makes login answer body tokens instead of cookies — a native client on
/// Android is refused a Secure cookie over plain HTTP), JSON in and out,
/// and a 401 anywhere signs the session out.
public struct ApiError: Error, LocalizedError, Sendable {
    public let status: Int
    public let message: String
    /// The server's machine-readable `error` (e.g. `step_up_required`).
    public let code: String?

    public init(status: Int, message: String, code: String? = nil) {
        self.status = status
        self.message = message
        self.code = code
    }

    public var errorDescription: String? { message }

    /// The server wants the password again before this action (a signature).
    public var isStepUpRequired: Bool { status == 403 && code == "step_up_required" }
}

public enum HttpMethod: String, Sendable {
    case get = "GET", post = "POST", put = "PUT", patch = "PATCH", delete = "DELETE"
}

public actor ApiClient {
    public nonisolated let baseURL: URL
    public let clientName: String
    private let secrets: SecretStore
    private let session: URLSession
    private var onUnauthorized: (@Sendable () async -> Void)?
    /// The last step-up proof, sent as `X-Step-Up-Token`. Memory only: it is
    /// bound to this session on the server and lives five minutes.
    private var stepUpToken: String?

    /// - Parameter variant: `staff`, `patient`, `camp`, `vendor` — becomes `mobile-<variant>`.
    public init(baseURL: URL, variant: String, secrets: SecretStore, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.clientName = "mobile-\(variant)"
        self.secrets = secrets
        self.session = session
    }

    public func setUnauthorizedHandler(_ handler: @escaping @Sendable () async -> Void) {
        onUnauthorized = handler
    }

    /// Request and decode. `Empty` for routes that answer nothing useful.
    public func request<T: Decodable>(_ method: HttpMethod, _ path: String, body: (some Encodable)? = Optional<Empty>.none, as type: T.Type = T.self) async throws -> T {
        let data = try await perform(method, path, body: body)
        if T.self == Empty.self { return Empty() as! T }
        return try JSONDecoder.medbrains.decode(T.self, from: data)
    }

    /// Re-enter the password before a signature. The server answers a proof
    /// bound to this session, which every request then carries.
    public func stepUp(password: String) async throws {
        let data = try await perform(.post, "/api/auth/step-up", body: StepUpBody(password: password))
        stepUpToken = try JSONDecoder.medbrains.decode(StepUpAnswer.self, from: data).stepUpToken
    }

    /// The response exactly as sent — a file to save or share, not a value to decode.
    public func download(_ path: String) async throws -> Data {
        try await perform(.get, path, body: Optional<Empty>.none)
    }

    private func perform(_ method: HttpMethod, _ path: String, body: (some Encodable)?) async throws -> Data {
        // Resolved against the base, not appended as a path component: a
        // component is percent-encoded, which turns `?status=admitted` into
        // `%3Fstatus=admitted` and every filtered list into a 404.
        guard let url = URL(string: path, relativeTo: baseURL) else { throw ApiError(status: 0, message: "bad path \(path)") }
        var req = URLRequest(url: url)
        req.httpMethod = method.rawValue
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.setValue(clientName, forHTTPHeaderField: "X-MedBrains-Client")
        let used = try? secrets.read(.jwt)
        if let used {
            req.setValue("Bearer \(used)", forHTTPHeaderField: "Authorization")
        }
        if let stepUpToken {
            req.setValue(stepUpToken, forHTTPHeaderField: "X-Step-Up-Token")
        }
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONEncoder.medbrains.encode(body)
        }
        req.timeoutInterval = 20
        let (data, response) = try await session.data(for: req)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            // A 401 for the token this request carried; a poll answered after a
            // fresh sign-in must not sign the new session out.
            if status == 401, used == (try? secrets.read(.jwt)) { await onUnauthorized?() }
            let error = Self.apiError(from: data, status: status)
            if error.isStepUpRequired { stepUpToken = nil }
            throw error
        }
        return data
    }

    /// The server's error body as an `ApiError`; a body it cannot read keeps the status text.
    static func apiError(from data: Data, status: Int) -> ApiError {
        if let payload = try? JSONDecoder().decode(ErrorPayload.self, from: data) {
            return ApiError(status: status, message: payload.detail ?? payload.error, code: payload.error)
        }
        return ApiError(status: status, message: HTTPURLResponse.localizedString(forStatusCode: status))
    }
}

public struct Empty: Codable, Sendable {
    public init() {}
}

private struct StepUpBody: Encodable {
    let password: String
}

/// What `/api/auth/step-up` answers a native client.
struct StepUpAnswer: Decodable {
    let stepUpToken: String
}

struct ErrorPayload: Decodable {
    let error: String
    let detail: String?
}

public extension JSONDecoder {
    /// The server speaks snake_case and RFC 3339 dates.
    static let medbrains: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        d.dateDecodingStrategy = .iso8601
        return d
    }()
}

public extension JSONEncoder {
    static let medbrains: JSONEncoder = {
        let e = JSONEncoder()
        e.keyEncodingStrategy = .convertToSnakeCase
        e.dateEncodingStrategy = .iso8601
        return e
    }()
}
