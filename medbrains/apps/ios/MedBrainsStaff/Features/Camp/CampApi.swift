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

/// The camp routes this module calls; the station queues themselves go
/// through `TokenApi` like every other queue.
enum CampEndpoint {
    static let registrations = "/api/camp/registrations"
}

struct CampApi: Sendable {
    let client: ApiClient

    func stations() async throws -> [CampStation] { try await client.request(.get, TokenRoute.campStations) }
    func register(_ body: CampRegistrationBody) async throws -> CampRegistered { try await client.request(.post, CampEndpoint.registrations, body: body) }
}
