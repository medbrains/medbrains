import XCTest
@testable import MedBrainsKit

/// The same decisions the web's blood-pressure tests pin, so a reading the
/// ward tablet refuses is one the desk refuses too.
final class BloodPressureTests: XCTestCase {
    func testNormalAndBlankAreAccepted() {
        XCTAssertTrue(BloodPressure.validate(systolic: "120", diastolic: "80").isEmpty)
        XCTAssertTrue(BloodPressure.validate(systolic: "", diastolic: " ").isEmpty)
    }

    func testBothNumbersOrNeither() {
        XCTAssertEqual(BloodPressure.validate(systolic: "120", diastolic: "").diastolic, "Enter the diastolic (low) value too")
        XCTAssertEqual(BloodPressure.validate(systolic: "", diastolic: "80").systolic, "Enter the systolic (high) value too")
    }

    func testRangesAreInclusive() {
        XCTAssertTrue(BloodPressure.validate(systolic: "50", diastolic: "20").isEmpty)
        XCTAssertTrue(BloodPressure.validate(systolic: "300", diastolic: "200").isEmpty)
        XCTAssertNotNil(BloodPressure.validate(systolic: "49", diastolic: "30").systolic)
        XCTAssertNotNil(BloodPressure.validate(systolic: "301", diastolic: "80").systolic)
        XCTAssertNotNil(BloodPressure.validate(systolic: "120", diastolic: "19").diastolic)
        XCTAssertNotNil(BloodPressure.validate(systolic: "120.5", diastolic: "80").systolic)
    }

    func testSwappedNumbersAreRefused() {
        XCTAssertEqual(BloodPressure.validate(systolic: "80", diastolic: "120").diastolic, "Diastolic (low) must be lower than systolic (high)")
        XCTAssertNotNil(BloodPressure.validate(systolic: "90", diastolic: "90").diastolic)
    }

    func testReadingCarriesBothNumbers() {
        XCTAssertEqual(try BloodPressure.reading(systolic: " 142", diastolic: "91 ").get(), .init(systolic: 142, diastolic: 91))
        XCTAssertEqual(try BloodPressure.reading(systolic: "", diastolic: "").get(), .init(systolic: nil, diastolic: nil))
    }
}
