import CoreGraphics
import Foundation

/// A body region as a clinician charts it ("Left knee"), read from
/// `packages/anatomy/body-regions.json` — the same list the web picker uses.
struct BodyRegion: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    let label: String
    /// Has a left and a right; the side completes the name.
    let sided: Bool
    let zone: Zone

    enum View: String, Decodable, CaseIterable, Sendable { case front, back }

    /// Where the patient's right instance sits on its view, in fractions of the figure.
    struct Zone: Decodable, Hashable, Sendable {
        let view: View
        let x: CGFloat
        let y: CGFloat
        let w: CGFloat
        let h: CGFloat

        /// The patient's left: the same zone across the midline.
        var mirrored: Zone { Zone(view: view, x: 1 - x - w, y: y, w: w, h: h) }
    }

    /// The zones a view draws: one per unsided region, a right and a left per sided one.
    func zones(on view: View) -> [(side: Laterality?, zone: Zone)] {
        guard zone.view == view else { return [] }
        return sided ? [(.right, zone), (.left, zone.mirrored)] : [(nil, zone)]
    }

    /// "Left knee", or "Knee" until its side is chosen.
    func label(side: Laterality?) -> String {
        guard sided, let word = side?.word else { return label }
        return "\(word) \(label.lowercased())"
    }

    /// The list, bundled with the app; empty only if the bundle is broken.
    static let all: [BodyRegion] = {
        struct File: Decodable { let regions: [BodyRegion] }
        guard let url = Bundle.main.url(forResource: "body-regions", withExtension: "json"),
              let data = try? Data(contentsOf: url) else { return [] }
        return (try? JSONDecoder().decode(File.self, from: data).regions) ?? []
    }()
}

/// The server's `body_site::Laterality`.
enum Laterality: String, Codable, CaseIterable, Sendable {
    case left, right, bilateral, midline

    var word: String? {
        switch self {
        case .left: "Left"
        case .right: "Right"
        case .bilateral, .midline: nil
        }
    }

    var choice: String {
        switch self {
        case .left: "Left"
        case .right: "Right"
        case .bilateral: "Both"
        case .midline: "Midline"
        }
    }
}
