package com.medbrains.kit

import org.bouncycastle.math.ec.rfc8032.Ed25519
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.security.SecureRandom
import java.util.Base64

/** The hospital QR is checked on the device before any network call. */
class HospitalBindingTest {
    private val b64 = Base64.getUrlEncoder().withoutPadding()
    private val now = 1_800_000_000L

    private class Issuer {
        val secret = ByteArray(Ed25519.SECRET_KEY_SIZE).also { Ed25519.generatePrivateKey(SecureRandom(), it) }
        val public = ByteArray(Ed25519.PUBLIC_KEY_SIZE).also { Ed25519.generatePublicKey(secret, 0, it, 0) }
        fun sign(message: ByteArray): ByteArray =
            ByteArray(Ed25519.SIGNATURE_SIZE).also { Ed25519.sign(secret, 0, message, 0, message.size, it, 0) }
    }

    private val issuer = Issuer()
    private val ik get() = b64.encodeToString(issuer.public)

    private fun qr(
        signer: Issuer = issuer,
        typ: String = "mb-binding+jws",
        aud: String = "medbrains-app",
        apiBase: String = "https://hims.example.in",
        spki: String? = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        exp: Long = now + 3600,
    ): String {
        val header = """{"alg":"EdDSA","typ":"$typ","kid":"0011223344556677"}"""
        val spkiField = spki?.let { ""","spki":"$it"""" } ?: ""
        val payload = """{"v":1,"iss":"$apiBase","aud":"$aud","tenant":"AMH","tenant_name":"AMH Hospital",""" +
            """"api_base":"$apiBase"$spkiField,"ik":"${b64.encodeToString(signer.public)}","jti":"bm9uY2Vub25jZW5vbmNl","iat":${now - 10},"exp":$exp}"""
        val input = b64.encodeToString(header.toByteArray()) + "." + b64.encodeToString(payload.toByteArray())
        return "medbrains://bind?t=$input." + b64.encodeToString(signer.sign(input.toByteArray()))
    }

    private fun refused(block: () -> Unit) {
        try { block(); fail("expected the QR to be refused") } catch (_: BindingRefused) { }
    }

    private fun stored(ikValue: String) = StoredBinding("AMH", "AMH Hospital", "https://hims.example.in", null, ikValue, "dev-1", now)

    @Test fun a_signed_qr_is_parsed() {
        val verified = BindingVerifier.verify(qr(), now, null, allowCleartext = false)
        assertEquals("AMH", verified.payload.tenant)
        assertEquals("https://hims.example.in", verified.payload.api_base)
        assertEquals(ik, verified.payload.ik)
    }

    @Test fun a_tampered_payload_is_refused() {
        val parts = qr().removePrefix("medbrains://bind?t=").split('.')
        val forged = String(Base64.getUrlDecoder().decode(parts[1])).replace("hims.example.in", "evil.example.com")
        refused { BindingVerifier.verify("medbrains://bind?t=${parts[0]}.${b64.encodeToString(forged.toByteArray())}.${parts[2]}", now, null, false) }
    }

    @Test fun anything_but_a_binding_jws_is_refused() {
        refused { BindingVerifier.verify(qr(typ = "JWT"), now, null, false) }
        refused { BindingVerifier.verify(qr(aud = "someone-else"), now, null, false) }
        refused { BindingVerifier.verify("https://example.com", now, null, false) }
        refused { BindingVerifier.verify("medbrains://bind?t=a.b", now, null, false) }
    }

    @Test fun an_expired_qr_is_refused_but_skew_is_tolerated() {
        refused { BindingVerifier.verify(qr(exp = now - 61), now, null, false) }
        BindingVerifier.verify(qr(exp = now - 30), now, null, false)
    }

    @Test fun a_second_issuer_is_refused_after_trust_on_first_use() {
        BindingVerifier.verify(qr(), now, stored(ik), false)
        refused { BindingVerifier.verify(qr(signer = Issuer()), now, stored(ik), false) }
    }

    @Test fun a_build_with_pinned_issuers_refuses_any_other() {
        BindingVerifier.verify(qr(), now, null, false, trustedKeys = setOf(ik))
        refused { BindingVerifier.verify(qr(signer = Issuer()), now, null, false, trustedKeys = setOf(ik)) }
    }

    @Test fun cleartext_only_in_debug_and_https_needs_a_pin() {
        refused { BindingVerifier.verify(qr(apiBase = "http://10.0.2.2:3000", spki = null), now, null, allowCleartext = false) }
        BindingVerifier.verify(qr(apiBase = "http://10.0.2.2:3000", spki = null), now, null, allowCleartext = true)
        refused { BindingVerifier.verify(qr(spki = null), now, null, allowCleartext = true) }
    }

    @Test fun the_proof_must_come_from_the_qr_key() {
        val payload = BindingVerifier.verify(qr(), now, null, false).payload
        val challenge = "Y2hhbGxlbmdl"
        val message = "mb-binding-proof:v1:${payload.jti}:$challenge".toByteArray()
        assertTrue(BindingVerifier.verifyProof(payload, challenge, b64.encodeToString(issuer.sign(message))))
        assertFalse(BindingVerifier.verifyProof(payload, challenge, b64.encodeToString(Issuer().sign(message))))
        assertFalse(BindingVerifier.verifyProof(payload, "other", b64.encodeToString(issuer.sign(message))))
    }
}
