import Foundation

/// Blood pressure is two numbers — systolic (high) and diastolic (low). Every
/// screen that takes one checks it here, by the same rules as the web
/// (`@medbrains/schemas` blood-pressure.ts), so a reading is refused the same
/// way at the bedside and on the desk.
public enum BloodPressure {
    public static let systolicRange = 50...300
    public static let diastolicRange = 20...200

    public struct Errors: Equatable, Sendable {
        public var systolic: String?
        public var diastolic: String?
        public var isEmpty: Bool { systolic == nil && diastolic == nil }
    }

    /// A checked reading: both numbers, or neither.
    public struct Reading: Equatable, Sendable {
        public let systolic: Int?
        public let diastolic: Int?
    }

    /// Errors for the text in the two fields; blank in both is allowed.
    public static func validate(systolic: String, diastolic: String) -> Errors {
        let s = systolic.trimmingCharacters(in: .whitespaces)
        let d = diastolic.trimmingCharacters(in: .whitespaces)
        var errors = Errors()
        if !s.isEmpty, !(Int(s).map(systolicRange.contains) ?? false) {
            errors.systolic = "Systolic must be a whole number, \(systolicRange.lowerBound)–\(systolicRange.upperBound) mmHg"
        }
        if !d.isEmpty, !(Int(d).map(diastolicRange.contains) ?? false) {
            errors.diastolic = "Diastolic must be a whole number, \(diastolicRange.lowerBound)–\(diastolicRange.upperBound) mmHg"
        }
        if !s.isEmpty, d.isEmpty { errors.diastolic = "Enter the diastolic (low) value too" }
        if s.isEmpty, !d.isEmpty { errors.systolic = "Enter the systolic (high) value too" }
        if errors.isEmpty, let sv = Int(s), let dv = Int(d), sv <= dv {
            errors.diastolic = "Diastolic (low) must be lower than systolic (high)"
        }
        return errors
    }

    /// The reading to send, or the errors to show.
    public static func reading(systolic: String, diastolic: String) -> Result<Reading, ValidationFailure> {
        let errors = validate(systolic: systolic, diastolic: diastolic)
        guard errors.isEmpty else { return .failure(ValidationFailure(errors: errors)) }
        let s = Int(systolic.trimmingCharacters(in: .whitespaces))
        let d = Int(diastolic.trimmingCharacters(in: .whitespaces))
        return .success(Reading(systolic: s, diastolic: d))
    }

    public struct ValidationFailure: Error, Equatable {
        public let errors: Errors
        public var message: String { errors.systolic ?? errors.diastolic ?? "" }
    }
}
