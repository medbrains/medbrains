import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// UHI requests: what patient apps booked or asked for through NHA's
/// Unified Health Interface, with state, payment and hold time. Ambulance,
/// blood and lab requests wait for an answer; accepting or declining needs
/// `uhi.requests.respond` and the service's own module permission, exactly
/// as the web and the server decide. The answer goes back to the app.
struct UhiRequestsView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.apiClient) private var client
    @State private var remote = Remote<[UhiRequests.Request]>()
    @State private var action = QueueActionState()
    @State private var filter = UhiRequests.Filter.waiting
    @State private var declining: UhiRequests.Request?

    /// New requests arrive from patients' apps; the queue re-asks this often while open.
    private static let pollSeconds: Double = 30

    private var api: UhiRequestsApi? { client.map(UhiRequestsApi.init) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                VStack(alignment: .leading, spacing: 4) {
                    Eyebrow("Module")
                    Text("Bookings and requests from patient apps, through NHA's Unified Health Interface.").font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 16)
                Picker("Show", selection: $filter) {
                    ForEach(UhiRequests.Filter.allCases, id: \.self) { Text($0.label).tag($0) }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16)
                .accessibilityIdentifier("uhi-filter")
                if let failure = action.failure {
                    CarbonNotification(kind: .error, title: "That didn't go through", message: failure).padding(16)
                } else if let toast = action.toast {
                    CarbonNotification(kind: .success, title: toast, message: "The patient's app has been told.").padding(16).accessibilityIdentifier("uhi-toast")
                }
                if remote.staleSince != nil {
                    CarbonNotification(kind: .warning, title: "Showing the last list", message: "The latest refresh failed; this may be out of date.").padding(16)
                }
                RemoteContentView(
                    id: "uhi-requests", state: remote.state,
                    unavailableTitle: "Could not load UHI requests",
                    unavailableMessage: "This does not mean there are none — the list failed to load.",
                    isEmpty: \.isEmpty,
                    emptyTitle: filter == .waiting ? "Nothing is waiting for an answer" : "No requests yet",
                    emptyMessage: "Requests from patients' apps appear here as they arrive.",
                    retry: { Task { await load() } }
                ) { rows in
                    LazyVStack(alignment: .leading, spacing: 0) {
                        ForEach(rows) { requestRow($0) }
                    }
                }
            }
        }
        .background(MedBrainsTheme.canvas)
        .accessibilityIdentifier("module-home-uhi")
        .refreshable { await load() }
        // Restarts on a filter change and stops when the screen leaves: no poll outlives it.
        .task(id: filter) {
            guard let api, auth.identity?.can(UhiRequests.Permission.view) ?? false else { return }
            let filter = filter
            await remote.poll(every: Self.pollSeconds) { try await api.list(filter) }
        }
        .sheet(item: $declining) { r in
            DeclineSheet(request: r) { reason in await decline(r, reason) }
        }
    }

    private func requestRow(_ r: UhiRequests.Request) -> some View {
        let state = UhiRequests.state(r.state)
        return VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(UhiRequests.serviceLabel(r.service)).font(CarbonType.heading02).foregroundStyle(MedBrainsTheme.ink)
                Spacer(minLength: 8)
                CarbonTag(state.text, tone: CarbonTone(state.tone))
            }
            line(ServerTime.short(r.confirmedAt ?? r.updatedAt))
            Text(r.customerName ?? "—").font(CarbonType.body).foregroundStyle(MedBrainsTheme.ink)
            let contact = [r.customerPhone, r.customerAbha].compactMap { $0 }.joined(separator: " · ")
            if !contact.isEmpty { line(contact) }
            Text(r.summary.isEmpty ? "—" : r.summary).font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.ink)
            if UhiRequests.isInAppointments(r) { line("In the OPD appointments for that day") }
            if !r.labOrderIds.isEmpty { line("\(r.labOrderIds.count) lab orders placed") }
            if let reason = r.declineReason { line("Declined: \(reason)") }
            if r.state == UhiRequests.awaitingPayment, let hold = r.holdExpiresAt { line("Slot let go at \(ServerTime.short(hold)) unless paid") }
            if let pay = UhiRequests.payment(r) {
                HStack(spacing: 8) {
                    CarbonTag(pay.text, tone: CarbonTone(pay.tone))
                    line(UhiRequests.amountLine(r))
                }
            }
            if UhiRequests.mayAnswer(r, auth.identity) {
                HStack(spacing: 8) {
                    Button(UhiRequests.acceptLabel(r.service)) { Task { await accept(r) } }
                        .buttonStyle(.carbonPrimary)
                        .accessibilityIdentifier("uhi-accept-\(r.id)")
                    Button("Decline") { declining = r }
                        .buttonStyle(.carbonTertiary)
                        .accessibilityIdentifier("uhi-decline-\(r.id)")
                }
                .disabled(action.busy)
            }
        }
        .padding(16)
        .overlay(alignment: .bottom) { Rectangle().fill(MedBrainsTheme.hairline).frame(height: 1) }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("uhi-request-\(r.id)")
    }

    private func line(_ text: String) -> some View {
        Text(text).font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
    }

    private func load() async {
        guard let api, auth.identity?.can(UhiRequests.Permission.view) ?? false else { return }
        let filter = filter
        await remote.load { try await api.list(filter) }
    }

    private func accept(_ r: UhiRequests.Request) async {
        guard let api else { return }
        await action.run(unreachable: "Could not reach the hospital server.") {
            _ = try await api.accept(r.id)
            return "Request accepted"
        }
        await load()
    }

    private func decline(_ r: UhiRequests.Request, _ reason: String) async {
        guard let api else { return }
        await action.run(unreachable: "Could not reach the hospital server.") {
            _ = try await api.decline(r.id, reason: reason)
            return "Request declined"
        }
        await load()
    }
}

/// Decline with the reason the patient's app will show, so they can look elsewhere.
private struct DeclineSheet: View {
    @Environment(\.dismiss) private var dismiss
    let request: UhiRequests.Request
    let decline: @MainActor (String) async -> Void
    @State private var reason = ""
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text("\(UhiRequests.serviceLabel(request.service)) for \(request.customerName ?? "the patient")").font(CarbonType.heading02)
                CarbonField("Reason the patient will see", helper: "For example: No ambulance free for the next hour.", isFocused: focused) {
                    TextField("", text: $reason, axis: .vertical)
                        .lineLimit(2...5)
                        .focused($focused)
                        .accessibilityLabel("Reason the patient will see")
                        .accessibilityIdentifier("uhi-decline-reason")
                }
                Button("Decline") {
                    guard let why = UhiRequests.declineReason(reason) else { return }
                    Task {
                        await decline(why)
                        dismiss()
                    }
                }
                .buttonStyle(.carbonDanger)
                .disabled(UhiRequests.declineReason(reason) == nil)
                .accessibilityIdentifier("uhi-decline-confirm")
                Spacer()
            }
            .padding(16)
            .navigationTitle("Decline this request?")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }
    }
}
