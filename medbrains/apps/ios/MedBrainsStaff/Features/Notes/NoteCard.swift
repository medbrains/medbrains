import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// One sticky note in its colour, with where it is shared, when it clears,
/// and — for a note pinned from a notification — that it is the system's
/// text, a link to its source and whether it resolved itself.
struct NoteCard<Actions: View>: View {
    @Environment(\.apiClient) private var client
    let note: StickyNotes.Note
    /// Off on the reader's own notes.
    var showAuthor = true
    @ViewBuilder let actions: () -> Actions

    var body: some View {
        CarbonTile(tone: CarbonTone(StickyNotes.tone(note.colour))) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .top) {
                    Text(note.body).font(CarbonType.body).foregroundStyle(MedBrainsTheme.ink)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    if note.pinned {
                        Image(systemName: "pin.fill").foregroundStyle(MedBrainsTheme.inkSecondary).accessibilityLabel("Pinned")
                    }
                }
                if note.isSystem { source }
                if !note.shares.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 4) { ForEach(note.shares) { CarbonTag($0.label) } }
                    }
                    .accessibilityLabel("Shared with \(note.shares.map(\.label).joined(separator: ", "))")
                }
                Text(footer).font(CarbonType.helper).foregroundStyle(MedBrainsTheme.inkSecondary)
                HStack(spacing: 8) { actions() }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("note-\(note.id)")
    }

    private var footer: String {
        var parts: [String] = []
        if showAuthor { parts.append(note.authorName) }
        parts.append(ServerTime.short(note.updatedAt))
        if let clears = note.expiresAt { parts.append("clears \(ServerTime.short(clears))") }
        return parts.joined(separator: " · ")
    }

    /// The item behind it lives on the web app, on the same server.
    private var sourceURL: URL? {
        guard let path = note.sourceUrl, let base = client?.baseURL else { return nil }
        return URL(string: path, relativeTo: base)
    }

    @ViewBuilder
    private var source: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                CarbonTag("From notification", tone: .info)
                Text("Read-only").font(CarbonType.helper).foregroundStyle(MedBrainsTheme.inkSecondary)
            }
            if let resolved = note.resolvedAt {
                CarbonTag("Resolved automatically \(ServerTime.short(resolved))", tone: .success)
                    .accessibilityIdentifier("note-resolved-\(note.id)")
            } else if note.autoResolve {
                Text("Clears itself when resolved").font(CarbonType.helper).foregroundStyle(MedBrainsTheme.inkSecondary)
            }
            if let sourceURL {
                Link(destination: sourceURL) { Label("Open the item", systemImage: "arrow.up.right.square") }
                    .font(CarbonType.bodyCompact)
                    .frame(minHeight: 44)
                    .accessibilityIdentifier("note-source-\(note.id)")
            }
        }
    }
}

/// An icon button on a note: a glyph with its words for VoiceOver, 44pt.
struct NoteIconButton: View {
    let label: String
    let symbol: String
    var role: ButtonRole?
    let id: String
    let action: () -> Void

    var body: some View {
        Button(role: role, action: action) {
            Image(systemName: symbol).frame(minWidth: 44, minHeight: 44)
        }
        .accessibilityLabel(label)
        .accessibilityIdentifier(id)
    }
}
