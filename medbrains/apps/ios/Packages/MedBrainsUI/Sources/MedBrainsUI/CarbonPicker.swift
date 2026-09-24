import SwiftUI

/// One choice from a short list — a department, a consultant — as a Carbon
/// field: label above, the current choice on the Gray-10 ground, a chevron.
/// A system `Picker` in menu style underneath, so VoiceOver and the keyboard
/// get the platform's own control.
public struct CarbonPicker<ID: Hashable>: View {
    public struct Option: Identifiable {
        public let id: ID
        public let label: String
        public init(id: ID, label: String) {
            self.id = id
            self.label = label
        }
    }

    private let label: String
    private let options: [Option]
    private let placeholder: String
    private let error: String?
    @Binding private var selection: ID?

    public init(_ label: String, options: [Option], selection: Binding<ID?>, placeholder: String = "Choose", error: String? = nil) {
        self.label = label
        self.options = options
        self.placeholder = placeholder
        self.error = error
        _selection = selection
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label).font(CarbonType.label).foregroundStyle(MedBrainsTheme.inkSecondary)
            Picker(label, selection: $selection) {
                Text(placeholder).tag(ID?.none)
                ForEach(options) { option in
                    Text(option.label).tag(ID?.some(option.id))
                }
            }
            .pickerStyle(.menu)
            .tint(MedBrainsTheme.ink)
            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
            .padding(.horizontal, 16)
            .background(MedBrainsTheme.field)
            .overlay(alignment: .bottom) {
                Rectangle().fill(error == nil ? MedBrainsTheme.borderStrong : MedBrainsTheme.danger).frame(height: error == nil ? 1 : 2)
            }
            if let error {
                Text(error).font(CarbonType.helper).foregroundStyle(MedBrainsTheme.danger)
            }
        }
    }
}
