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
class ApiError(val status: Int, message: String) : Exception(message)

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

    val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        coerceInputValues = true
    }

    /** Raw call; the typed helpers below decode with kotlinx.serialization. */
    suspend fun call(method: String, path: String, body: String? = null): String = withContext(Dispatchers.IO) {
        val builder = Request.Builder()
            .url(baseUrl.trimEnd('/') + path)
            .header("Accept", "application/json")
            .header("X-MedBrains-Client", clientName)
        val used = secrets.read(SecretKey.JWT)
        used?.let { builder.header("Authorization", "Bearer $it") }
        val requestBody = body?.toRequestBody(JSON_MEDIA)
        builder.method(method, if (method == "GET" || method == "DELETE" && body == null) null else requestBody ?: "".toRequestBody(JSON_MEDIA))
        http.newCall(builder.build()).execute().use { response ->
            val text = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                // A 401 for the token this request carried; a poll answered after a
                // fresh sign-in must not sign the new session out.
                if (response.code == 401 && used == secrets.read(SecretKey.JWT)) onUnauthorized?.invoke()
                throw ApiError(response.code, errorMessage(text, response.code))
            }
            text
        }
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

    private fun errorMessage(text: String, status: Int): String = runCatching {
        json.decodeFromString<ErrorPayload>(text).let { it.detail ?: it.error }
    }.getOrDefault("HTTP $status")

    private companion object {
        val JSON_MEDIA = "application/json; charset=utf-8".toMediaType()
    }
}

@kotlinx.serialization.Serializable
internal data class ErrorPayload(val error: String, val detail: String? = null)
