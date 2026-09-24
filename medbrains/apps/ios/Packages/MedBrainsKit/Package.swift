// swift-tools-version: 5.9
// The shell: auth, secrets, API client, module gating. Pure Swift so its tests
// run on the Mac; the Rust core is linked by the app targets (MedBrainsCore),
// and the offline-authorisation wrapper that needs it lives beside them.
import PackageDescription

let package = Package(
    name: "MedBrainsKit",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "MedBrainsKit", targets: ["MedBrainsKit"])],
    targets: [
        .target(name: "MedBrainsKit"),
        .testTarget(name: "MedBrainsKitTests", dependencies: ["MedBrainsKit"]),
    ]
)
