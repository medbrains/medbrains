import MedBrainsCore
import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// The visit's case sheet on the handheld: every note in the order care
/// happened, each with its author and whether it is signed, and the
/// doctor's own consultation note to write and sign. A failed read is never
/// an empty sheet — the doctor would start a second note over the first.
struct ConsultationView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.apiClient) private var client
    let token: WorklistToken
    @State private var notes = Remote<[Note]>()
    @State private var reviseError: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            CarbonPageHeader(eyebrow: "Case sheet", title: token.displayName, subtitle: "UHID \(token.uhid ?? "—") · Token \(token.number)")
            if let encounterId = token.encounterId {
                switch notes.state {
                case .loading:
                    ProgressView().frame(maxWidth: .infinity).padding()
                case .failed(let message):
                    CarbonNotification(kind: .error, title: "Couldn't load the case sheet", message: message) {
                        Button("Try again") { Task { await load(encounterId) } }.buttonStyle(.carbonGhost)
                    }
                    .padding(16)
                case .loaded(let list):
                    sheet(encounterId, list)
                }
            } else {
                // A token issued before its encounter existed. Saying so beats a form that cannot save.
                CarbonNotification(kind: .warning, title: "No visit to record against", message: "This token has no OPD visit yet. Start the visit from reception, then the consultation can be written.")
                    .padding(16)
            }
            Spacer(minLength: 0)
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Case sheet")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-consultation")
        .task { if let e = token.encounterId { await load(e) } }
    }

    private func sheet(_ encounterId: String, _ list: [Note]) -> some View {
        let canWrite = auth.identity?.can("clinical_notes.write") ?? false
        let canSign = auth.identity?.can("clinical_notes.sign") ?? false
        // The doctor's own consultation, newest first; a struck one no longer counts.
        let mine = list.last { $0.isMine && $0.noteTypeCode == "consultation" && $0.amendsNoteId == nil && $0.status != "entered_in_error" }
        return ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                ForEach(list.filter { $0.id != mine?.id || mine?.status != "draft" }) { NoteBlock(note: $0) }
                if list.isEmpty {
                    Text("No notes on this visit yet.").font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
                }
                if let reviseError { CarbonNotification(kind: .error, title: "The note was not reopened", message: reviseError) }
                if let mine, mine.status == "signed" {
                    if mine.revisable && canSign {
                        Button("Revise") { Task { await revise(mine.id, encounterId) } }
                            .buttonStyle(.carbonTertiary).accessibilityIdentifier("consultation-revise")
                    }
                } else if canWrite {
                    ConsultationNoteForm(encounterId: encounterId, note: mine, canSign: canSign) { await load(encounterId) }
                        .id(mine?.id ?? "new")
                } else {
                    Text("You can read this case sheet but not write on it.").font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
                }
            }
            .padding(16)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private func load(_ encounterId: String) async {
        guard let client else { return }
        await notes.load { try await NotesApi(client: client).list(encounterId) }
    }

    private func revise(_ noteId: String, _ encounterId: String) async {
        guard let client else { return }
        reviseError = nil
        do {
            _ = try await NotesApi(client: client).revise(noteId)
            await load(encounterId)
        } catch {
            reviseError = (error as? ApiError)?.message ?? "Could not reach the hospital server."
        }
    }
}
