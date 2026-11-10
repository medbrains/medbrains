import Foundation

/// The readings a patient can share from Apple Health / Health Connect, as
/// the server names them (`routes/portal_health.rs`).
public enum HealthDataKind: String, CaseIterable, Codable, Sendable, Identifiable {
    case bloodPressure = "blood_pressure"
    case glucose
    case weight
    case spo2
    case heartRate = "heart_rate"

    public var id: String { rawValue }

    public var label: String {
        switch self {
        case .bloodPressure: "Blood pressure"
        case .glucose: "Blood glucose"
        case .weight: "Weight"
        case .spo2: "Oxygen saturation (SpO₂)"
        case .heartRate: "Heart rate"
        }
    }
}

/// Where the readings come from on this phone.
public enum HealthDataSource: String, Codable, Sendable {
    case healthkit
    case healthConnect = "health_connect"
}

/// One reading as the server takes it: glucose in mg/dL, weight in kg,
/// SpO₂ in percent.
public struct HealthAppReading: Encodable, Equatable, Sendable {
    public let dataType: HealthDataKind
    /// The sample's own id, so sharing twice stores it once.
    public let externalId: String
    public let measuredAt: Date
    public let value: Double?
    public let systolic: Double?
    public let diastolic: Double?

    public init(dataType: HealthDataKind, externalId: String, measuredAt: Date, value: Double? = nil, systolic: Double? = nil, diastolic: Double? = nil) {
        self.dataType = dataType
        self.externalId = externalId
        self.measuredAt = measuredAt
        self.value = value
        self.systolic = systolic
        self.diastolic = diastolic
    }
}

/// The patient's latest yes/no for one kind.
public struct HealthDataConsent: Decodable, Equatable, Sendable {
    public let source: String
    public let dataType: String
    public let granted: Bool
    public let recordedAt: String
}

public struct HealthDataSharing: Decodable, Sendable {
    public let consents: [HealthDataConsent]

    /// Whether `kind` is shared from `source`; nothing is, until said so.
    public func isShared(_ kind: HealthDataKind, from source: HealthDataSource) -> Bool {
        consents.first { $0.source == source.rawValue && $0.dataType == kind.rawValue }?.granted ?? false
    }
}

public struct HealthReadingsResult: Decodable, Sendable {
    public struct Refused: Decodable, Sendable { public let externalId: String; public let reason: String }
    public let accepted: Int
    public let duplicates: Int
    public let refused: [Refused]
}

public enum HealthShare {
    /// Readings per request (the server's limit).
    public static let maxBatch = 500
    /// How far back a first share reaches (the server refuses older).
    public static let lookbackDays = 90
    /// Samples read per kind in one share; older ones follow next time.
    public static let maxSamplesPerKind = 5_000
    /// mg/dL per mmol/L of glucose.
    public static let glucoseMgPerMmol = 18.0156

    public static func glucoseMgDl(mmolPerL: Double) -> Double { mmolPerL * glucoseMgPerMmol }

    /// HealthKit stores SpO₂ as a fraction (0.97); the server wants percent.
    public static func percent(fraction: Double) -> Double { fraction <= 1 ? fraction * 100 : fraction }

    /// Whether a reading is one a body can produce -- the same bounds the
    /// server applies, so the phone does not send what will be refused.
    public static func isPlausible(_ r: HealthAppReading) -> Bool {
        let within = { (v: Double?, lo: Double, hi: Double) in v.map { (lo...hi).contains($0) } ?? false }
        switch r.dataType {
        case .bloodPressure:
            return within(r.systolic, 50, 300) && within(r.diastolic, 20, 200) && (r.diastolic ?? 0) < (r.systolic ?? 0)
        case .glucose: return within(r.value, 10, 1000)
        case .weight: return within(r.value, 0.3, 400)
        case .spo2: return within(r.value, 50, 100)
        case .heartRate: return within(r.value, 20, 300)
        }
    }

    /// One reading per `everyMinutes` window (the first in each), for kinds a
    /// watch records every few minutes. Input in time order.
    public static func thinned(_ readings: [HealthAppReading], everyMinutes: Int) -> [HealthAppReading] {
        var lastKept: Date?
        return readings.filter { r in
            if let last = lastKept, r.measuredAt.timeIntervalSince(last) < Double(everyMinutes * 60) { return false }
            lastKept = r.measuredAt
            return true
        }
    }

    /// Plausible readings in request-sized batches.
    public static func batches(_ readings: [HealthAppReading]) -> [[HealthAppReading]] {
        let kept = readings.filter(isPlausible)
        return stride(from: 0, to: kept.count, by: maxBatch).map { Array(kept[$0..<min($0 + maxBatch, kept.count)]) }
    }
}
