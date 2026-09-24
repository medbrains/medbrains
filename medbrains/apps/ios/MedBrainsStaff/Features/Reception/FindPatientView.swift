import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// UHID, name or phone; the rows carry the identifiers the desk reads back
/// and the flags it must not miss. An outage is named — an empty list would
/// read as "not registered".
struct FindPatientView: View {
    @Environment(\.apiClient) private var client
    @State private var query = ""
    @State private var results = Remote<[PatientSummary]>()
    @State private var searched = false
    @FocusState private var focused: Bool

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                CarbonPageHeader(eyebrow: "Reception", title: "Find a patient", subtitle: "UHID, name or phone.")
                CarbonField("Search", isFocused: focused) {
                    TextField("UHID, name or phone", text: $query).focused($focused).submitLabel(.search).onSubmit { Task { await search() } }
                        .accessibilityIdentifier("find-search")
                }
                .padding(.horizontal, 16)
                Button { Task { await search() } } label: { HStack { Text("Search"); Spacer(); Image(systemName: "magnifyingglass") } }
                    .buttonStyle(.carbonPrimary).padding(16).disabled(query.trimmingCharacters(in: .whitespaces).isEmpty)
                    .accessibilityIdentifier("find-submit")
                if searched {
                    RemoteContentView(id: "find", state: results.state, unavailableTitle: "Couldn't search", unavailableMessage: "The hospital server did not answer. Do not read this as \"not registered\".", isEmpty: \.isEmpty, emptyTitle: "No patient by that UHID, name or phone", emptyMessage: "This searches the whole hospital, not only your own desk, so nothing here matches. Check the number, or register them.", retry: { Task { await search() } }) { rows in
                        LazyVStack(spacing: 1) {
                            ForEach(rows) { p in
                                NavigationLink(value: ReceptionRoute.patient(p)) {
                                    CarbonRow(p.fullName, detail: p.identifiers) {
                                        HStack(spacing: 4) {
                                            if p.isMedicoLegal == true { CarbonTag("MLC", tone: .danger) }
                                            if p.isVip == true { CarbonTag("VIP", tone: .info) }
                                        }
                                    }
                                }
                                .buttonStyle(.plain)
                                .accessibilityIdentifier("find-row-\(p.id)")
                            }
                        }
                        .padding(.horizontal, 16)
                    }
                }
            }
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Find").navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-find-patient")
        .onAppear { focused = true }
    }

    private func search() async {
        guard let client else { return }
        searched = true
        await results.load { try await ReceptionApi(client: client).searchPatients(query.trimmingCharacters(in: .whitespaces)) }
    }
}

/// The record as the desk needs it: the two identifiers, the flags, what is
/// owed — and the one thing to do with it here.
struct ReceptionPatientView: View {
    @Environment(AuthStore.self) private var auth
    let patient: PatientSummary

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                CarbonPageHeader(eyebrow: "Patient", title: patient.fullName, subtitle: patient.identifiers)
                CarbonTile {
                    Eyebrow("Identity")
                    CarbonRow("UHID", detail: patient.uhid, mono: true)
                    CarbonRow("Date of birth", detail: (patient.dateOfBirth ?? "Unknown") + (patient.isDobEstimated == true ? " (estimated)" : ""))
                    CarbonRow("Phone", detail: patient.phone, mono: true)
                    CarbonRow("Gender", detail: patient.gender.capitalized)
                }
                HStack(spacing: 8) {
                    if patient.isMedicoLegal == true { CarbonTag("MLC \(patient.mlcNumber ?? "")", tone: .danger) }
                    if patient.isVip == true { CarbonTag("VIP", tone: .info) }
                    if let owed = patient.outstandingBalance, (Double(owed) ?? 0) > 0 { CarbonTag("₹\(owed) due", tone: .warning) }
                }
                if let last = patient.lastVisitDate { CarbonRow("Last visit", detail: last) }
                if auth.identity?.can("opd.visit.create") ?? false {
                    NavigationLink(value: ReceptionRoute.startVisit(patient)) {
                        HStack { Text("Start OPD visit"); Spacer(); Image(systemName: "arrow.right") }
                    }
                    .buttonStyle(.carbonPrimary).accessibilityIdentifier("patient-start-visit")
                }
                if auth.identity?.can("opd.appointment.create") ?? false {
                    NavigationLink(value: ReceptionRoute.book(patient)) {
                        HStack { Text("Book appointment"); Spacer(); Image(systemName: "calendar.badge.plus") }
                    }
                    .buttonStyle(.carbonTertiary).accessibilityIdentifier("patient-book")
                }
            }
            .padding(16)
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle(patient.uhid).navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-reception-patient")
    }
}
