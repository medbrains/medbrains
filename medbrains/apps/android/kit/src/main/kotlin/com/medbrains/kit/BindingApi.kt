package com.medbrains.kit

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.CertificatePinner
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.net.URI
import java.security.KeyPairGenerator
import java.security.SecureRandom
import java.security.spec.ECGenParameterSpec
import java.util.Base64
import java.util.concurrent.TimeUnit

@Serializable
internal data class RedeemRequest(
    val token: String,
    val device_label: String,
    val app_variant: String,
    val public_key_pem: String,
    val challenge: String,
)

@Serializable
internal data class RedeemResponse(
    val paired_device_id: String,
    val tenant: String,
    val tenant_name: String,
    val proof: String,
)

/** HTTP for a hospital binding: one pinned client, the redeem call, and the device key. */
object BindingApi {
    private const val CONNECT_TIMEOUT_SECONDS = 10L
    private const val READ_TIMEOUT_SECONDS = 20L
    private const val DEVICE_KEY_ALIAS_PREFIX = "medbrains.binding.device."
    private const val EC_CURVE = "secp256r1"
    private val JSON_MEDIA = "application/json; charset=utf-8".toMediaType()
    private val json = Json { ignoreUnknownKeys = true }

    /**
     * The client every call to a bound hospital goes through: TLS pinned to
     * the SPKI the QR carried, so a certificate from any other key — even one
     * a public CA issued — is refused.
     */
    fun pinnedClient(apiBase: String, spki: String?): OkHttpClient {
        val builder = OkHttpClient.Builder()
            .connectTimeout(CONNECT_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .readTimeout(READ_TIMEOUT_SECONDS, TimeUnit.SECONDS)
        val host = URI(apiBase).host
        if (spki != null && host != null) {
            builder.certificatePinner(CertificatePinner.Builder().add(host, "sha256/$spki").build())
        }
        return builder.build()
    }

    /** Redeem a verified QR; the answer must prove the server holds the QR's key. */
    suspend fun redeem(verified: VerifiedBinding, appVariant: String, nowSeconds: Long): StoredBinding = withContext(Dispatchers.IO) {
        val payload = verified.payload
        val challenge = Base64.getUrlEncoder().withoutPadding().encodeToString(ByteArray(BindingConstants.CHALLENGE_BYTES).also { SecureRandom().nextBytes(it) })
        val body = RedeemRequest(verified.token, deviceLabel(), appVariant, newDeviceKeyPem(payload.jti), challenge)
        val request = Request.Builder()
            .url(payload.api_base.trimEnd('/') + BindingConstants.REDEEM_PATH)
            .header("Accept", "application/json")
            .post(json.encodeToString(body).toRequestBody(JSON_MEDIA))
            .build()
        val answer = pinnedClient(payload.api_base, payload.spki).newCall(request).execute().use { response ->
            val text = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw BindingRefused(refusalMessage(response.code, text))
            json.decodeFromString<RedeemResponse>(text)
        }
        if (!BindingVerifier.verifyProof(payload, challenge, answer.proof)) {
            throw BindingRefused("The server could not prove it issued this code. Ask your IT desk.")
        }
        StoredBinding(payload.tenant, payload.tenant_name, payload.api_base, payload.spki, payload.ik, answer.paired_device_id, nowSeconds)
    }

    private fun refusalMessage(status: Int, text: String): String = when (status) {
        409 -> "This hospital code has already been used. Ask for a new one."
        404 -> "The server does not know this hospital."
        else -> runCatching { json.decodeFromString<ErrorPayload>(text).let { it.detail ?: it.error } }
            .getOrDefault("The hospital server refused this code.")
    }

    /** A fresh P-256 key in the Android Keystore, one per binding; only its public half leaves. */
    private fun newDeviceKeyPem(jti: String): String {
        val gen = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore")
        gen.initialize(
            KeyGenParameterSpec.Builder(DEVICE_KEY_ALIAS_PREFIX + jti, KeyProperties.PURPOSE_SIGN)
                .setAlgorithmParameterSpec(ECGenParameterSpec(EC_CURVE))
                .setDigests(KeyProperties.DIGEST_SHA256)
                .build(),
        )
        val der = gen.generateKeyPair().public.encoded
        val body = Base64.getMimeEncoder(64, "\n".toByteArray()).encodeToString(der)
        return "-----BEGIN PUBLIC KEY-----\n$body\n-----END PUBLIC KEY-----"
    }

    private fun deviceLabel(): String = "${Build.MANUFACTURER} ${Build.MODEL}".trim()
}

/** The binding this device holds, sealed in the Keystore-backed [SecretStore]. */
class BindingStore(private val secrets: SecretStore) {
    private val json = Json { ignoreUnknownKeys = true }

    fun read(): StoredBinding? = secrets.read(SecretKey.HOSPITAL_BINDING)?.let { raw ->
        runCatching { json.decodeFromString<StoredBinding>(raw) }.getOrNull()
    }

    fun write(binding: StoredBinding) = secrets.write(SecretKey.HOSPITAL_BINDING, json.encodeToString(binding))

    fun forget() = secrets.delete(SecretKey.HOSPITAL_BINDING)
}
