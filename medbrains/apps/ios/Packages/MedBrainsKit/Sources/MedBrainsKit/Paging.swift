import Foundation

/// One page of a server list, and how many rows the server counted in all.
public struct ListPage<Row: Sendable>: Sendable {
    public let rows: [Row]
    public let total: Int

    public init(rows: [Row], total: Int) {
        self.rows = rows
        self.total = total
    }
}

/// The rows gathered across pages and the server's total, so a screen can say
/// "Showing N of M" instead of stopping silently at the first page.
public struct PagedRows<Row: Sendable>: Sendable {
    public let rows: [Row]
    public let total: Int

    /// False when the page cap stopped the walk before every row was read.
    public var isComplete: Bool { rows.count >= total }
}

/// Reads pages 1, 2, … until the server's total is reached, a page comes back
/// empty, or `maxPages` have been read. The cap bounds the walk on a huge list;
/// `PagedRows.isComplete` tells the screen it was hit. A row seen on an earlier
/// page is dropped: an admission between two reads shifts the offset and repeats
/// a row, and a list with one id twice draws the wrong rows.
public func fetchAllPages<Row: Sendable & Identifiable>(
    maxPages: Int, _ fetch: (Int) async throws -> ListPage<Row>
) async throws -> PagedRows<Row> {
    var rows: [Row] = []
    var seen = Set<Row.ID>()
    var total = 0
    for page in 1...max(maxPages, 1) {
        let next = try await fetch(page)
        rows += next.rows.filter { seen.insert($0.id).inserted }
        total = next.total
        if next.rows.isEmpty || rows.count >= total { break }
    }
    return PagedRows(rows: rows, total: max(total, rows.count))
}

/// True when every word of `query` appears in one of `fields`, ignoring case and
/// accents; a blank query matches everything. For narrowing a loaded worklist.
public func matchesSearch(_ query: String, in fields: [String?]) -> Bool {
    let haystack = fields.compactMap { $0 }.joined(separator: " ")
    return query.split(whereSeparator: \.isWhitespace).allSatisfy {
        haystack.range(of: $0, options: [.caseInsensitive, .diacriticInsensitive]) != nil
    }
}
