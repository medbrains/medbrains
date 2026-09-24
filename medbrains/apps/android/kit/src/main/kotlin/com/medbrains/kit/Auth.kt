package com.medbrains.kit

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Who is signed in. Mirrors mobile-shell's TenantIdentity.
 *
 * `permissions` are what the login response said, not what the JWT says: the
 * wire JWT carries no permissions, so a native client persists them beside
 * the token.
 */
@Serializable
data class TenantIdentity(
    val tenantId: String,
    val userId: String,
    val username: String,
    val fullName: String,
    val role: String?,
    val permissions: List<String>,
    val departmentIds: List<String>,
) {
    val isBypassRole: Boolean get() = role == "super_admin" || role == "hospital_admin"

    /** Element-level gate, mirroring `useHasPermission`: a bypass role holds everything. */
    fun can(code: String): Boolean = isBypassRole || code in permissions

    /** `useHasAny`: one of the codes is enough. */
    fun canAny(codes: List<String>): Boolean = isBypassRole || codes.any { it in permissions }
}

/** `POST /api/auth/login` answer for a native client (body tokens). */
@Serializable
data class LoginResponse(
    val token: String,
    val refresh_token: String? = null,
    val user: User,
    val permissions: List<String> = emptyList(),
    val department_ids: List<String> = emptyList(),
) {
    @Serializable
    data class User(
        val id: String,
        val tenant_id: String,
        val username: String,
        val email: String? = null,
        val full_name: String,
        val role: String? = null,
    )
}

@Serializable
internal data class LoginRequest(val username: String, val password: String)

sealed interface AuthState {
    data object Hydrating : AuthState
    data object SignedOut : AuthState
    data class SignedIn(val identity: TenantIdentity) : AuthState
}

/**
 * Session state: hydrate from the secret store on launch, sign in with a
 * username and password, sign out on demand or on any 401.
 */
class AuthStore(context: Context, private val client: ApiClient, private val secrets: SecretStore) {
    private val prefs = context.getSharedPreferences("medbrains.identity", Context.MODE_PRIVATE)
    private val _state = MutableStateFlow<AuthState>(AuthState.Hydrating)
    val state: StateFlow<AuthState> = _state.asStateFlow()
    private val _lastError = MutableStateFlow<String?>(null)
    val lastError: StateFlow<String?> = _lastError.asStateFlow()
    private val json = Json { ignoreUnknownKeys = true }

    init {
        client.onUnauthorized = { signOut() }
    }

    fun hydrate() {
        val saved = prefs.getString(IDENTITY, null)
        _state.value = if (secrets.read(SecretKey.JWT) != null && saved != null) {
            runCatching { AuthState.SignedIn(json.decodeFromString<TenantIdentity>(saved)) }.getOrDefault(AuthState.SignedOut)
        } else {
            AuthState.SignedOut
        }
    }

    suspend fun signIn(username: String, password: String): Boolean {
        _lastError.value = null
        return try {
            val answer: LoginResponse = client.post("/api/auth/login", LoginRequest(username, password))
            secrets.write(SecretKey.JWT, answer.token)
            answer.refresh_token?.let { secrets.write(SecretKey.REFRESH_TOKEN, it) }
            val who = TenantIdentity(
                tenantId = answer.user.tenant_id,
                userId = answer.user.id,
                username = answer.user.username,
                fullName = answer.user.full_name,
                role = answer.user.role,
                permissions = answer.permissions,
                departmentIds = answer.department_ids,
            )
            prefs.edit().putString(IDENTITY, json.encodeToString(TenantIdentity.serializer(), who)).apply()
            _state.value = AuthState.SignedIn(who)
            true
        } catch (e: ApiError) {
            _lastError.value = if (e.status == 401) "Wrong username or password." else e.message
            false
        } catch (e: Exception) {
            _lastError.value = "Could not reach the hospital server."
            false
        }
    }

    /**
     * Adopt a session issued by another sign-in path — the patient portal's
     * verified code — so the shell treats it like a password session. A portal
     * identity carries no role and no permissions.
     */
    fun adopt(token: String, refreshToken: String? = null, who: TenantIdentity) {
        secrets.write(SecretKey.JWT, token)
        refreshToken?.let { secrets.write(SecretKey.REFRESH_TOKEN, it) }
        prefs.edit().putString(IDENTITY, json.encodeToString(TenantIdentity.serializer(), who)).apply()
        _lastError.value = null
        _state.value = AuthState.SignedIn(who)
    }

    fun signOut() {
        secrets.delete(SecretKey.JWT)
        secrets.delete(SecretKey.REFRESH_TOKEN)
        prefs.edit().remove(IDENTITY).apply()
        _state.value = AuthState.SignedOut
    }

    private companion object {
        const val IDENTITY = "identity"
    }
}
