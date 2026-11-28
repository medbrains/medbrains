import XCTest

@testable import MedBrainsKit

/// A worklist reads every page the server has, says when it stopped short, and
/// narrows by any word the nurse types.
final class PagingTests: XCTestCase {
    /// A row with only an id, as the pager sees one.
    private struct Row: Identifiable, Equatable, Sendable { let id: Int }

    /// A server holding `total` numbered rows, served `perPage` at a time.
    private func server(total: Int, perPage: Int) -> (Int) async throws -> ListPage<Row> {
        { page in
            let start = (page - 1) * perPage
            return ListPage(rows: (start..<min(start + perPage, total)).map(Row.init), total: total)
        }
    }

    func testEveryPageIsReadUntilTheTotal() async throws {
        let paged = try await fetchAllPages(maxPages: 10, server(total: 250, perPage: 100))
        XCTAssertEqual(paged.rows.count, 250)
        XCTAssertEqual(paged.total, 250)
        XCTAssertTrue(paged.isComplete)
    }

    func testThePageCapStopsTheWalkAndSaysSo() async throws {
        let paged = try await fetchAllPages(maxPages: 2, server(total: 250, perPage: 100))
        XCTAssertEqual(paged.rows.count, 200)
        XCTAssertEqual(paged.total, 250)
        XCTAssertFalse(paged.isComplete)
    }

    func testAnEmptyPageEndsTheWalkEvenIfTheTotalPromisedMore() async throws {
        var calls = 0
        let paged = try await fetchAllPages(maxPages: 10) { page -> ListPage<Row> in
            calls += 1
            return ListPage(rows: page == 1 ? [Row(id: 1), Row(id: 2)] : [], total: 5)
        }
        XCTAssertEqual(calls, 2)
        XCTAssertEqual(paged.rows, [Row(id: 1), Row(id: 2)])
    }

    func testARowRepeatedOnTheNextPageIsKeptOnce() async throws {
        // Someone admitted between the two reads pushes row 1 onto page 2 as well.
        let paged = try await fetchAllPages(maxPages: 10) { page -> ListPage<Row> in
            ListPage(rows: page == 1 ? [Row(id: 0), Row(id: 1)] : [Row(id: 1), Row(id: 2)], total: 3)
        }
        XCTAssertEqual(paged.rows.map(\.id), [0, 1, 2])
    }

    func testAFailedPageFailsTheWholeListRatherThanShowingPart() async {
        struct Down: Error {}
        do {
            _ = try await fetchAllPages(maxPages: 10) { page -> ListPage<Row> in
                if page == 2 { throw Down() }
                return ListPage(rows: (0..<100).map(Row.init), total: 150)
            }
            XCTFail("a failed page must not pass as a shorter list")
        } catch {}
    }

    func testSearchMatchesEveryWordAcrossFieldsIgnoringCaseAndAccents() {
        let fields = ["Renée Kumar", "MB-000123", "IP-000045", "B-12"]
        XCTAssertTrue(matchesSearch("", in: fields))
        XCTAssertTrue(matchesSearch("renee b-12", in: fields))
        XCTAssertTrue(matchesSearch("ip-000045", in: fields))
        XCTAssertFalse(matchesSearch("renee b-13", in: fields))
        XCTAssertTrue(matchesSearch("kumar", in: [nil, "Renée Kumar"]))
    }
}
