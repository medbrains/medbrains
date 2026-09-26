import Foundation
import MedBrainsKit

// Wire shapes mirror crates/medbrains-tokens/src/station_flow.rs and
// crates/medbrains-camp (RFCs/modules/RFC-MODULE-token-queues.md, P4).

/// One step of a running camp's route: its queue lives at `counterId`, and
/// every room in `rooms` calls from it.
struct CampStation: Decodable, Hashable, Identifiable, Sendable {
    let counterId: String
    let campId: String
    let campName: String
    let name: String
    let flowPosition: Int
    let rooms: [String]

    var id: String { counterId }
    var label: String { "\(flowPosition). \(name)" }
}

struct CampRegistrationBody: Encodable {
    let campId: String
    let personName: String
    let age: Int?
    let gender: String?
    let phone: String?
    let isWalkIn: Bool
}

/// The registration and the number the patient keeps to the last station.
/// `tokenNumber` is nil only for a camp with no route of stations.
struct CampRegistered: Decodable, Sendable {
    let id: String
    let tokenNumber: String?
}

private struct StationCallNext: Encodable {
    let counterLabel: String?
    let module = "camp"
    let scope = "counter"
    let scopeId: String
}

struct CampApi: Sendable {
    let client: ApiClient

    func stations() async throws -> [CampStation] { try await client.request(.get, "/api/tokens/camp-stations") }
    func queue(_ station: CampStation) async throws -> [WorklistToken] {
        try await client.request(.get, "/api/tokens/worklist?module=camp&scope=counter&scope_id=\(station.counterId)")
    }
    /// The server picks who is next under its lock; `nil` means nobody waits.
    func callNext(_ station: CampStation, room: String) async throws -> ModuleToken? {
        try await client.request(.post, "/api/tokens/call-next", body: StationCallNext(counterLabel: room, scopeId: station.counterId), as: ModuleToken?.self)
    }
    /// Done here — the patient goes on to the next station.
    func complete(_ id: String) async throws -> ModuleToken { try await client.request(.post, "/api/tokens/\(id)/complete") }
    /// Done, and needs no further station — no medicine, so no pharmacy queue.
    func finish(_ id: String) async throws -> ModuleToken { try await client.request(.post, "/api/tokens/\(id)/finish") }
    func noShow(_ id: String) async throws -> ModuleToken { try await client.request(.post, "/api/tokens/\(id)/no-show") }
    func register(_ body: CampRegistrationBody) async throws -> CampRegistered { try await client.request(.post, "/api/camp/registrations", body: body) }
}
