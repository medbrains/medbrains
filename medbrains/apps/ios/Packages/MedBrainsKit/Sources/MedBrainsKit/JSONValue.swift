import Foundation

/// Any JSON, for a body another layer has already built — the shared core's
/// registration request, for one. Encodes exactly what it decoded: keys are
/// sent as they are, never re-cased.
public enum JSONValue: Codable, Sendable, Equatable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    /// Parses `text`; nil when it is not JSON.
    public init?(parsing text: String) {
        guard let value = try? JSONDecoder().decode(JSONValue.self, from: Data(text.utf8)) else { return nil }
        self = value
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let b = try? c.decode(Bool.self) { self = .bool(b) }
        else if let n = try? c.decode(Double.self) { self = .number(n) }
        else if let s = try? c.decode(String.self) { self = .string(s) }
        else if let a = try? c.decode([JSONValue].self) { self = .array(a) }
        else { self = .object(try c.decode([String: JSONValue].self)) }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .string(let s): try c.encode(s)
        case .number(let n): try c.encode(n)
        case .bool(let b): try c.encode(b)
        case .object(let o): try c.encode(o)
        case .array(let a): try c.encode(a)
        case .null: try c.encodeNil()
        }
    }

    /// This object with `value` at `key` (a non-object is returned unchanged).
    public func setting(_ key: String, to value: JSONValue) -> JSONValue {
        guard case .object(var o) = self else { return self }
        o[key] = value
        return .object(o)
    }

    /// The member `key` of an object, or nil.
    public subscript(key: String) -> JSONValue? {
        guard case .object(let o) = self else { return nil }
        return o[key]
    }
}
