import Foundation
import MedBrainsKit

/// The consultation note as the handheld writes it: the four prose fields
/// and the findings at a site. The note keeps them as sections — subjective
/// (chief complaint), objective (examination), assessment, plan, and the
/// examination record — the same places the web's case sheet writes.
struct ConsultationDraft: Equatable {
    var chief = ""
    var exam = ""
    var assessment = ""
    var plan = ""
    var findings: [ExamFinding] = []

    init() {}

    init(_ note: Note) {
        let text = { (code: String) in plainText(note.sections.first { $0.code == code }?.text ?? "") }
        chief = text("subjective")
        exam = text("objective")
        assessment = text("assessment")
        plan = text("plan")
        findings = Self.findings(in: note.sections.first { $0.code == "examination" }?.data)
    }

    /// The sections to save. The examination record keeps whatever else the
    /// web wrote in it; only its findings are replaced.
    func patches(examData: JSONValue?) -> [SectionPatch] {
        let exam = examData ?? .object([:])
        let inner = (exam["exam"] ?? .object([:])).setting("findings", to: Self.encode(findings))
        return [
            SectionPatch(code: "subjective", text: noteHTML(chief), data: nil),
            SectionPatch(code: "objective", text: noteHTML(self.exam), data: nil),
            SectionPatch(code: "assessment", text: noteHTML(assessment), data: nil),
            SectionPatch(code: "plan", text: noteHTML(plan), data: nil),
            SectionPatch(code: "examination", text: nil, data: exam.setting("exam", to: inner)),
        ]
    }

    // The record's keys are the server's snake_case whichever way the client
    // cased them on the way in; read either, always write snake_case.
    private static func findings(in data: JSONValue?) -> [ExamFinding] {
        guard let raw = data?["exam"]?["findings"],
              let bytes = try? JSONEncoder().encode(raw) else { return [] }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return (try? decoder.decode([ExamFinding].self, from: bytes)) ?? []
    }

    private static func encode(_ findings: [ExamFinding]) -> JSONValue {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        guard let bytes = try? encoder.encode(findings),
              let value = try? JSONDecoder().decode(JSONValue.self, from: bytes) else { return .array([]) }
        return value
    }
}

/// The web editor's HTML as the paragraphs a reader sees.
func plainText(_ html: String) -> String {
    var text = html
    for (tag, replacement) in [("</p>", "\n"), ("<br>", "\n"), ("<br/>", "\n"), ("<br />", "\n"), ("<li>", "\n• ")] {
        text = text.replacingOccurrences(of: tag, with: replacement)
    }
    text = text.replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
    for (entity, char) in [("&nbsp;", " "), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", "\""), ("&#39;", "'"), ("&amp;", "&")] {
        text = text.replacingOccurrences(of: entity, with: char)
    }
    return text.split(separator: "\n").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }.joined(separator: "\n")
}

/// Plain text as the editor's HTML, one paragraph per line, so the web
/// shows what the handheld wrote.
func noteHTML(_ plain: String) -> String {
    plain.split(separator: "\n").map { line -> String in
        let escaped = line.trimmingCharacters(in: .whitespaces)
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
        return "<p>\(escaped)</p>"
    }.filter { $0 != "<p></p>" }.joined()
}
