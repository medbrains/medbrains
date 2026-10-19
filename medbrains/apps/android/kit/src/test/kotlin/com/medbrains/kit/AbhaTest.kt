package com.medbrains.kit

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

/** The desk's ABHA rules: the same decisions the web's `AbhaCompare` and `scanShare.test.ts` pin and iOS's `AbhaTests` repeats. */
class AbhaTest {
    private val json = Json { ignoreUnknownKeys = true; explicitNulls = false }

    private fun profile(first: String? = "Priya", middle: String? = null, last: String? = "Venkat", full: String? = null, dob: String? = "1990-04-12", year: String? = null, gender: String? = "female", mobile: String? = null) =
        AbhaVerifiedProfile(abha_number = "91-1111-2222-3333", abha_address = "priya.v@sbx", full_name = full, first_name = first, middle_name = middle, last_name = last, date_of_birth = dob, year_of_birth = year, gender = gender, mobile_masked = mobile, kyc_verified = true)

    @Test
    fun typedSecretsKeepOnlyDigitsAndNeverRunLong() {
        assertEquals("123456789012", Abha.aadhaarInput("1234 5678 9012 99"))
        assertEquals("123456", Abha.otpInput("12-34 567"))
        assertEquals("9198765432", Abha.mobileInput("+91 98765 43210"))
        assertEquals("9876543210", Abha.mobile("+91 98765 43210"))
        assertNull("a masked mobile is no number to call", Abha.mobile("XXXXXX3210"))
    }

    @Test
    fun theLookupSaysWhatIsMissing() {
        assertNull(Abha.lookupProblem(AbhaVerifyMethod.ABHA_NUMBER, "91-1111-2222-3333"))
        assertEquals("An ABHA number is 14 digits", Abha.lookupProblem(AbhaVerifyMethod.ABHA_NUMBER, "91111122223"))
        assertNull(Abha.lookupProblem(AbhaVerifyMethod.MOBILE, "98765 43210"))
        assertNotNull(Abha.lookupProblem(AbhaVerifyMethod.MOBILE, "98765"))
        assertNull(Abha.lookupProblem(AbhaVerifyMethod.ABHA_ADDRESS, "priya.v@abdm"))
        assertNotNull(Abha.lookupProblem(AbhaVerifyMethod.ABHA_ADDRESS, "priya v"))
        assertNull(Abha.addressProblem("priya_v.90"))
        assertNotNull(Abha.addressProblem("priya@abdm"))
        assertNotNull(Abha.addressProblem(""))
    }

    @Test
    fun rowsDifferOnlyWhereAbhaSaysSomethingElse() {
        val p = profile(middle = "K")
        val rows = Abha.compareRows(p, OurDetails(" priya ", "k", "venkat", null, "female"))
        assertEquals(listOf("Priya K Venkat", "1990-04-12", "female"), rows.map { it.abha })
        assertEquals("case and spacing are not a difference; a blank of ours is", listOf(false, true, false), rows.map { it.differs })
        assertEquals(setOf(AbhaField.DATE_OF_BIRTH), Abha.defaultApply(p, OurDetails("Priya", "K", "Venkat", null, "female")))
        assertEquals("1990", Abha.compareRows(profile(dob = null, year = "1990"), OurDetails(null, null, null, null, null))[1].abha)
    }

    @Test
    fun usingAVerifiedAbhaTakesOnlyTheChosenDetails() {
        val p = profile()
        assertEquals(mapOf("abha_number" to "91111122223333", "abha_address" to "priya.v@sbx"), Abha.appliedValues(p, emptySet()))
        val all = Abha.appliedValues(p, setOf(AbhaField.NAME, AbhaField.DATE_OF_BIRTH, AbhaField.GENDER))
        assertEquals("Priya", all["first_name"])
        assertEquals("the middle name is cleared when ABHA has none", "", all["middle_name"])
        assertEquals("1990-04-12", all["date_of_birth"])
        assertEquals("female", all["gender"])
    }

    @Test
    fun aShareFillsTheFormFromTheServersProfile() {
        val values = Abha.sharePrefill(profile(first = null, last = null, full = "Ravi Kumar Das", gender = "male", mobile = "+91 98765 43210"))
        assertEquals("Ravi", values["first_name"])
        assertEquals("Das", values["last_name"])
        assertEquals("9876543210", values["phone"])
        assertEquals("91111122223333", values["abha_number"])
        assertEquals("mobile_app", values["registration_source"])
        assertNull("nothing shared, nothing filled", values["address.line1"])
    }

    @Test
    fun anEditedAbhaNumberIsNeverSentAsVerified() {
        val verified = VerifiedAbha.of("v1", "91-1111-2222-3333")
        assertEquals("v1", Abha.verificationToSend(verified, "91111122223333"))
        assertNull(Abha.verificationToSend(verified, "91111122223334"))
        assertNull(Abha.verificationToSend(null, "91111122223333"))
    }

    @Test
    fun theStepDecodesTheServersShape() {
        val step = json.decodeFromString<AbhaVerificationStep>("""{"id":"v1","stage":"choose_account","message":null,"resend_after_seconds":30,"accounts":[{"abha_number":"91111122223333","abha_address":null,"name":"Priya","gender":"F","year_of_birth":"1990"}],"profile":null,"already_linked":{"patient_id":"p1","uhid":"UH-1","name":"Priya V"},"suggestions":[]}""")
        assertEquals(AbhaStage.CHOOSE_ACCOUNT, step.stage)
        assertEquals("UH-1", step.already_linked?.uhid)
        assertEquals("Resend OTP in 12s", Abha.resendLabel(12))
    }
}

class ScanShareTest {
    private fun shared(first: String? = "Ravi", last: String? = "Kumar", dob: String? = "1980-06-15", year: String? = null, mobile: String? = "9876543210") =
        AbdmSharedProfile(abha_address = "ravi@sbx", first_name = first, last_name = last, date_of_birth = dob, year_of_birth = year, mobile = mobile)

    private val today = LocalDate.of(2026, 6, 14)

    @Test
    fun ageCountsTheBirthdayAndFallsBackToTheYear() {
        assertEquals("a day before the birthday", 45, ScanShare.age("1980-06-15", null, today))
        assertEquals(46, ScanShare.age("1980-06-14", null, today))
        assertEquals(36, ScanShare.age(null, "1990", today))
        assertNull(ScanShare.age(null, null, today))
        assertEquals("no name shared: the ABHA address", "ravi@sbx", ScanShare.name(shared(first = null, last = null)))
    }

    @Test
    fun onlyAWaitingOrMissedShareCanBeActedOn() {
        assertTrue(ScanShare.isActionable("waiting"))
        assertTrue(ScanShare.isActionable("expired"))
        assertFalse(ScanShare.isActionable("linked"))
        assertEquals("Token expired", ScanShare.status("expired").first)
    }

    @Test
    fun theSameMobileRanksFirstAndTheLikelyAreNamed() {
        val p = shared()
        val matches = listOf(
            PatientMatch("a", "U1", "Anil", "Rao", null, "9000000000", 0.9),
            PatientMatch("b", "U2", "Ravindran", "K", null, "+91 98765 43210", 0.4),
            PatientMatch("c", "U3", "Meena", "Kumar", "1980-06-15", "9111111111", 0.7),
        )
        val ranked = ScanShare.rank(p, matches)
        assertEquals(listOf("b", "a", "c"), ranked.map { it.match.id })
        assertEquals("Ravi / Ravindran share a prefix", listOf("Mobile", "Name"), ranked[0].reasons)
        assertEquals(listOf("b", "c"), ScanShare.likelyDuplicates(p, matches).map { it.match.id })
    }

    @Test
    fun aVerifiedShareGoesToItsOwnPatientFirst() {
        val other = AbhaLinkedPatient("p2", "UH-2", "X")
        assertEquals(ScanShare.Next.Register, ScanShare.next(ScanShare.Intent.REGISTER, null, null, null))
        assertNull(ScanShare.next(ScanShare.Intent.COMPARE, null, null, null))
        assertEquals(ScanShare.Next.Compare("p1", null), ScanShare.next(ScanShare.Intent.COMPARE, "p1", null, null))
        assertEquals(ScanShare.Next.Compare("p2", "This ABHA is already on UH-2; compare and link."), ScanShare.next(ScanShare.Intent.REGISTER, null, other, null))
        assertEquals(ScanShare.Next.Compare("p2", "This ABHA is already on UH-2; compare that record."), ScanShare.next(ScanShare.Intent.COMPARE, null, other, "p9"))
        assertEquals(ScanShare.Next.Compare("p9", null), ScanShare.next(ScanShare.Intent.COMPARE, null, null, "p9"))
    }
}
