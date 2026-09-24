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

    public var errorDescription: String? { message }
}

public enum HttpMethod: String, Sendable {
    case get = "GET", post = "POST", put = "PUT", patch = "PATCH", delete = "DELETE"
}

public actor ApiClient {
    public let baseURL: URL
    public let clientName: String
    private let secrets: SecretStore
    private let session: URLSession
    private var onUnauthorized: (@Sendable () async -> Void)?

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
            throw ApiError(status: status, message: Self.errorMessage(from: data, status: status))
        }
        if T.self == Empty.self { return Empty() as! T }
        return try JSONDecoder.medbrains.decode(T.self, from: data)
    }

    private static func errorMessage(from data: Data, status: Int) -> String {
        if let payload = try? JSONDecoder().decode(ErrorPayload.self, from: data) {
            return payload.detail ?? payload.error
        }
        return HTTPURLResponse.localizedString(forStatusCode: status)
    }
}

public struct Empty: Codable, Sendable {
    public init() {}
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
