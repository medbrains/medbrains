import MedBrainsKit
import SwiftUI

/// Renders a `RemoteState` the way every device screen must: a loader, a
/// named outage with a retry (never a blank, never an empty list), the
/// empty state in words, or the content. `id` seeds the accessibility ids
/// the journeys look for: `<id>-list` and `<id>-empty`.
public struct RemoteContentView<T: Sendable, Content: View>: View {
    let id: String
    let state: RemoteState<T>
    let unavailableTitle: String
    let unavailableMessage: String
    let isEmpty: (T) -> Bool
    let emptyTitle: String
    let emptyMessage: String
    let retry: () -> Void
    @ViewBuilder let content: (T) -> Content

    public init(
        id: String,
        state: RemoteState<T>,
        unavailableTitle: String,
        unavailableMessage: String,
        isEmpty: @escaping (T) -> Bool,
        emptyTitle: String,
        emptyMessage: String,
        retry: @escaping () -> Void,
        @ViewBuilder content: @escaping (T) -> Content
    ) {
        self.id = id
        self.state = state
        self.unavailableTitle = unavailableTitle
        self.unavailableMessage = unavailableMessage
        self.isEmpty = isEmpty
        self.emptyTitle = emptyTitle
        self.emptyMessage = emptyMessage
        self.retry = retry
        self.content = content
    }

    public var body: some View {
        switch state {
        case .loading:
            ProgressView().frame(maxWidth: .infinity).padding(.vertical, 32)
        case .failed(let message):
            CarbonNotification(kind: .error, title: unavailableTitle, message: "\(unavailableMessage) (\(message))") {
                Button("Try again", action: retry).buttonStyle(.carbonGhost)
            }
            .padding(16)
            .accessibilityIdentifier("\(id)-unavailable")
        case .loaded(let value):
            if isEmpty(value) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(emptyTitle).font(CarbonType.heading02).foregroundStyle(MedBrainsTheme.ink)
                    Text(emptyMessage).font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("\(id)-empty")
            } else {
                content(value).accessibilityIdentifier("\(id)-list")
            }
        }
    }
}
