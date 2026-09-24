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
        authz = try AuthzCacheHandle(path: directory.appendingPathComponent("authz.sled").path, capacity: 1024, defaultTtlSecs: 3600)
        revocations = try RevocationCacheHandle(path: directory.appendingPathComponent("revocations.sled").path, capacity: 4096)
    }

    public func check(_ key: CacheKey, jwtPermissions: [String], policy: OfflinePolicyKind = .cacheThenJwt) -> CheckOutcome {
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

    /// Record what the server answered, so the same question answers offline.
    public func remember(_ key: CacheKey, allowed: Bool) {
        try? authz.record(key: key, allowed: allowed, source: .cloudFresh)
    }
}
