import MedBrainsUI

// The token queue's wire names and timings, defined once. They mirror
// crates/medbrains-tokens; a value here that drifts from the server is a bug.

/// A queue's module, as the server names it.
enum TokenModule: String, Sendable {
    case opd
    case camp
}

/// What a token's `scope_id` points at.
enum TokenScope: String, Sendable {
    case department
    case counter
}

/// The worklist's `view` parameter.
enum WorklistView: String, Sendable {
    case mine
    case department
}

/// The token routes.
enum TokenRoute {
    static let worklist = "/api/tokens/worklist"
    static let callNext = "/api/tokens/call-next"
    static let campStations = "/api/tokens/camp-stations"

    enum Action: String {
        case call, serve, complete, finish
        case noShow = "no-show"
    }

    static func action(_ id: String, _ action: Action) -> String { "/api/tokens/\(id)/\(action.rawValue)" }
}

/// How often a screen re-reads the server while it is open.
enum QueuePolling {
    /// A queue a desk or station is working: a new arrival shows within one beat.
    static let queueSeconds: Double = 5
    /// The list of camp stations: a route started after the volunteer arrived
    /// appears without a restart.
    static let campStationsSeconds: Double = 15
}

/// A token's status as the server writes it.
enum TokenStatus {
    static let waiting = "waiting"
    static let called = "called"
    static let serving = "serving"
    static let completed = "completed"

    /// Someone is standing at the counter: the moment the actions apply.
    static func isWithStaff(_ status: String) -> Bool { status == called || status == serving }

    /// "no_show" → "no show", for a tag.
    static func label(_ status: String) -> String { status.replacingOccurrences(of: "_", with: " ") }
}

/// The colour a token status wears in a tag.
func tokenTone(_ status: String) -> CarbonTone {
    switch status {
    case TokenStatus.waiting: .warning
    case TokenStatus.called, TokenStatus.serving: .info
    case TokenStatus.completed: .success
    default: .neutral
    }
}

extension Array where Element == WorklistToken {
    /// How many rows are in `status` — the numbers on a queue's stat tiles and Call next.
    func count(in status: String) -> Int { filter { $0.status == status }.count }
}
