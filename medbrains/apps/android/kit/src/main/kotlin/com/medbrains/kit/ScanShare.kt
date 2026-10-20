package com.medbrains.kit

import kotlinx.serialization.Serializable
import java.time.LocalDate

/**
 * ABDM Scan & Share at the registration desk, as the web's
 * `components/abha/scanShare.ts` applies it: who the share names, their age,
 * which shares can still be acted on, and which existing patients it may
 * really be. iOS keeps the same rules in `MedBrainsKit.ScanShare`.
 */
object ScanShare {
    /** A patient who just scanned is at the desk within a minute. */
    const val REFRESH_MS = 15_000L
    /** Candidates listed at most; the match endpoint answers up to 20. */
    const val CANDIDATE_LIMIT = 5
    private const val MIN_NAME_WORD = 3
    private const val FIRST_PLAUSIBLE_YEAR = 1900

    enum class Tone { PRIMARY, SUCCESS, NEUTRAL, WARNING }

    /** Who the share names, for the queue row. */
    fun name(p: AbdmSharedProfile): String =
        listOfNotNull(p.first_name, p.middle_name, p.last_name).filter { it.isNotEmpty() }.joinToString(" ").ifEmpty { p.full_name ?: p.abha_address }

    /** Age in whole years from the date of birth, else the year; null when neither was shared. */
    fun age(dateOfBirth: String?, yearOfBirth: String?, today: LocalDate): Int? {
        if (dateOfBirth != null) {
            val parts = dateOfBirth.split("-").mapNotNull { it.toIntOrNull() }
            if (parts.size != 3) return null
            val hadBirthday = today.monthValue > parts[1] || (today.monthValue == parts[1] && today.dayOfMonth >= parts[2])
            return today.year - parts[0] - (if (hadBirthday) 0 else 1)
        }
        val born = yearOfBirth?.toIntOrNull()?.takeIf { it > FIRST_PLAUSIBLE_YEAR } ?: return null
        return today.year - born
    }

    /** "34 y · female", or a dash. */
    fun ageAndGender(p: AbdmSharedProfile, today: LocalDate): String =
        listOfNotNull(age(p.date_of_birth, p.year_of_birth, today)?.let { "$it y" }, p.gender).joinToString(" · ").ifEmpty { "—" }

    /** Only a share still waiting (or missed today) can be acted on. */
    fun isActionable(status: String): Boolean = status == "waiting" || status == "expired"

    fun status(status: String): Pair<String, Tone> = when (status) {
        "waiting" -> "Waiting" to Tone.PRIMARY
        "linked" -> "Linked" to Tone.SUCCESS
        "registered" -> "Registered" to Tone.SUCCESS
        "expired" -> "Token expired" to Tone.WARNING
        "dismissed" -> "Dismissed" to Tone.NEUTRAL
        else -> status.replace('_', ' ') to Tone.NEUTRAL
    }

    /** The registration duplicate check (`POST /api/patients/match`) for a share: first, last, date of birth, mobile. */
    data class MatchQuery(val firstName: String, val lastName: String, val dateOfBirth: String?, val phone: String?)

    fun matchQuery(p: AbdmSharedProfile): MatchQuery {
        val (first, last) = Abha.splitName(p.first_name, p.last_name, p.full_name)
        return MatchQuery(first, last, p.date_of_birth, Abha.mobile(p.mobile))
    }

    private fun nameWords(vararg parts: String?): List<String> =
        parts.filterNotNull().joinToString(" ").lowercase().split(Regex("[^a-z0-9]+")).filter { it.length >= MIN_NAME_WORD }

    /** A word in common, or one a prefix of the other ("Ravi" / "Ravindran"). */
    private fun overlap(a: List<String>, b: List<String>): Boolean = a.any { x -> b.any { y -> x.startsWith(y) || y.startsWith(x) } }

    /** The MPI's matches for a share, same mobile first and then by the server's score — a family can share a mobile, so the reasons are shown, not assumed. */
    fun rank(p: AbdmSharedProfile, matches: List<PatientMatch>): List<ShareCandidate> {
        val phone = Abha.mobile(p.mobile)
        val shared = nameWords(p.first_name, p.middle_name, p.last_name, p.full_name)
        return matches.map { m ->
            ShareCandidate(
                match = m,
                sameMobile = phone != null && Abha.mobile(m.phone) == phone,
                sameDob = p.date_of_birth != null && m.dateOfBirth == p.date_of_birth,
                similarName = overlap(shared, nameWords(m.firstName, m.lastName)),
            )
        }.sortedWith(compareByDescending<ShareCandidate> { it.sameMobile }.thenByDescending { it.match.score })
    }

    /** Probably the same person, so registering would make a second UHID. */
    fun likelyDuplicates(p: AbdmSharedProfile, matches: List<PatientMatch>): List<ShareCandidate> = rank(p, matches).filter { it.isLikely }

    enum class Intent { REGISTER, COMPARE }

    /** Where a verified share goes next. */
    sealed interface Next {
        data class Compare(val patientId: String, val notice: String?) : Next
        data object Register : Next
    }

    /** The ABHA's own patient wins over one picked by search: it may have been linked at another counter since the queue loaded. */
    fun next(intent: Intent, sharePatientId: String?, alreadyLinked: AbhaLinkedPatient?, picked: String?): Next? {
        val owner = sharePatientId ?: alreadyLinked?.patient_id ?: picked
        val uhid = alreadyLinked?.uhid ?: "another patient"
        return when {
            picked != null && owner != null && owner != picked -> Next.Compare(owner, "This ABHA is already on $uhid; compare that record.")
            owner != null -> Next.Compare(owner, if (intent == Intent.REGISTER) "This ABHA is already on $uhid; compare and link." else null)
            intent == Intent.COMPARE -> null
            else -> Next.Register
        }
    }
}

/** A possible existing patient from `POST /api/patients/match`. */
data class PatientMatch(val id: String, val uhid: String, val firstName: String, val lastName: String, val dateOfBirth: String?, val phone: String, val score: Double)

data class ShareCandidate(val match: PatientMatch, val sameMobile: Boolean, val sameDob: Boolean, val similarName: Boolean) {
    val isLikely: Boolean get() = (sameMobile && (similarName || sameDob)) || (sameDob && similarName)
    /** What it matched on, in words. */
    val reasons: List<String> get() = listOfNotNull("Mobile".takeIf { sameMobile }, "Date of birth".takeIf { sameDob }, "Name".takeIf { similarName })
}

/** The ABHA profile as the patient shared it. */
@Serializable
data class AbdmSharedProfile(
    val abha_number: String? = null,
    val abha_address: String,
    val full_name: String? = null,
    val first_name: String? = null,
    val middle_name: String? = null,
    val last_name: String? = null,
    val gender: String? = null,
    val date_of_birth: String? = null,
    val year_of_birth: String? = null,
    val mobile: String? = null,
    val address: String? = null,
    val district: String? = null,
    val state: String? = null,
    val pincode: String? = null,
    val counter: String? = null,
)

@Serializable
data class AbdmProfileShare(
    val id: String,
    val station_id: String? = null,
    val counter_name: String? = null,
    val token_number: String? = null,
    val status: String,
    val abha_number: String? = null,
    val abha_address: String,
    val profile: AbdmSharedProfile,
    /** The patient whose verified ABHA this is, or who was registered from it. */
    val patient_id: String? = null,
    val patient_uhid: String? = null,
    val patient_name: String? = null,
    val expires_at: String,
    val created_at: String,
)
