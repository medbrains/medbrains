package com.medbrains.kit

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The same cases as `medbrains_abdm::rules`, the web and iOS, so the Android mirror cannot drift. */
class AbhaRulesTest {
    @Test fun verhoeffCatchesEveryOneDigitSlip() {
        val good = "999941057058"
        assertTrue(AbhaRules.verhoeffOk(good))
        assertTrue(AbhaRules.verhoeffOk("2363"))
        for (i in good.indices) for (d in '0'..'9') {
            if (good[i] == d) continue
            val bad = good.substring(0, i) + d + good.substring(i + 1)
            assertFalse(bad, AbhaRules.verhoeffOk(bad))
        }
        assertFalse(AbhaRules.verhoeffOk(""))
    }

    @Test fun anAadhaarNumberIsTwelveDigitsThatPassVerhoeff() {
        assertTrue(AbhaRules.isValidAadhaar("9999 4105 7058"))
        listOf("999941057059", "123456789012", "99994105705", "9999-4105-7058", "").forEach { assertFalse(it, AbhaRules.isValidAadhaar(it)) }
    }

    @Test fun aMobileIsTenDigitsAndNothingElse() {
        assertTrue(AbhaRules.isValidMobile("98765 43210"))
        listOf("987654321", "98765432101", "98765abc10", "98765-43210", "+919876543210", "").forEach { assertFalse(it, AbhaRules.isValidMobile(it)) }
    }

    @Test fun addressRulesHoldAtEveryEdge() {
        assertFalse(AbhaRules.isValidAddress("abc", "sbx"))
        assertTrue(AbhaRules.isValidAddress("abcd", "sbx"))
        assertTrue(AbhaRules.isValidAddress("abcdefghijklmn", "sbx"))
        assertFalse(AbhaRules.isValidAddress("abcdefghijklmno", "sbx"))
        assertTrue(AbhaRules.isValidAddress("abcdefghijklm", "abdm"))
        assertFalse(AbhaRules.isValidAddress("abcdefghijklmn", "abdm"))
        assertTrue(AbhaRules.isValidAddress("12345678", "sbx"))
        assertTrue(AbhaRules.isValidAddress("priya.v_90", "sbx"))
        listOf("pri.ya.v", "pri_ya_v", ".priyav", "priyav_", "priya-v1", "priyä.v1").forEach { assertFalse(it, AbhaRules.isValidAddress(it, "sbx")) }
        assertEquals("priya.v", AbhaRules.addressName(" priya.v@sbx ", "sbx"))
        val list = AbhaRules.addressChecklist("_ab", "sbx")
        assertEquals(listOf("8–18 characters, including @sbx", "Letters and numbers only, besides . and _", "At most one dot (.)", "At most one underscore (_)", "No . or _ at the start or end"), list.map { it.label })
        assertEquals(listOf(false, true, true, true, false), list.map { it.met })
    }

    @Test fun abdmsWordsComeFirstOurHintBeneath() {
        assertEquals("Invalid OTP" to "Check it (code ABDM-1204)", AbhaRules.splitAbdmMessage("Invalid OTP\nCheck it (code ABDM-1204)"))
        assertNull(AbhaRules.splitAbdmMessage(AbhaRules.AADHAAR_INVALID).second)
    }
}
