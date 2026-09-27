import SwiftUI

/// One choice from a list — a department, a consultant — as a Carbon field:
/// label above, the current choice on the Gray-10 ground, a chevron. A short
/// list is a system `Picker` in menu style, so VoiceOver and the keyboard get
/// the platform's own control; a long one opens a searchable list, because a
/// hospital's eighty departments or two hundred doctors cannot be scrolled
/// through in a menu.
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

    /// Past this many choices a menu stops being readable.
    private static var searchableAbove: Int { 12 }
    @State private var searching = false

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label).font(CarbonType.label).foregroundStyle(MedBrainsTheme.inkSecondary)
            field
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

    @ViewBuilder
    private var field: some View {
        if options.count > Self.searchableAbove {
            Button { searching = true } label: {
                HStack {
                    Text(options.first { $0.id == selection }?.label ?? placeholder).foregroundStyle(MedBrainsTheme.ink)
                    Spacer()
                    Image(systemName: "chevron.up.chevron.down").accessibilityHidden(true)
                }
            }
            .accessibilityValue(options.first { $0.id == selection }?.label ?? placeholder)
            .sheet(isPresented: $searching) {
                SearchablePickerList(label: label, options: options, selection: $selection, isPresented: $searching)
            }
        } else {
            Picker(label, selection: $selection) {
                Text(placeholder).tag(ID?.none)
                ForEach(options) { option in
                    Text(option.label).tag(ID?.some(option.id))
                }
            }
            .pickerStyle(.menu)
        }
    }
}

/// The long list behind a `CarbonPicker`: type to narrow, tap to choose.
private struct SearchablePickerList<ID: Hashable>: View {
    let label: String
    let options: [CarbonPicker<ID>.Option]
    @Binding var selection: ID?
    @Binding var isPresented: Bool
    @State private var query = ""

    private var matches: [CarbonPicker<ID>.Option] {
        query.isEmpty ? options : options.filter { $0.label.localizedCaseInsensitiveContains(query) }
    }

    var body: some View {
        NavigationStack {
            List(matches) { option in
                Button(option.label) {
                    selection = option.id
                    isPresented = false
                }
                .foregroundStyle(MedBrainsTheme.ink)
            }
            .listStyle(.plain)
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search")
            .navigationTitle(label)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { isPresented = false } } }
        }
    }
}
