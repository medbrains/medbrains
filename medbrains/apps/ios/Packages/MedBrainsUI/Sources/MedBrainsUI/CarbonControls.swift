import SwiftUI

/// Carbon's text input: a Field-01 layer (Gray 10) with a 1px bottom border,
/// a 2px interactive border when focused, a label above, helper or error
/// below. Sharp corners — Carbon has none. The wrapped control stays the
/// system's so autofill, Dynamic Type and VoiceOver come for free.
public struct CarbonField<Control: View>: View {
    let label: String
    let helper: String?
    let error: String?
    let isFocused: Bool
    @ViewBuilder let control: () -> Control

    public init(_ label: String, helper: String? = nil, error: String? = nil, isFocused: Bool, @ViewBuilder control: @escaping () -> Control) {
        self.label = label
        self.helper = helper
        self.error = error
        self.isFocused = isFocused
        self.control = control
    }

    private var borderColor: Color {
        if error != nil { return MedBrainsTheme.danger }
        return isFocused ? MedBrainsTheme.interactive : MedBrainsTheme.borderStrong
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(CarbonType.label)
                .foregroundStyle(MedBrainsTheme.inkSecondary)
            control()
                .font(CarbonType.body)
                .padding(.horizontal, 16)
                .frame(minHeight: 48)
                .background(MedBrainsTheme.field)
                .overlay(alignment: .bottom) {
                    Rectangle().fill(borderColor).frame(height: isFocused || error != nil ? 2 : 1)
                }
            if let error {
                Label(error, systemImage: "exclamationmark.circle.fill")
                    .font(CarbonType.helper)
                    .foregroundStyle(MedBrainsTheme.danger)
            } else if let helper {
                Text(helper).font(CarbonType.helper).foregroundStyle(MedBrainsTheme.inkSecondary)
            }
        }
    }
}

/// Carbon's primary button: full width, 48pt, label left, glyph right,
/// Blue 60 fill, no radius. Pressed = Blue 70; disabled = Gray 30 on Gray 10.
public struct CarbonPrimaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled
    public init() {}

    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(CarbonType.body)
            .foregroundStyle(isEnabled ? MedBrainsTheme.inkInverse : MedBrainsTheme.inkDisabled)
            .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
            .padding(.horizontal, 16)
            .background(isEnabled ? (configuration.isPressed ? MedBrainsTheme.interactiveHover : MedBrainsTheme.interactive) : MedBrainsTheme.field)
            .contentShape(Rectangle())
    }
}

/// Carbon's ghost button: text-only, Blue 60, for the secondary action.
public struct CarbonGhostButtonStyle: ButtonStyle {
    public init() {}
    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(CarbonType.body)
            .foregroundStyle(MedBrainsTheme.interactive)
            .frame(minHeight: 48)
            .padding(.horizontal, 16)
            .background(configuration.isPressed ? MedBrainsTheme.field : .clear)
            .contentShape(Rectangle())
    }
}

public extension ButtonStyle where Self == CarbonPrimaryButtonStyle {
    static var carbonPrimary: CarbonPrimaryButtonStyle { CarbonPrimaryButtonStyle() }
}

public extension ButtonStyle where Self == CarbonGhostButtonStyle {
    static var carbonGhost: CarbonGhostButtonStyle { CarbonGhostButtonStyle() }
}

/// A Carbon structured-list row: text left, hairline below, no chevron
/// unless it navigates. Use inside a `VStack(spacing: 0)`.
public struct CarbonRow<Trailing: View>: View {
    let title: String
    let detail: String?
    let mono: Bool
    @ViewBuilder let trailing: () -> Trailing

    public init(_ title: String, detail: String? = nil, mono: Bool = false, @ViewBuilder trailing: @escaping () -> Trailing = { EmptyView() }) {
        self.title = title
        self.detail = detail
        self.mono = mono
        self.trailing = trailing
    }

    public var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(mono ? CarbonType.code : CarbonType.body).foregroundStyle(MedBrainsTheme.ink)
                if let detail {
                    Text(detail).font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
                }
            }
            Spacer(minLength: 0)
            trailing()
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 16)
        .frame(minHeight: 48)
        // The row draws no fill, so without this a button or link built from
        // it is only tappable where its glyphs are — the gap between a short
        // title and the trailing tag hits nothing. The whole row is the
        // target (WCAG 2.5.8).
        .contentShape(Rectangle())
        .overlay(alignment: .bottom) { Rectangle().fill(MedBrainsTheme.hairline).frame(height: 1) }
    }
}

/// Carbon section heading: heading-01 with the 16px inset the grid gives every row.
public struct CarbonSectionTitle: View {
    let text: String
    public init(_ text: String) { self.text = text }
    public var body: some View {
        Text(text)
            .font(CarbonType.heading01)
            .foregroundStyle(MedBrainsTheme.ink)
            .padding(.horizontal, 16)
            .padding(.top, 24)
            .padding(.bottom, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityAddTraits(.isHeader)
    }
}
