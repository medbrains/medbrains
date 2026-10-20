import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// Ask, through ABDM, for the patient's records held by other hospitals:
/// purpose, record types, the date range and how long the copies may be
/// kept. The patient approves it in their ABHA app; the request names the doctor.
struct ConsentRequestForm: View {
    @Environment(\.apiClient) private var client
    @Environment(\.dismiss) private var dismiss
    let patientId: String
    let sent: @MainActor () async -> Void

    @State private var purpose: String? = AbdmRecords.defaultPurpose
    @State private var hiTypes = AbdmRecords.defaultHiTypes
    @State private var from = Calendar.current.date(byAdding: .year, value: -AbdmRecords.defaultYearsBack, to: Date()) ?? Date()
    @State private var to = Date()
    @State private var keepDays: Int? = AbdmRecords.defaultKeepDays
    @State private var problem: String?
    @State private var busy = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("ABDM asks the patient to approve this in their ABHA app, in your name and HPR ID.")
                        .font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
                    CarbonPicker("Purpose", options: AbdmRecords.purposes.map { .init(id: $0.code, label: $0.label) }, selection: $purpose)
                        .accessibilityIdentifier("abdm-purpose")
                    VStack(alignment: .leading, spacing: 0) {
                        Text("Record types").font(CarbonType.label).foregroundStyle(MedBrainsTheme.inkSecondary)
                        ForEach(AbdmRecords.hiTypes, id: \.code) { type in
                            Toggle(type.label, isOn: binding(type.code))
                                .font(CarbonType.body)
                                .frame(minHeight: 44)
                                .accessibilityIdentifier("abdm-type-\(type.code)")
                        }
                    }
                    DatePicker("Records from", selection: $from, in: ...Date(), displayedComponents: .date)
                        .font(CarbonType.body).accessibilityIdentifier("abdm-from")
                    DatePicker("Records to", selection: $to, in: ...Date(), displayedComponents: .date)
                        .font(CarbonType.body).accessibilityIdentifier("abdm-to")
                    CarbonPicker("Keep the copies for", options: AbdmRecords.keepOptions.map { .init(id: $0.days, label: $0.label) }, selection: $keepDays)
                        .accessibilityIdentifier("abdm-keep")
                    Text("They are erased then, or as soon as the patient withdraws consent.")
                        .font(CarbonType.helper).foregroundStyle(MedBrainsTheme.inkSecondary)
                    if let problem {
                        CarbonNotification(kind: .error, title: "Could not request records", message: problem).accessibilityIdentifier("abdm-request-problem")
                    }
                    Button("Send request") { Task { await send() } }
                        .buttonStyle(.carbonPrimary)
                        .disabled(busy)
                        .accessibilityIdentifier("abdm-send-request")
                }
                .padding(16)
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("Request records")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }
    }

    private func binding(_ code: String) -> Binding<Bool> {
        Binding(get: { hiTypes.contains(code) }, set: { on in
            if on { hiTypes.insert(code) } else { hiTypes.remove(code) }
        })
    }

    private func send() async {
        guard let client else { return }
        if let p = AbdmRecords.problem(hiTypes: hiTypes, from: from, to: to) { problem = p; return }
        guard let purpose, let keepDays else { problem = "Choose a purpose and how long to keep the copies"; return }
        busy = true
        defer { busy = false }
        do {
            let row = try await AbdmRecordsApi(client: client).raise(patientId, AbdmRecords.newRequest(purpose: purpose, hiTypes: hiTypes, from: from, to: to, keepDays: keepDays))
            await sent()
            // ABDM can refuse it outright; that is said here, not in a toast that vanishes.
            if row.status == AbdmRecords.failed {
                problem = row.error ?? AbdmRecords.status(row.status).hint
                return
            }
            UIAccessibility.post(notification: .announcement, argument: "Request sent. The patient approves it in their ABHA app.")
            dismiss()
        } catch {
            problem = (error as? ApiError)?.message ?? "Could not reach the hospital server."
        }
    }
}
