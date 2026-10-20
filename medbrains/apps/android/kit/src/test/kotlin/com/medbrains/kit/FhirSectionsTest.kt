package com.medbrains.kit

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** The same bundle and answers as the web's `fhirSections.test.ts` and iOS, so a record reads identically everywhere. */
class FhirSectionsTest {
    private val bundle = Json.parseToJsonElement(
        """
        {"resourceType":"Bundle","type":"document","entry":[
          {"fullUrl":"urn:uuid:comp","resource":{"resourceType":"Composition","title":"OP consultation","date":"2024-06-01",
            "author":[{"reference":"Practitioner/dr"}],
            "section":[
              {"title":"Diagnoses","entry":[{"reference":"urn:uuid:c1"}]},
              {"title":"Results","entry":[{"reference":"Observation/hb"},{"reference":"missing"}]},
              {"title":"Documents","entry":[{"reference":"urn:uuid:doc"}]},
              {"title":"Medicines","entry":[{"reference":"urn:uuid:m1"}]},
              {"title":"Empty","entry":[]}]}},
          {"resource":{"resourceType":"Practitioner","id":"dr","name":[{"text":"Dr. Mehta"}]}},
          {"fullUrl":"urn:uuid:c1","resource":{"resourceType":"Condition","code":{"coding":[{"display":"Type 2 diabetes"}]}}},
          {"resource":{"resourceType":"Observation","id":"hb","code":{"text":"Haemoglobin"},
            "valueQuantity":{"value":9.8,"unit":"g/dL"},
            "referenceRange":[{"low":{"value":12,"unit":"g/dL"},"high":{"value":15,"unit":"g/dL"}}],
            "interpretation":[{"text":"Low"}]}},
          {"fullUrl":"urn:uuid:doc","resource":{"resourceType":"DocumentReference","type":{"text":"Discharge summary"},
            "content":[{"attachment":{"contentType":"application/pdf","data":"JVBERi0=","title":"ds.pdf"}}]}},
          {"fullUrl":"urn:uuid:m1","resource":{"resourceType":"MedicationRequest","medicationCodeableConcept":{"text":"Metformin 500 mg"},
            "dosageInstruction":[{"text":"1 tablet twice a day"}]}}
        ]}
        """,
    )

    @Test fun readsTheHeaderAndOnlySectionsWithSomethingInThem() {
        val doc = FhirSections.read(bundle)
        assertEquals("OP consultation", doc.title)
        assertEquals("2024-06-01", doc.date)
        assertEquals("Dr. Mehta", doc.author)
        assertEquals(listOf("Diagnoses", "Results", "Documents", "Medicines"), doc.sections.map { it.title })
        assertEquals("Type 2 diabetes", doc.sections[0].items.first().text)
    }

    @Test fun aResultShowsItsUnitRangeAndFlagAndDanglingReferencesAreSkipped() {
        assertEquals(
            listOf(FhirSections.Item("0:Observation/hb", "Haemoglobin: 9.8 g/dL", "Range 12 g/dL – 15 g/dL · Low")),
            FhirSections.read(bundle).sections[1].items,
        )
    }

    @Test fun aMedicineReadsWithItsDosage() {
        val medicine = FhirSections.read(bundle).sections[3].items.first()
        assertEquals("Metformin 500 mg", medicine.text)
        assertEquals("1 tablet twice a day", medicine.detail)
    }

    @Test fun anInlineAttachmentIsAFileAndNonWebLinksAreDropped() {
        assertEquals(FhirSections.Link.Inline("JVBERi0=", "application/pdf", "ds.pdf", "ds.pdf"), FhirSections.read(bundle).sections[2].items.first().link)
        val unsafe = FhirSections.describe(Json.parseToJsonElement("""{"resourceType":"DocumentReference","content":[{"attachment":{"url":"javascript:alert(1)"}}]}"""))
        assertNull(unsafe.link)
        val web = FhirSections.describe(Json.parseToJsonElement("""{"resourceType":"DocumentReference","content":[{"attachment":{"url":"HTTPS://x.test/a.pdf","title":"Scan"}}]}"""))
        assertEquals(FhirSections.Link.Web("HTTPS://x.test/a.pdf", "Scan"), web.link)
    }

    @Test fun aSectionIsBoundedAndSomethingThatIsNotABundleReadsAsEmpty() {
        val n = FhirSections.MAX_ITEMS + 10
        val many = (0 until n).joinToString(",") { """{"fullUrl":"urn:uuid:o$it","resource":{"resourceType":"Condition","code":{"text":"C$it"}}}""" }
        val refs = (0 until n).joinToString(",") { """{"reference":"urn:uuid:o$it"}""" }
        val big = Json.parseToJsonElement("""{"entry":[{"resource":{"resourceType":"Composition","section":[{"title":"All","entry":[$refs]}]}},$many]}""")
        assertEquals(FhirSections.MAX_ITEMS, FhirSections.read(big).sections.first().items.size)
        assertEquals(FhirSections.Document(null, null, null, emptyList()), FhirSections.read(JsonPrimitive("garbage")))
    }
}
