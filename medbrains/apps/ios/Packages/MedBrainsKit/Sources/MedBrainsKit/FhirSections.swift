import Foundation

/// Reads an NRCeS FHIR document bundle (as another facility sent it through
/// ABDM) into sections a clinician can scan: diagnoses, medicines, results
/// with their units and ranges, and attached documents. The same reading as
/// the web (`apps/web/src/components/Patient/abdm/fhirSections.ts`). Bounded —
/// a bundle can carry thousands of resources; the screen shows the first few dozen.
public enum FhirSections {
    /// Sections and items shown per record.
    public static let maxSections = 20
    public static let maxItems = 50

    /// A document to open: a web link, or content sent inline.
    public enum Link: Equatable, Sendable {
        case web(URL, label: String)
        /// Base64 content, always saved as a file, never opened in place.
        case inline(base64: String, contentType: String, label: String, fileName: String)
    }

    public struct Item: Equatable, Sendable, Identifiable {
        /// The reference it was read from, with its position.
        public let key: String
        public let text: String
        public let detail: String?
        public let link: Link?
        public var id: String { key }
    }

    public struct Section: Equatable, Sendable, Identifiable {
        public let key: String
        public let title: String
        public let items: [Item]
        public var id: String { key }
    }

    public struct Document: Equatable, Sendable {
        public let title: String?
        public let date: String?
        public let author: String?
        public let sections: [Section]
    }

    /// The document's header and readable sections; an empty one for anything that is not a bundle.
    public static func read(_ bundle: JSONValue) -> Document {
        let byRef = index(bundle)
        let composition = list(bundle["entry"]).compactMap { $0["resource"] }.first { text($0["resourceType"]) == "Composition" }
        let author = byRef[text(list(composition?["author"]).first?["reference"]) ?? ""]
        let sections = list(composition?["section"]).prefix(maxSections).enumerated()
            .map { section($0.element, at: $0.offset, byRef) }
            .filter { !$0.items.isEmpty }
        return Document(
            title: text(composition?["title"]),
            date: text(composition?["date"]),
            author: text(list(author?["name"]).first?["text"]) ?? text(author?["name"]),
            sections: sections
        )
    }

    /// A CodeableConcept in words: its text, else its first coding's display.
    public static func concept(_ v: JSONValue?) -> String? {
        if let t = text(v?["text"]) { return t }
        return list(v?["coding"]).first.flatMap { text($0["display"]) ?? text($0["code"]) }
    }

    /// One resource as a line: what it is, and the detail that matters.
    public static func describe(_ r: JSONValue?, key: String = "") -> Item {
        let type = text(r?["resourceType"]) ?? "Entry"
        func item(_ text: String, _ detail: String? = nil, _ link: Link? = nil) -> Item {
            Item(key: key, text: text, detail: detail, link: link)
        }
        switch type {
        case "Observation":
            let value = quantity(r?["valueQuantity"]) ?? text(r?["valueString"]) ?? concept(r?["valueCodeableConcept"])
            let flag = concept(list(r?["interpretation"]).first)
            let detail = [range(r), flag].compactMap { $0 }.joined(separator: " · ")
            return item([concept(r?["code"]) ?? "Observation", value].compactMap { $0 }.joined(separator: ": "), detail.isEmpty ? nil : detail)
        case "MedicationRequest", "MedicationStatement":
            let dosage = present(r?["dosageInstruction"]) ?? r?["dosage"]
            return item(concept(r?["medicationCodeableConcept"]) ?? "Medicine", text(list(dosage).first?["text"]))
        case "DiagnosticReport":
            return item(concept(r?["code"]) ?? "Report", text(r?["conclusion"]))
        case "DocumentReference":
            let attachment = list(r?["content"]).first?["attachment"]
            return item(concept(r?["type"]) ?? text(attachment?["title"]) ?? "Document", nil, link(attachment))
        case "Binary":
            return item("Attached document", nil, link(url: nil, data: text(r?["data"]), contentType: text(r?["contentType"]), title: nil))
        case "Immunization":
            return item(concept(r?["vaccineCode"]) ?? "Immunisation", text(r?["occurrenceDateTime"]))
        default:
            return item(concept(r?["code"]) ?? type, concept(r?["clinicalStatus"]) ?? text(r?["recordedDate"]))
        }
    }

    // MARK: reading

    private static func text(_ v: JSONValue?) -> String? {
        if case .string(let s)? = v, !s.isEmpty { return s }
        return nil
    }

    private static func list(_ v: JSONValue?) -> [JSONValue] {
        if case .array(let a)? = v { return a }
        return []
    }

    /// JSON `null` reads as absent, as `??` does on the web.
    private static func present(_ v: JSONValue?) -> JSONValue? {
        v == .null ? nil : v
    }

    /// `12` not `12.0`: a number reads as the sender wrote it.
    private static func number(_ n: Double) -> String {
        n.rounded() == n && abs(n) < 1e15 ? String(Int64(n)) : String(n)
    }

    private static func quantity(_ v: JSONValue?) -> String? {
        guard case .number(let n)? = v?["value"] else { return nil }
        return [number(n), text(v?["unit"]) ?? text(v?["code"])].compactMap { $0 }.joined(separator: " ")
    }

    private static func range(_ r: JSONValue?) -> String? {
        let first = list(r?["referenceRange"]).first
        if let t = text(first?["text"]) { return "Range \(t)" }
        let low = quantity(first?["low"]), high = quantity(first?["high"])
        guard low != nil || high != nil else { return nil }
        return "Range \(low ?? "…") – \(high ?? "…")"
    }

    private static func link(_ a: JSONValue?) -> Link? {
        link(url: text(a?["url"]), data: text(a?["data"]), contentType: text(a?["contentType"]), title: text(a?["title"]))
    }

    /// Another facility's content: only web links open; anything else
    /// (`javascript:`, `file:`) is dropped. Inline data is always a file.
    private static func link(url: String?, data: String?, contentType: String?, title: String?) -> Link? {
        let label = title ?? "Open document"
        if let url, url.range(of: "^https?://", options: [.regularExpression, .caseInsensitive]) != nil, let parsed = URL(string: url) {
            return .web(parsed, label: label)
        }
        guard let data else { return nil }
        return .inline(base64: data, contentType: contentType ?? "application/octet-stream", label: label, fileName: title ?? "document")
    }

    /// Resources by every name a reference may use: fullUrl and `Type/id`.
    private static func index(_ bundle: JSONValue) -> [String: JSONValue] {
        var map: [String: JSONValue] = [:]
        for entry in list(bundle["entry"]) {
            let resource = entry["resource"] ?? .object([:])
            if let url = text(entry["fullUrl"]) { map[url] = resource }
            if let type = text(resource["resourceType"]), let id = text(resource["id"]) { map["\(type)/\(id)"] = resource }
        }
        return map
    }

    private static func section(_ raw: JSONValue, at position: Int, _ byRef: [String: JSONValue]) -> Section {
        let refs = list(raw["entry"]).prefix(maxItems).map { text($0["reference"]) ?? "" }.filter { byRef[$0] != nil }
        let items = refs.enumerated().map { describe(byRef[$0.element], key: "\($0.offset):\($0.element)") }
        let title = text(raw["title"]) ?? concept(raw["code"]) ?? "Section"
        return Section(key: "\(position):\(title)", title: title, items: items)
    }
}
