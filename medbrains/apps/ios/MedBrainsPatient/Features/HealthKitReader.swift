import Foundation
import HealthKit
import MedBrainsKit

/// Reads (never writes) the kinds of readings the patient chose to share,
/// from Apple Health, since the last share. Each sample keeps its HealthKit
/// UUID, so sharing twice stores it once on the server.
actor HealthKitReader {
    static let isAvailable = HKHealthStore.isHealthDataAvailable()

    private let store = HKHealthStore()
    private let defaults = UserDefaults.standard
    /// Heart rate from a watch arrives every few minutes; one per hour is
    /// what a care team can read.
    private let heartRateEveryMinutes = 60

    /// The HealthKit types behind a kind of reading.
    static func types(for kind: HealthDataKind) -> Set<HKObjectType> {
        switch kind {
        case .bloodPressure:
            return [HKQuantityType(.bloodPressureSystolic), HKQuantityType(.bloodPressureDiastolic), HKCorrelationType(.bloodPressure)]
        case .glucose: return [HKQuantityType(.bloodGlucose)]
        case .weight: return [HKQuantityType(.bodyMass)]
        case .spo2: return [HKQuantityType(.oxygenSaturation)]
        case .heartRate: return [HKQuantityType(.heartRate)]
        }
    }

    /// Ask Apple Health for read access to `kind`. The answer is Apple's to
    /// keep: HealthKit never says whether reading was refused, only shows no data.
    func requestAccess(to kind: HealthDataKind) async throws {
        try await store.requestAuthorization(toShare: [], read: Self.types(for: kind))
    }

    /// Readings of `kind` since the last share (or the last 90 days).
    func readings(_ kind: HealthDataKind) async throws -> [HealthAppReading] {
        let since = (defaults.object(forKey: anchorKey(kind)) as? Date)
            ?? Calendar.current.date(byAdding: .day, value: -HealthShare.lookbackDays, to: Date()) ?? Date()
        let predicate = HKQuery.predicateForSamples(withStart: since, end: nil, options: .strictStartDate)
        switch kind {
        case .bloodPressure:
            let samples: [HKCorrelation] = try await query(HKCorrelationType(.bloodPressure), predicate)
            return samples.compactMap { c in
                let sys = (c.objects(for: HKQuantityType(.bloodPressureSystolic)).first as? HKQuantitySample)?.quantity.doubleValue(for: .millimeterOfMercury())
                let dia = (c.objects(for: HKQuantityType(.bloodPressureDiastolic)).first as? HKQuantitySample)?.quantity.doubleValue(for: .millimeterOfMercury())
                return HealthAppReading(dataType: .bloodPressure, externalId: c.uuid.uuidString, measuredAt: c.startDate, systolic: sys, diastolic: dia)
            }
        case .glucose:
            return try await quantities(.bloodGlucose, HKUnit(from: "mg/dL"), kind, predicate)
        case .weight:
            return try await quantities(.bodyMass, .gramUnit(with: .kilo), kind, predicate)
        case .spo2:
            return try await quantities(.oxygenSaturation, .percent(), kind, predicate).map {
                HealthAppReading(dataType: .spo2, externalId: $0.externalId, measuredAt: $0.measuredAt, value: HealthShare.percent(fraction: $0.value ?? 0))
            }
        case .heartRate:
            let all = try await quantities(.heartRate, HKUnit.count().unitDivided(by: .minute()), kind, predicate)
            return HealthShare.thinned(all, everyMinutes: heartRateEveryMinutes)
        }
    }

    /// Remember that `kind` was shared up to `date`.
    func markShared(_ kind: HealthDataKind, through date: Date) {
        defaults.set(date, forKey: anchorKey(kind))
    }

    private func anchorKey(_ kind: HealthDataKind) -> String { "healthkit.shared-through.\(kind.rawValue)" }

    private func quantities(_ id: HKQuantityTypeIdentifier, _ unit: HKUnit, _ kind: HealthDataKind, _ predicate: NSPredicate) async throws -> [HealthAppReading] {
        let samples: [HKQuantitySample] = try await query(HKQuantityType(id), predicate)
        return samples.map { HealthAppReading(dataType: kind, externalId: $0.uuid.uuidString, measuredAt: $0.startDate, value: $0.quantity.doubleValue(for: unit)) }
    }

    private func query<T: HKSample>(_ type: HKSampleType, _ predicate: NSPredicate) async throws -> [T] {
        try await withCheckedThrowingContinuation { cont in
            let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)
            let q = HKSampleQuery(sampleType: type, predicate: predicate, limit: HealthShare.maxSamplesPerKind, sortDescriptors: [sort]) { _, samples, error in
                if let error { cont.resume(throwing: error) } else { cont.resume(returning: (samples ?? []).compactMap { $0 as? T }) }
            }
            store.execute(q)
        }
    }
}
