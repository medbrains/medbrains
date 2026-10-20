import XCTest
@testable import MedBrainsKit

/// The same bundle and the same answers as the web's `fhirSections.test.ts`,
/// so a record reads identically on the phone and in the browser.
final class FhirSectionsTests: XCTestCase {
    private let bundle = JSONValue(parsing: """
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
    """)!

    func testReadsTheHeaderAndOnlySectionsWithSomethingInThem() {
        let doc = FhirSections.read(bundle)
        XCTAssertEqual(doc.title, "OP consultation")
        XCTAssertEqual(doc.date, "2024-06-01")
        XCTAssertEqual(doc.author, "Dr. Mehta")
        XCTAssertEqual(doc.sections.map(\.title), ["Diagnoses", "Results", "Documents", "Medicines"])
        XCTAssertEqual(doc.sections[0].items.first?.text, "Type 2 diabetes")
    }

    func testAResultShowsItsUnitRangeAndFlagAndDanglingReferencesAreSkipped() {
        let results = FhirSections.read(bundle).sections[1]
        XCTAssertEqual(results.items, [FhirSections.Item(key: "0:Observation/hb", text: "Haemoglobin: 9.8 g/dL", detail: "Range 12 g/dL – 15 g/dL · Low", link: nil)])
    }

    func testAMedicineReadsWithItsDosage() {
        let medicine = FhirSections.read(bundle).sections[3].items.first
        XCTAssertEqual(medicine?.text, "Metformin 500 mg")
        XCTAssertEqual(medicine?.detail, "1 tablet twice a day")
    }

    func testAnInlineAttachmentIsAFileAndNonWebLinksAreDropped() {
        let link = FhirSections.read(bundle).sections[2].items.first?.link
        XCTAssertEqual(link, .inline(base64: "JVBERi0=", contentType: "application/pdf", label: "ds.pdf", fileName: "ds.pdf"))
        let unsafe = FhirSections.describe(JSONValue(parsing: #"{"resourceType":"DocumentReference","content":[{"attachment":{"url":"javascript:alert(1)"}}]}"#))
        XCTAssertNil(unsafe.link)
        let web = FhirSections.describe(JSONValue(parsing: #"{"resourceType":"DocumentReference","content":[{"attachment":{"url":"HTTPS://x.test/a.pdf","title":"Scan"}}]}"#))
        XCTAssertEqual(web.link, .web(URL(string: "HTTPS://x.test/a.pdf")!, label: "Scan"))
    }

    func testASectionIsBoundedAndSomethingThatIsNotABundleReadsAsEmpty() {
        let many = (0..<(FhirSections.maxItems + 10)).map { #"{"fullUrl":"urn:uuid:o\#($0)","resource":{"resourceType":"Condition","code":{"text":"C\#($0)"}}}"# }
        let refs = (0..<(FhirSections.maxItems + 10)).map { #"{"reference":"urn:uuid:o\#($0)"}"# }
        let big = JSONValue(parsing: #"{"entry":[{"resource":{"resourceType":"Composition","section":[{"title":"All","entry":[\#(refs.joined(separator: ","))]}]}},\#(many.joined(separator: ","))]}"#)!
        XCTAssertEqual(FhirSections.read(big).sections.first?.items.count, FhirSections.maxItems)
        XCTAssertEqual(FhirSections.read(.string("garbage")), FhirSections.Document(title: nil, date: nil, author: nil, sections: []))
    }
}
