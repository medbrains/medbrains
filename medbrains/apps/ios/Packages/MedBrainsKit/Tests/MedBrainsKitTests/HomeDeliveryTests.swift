import XCTest
@testable import MedBrainsKit

/// The same decisions the web portal's delivery tests pin, so a choice the
/// phone sends is one the browser would send.
final class HomeDeliveryTests: XCTestCase {
    func testADeliveryNeedsAnAddressAPhoneAndAnOfferedWayToPay() {
        let offered = [HomeDelivery.payNow]
        XCTAssertNil(HomeDelivery.problem(address: "12 Lake Road", phone: "90000 00001", payment: "prepaid", offered: offered))
        XCTAssertEqual(HomeDelivery.problem(address: "12", phone: "9000000001", payment: "prepaid", offered: offered), "Enter the full address")
        XCTAssertEqual(HomeDelivery.problem(address: "12 Lake Road", phone: "12345", payment: "prepaid", offered: offered), "Enter a 10-digit phone number")
        // Pay on delivery wasn't offered to this patient.
        XCTAssertEqual(HomeDelivery.problem(address: "12 Lake Road", phone: "9000000001", payment: "cash_on_delivery", offered: offered), "Choose how to pay")
        XCTAssertEqual(HomeDelivery.problem(address: "12 Lake Road", phone: "9000000001", payment: nil, offered: offered), "Choose how to pay")
    }

    func testTheChoiceIsTrimmedAndBlanksAreLeftOut() {
        let choice = HomeDelivery.choice(address: " 4 Temple Street ", landmark: "  ", pincode: "630001", phone: "9000000001 ", slot: nil, payment: "prepaid")
        XCTAssertEqual(choice, HomeDelivery.Choice(address: "4 Temple Street", landmark: nil, pincode: "630001", contactPhone: "9000000001", preferredSlot: nil, payment: "prepaid"))
    }

    func testTheChoiceIsSentInTheServersShape() throws {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        encoder.outputFormatting = .sortedKeys
        let choice = HomeDelivery.choice(address: "12 Lake Road", landmark: "", pincode: nil, phone: "9000000001", slot: "evening", payment: "cash_on_delivery")
        let json = String(decoding: try encoder.encode(choice), as: UTF8.self)
        XCTAssertEqual(json, #"{"address":"12 Lake Road","contact_phone":"9000000001","payment":"cash_on_delivery","preferred_slot":"evening"}"#)
    }

    func testEveryStageReadsInWords() {
        XCTAssertEqual(HomeDelivery.stageLabel("out_for_delivery"), "Out for delivery")
        XCTAssertEqual(HomeDelivery.stageLabel("awaiting_payment"), "Waiting for payment")
        XCTAssertEqual(HomeDelivery.stageLabel("something_new"), "something new")
    }

    func testOnlyTheStepsReachedAreListed() {
        let steps = HomeDelivery.steps(requestedAt: "2026-10-19T04:00:00Z", preparedAt: "2026-10-19T06:00:00Z", dispatchedAt: nil, deliveredAt: nil)
        XCTAssertEqual(steps.map(\.label), ["Requested", "Being prepared"])
    }
}
