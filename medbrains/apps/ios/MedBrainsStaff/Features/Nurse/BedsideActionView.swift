import MedBrainsCore
import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// Bedside charting: vitals, intake/output, pain, fall risk. Each write is
/// admission-scoped so the entry lands on the right encounter for audit and
/// shift handover continuity. An empty field is not a zero.
struct BedsideActionView: View {
    @Environment(\.apiClient) private var client
    let admission: AdmissionRow
    let mode: BedsideMode

    @State private var form: [String: String] = [:]
    @State private var direction = "intake"
    @State private var busy = false
    @State private var message: String?
    @State private var error: String?
    @FocusState private var focus: String?

    private var spec: (title: String, badge: String, tone: CarbonTone) {
        switch mode {
        case .io: ("Intake / output", "I/O", .success)
        case .pain: ("Pain score", "PAIN", .warning)
        case .fallRisk: ("Fall risk", "FALL", .info)
        case .vitals: ("Vitals", "VITALS", .info)
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                CarbonPageHeader(eyebrow: "Nurse", title: spec.title, subtitle: "\(admission.patientName) · UHID \(admission.uhid)") {
                    CarbonTag(spec.badge, tone: spec.tone)
                }
                CarbonTile(tone: .info) {
                    Eyebrow("Context")
                    Text(admission.bedLabel ?? "Active admission").font(CarbonType.heading02).foregroundStyle(MedBrainsTheme.ink)
                    Text("This entry is linked to encounter \(admission.encounterId.prefix(8)) for audit and shift handover continuity.")
                        .font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
                }
                .padding(.horizontal, 16)
                VStack(alignment: .leading, spacing: 16) {
                    switch mode {
                    case .vitals:
                        field("Temperature", "temperature", .decimalPad)
                        field("Pulse", "pulse", .numberPad)
                        HStack(spacing: 8) { field("Systolic BP", "systolic_bp", .numberPad); field("Diastolic BP", "diastolic_bp", .numberPad) }
                        HStack(spacing: 8) { field("SpO2", "spo2", .numberPad); field("Respiratory rate", "respiratory_rate", .numberPad) }
                        field("Notes", "notes", .default)
                    case .io:
                        Picker("Direction", selection: $direction) {
                            Text("Intake").tag("intake")
                            Text("Output").tag("output")
                        }
                        .pickerStyle(.segmented)
                        field("Category", "category", .default, placeholder: direction == "intake" ? "oral / IV / tube" : "urine / drain / emesis")
                        field("Volume ml", "volume_ml", .numberPad)
                        field("Notes", "notes", .default)
                    case .pain:
                        field("Pain score 0-10", "score", .numberPad)
                        field("Location", "location", .default)
                        field("Character", "character", .default, placeholder: "dull / sharp / burning")
                        field("Intervention", "intervention", .default)
                    case .fallRisk:
                        field("Morse score", "score", .numberPad)
                        field("Interventions", "interventions", .default, placeholder: "bed low, call bell, non-skid socks")
                    }
                    if let error { CarbonNotification(kind: .error, title: "Not saved", message: error) }
                    if let message { CarbonNotification(kind: .success, title: "Saved", message: message) }
                    Button("Save") { Task { await submit() } }.buttonStyle(.carbonPrimary).disabled(busy)
                        .accessibilityIdentifier("bedside-save")
                }
                .padding(.horizontal, 16)
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .background(MedBrainsTheme.canvas)
        .navigationTitle(spec.title)
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-bedside-\(mode.rawValue)")
    }

    private func field(_ label: String, _ key: String, _ keyboard: UIKeyboardType, placeholder: String = "") -> some View {
        CarbonField(label, isFocused: focus == key) {
            TextField(placeholder.isEmpty ? label : placeholder, text: Binding(get: { form[key] ?? "" }, set: { form[key] = $0 }))
                .keyboardType(keyboard)
                .focused($focus, equals: key)
        }
    }

    private func text(_ key: String) -> String? {
        let t = (form[key] ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }

    private func int(_ key: String, _ label: String, _ range: ClosedRange<Int>? = nil, required: Bool = false) throws -> Int? {
        guard let t = text(key) else {
            if required { throw FormError("\(label) is required") }
            return nil
        }
        guard let n = Int(t) else { throw FormError("\(label) must be a number") }
        if let range, !range.contains(n) { throw FormError("\(label) must be \(range.lowerBound)-\(range.upperBound)") }
        return n
    }

    private func submit() async {
        guard let client else { return }
        let api = NurseApi(client: client)
        busy = true
        defer { busy = false }
        error = nil
        message = nil
        do {
            switch mode {
            case .vitals:
                let temp = text("temperature")
                if let temp, Double(temp) == nil { throw FormError("Temperature must be a number") }
                let p = CreateVitalsPayload(encounterId: admission.encounterId, temperature: temp, pulse: try int("pulse", "Pulse", 0...300), systolicBp: try int("systolic_bp", "Systolic BP", 0...300), diastolicBp: try int("diastolic_bp", "Diastolic BP", 0...200), respiratoryRate: try int("respiratory_rate", "Respiratory rate", 0...80), spo2: try int("spo2", "SpO2", 0...100), notes: text("notes"))
                if temp == nil, p.pulse == nil, p.systolicBp == nil, p.diastolicBp == nil, p.respiratoryRate == nil, p.spo2 == nil {
                    throw FormError("Enter at least one vital reading")
                }
                _ = try await api.createVitals(p)
                message = "Saved to bedside chart."
            case .io:
                guard let category = text("category") else { throw FormError("Category is required") }
                guard let volume = try int("volume_ml", "Volume", required: true) else { return }
                _ = try await api.createIoEntry(CreateIoEntryPayload(encounterId: admission.encounterId, category: category, direction: direction, volumeMl: volume, notes: text("notes")))
                let balance = try await api.ioBalance(admission.encounterId)
                message = "8h balance: \(Int(balance.balance)) ml"
            case .pain:
                guard let score = try int("score", "Pain score", 0...10, required: true) else { return }
                _ = try await api.createPain(CreatePainEntryPayload(encounterId: admission.encounterId, scale: "numeric", score: score, location: text("location"), character: text("character"), interventionTaken: text("intervention")))
                message = "Saved to bedside chart."
            case .fallRisk:
                guard let score = try int("score", "Fall risk score", required: true) else { return }
                let interventions = (text("interventions") ?? "").split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
                _ = try await api.createFallRisk(CreateFallRiskPayload(encounterId: admission.encounterId, scale: "morse", score: score, riskLevel: fallRiskMorseLevel(score: Int64(score)), interventions: interventions))
                message = "Saved: \(fallRiskMorseLevel(score: Int64(score))) risk."
            }
        } catch let e as FormError {
            error = e.message
        } catch {
            self.error = (error as? ApiError)?.message ?? "Could not reach the hospital server."
        }
    }
}

struct FormError: Error {
    let message: String
    init(_ message: String) { self.message = message }
}
