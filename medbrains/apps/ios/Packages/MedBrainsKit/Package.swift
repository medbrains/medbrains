// swift-tools-version: 5.9
// The shell: auth, secrets, API client, module gating, error reports. Pure
// Swift so its tests run on the Mac; the Rust core is linked by the app
// targets (MedBrainsCore), and the offline-authorisation wrapper that needs it
// lives beside them.
import PackageDescription

let package = Package(
    name: "MedBrainsKit",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "MedBrainsKit", targets: ["MedBrainsKit"])],
    dependencies: [
        // Exact: a new SDK version is a reviewed change, past the 7-day cooldown.
        .package(url: "https://github.com/getsentry/sentry-cocoa", exact: "9.33.0"),
    ],
    targets: [
        .target(name: "MedBrainsKit", dependencies: [.product(name: "Sentry", package: "sentry-cocoa")]),
        .testTarget(name: "MedBrainsKitTests", dependencies: ["MedBrainsKit"]),
    ]
)
