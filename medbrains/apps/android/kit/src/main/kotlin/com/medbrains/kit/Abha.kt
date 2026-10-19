package com.medbrains.kit

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * ABHA at the desk, as the web's `components/abha` applies it: what ABDM
 * verified beside what the desk holds, which of them to keep, and the
 * registration values that follow. The server verifies, links and owns the
 * record; this only shapes what is shown and sent. iOS keeps the same rules
 * in `MedBrainsKit.Abha`.
 */
object Abha {
    const val OTP_LENGTH = 6
    const val AADHAAR_LENGTH = 12
    const val ABHA_NUMBER_LENGTH = 14
    const val MOBILE_LENGTH = 10

    /** The digits of whatever was typed or sent ("91-1111-2222-3333"). */
    fun digits(text: String): String = text.filter { it in '0'..'9' }

    /** An OTP as it is typed: digits only, never more than ABDM sends. */
    fun otpInput(text: String): String = digits(text).take(OTP_LENGTH)

    /** An Aadhaar number as it is typed: digits only, at most twelve. Held only by the screen that asks; never stored. */
    fun aadhaarInput(text: String): String = digits(text).take(AADHAAR_LENGTH)

    fun mobileInput(text: String): String = digits(text).take(MOBILE_LENGTH)

    /** A 10-digit Indian mobile from whatever was sent, or null (a masked "XXXXXX1234" is no number to call). */
    fun mobile(text: String?): String? = digits(text.orEmpty()).takeIf { it.length >= MOBILE_LENGTH }?.takeLast(MOBILE_LENGTH)

    /** Why the lookup cannot be sent yet, or null. */
    fun lookupProblem(method: AbhaVerifyMethod, value: String): String? {
        val v = value.trim()
        return when (method) {
            AbhaVerifyMethod.ABHA_NUMBER -> if (digits(v).length == ABHA_NUMBER_LENGTH) null else "An ABHA number is 14 digits"
            AbhaVerifyMethod.MOBILE -> if (digits(v).length == MOBILE_LENGTH) null else "Enter the 10-digit mobile"
            AbhaVerifyMethod.ABHA_ADDRESS -> if (v.isEmpty() || v.contains(' ')) "Enter the ABHA address, e.g. priya.v@abdm" else null
        }
    }

    /** An ABHA address the patient chose: letters, numbers, dot or underscore; ABDM adds the @ part. */
    fun addressProblem(address: String): String? = when {
        address.isEmpty() -> "Choose or type an ABHA address"
        address.all { it.isLetterOrDigit() && it.code < 128 || it == '.' || it == '_' } -> null
        else -> "Letters, numbers, dot or underscore only"
    }

    private fun clean(text: String?): String = text.orEmpty().trim().split(Regex("\\s+")).filter { it.isNotEmpty() }.joinToString(" ")
    private fun name(vararg parts: String?): String = parts.map(::clean).filter { it.isNotEmpty() }.joinToString(" ")

    /** ABHA's details beside ours, the rows the desk compares. */
    fun compareRows(profile: AbhaVerifiedProfile, ours: OurDetails): List<AbhaCompareRow> {
        val abhaName = name(profile.first_name, profile.middle_name, profile.last_name)
        return listOf(
            AbhaCompareRow(AbhaField.NAME, "Name", abhaName.ifEmpty { clean(profile.full_name) }, name(ours.firstName, ours.middleName, ours.lastName)),
            AbhaCompareRow(AbhaField.DATE_OF_BIRTH, "Date of birth", clean(profile.date_of_birth).ifEmpty { clean(profile.year_of_birth) }, clean(ours.dateOfBirth)),
            AbhaCompareRow(AbhaField.GENDER, "Gender", clean(profile.gender), clean(ours.gender)),
        )
    }

    /** At registration, ABHA's value wherever ours is blank or different, until the desk says otherwise. */
    fun defaultApply(profile: AbhaVerifiedProfile, ours: OurDetails): Set<AbhaField> =
        compareRows(profile, ours).filter { it.differs }.map { it.field }.toSet()

    /** The registration draft's values once a verified ABHA is used: the ABHA always, each detail only where ABHA's was chosen. */
    fun appliedValues(profile: AbhaVerifiedProfile, apply: Set<AbhaField>): Map<String, String> = buildMap {
        put("abha_number", digits(profile.abha_number))
        put("abha_address", profile.abha_address.orEmpty())
        if (AbhaField.NAME in apply) {
            profile.first_name?.let { put("first_name", it) }
            put("middle_name", profile.middle_name.orEmpty())
            profile.last_name?.let { put("last_name", it) }
        }
        if (AbhaField.DATE_OF_BIRTH in apply) profile.date_of_birth?.let { put("date_of_birth", it) }
        if (AbhaField.GENDER in apply) profile.gender?.let { put("gender", it) }
    }

    /** The registration form pre-filled from a share the server verified — the profile the server recorded, never one the phone holds. */
    fun sharePrefill(profile: AbhaVerifiedProfile): Map<String, String> {
        val (first, last) = splitName(profile.first_name, profile.last_name, profile.full_name)
        return listOf(
            "first_name" to first, "middle_name" to profile.middle_name, "last_name" to last,
            "gender" to profile.gender, "date_of_birth" to profile.date_of_birth, "phone" to mobile(profile.mobile_masked),
            "abha_number" to digits(profile.abha_number), "abha_address" to profile.abha_address,
            "address.line1" to profile.address, "address.district" to profile.district,
            "address.state" to profile.state, "address.postal_code" to profile.pincode,
            "registration_source" to "mobile_app",
        ).mapNotNull { (k, v) -> v?.takeIf { it.isNotEmpty() }?.let { k to it } }.toMap()
    }

    /** Given and family name from the parts, or else from the full name. */
    fun splitName(first: String?, last: String?, full: String?): Pair<String, String> {
        if (first != null) return first to last.orEmpty()
        val words = full.orEmpty().trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
        return (words.firstOrNull() ?: "") to (if (words.size > 1) words.last() else "")
    }

    /** The verification to send with a registration: only while the number on the form is the one verified. */
    fun verificationToSend(verified: VerifiedAbha?, abhaNumber: String): String? =
        verified?.takeIf { it.digits == digits(abhaNumber) }?.id

    fun resendLabel(wait: Int): String = if (wait > 0) "Resend OTP in ${wait}s" else "Resend OTP"
}

/** A verification the desk used: its id, and the ABHA number it proved. */
data class VerifiedAbha(val id: String, val digits: String) {
    companion object { fun of(id: String, abhaNumber: String) = VerifiedAbha(id, Abha.digits(abhaNumber)) }
}

data class AbhaCompareRow(val field: AbhaField, val label: String, val abha: String, val ours: String) {
    val matches: Boolean get() = abha.equals(ours, ignoreCase = true)
    /** ABHA says something, and not what we hold: the desk must choose. */
    val differs: Boolean get() = abha.isNotEmpty() && !matches
}

/** The patient's details as they stand on our side. */
data class OurDetails(val firstName: String?, val middleName: String? = null, val lastName: String?, val dateOfBirth: String?, val gender: String?)

@Serializable
enum class AbhaVerifyMethod(val label: String) {
    @SerialName("abha_number") ABHA_NUMBER("ABHA number"),
    @SerialName("mobile") MOBILE("Mobile"),
    @SerialName("abha_address") ABHA_ADDRESS("ABHA address"),
}

/** Where ABDM sends the OTP for an ABHA number or address lookup. */
@Serializable
enum class AbhaOtpVia { @SerialName("aadhaar") AADHAAR, @SerialName("abdm") ABDM }

/** Demographics the desk may take from ABHA. */
@Serializable
enum class AbhaField(val wire: String) { @SerialName("name") NAME("name"), @SerialName("date_of_birth") DATE_OF_BIRTH("date_of_birth"), @SerialName("gender") GENDER("gender") }

object AbhaStage {
    const val OTP_SENT = "otp_sent"
    const val MOBILE_OTP_SENT = "mobile_otp_sent"
    const val CHOOSE_ACCOUNT = "choose_account"
    const val CHOOSE_ADDRESS = "choose_address"
    const val VERIFIED = "verified"
}

@Serializable
data class AbhaAccountChoice(val abha_number: String, val abha_address: String? = null, val name: String? = null, val gender: String? = null, val year_of_birth: String? = null)

/** What ABDM holds for the person, in our patient shape. `photo` is shown to confirm the person; never stored. */
@Serializable
data class AbhaVerifiedProfile(
    val abha_number: String,
    val abha_address: String? = null,
    val full_name: String? = null,
    val first_name: String? = null,
    val middle_name: String? = null,
    val last_name: String? = null,
    val date_of_birth: String? = null,
    val year_of_birth: String? = null,
    val gender: String? = null,
    val mobile_masked: String? = null,
    val email: String? = null,
    val address: String? = null,
    val pincode: String? = null,
    val state: String? = null,
    val district: String? = null,
    val kyc_verified: Boolean = false,
    val photo: String? = null,
)

@Serializable
data class AbhaLinkedPatient(val patient_id: String, val uhid: String, val name: String)

@Serializable
data class AbhaVerificationStep(
    val id: String,
    val stage: String,
    val message: String? = null,
    val resend_after_seconds: Int? = null,
    val accounts: List<AbhaAccountChoice> = emptyList(),
    val profile: AbhaVerifiedProfile? = null,
    /** Another patient here already carries this ABHA. */
    val already_linked: AbhaLinkedPatient? = null,
    /** ABHA addresses ABDM suggests, when creating one. */
    val suggestions: List<String> = emptyList(),
)
