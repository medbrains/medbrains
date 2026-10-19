package com.medbrains.kit

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.bouncycastle.math.ec.rfc8032.Ed25519
import java.util.Base64

/**
 * The hospital QR an administrator prints: a compact JWS (EdDSA) naming the
 * hospital, the server the app may talk to, and that server's TLS key pin.
 * Wire contract v1 — see `HospitalBinding` in the server and the web admin.
 *
 * Trust model: the QR carries its issuer key (`ik`). A build that lists keys
 * in [TRUSTED_ISSUER_KEYS] accepts only those. Otherwise the first binding is
 * trust-on-first-use — scanned in the hospital, off the admin's own screen —
 * and every later QR must come from the same key until the person forgets
 * the hospital. Redemption then proves the pinned server holds that key
 * (the `proof` over our challenge), so a QR cannot point a genuine key at a
 * foreign server, nor a foreign key at the genuine one.
 */
object BindingConstants {
    const val QR_PREFIX = "medbrains://bind?t="
    const val ALG = "EdDSA"
    const val TYP = "mb-binding+jws"
    const val AUD = "medbrains-app"
    const val VERSION = 1
    const val CLOCK_SKEW_SECONDS = 60L
    const val PROOF_PREFIX = "mb-binding-proof:v1:"
    const val ED25519_KEY_BYTES = 32
    const val CHALLENGE_BYTES = 32
    const val REDEEM_PATH = "/api/device-binding/redeem"

    /** Issuer keys (base64url, no padding) a hospital's own build pins. Empty: TOFU. */
    val TRUSTED_ISSUER_KEYS: Set<String> = emptySet()
}

@Serializable
internal data class BindingHeader(val alg: String, val typ: String, val kid: String? = null)

@Serializable
data class BindingPayload(
    val v: Int,
    val iss: String,
    val aud: String,
    val tenant: String,
    val tenant_name: String,
    val api_base: String,
    val spki: String? = null,
    val ik: String,
    val jti: String,
    val iat: Long,
    val exp: Long,
)

/** A binding this device holds: where it talks, and to whom it is pinned. */
@Serializable
data class StoredBinding(
    val tenant: String,
    val tenant_name: String,
    val api_base: String,
    val spki: String? = null,
    val ik: String,
    val paired_device_id: String,
    val bound_at: Long,
)

/** A scanned QR checked and ready to redeem. */
data class VerifiedBinding(val token: String, val payload: BindingPayload)

/** Why a QR was refused, in words the person can act on. */
class BindingRefused(message: String) : Exception(message)

object BindingVerifier {
    private val json = Json { ignoreUnknownKeys = true }
    private val urlDecoder = Base64.getUrlDecoder()

    /**
     * Check a scanned QR before any network call.
     * @param current the binding already held (TOFU anchor), if any.
     * @param allowCleartext debug builds only: an `http://` server without a pin.
     */
    fun verify(
        qr: String,
        nowSeconds: Long,
        current: StoredBinding?,
        allowCleartext: Boolean,
        trustedKeys: Set<String> = BindingConstants.TRUSTED_ISSUER_KEYS,
    ): VerifiedBinding {
        val token = qr.trim().removePrefix(BindingConstants.QR_PREFIX)
        if (token == qr.trim()) refuse("This is not a MedBrains hospital code.")
        val parts = token.split('.')
        if (parts.size != 3) refuse("This hospital code is damaged. Ask for a new one.")
        val header = decode<BindingHeader>(parts[0])
        if (header.alg != BindingConstants.ALG || header.typ != BindingConstants.TYP) refuse("This is not a MedBrains hospital code.")
        val payload = decode<BindingPayload>(parts[1])
        if (payload.v != BindingConstants.VERSION || payload.aud != BindingConstants.AUD) refuse("This hospital code is for a different app version.")
        val key = bytes(payload.ik)
        if (key.size != BindingConstants.ED25519_KEY_BYTES) refuse("This hospital code is damaged. Ask for a new one.")
        val signed = "${parts[0]}.${parts[1]}".toByteArray(Charsets.US_ASCII)
        if (!verifySignature(key, signed, bytes(parts[2]))) refuse("This hospital code has been altered. Ask for a new one.")
        checkTrust(payload.ik, current, trustedKeys)
        checkTime(payload, nowSeconds)
        checkTransport(payload, allowCleartext)
        return VerifiedBinding(token, payload)
    }

    /** The server's answer proves it holds the key the QR was signed with. */
    fun verifyProof(payload: BindingPayload, challenge: String, proof: String): Boolean {
        val message = "${BindingConstants.PROOF_PREFIX}${payload.jti}:$challenge".toByteArray(Charsets.UTF_8)
        return runCatching { verifySignature(bytes(payload.ik), message, bytes(proof)) }.getOrDefault(false)
    }

    private fun checkTrust(ik: String, current: StoredBinding?, trustedKeys: Set<String>) {
        if (trustedKeys.isNotEmpty() && ik !in trustedKeys) refuse("This hospital code was not issued by a server this app trusts.")
        if (current != null && current.ik != ik) refuse("This code is from a different server. Forget the current hospital first.")
    }

    private fun checkTime(payload: BindingPayload, now: Long) {
        if (now > payload.exp + BindingConstants.CLOCK_SKEW_SECONDS) refuse("This hospital code has expired. Ask for a new one.")
        if (payload.iat > now + BindingConstants.CLOCK_SKEW_SECONDS) refuse("This hospital code is not valid yet. Check the phone's date and time.")
    }

    private fun checkTransport(payload: BindingPayload, allowCleartext: Boolean) {
        val https = payload.api_base.startsWith("https://")
        if (!https && !(allowCleartext && payload.api_base.startsWith("http://"))) refuse("This hospital code names an insecure server.")
        if (https && payload.spki.isNullOrBlank()) refuse("This hospital code has no server pin. Ask your IT desk for a new one.")
    }

    private fun verifySignature(key: ByteArray, message: ByteArray, signature: ByteArray): Boolean =
        signature.size == Ed25519.SIGNATURE_SIZE &&
            key.size == Ed25519.PUBLIC_KEY_SIZE &&
            Ed25519.verify(signature, 0, key, 0, message, 0, message.size)

    private inline fun <reified T> decode(segment: String): T =
        runCatching { json.decodeFromString<T>(String(bytes(segment), Charsets.UTF_8)) }
            .getOrElse { refuse("This hospital code is damaged. Ask for a new one.") }

    private fun bytes(b64url: String): ByteArray =
        runCatching { urlDecoder.decode(b64url) }.getOrElse { refuse("This hospital code is damaged. Ask for a new one.") }

    private fun refuse(message: String): Nothing = throw BindingRefused(message)
}
