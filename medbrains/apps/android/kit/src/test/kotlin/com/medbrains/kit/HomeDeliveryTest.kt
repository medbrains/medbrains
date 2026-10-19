package com.medbrains.kit

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * The same decisions the web and iOS delivery tests pin, so a choice the phone
 * sends is one the browser would send.
 */
class HomeDeliveryTest {
    private val offered = listOf(HomeDelivery.PAY_NOW)

    @Test fun aDeliveryNeedsAnAddressAPhoneAndAnOfferedWayToPay() {
        assertNull(HomeDelivery.problem("12 Lake Road", "90000 00001", "prepaid", offered))
        assertEquals("Enter the full address", HomeDelivery.problem("12", "9000000001", "prepaid", offered))
        assertEquals("Enter a 10-digit phone number", HomeDelivery.problem("12 Lake Road", "12345", "prepaid", offered))
        // Pay on delivery wasn't offered to this patient.
        assertEquals("Choose how to pay", HomeDelivery.problem("12 Lake Road", "9000000001", "cash_on_delivery", offered))
        assertEquals("Choose how to pay", HomeDelivery.problem("12 Lake Road", "9000000001", null, offered))
    }

    @Test fun theChoiceIsTrimmedAndBlanksAreLeftOut() {
        val choice = HomeDelivery.choice(" 4 Temple Street ", "  ", "630001", "9000000001 ", null, "prepaid")
        assertEquals(HomeDelivery.Choice("4 Temple Street", null, "630001", "9000000001", null, "prepaid"), choice)
    }

    @Test fun theChoiceIsSentInTheServersShape() {
        // As ApiClient encodes: nulls left out.
        val json = Json { explicitNulls = false }
        val choice = HomeDelivery.choice("12 Lake Road", "", null, "9000000001", "evening", "cash_on_delivery")
        assertEquals(
            """{"address":"12 Lake Road","contact_phone":"9000000001","preferred_slot":"evening","payment":"cash_on_delivery"}""",
            json.encodeToString(HomeDelivery.Choice.serializer(), choice),
        )
    }

    @Test fun everyStageReadsInWords() {
        assertEquals("Out for delivery", HomeDelivery.stageLabel("out_for_delivery"))
        assertEquals("Waiting for payment", HomeDelivery.stageLabel("awaiting_payment"))
        assertEquals("something new", HomeDelivery.stageLabel("something_new"))
    }

    @Test fun onlyTheStepsReachedAreListed() {
        val steps = HomeDelivery.steps("2026-10-19T04:00:00Z", "2026-10-19T06:00:00Z", null, null)
        assertEquals(listOf("Requested", "Being prepared"), steps.map { it.label })
    }
}
