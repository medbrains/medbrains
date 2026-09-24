package com.medbrains.kit

import android.content.Context
import uniffi.edge_rn.AuthzCacheHandle
import uniffi.edge_rn.CacheKey
import uniffi.edge_rn.CacheSourceKind
import uniffi.edge_rn.CheckOutcome
import uniffi.edge_rn.DenyReasonKind
import uniffi.edge_rn.OfflinePolicyKind
import uniffi.edge_rn.RevocationCacheHandle
import uniffi.edge_rn.isActionOfflineRequired
import java.io.File

/**
 * Offline authorisation is a safety property and stays in Rust. This is the
 * thin Kotlin face of `AuthzCacheHandle` + `RevocationCacheHandle` +
 * `isActionOfflineRequired`, mirroring mobile-shell's `usePermissionCheck`:
 * an action the policy marks online-only is refused offline whatever the
 * cache says; otherwise the cache answers, then the JWT's permissions, per
 * the policy the caller names.
 */
class OfflineAuthz(context: Context) : AutoCloseable {
    private val dir = File(context.filesDir, "offline").apply { mkdirs() }

    /** Same sizes the React Native shell opened: 1024 cache entries, 1 hour TTL, 4096 revocations. */
    val authz = AuthzCacheHandle(File(dir, "authz.sled").path, 1024u, 3600uL)
    val revocations = RevocationCacheHandle(File(dir, "revocations.sled").path, 4096u)

    fun check(key: CacheKey, jwtPermissions: List<String>, policy: OfflinePolicyKind = OfflinePolicyKind.CACHE_THEN_JWT): CheckOutcome {
        if (isActionOfflineRequired(key.objectType, key.action)) {
            return CheckOutcome.Deny(DenyReasonKind.ONLINE_REQUIRED)
        }
        return runCatching { authz.checkOffline(key, jwtPermissions, policy) }
            // A fault is not a refusal, but offline it cannot be an allowance either.
            .getOrElse { CheckOutcome.Deny(DenyReasonKind.CACHE_MISS_STRICT) }
    }

    /** Record what the server answered, so the same question answers offline. */
    fun remember(key: CacheKey, allowed: Boolean) {
        runCatching { authz.record(key, allowed, CacheSourceKind.CLOUD_FRESH) }
    }

    override fun close() {
        authz.close()
        revocations.close()
    }
}
