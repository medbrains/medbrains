import MedBrainsKit
import SwiftUI

/// The state around one button that changes a queue: busy while it runs, the
/// sentence that says what happened, or why nothing did. One definition, so
/// every screen that calls a patient reports it the same way — and a call
/// that says nothing is a call pressed twice.
@MainActor
@Observable
final class QueueActionState {
    private(set) var busy = false
    private(set) var toast: String?
    private(set) var failure: String?

    /// Runs `op`; its answer is what the user is told happened, and is read
    /// out by VoiceOver. `unreachable` is said when the server could not be
    /// reached, naming what did not happen.
    func run(unreachable: String, _ op: () async throws -> String) async {
        busy = true
        defer { busy = false }
        failure = nil
        do {
            let done = try await op()
            toast = done
            UIAccessibility.post(notification: .announcement, argument: done)
        } catch let e as ApiError {
            failure = e.message
        } catch {
            failure = unreachable
        }
    }
}
