import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// Where the nurse module's screens are, as values the stack can push.
/// Mirrors apps/mobile-staff/src/modules/nurse.tsx's router keys.
enum NurseRoute: Hashable {
    case admissions
    case calls
    case codeBlue
    case workspace(AdmissionRow)
    case mar(AdmissionRow)
    case administer(AdmissionRow, MarRow)
    case handover(AdmissionRow)
    case transfusions(AdmissionRow)
    case bedside(AdmissionRow, BedsideMode)
}

enum BedsideMode: String, Hashable { case vitals, io, pain, fallRisk }

/// The nurse's front door: two numbers that are the reason to open the
/// module, then the actions the role holds. A tile shows an em dash where a
/// number belongs when the count could not be fetched — "0 beds waiting"
/// because the network dropped reads as a quiet ward.
struct NurseHomeView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.apiClient) private var client
    @State private var admissions = Remote<[AdmissionRow]>()
    @State private var calls = Remote<NurseCallBoard>()

    private var api: NurseApi? { client.map(NurseApi.init) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // The stack's large title is the heading; only the eyebrow and the line under it live here.
                VStack(alignment: .leading, spacing: 4) {
                    Eyebrow("Module")
                    Text("MAR, vitals, handoff, intake/output.").font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 16)
                HStack(spacing: 1) {
                    StatTile(eyebrow: "Due", count: admissions.value?.count, title: "Active admissions")
                    StatTile(eyebrow: "Calls", count: calls.value?.calls.count, title: "Beds waiting on a call")
                }
                .padding(.horizontal, 16)
                CarbonSectionTitle("Actions")
                let who = auth.identity
                action("mar", "My shift", "Assigned beds with bedside MAR, vitals, I/O and risk actions.", "bed.double", .admissions, allowed: who?.can("nurse.dashboard.view") ?? false)
                action("vitals", "Record vitals", "Select a patient, then capture BP, HR, SpO2 and temperature.", "waveform.path.ecg", .admissions, allowed: who?.can("nurse.vitals.record") ?? false)
                action("code-blue", "Code blue", "Arrests in progress. Answer the page here.", "bolt.heart", .codeBlue, allowed: who?.can("nurse.code_blue.view") ?? false)
                action("calls", "Open calls", "Every bed still waiting on a call, oldest first.", "bell.badge", .calls, allowed: who?.can("bedside.calls.board") ?? false)
                action("handoff", "SBAR handoff", "Structured handoff for shift change.", "arrow.left.arrow.right", .admissions, allowed: who?.can("nurse.handoff.record") ?? false)
                action("io", "Intake / output", "Fluid balance and drain output capture.", "drop", .admissions, allowed: who?.can("nurse.intake_output.record") ?? false)
                action("fall-risk", "Fall risk assessment", "Morse scale + interventions.", "figure.fall", .admissions, allowed: who?.can("nurse.fall_risk.record") ?? false)
            }
        }
        .background(MedBrainsTheme.canvas)
        .accessibilityIdentifier("module-home-nurse")
        .navigationDestination(for: NurseRoute.self) { route in
            switch route {
            case .admissions: AdmissionsListView()
            case .calls: NurseCallBoardView()
            case .codeBlue: CodeBlueView()
            case .workspace(let a): PatientWorkspaceView(admission: a)
            case .mar(let a): MarScheduleView(admission: a)
            case .administer(let a, let d): AdministerDoseView(admission: a, dose: d)
            case .handover(let a): ShiftHandoverView(admission: a)
            case .transfusions(let a): TransfusionMonitorView(admission: a)
            case .bedside(let a, let m): BedsideActionView(admission: a, mode: m)
            }
        }
        .task {
            guard let api else { return }
            async let a: () = admissions.load { try await api.listActiveAdmissions() }
            async let c: () = calls.load { try await api.listNurseCalls() }
            _ = await (a, c)
        }
    }

    @ViewBuilder
    private func action(_ id: String, _ label: String, _ detail: String, _ symbol: String, _ route: NurseRoute, allowed: Bool) -> some View {
        if allowed {
            NavigationLink(value: route) {
                CarbonRow(label, detail: detail) {
                    Image(systemName: symbol).foregroundStyle(MedBrainsTheme.interactive)
                }
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("module-action-\(id)")
        }
    }
}

/// A Carbon stat tile: eyebrow, a large number (or an em dash), a caption.
struct StatTile: View {
    let eyebrow: String
    let count: Int?
    let title: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Eyebrow(eyebrow)
            Text(count.map(String.init) ?? "—")
                .font(CarbonType.display)
                .foregroundStyle(MedBrainsTheme.ink)
                .accessibilityLabel(count.map { "\($0)" } ?? "not available")
            Text(title).font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(MedBrainsTheme.surface)
    }
}
