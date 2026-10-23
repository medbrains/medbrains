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

    /// One bundle whose single section holds `resources` (JSON objects).
    private func record(_ title: String, _ resources: [String]) -> FhirSections.Document {
        let refs = resources.indices.map { #"{"reference":"urn:uuid:r\#($0)"}"# }.joined(separator: ",")
        let entries = resources.enumerated().map { #"{"fullUrl":"urn:uuid:r\#($0.offset)","resource":\#($0.element)}"# }.joined(separator: ",")
        let json = #"{"entry":[{"resource":{"resourceType":"Composition","section":[{"title":"\#(title)","entry":[\#(refs)]}]}},\#(entries)]}"#
        return FhirSections.read(JSONValue(parsing: json)!)
    }

    /// M3 HIU_FLOW_106–113: the four HI types beyond notes, prescriptions and
    /// reports read as the web reads them.
    func testTheFourNewerHiTypesReadAsTheWebReadsThem() {
        let shot = record("Immunization record", [#"{"resourceType":"Immunization","vaccineCode":{"text":"Hepatitis B vaccine"},"occurrenceDateTime":"2026-10-01","lotNumber":"HB-2231","protocolApplied":[{"doseNumberPositiveInt":2}]}"#])
        XCTAssertEqual(shot.sections.first?.items.first?.detail, "2026-10-01 · dose 2 · lot HB-2231")
        let vitals = record("Vital Signs", [#"{"resourceType":"Observation","code":{"text":"Blood pressure"},"component":[{"code":{"text":"Systolic"},"valueQuantity":{"value":128,"unit":"mmHg"}},{"code":{"text":"Diastolic"},"valueQuantity":{"value":84,"unit":"mmHg"}}]}"#])
        XCTAssertEqual(vitals.sections.first?.items.first?.text, "Blood pressure: Systolic 128 mmHg · Diastolic 84 mmHg")
        let bill = record("Invoice", [#"{"resourceType":"Invoice","identifier":[{"value":"INV-1042"}],"type":{"coding":[{"code":"03","display":"OPD"}]},"lineItem":[{},{}],"totalNet":{"value":1000,"currency":"INR"},"totalGross":{"value":1180,"currency":"INR"}}"#])
        XCTAssertEqual(bill.sections.first?.items.first?.text, "OPD INV-1042")
        XCTAssertEqual(bill.sections.first?.items.first?.detail, "Total INR 1180.00 · net INR 1000.00 · 2 items")
        let doc = record("Referral letter", [#"{"resourceType":"DocumentReference","content":[{"attachment":{"contentType":"image/jpeg","data":"/9j/","title":"ref.jpg"}}]}"#])
        XCTAssertEqual(doc.sections.first?.items.first?.link, .inline(base64: "/9j/", contentType: "image/jpeg", label: "ref.jpg", fileName: "ref.jpg"))
    }
}
