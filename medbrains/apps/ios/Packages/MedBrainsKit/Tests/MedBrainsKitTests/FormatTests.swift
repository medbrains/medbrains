import XCTest
@testable import MedBrainsKit

/// Goldens for the six locales #5926 names, through Foundation's CLDR data.
/// Each prints what a hospital in that country reads; a change in output is a
/// change a hospital would see.
final class FormatTests: XCTestCase {
    private func profile(_ locale: String, _ currency: String?, _ zone: String?, h23: Bool = false) -> LocaleProfile {
        LocaleProfile(pack: "world", values: .init(currency: currency, locale: locale, timezone: zone, hourCycle: h23 ? "h23" : "h12"))
    }

    private let instant = ISO8601DateFormatter().date(from: "2026-03-05T18:30:00Z")!

    /// Spaces vary by platform release (NBSP, narrow NBSP); compare without them.
    private func squash(_ s: String) -> String {
        s.unicodeScalars.filter { !CharacterSet.whitespaces.contains($0) && $0 != "\u{200F}" && $0 != "\u{200E}" }.map(String.init).joined()
    }

    func testMoneyInEachLocale() throws {
        let cases: [(String, String, String)] = [
            ("en-IN", "INR", "₹12,34,567.50"),
            ("en-US", "USD", "$1,234,567.50"),
            ("de-DE", "EUR", "1.234.567,50€"),
            ("fr-FR", "EUR", "1234567,50€"),
            ("id-ID", "IDR", "Rp1.234.567,5"),
        ]
        for (loc, cur, expected) in cases {
            let got = try XCTUnwrap(Format.money("1234567.50", profile(loc, cur, "UTC")))
            XCTAssertEqual(squash(got), expected, loc)
        }
        let ae = try XCTUnwrap(Format.money("1234567.50", profile("ar-AE", "AED", "Asia/Dubai")))
        XCTAssertTrue(ae.contains("1,234,567.50") || ae.contains("١٬٢٣٤٬٥٦٧٫٥٠"), ae)
        XCTAssertTrue(ae.contains("د.إ"), ae)
    }

    func testMinorUnitsAndExactDecimals() throws {
        let kuwait = profile("en", "KWD", nil)
        XCTAssertEqual(squash(try XCTUnwrap(Format.money("12.5", kuwait))), "KWD12.500")
        XCTAssertEqual(squash(try XCTUnwrap(Format.money("0.1234", kuwait))), "KWD0.1234")
        XCTAssertNil(Format.money("twelve", kuwait))
    }

    func testNoCurrencyShowsTheBareNumber() throws {
        XCTAssertEqual(try XCTUnwrap(Format.money("1500", profile("en-IN", nil, nil))), "1,500.00")
    }

    func testDateTimeInTheFacilitysZone() {
        XCTAssertTrue(squash(Format.dateTime(instant, profile("en-IN", nil, "Asia/Kolkata"))).contains("12:00"))
        XCTAssertTrue(Format.dateTime(instant, profile("en-IN", nil, "Asia/Kolkata")).contains("6"))
        XCTAssertTrue(Format.dateTime(instant, profile("de-DE", nil, "Europe/Berlin", h23: true)).contains("19:30"))
        XCTAssertTrue(Format.dateTime(instant, profile("fr-FR", nil, "Europe/Paris", h23: true)).contains("19:30"))
        XCTAssertTrue(Format.dateTime(instant, profile("en-US", nil, "America/New_York")).contains("01:30"))
        XCTAssertTrue(squash(Format.dateTime(instant, profile("id-ID", nil, "Asia/Jakarta", h23: true))).contains("01.30"))
        let ae = Format.dateTime(instant, profile("ar-AE", nil, "Asia/Dubai"))
        XCTAssertTrue(ae.contains("10:30") || ae.contains("١٠:٣٠"), ae)
    }

    func testNoZoneSaysUTC() {
        XCTAssertTrue(Format.time(instant, profile("en-GB", nil, nil, h23: true)).hasSuffix(" UTC"))
        XCTAssertTrue(Format.time(instant, profile("en-GB", nil, nil, h23: true)).contains("18:30"))
    }

    func testHijriBesideGregorian() {
        var dubai = profile("ar-AE", "AED", "Asia/Dubai")
        dubai.values.calendars = .init(primary: "gregory", also: ["islamic-umalqura"])
        let also = Format.dateAlso(instant, dubai)
        XCTAssertEqual(also.count, 1)
        XCTAssertTrue(also[0].contains("1447") || also[0].contains("١٤٤٧"), also[0])
        XCTAssertEqual(Format.dateAlso(instant, profile("en-IN", "INR", "Asia/Kolkata")), [])
    }

    func testNameOrder() {
        var p = profile("ja-JP", "JPY", "Asia/Tokyo")
        XCTAssertEqual(Format.name(given: "Mei", family: "Tanaka", p), "Mei Tanaka")
        p.values.nameOrder = "family_given"
        XCTAssertEqual(Format.name(given: "Mei", family: "Tanaka", p), "Tanaka Mei")
    }

    @MainActor
    func testLastGoodProfileIsKeptPerTenant() throws {
        let defaults = try XCTUnwrap(UserDefaults(suiteName: "FormatTests.\(UUID())"))
        let store = LocaleProfileStore(defaults: defaults)
        store.useLastGood("t1")
        XCTAssertEqual(store.state, .unavailable)
        XCTAssertEqual(store.profile, .neutral)
        let dubai = profile("ar-AE", "AED", "Asia/Dubai")
        store.adopt(dubai, tenantId: "t1")
        let later = LocaleProfileStore(defaults: defaults)
        later.useLastGood("t1")
        XCTAssertEqual(later.state, .lastGood)
        XCTAssertEqual(later.profile, dubai)
        later.useLastGood("t2")
        XCTAssertEqual(later.state, .unavailable, "another hospital's profile is never borrowed")
    }

    func testDecodesTheServersSnakeCase() throws {
        let json = #"{"locale_profile":{"pack":"in","values":{"currency":"INR","locale":"en-IN","timezone":"Asia/Kolkata","hour_cycle":"h12","fiscal_year_start":4,"languages":["en"]},"sources":{"currency":"hospital"},"missing":[],"units":{},"date_format":null}}"#
        struct Me: Decodable { let localeProfile: LocaleProfile? }
        let me = try JSONDecoder.medbrains.decode(Me.self, from: Data(json.utf8))
        XCTAssertEqual(me.localeProfile?.values.hourCycle, "h12")
        XCTAssertEqual(me.localeProfile?.pack, "in")
    }
}
