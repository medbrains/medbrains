import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// The bedside inputs an early-warning score needs beyond the classic vitals.
/// Nothing chosen is "not charted": the server marks the score incomplete
/// rather than scoring it normal.
struct EarlyWarningFields<Field: View>: View {
    @Binding var consciousness: String?
    @Binding var oxygenDevice: String?
    @Binding var distress: String?
    /// The screen's own text-field builder, so these look like its other fields.
    let field: (String, String, UIKeyboardType) -> Field

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Eyebrow("Early-warning score")
            Text("Consciousness (ACVPU)").font(CarbonType.label).foregroundStyle(MedBrainsTheme.inkSecondary)
            Picker("Consciousness (ACVPU)", selection: $consciousness) {
                ForEach(EarlyWarning.consciousness, id: \.code) { o in
                    Text(o.code).tag(String?.some(o.code)).accessibilityLabel(o.label)
                }
            }
            .pickerStyle(.segmented)
            .frame(minHeight: 44)
            .accessibilityIdentifier("ews-consciousness")
            Picker("Oxygen / respiratory support", selection: $oxygenDevice) {
                Text("Not charted").tag(String?.none)
                ForEach(EarlyWarning.oxygenDevices, id: \.code) { o in Text(o.label).tag(String?.some(o.code)) }
            }
            .pickerStyle(.menu)
            .frame(minHeight: 44)
            .accessibilityIdentifier("ews-oxygen-device")
            if oxygenDevice == EarlyWarning.highFlow {
                field("FiO2 %", "fio2_percent", .numberPad)
            } else if let d = oxygenDevice, d != EarlyWarning.roomAir {
                field("Oxygen flow L/min", "oxygen_flow_lpm", .decimalPad)
            }
            Eyebrow("Children")
            field("Capillary refill (seconds)", "capillary_refill_seconds", .decimalPad)
            Text("Respiratory distress").font(CarbonType.label).foregroundStyle(MedBrainsTheme.inkSecondary)
            Picker("Respiratory distress", selection: $distress) {
                ForEach(EarlyWarning.distress, id: \.code) { o in Text(o.label).tag(String?.some(o.code)) }
            }
            .pickerStyle(.segmented)
            .frame(minHeight: 44)
            .accessibilityIdentifier("ews-distress")
        }
    }
}

/// The score a reading was given: headline with band in words and colour,
/// what was not charted, when the next full set is due, and the escalation.
struct EarlyWarningResult: View {
    let score: EarlyWarning.Score

    var body: some View {
        CarbonTile(tone: CarbonTone(EarlyWarning.bandTone(score.band))) {
            Eyebrow("Early-warning score")
            HStack(spacing: 8) {
                Text("\(EarlyWarning.toolLabel(score.tool)) \(EarlyWarning.totalText(score.total, incomplete: score.incomplete))")
                    .font(CarbonType.heading02).foregroundStyle(MedBrainsTheme.ink)
                CarbonTag(EarlyWarning.bandLabel(score.band), tone: CarbonTone(EarlyWarning.bandTone(score.band)))
            }
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("ews-headline")
            if score.incomplete {
                Text("Incomplete — not charted: \(EarlyWarning.missingText(score.missing)). The score is at least \(score.total).")
                    .font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
            }
            Text("Next full set due \(ServerTime.short(score.nextDueAt))")
                .font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
        }
        if score.escalationId != nil {
            CarbonNotification(kind: .error, title: "Escalated", message: "Nurse in charge and doctors told. Acknowledge with your response on the care view.")
                .accessibilityIdentifier("ews-escalated")
        }
    }
}
