import MedBrainsUI
import SwiftUI

/// The loaded lists a field's choices can come from (departments, doctors,
/// camps); fixed choices come with the field itself.
struct OptionLists: Sendable {
    var departments: [CatalogueOption] = []
    var doctors: [CatalogueOption] = []
    var camps: [CatalogueOption] = []

    func options(for field: CatalogueField) -> [CatalogueOption] {
        switch field.options.source {
        case .fixed: field.options.options ?? []
        case .departments: departments
        case .doctors: doctors
        case .camps: camps
        case .none, .drugCatalogue, .icd11: []
        }
    }
}

/// One catalogue field, drawn by its kind with the Carbon controls. It holds
/// no rule: the value goes into the draft and the core judges it.
struct CatalogueFieldView: View {
    let field: CatalogueField
    @Bindable var draft: RegistrationDraftValues
    let lists: OptionLists
    let error: String?
    /// The searches a field can run as the desk types; nil where none may.
    var lookups: CatalogueLookups? = nil

    private var text: Binding<String> { Binding(get: { draft[field.id] }, set: { draft[field.id] = $0 }) }
    private var testId: String { "field-\(field.id)" }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            control
            if let hint = field.hint { Text(hint).font(CarbonType.helper).foregroundStyle(MedBrainsTheme.inkSecondary) }
        }
    }

    @ViewBuilder
    private var control: some View {
        switch field.kind {
        case .toggle:
            Toggle(field.label, isOn: Binding(get: { draft.isOn(field.id) }, set: { draft[field.id] = $0 ? "true" : "false" }))
                .font(CarbonType.body).accessibilityIdentifier(testId)
        case .segmented:
            labelled {
                Picker(field.label, selection: text) {
                    ForEach(lists.options(for: field), id: \.value) { Text($0.label).tag($0.value) }
                }
                .pickerStyle(.segmented).accessibilityIdentifier(testId)
            }
        case .select:
            CarbonPicker(field.label, options: lists.options(for: field).map { .init(id: $0.value, label: $0.label) },
                         selection: Binding(get: { draft[field.id].isEmpty ? nil : draft[field.id] }, set: { draft[field.id] = $0 ?? "" }),
                         placeholder: "Choose", error: error)
                .accessibilityIdentifier(testId)
        case .date:
            labelled { DateField(value: text, label: field.label).accessibilityIdentifier(testId) }
        case .search:
            labelled { TerminologyField(field: field, draft: draft, lookups: lookups).accessibilityElement(children: .contain).accessibilityIdentifier(testId) }
        case .tags:
            labelled { TagsField(value: text, label: field.label, lookups: lookups).accessibilityElement(children: .contain).accessibilityIdentifier(testId) }
        case .hidden:
            EmptyView()
        default:
            CarbonField(field.label, error: error, isFocused: false) {
                TextField(field.label, text: text, axis: field.kind == .longText ? .vertical : .horizontal)
                    .lineLimit(field.kind == .longText ? 2...5 : 1...1)
                    .keyboardType(keyboard)
                    .textInputAutocapitalization(field.kind == .email ? .never : .sentences)
                    .accessibilityIdentifier(testId)
            }
        }
    }

    private var keyboard: UIKeyboardType {
        switch field.kind {
        case .phone: .phonePad
        case .email: .emailAddress
        case .digits, .number, .age: .numberPad
        default: .default
        }
    }

    /// A label above a control that has none of its own, and the error below.
    private func labelled(@ViewBuilder _ content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(field.label).font(CarbonType.label).foregroundStyle(MedBrainsTheme.inkSecondary)
            content()
            if let error { Text(error).font(CarbonType.helper).foregroundStyle(MedBrainsTheme.danger) }
        }
    }
}

/// An optional date: nothing until the desk picks one, and it can be cleared
/// (an age is often all a patient knows).
private struct DateField: View {
    @Binding var value: String
    let label: String

    private static let iso: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    var body: some View {
        if let date = Self.iso.date(from: value) {
            HStack {
                DatePicker(label, selection: Binding(get: { date }, set: { value = Self.iso.string(from: $0) }), in: ...Date(), displayedComponents: .date)
                    .labelsHidden()
                Button("Clear") { value = "" }.buttonStyle(.carbonGhost)
            }
        } else {
            Button("Pick a date") { value = Self.iso.string(from: Date()) }.buttonStyle(.carbonTertiary)
        }
    }
}
