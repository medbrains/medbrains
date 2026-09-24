import MedBrainsCore
import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// Give one dose at the bedside, with the 5 rights actually checked.
/// Two scans, in this order: the wristband on the arm, then the drug in the
/// hand. Nothing the camera reads is trusted — both strings go to the
/// server, which compares them against the admission's UHID and the ordered
/// catalogue item and answers. A client that could stamp `barcode_verified`
/// itself would be a client that could skip the check. A refusal is a full
/// stop: there is deliberately no "give anyway".
struct AdministerDoseView: View {
    @Environment(\.apiClient) private var client
    @Environment(\.dismiss) private var dismiss
    let admission: AdmissionRow
    let dose: MarRow

    private enum Step { case wristband, drug(String), verified, refused(BarcodeVerifyResult) }
    @State private var step: Step = .wristband
    @State private var scanRound = 0
    @State private var busy = false
    @State private var failure: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                CarbonPageHeader(eyebrow: "Administer", title: dose.drugName, subtitle: "\(dose.dose) · \(dose.route) · \(admission.patientName) · UHID \(admission.uhid)") {
                    if dose.isHighAlert { CarbonTag("high alert", tone: .highAlert) }
                }
                if let failure {
                    CarbonNotification(kind: .error, title: "The check could not be completed", message: failure).padding(.horizontal, 16)
                }
                switch step {
                case .wristband:
                    BarcodeScannerView(title: "Scan the wristband", hint: "The band on the patient's arm, not the chart or the bed label.", resumeKey: scanRound, onScan: handleScan)
                case .drug:
                    BarcodeScannerView(title: "Scan the drug", hint: "The barcode on the pack you are about to give.", resumeKey: scanRound, onScan: handleScan)
                case .refused(let result):
                    ScanRefused(result: result, onRescan: rescan)
                case .verified:
                    RecordAdministration(admission: admission, dose: dose, onDone: { dismiss() })
                }
                if busy { ProgressView().frame(maxWidth: .infinity).padding() }
                RecordNotGiven(admission: admission, dose: dose, onDone: { dismiss() }).padding(16)
            }
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Administer")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-administer-dose")
    }

    private func handleScan(_ value: String) {
        let scanned = value.trimmingCharacters(in: .whitespaces)
        failure = nil
        switch step {
        case .wristband:
            step = .drug(scanned)
            scanRound += 1
        case .drug(let patientBarcode):
            Task { await verify(patient: patientBarcode, drug: scanned) }
        default:
            break
        }
    }

    private func verify(patient: String, drug: String) async {
        guard let client else { return }
        busy = true
        defer { busy = false; scanRound += 1 }
        do {
            let result = try await NurseApi(client: client).verifyMarBarcode(dose.id, patient: patient, drug: drug)
            step = result.verified ? .verified : .refused(result)
        } catch {
            // A failed check and a failed request are not the same event.
            // Falling back to "not verified" would tell a nurse the wristband
            // is wrong when the truth is that nobody asked.
            failure = (error as? ApiError)?.message ?? "Could not reach the hospital server."
            step = .wristband
        }
    }

    private func rescan() {
        failure = nil
        step = .wristband
        scanRound += 1
    }
}

private struct ScanRefused: View {
    let result: BarcodeVerifyResult
    let onRescan: () -> Void

    var body: some View {
        CarbonTile(tone: .danger) {
            Text("Do not give this dose").font(CarbonType.heading02).foregroundStyle(MedBrainsTheme.danger)
                .accessibilityIdentifier("bcma-refused")
            Text(result.reason ?? "The scan did not match this order.").font(CarbonType.body).foregroundStyle(MedBrainsTheme.ink)
            Text(bcmaScanRightsSummary(rightPatient: result.rightPatient, rightDrug: result.rightDrug)).font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
            Button("Scan again", action: onRescan).buttonStyle(.carbonTertiary).accessibilityLabel("Scan the wristband and drug again")
        }
        .padding(16)
    }
}

/// The give step, reachable only once the server has stamped the verification.
private struct RecordAdministration: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.apiClient) private var client
    let admission: AdmissionRow
    let dose: MarRow
    let onDone: () -> Void
    @State private var onDuty = Remote<[WardOnDutyRow]>()
    @State private var witnessId: String?
    @State private var busy = false
    @State private var failure: String?

    var body: some View {
        let me = auth.identity?.userId ?? ""
        let candidates = (onDuty.value ?? []).map { WitnessCandidate(nurseUserId: $0.nurseUserId, nurseName: $0.nurseName, isCharge: $0.isCharge) }
        let witnesses = bcmaEligibleWitnesses(onDuty: candidates, actorId: me)
        VStack(alignment: .leading, spacing: 12) {
            Text("Right patient, right drug").font(CarbonType.heading02).foregroundStyle(MedBrainsTheme.success)
            if dose.isHighAlert {
                Text("A high-alert drug takes a second nurse. Pick who checked it with you.").font(CarbonType.body).foregroundStyle(MedBrainsTheme.ink)
                // Unknown must not look like "nobody is on duty": one leaves
                // the nurse waiting for a name, the other sends them to the station.
                if case .failed = onDuty.state {
                    CarbonNotification(kind: .error, title: "On-duty list unavailable", message: "A witness cannot be picked here. Record this dose at the station.")
                } else if witnesses.isEmpty, onDuty.value != nil {
                    Text("No other nurse is recorded on duty for this ward today.").font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
                } else {
                    Picker("Witness", selection: $witnessId) {
                        Text("Choose a nurse").tag(String?.none)
                        ForEach(witnesses, id: \.nurseUserId) { n in
                            Text(n.isCharge ? "\(n.nurseName) (charge)" : n.nurseName).tag(String?.some(n.nurseUserId))
                        }
                    }
                    .pickerStyle(.inline)
                    .labelsHidden()
                }
            }
            if let failure { CarbonNotification(kind: .error, title: "The dose could not be recorded", message: failure) }
            Button("Give now") { Task { await give() } }
                .buttonStyle(.carbonPrimary)
                .disabled(busy || !bcmaCanRecordGiven(isHighAlert: dose.isHighAlert, witnessId: witnessId))
                .accessibilityLabel("Record \(dose.drugName) as given")
                .accessibilityIdentifier("bcma-give-now")
        }
        .padding(16)
        .task {
            guard let client, let wardId = admission.wardId else { return }
            await onDuty.load { try await NurseApi(client: client).wardOnDuty(wardId) }
        }
    }

    private func give() async {
        guard let client else { return }
        busy = true
        defer { busy = false }
        failure = nil
        do {
            _ = try await NurseApi(client: client).updateMar(admission.id, dose.id, UpdateMarPayload(status: "given", administeredAt: ServerTime.format(Date()), witnessedBy: dose.isHighAlert ? witnessId : nil))
            onDone()
        } catch {
            failure = (error as? ApiError)?.message ?? "Could not reach the hospital server."
        }
    }
}

/// Held and refused, with a reason the nurse actually typed. A held dose
/// whose reason is a constant tells the next shift nothing.
private struct RecordNotGiven: View {
    @Environment(\.apiClient) private var client
    let admission: AdmissionRow
    let dose: MarRow
    let onDone: () -> Void
    @State private var mode: String?
    @State private var reason = ""
    @State private var busy = false
    @State private var failure: String?
    @FocusState private var focused: Bool

    var body: some View {
        if let mode {
            VStack(alignment: .leading, spacing: 12) {
                CarbonField(mode == "held" ? "Why was it held?" : "What did the patient say?", isFocused: focused) {
                    TextField("Reason", text: $reason, axis: .vertical).lineLimit(2...5).focused($focused)
                        .accessibilityIdentifier("dose-reason")
                }
                if let failure { CarbonNotification(kind: .error, title: "Not recorded", message: failure) }
                HStack(spacing: 8) {
                    Button("Save") { Task { await submit(mode) } }.buttonStyle(.carbonPrimary)
                        .disabled(busy || reason.trimmingCharacters(in: .whitespaces).isEmpty)
                        .accessibilityIdentifier("dose-save")
                    Button("Cancel") { self.mode = nil; reason = "" }.buttonStyle(.carbonGhost)
                }
            }
        } else {
            HStack(spacing: 8) {
                Button("Hold") { mode = "held" }.buttonStyle(.carbonTertiary).accessibilityLabel("Hold \(dose.drugName) and give a reason")
                    .accessibilityIdentifier("dose-hold")
                Button("Refused") { mode = "refused" }.buttonStyle(.carbonTertiary).accessibilityLabel("Record that the patient refused \(dose.drugName)")
                    .accessibilityIdentifier("dose-refused")
            }
        }
    }

    private func submit(_ mode: String) async {
        guard let client else { return }
        busy = true
        defer { busy = false }
        failure = nil
        let text = reason.trimmingCharacters(in: .whitespaces)
        do {
            _ = try await NurseApi(client: client).updateMar(admission.id, dose.id, UpdateMarPayload(status: mode, holdReason: mode == "held" ? text : nil, refusedReason: mode == "refused" ? text : nil))
            onDone()
        } catch {
            failure = (error as? ApiError)?.message ?? "Could not reach the hospital server."
        }
    }
}
