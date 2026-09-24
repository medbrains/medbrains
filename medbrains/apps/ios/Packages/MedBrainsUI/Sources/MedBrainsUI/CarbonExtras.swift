import SwiftUI

/// Carbon's tag: a small filled label. The word is always there — colour
/// never carries the meaning alone (WCAG 2.2 SC 1.4.1).
public enum CarbonTone: Sendable {
    case neutral, info, success, warning, danger, highAlert

    var fill: Color {
        switch self {
        case .neutral: Carbon.ink[2]
        case .info: Carbon.blue[1]
        case .success: Carbon.mint[1]
        case .warning: Carbon.amber[0]
        case .danger: Carbon.rose[1]
        case .highAlert: Carbon.ochre[1]
        }
    }

    var ink: Color {
        switch self {
        case .neutral: Carbon.ink[8]
        case .info: Carbon.blue[7]
        case .success: Carbon.mint[7]
        case .warning: Carbon.amber[7]
        case .danger: Carbon.rose[7]
        case .highAlert: Carbon.ochre[8]
        }
    }

    /// The accent bar on a tile.
    public var bar: Color {
        switch self {
        case .neutral: Carbon.ink[5]
        case .info: Carbon.blue[5]
        case .success: Carbon.mint[4]
        case .warning: Carbon.amber[2]
        case .danger: Carbon.rose[5]
        case .highAlert: Carbon.ochre[5]
        }
    }
}

public struct CarbonTag: View {
    let text: String
    let tone: CarbonTone
    let mono: Bool

    public init(_ text: String, tone: CarbonTone = .neutral, mono: Bool = false) {
        self.text = text
        self.tone = tone
        self.mono = mono
    }

    public var body: some View {
        Text(text)
            .font(mono ? CarbonType.codeSmall : CarbonType.label)
            .foregroundStyle(tone.ink)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(tone.fill)
            .lineLimit(1)
    }
}

/// Carbon's inline notification: a Layer-01 tile with a 3pt bar in the
/// kind's colour, an icon, a title, the message, and optional actions.
public struct CarbonNotification<Actions: View>: View {
    public enum Kind { case info, success, warning, error }

    let kind: Kind
    let title: String
    let message: String
    @ViewBuilder let actions: () -> Actions

    public init(kind: Kind, title: String, message: String, @ViewBuilder actions: @escaping () -> Actions = { EmptyView() }) {
        self.kind = kind
        self.title = title
        self.message = message
        self.actions = actions
    }

    private var tone: CarbonTone {
        switch kind {
        case .info: .info
        case .success: .success
        case .warning: .warning
        case .error: .danger
        }
    }

    private var symbol: String {
        switch kind {
        case .info: "info.circle.fill"
        case .success: "checkmark.circle.fill"
        case .warning: "exclamationmark.triangle.fill"
        case .error: "exclamationmark.circle.fill"
        }
    }

    public var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: symbol).foregroundStyle(tone.bar).padding(.top, 2)
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(CarbonType.heading01).foregroundStyle(MedBrainsTheme.ink)
                Text(message).font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.ink)
                actions()
            }
            Spacer(minLength: 0)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(MedBrainsTheme.surface)
        .overlay(alignment: .leading) { Rectangle().fill(tone.bar).frame(width: 3) }
        .accessibilityElement(children: .combine)
    }
}

/// Carbon's tile with an accent bar, for cards and rows that carry a state.
public struct CarbonTile<Content: View>: View {
    let tone: CarbonTone
    @ViewBuilder let content: () -> Content

    public init(tone: CarbonTone = .neutral, @ViewBuilder content: @escaping () -> Content) {
        self.tone = tone
        self.content = content
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) { content() }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(MedBrainsTheme.surface)
            .overlay(alignment: .leading) { Rectangle().fill(tone.bar).frame(width: 3) }
    }
}

/// Carbon's tertiary button: outlined, Blue 60, for the secondary act beside a primary.
public struct CarbonTertiaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled
    public init() {}
    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(CarbonType.body)
            .foregroundStyle(isEnabled ? (configuration.isPressed ? MedBrainsTheme.inkInverse : MedBrainsTheme.interactive) : MedBrainsTheme.inkDisabled)
            .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
            .padding(.horizontal, 16)
            .background(configuration.isPressed ? MedBrainsTheme.interactive : .clear)
            .overlay(Rectangle().stroke(isEnabled ? MedBrainsTheme.interactive : MedBrainsTheme.inkDisabled, lineWidth: 1))
            .contentShape(Rectangle())
    }
}

/// Carbon's danger button: Red 60 fill, for the act that cannot be undone.
public struct CarbonDangerButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled
    public init() {}
    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(CarbonType.body)
            .foregroundStyle(isEnabled ? MedBrainsTheme.inkInverse : MedBrainsTheme.inkDisabled)
            .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
            .padding(.horizontal, 16)
            .background(isEnabled ? (configuration.isPressed ? Carbon.rose[6] : MedBrainsTheme.danger) : MedBrainsTheme.field)
            .contentShape(Rectangle())
    }
}

public extension ButtonStyle where Self == CarbonTertiaryButtonStyle {
    static var carbonTertiary: CarbonTertiaryButtonStyle { CarbonTertiaryButtonStyle() }
}

public extension ButtonStyle where Self == CarbonDangerButtonStyle {
    static var carbonDanger: CarbonDangerButtonStyle { CarbonDangerButtonStyle() }
}

/// The page header every module screen opens with: eyebrow, heading, one
/// line under it, an optional tag on the right.
public struct CarbonPageHeader<Trailing: View>: View {
    let eyebrow: String
    let title: String
    let subtitle: String?
    @ViewBuilder let trailing: () -> Trailing

    public init(eyebrow: String, title: String, subtitle: String? = nil, @ViewBuilder trailing: @escaping () -> Trailing = { EmptyView() }) {
        self.eyebrow = eyebrow
        self.title = title
        self.subtitle = subtitle
        self.trailing = trailing
    }

    public var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Eyebrow(eyebrow)
                Text(title).font(CarbonType.heading04).foregroundStyle(MedBrainsTheme.ink)
                if let subtitle {
                    Text(subtitle).font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
                }
            }
            Spacer(minLength: 0)
            trailing()
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 16)
    }
}
