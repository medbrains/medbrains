package com.medbrains.kit

import android.content.Context
import java.io.File
import uniffi.edge_rn.AuthzCacheHandle
import uniffi.edge_rn.CacheKey
import uniffi.edge_rn.CacheSourceKind
import uniffi.edge_rn.CheckOutcome
import uniffi.edge_rn.DenyReasonKind
import uniffi.edge_rn.OfflinePolicyKind
import uniffi.edge_rn.OfflineSignInKind
import uniffi.edge_rn.RevocationCacheHandle
import uniffi.edge_rn.isActionOfflineRequired

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

    /**
     * Whether `key` is allowed offline: online-only actions are refused outright, otherwise the
     * cache answers, then the JWT's permissions, per `policy`. A cache fault refuses.
     */
    fun check(
        key: CacheKey,
        jwtPermissions: List<String>,
        policy: OfflinePolicyKind = OfflinePolicyKind.CACHE_THEN_JWT
    ): CheckOutcome {
        if (isActionOfflineRequired(key.objectType, key.action)) {
            return CheckOutcome.Deny(DenyReasonKind.ONLINE_REQUIRED)
        }
        return runCatching { authz.checkOffline(key, jwtPermissions, policy) }
            // A fault is not a refusal, but offline it cannot be an allowance either.
            .getOrElse { CheckOutcome.Deny(DenyReasonKind.CACHE_MISS_STRICT) }
    }

    /**
     * May [userId] be signed in offline on a token issued at [jwtIatUnix]? Fails safe: until this
     * device has finished one revocation pull since its store was created (a fresh install, or
     * the update that moved the store), and on any fault, the answer is a refusal with the reason
     * to show on screen.
     */
    fun signInOffline(userId: String, jwtIatUnix: Long): OfflineSignIn = when (
        runCatching {
            revocations.offlineSignIn(userId, jwtIatUnix)
        }.getOrElse { OfflineSignInKind.NEEDS_SYNC }
    ) {
        OfflineSignInKind.ALLOWED -> OfflineSignIn.Allowed
        OfflineSignInKind.REVOKED -> OfflineSignIn.Refused(REVOKED_REASON)
        OfflineSignInKind.NEEDS_SYNC -> OfflineSignIn.Refused(NEEDS_SYNC_REASON)
    }

    /**
     * Call only after a revocation pull has run to completion: on the first run after an update,
     * that is the full re-pull from cursor 0 (pullWindowMax() is 0 on a new store), every page.
     * Calling it after a partial pull would let a revoked user in offline. The first call lifts
     * the needs-sync refusal for good.
     */
    fun markRevocationsSynced() {
        revocations.markSynced()
    }

    /** Record what the server answered, so the same question answers offline. */
    fun remember(key: CacheKey, allowed: Boolean) {
        runCatching { authz.record(key, allowed, CacheSourceKind.CLOUD_FRESH) }
    }

    /** The offline sign-in answer, with the words the screen shows when it is a refusal. */
    sealed interface OfflineSignIn {
        data object Allowed : OfflineSignIn
        data class Refused(val reason: String) : OfflineSignIn
    }

    companion object {
        /** Shown when the device has not synced revocations since its store was created. */
        const val NEEDS_SYNC_REASON =
            "This device needs one online sync after the update before it can sign anyone in offline."

        /** Shown when the account was turned off before this token was issued. */
        const val REVOKED_REASON = "This account has been turned off. Ask your administrator."
    }

    override fun close() {
        authz.close()
        revocations.close()
    }
}
