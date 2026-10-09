import MedBrainsUI
import SwiftUI

/// One note on the case sheet as the paper margin reads it: the kind of
/// note, who wrote it and when, signed or not, and what it says.
struct NoteBlock: View {
    let note: Note

    private var statusTag: (String, CarbonTone) {
        switch note.status {
        case "entered_in_error": return ("entered in error", .danger)
        case "draft": return ("draft — not signed", .warning)
        default: return (note.currentVersion > 1 ? "signed · revised" : "signed", .success)
        }
    }

    private var lines: [(String, String)] {
        note.sections.compactMap { section -> (String, String)? in
            let body = section.code == "examination"
                ? ConsultationDraft(note).findings.map(\.line).joined(separator: "\n")
                : plainText(section.text)
            return body.isEmpty ? nil : (section.title, body)
        }
    }

    var body: some View {
        CarbonTile(tone: note.status == "draft" ? .warning : .neutral) {
            Eyebrow(note.amendsNoteId == nil ? note.noteTypeName : "Addendum")
            Text("\(note.authorName) · \(note.authorRole.replacingOccurrences(of: "_", with: " "))")
                .font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.ink)
            Text("Care at \(shortTime(note.serviceAt))").font(CarbonType.label).foregroundStyle(MedBrainsTheme.inkSecondary)
            CarbonTag(statusTag.0, tone: statusTag.1).accessibilityIdentifier("note-status-\(note.status)")
            if let cosigner = note.cosignerName, let state = note.cosignStatus {
                Text(state == "pending" ? "Awaiting countersign by \(cosigner)" : "Countersigned by \(cosigner)")
                    .font(CarbonType.label).foregroundStyle(MedBrainsTheme.inkSecondary)
            }
            if let reason = note.enteredInErrorReason {
                Text("Entered in error: \(reason)").font(CarbonType.label).foregroundStyle(MedBrainsTheme.danger)
            }
            ForEach(lines, id: \.0) { title, text in
                Eyebrow(title)
                Text(text).font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.ink)
                    .strikethrough(note.status == "entered_in_error")
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("note-block")
    }
}

/// "2026-10-05T10:42:00Z" as the reader's local day and time.
func shortTime(_ iso: String) -> String {
    let parser = ISO8601DateFormatter()
    parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let date = parser.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
    return date.map { $0.formatted(date: .abbreviated, time: .shortened) } ?? iso
}
