import Foundation

/// Who is signed in. Mirrors mobile-shell's TenantIdentity.
///
/// `permissions` are what the login response said, not what the JWT says:
/// the wire JWT carries no permissions (a hundred codes blew past the cookie
/// cap on the web), so a native client persists them beside the token.
public struct TenantIdentity: Codable, Equatable, Sendable {
    public var tenantId: String
    public var userId: String
    public var username: String
    public var fullName: String
    public var role: String?
    public var permissions: [String]
    public var departmentIds: [String]

    public init(tenantId: String, userId: String, username: String, fullName: String, role: String?, permissions: [String], departmentIds: [String]) {
        self.tenantId = tenantId
        self.userId = userId
        self.username = username
        self.fullName = fullName
        self.role = role
        self.permissions = permissions
        self.departmentIds = departmentIds
    }

    public var isBypassRole: Bool { role == "super_admin" || role == "hospital_admin" }

    /// Element-level gate, mirroring `useHasPermission`: a bypass role holds
    /// everything, anyone else exactly what login listed.
    public func can(_ code: String) -> Bool {
        isBypassRole || permissions.contains(code)
    }

    /// `useHasAny`: one of the codes is enough.
    public func canAny(_ codes: [String]) -> Bool {
        isBypassRole || codes.contains(where: permissions.contains)
    }
}

/// `POST /api/auth/login` answer for a native client (body tokens).
public struct LoginResponse: Decodable, Sendable {
    public struct User: Decodable, Sendable {
        public let id: String
        public let tenantId: String
        public let username: String
        public let email: String?
        public let fullName: String
        public let role: String?
    }

    public let token: String
    public let refreshToken: String?
    public let user: User
    public let permissions: [String]
    public let departmentIds: [String]
}

struct LoginRequest: Encodable {
    let username: String
    let password: String
}

/// Session state for a device app: hydrate from the Keychain on launch, sign
/// in with a username and password, sign out on demand or on any 401.
@MainActor
@Observable
public final class AuthStore {
    public private(set) var identity: TenantIdentity?
    public private(set) var isHydrating = true
    public private(set) var lastError: String?

    private let secrets: SecretStore
    private let client: ApiClient
    private static let identityKey = "medbrains.identity"

    public init(client: ApiClient, secrets: SecretStore) {
        self.client = client
        self.secrets = secrets
    }

    /// Restore a session: a JWT in the Keychain plus the identity saved with it.
    public func hydrate() async {
        defer { isHydrating = false }
        guard (try? secrets.read(.jwt)) != nil,
              let data = UserDefaults.standard.data(forKey: Self.identityKey),
              let saved = try? JSONDecoder().decode(TenantIdentity.self, from: data)
        else {
            identity = nil
            return
        }
        identity = saved
        await client.setUnauthorizedHandler { [weak self] in await self?.signOut() }
    }

    public func signIn(username: String, password: String) async -> Bool {
        lastError = nil
        do {
            let answer: LoginResponse = try await client.request(.post, "/api/auth/login", body: LoginRequest(username: username, password: password))
            try secrets.write(.jwt, answer.token)
            if let refresh = answer.refreshToken { try secrets.write(.refreshToken, refresh) }
            let who = TenantIdentity(
                tenantId: answer.user.tenantId,
                userId: answer.user.id,
                username: answer.user.username,
                fullName: answer.user.fullName,
                role: answer.user.role,
                permissions: answer.permissions,
                departmentIds: answer.departmentIds
            )
            UserDefaults.standard.set(try JSONEncoder().encode(who), forKey: Self.identityKey)
            identity = who
            await client.setUnauthorizedHandler { [weak self] in await self?.signOut() }
            return true
        } catch let error as ApiError {
            lastError = error.status == 401 ? "Wrong username or password." : error.message
        } catch let error as SecretStoreError {
            lastError = "Could not keep you signed in on this device (Keychain \(error.status))."
        } catch is DecodingError {
            lastError = "The server answered in a form this app does not understand."
        } catch {
            lastError = "Could not reach the hospital server."
        }
        return false
    }

    /// Adopt a session issued by another sign-in path — the patient portal's
    /// verified code — so the rest of the shell (bearer client, 401 sign-out,
    /// hydration) treats it exactly like a password session. A portal identity
    /// carries no role and no permissions; nothing downstream may mistake it
    /// for staff.
    public func adopt(token: String, refreshToken: String? = nil, identity who: TenantIdentity) async throws {
        try secrets.write(.jwt, token)
        if let refreshToken { try secrets.write(.refreshToken, refreshToken) }
        UserDefaults.standard.set(try JSONEncoder().encode(who), forKey: Self.identityKey)
        identity = who
        lastError = nil
        await client.setUnauthorizedHandler { [weak self] in await self?.signOut() }
    }

    public func signOut() async {
        try? secrets.delete(.jwt)
        try? secrets.delete(.refreshToken)
        UserDefaults.standard.removeObject(forKey: Self.identityKey)
        identity = nil
    }
}
