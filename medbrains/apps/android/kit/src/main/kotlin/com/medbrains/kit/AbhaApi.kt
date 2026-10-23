package com.medbrains.kit

import kotlinx.serialization.Serializable

/**
 * `/api/abdm/abha/…` and `/api/abdm/scan-share/…`, as `packages/api` names
 * them. Every ABHA call needs `abdm.abha.manage` (the scan-share ones
 * `abdm.scanshare.view`); the server checks, the screens gate the control.
 */
object AbdmEndpoint {
    const val VERIFICATIONS = "/api/abdm/abha/verifications"
    const val ENROLMENTS = "/api/abdm/abha/enrolments"
    const val SCAN_SHARE_QUEUE = "/api/abdm/scan-share/queue"
    const val READ_QR = "/api/abdm/abha/qr"
    fun verification(id: String, tail: String) = "$VERIFICATIONS/$id/$tail"
    fun enrolment(id: String, tail: String) = "$ENROLMENTS/$id/$tail"
    fun share(id: String, tail: String) = "/api/abdm/scan-share/$id/$tail"
}

@Serializable private data class StartBody(val method: AbhaVerifyMethod, val value: String, val otp_via: AbhaOtpVia? = null)
@Serializable private data class OtpBody(val otp: String)
@Serializable private data class EnrolmentOtpBody(val otp: String, val mobile: String)
@Serializable private data class AccountBody(val abha_number: String)
@Serializable private data class AddressBody(val abha_address: String)
@Serializable private data class EnrolBody(val aadhaar: String, val consent: Boolean)
@Serializable private data class ResendEnrolBody(val aadhaar: String? = null)
@Serializable private data class ResendBody(val value: String? = null)
@Serializable private data class QrBody(val payload: String)
@Serializable private data class LinkBody(val patient_id: String, val apply: List<AbhaField>)
@Serializable private data class Linked(val linked: Boolean)
@Serializable private data class CompleteBody(val patient_id: String)

class AbhaApi(private val client: ApiClient) {
    /** Send the person an OTP — or, finding by mobile, list the ABHAs on it. Only a number or address lookup chooses where the OTP goes. */
    suspend fun start(method: AbhaVerifyMethod, value: String, via: AbhaOtpVia): AbhaVerificationStep =
        client.post(AbdmEndpoint.VERIFICATIONS, StartBody(method, value.trim(), via.takeIf { Abha.choosesOtpVia(method) }))

    /** The OTP again. An Aadhaar login sends the Aadhaar number again: the server never keeps it. */
    suspend fun resend(id: String, value: String? = null): AbhaVerificationStep =
        client.post(AbdmEndpoint.verification(id, "resend"), ResendBody(value))

    /** What a scanned ABHA card says, to verify by OTP next. */
    suspend fun readQr(payload: String): AbhaCardQr = client.post(AbdmEndpoint.READ_QR, QrBody(payload))

    suspend fun submitOtp(id: String, otp: String): AbhaVerificationStep = client.post(AbdmEndpoint.verification(id, "otp"), OtpBody(otp))

    suspend fun chooseAccount(id: String, abhaNumber: String): AbhaVerificationStep =
        client.post(AbdmEndpoint.verification(id, "account"), AccountBody(abhaNumber))

    /** The Aadhaar number travels once, to the server, which encrypts it to ABDM and keeps nothing; the caller drops it once the OTP is sent. */
    suspend fun startEnrolment(aadhaar: String, consent: Boolean): AbhaVerificationStep = client.post(AbdmEndpoint.ENROLMENTS, EnrolBody(aadhaar, consent))

    suspend fun enrolmentOtp(id: String, otp: String, mobile: String): AbhaVerificationStep =
        client.post(AbdmEndpoint.enrolment(id, "otp"), EnrolmentOtpBody(otp, mobile))

    /** The waiting OTP again. The Aadhaar OTP needs the Aadhaar number again (never stored); the mobile OTP does not. */
    suspend fun resendEnrolment(id: String, aadhaar: String?): AbhaVerificationStep =
        client.post(AbdmEndpoint.enrolment(id, "resend"), ResendEnrolBody(aadhaar))

    suspend fun enrolmentMobileOtp(id: String, otp: String): AbhaVerificationStep = client.post(AbdmEndpoint.enrolment(id, "mobile-otp"), OtpBody(otp))

    suspend fun chooseAddress(id: String, address: String): AbhaVerificationStep = client.post(AbdmEndpoint.enrolment(id, "address"), AddressBody(address))

    /** The ABHA card as ABDM renders it, to show, print or share. */
    suspend fun card(id: String): ByteArray = client.download(AbdmEndpoint.verification(id, "card"))

    suspend fun qr(id: String): ByteArray = client.download(AbdmEndpoint.verification(id, "qr"))

    /** Link through the server's verified path: it checks the verification is this user's, verified, and on no other patient. */
    suspend fun link(id: String, patientId: String, apply: Set<AbhaField>) {
        client.post<LinkBody, Linked>(AbdmEndpoint.verification(id, "link"), LinkBody(patientId, apply.sortedBy { it.wire }))
    }
}

class ScanShareApi(private val client: ApiClient) {
    /** Today's shares, newest first; the server bounds the list. */
    suspend fun queue(): List<AbdmProfileShare> = client.get(AbdmEndpoint.SCAN_SHARE_QUEUE)

    /** The share as a verified ABHA, recorded by the server from what ABDM delivered. */
    suspend fun verification(id: String): AbhaVerificationStep = client.post(AbdmEndpoint.share(id, "verification"))

    suspend fun complete(id: String, patientId: String): AbdmProfileShare = client.post(AbdmEndpoint.share(id, "complete"), CompleteBody(patientId))

    suspend fun dismiss(id: String): AbdmProfileShare = client.post(AbdmEndpoint.share(id, "dismiss"))
}
