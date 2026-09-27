import Foundation
import MedBrainsKit

/// A code chosen from a terminology search, as `/api/terminology/search` answers.
struct TerminologyHit: Decodable, Hashable, Identifiable, Sendable {
    let code: String
    let display: String
    let sourceUrl: String?
    let sourceVersion: String?
    let providerMode: String

    var id: String { code }
}

private struct DrugRow: Decodable, Sendable {
    let name: String
    let genericName: String?
}

/// The searches a catalogue field can run while the desk types: a
/// terminology (ICD-11) and the drug formulary (for allergies). Read-only
/// lookups, gated on their own codes (`terminology.search`,
/// `pharmacy.catalog.lookup`).
struct CatalogueLookups: Sendable {
    let client: ApiClient

    /// The fewest characters worth sending: one letter matches half a terminology.
    static let minimumQuery = 2
    static let limit = 10
    /// Typing settles before asking: one request per pause, not per key.
    static let debounce: Duration = .milliseconds(300)

    private func encoded(_ q: String) -> String { q.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? q }

    func icd11(_ q: String) async throws -> [TerminologyHit] {
        try await client.request(.get, "/api/terminology/search?system=icd11&q=\(encoded(q))&limit=\(Self.limit)")
    }

    /// Drug names for an allergy list: the brand, and its generic when it has one.
    func drugs(_ q: String) async throws -> [String] {
        let rows: [DrugRow] = try await client.request(.get, "/api/pharmacy/catalog?search=\(encoded(q))")
        return Array(rows.map { row in [row.name, row.genericName].compactMap { $0 }.joined(separator: " — ") }.prefix(Self.limit))
    }
}
