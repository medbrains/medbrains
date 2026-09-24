import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// The arrests in progress, on the phone the page reaches. One act,
/// **Responding**, deliberately not "Seen": the server records it as an
/// arrival, the first one fills NABH's response-time measure, and the lead
/// running the arrest sees the name appear. Polls every five seconds while
/// on screen; the `.task` ends with the screen, so no timer outlives it.
struct CodeBlueView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.apiClient) private var client
    @State private var events = Remote<[CodeBlueEvent]>()
    @State private var responders = Remote<[CodeBlueResponder]>()

    /// More than this many simultaneous arrests is a disaster, not a list.
    private let pageSize = 20

    var body: some View {
        let active = Array((events.value ?? []).prefix(pageSize))
        let byEvent = Dictionary(grouping: responders.value ?? [], by: \.codeBlueId)
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                CarbonPageHeader(eyebrow: "Code blue", title: "Arrests in progress", subtitle: "Answer the page here. The first answer is the team's arrival time.") {
                    if !active.isEmpty { CarbonTag("\(active.count) active", tone: .danger) }
                }
                if let since = events.staleSince {
                    CarbonNotification(kind: .warning, title: "Not refreshing", message: "Showing what was known at \(since.formatted(date: .omitted, time: .shortened)). Do not read this as none in progress.")
                        .padding(.horizontal, 16)
                }
                RemoteContentView(
                    id: "code-blue",
                    state: events.state,
                    unavailableTitle: "Code blue board unavailable",
                    unavailableMessage: "Arrests could not be loaded. Do not read this as none in progress — go to the ward or call the switchboard.",
                    isEmpty: \.isEmpty,
                    emptyTitle: "No arrest in progress",
                    emptyMessage: "Nothing has been called.",
                    retry: { Task { await loadOnce() } }
                ) { _ in
                    LazyVStack(spacing: 8) {
                        ForEach(active) { event in
                            ArrestRow(event: event, responders: byEvent[event.id] ?? [], me: auth.identity?.userId, canRespond: auth.identity?.can("nurse.code_blue.respond") ?? false, onChanged: { Task { await loadOnce() } })
                        }
                    }
                    .padding(16)
                }
            }
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Code blue")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-code-blue")
        .task {
            guard let client else { return }
            let api = NurseApi(client: client)
            await events.poll(every: 5) {
                let rows = try await api.listActiveCodeBlues()
                // Responders only matter while something is active; no arrest, no second call.
                if rows.isEmpty { await responders.load { [] } } else { await responders.load { try await api.listCodeBlueResponders() } }
                return rows
            }
        }
    }

    private func loadOnce() async {
        guard let client else { return }
        let api = NurseApi(client: client)
        await events.load { try await api.listActiveCodeBlues() }
        await responders.load { try await api.listCodeBlueResponders() }
    }
}

private struct ArrestRow: View {
    @Environment(\.apiClient) private var client
    let event: CodeBlueEvent
    let responders: [CodeBlueResponder]
    let me: String?
    let canRespond: Bool
    let onChanged: () -> Void
    @State private var busy = false

    var body: some View {
        let responded = responders.contains { $0.userId == me }
        CarbonTile(tone: .danger) {
            HStack {
                Text(event.location).font(CarbonType.heading02).foregroundStyle(MedBrainsTheme.ink)
                Spacer()
                CarbonTag("ACTIVE", tone: .danger)
            }
            TimelineView(.periodic(from: .now, by: 1)) { context in
                Text(sinceLabel(event.startedAt, now: context.date)).font(CarbonType.codeSmall).foregroundStyle(MedBrainsTheme.inkSecondary)
            }
            // "Nobody yet" is the most important state this list has. It must be words, never a blank.
            if let first = responders.first {
                Text("First on scene: \(first.userName) (+\(first.secondsAfterCall)s)" + (responders.count > 1 ? " · \(responders.count - 1) more responding" : ""))
                    .font(CarbonType.body).foregroundStyle(MedBrainsTheme.ink)
            } else {
                Text("Nobody has responded yet.").font(CarbonType.body).foregroundStyle(Carbon.amber[6])
                    .accessibilityIdentifier("code-blue-nobody-\(event.id)")
            }
            if canRespond {
                Button(responded ? "You are responding" : "Responding") { Task { await respond() } }
                    .buttonStyle(.carbonPrimary)
                    .disabled(busy || responded)
                    .accessibilityLabel(responded ? "You are responding to the code blue at \(event.location)" : "Respond to the code blue at \(event.location)")
                    .accessibilityIdentifier("code-blue-respond")
            }
        }
    }

    private func respond() async {
        guard let client else { return }
        busy = true
        defer { busy = false }
        try? await NurseApi(client: client).respondToCodeBlue(event.id)
        onChanged()
    }
}

func sinceLabel(_ startedAt: String, now: Date) -> String {
    guard let started = ServerTime.parse(startedAt) else { return "" }
    let seconds = max(0, Int(now.timeIntervalSince(started)))
    return "\(seconds / 60)m \(seconds % 60)s since the call"
}
