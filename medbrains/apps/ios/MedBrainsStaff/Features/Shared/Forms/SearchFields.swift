import MedBrainsUI
import SwiftUI

/// A code chosen from ICD-11 as the desk types. Choosing one writes the code,
/// its display, source and version into the draft — the catalogue's hidden
/// companions of the field — and the display into the provisional diagnosis,
/// as the web's picker does. A lookup that fails is said, never an empty list.
struct TerminologyField: View {
    let field: CatalogueField
    let draft: RegistrationDraftValues
    let lookups: CatalogueLookups?

    @State private var query = ""
    @State private var hits: [TerminologyHit] = []
    @State private var failed = false

    /// `icd11_code` → `icd11_`: the companions share the field's prefix.
    private var prefix: String { field.id.replacingOccurrences(of: "code", with: "") }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if !draft[field.id].isEmpty {
                HStack {
                    CarbonTag("\(draft[field.id]) · \(draft["\(prefix)display"])", tone: .info)
                    Spacer()
                    Button("Clear") { choose(nil) }.buttonStyle(.carbonGhost)
                }
            } else if lookups == nil {
                Text("Search is not available for your role; write the diagnosis above.").font(CarbonType.helper).foregroundStyle(MedBrainsTheme.inkSecondary)
            } else {
                TextField("Search ICD-11", text: $query).textInputAutocapitalization(.never).carbonFieldSurface()
                    .accessibilityIdentifier("\(field.id)-search")
                if failed { Text("Could not search just now; try again or write the diagnosis above.").font(CarbonType.helper).foregroundStyle(MedBrainsTheme.danger) }
                ForEach(hits) { hit in
                    Button { choose(hit) } label: { CarbonRow(hit.display, detail: hit.code) {} }
                        .buttonStyle(.plain).accessibilityIdentifier("\(field.id)-hit-\(hit.code)")
                }
            }
        }
        .task(id: query) { await search() }
    }

    private func search() async {
        let q = query.trimmingCharacters(in: .whitespaces)
        guard let lookups, q.count >= CatalogueLookups.minimumQuery else { hits = []; return }
        try? await Task.sleep(for: CatalogueLookups.debounce)
        guard !Task.isCancelled else { return }
        do {
            hits = try await lookups.icd11(q)
            failed = false
        } catch {
            if !Task.isCancelled { failed = true }
        }
    }

    private func choose(_ hit: TerminologyHit?) {
        draft[field.id] = hit?.code ?? ""
        draft["\(prefix)display"] = hit?.display ?? ""
        draft["\(prefix)source_url"] = hit?.sourceUrl ?? ""
        draft["\(prefix)source_version"] = hit?.sourceVersion ?? ""
        draft["\(prefix)provider_mode"] = hit?.providerMode ?? ""
        if let hit { draft["initial_diagnosis_text"] = hit.display }
        query = ""
        hits = []
    }
}

/// Several entries kept as one comma-separated value, as the web sends them.
/// Typed entries always work; the formulary suggests names when it answers.
struct TagsField: View {
    @Binding var value: String
    let label: String
    let lookups: CatalogueLookups?

    @State private var entry = ""
    @State private var suggestions: [String] = []

    private static let separator = ", "
    private var tags: [String] { value.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty } }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(tags, id: \.self) { tag in
                HStack {
                    Text(tag).font(CarbonType.body)
                    Spacer()
                    Button { set(tags.filter { $0 != tag }) } label: { Image(systemName: "xmark") }
                        .buttonStyle(.carbonGhost).accessibilityLabel("Remove \(tag)")
                }
            }
            HStack {
                TextField("Add \(label.lowercased())", text: $entry).onSubmit(add).carbonFieldSurface().accessibilityIdentifier("tags-entry")
                Button("Add", action: add).buttonStyle(.carbonTertiary).disabled(entry.trimmingCharacters(in: .whitespaces).isEmpty).accessibilityIdentifier("tags-add")
            }
            ForEach(suggestions, id: \.self) { name in
                Button { entry = name; add() } label: { CarbonRow(name) {} }.buttonStyle(.plain)
            }
        }
        .task(id: entry) { await suggest() }
    }

    private func add() {
        let new = entry.trimmingCharacters(in: .whitespaces)
        guard !new.isEmpty, !tags.contains(new) else { return }
        set(tags + [new])
        entry = ""
        suggestions = []
    }

    private func set(_ list: [String]) { value = list.joined(separator: Self.separator) }

    private func suggest() async {
        let q = entry.trimmingCharacters(in: .whitespaces)
        guard let lookups, q.count >= CatalogueLookups.minimumQuery else { suggestions = []; return }
        try? await Task.sleep(for: CatalogueLookups.debounce)
        guard !Task.isCancelled else { return }
        // Suggestions are a convenience: without them the typed name still counts.
        suggestions = (try? await lookups.drugs(q)) ?? []
    }
}
