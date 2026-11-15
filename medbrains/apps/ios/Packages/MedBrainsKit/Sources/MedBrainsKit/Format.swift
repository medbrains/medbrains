import Foundation

/// The one set of money, number, date and time formatters on iOS
/// (RFC-WORLD-READY §4.1), over Foundation's CLDR data. Each takes the
/// hospital's profile, so no view picks a locale, currency or zone.
///
/// Neutral rendering: no currency shows the bare number; no zone shows UTC
/// and says "UTC". Never a guessed country.
public enum Format {
    private static let utc = TimeZone(identifier: "UTC") ?? .gmt
    /// Most decimals a stored amount carries (money columns are `numeric(_,4)`).
    private static let maxDecimals = 4

    private static func locale(_ p: LocaleProfile) -> Locale {
        Locale(identifier: p.values.locale ?? "en")
    }

    private static func zone(_ p: LocaleProfile) -> TimeZone {
        p.values.timezone.flatMap(TimeZone.init(identifier:)) ?? utc
    }

    private static func zoneLabel(_ p: LocaleProfile) -> String {
        p.values.timezone == nil ? " UTC" : ""
    }

    /// The decimals an amount carries, so a bill never hides the paisa it was charged.
    private static func decimals(in amount: Decimal) -> Int {
        min(max(-amount.exponent, 0), maxDecimals)
    }

    /// Money in the hospital's currency with its minor units (KWD 3, JPY 0),
    /// exact: `Decimal`, never a float.
    public static func money(_ amount: Decimal, _ p: LocaleProfile) -> String {
        guard let code = p.values.currency else {
            return amount.formatted(.number.locale(locale(p)).precision(.fractionLength(2...max(2, decimals(in: amount)))))
        }
        let style = Decimal.FormatStyle.Currency(code: code, locale: locale(p))
        let minor = minorUnits(code, locale(p))
        return amount.formatted(style.precision(.fractionLength(minor...max(minor, decimals(in: amount)))))
    }

    /// Money from the API's decimal string; nil when it is not a number.
    public static func money(_ amount: String, _ p: LocaleProfile) -> String? {
        Decimal(string: amount, locale: Locale(identifier: "en_US_POSIX")).map { money($0, p) }
    }

    /// The currency's own fraction digits as the locale's CLDR data has them.
    private static func minorUnits(_ code: String, _ loc: Locale) -> Int {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.locale = loc
        f.currencyCode = code
        return f.minimumFractionDigits
    }

    /// A plain number grouped as the locale groups (12,34,567 in en-IN).
    public static func number(_ value: Decimal, _ p: LocaleProfile) -> String {
        value.formatted(.number.locale(locale(p)))
    }

    private static func style(_ p: LocaleProfile, date: Bool, time: Bool) -> Date.FormatStyle {
        var s = Date.FormatStyle(locale: locale(p), timeZone: zone(p))
        if date { s = s.year().month(.abbreviated).day() }
        if time {
            s = p.values.hourCycle == "h23"
                ? s.hour(.twoDigits(amPM: .omitted)).minute()
                : s.hour(.twoDigits(amPM: .abbreviated)).minute()
        }
        return s
    }

    /// An instant as a date in the facility's zone.
    public static func date(_ value: Date, _ p: LocaleProfile) -> String {
        value.formatted(style(p, date: true, time: false))
    }

    /// An instant as date and time in the facility's zone, never the device's.
    public static func dateTime(_ value: Date, _ p: LocaleProfile) -> String {
        value.formatted(style(p, date: true, time: true)) + zoneLabel(p)
    }

    /// An instant as a time of day in the facility's zone.
    public static func time(_ value: Date, _ p: LocaleProfile) -> String {
        value.formatted(style(p, date: false, time: true)) + zoneLabel(p)
    }

    /// The instant in each display calendar the profile adds (Hijri beside Gregorian).
    public static func dateAlso(_ value: Date, _ p: LocaleProfile) -> [String] {
        (p.values.calendars?.also ?? []).compactMap { id in
            guard let calendar = calendar(id) else { return nil }
            var s = style(p, date: true, time: false)
            s.calendar = Calendar(identifier: calendar)
            return value.formatted(s)
        }
    }

    /// The CLDR calendar ids the profile allows, as Foundation's.
    private static func calendar(_ id: String) -> Calendar.Identifier? {
        switch id {
        case "islamic-umalqura": .islamicUmmAlQura
        case "islamic-civil": .islamicCivil
        case "persian": .persian
        case "buddhist": .buddhist
        case "hebrew": .hebrew
        case "indian": .indian
        case "ethiopic": .ethiopicAmeteMihret
        case "japanese": .japanese
        default: nil
        }
    }

    /// A person's name from its parts in the profile's order; empty parts dropped.
    public static func name(given: String?, middle: String? = nil, family: String?, _ p: LocaleProfile) -> String {
        let ordered = p.values.nameOrder == "family_given" ? [family, given, middle] : [given, middle, family]
        return ordered.compactMap { $0?.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }.joined(separator: " ")
    }
}
