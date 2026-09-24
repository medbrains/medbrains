import MedBrainsCore
import MedBrainsKit
import MedBrainsUI
import SwiftUI

struct VisitorRow: Decodable, Hashable, Identifiable, Sendable {
    let id: String
    let visitorName: String
    let phone: String?
    let relationship: String?
    let category: String
    let patientId: String?
    let purpose: String?
}

struct PassRow: Decodable, Hashable, Identifiable, Sendable {
    let id: String
    let registrationId: String
    let passNumber: String
    let bedNumber: String?
    let validFrom: String
    let validUntil: String
    let status: String
    var revokedReason: String? = nil
}

struct VisitorLogRow: Decodable, Hashable, Identifiable, Sendable {
    let id: String
    let passId: String
    let checkInAt: String
    var checkOutAt: String? = nil
}

struct NewVisitorBody: Encodable {
    let visitorName: String
    let phone: String?
    let relationship: String?
    let purpose: String?
    let patientId: String?
    let category: String
}

struct NewPassBody: Encodable {
    let registrationId: String
    let bedNumber: String?
    let validHours: Int
}

struct RevokeBody: Encodable { let reason: String }

extension ReceptionApi {
    func visitors() async throws -> [VisitorRow] { try await client.request(.get, "/api/front-office/visitors") }
    func registerVisitor(_ body: NewVisitorBody) async throws -> VisitorRow { try await client.request(.post, "/api/front-office/visitors", body: body) }
    func passes() async throws -> [PassRow] { try await client.request(.get, "/api/front-office/passes") }
    func issuePass(_ body: NewPassBody) async throws -> PassRow { try await client.request(.post, "/api/front-office/passes", body: body) }
    func revokePass(_ id: String, reason: String) async throws -> PassRow { try await client.request(.put, "/api/front-office/passes/\(id)/revoke", body: RevokeBody(reason: reason)) }
    func visitorLogs() async throws -> [VisitorLogRow] { try await client.request(.get, "/api/front-office/visitor-logs") }
    func checkInVisitor(_ passId: String) async throws -> VisitorLogRow { try await client.request(.post, "/api/front-office/visitor-logs/\(passId)/check-in") }
    func checkOutVisitor(_ passId: String) async throws -> VisitorLogRow { try await client.request(.put, "/api/front-office/visitor-logs/\(passId)/check-out") }
}

/// Who is in the building, and who should not be any more. Overdue first,
/// because a pass whose hours ran out is the one the desk has to act on.
struct VisitorDeskView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.apiClient) private var client
    @State private var passes = Remote<[PassRow]>()
    @State private var visitors: [VisitorRow] = []
    @State private var logs: [VisitorLogRow] = []
    @State private var busyId: String?
    @State private var failure: String?
    @State private var revoking: PassRow?

    private var now: String { ServerTime.format(Date()) }

    var body: some View {
        let rows = passes.value ?? []
        let inside = rows.filter { isInside($0) }.count
        let overdue = rows.filter { state($0) == "overdue" && isInside($0) }.count
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                CarbonPageHeader(eyebrow: "Reception", title: "Visitor desk", subtitle: "Passes, and who is still inside.")
                HStack(spacing: 1) {
                    StatTile(eyebrow: "Inside", count: inside, title: "Visitors in the building")
                    StatTile(eyebrow: "Overdue", count: overdue, title: "Past their hours, not signed out")
                }
                .padding(.horizontal, 16)
                if auth.identity?.can("front_office.visitors.create") ?? false {
                    NavigationLink(value: ReceptionRoute.registerVisitor) {
                        HStack { Text("Register a visitor"); Spacer(); Image(systemName: "person.badge.plus") }
                    }
                    .buttonStyle(.carbonPrimary).padding(16)
                    .accessibilityIdentifier("visitor-register")
                }
                if let failure { CarbonNotification(kind: .error, title: "Not recorded", message: failure).padding(.horizontal, 16) }
                RemoteContentView(id: "passes", state: passes.state, unavailableTitle: "Couldn't load the passes", unavailableMessage: "The hospital server did not answer. Do not read this as an empty building.", isEmpty: \.isEmpty, emptyTitle: "No passes today", emptyMessage: "Nobody has been issued a visitor pass yet.", retry: { Task { await load() } }) { rows in
                    LazyVStack(spacing: 1) {
                        // Overdue first: they are the ones somebody has to chase.
                        ForEach(rows.sorted { rank($0) < rank($1) }) { pass in
                            row(pass)
                        }
                    }
                    .padding(.horizontal, 16)
                }
            }
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Visitors").navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-visitor-desk")
        .task { await load() }
        .sheet(item: $revoking) { pass in
            RevokeSheet(pass: pass) { reason in
                revoking = nil
                Task { await revoke(pass, reason: reason) }
            }
        }
    }

    @ViewBuilder
    private func row(_ pass: PassRow) -> some View {
        let s = state(pass)
        let inside = isInside(pass)
        let actions = (auth.identity?.can("front_office.passes.manage") ?? false) ? passActions(state: s, inside: inside) : []
        VStack(alignment: .leading, spacing: 8) {
            CarbonRow(name(of: pass), detail: "\(pass.passNumber) · \(pass.bedNumber.map { "bed \($0) · " } ?? "")until \(ServerTime.short(pass.validUntil))") {
                CarbonTag(s, tone: tone(s))
            }
            .accessibilityIdentifier("pass-row-\(pass.id)")
            if s == "overdue", inside {
                Text("Past their hours and not signed out — still counted as inside.")
                    .font(CarbonType.helper).foregroundStyle(MedBrainsTheme.danger)
                    .accessibilityIdentifier("pass-overdue-\(pass.id)")
            }
            if let reason = pass.revokedReason, s == "revoked" {
                Text("Revoked: \(reason)").font(CarbonType.helper).foregroundStyle(MedBrainsTheme.inkSecondary)
                    .accessibilityIdentifier("pass-revoked-\(pass.id)")
            }
            if !actions.isEmpty {
                HStack(spacing: 8) {
                    if actions.contains("check_in") {
                        Button("Check in") { Task { await move(pass, in: true) } }.buttonStyle(.carbonPrimary).disabled(busyId != nil)
                            .accessibilityIdentifier("pass-check-in-\(pass.id)")
                    }
                    if actions.contains("check_out") {
                        Button("Check out") { Task { await move(pass, in: false) } }.buttonStyle(.carbonPrimary).disabled(busyId != nil)
                            .accessibilityIdentifier("pass-check-out-\(pass.id)")
                    }
                    if actions.contains("revoke") {
                        Button("Revoke") { revoking = pass }.buttonStyle(.carbonTertiary).disabled(busyId != nil)
                            .accessibilityIdentifier("pass-revoke-\(pass.id)")
                    }
                }
                .padding(.bottom, 8)
            }
        }
    }

    private func state(_ pass: PassRow) -> String { passState(status: pass.status, validUntil: pass.validUntil, now: now) }
    private func isInside(_ pass: PassRow) -> Bool {
        let open = logs.contains { $0.passId == pass.id && $0.checkOutAt == nil }
        return passIsInside(state: state(pass), checkedOut: !open)
    }
    private func rank(_ pass: PassRow) -> Int {
        switch state(pass) {
        case "overdue": 0
        case "active": 1
        default: 2
        }
    }
    private func tone(_ state: String) -> CarbonTone {
        switch state {
        case "overdue": .danger
        case "active": .success
        default: .neutral
        }
    }
    private func name(of pass: PassRow) -> String {
        visitors.first { $0.id == pass.registrationId }?.visitorName ?? "Visitor"
    }

    private func load() async {
        guard let client else { return }
        let api = ReceptionApi(client: client)
        async let v = try? api.visitors()
        async let l = try? api.visitorLogs()
        visitors = await v ?? []
        logs = await l ?? []
        await passes.load { try await api.passes() }
    }

    private func move(_ pass: PassRow, in checkingIn: Bool) async {
        guard let client else { return }
        busyId = pass.id
        defer { busyId = nil }
        failure = nil
        do {
            let api = ReceptionApi(client: client)
            _ = checkingIn ? try await api.checkInVisitor(pass.id) : try await api.checkOutVisitor(pass.id)
            await load()
        } catch let e as ApiError {
            failure = e.message
        } catch {
            failure = "Could not reach the hospital server. Nothing was recorded."
        }
    }

    private func revoke(_ pass: PassRow, reason: String) async {
        guard let client else { return }
        busyId = pass.id
        defer { busyId = nil }
        failure = nil
        do {
            _ = try await ReceptionApi(client: client).revokePass(pass.id, reason: reason)
            await load()
        } catch let e as ApiError {
            failure = e.message
        } catch {
            failure = "Could not reach the hospital server. The pass still stands."
        }
    }
}

/// Revoking says why: the next desk reads the reason, not a status change.
private struct RevokeSheet: View {
    let pass: PassRow
    let onRevoke: (String) -> Void
    @State private var reason = ""
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    CarbonPageHeader(eyebrow: "Revoke", title: pass.passNumber, subtitle: "The pass stops working as soon as this is saved.")
                    CarbonField("Why is it being revoked?", isFocused: focused) {
                        TextField("Reason", text: $reason, axis: .vertical).lineLimit(2...4).focused($focused)
                            .accessibilityIdentifier("revoke-reason")
                    }
                    Button("Revoke the pass") { onRevoke(reason.trimmingCharacters(in: .whitespaces)) }
                        .buttonStyle(.carbonDanger)
                        .disabled(reason.trimmingCharacters(in: .whitespaces).isEmpty)
                        .accessibilityIdentifier("revoke-submit")
                }
                .padding(16)
            }
            .background(MedBrainsTheme.canvas)
            .accessibilityIdentifier("revoke-sheet")
        }
        .onAppear { focused = true }
    }
}

/// Registering and issuing are one act: a visitor without a pass is a person
/// standing at the desk with nothing to show the guard.
struct RegisterVisitorView: View {
    @Environment(\.apiClient) private var client
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var phone = ""
    @State private var relationship = ""
    @State private var purpose = ""
    @State private var patient: PatientSummary?
    @State private var bed = ""
    @State private var issued: PassRow?
    @State private var busy = false
    @State private var failure: String?
    @FocusState private var focus: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                CarbonPageHeader(eyebrow: "Visitor desk", title: "Register a visitor", subtitle: "Who they are, who they are here for, and the pass they carry.")
                if let issued {
                    CarbonTile(tone: .success) {
                        Eyebrow("Pass issued")
                        Text(issued.passNumber).font(CarbonType.display).foregroundStyle(MedBrainsTheme.ink)
                            .accessibilityIdentifier("issued-pass")
                        Text("Valid until \(ServerTime.short(issued.validUntil))").font(CarbonType.body).foregroundStyle(MedBrainsTheme.ink)
                        Text(name).font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
                    }
                    Button("Done") { dismiss() }.buttonStyle(.carbonPrimary).accessibilityIdentifier("issued-done")
                } else {
                    CarbonField("Visitor's name", isFocused: focus == "name") {
                        TextField("Name", text: $name).focused($focus, equals: "name").accessibilityIdentifier("field-visitor-name")
                    }
                    CarbonField("Phone", isFocused: focus == "phone") {
                        TextField("Phone", text: $phone).keyboardType(.phonePad).focused($focus, equals: "phone").accessibilityIdentifier("field-visitor-phone")
                    }
                    CarbonField("Relationship to the patient", isFocused: focus == "rel") {
                        TextField("Son, daughter, friend…", text: $relationship).focused($focus, equals: "rel").accessibilityIdentifier("field-visitor-relationship")
                    }
                    CarbonField("Purpose", isFocused: focus == "purpose") {
                        TextField("Why they are here", text: $purpose).focused($focus, equals: "purpose").accessibilityIdentifier("field-visitor-purpose")
                    }
                    CarbonField("Bed (optional)", isFocused: focus == "bed") {
                        TextField("Bed number", text: $bed).focused($focus, equals: "bed").accessibilityIdentifier("field-visitor-bed")
                    }
                    if let failure { CarbonNotification(kind: .error, title: "Not registered", message: failure) }
                    Button { Task { await register() } } label: { HStack { Text("Register and issue a pass"); Spacer(); Image(systemName: "arrow.right") } }
                        .buttonStyle(.carbonPrimary).disabled(busy || name.trimmingCharacters(in: .whitespaces).isEmpty)
                        .accessibilityIdentifier("visitor-submit")
                }
            }
            .padding(16)
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Register").navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-register-visitor")
        .onAppear { focus = "name" }
    }

    private func register() async {
        guard let client else { return }
        busy = true
        defer { busy = false }
        failure = nil
        let api = ReceptionApi(client: client)
        do {
            let visitor = try await api.registerVisitor(NewVisitorBody(
                visitorName: name.trimmingCharacters(in: .whitespaces),
                phone: phone.isEmpty ? nil : phone,
                relationship: relationship.isEmpty ? nil : relationship,
                purpose: purpose.isEmpty ? nil : purpose,
                patientId: patient?.id,
                category: "general"
            ))
            issued = try await api.issuePass(NewPassBody(registrationId: visitor.id, bedNumber: bed.isEmpty ? nil : bed, validHours: 4))
            UIAccessibility.post(notification: .announcement, argument: "Pass \(issued?.passNumber ?? "") issued for \(name).")
        } catch let e as ApiError {
            failure = e.message
        } catch {
            failure = "Could not reach the hospital server. Nothing was registered."
        }
    }
}
