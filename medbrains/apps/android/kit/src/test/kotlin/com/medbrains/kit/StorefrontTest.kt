package com.medbrains.kit

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class StorefrontTest {
    @Test
    fun neverACounterOnlyUnpricedOrOutOfStockItem() {
        assertTrue(Storefront.canAdd(true, "otc", "10.00", "available"))
        assertFalse(Storefront.canAdd(true, "counter_only", "10.00", "available"))
        assertFalse(Storefront.canAdd(true, "otc", null, "available"))
        assertFalse(Storefront.canAdd(true, "otc", "10.00", "out"))
        assertFalse(Storefront.canAdd(false, "otc", "10.00", "low"))
    }

    @Test
    fun quantityStaysInsideTheItemsLimit() {
        assertEquals(10, Storefront.clamp(50, 10))
        assertEquals(1, Storefront.clamp(0, 10))
        // One unit of an H1 or habit-forming drug.
        assertEquals(1, Storefront.clamp(3, 1))
    }

    @Test
    fun checkoutFollowsThePrescriptionRules() {
        assertEquals(Storefront.Checkout.Ready("none", null), Storefront.checkout(1, true, false, null, false))
        assertTrue(Storefront.checkout(1, true, true, null, false) is Storefront.Checkout.Problem)
        assertEquals(Storefront.Checkout.Ready("upload", null), Storefront.checkout(1, true, true, null, true))
        // The hospital's own prescription wins over an upload.
        assertEquals(Storefront.Checkout.Ready("hospital", "rx1"), Storefront.checkout(1, true, true, "rx1", true))
        assertTrue(Storefront.checkout(0, true, false, null, false) is Storefront.Checkout.Problem)
        assertTrue(Storefront.checkout(1, false, false, null, false) is Storefront.Checkout.Problem)
    }

    @Test
    fun onlyUnexpiredPrescriptionsAreOffered() {
        assertFalse(Storefront.usable("2026-10-01", "2026-10-19"))
        assertTrue(Storefront.usable("2026-12-01", "2026-10-19"))
        assertTrue(Storefront.usable(null, "2026-10-19"))
    }

    @Test
    fun statusesAndPeopleReadInWords() {
        assertEquals("With the pharmacist", Storefront.label(Storefront.ORDER_STATUS_LABELS, "awaiting_verification"))
        assertEquals("Can't be read", Storefront.label(Storefront.REJECT_REASON_LABELS, "illegible"))
        assertEquals("Arun S (born 2001)", Storefront.personLabel("Arun S", 2001))
    }
}
