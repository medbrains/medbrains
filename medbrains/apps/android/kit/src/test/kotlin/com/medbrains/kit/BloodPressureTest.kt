package com.medbrains.kit

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The same decisions the web and iOS blood-pressure tests pin, so a reading
 * the ward tablet refuses is one the desk refuses too.
 */
class BloodPressureTest {
    @Test fun normalAndBlankAreAccepted() {
        assertTrue(BloodPressure.validate("120", "80").isEmpty)
        assertTrue(BloodPressure.validate("", " ").isEmpty)
    }

    @Test fun bothNumbersOrNeither() {
        assertEquals("Enter the diastolic (low) value too", BloodPressure.validate("120", "").diastolic)
        assertEquals("Enter the systolic (high) value too", BloodPressure.validate("", "80").systolic)
    }

    @Test fun rangesAreInclusive() {
        assertTrue(BloodPressure.validate("50", "20").isEmpty)
        assertTrue(BloodPressure.validate("300", "200").isEmpty)
        assertNotNull(BloodPressure.validate("49", "30").systolic)
        assertNotNull(BloodPressure.validate("301", "80").systolic)
        assertNotNull(BloodPressure.validate("120", "19").diastolic)
        assertNotNull(BloodPressure.validate("120.5", "80").systolic)
    }

    @Test fun swappedNumbersAreRefused() {
        assertEquals("Diastolic (low) must be lower than systolic (high)", BloodPressure.validate("80", "120").diastolic)
        assertNotNull(BloodPressure.validate("90", "90").diastolic)
    }

    @Test fun readingCarriesBothNumbersOrIsRefused() {
        assertEquals(BloodPressure.Reading(142, 91), BloodPressure.readingOrNull(" 142", "91 "))
        assertEquals(BloodPressure.Reading(null, null), BloodPressure.readingOrNull("", ""))
        assertNull(BloodPressure.readingOrNull("80", "120"))
    }
}
