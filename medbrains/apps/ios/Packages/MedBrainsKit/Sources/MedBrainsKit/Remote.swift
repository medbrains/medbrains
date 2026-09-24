import Foundation

/// A value fetched from the server, with the three states a screen must tell
/// apart. `failed` is not `loaded([])`: an outage rendered as an empty ward
/// tells a nurse the ward is quiet, and the device-surface rules forbid it.
public enum RemoteState<T: Sendable>: Sendable {
    case loading
    case loaded(T)
    case failed(String)

    public var value: T? {
        if case .loaded(let v) = self { return v }
        return nil
    }
}

/// The fetch-once-and-refetch hook the React Native screens used, as an
/// observable. `poll` re-asks on a cadence for as long as the calling task
/// lives — attach it with `.task {}` and SwiftUI cancels it when the screen
/// leaves, so no timer outlives its screen.
@MainActor
@Observable
public final class Remote<T: Sendable> {
    public private(set) var state: RemoteState<T> = .loading
    /// Set when a refresh failed but an earlier answer is still shown; the
    /// screen says so instead of quietly going stale.
    public private(set) var staleSince: Date?

    public init() {}

    public var value: T? { state.value }

    public func load(_ op: @Sendable () async throws -> T) async {
        do {
            state = .loaded(try await op())
            staleSince = nil
        } catch {
            // Keep the last good answer if there is one; an alarm must not
            // clear because one poll dropped.
            if state.value != nil {
                if staleSince == nil { staleSince = Date() }
            } else {
                state = .failed(Self.describe(error))
            }
        }
    }

    public func poll(every seconds: Double, _ op: @Sendable @escaping () async throws -> T) async {
        while !Task.isCancelled {
            await load(op)
            try? await Task.sleep(for: .seconds(seconds))
        }
    }

    private static func describe(_ error: Error) -> String {
        if let api = error as? ApiError { return api.message }
        return "Could not reach the hospital server."
    }
}

/// The server writes RFC 3339 with fractional seconds, which Foundation's
/// plain `.iso8601` decoder refuses; timestamps travel as strings and are
/// parsed here when a screen needs arithmetic on them.
public enum ServerTime {
    private static let fractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let plain = ISO8601DateFormatter()

    public static func parse(_ text: String?) -> Date? {
        guard let text else { return nil }
        return fractional.date(from: text) ?? plain.date(from: text)
    }

    public static func format(_ date: Date) -> String {
        fractional.string(from: date)
    }

    /// "12 Sep, 14:05" — short enough for a row, in the device's locale.
    public static func short(_ text: String?) -> String {
        guard let date = parse(text) else { return "—" }
        return date.formatted(.dateTime.day().month(.abbreviated).hour().minute())
    }
}
