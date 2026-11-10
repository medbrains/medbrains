package com.medbrains.kit

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/**
 * The wire contract every MedBrains device app keeps. Mirrors
 * apps/mobile-staff/src/api/client.ts: bearer token from the secret store,
 * `X-MedBrains-Client: mobile-<variant>` on every request (which is what makes
 * login answer body tokens instead of cookies — a native client on Android is
 * refused a Secure cookie over plain HTTP), JSON in and out, and a 401
 * anywhere signs the session out.
 */
class ApiError(val status: Int, message: String, val code: String? = null) : Exception(message) {
    /** The server wants the password again before this action (a signature). */
    val isStepUpRequired: Boolean get() = status == 403 && code == "step_up_required"
}

class ApiClient(
    val baseUrl: String,
    variant: String,
    private val secrets: SecretStore,
    private val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build(),
) {
    val clientName = "mobile-$variant"
    var onUnauthorized: (suspend () -> Unit)? = null

    /**
     * The last step-up proof, sent as `X-Step-Up-Token`. Memory only: the
     * server binds it to this session and it lives five minutes.
     */
    @Volatile
    private var stepUpToken: String? = null

    val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        coerceInputValues = true
    }

    /** Raw call; the typed helpers below decode with kotlinx.serialization. */
    suspend fun call(method: String, path: String, body: String? = null): String = send(method, path, body) { it?.string().orEmpty() }

    /** The response exactly as sent — an image to show or share, not a value to decode. */
    suspend fun download(path: String): ByteArray = send("GET", path, null) { it?.bytes() ?: ByteArray(0) }

    private suspend fun <R> send(method: String, path: String, body: String?, read: (okhttp3.ResponseBody?) -> R): R = withContext(Dispatchers.IO) {
        val builder = Request.Builder()
            .url(baseUrl.trimEnd('/') + path)
            .header("Accept", "application/json")
            .header("X-MedBrains-Client", clientName)
        val used = secrets.read(SecretKey.JWT)
        used?.let { builder.header("Authorization", "Bearer $it") }
        stepUpToken?.let { builder.header("X-Step-Up-Token", it) }
        val requestBody = body?.toRequestBody(JSON_MEDIA)
        builder.method(method, if (method == "GET" || method == "DELETE" && body == null) null else requestBody ?: "".toRequestBody(JSON_MEDIA))
        http.newCall(builder.build()).execute().use { response ->
            if (!response.isSuccessful) {
                val text = response.body?.string().orEmpty()
                // A 401 for the token this request carried; a poll answered after a
                // fresh sign-in must not sign the new session out.
                if (response.code == 401 && used == secrets.read(SecretKey.JWT)) onUnauthorized?.invoke()
                val error = readApiError(json, text, response.code)
                if (error.isStepUpRequired) stepUpToken = null
                throw error
            }
            read(response.body)
        }
    }

    /** Re-enter the password before a signature; later requests carry the proof. */
    suspend fun stepUp(password: String) {
        val answer = call("POST", "/api/auth/step-up", json.encodeToString(StepUpBody(password)))
        stepUpToken = readStepUpToken(json, answer)
    }

    suspend inline fun <reified T> get(path: String): T = json.decodeFromString(call("GET", path))

    suspend inline fun <reified B, reified T> post(path: String, body: B): T =
        json.decodeFromString(call("POST", path, json.encodeToString(body)))

    suspend inline fun <reified T> post(path: String): T = json.decodeFromString(call("POST", path, "{}"))

    suspend inline fun <reified B, reified T> put(path: String, body: B): T =
        json.decodeFromString(call("PUT", path, json.encodeToString(body)))

    suspend inline fun <reified T> put(path: String): T = json.decodeFromString(call("PUT", path, "{}"))

    suspend inline fun <reified B, reified T> patch(path: String, body: B): T =
        json.decodeFromString(call("PATCH", path, json.encodeToString(body)))


    private companion object {
        val JSON_MEDIA = "application/json; charset=utf-8".toMediaType()
    }
}

@kotlinx.serialization.Serializable
internal data class ErrorPayload(val error: String, val detail: String? = null)

@kotlinx.serialization.Serializable
internal data class StepUpBody(val password: String)

/** What `/api/auth/step-up` answers a native client. */
@kotlinx.serialization.Serializable
internal data class StepUpAnswer(val step_up_token: String)

/** The server's error body as an [ApiError]; a body it cannot read keeps the status. */
internal fun readApiError(json: Json, text: String, status: Int): ApiError = runCatching {
    json.decodeFromString<ErrorPayload>(text).let { ApiError(status, it.detail ?: it.error, it.error) }
}.getOrDefault(ApiError(status, "HTTP $status"))

/** The proof in a native client's step-up answer. */
internal fun readStepUpToken(json: Json, text: String): String =
    json.decodeFromString<StepUpAnswer>(text).step_up_token
