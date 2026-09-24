import MedBrainsCore
import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// Two tabs, because the app answers two different questions. **Hospital**
/// is the record a clinician wrote. **Health** is what the person does day
/// to day, and it exists only when the hospital licensed the companion —
/// hidden by default, including while the entitlement loads, so it cannot
/// flash into view for a tenant that never bought it. A locked tab is an
/// advert; an absent tab is navigation.
struct PatientHomeView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.portalApi) private var portal
    @State private var companionVia: String?

    var body: some View {
        TabView {
            NavigationStack { HospitalTabView() }
                .tabItem { Label("Hospital", systemImage: "cross.case") }
            if companionVia != nil {
                NavigationStack { HealthTabView() }
                    .tabItem { Label("Health", systemImage: "heart") }
            }
        }
        .accessibilityIdentifier("patient-home")
        .task {
            guard let portal else { return }
            // A rejected request leaves the door unknown, which keeps it shut.
            let licensed = try? await portal.entitlements().companion
            companionVia = companionAccess(licensedByHospital: licensed, bandPaired: nil, purchased: nil)
        }
    }
}

enum HospitalRoute: Hashable { case appointments, results, medicines, bills, consent, familyShare }

/// The hospital's record of the patient, one row per module in the order the
/// React Native registry kept.
struct HospitalTabView: View {
    @Environment(AuthStore.self) private var auth

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                VStack(alignment: .leading, spacing: 4) {
                    Eyebrow("Your record")
                    Text("What your hospital has recorded about you.").font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
                }
                .padding(.horizontal, 16).padding(.bottom, 16)
                row("appointments", "Appointments", "Booked visits, newest first.", "calendar", .appointments)
                row("lab-reports", "Results", "Released by the laboratory.", "testtube.2", .results)
                row("prescriptions", "Medicines", "What was prescribed, and how to take it.", "pills", .medicines)
                row("bills", "Bills", "Invoices, payments and receipts.", "indianrupeesign.circle", .bills)
                row("consent", "Consent", "View, grant, or revoke consent for your records.", "checkmark.shield", .consent)
                row("family-share", "Family share", "Link family, share specific records, set expiry.", "person.2", .familyShare)
            }
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Hospital")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button("Sign out", role: .destructive) { Task { await auth.signOut() } }
                } label: { Label("Account", systemImage: "person.crop.circle") }
            }
        }
        .navigationDestination(for: HospitalRoute.self) { route in
            switch route {
            case .appointments: AppointmentsView()
            case .results: ResultsView()
            case .medicines: MedicinesView()
            case .bills: BillsView()
            case .consent: TilesView(id: "consent", eyebrow: "Consent", title: "Consent", subtitle: "View, grant, or revoke consent for any of your records.", tiles: [
                ("Active consents", "What you've granted, to whom, for how long."), ("Revoke a consent", "Stop a previously granted access."),
                ("Access audit", "Who saw what, when."), ("Export my data", "DPDP right to portability."), ("Delete my account", "DPDP right to erasure (with safety holds).")])
            case .familyShare: TilesView(id: "family-share", eyebrow: "Family", title: "Family share", subtitle: "Link family, share specific records, set expiry.", tiles: [
                ("Link a family member", "Parent, spouse, child or caregiver."), ("Share a record", "Choose what they can see, and until when."), ("Manage sharing", "Stop or extend a share.")])
            }
        }
        .accessibilityIdentifier("tab-hospital")
    }

    private func row(_ id: String, _ label: String, _ detail: String, _ symbol: String, _ route: HospitalRoute) -> some View {
        NavigationLink(value: route) {
            CarbonRow(label, detail: detail) { Image(systemName: symbol).foregroundStyle(MedBrainsTheme.interactive) }
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("module-\(id)")
    }
}

/// A module the React Native app carried as tiles without a backend yet
/// (consent, family share). Same tiles here; the wiring lands with the
/// portal endpoints, and the ledger says so.
struct TilesView: View {
    let id: String
    let eyebrow: String
    let title: String
    let subtitle: String
    let tiles: [(String, String)]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                CarbonPageHeader(eyebrow: eyebrow, title: title, subtitle: subtitle)
                ForEach(tiles, id: \.0) { tile in
                    CarbonTile(tone: .info) {
                        Text(tile.0).font(CarbonType.heading02).foregroundStyle(MedBrainsTheme.ink)
                        Text(tile.1).font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
                    }
                    .padding(.horizontal, 16)
                }
            }
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-\(id)")
    }
}
