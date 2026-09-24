import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// One selected admission becomes the working patient context; nursing
/// tasks branch from here instead of living as unrelated top-level entries.
struct PatientWorkspaceView: View {
    @Environment(AuthStore.self) private var auth
    let admission: AdmissionRow

    private struct Action {
        let id: String
        let label: String
        let detail: String
        let permissions: [String]
        let tone: CarbonTone
        let route: NurseRoute
    }

    private var actions: [Action] {
        [
            Action(id: "mar", label: "MAR", detail: "Administer, hold, or refuse scheduled medication.", permissions: ["ipd.mar.list", "nurse.mar.view"], tone: .highAlert, route: .mar(admission)),
            Action(id: "transfusions", label: "Transfusion", detail: "Hang a unit, chart the fifteen-minute check, close it out.", permissions: ["nurse.transfusion.view"], tone: .danger, route: .transfusions(admission)),
            Action(id: "handover", label: "SBAR handover", detail: "Hand this patient to the next shift, or accept one addressed to you.", permissions: ["nurse.handoff.record"], tone: .warning, route: .handover(admission)),
            Action(id: "vitals", label: "Vitals", detail: "BP, pulse, SpO2, temperature, respiration, weight.", permissions: ["nurse.vitals.record"], tone: .info, route: .bedside(admission, .vitals)),
            Action(id: "io", label: "Intake / output", detail: "Record fluid balance for the current shift.", permissions: ["nurse.intake_output.record"], tone: .success, route: .bedside(admission, .io)),
            Action(id: "pain", label: "Pain score", detail: "Numeric pain score with intervention and recheck notes.", permissions: ["nurse.pain.record"], tone: .warning, route: .bedside(admission, .pain)),
            Action(id: "fall-risk", label: "Fall risk", detail: "Morse-style score with risk level and interventions.", permissions: ["nurse.fall_risk.record"], tone: .info, route: .bedside(admission, .fallRisk)),
        ]
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                CarbonPageHeader(eyebrow: "Bed", title: admission.patientName, subtitle: admission.bedLine) {
                    CarbonTag(admission.status, tone: .success)
                }
                CarbonTile(tone: .info) {
                    Eyebrow("Patient context")
                    Text("Work in one selected admission context. MAR, vitals, I/O and risk screens write against this encounter for auditability.")
                        .font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
                    HStack(spacing: 8) {
                        CarbonTag("encounter \(admission.encounterId.prefix(8))", mono: true)
                        if auth.identity?.can("ipd.admissions.view") ?? false { CarbonTag("IPD visible", tone: .info) }
                    }
                }
                .padding(16)
                ForEach(actions.filter { auth.identity?.canAny($0.permissions) ?? false }, id: \.id) { action in
                    NavigationLink(value: action.route) {
                        CarbonRow(action.label, detail: action.detail) {
                            Rectangle().fill(action.tone.bar).frame(width: 3, height: 24)
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("workspace-\(action.id)")
                }
            }
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle(admission.patientName)
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-patient-workspace")
    }
}
