import Foundation

/// How one hospital lets its staff sign in — asked before signing in, by the
/// code the person types (or the hospital's QR carries).
public struct SignInOptions: Decodable, Equatable, Sendable {
    public struct Provider: Decodable, Equatable, Sendable {
        public let id: String
        public let name: String
        public let `protocol`: String
    }

    public let code: String
    public let name: String
    /// Username and password are accepted.
    public let password: Bool
    /// The hospital's own identity providers ("Sign in with Microsoft").
    public let providers: [Provider]
}

/// What a hospital-code lookup found. A wrong code and an outage stay apart:
/// "no such hospital" is never shown for a server that could not be reached.
public enum HospitalLookup: Equatable, Sendable {
    case found(SignInOptions)
    case unknown
    case failed(String)
}

extension AuthStore {
    /// The hospital a code names, and how it signs in.
    public func lookUpHospital(_ code: String) async -> HospitalLookup {
        let trimmed = code.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return .unknown }
        let query = trimmed.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? trimmed
        do {
            let options: SignInOptions = try await apiClient.request(.get, "/api/auth/sign-in-options?code=\(query)")
            return .found(options)
        } catch let error as ApiError where error.status == 404 {
            return .unknown
        } catch let error as ApiError {
            return .failed(error.message)
        } catch {
            return .failed("Could not reach the hospital server.")
        }
    }
}
