import MedBrainsCore
import MedBrainsUI
import SwiftUI

/// The health record the companion keeps on the phone: a JSON file in the
/// app's private documents, self-entered wellness data, the same shape the
/// React Native app wrote. A corrupt or missing file reads as an empty
/// record — the only place swallowing a failure is right, because an empty
/// local record claims nothing about anyone's health.
struct HealthRecord: Codable {
    struct Medication: Codable { let id: String; let name: String; let instructions: String; let times: [String]; let startedOn: String; let endsOn: String? }
    struct Adherence: Codable { let id: String; let planId: String; let scheduledFor: String; let status: String }
    struct Observation: Codable { let id: String; let recordedAt: String }
    var medications: [Medication] = []
    var adherence: [Adherence] = []
    var observations: [Observation] = []

    static func load() -> HealthRecord {
        let url = URL.documentsDirectory.appendingPathComponent("health-record.json")
        guard let data = try? Data(contentsOf: url), let record = try? JSONDecoder().decode(HealthRecord.self, from: data) else { return HealthRecord() }
        return record
    }
}

/// Health → Today. One number, one sentence, then the doses: a person opening
/// this at 7am wants to know whether they are on track and what is left. The
/// verdict comes from the clinical core's closed set, never an instruction.
struct HealthTabView: View {
    @State private var brief: DailyBrief?

    private let confidenceLabel = ["calibrating": "Still learning", "building": "Building a baseline", "established": "Established"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                if let brief {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(brief.adherencePercent.map { "\($0)%" } ?? "—").font(CarbonType.display).foregroundStyle(MedBrainsTheme.interactive)
                        Eyebrow("Taken this week")
                        Text(brief.verdict).font(CarbonType.body).foregroundStyle(MedBrainsTheme.ink).padding(.top, 8)
                        HStack(spacing: 8) {
                            CarbonTag(confidenceLabel[brief.confidence] ?? brief.confidence, tone: .info)
                            if brief.streakDays > 0 { CarbonTag("\(brief.streakDays)-day streak", tone: .success) }
                        }
                        .padding(.top, 8)
                    }
                    .padding(16)
                    if brief.slots.isEmpty {
                        CarbonNotification(kind: .info, title: "Nothing scheduled today", message: "Medications you add will appear here at their times.").padding(.horizontal, 16)
                    }
                    ForEach(brief.slots, id: \.scheduledFor) { slot in
                        CarbonTile(tone: slot.status == "taken" ? .success : .neutral) {
                            HStack { Text(slot.name).font(CarbonType.heading02).foregroundStyle(MedBrainsTheme.ink); Spacer(); CarbonTag(slot.status == "taken" ? "taken" : slot.status == "due" ? slot.time : slot.status, tone: slot.status == "taken" ? .success : .neutral) }
                            if !slot.instructions.isEmpty { Text(slot.instructions).font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary) }
                        }
                        .padding(.horizontal, 16).padding(.vertical, 4)
                    }
                    CarbonSectionTitle("Bands")
                    NavigationLink { BandsView() } label: {
                        CarbonRow("Bands", detail: "Where a wearable connects.") { Image(systemName: "applewatch").foregroundStyle(MedBrainsTheme.interactive) }
                    }
                    .buttonStyle(.plain)
                } else {
                    ProgressView().frame(maxWidth: .infinity).padding()
                }
            }
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Today")
        .accessibilityIdentifier("tab-health")
        .task {
            let record = HealthRecord.load()
            brief = dailyBrief(
                medications: record.medications.map { MedicationPlan(id: $0.id, name: $0.name, instructions: $0.instructions, times: $0.times, startedOn: $0.startedOn, endsOn: $0.endsOn) },
                adherence: record.adherence.map { AdherenceEvent(planId: $0.planId, scheduledFor: $0.scheduledFor, status: $0.status) },
                observationDays: record.observations.map(\.recordedAt),
                nowUnix: Int64(Date().timeIntervalSince1970)
            )
        }
    }
}

/// Health → Bands. No pairing is wired yet — HealthKit needs its
/// entitlement and the MedBrains band its ingest credential — so the list is
/// empty and says what will connect, which is a fact rather than a promise.
struct BandsView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                CarbonPageHeader(eyebrow: "Health", title: "Bands", subtitle: "Where a wearable connects, and the truth about it.")
                CarbonNotification(kind: .info, title: "No band connected", message: "An Apple Watch, a Health Connect device or a MedBrains band will appear here once paired.").padding(16)
            }
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Bands").navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-bands")
    }
}
