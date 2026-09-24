import AVFoundation
import SwiftUI

/// The one barcode reader every device screen uses. Hands the caller exactly
/// one result per `resumeKey`: the camera fires per frame, and without a lock
/// a single tube held to the lens fires thirty lookups a second. Permission
/// has three states, not two — "not asked yet" must not render as "denied".
/// Wards and store rooms are dark, so the torch is a control here. A device
/// with no camera (the simulator, a broken lens) offers typed entry: the
/// server compares whatever it receives, so nothing about the check depends
/// on the string having come from a lens.
public struct BarcodeScannerView: View {
    let title: String
    let hint: String
    let resumeKey: Int
    let onScan: (String) -> Void

    @State private var permission = AVCaptureDevice.authorizationStatus(for: .video)
    @State private var torch = false
    @State private var typed = ""
    @FocusState private var typing: Bool

    public init(title: String, hint: String, resumeKey: Int, onScan: @escaping (String) -> Void) {
        self.title = title
        self.hint = hint
        self.resumeKey = resumeKey
        self.onScan = onScan
    }

    private var hasCamera: Bool { AVCaptureDevice.default(for: .video) != nil }

    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).font(CarbonType.heading02).foregroundStyle(MedBrainsTheme.ink)
            Text(hint).font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
            if hasCamera {
                cameraPane
            } else {
                manualPane(reason: "This device has no camera.")
            }
        }
        .padding(16)
    }

    @ViewBuilder private var cameraPane: some View {
        switch permission {
        case .authorized:
            ZStack(alignment: .bottomTrailing) {
                CameraPreview(resumeKey: resumeKey, torch: torch, onScan: onScan)
                    .frame(height: 280)
                    .background(Color.black)
                    .accessibilityLabel("Camera viewfinder")
                Button {
                    torch.toggle()
                } label: {
                    Image(systemName: torch ? "flashlight.on.fill" : "flashlight.off.fill")
                        .frame(width: 48, height: 48)
                        .background(.black.opacity(0.5))
                        .foregroundStyle(.white)
                }
                .accessibilityLabel(torch ? "Turn the torch off" : "Turn the torch on")
                .padding(8)
            }
            manualPane(reason: "Or, if the code will not read:")
        case .notDetermined:
            Button("Allow the camera") {
                AVCaptureDevice.requestAccess(for: .video) { _ in
                    Task { @MainActor in permission = AVCaptureDevice.authorizationStatus(for: .video) }
                }
            }
            .buttonStyle(.carbonPrimary)
        default:
            CarbonNotification(kind: .warning, title: "Camera access is off", message: "Turn it on in Settings › MedBrains to scan. You can type the code below meanwhile.")
            manualPane(reason: nil)
        }
    }

    @ViewBuilder private func manualPane(reason: String?) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if let reason { Text(reason).font(CarbonType.helper).foregroundStyle(MedBrainsTheme.inkSecondary) }
            CarbonField("Type the code", isFocused: typing) {
                TextField("Code", text: $typed)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .focused($typing)
                    .submitLabel(.done)
                    .onSubmit(submitTyped)
                    .accessibilityIdentifier("barcode-manual")
            }
            Button("Use this code", action: submitTyped)
                .buttonStyle(.carbonTertiary)
                .disabled(typed.trimmingCharacters(in: .whitespaces).isEmpty)
                .accessibilityIdentifier("barcode-manual-submit")
        }
    }

    private func submitTyped() {
        let value = typed.trimmingCharacters(in: .whitespaces)
        guard !value.isEmpty else { return }
        typed = ""
        onScan(value)
    }
}

/// Linear codes for specimen tubes and asset tags, plus QR and Data Matrix.
/// Narrower than everything AVFoundation supports on purpose: each extra
/// symbology is more work per frame and more misreads.
private let clinicalSymbologies: [AVMetadataObject.ObjectType] = [.qr, .code128, .code39, .ean13, .dataMatrix]

private struct CameraPreview: UIViewControllerRepresentable {
    let resumeKey: Int
    let torch: Bool
    let onScan: (String) -> Void

    func makeUIViewController(context: Context) -> ScannerController {
        let controller = ScannerController()
        controller.onScan = onScan
        return controller
    }

    func updateUIViewController(_ controller: ScannerController, context: Context) {
        controller.onScan = onScan
        controller.resume(key: resumeKey)
        controller.setTorch(torch)
    }
}

final class ScannerController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    var onScan: ((String) -> Void)?
    private let session = AVCaptureSession()
    private var preview: AVCaptureVideoPreviewLayer?
    private var lockedKey: Int?
    private var currentKey = 0

    override func viewDidLoad() {
        super.viewDidLoad()
        guard let device = AVCaptureDevice.default(for: .video), let input = try? AVCaptureDeviceInput(device: device) else { return }
        let output = AVCaptureMetadataOutput()
        guard session.canAddInput(input), session.canAddOutput(output) else { return }
        session.addInput(input)
        session.addOutput(output)
        output.setMetadataObjectsDelegate(self, queue: .main)
        output.metadataObjectTypes = clinicalSymbologies.filter(output.availableMetadataObjectTypes.contains)
        let layer = AVCaptureVideoPreviewLayer(session: session)
        layer.videoGravity = .resizeAspectFill
        view.layer.addSublayer(layer)
        preview = layer
        Task.detached { [session] in session.startRunning() }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        preview?.frame = view.bounds
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        // Tear the camera down with the screen; a session left running is a
        // battery and a privacy problem.
        Task.detached { [session] in session.stopRunning() }
    }

    func resume(key: Int) {
        currentKey = key
    }

    func setTorch(_ on: Bool) {
        guard let device = AVCaptureDevice.default(for: .video), device.hasTorch, (try? device.lockForConfiguration()) != nil else { return }
        device.torchMode = on ? .on : .off
        device.unlockForConfiguration()
    }

    func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput objects: [AVMetadataObject], from connection: AVCaptureConnection) {
        guard lockedKey != currentKey,
              let code = objects.compactMap({ $0 as? AVMetadataMachineReadableCodeObject }).first,
              let value = code.stringValue, !value.isEmpty
        else { return }
        lockedKey = currentKey
        onScan?(value)
    }
}
