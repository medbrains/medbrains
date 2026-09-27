import Foundation
import MedBrainsCore
import Observation

// The registration form as the shared core defines it
// (crates/medbrains-clinical-core/src/registration). The wizard draws these
// fields; it decides no rule and hides nothing on its own.

/// Where a field's choices come from.
enum OptionSource: String, Decodable, Sendable {
    case none, fixed, departments, doctors, camps, icd11
    case drugCatalogue = "drug_catalogue"
}

struct CatalogueOption: Decodable, Hashable, Sendable {
    let value: String
    let label: String
}

struct CatalogueOptions: Decodable, Sendable {
    let source: OptionSource
    let options: [CatalogueOption]?
}

/// How a field is entered, as the core names it.
enum FieldKind: String, Decodable, Sendable {
    case text, email, date, age, digits, number, segmented, select, toggle, tags, phone, search, hidden
    case longText = "long_text"
}

struct CatalogueField: Decodable, Identifiable, Sendable {
    let id: String
    let label: String
    let step: String
    let kind: FieldKind
    let options: CatalogueOptions
    let hint: String?
    /// What a new draft starts with, if anything.
    let `default`: String?
}

struct CatalogueStep: Decodable, Sendable {
    let step: String
    let title: String
}

struct RegistrationCatalogue: Decodable, Sendable {
    let steps: [CatalogueStep]
    let fields: [CatalogueField]

    /// Built into the app with the core, so it is always the rules this build enforces.
    static let shared: RegistrationCatalogue = (try? JSONDecoder().decode(
        RegistrationCatalogue.self, from: Data(registrationCatalogueJson().utf8)
    )) ?? RegistrationCatalogue(steps: [], fields: [])

    func fields(in step: String) -> [CatalogueField] { fields.filter { $0.step == step } }
    func field(_ id: String) -> CatalogueField? { fields.first { $0.id == id } }
}

/// What the desk has entered, by the catalogue's field ids. The core reads
/// it for problems, visibility and the request; nothing here interprets it.
@MainActor
@Observable
final class RegistrationDraftValues {
    private(set) var values: [String: String] = RegistrationDraftValues.defaults

    /// The catalogue's starting values — the same the web form starts with.
    private static var defaults: [String: String] {
        Dictionary(uniqueKeysWithValues: RegistrationCatalogue.shared.fields.compactMap { f in f.default.map { (f.id, $0) } })
    }

    subscript(id: String) -> String {
        get { values[id] ?? "" }
        set { values[id] = newValue }
    }

    /// A toggle's value as a Bool.
    func isOn(_ id: String) -> Bool { values[id] == "true" }

    var problems: [RegistrationProblem] { registrationProblems(draft: values) }
    var visible: Set<String> { Set(registrationVisibleFields(draft: values)) }

    /// The create-patient request, as the core builds it.
    func request(year: Int) -> String { registrationRequestJson(draft: values, todayYear: Int32(year)) }

    /// The person is cleared and the desk kept — which is which is the core's call.
    func clearPerson() {
        values = Self.defaults.merging(values.filter { registrationCarriesOver(field: $0.key) }) { _, kept in kept }
    }
}
