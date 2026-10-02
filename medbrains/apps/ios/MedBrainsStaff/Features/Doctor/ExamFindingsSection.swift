import MedBrainsUI
import SwiftUI

/// Findings at a place on the body — "Left knee: effusion" — picked on the
/// body map, then described. They save with the consultation.
struct ExamFindingsSection: View {
    @Binding var findings: [ExamFinding]
    let canRecord: Bool
    @State private var picking = false
    @State private var site: PickedSite?
    @State private var finding = ""
    @FocusState private var describing: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            CarbonSectionTitle("Findings at a site").padding(.horizontal, -16)
            if findings.isEmpty {
                Text("No site findings recorded.").font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
            }
            ForEach(findings, id: \.self) { f in
                CarbonRow(f.line) {
                    if canRecord {
                        Button("Remove") { findings.removeAll { $0 == f } }
                            .buttonStyle(.carbonGhost).accessibilityLabel("Remove \(f.line)")
                    }
                }
                .accessibilityIdentifier("exam-finding-row")
            }
            if canRecord { adder }
        }
        .sheet(isPresented: $picking) {
            BodyMapPicker(title: "Finding site") { picked in
                site = picked
                describing = true
            }
        }
    }

    @ViewBuilder private var adder: some View {
        if let site {
            CarbonField("Finding at \(site.label.lowercased())", isFocused: describing) {
                TextField("e.g. tender, swelling", text: $finding, axis: .vertical)
                    .focused($describing).accessibilityIdentifier("field-exam-finding")
            }
            HStack {
                Button("Add finding") { add(at: site) }
                    .buttonStyle(.carbonTertiary).disabled(finding.trimmingCharacters(in: .whitespaces).isEmpty)
                    .accessibilityIdentifier("exam-finding-add")
                Button("Cancel") { self.site = nil; finding = "" }.buttonStyle(.carbonGhost)
            }
        } else {
            Button("Pick a site on the body") { picking = true }
                .buttonStyle(.carbonTertiary).accessibilityIdentifier("exam-finding-pick")
        }
    }

    private func add(at site: PickedSite) {
        let entry = ExamFinding(site: site.label, siteCode: nil, laterality: site.laterality,
                                finding: finding.trimmingCharacters(in: .whitespacesAndNewlines))
        if !findings.contains(entry) { findings.append(entry) }
        self.site = nil
        finding = ""
    }
}
