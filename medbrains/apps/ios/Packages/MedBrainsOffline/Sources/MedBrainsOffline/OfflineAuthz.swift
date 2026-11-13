import Foundation
import MedBrainsCore

/// Offline authorisation is a safety property and stays in Rust. This is the
/// thin Swift face of `AuthzCacheHandle` + `RevocationCacheHandle` +
/// `isActionOfflineRequired`, mirroring mobile-shell's `usePermissionCheck`:
/// an action the policy marks online-only is refused offline whatever the
/// cache says; otherwise the cache answers, then the JWT's permissions,
/// per the policy the caller names.
public final class OfflineAuthz: Sendable {
    public let authz: AuthzCacheHandle
    public let revocations: RevocationCacheHandle

    /// Same sizes the React Native shell opened: 1024 cache entries, 1 hour TTL, 4096 revocations.
    public init(directory: URL) throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        authz = try AuthzCacheHandle(
            path: directory.appendingPathComponent("authz.sled").path, capacity: 1024,
            defaultTtlSecs: 3600)
        revocations = try RevocationCacheHandle(
            path: directory.appendingPathComponent("revocations.sled").path, capacity: 4096)
    }

    /// Whether `key` is allowed offline: online-only actions are refused outright, otherwise the
    /// cache answers, then the JWT's permissions, per `policy`. A cache fault refuses.
    public func check(
        _ key: CacheKey, jwtPermissions: [String], policy: OfflinePolicyKind = .cacheThenJwt
    ) -> CheckOutcome {
        if isActionOfflineRequired(objectType: key.objectType, action: key.action) {
            return .deny(reason: .onlineRequired)
        }
        do {
            return try authz.checkOffline(key: key, jwtPermissions: jwtPermissions, policy: policy)
        } catch {
            // A fault is not a refusal, but offline it cannot be an allowance either.
            return .deny(reason: .cacheMissStrict)
        }
    }

    /// The offline sign-in answer, with the words the screen shows when it is a refusal.
    public enum OfflineSignIn: Equatable, Sendable {
        case allowed
        case refused(reason: String)
    }

    /// Shown when the device has not synced revocations since its store was created.
    public static let needsSyncReason =
        "This device needs one online sync after the update before it can sign anyone in offline."
    /// Shown when the account was turned off before this token was issued.
    public static let revokedReason = "This account has been turned off. Ask your administrator."

    /// May `userId` be signed in offline on a token issued at `jwtIatUnix`? Fails safe: until this
    /// device has finished one revocation pull since its store was created (a fresh install, or the
    /// update that moved the store), and on any fault, the answer is a refusal with its reason.
    public func signInOffline(userId: String, jwtIatUnix: Int64) -> OfflineSignIn {
        let kind =
            (try? revocations.offlineSignIn(userId: userId, jwtIatUnix: jwtIatUnix)) ?? .needsSync
        switch kind {
        case .allowed: return .allowed
        case .revoked: return .refused(reason: Self.revokedReason)
        case .needsSync: return .refused(reason: Self.needsSyncReason)
        }
    }

    /// Call only after a revocation pull has run to completion: on the first run after an update,
    /// that is the full re-pull from cursor 0 (`pullWindowMax()` is 0 on a new store), every
    /// page. Calling it after a partial pull would let a revoked user in offline. The first call
    /// lifts the needs-sync refusal for good.
    public func markRevocationsSynced() throws {
        try revocations.markSynced()
    }

    /// Record what the server answered, so the same question answers offline.
    public func remember(_ key: CacheKey, allowed: Bool) {
        try? authz.record(key: key, allowed: allowed, source: .cloudFresh)
    }
}
