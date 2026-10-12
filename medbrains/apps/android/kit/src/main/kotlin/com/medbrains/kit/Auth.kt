package com.medbrains.kit

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonPrimitive

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

/** `hospital_code`: the hospital this device signs in to; omitted when none is named. */
@Serializable
internal data class LoginRequest(val username: String, val password: String, val hospital_code: String? = null)

/**
 * What sign-in answered: a session, or a request to name the hospital — the
 * username is used in more than one and the server will not guess.
 */
internal sealed interface LoginAnswer {
    data object HospitalRequired : LoginAnswer
    data class SignedIn(val session: LoginResponse) : LoginAnswer
}

internal fun readLoginAnswer(json: Json, raw: JsonObject): LoginAnswer =
    if (raw["hospital_required"]?.jsonPrimitive?.booleanOrNull == true) LoginAnswer.HospitalRequired
    else LoginAnswer.SignedIn(json.decodeFromJsonElement<LoginResponse>(raw))

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
    private val _needsHospital = MutableStateFlow(false)
    /** The server asked which hospital: the username is shared. */
    val needsHospital: StateFlow<Boolean> = _needsHospital.asStateFlow()
    /** The hospital code the last sign-in on this device used; not a secret. */
    val rememberedHospitalCode: String get() = prefs.getString(HOSPITAL_CODE, null).orEmpty()
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

    suspend fun signIn(username: String, password: String, hospitalCode: String = ""): Boolean {
        _lastError.value = null
        val code = hospitalCode.trim()
        return try {
            val raw: JsonObject = client.post("/api/auth/login", LoginRequest(username, password, code.ifEmpty { null }))
            val answer = when (val read = readLoginAnswer(json, raw)) {
                LoginAnswer.HospitalRequired -> {
                    _needsHospital.value = true
                    _lastError.value = "Your username is used in more than one hospital. Enter your hospital code."
                    return false
                }
                is LoginAnswer.SignedIn -> read.session
            }
            // The code the last sign-in used: cleared, it is forgotten.
            prefs.edit().apply { if (code.isEmpty()) remove(HOSPITAL_CODE) else putString(HOSPITAL_CODE, code) }.apply()
            _needsHospital.value = false
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
            // The hospital was confirmed before this step: a refusal is the credentials.
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

    /** The hospital a code names, and how it signs in. */
    suspend fun lookUpHospital(code: String): HospitalLookup {
        val trimmed = code.trim()
        if (trimmed.isEmpty()) return HospitalLookup.Unknown
        return try {
            HospitalLookup.Found(client.get("/api/auth/sign-in-options?code=${java.net.URLEncoder.encode(trimmed, "UTF-8")}"))
        } catch (e: ApiError) {
            if (e.status == 404) HospitalLookup.Unknown else HospitalLookup.Failed(e.message ?: "The hospital server refused.")
        } catch (e: Exception) {
            HospitalLookup.Failed("Could not reach the hospital server.")
        }
    }

    /** "Change hospital": the next sign-in starts from the code again. */
    fun forgetHospital() {
        prefs.edit().remove(HOSPITAL_CODE).apply()
        _needsHospital.value = false
        _lastError.value = null
    }

    fun signOut() {
        secrets.delete(SecretKey.JWT)
        secrets.delete(SecretKey.REFRESH_TOKEN)
        prefs.edit().remove(IDENTITY).apply()
        _state.value = AuthState.SignedOut
    }

    private companion object {
        const val IDENTITY = "identity"
        const val HOSPITAL_CODE = "hospital_code"
    }
}
