import MedBrainsKit
import MedBrainsUI
import SwiftUI

struct EnquiryRow: Decodable, Hashable, Identifiable, Sendable {
    let id: String
    let callerName: String?
    let callerPhone: String?
    let enquiryType: String
    let responseText: String?
    let resolved: Bool
    let createdAt: String
}

struct NewEnquiryBody: Encodable {
    let callerName: String?
    let callerPhone: String?
    let enquiryType: String
    let responseText: String?
}

extension ReceptionApi {
    func enquiries() async throws -> [EnquiryRow] { try await client.request(.get, "/api/front-office/enquiries") }
    func logEnquiry(_ body: NewEnquiryBody) async throws -> EnquiryRow { try await client.request(.post, "/api/front-office/enquiries", body: body) }
    func resolveEnquiry(_ id: String) async throws -> EnquiryRow { try await client.request(.put, "/api/front-office/enquiries/\(id)/resolve") }
}

/// What the desk was asked and what it said back. Open first: a question
/// nobody answered is the only thing here that needs doing.
struct EnquiryDeskView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.apiClient) private var client
    @State private var remote = Remote<[EnquiryRow]>()
    @State private var busyId: String?
    @State private var failure: String?

    var body: some View {
        let rows = remote.value ?? []
        let open = rows.filter { !$0.resolved }
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                CarbonPageHeader(eyebrow: "Reception", title: "Enquiry desk", subtitle: "Calls and callers at the front door.")
                HStack(spacing: 1) {
                    StatTile(eyebrow: "Open", count: open.count, title: "Waiting on an answer")
                    StatTile(eyebrow: "Logged", count: rows.count, title: "Enquiries today")
                }
                .padding(.horizontal, 16)
                let canLog = auth.identity?.can("front_office.enquiry.create") ?? false
                if canLog {
                    NavigationLink(value: ReceptionRoute.logEnquiry) {
                        HStack { Text("Log an enquiry"); Spacer(); Image(systemName: "square.and.pencil") }
                    }
                    .buttonStyle(.carbonPrimary).padding(16)
                    .accessibilityIdentifier("enquiry-log")
                } else {
                    Text("This account can read the enquiry desk but not log or resolve. Ask an administrator for front_office.enquiry.create.")
                        .font(CarbonType.helper).foregroundStyle(MedBrainsTheme.inkSecondary).padding(16)
                        .accessibilityIdentifier("enquiry-read-only")
                }
                if let failure { CarbonNotification(kind: .error, title: "Not recorded", message: failure).padding(.horizontal, 16) }
                RemoteContentView(id: "enquiries", state: remote.state, unavailableTitle: "Couldn't load the enquiries", unavailableMessage: "The hospital server did not answer. Do not read this as a quiet desk.", isEmpty: \.isEmpty, emptyTitle: "No enquiries yet", emptyMessage: "Nothing has been logged at this desk today.", retry: { Task { await load() } }) { rows in
                    LazyVStack(spacing: 1) {
                        ForEach(rows.sorted { !$0.resolved && $1.resolved }) { enquiry in
                            row(enquiry)
                        }
                    }
                    .padding(.horizontal, 16)
                }
            }
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Enquiries").navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-enquiry-desk")
        .task { await load() }
    }

    @ViewBuilder
    private func row(_ enquiry: EnquiryRow) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            CarbonRow(enquiry.callerName ?? "Caller not named", detail: [enquiry.enquiryType, enquiry.callerPhone].compactMap { $0 }.joined(separator: " · ")) {
                CarbonTag(enquiry.resolved ? "resolved" : "open", tone: enquiry.resolved ? .success : .warning)
            }
            .accessibilityIdentifier("enquiry-row-\(enquiry.id)")
            if let said = enquiry.responseText, !said.isEmpty {
                Text(said).font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
                    .accessibilityIdentifier("enquiry-said-\(enquiry.id)")
            }
            if !enquiry.resolved, auth.identity?.can("front_office.enquiry.manage") ?? false {
                Button("Resolve") { Task { await resolve(enquiry) } }
                    .buttonStyle(.carbonTertiary).disabled(busyId != nil)
                    .accessibilityIdentifier("enquiry-resolve-\(enquiry.id)")
                    .padding(.bottom, 8)
            }
        }
    }

    private func load() async {
        guard let client else { return }
        await remote.load { try await ReceptionApi(client: client).enquiries() }
    }

    private func resolve(_ enquiry: EnquiryRow) async {
        guard let client else { return }
        busyId = enquiry.id
        defer { busyId = nil }
        failure = nil
        do {
            _ = try await ReceptionApi(client: client).resolveEnquiry(enquiry.id)
            await load()
        } catch let e as ApiError {
            failure = e.message
        } catch {
            failure = "Could not reach the hospital server. Nothing was recorded."
        }
    }
}

/// What was asked, and what the desk told them. The answer is typed at the
/// time, because "resolved" with no words tells the next shift nothing.
struct LogEnquiryView: View {
    @Environment(\.apiClient) private var client
    @Environment(\.dismiss) private var dismiss
    @State private var caller = ""
    @State private var phone = ""
    @State private var type = "general"
    @State private var said = ""
    @State private var busy = false
    @State private var failure: String?
    @FocusState private var focus: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                CarbonPageHeader(eyebrow: "Enquiry desk", title: "Log an enquiry", subtitle: "Who asked, and what they were told.")
                CarbonField("Caller's name", isFocused: focus == "caller") {
                    TextField("Name", text: $caller).focused($focus, equals: "caller").accessibilityIdentifier("field-caller-name")
                }
                CarbonField("Phone", isFocused: focus == "phone") {
                    TextField("Phone", text: $phone).keyboardType(.phonePad).focused($focus, equals: "phone").accessibilityIdentifier("field-caller-phone")
                }
                VStack(alignment: .leading, spacing: 8) {
                    Text("What about").font(CarbonType.label).foregroundStyle(MedBrainsTheme.inkSecondary)
                    Picker("What about", selection: $type) {
                        Text("General").tag("general")
                        Text("A patient").tag("patient")
                        Text("Billing").tag("billing")
                        Text("Directions").tag("directions")
                    }
                    .pickerStyle(.segmented).accessibilityIdentifier("field-enquiry-type")
                }
                CarbonField("What they were told", isFocused: focus == "said") {
                    TextField("The answer given", text: $said, axis: .vertical).lineLimit(2...5).focused($focus, equals: "said")
                        .accessibilityIdentifier("field-enquiry-response")
                }
                if let failure { CarbonNotification(kind: .error, title: "Not logged", message: failure) }
                Button { Task { await log() } } label: { HStack { Text("Log the enquiry"); Spacer(); Image(systemName: "arrow.right") } }
                    .buttonStyle(.carbonPrimary).disabled(busy || said.trimmingCharacters(in: .whitespaces).isEmpty)
                    .accessibilityIdentifier("enquiry-submit")
            }
            .padding(16)
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Log").navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-log-enquiry")
        .onAppear { focus = "caller" }
    }

    private func log() async {
        guard let client else { return }
        busy = true
        defer { busy = false }
        failure = nil
        do {
            _ = try await ReceptionApi(client: client).logEnquiry(NewEnquiryBody(
                callerName: caller.isEmpty ? nil : caller,
                callerPhone: phone.isEmpty ? nil : phone,
                enquiryType: type,
                responseText: said.trimmingCharacters(in: .whitespaces)
            ))
            dismiss()
        } catch let e as ApiError {
            failure = e.message
        } catch {
            failure = "Could not reach the hospital server. Nothing was logged."
        }
    }
}
