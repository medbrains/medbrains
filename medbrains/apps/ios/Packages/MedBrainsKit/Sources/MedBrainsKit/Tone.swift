/// How a state reads, apart from any design system: the UI maps it to its
/// own tone. A tone always travels with words — colour never carries the
/// meaning alone.
public enum Tone: Sendable, Equatable {
    case neutral, info, success, warning, danger
}
