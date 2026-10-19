import MedBrainsKit
import MedBrainsUI
import QuickLook
import SwiftUI
import UniformTypeIdentifiers

/// One record another hospital sent, read into sections, while it may be
/// held. A copy whose consent ended answers 404: it reads as erased.
struct ReceivedRecordView: View {
    @Environment(\.apiClient) private var client
    let recordId: String
    @State private var remote = Remote<ReadRecord>()
    @State private var preview: URL?
    /// Documents written for preview, removed when the screen leaves.
    @State private var written: [URL] = []
    @State private var openFailure: String?

    /// The record with its bundle read once, not on every render.
    struct ReadRecord: Sendable {
        let record: AbdmRecords.ReceivedRecord
        let document: FhirSections.Document
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                if remote.isNotAvailable {
                    CarbonNotification(kind: .warning, title: "This record is not available", message: "The consent may have been withdrawn or expired, and the copy erased.")
                        .padding(16)
                        .accessibilityIdentifier("abdm-record-erased")
                } else {
                    RemoteContentView(
                        id: "abdm-record", state: remote.state,
                        unavailableTitle: "Could not open the record",
                        unavailableMessage: "The record could not be loaded.",
                        isEmpty: { _ in false }, emptyTitle: "", emptyMessage: "",
                        retry: { Task { await load() } }
                    ) { read in content(read) }
                }
            }
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Record")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-abdm-record")
        .quickLookPreview($preview)
        .task { await load() }
        .onDisappear { removeWritten() }
    }

    @ViewBuilder
    private func content(_ read: ReadRecord) -> some View {
        let r = read.record, doc = read.document
        VStack(alignment: .leading, spacing: 0) {
            CarbonPageHeader(
                eyebrow: AbdmRecords.hiTypeLabel(r.hiType),
                title: doc.title ?? AbdmRecords.hiTypeLabel(r.hiType),
                subtitle: [r.sourceHipName ?? r.sourceHipId, ServerTime.dateOf(doc.date ?? r.receivedAt), doc.author].compactMap { $0 }.joined(separator: " · ")
            )
            Text("Shared through ABDM with the patient's consent; erased by \(ServerTime.dateOf(r.eraseAt)).")
                .font(CarbonType.helper).foregroundStyle(MedBrainsTheme.inkSecondary).padding(.horizontal, 16)
            if let openFailure {
                CarbonNotification(kind: .error, title: "Could not open the document", message: openFailure).padding(16)
            }
            if doc.sections.isEmpty {
                Text("This record has no sections this screen can read.")
                    .font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary).padding(16)
                    .accessibilityIdentifier("abdm-record-no-sections")
            }
            LazyVStack(alignment: .leading, spacing: 0) {
                ForEach(doc.sections) { section in
                    CarbonSectionTitle(section.title)
                    ForEach(section.items) { item in itemRow(item) }
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("abdm-record-sections")
        }
    }

    private func itemRow(_ item: FhirSections.Item) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(item.text).font(CarbonType.body).foregroundStyle(MedBrainsTheme.ink)
            if let detail = item.detail {
                Text(detail).font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
            }
            switch item.link {
            case .web(let url, let label)?:
                Link(destination: url) { Label(label, systemImage: "safari") }
                    .frame(minHeight: 44)
            case .inline(let base64, let type, let label, let name)?:
                Button { open(base64: base64, type: type, name: name) } label: { Label(label, systemImage: "doc.text.magnifyingglass") }
                    .frame(minHeight: 44)
                    .accessibilityHint("Opens the document on this device")
            case nil:
                EmptyView()
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .bottom) { Rectangle().fill(MedBrainsTheme.hairline).frame(height: 1) }
        .accessibilityElement(children: .contain)
    }

    private func load() async {
        guard let client else { return }
        await remote.load {
            let record = try await AbdmRecordsApi(client: client).record(recordId)
            return ReadRecord(record: record, document: FhirSections.read(record.bundle))
        }
    }

    /// Inline content is never trusted to open itself: it is written to this
    /// app's temporary folder, protected, and previewed in place.
    private func open(base64: String, type: String, name: String) {
        guard let data = Data(base64Encoded: base64) else { openFailure = "The document arrived damaged."; return }
        var file = (name as NSString).lastPathComponent
        if (file as NSString).pathExtension.isEmpty, let ext = UTType(mimeType: type)?.preferredFilenameExtension { file += ".\(ext)" }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString)-\(file)")
        do {
            try data.write(to: url, options: [.atomic, .completeFileProtection])
            written.append(url)
            openFailure = nil
            preview = url
        } catch {
            openFailure = "The document could not be saved for viewing."
        }
    }

    private func removeWritten() {
        written.forEach { try? FileManager.default.removeItem(at: $0) }
        written.removeAll()
    }
}
