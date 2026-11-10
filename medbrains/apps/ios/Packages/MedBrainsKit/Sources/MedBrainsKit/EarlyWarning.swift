import Foundation

/// The early-warning score charted with every bedside vitals reading. The
/// server scores it (NEWS2 adults, PEWS children by age band, MEOWS pregnant
/// and post-partum — `crates/medbrains-clinical-scores/src/ews`); this only
/// shapes what is sent and how the answer reads. Same labels as the web
/// (`apps/web/src/components/EarlyWarning/ews-display.ts`).
public enum EarlyWarning {
    public struct Option: Hashable, Sendable {
        public let code: String
        public let label: String
    }

    /// ACVPU.
    public static let consciousness: [Option] = [
        .init(code: "A", label: "Alert"),
        .init(code: "C", label: "New confusion"),
        .init(code: "V", label: "Voice"),
        .init(code: "P", label: "Pain"),
        .init(code: "U", label: "Unresponsive"),
    ]
    public static let roomAir = "room_air"
    public static let highFlow = "high_flow"
    public static let oxygenDevices: [Option] = [
        .init(code: roomAir, label: "Room air"),
        .init(code: "nasal_prongs", label: "Nasal prongs"),
        .init(code: "mask", label: "Mask"),
        .init(code: highFlow, label: "High flow"),
        .init(code: "other", label: "Other support"),
    ]
    public static let distress: [Option] = [
        .init(code: "nil", label: "Nil"),
        .init(code: "mild", label: "Mild"),
        .init(code: "moderate", label: "Moderate"),
        .init(code: "severe", label: "Severe"),
    ]
    /// The server's accepted ranges.
    public static let flowRange = 0.0...80.0
    public static let fio2Range = 21...100
    public static let capillaryRefillRange = 0.0...20.0

    /// What a score needs beyond the classic vitals. Blank is not charted —
    /// the score is then incomplete, never assumed normal.
    public struct Inputs: Encodable, Equatable, Sendable {
        public var consciousness: String?
        public var oxygenDevice: String?
        public var oxygenFlowLpm: Double?
        public var fio2Percent: Int?
        public var capillaryRefillSeconds: Double?
        public var respiratoryDistress: String?
    }

    public struct Problem: Error, Equatable {
        public let message: String
    }

    /// Check and shape the typed text. Flow is sent only for low-flow
    /// devices and FiO₂ only on high flow, as the server scores them.
    public static func inputs(
        consciousness: String?, device: String?, flow: String, fio2: String,
        capillaryRefill: String, distress: String?
    ) -> Result<Inputs, Problem> {
        func number(_ s: String) -> Double?? {
            let t = s.trimmingCharacters(in: .whitespaces)
            if t.isEmpty { return .some(nil) }
            return Double(t).map { .some($0) } ?? nil
        }
        guard let flowValue = number(flow) else { return .failure(Problem(message: "Oxygen flow must be a number")) }
        guard let fio2Value = number(fio2) else { return .failure(Problem(message: "FiO₂ must be a number")) }
        guard let crtValue = number(capillaryRefill) else { return .failure(Problem(message: "Capillary refill must be a number")) }
        let onLowFlow = device != nil && device != roomAir && device != highFlow
        let sentFlow = onLowFlow ? flowValue : nil
        let sentFio2 = device == highFlow ? fio2Value.map { Int($0) } : nil
        if let f = sentFlow, !flowRange.contains(f) { return .failure(Problem(message: "Oxygen flow must be 0–80 L/min")) }
        if let f = sentFio2, !fio2Range.contains(f) { return .failure(Problem(message: "FiO₂ must be 21–100%")) }
        if let c = crtValue, !capillaryRefillRange.contains(c) { return .failure(Problem(message: "Capillary refill must be 0–20 seconds")) }
        return .success(Inputs(
            consciousness: consciousness, oxygenDevice: device, oxygenFlowLpm: sentFlow,
            fio2Percent: sentFio2, capillaryRefillSeconds: crtValue, respiratoryDistress: distress
        ))
    }

    /// The `ews` the server returns with a charted reading.
    public struct Score: Decodable, Equatable, Sendable {
        public let tool: String
        public let total: Int
        public let band: String
        public let incomplete: Bool
        public let missing: [String]
        public let nextDueAt: String
        public let escalationId: String?
    }

    public static let toolLabels = ["news2": "NEWS2", "pews": "PEWS", "meows": "MEOWS"]
    public static let bandLabels = [
        "routine": "Routine", "low": "Low", "low_medium": "Low–medium",
        "urgent": "Urgent", "emergency": "Emergency",
    ]
    public static let paramLabels = [
        "respiratory_rate": "Respiratory rate", "spo2": "SpO₂", "air_or_oxygen": "Air or oxygen",
        "oxygen": "Oxygen", "systolic_bp": "Systolic BP", "diastolic_bp": "Diastolic BP",
        "pulse": "Heart rate", "consciousness": "Consciousness", "temperature": "Temperature",
        "respiratory_distress": "Respiratory distress", "capillary_refill": "Capillary refill",
        "age": "Date of birth",
    ]

    public static func toolLabel(_ tool: String) -> String { toolLabels[tool] ?? tool.uppercased() }
    public static func bandLabel(_ band: String) -> String { bandLabels[band] ?? band }

    /// Unknown bands read as danger: a band this build does not know is never calm.
    public static func bandTone(_ band: String) -> Tone {
        switch band {
        case "routine": .success
        case "low": .neutral
        case "low_medium", "urgent": .warning
        default: .danger
        }
    }

    /// "6", or "3+" for an incomplete set — the score can only rise.
    public static func totalText(_ total: Int, incomplete: Bool) -> String {
        incomplete ? "\(total)+" : "\(total)"
    }

    /// "NEWS2 6 · Urgent".
    public static func headline(_ s: Score) -> String {
        "\(toolLabel(s.tool)) \(totalText(s.total, incomplete: s.incomplete)) · \(bandLabel(s.band))"
    }

    public static func missingText(_ missing: [String]) -> String {
        missing.map { paramLabels[$0] ?? $0 }.joined(separator: ", ")
    }
}
