package com.medbrains.kit

/**
 * NHA's M1 rules for what the desk types, and NHA's exact words when it is
 * wrong. The server's `medbrains_abdm::rules` is the authority and refuses
 * the same; this mirror lets the screen say so before anything is sent. The
 * web (`components/abha/abhaRules.ts`) and iOS (`MedBrainsKit/AbhaRules.swift`)
 * keep identical copies — change all four together.
 */
object AbhaRules {
    /** NHA's words (CRT_ABHA_104, 106, 112, VRFY_ABHA_301, 307), verbatim. */
    const val AADHAAR_INVALID = "Aadhaar Number is not valid"
    const val MOBILE_INVALID = "Please enter a valid mobile number."
    const val OTP_INVALID = "Invalid OTP. Please enter a valid OTP."
    const val RESEND_LOCKED = "Maximum OTP resend attempts reached. Please try again after 30 mins"
    const val ADDRESS_TAKEN = "ABHA address already exists."

    private val D = arrayOf(
        intArrayOf(0, 1, 2, 3, 4, 5, 6, 7, 8, 9), intArrayOf(1, 2, 3, 4, 0, 6, 7, 8, 9, 5),
        intArrayOf(2, 3, 4, 0, 1, 7, 8, 9, 5, 6), intArrayOf(3, 4, 0, 1, 2, 8, 9, 5, 6, 7),
        intArrayOf(4, 0, 1, 2, 3, 9, 5, 6, 7, 8), intArrayOf(5, 9, 8, 7, 6, 0, 4, 3, 2, 1),
        intArrayOf(6, 5, 9, 8, 7, 1, 0, 4, 3, 2), intArrayOf(7, 6, 5, 9, 8, 2, 1, 0, 4, 3),
        intArrayOf(8, 7, 6, 5, 9, 3, 2, 1, 0, 4), intArrayOf(9, 8, 7, 6, 5, 4, 3, 2, 1, 0),
    )
    private val P = arrayOf(
        intArrayOf(0, 1, 2, 3, 4, 5, 6, 7, 8, 9), intArrayOf(1, 5, 7, 6, 2, 8, 3, 0, 9, 4),
        intArrayOf(5, 8, 0, 3, 7, 9, 6, 1, 4, 2), intArrayOf(8, 9, 1, 6, 0, 4, 3, 5, 2, 7),
        intArrayOf(9, 4, 5, 3, 1, 2, 6, 8, 7, 0), intArrayOf(4, 3, 2, 7, 6, 5, 8, 1, 0, 9),
        intArrayOf(2, 7, 9, 3, 8, 0, 6, 4, 1, 5), intArrayOf(7, 0, 4, 6, 9, 1, 5, 8, 3, 2),
    )

    /** Whether [digits] (check digit last) passes Verhoeff, UIDAI's Aadhaar check. */
    fun verhoeffOk(digits: String): Boolean {
        if (digits.isEmpty() || !digits.all { it in '0'..'9' }) return false
        var c = 0
        digits.reversed().forEachIndexed { i, ch -> c = D[c][P[i % 8][ch - '0']] }
        return c == 0
    }

    private fun withoutSpaces(typed: String) = typed.filterNot { it.isWhitespace() }

    /** A valid Aadhaar number: 12 digits (spaces allowed) passing Verhoeff (CRT_ABHA_104). */
    fun isValidAadhaar(typed: String): Boolean = withoutSpaces(typed).let { it.length == 12 && verhoeffOk(it) }

    /** A valid mobile: exactly 10 digits, spaces allowed, nothing else (VRFY_ABHA_301). */
    fun isValidMobile(typed: String): Boolean = withoutSpaces(typed).let { it.length == 10 && it.all { c -> c in '0'..'9' } }

    /** The part before the `@`, whether or not the desk typed `@{domain}`. */
    fun addressName(typed: String, domain: String): String = typed.trim().removeSuffix("@$domain")

    /** Each CRT_ABHA_112 rule for `name@{domain}`, in the words and order shown. */
    fun addressChecklist(name: String, domain: String): List<AbhaAddressRule> {
        val total = name.length + 1 + domain.length
        val alnum = { c: Char -> c in 'a'..'z' || c in 'A'..'Z' || c in '0'..'9' }
        val special = { c: Char? -> c == '.' || c == '_' }
        return listOf(
            AbhaAddressRule("8–18 characters, including @$domain", total in 8..18),
            AbhaAddressRule("Letters and numbers only, besides . and _", name.all { alnum(it) || special(it) } && name.any(alnum)),
            AbhaAddressRule("At most one dot (.)", name.count { it == '.' } <= 1),
            AbhaAddressRule("At most one underscore (_)", name.count { it == '_' } <= 1),
            AbhaAddressRule("No . or _ at the start or end", !special(name.firstOrNull()) && !special(name.lastOrNull())),
        )
    }

    /** Whether every address rule is met. */
    fun isValidAddress(name: String, domain: String): Boolean = addressChecklist(name, domain).all { it.met }

    /** ABDM's refusal as the server words it: ABDM's own message, then on the next line our hint (with the code). */
    fun splitAbdmMessage(detail: String): Pair<String, String?> {
        val at = detail.indexOf('\n')
        return if (at < 0) detail to null else detail.substring(0, at) to detail.substring(at + 1)
    }
}

/** One ABHA address rule and whether the typed address meets it. */
data class AbhaAddressRule(val label: String, val met: Boolean)
