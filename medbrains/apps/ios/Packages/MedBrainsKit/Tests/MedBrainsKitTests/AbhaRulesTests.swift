import XCTest
@testable import MedBrainsKit

/// The same cases as `medbrains_abdm::rules` and the web's `abhaRules.test.tsx`,
/// so the iOS mirror cannot drift from the server.
final class AbhaRulesTests: XCTestCase {
    func testVerhoeffCatchesEveryOneDigitSlip() {
        let good = Array("999941057058")
        XCTAssertTrue(AbhaRules.verhoeffOk(String(good)))
        XCTAssertTrue(AbhaRules.verhoeffOk("2363"))
        for i in good.indices {
            for digit in "0123456789" where digit != good[i] {
                var bad = good
                bad[i] = digit
                XCTAssertFalse(AbhaRules.verhoeffOk(String(bad)), String(bad))
            }
        }
        XCTAssertFalse(AbhaRules.verhoeffOk(""))
    }

    func testAnAadhaarNumberIsTwelveDigitsThatPassVerhoeff() {
        XCTAssertTrue(AbhaRules.isValidAadhaar("9999 4105 7058"))
        for bad in ["999941057059", "123456789012", "99994105705", "9999-4105-7058", ""] {
            XCTAssertFalse(AbhaRules.isValidAadhaar(bad), bad)
        }
    }

    func testAMobileIsTenDigitsAndNothingElse() {
        XCTAssertTrue(AbhaRules.isValidMobile("98765 43210"))
        for bad in ["987654321", "98765432101", "98765abc10", "98765-43210", "+919876543210", ""] {
            XCTAssertFalse(AbhaRules.isValidMobile(bad), bad)
        }
    }

    func testAddressRulesHoldAtEveryEdge() {
        XCTAssertFalse(AbhaRules.isValidAddress("abc", domain: "sbx"))
        XCTAssertTrue(AbhaRules.isValidAddress("abcd", domain: "sbx"))
        XCTAssertTrue(AbhaRules.isValidAddress("abcdefghijklmn", domain: "sbx"))
        XCTAssertFalse(AbhaRules.isValidAddress("abcdefghijklmno", domain: "sbx"))
        XCTAssertTrue(AbhaRules.isValidAddress("abcdefghijklm", domain: "abdm"))
        XCTAssertFalse(AbhaRules.isValidAddress("abcdefghijklmn", domain: "abdm"))
        XCTAssertTrue(AbhaRules.isValidAddress("12345678", domain: "sbx"))
        XCTAssertTrue(AbhaRules.isValidAddress("priya.v_90", domain: "sbx"))
        for bad in ["pri.ya.v", "pri_ya_v", ".priyav", "priyav_", "priya-v1", "priyä.v1"] {
            XCTAssertFalse(AbhaRules.isValidAddress(bad, domain: "sbx"), bad)
        }
        XCTAssertEqual(AbhaRules.addressName(" priya.v@sbx ", domain: "sbx"), "priya.v")
        let list = AbhaRules.addressChecklist("_ab", domain: "sbx")
        XCTAssertEqual(list.map(\.label), ["8–18 characters, including @sbx", "Letters and numbers only, besides . and _", "At most one dot (.)", "At most one underscore (_)", "No . or _ at the start or end"])
        XCTAssertEqual(list.map(\.met), [false, true, true, true, false])
    }

    func testAbdmsWordsComeFirstOurHintBeneath() {
        let split = AbhaRules.splitAbdmMessage("Invalid OTP\nCheck it (code ABDM-1204)")
        XCTAssertEqual(split.message, "Invalid OTP")
        XCTAssertEqual(split.hint, "Check it (code ABDM-1204)")
        XCTAssertNil(AbhaRules.splitAbdmMessage(AbhaRules.aadhaarInvalid).hint)
    }
}
