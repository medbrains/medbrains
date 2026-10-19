import MedBrainsKit
import MedBrainsUI
import SwiftUI
import UIKit

/// The signed hospital QR on the sign-in screen: scan it to bind this app to
/// the hospital's server, or forget the hospital it is bound to. Typing the
/// hospital code stays beside it as the fallback.
struct HospitalBindingSection: View {
    @Environment(StaffShell.self) private var shell
    @State private var isScanning = false
    @State private var scanKey = 0
    @State private var isBinding = false
    @State private var problem: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let binding = shell.binding {
                Text("This app is bound to \(binding.tenantName).")
                    .font(CarbonType.helper)
                    .foregroundStyle(MedBrainsTheme.inkSecondary)
                    .accessibilityIdentifier("boundHospital")
                Button("Forget this hospital") { shell.forget() }
                    .buttonStyle(.carbonGhost)
                    .accessibilityIdentifier("forgetHospital")
            } else {
                Button {
                    problem = nil
                    isScanning = true
                } label: {
                    Label(isBinding ? "Binding…" : "Scan hospital QR", systemImage: "qrcode.viewfinder")
                }
                .buttonStyle(.carbonTertiary)
                .disabled(isBinding)
                .accessibilityIdentifier("scanHospitalQR")
            }
            if let problem {
                CarbonNotification(kind: .error, title: "That code didn't bind this app", message: problem)
                    .accessibilityIdentifier("bindingProblem")
            }
        }
        .sheet(isPresented: $isScanning) { scanner }
    }

    private var scanner: some View {
        NavigationStack {
            BarcodeScannerView(
                title: "Scan your hospital's QR",
                hint: "Your hospital's administrator prints it from Devices › Hospital binding.",
                resumeKey: scanKey
            ) { value in
                Task { await bind(value) }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { isScanning = false }
                }
            }
        }
    }

    private func bind(_ scanned: String) async {
        isScanning = false
        isBinding = true
        defer { isBinding = false; scanKey += 1 }
        do {
            let binding = try await shell.binder.bind(
                scanned,
                deviceLabel: UIDevice.current.name,
                appVariant: StaffShell.surface,
                clientVariant: StaffShell.clientVariant
            )
            shell.bound(to: binding)
        } catch {
            problem = error.localizedDescription
        }
    }
}
