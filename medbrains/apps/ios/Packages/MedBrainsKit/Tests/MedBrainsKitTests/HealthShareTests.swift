import XCTest
@testable import MedBrainsKit

/// The phone sends what the server takes, in the units it takes, and only
/// what the patient said yes to.
final class HealthShareTests: XCTestCase {
    private func reading(_ kind: HealthDataKind, _ value: Double? = nil, bp: (Double, Double)? = nil) -> HealthAppReading {
        HealthAppReading(dataType: kind, externalId: UUID().uuidString, measuredAt: Date(), value: value, systolic: bp?.0, diastolic: bp?.1)
    }

    func testUnitsAreConvertedToWhatTheServerTakes() {
        XCTAssertEqual(HealthShare.glucoseMgDl(mmolPerL: 5.5), 99.1, accuracy: 0.1)
        XCTAssertEqual(HealthShare.percent(fraction: 0.97), 97, accuracy: 0.001)
        XCTAssertEqual(HealthShare.percent(fraction: 97), 97, "already percent stays percent")
    }

    func testImplausibleReadingsAreNotSent() {
        XCTAssertTrue(HealthShare.isPlausible(reading(.bloodPressure, bp: (128, 82))))
        XCTAssertFalse(HealthShare.isPlausible(reading(.bloodPressure, bp: (80, 90))), "diastolic above systolic")
        XCTAssertFalse(HealthShare.isPlausible(reading(.glucose, 5.5)), "mmol/L not converted")
        XCTAssertFalse(HealthShare.isPlausible(reading(.spo2, 0.97)), "fraction not converted")
        XCTAssertTrue(HealthShare.isPlausible(reading(.heartRate, 72)))
        XCTAssertFalse(HealthShare.isPlausible(reading(.weight, nil)))
    }

    func testReadingsGoInServerSizedBatches() {
        let many = (0..<1_201).map { _ in reading(.heartRate, 70) }
        let batches = HealthShare.batches(many + [reading(.spo2, 12)])
        XCTAssertEqual(batches.map(\.count), [500, 500, 201])
    }

    func testAWatchsHeartRateIsThinnedToOnePerHour() {
        let start = Date(timeIntervalSince1970: 1_800_000_000)
        let everyFive = (0..<36).map { HealthAppReading(dataType: .heartRate, externalId: "\($0)", measuredAt: start.addingTimeInterval(Double($0) * 300), value: 70) }
        let kept = HealthShare.thinned(everyFive, everyMinutes: 60)
        XCTAssertEqual(kept.map(\.externalId), ["0", "12", "24"], "3 hours of 5-minute samples")
    }

    func testNothingIsSharedUntilThePatientSaysSo() throws {
        let json = #"{"consents":[{"source":"healthkit","data_type":"glucose","granted":true,"recorded_at":"2026-10-29T10:00:00Z"},{"source":"healthkit","data_type":"weight","granted":false,"recorded_at":"2026-10-29T10:00:00Z"}]}"#
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        let sharing = try d.decode(HealthDataSharing.self, from: Data(json.utf8))
        XCTAssertTrue(sharing.isShared(.glucose, from: .healthkit))
        XCTAssertFalse(sharing.isShared(.weight, from: .healthkit))
        XCTAssertFalse(sharing.isShared(.spo2, from: .healthkit), "never asked")
        XCTAssertFalse(sharing.isShared(.glucose, from: .healthConnect), "per source")
    }

    func testTheWireUsesTheServersNames() throws {
        let e = JSONEncoder()
        e.keyEncodingStrategy = .convertToSnakeCase
        let body = String(decoding: try e.encode(reading(.heartRate, 70)), as: UTF8.self)
        XCTAssertTrue(body.contains(#""data_type":"heart_rate""#), body)
        XCTAssertTrue(body.contains(#""external_id""#))
    }
}
