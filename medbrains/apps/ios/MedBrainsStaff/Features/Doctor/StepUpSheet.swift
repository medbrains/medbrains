import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// "Confirm it's you": the password again before a signature, as the web asks
/// with its own prompt. The field takes focus on open and Return submits; a
/// wrong password says so under the field and keeps the sheet open. On
/// success the caller retries the action that asked.
struct StepUpSheet: View {
    @Environment(\.apiClient) private var client
    @Environment(\.dismiss) private var dismiss
    let onConfirmed: () async -> Void
    @State private var password = ""
    @State private var busy = false
    @State private var error: String?
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text("Signing puts your name to this record. Enter your password to continue.")
                    .font(.body)
                CarbonField("Password", error: error, isFocused: focused) {
                    SecureField("Password", text: $password)
                        .textContentType(.password)
                        .submitLabel(.done)
                        .focused($focused)
                        .onSubmit { Task { await confirm() } }
                        .accessibilityIdentifier("step-up-password")
                }
                Button(busy ? "Checking…" : "Confirm and sign") { Task { await confirm() } }
                    .buttonStyle(.carbonPrimary)
                    .disabled(password.isEmpty || busy)
                    .accessibilityIdentifier("step-up-confirm")
                Spacer()
            }
            .padding(16)
            .navigationTitle("Confirm it's you")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }.accessibilityIdentifier("step-up-cancel")
                }
            }
        }
        .onAppear { focused = true }
        .presentationDetents([.medium])
        .accessibilityIdentifier("step-up-sheet")
    }

    private func confirm() async {
        guard let client, !password.isEmpty, !busy else { return }
        busy = true
        defer { busy = false }
        do {
            try await client.stepUp(password: password)
            dismiss()
            await onConfirmed()
        } catch let failure as ApiError where failure.status == 403 {
            error = failure.message
            password = ""
            focused = true
        } catch {
            self.error = (error as? ApiError)?.message ?? "Could not reach the hospital server."
        }
    }
}
