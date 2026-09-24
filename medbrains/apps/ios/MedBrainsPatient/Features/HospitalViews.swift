import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// Appointments, split into what is still coming and what already happened
/// — two different questions, and the first is the one being asked.
struct AppointmentsView: View {
    @Environment(\.portalApi) private var portal
    @State private var remote = Remote<[PortalAppointment]>()
    private let maxRows = 100
    private let cancelled: Set<String> = ["cancelled", "no_show"]

    var body: some View {
        let rows = Array((remote.value ?? []).prefix(maxRows))
        let today = Date().formatted(.iso8601.year().month().day())
        let upcoming = rows.filter { $0.appointmentDate >= today && !cancelled.contains($0.status) }.sorted { $0.appointmentDate < $1.appointmentDate }
        let upcomingIds = Set(upcoming.map(\.id))
        let past = rows.filter { !upcomingIds.contains($0.id) }
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                CarbonPageHeader(eyebrow: "Visits", title: "Your appointments", subtitle: "Booked visits, newest first.")
                RemoteContentView(id: "appointments", state: remote.state, unavailableTitle: "Couldn't load your appointments", unavailableMessage: "Try again in a moment.", isEmpty: \.isEmpty, emptyTitle: "No appointments", emptyMessage: "You have no booked visits.", retry: { Task { await load() } }) { _ in
                    VStack(alignment: .leading, spacing: 0) {
                        if !upcoming.isEmpty { CarbonSectionTitle("Coming up") }
                        ForEach(upcoming) { a in row(a) }
                        if !past.isEmpty { CarbonSectionTitle("Earlier") }
                        ForEach(past) { a in row(a) }
                    }
                }
            }
        }
        .background(MedBrainsTheme.canvas).navigationTitle("Appointments").navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-appointments")
        .task { await load() }
    }

    private func row(_ a: PortalAppointment) -> some View {
        CarbonRow(ServerTime.parse(a.appointmentDate + "T00:00:00Z").map { $0.formatted(date: .abbreviated, time: .omitted) } ?? a.appointmentDate, detail: a.departmentName ?? "Department to be confirmed") {
            CarbonTag(a.status.replacingOccurrences(of: "_", with: " "), tone: cancelled.contains(a.status) ? .danger : .info)
        }
    }

    private func load() async {
        guard let portal else { return }
        await remote.load { try await portal.appointments() }
    }
}

/// Lab results. Everything here has been verified by the lab and anything
/// carrying an unacknowledged critical alert is withheld by the backend. A
/// flagged value is marked in words as well as colour.
struct ResultsView: View {
    @Environment(\.portalApi) private var portal
    @State private var remote = Remote<[PortalLabReport]>()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                CarbonPageHeader(eyebrow: "Results", title: "Your results", subtitle: "Released by the laboratory.")
                RemoteContentView(id: "lab-reports", state: remote.state, unavailableTitle: "Couldn't load your results", unavailableMessage: "Try again in a moment.", isEmpty: \.isEmpty, emptyTitle: "No results yet", emptyMessage: "Results appear here once the laboratory has checked them. Your doctor will contact you about anything urgent.", retry: { Task { await load() } }) { rows in
                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(Array(rows.prefix(200).enumerated()), id: \.offset) { _, r in
                            let flagged = r.flag != nil && r.flag != "normal"
                            CarbonRow("\(r.parameterName) · \(r.value)\(r.unit.map { " \($0)" } ?? "")", detail: "\(r.testName) · \(ServerTime.short(r.reportedAt))" + (r.normalRange.map { " · usual range \($0)" } ?? "")) {
                                if flagged { CarbonTag(r.flag ?? "check", tone: .warning) }
                            }
                        }
                        Text("Talk to your doctor before acting on anything here.").font(CarbonType.helper).foregroundStyle(MedBrainsTheme.inkSecondary).padding(16)
                    }
                }
            }
        }
        .background(MedBrainsTheme.canvas).navigationTitle("Results").navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-lab-reports")
        .task { await load() }
    }

    private func load() async {
        guard let portal else { return }
        await remote.load { try await portal.labReports() }
    }
}

/// Prescriptions, grouped by prescription rather than listed flat: a flat
/// list of medicines from different visits reads as one regimen.
struct MedicinesView: View {
    @Environment(\.portalApi) private var portal
    @State private var remote = Remote<[PortalPrescriptionItem]>()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                CarbonPageHeader(eyebrow: "Medicines", title: "Your prescriptions", subtitle: "What was prescribed, and how to take it.")
                RemoteContentView(id: "prescriptions", state: remote.state, unavailableTitle: "Couldn't load your prescriptions", unavailableMessage: "Try again in a moment.", isEmpty: \.isEmpty, emptyTitle: "No prescriptions yet", emptyMessage: "Nothing has been prescribed to you.", retry: { Task { await load() } }) { rows in
                    let groups = Dictionary(grouping: rows.prefix(200), by: \.prescriptionId)
                    let ordered = groups.values.sorted { ($0.first?.prescribedAt ?? "") > ($1.first?.prescribedAt ?? "") }
                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(Array(ordered.enumerated()), id: \.offset) { _, items in
                            CarbonSectionTitle("Prescribed \(ServerTime.short(items.first?.prescribedAt))")
                            ForEach(Array(items.enumerated()), id: \.offset) { _, m in
                                CarbonRow(m.drugName, detail: "\(m.dosage) · \(m.frequency) · \(m.duration)")
                            }
                        }
                        Text("Do not start or stop a medicine without asking your doctor.").font(CarbonType.helper).foregroundStyle(MedBrainsTheme.inkSecondary).padding(16)
                    }
                }
            }
        }
        .background(MedBrainsTheme.canvas).navigationTitle("Medicines").navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-prescriptions")
        .task { await load() }
    }

    private func load() async {
        guard let portal else { return }
        await remote.load { try await portal.prescriptions() }
    }
}

/// Bills: one number — what is still owed, summed from balances rather than
/// read off a status — and the invoices as evidence.
struct BillsView: View {
    @Environment(\.portalApi) private var portal
    @State private var remote = Remote<[PortalInvoice]>()

    var body: some View {
        let invoices = Array((remote.value ?? []).prefix(100))
        let outstanding = invoices.reduce(0.0) { $0 + (Double($1.balanceDue) ?? 0) }
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                CarbonPageHeader(eyebrow: "Bills", title: "Your bills", subtitle: "Invoices, payments and receipts.")
                RemoteContentView(id: "bills", state: remote.state, unavailableTitle: "Couldn't load your bills", unavailableMessage: "Try again in a moment.", isEmpty: \.isEmpty, emptyTitle: "No bills yet", emptyMessage: "Nothing has been billed to you.", retry: { Task { await load() } }) { _ in
                    VStack(alignment: .leading, spacing: 0) {
                        VStack(alignment: .leading, spacing: 4) {
                            Eyebrow(outstanding > 0 ? "Still to pay" : "Nothing outstanding")
                            Text(String(format: "₹%.2f", outstanding)).font(CarbonType.display).foregroundStyle(MedBrainsTheme.ink)
                        }
                        .padding(16)
                        ForEach(invoices) { InvoiceRow(invoice: $0) }
                    }
                }
            }
        }
        .background(MedBrainsTheme.canvas).navigationTitle("Bills").navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-bills")
        .task { await load() }
    }

    private func load() async {
        guard let portal else { return }
        await remote.load { try await portal.bills() }
    }
}

private struct InvoiceRow: View {
    let invoice: PortalInvoice
    var body: some View {
        let due = Double(invoice.balanceDue) ?? 0
        let total = Double(invoice.totalAmount) ?? 0
        CarbonRow(String(format: "₹%.2f", total), detail: "\(invoice.invoiceNumber) · \(ServerTime.short(invoice.createdAt))") {
            if due > 0 { CarbonTag(String(format: "₹%.2f due", due), tone: .warning) } else { CarbonTag("paid", tone: .success) }
        }
    }
}
