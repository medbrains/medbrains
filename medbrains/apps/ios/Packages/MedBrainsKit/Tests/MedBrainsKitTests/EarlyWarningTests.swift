import XCTest
@testable import MedBrainsKit

/// The phone sends what the web sends, and reads the score the same way.
final class EarlyWarningTests: XCTestCase {
    private func encode(_ i: EarlyWarning.Inputs) throws -> String {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        encoder.outputFormatting = .sortedKeys
        return String(decoding: try encoder.encode(i), as: UTF8.self)
    }

    func testInputsAreSentInTheServersShape() throws {
        let i = try EarlyWarning.inputs(consciousness: "C", device: "nasal_prongs", flow: "1.5", fio2: "40", capillaryRefill: "2.5", distress: "mild").get()
        XCTAssertEqual(try encode(i), #"{"capillary_refill_seconds":2.5,"consciousness":"C","oxygen_device":"nasal_prongs","oxygen_flow_lpm":1.5,"respiratory_distress":"mild"}"#, "FiO2 is not sent off high flow")
        let hf = try EarlyWarning.inputs(consciousness: nil, device: "high_flow", flow: "20", fio2: "35", capillaryRefill: "", distress: nil).get()
        XCTAssertEqual(try encode(hf), #"{"fio2_percent":35,"oxygen_device":"high_flow"}"#)
        XCTAssertEqual(try encode(try EarlyWarning.inputs(consciousness: nil, device: nil, flow: "", fio2: "", capillaryRefill: "", distress: nil).get()), "{}", "blank is not charted, never zero")
    }

    func testOutOfRangeValuesAreRefused() {
        guard case .failure(let p) = EarlyWarning.inputs(consciousness: nil, device: "high_flow", flow: "", fio2: "15", capillaryRefill: "", distress: nil) else { return XCTFail() }
        XCTAssertEqual(p.message, "FiO₂ must be 21–100%")
        guard case .failure = EarlyWarning.inputs(consciousness: nil, device: nil, flow: "", fio2: "", capillaryRefill: "abc", distress: nil) else { return XCTFail() }
    }

    func testTheScoreReadsInWords() throws {
        let json = #"{"tool":"news2","total":3,"band":"low_medium","incomplete":true,"missing":["consciousness","spo2"],"params":[],"spo2_scale":1,"age_band":null,"next_due_at":"2026-10-26T10:00:00Z","escalation_id":null}"#
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let s = try decoder.decode(EarlyWarning.Score.self, from: Data(json.utf8))
        XCTAssertEqual(EarlyWarning.headline(s), "NEWS2 3+ · Low–medium")
        XCTAssertEqual(EarlyWarning.missingText(s.missing), "Consciousness, SpO₂")
        XCTAssertNil(s.escalationId)
        XCTAssertEqual(EarlyWarning.totalText(6, incomplete: false), "6")
        XCTAssertEqual(EarlyWarning.bandTone("emergency"), .danger)
        XCTAssertEqual(EarlyWarning.bandTone("something_new"), .danger, "an unknown band is never calm")
    }
}
