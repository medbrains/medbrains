@testable import MedBrainsKit
import XCTest

final class StorefrontTests: XCTestCase {
    func testNeverACounterOnlyUnpricedOrOutOfStockItem() {
        XCTAssertTrue(Storefront.canAdd(onSale: true, saleClass: "otc", price: "10.00", stock: "available"))
        XCTAssertFalse(Storefront.canAdd(onSale: true, saleClass: "counter_only", price: "10.00", stock: "available"))
        XCTAssertFalse(Storefront.canAdd(onSale: true, saleClass: "otc", price: nil, stock: "available"))
        XCTAssertFalse(Storefront.canAdd(onSale: true, saleClass: "otc", price: "10.00", stock: "out"))
        XCTAssertFalse(Storefront.canAdd(onSale: false, saleClass: "otc", price: "10.00", stock: "low"))
    }

    func testQuantityStaysInsideTheItemsLimit() {
        XCTAssertEqual(Storefront.clamp(50, max: 10), 10)
        XCTAssertEqual(Storefront.clamp(0, max: 10), 1)
        // One unit of an H1 or habit-forming drug.
        XCTAssertEqual(Storefront.clamp(3, max: 1), 1)
    }

    func testCheckoutFollowsThePrescriptionRules() {
        XCTAssertEqual(Storefront.checkout(lines: 1, allOnSale: true, prescriptionNeeded: false, hospitalId: nil, uploaded: false), .ready(source: "none", prescriptionId: nil))
        if case .problem = Storefront.checkout(lines: 1, allOnSale: true, prescriptionNeeded: true, hospitalId: nil, uploaded: false) {} else { XCTFail("a prescription line needs a prescription") }
        XCTAssertEqual(Storefront.checkout(lines: 1, allOnSale: true, prescriptionNeeded: true, hospitalId: nil, uploaded: true), .ready(source: "upload", prescriptionId: nil))
        // The hospital's own prescription wins over an upload.
        XCTAssertEqual(Storefront.checkout(lines: 1, allOnSale: true, prescriptionNeeded: true, hospitalId: "rx1", uploaded: true), .ready(source: "hospital", prescriptionId: "rx1"))
        if case .problem = Storefront.checkout(lines: 0, allOnSale: true, prescriptionNeeded: false, hospitalId: nil, uploaded: false) {} else { XCTFail("an empty cart") }
        if case .problem = Storefront.checkout(lines: 1, allOnSale: false, prescriptionNeeded: false, hospitalId: nil, uploaded: false) {} else { XCTFail("an item taken off sale") }
    }

    func testOnlyUnexpiredPrescriptionsAreOffered() {
        XCTAssertFalse(Storefront.usable(validUntil: "2026-10-01", today: "2026-10-19"))
        XCTAssertTrue(Storefront.usable(validUntil: "2026-12-01", today: "2026-10-19"))
        XCTAssertTrue(Storefront.usable(validUntil: nil, today: "2026-10-19"))
    }

    func testStatusesAndPeopleReadInWords() {
        XCTAssertEqual(Storefront.label(Storefront.orderStatusLabels, "awaiting_verification"), "With the pharmacist")
        XCTAssertEqual(Storefront.label(Storefront.rejectReasonLabels, "illegible"), "Can't be read")
        XCTAssertEqual(Storefront.personLabel(name: "Arun S", birthYear: 2001), "Arun S (born 2001)")
    }
}
