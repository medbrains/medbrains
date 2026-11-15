import Foundation

/// The hospital's locale profile as `/api/auth/me` serves it
/// (RFC-WORLD-READY §2.3): resolved user › facility › hospital › country pack
/// on the server, so the app never picks a locale, currency or zone itself.
public struct LocaleProfile: Codable, Equatable, Sendable {
    /// The profile fields the formatters read. A field nobody set is nil and
    /// is named in `missing`; it renders neutrally, never as a guess.
    public struct Values: Codable, Equatable, Sendable {
        public var country: String?
        public var currency: String?
        public var locale: String?
        public var timezone: String?
        public var hourCycle: String?
        public var nameOrder: String?
        public var calendars: Calendars?

        public init(country: String? = nil, currency: String? = nil, locale: String? = nil, timezone: String? = nil,
                    hourCycle: String? = nil, nameOrder: String? = nil, calendars: Calendars? = nil) {
            self.country = country
            self.currency = currency
            self.locale = locale
            self.timezone = timezone
            self.hourCycle = hourCycle
            self.nameOrder = nameOrder
            self.calendars = calendars
        }
    }

    /// Gregorian always; `also` are shown beside it (Hijri in the Gulf).
    public struct Calendars: Codable, Equatable, Sendable {
        public var primary: String
        public var also: [String]
    }

    public var pack: String
    public var values: Values
    public var missing: [String]

    public init(pack: String, values: Values, missing: [String] = []) {
        self.pack = pack
        self.values = values
        self.missing = missing
    }

    /// What the formatters use before any profile has ever loaded on this
    /// device: the bare number, UTC labelled, English digits.
    public static let neutral = LocaleProfile(pack: "world", values: Values(), missing: ["country", "currency", "timezone"])
}

/// Where the profile on screen came from, so a screen can say so.
public enum LocaleProfileState: Equatable, Sendable {
    case loading
    /// Fresh from the server this session.
    case ready
    /// The server could not be reached or answered no profile: the last one
    /// this device saw is shown, and the screen says it may be stale.
    case lastGood
    /// Never loaded on this device: neutral rendering, said on screen.
    case unavailable
}

/// The profile for the signed-in hospital, kept as last-good per tenant so
/// an offline ward still shows its own money and clock (RFC §2.3).
@MainActor
@Observable
public final class LocaleProfileStore {
    public private(set) var profile: LocaleProfile = .neutral
    public private(set) var state: LocaleProfileState = .loading

    private let defaults: UserDefaults

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    private static func key(_ tenantId: String) -> String { "medbrains.locale_profile.\(tenantId)" }

    private struct Me: Decodable { let localeProfile: LocaleProfile? }

    /// Fetch the profile; on any failure fall back to the last good one.
    public func refresh(client: ApiClient, tenantId: String) async {
        do {
            let me: Me = try await client.request(.get, "/api/auth/me")
            guard let fresh = me.localeProfile else { return useLastGood(tenantId) }
            adopt(fresh, tenantId: tenantId)
        } catch {
            useLastGood(tenantId)
        }
    }

    /// A profile the server sent: shown and saved as this tenant's last good.
    public func adopt(_ fresh: LocaleProfile, tenantId: String) {
        profile = fresh
        state = .ready
        if let data = try? JSONEncoder().encode(fresh) {
            defaults.set(data, forKey: Self.key(tenantId))
        }
    }

    /// The saved profile for this tenant, else neutral; the state says which.
    public func useLastGood(_ tenantId: String) {
        if let data = defaults.data(forKey: Self.key(tenantId)),
           let saved = try? JSONDecoder().decode(LocaleProfile.self, from: data) {
            profile = saved
            state = .lastGood
        } else {
            profile = .neutral
            state = .unavailable
        }
    }
}
