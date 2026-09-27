import Foundation
import MedBrainsKit

// The unified token queue (crates/medbrains-tokens) as every module reads and
// works it — the OPD doctor, the reception desk and the camp stations call
// the same routes, so they are written once here.

/// One row of the unified token queue with the patient behind it
/// (`/api/tokens/worklist`, gated on a clinical permission).
struct WorklistToken: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let number: String
    let seq: Int
    var status: String
    let priority: String
    let scopeLabel: String?
    var counterLabel: String?
    var calledAt: String?
    let createdAt: String
    let patientId: String?
    let patientName: String?
    let uhid: String?
    let encounterId: String?

    var displayName: String { patientName ?? "Unnamed patient" }
}

/// The token as a transition returns it; only what a screen merges back.
struct ModuleToken: Decodable, Sendable {
    let id: String
    let status: String
    let calledAt: String?
    let counterLabel: String?
}

/// Which part of a module's queue a screen reads and calls from. Never the
/// whole hospital: a large OPD runs past the server's 500-row page, and the
/// patient being looked for falls off the end of it.
enum QueueSlice: Hashable, Sendable {
    /// The doctor's own patients, then their departments' unassigned.
    case mine
    /// Everyone in the caller's departments.
    case myDepartments
    /// One department — a desk's.
    case department(String)
    /// One counter — a camp station.
    case counter(String)

    fileprivate var scope: (scope: TokenScope?, id: String?, view: WorklistView?) {
        switch self {
        case .mine: (nil, nil, .mine)
        case .myDepartments: (nil, nil, .department)
        case .department(let id): (.department, id, nil)
        case .counter(let id): (.counter, id, nil)
        }
    }

    fileprivate var queryItems: [URLQueryItem] {
        let s = scope
        return [
            s.scope.map { URLQueryItem(name: "scope", value: $0.rawValue) },
            s.id.map { URLQueryItem(name: "scope_id", value: $0) },
            s.view.map { URLQueryItem(name: "view", value: $0.rawValue) },
        ].compactMap { $0 }
    }
}

private struct CallBody: Encodable { let counterLabel: String? }
private struct CallNextBody: Encodable {
    let module: String
    let scope: String?
    let scopeId: String?
    let view: String?
    let counterLabel: String?
}

/// The token routes for one module's queue.
struct TokenApi: Sendable {
    let client: ApiClient
    let module: TokenModule

    func worklist(_ slice: QueueSlice) async throws -> [WorklistToken] {
        var url = URLComponents()
        url.queryItems = [URLQueryItem(name: "module", value: module.rawValue)] + slice.queryItems
        return try await client.request(.get, TokenRoute.worklist + (url.percentEncodedQuery.map { "?\($0)" } ?? ""))
    }

    /// Call whoever is next in `slice` and let the server decide who that is,
    /// under its lock. `nil` is a real answer: nobody is waiting.
    func callNext(_ slice: QueueSlice, counterLabel: String? = nil) async throws -> ModuleToken? {
        let s = slice.scope
        let body = CallNextBody(module: module.rawValue, scope: s.scope?.rawValue, scopeId: s.id, view: s.view?.rawValue, counterLabel: counterLabel)
        return try await client.request(.post, TokenRoute.callNext, body: body, as: ModuleToken?.self)
    }

    func call(_ id: String, counterLabel: String? = nil) async throws -> ModuleToken {
        try await client.request(.post, TokenRoute.action(id, .call), body: CallBody(counterLabel: counterLabel))
    }
    func serve(_ id: String) async throws -> ModuleToken { try await client.request(.post, TokenRoute.action(id, .serve)) }
    /// Done here — a camp patient goes on to the next station.
    func complete(_ id: String) async throws -> ModuleToken { try await client.request(.post, TokenRoute.action(id, .complete)) }
    /// Done, and needs no further station — no medicine, so no pharmacy queue.
    func finish(_ id: String) async throws -> ModuleToken { try await client.request(.post, TokenRoute.action(id, .finish)) }
    func noShow(_ id: String) async throws -> ModuleToken { try await client.request(.post, TokenRoute.action(id, .noShow)) }
}
