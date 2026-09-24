import SwiftUI

/// Semantic roles over the Carbon tokens. Screens name a role; the token
/// behind it is the brand's, never a literal. Layout, navigation and controls
/// are the platform's (HIG): this file owns colour and type only.
public enum MedBrainsTheme {
    public static let interactive = Carbon.blue[5]
    public static let interactiveHover = Carbon.blue[6]
    public static let vital = Carbon.cinnabar[5]
    public static let success = Carbon.mint[4]
    public static let warning = Carbon.amber[4]
    public static let danger = Carbon.rose[5]
    public static let ink = Carbon.ink[10]
    public static let inkSecondary = Carbon.ink[7]
    public static let inkDisabled = Carbon.ink[3]
    public static let inkInverse = Carbon.ink[0]
    public static let hairline = Carbon.ink[2]
    public static let borderStrong = Carbon.ink[5]
    /// Carbon layers: the white canvas, then Gray 10 for fields and layer-01.
    public static let canvas = Carbon.ink[0]
    public static let field = Carbon.ink[1]
    public static let surface = Carbon.ink[1]

    /// Carbon-for-mobile: phones 44pt, tablets 48pt (Material's floor, right
    /// for a surface held further away). WCAG 2.2 SC 2.5.8's 24pt is the floor.
    public static func tapTarget(_ sizeClass: UserInterfaceSizeClass?) -> CGFloat {
        sizeClass == .regular ? 48 : 44
    }
}

/// A module or KPI eyebrow: JetBrains-Mono-style metadata rendered in the
/// system monospaced face so Dynamic Type still applies.
public struct Eyebrow: View {
    let text: String
    public init(_ text: String) { self.text = text }
    public var body: some View {
        Text(text.uppercased())
            .font(CarbonType.codeSmall)
            .tracking(1.6)
            .foregroundStyle(MedBrainsTheme.inkSecondary)
            .accessibilityAddTraits(.isHeader)
    }
}

/// The one thing every device screen must do: never go blank. Wraps content
/// in a boundary that renders the last good state with a retry, per the
/// device-surface rules ("fail safe, never blank").
public struct FailSafe<Content: View>: View {
    let title: String
    let error: Error?
    let retry: () -> Void
    @ViewBuilder let content: () -> Content

    public init(title: String, error: Error?, retry: @escaping () -> Void, @ViewBuilder content: @escaping () -> Content) {
        self.title = title
        self.error = error
        self.retry = retry
        self.content = content
    }

    public var body: some View {
        if let error {
            ContentUnavailableView {
                Label(title, systemImage: "exclamationmark.triangle")
            } description: {
                Text(error.localizedDescription)
            } actions: {
                Button("Try again", action: retry).buttonStyle(.borderedProminent)
            }
        } else {
            content()
        }
    }
}
