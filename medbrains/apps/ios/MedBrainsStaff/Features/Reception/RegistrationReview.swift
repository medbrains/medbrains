import MedBrainsUI
import SwiftUI

/// The answers read back before registering, step by step — the words the
/// desk chose (option labels, "Yes"), never record ids. Safety flags first.
struct RegistrationReview: View {
    let draft: RegistrationDraftValues
    let lists: OptionLists
    let visible: Set<String>
    let onEdit: (Int) -> Void

    private let catalogue = RegistrationCatalogue.shared

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 8) {
                if draft.isOn("is_unknown_patient") { CarbonTag("Unknown patient", tone: .warning) }
                if draft.isOn("is_medico_legal") { CarbonTag("MLC \(draft["mlc_number"])", tone: .danger) }
                if draft.isOn("is_vip") { CarbonTag("VIP", tone: .info) }
            }
            ForEach(Array(catalogue.steps.enumerated()), id: \.offset) { index, step in
                let rows = answered(in: step.step)
                if !rows.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            CarbonSectionTitle(step.title)
                            Spacer()
                            Button("Change") { onEdit(index) }.buttonStyle(.carbonGhost)
                                .accessibilityIdentifier("review-edit-\(step.step)")
                        }
                        ForEach(rows, id: \.label) { row in CarbonRow(row.label, detail: row.value) }
                    }
                }
            }
        }
        .accessibilityIdentifier("registration-review")
    }

    private func answered(in step: String) -> [(label: String, value: String)] {
        catalogue.fields(in: step).compactMap { field in
            guard visible.contains(field.id) else { return nil }
            let raw = draft[field.id]
            if field.kind == .toggle { return draft.isOn(field.id) ? (field.label, "Yes") : nil }
            guard !raw.isEmpty else { return nil }
            let label = lists.options(for: field).first { $0.value == raw }?.label ?? raw
            return (field.label, label)
        }
    }
}
