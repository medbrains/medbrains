// swift-tools-version: 5.9
// Carbon on system controls. Depends on the kit for the remote-state types
// that RemoteContentView renders; the kit never depends back on the UI.
import PackageDescription

let package = Package(
    name: "MedBrainsUI",
    platforms: [.iOS(.v17)],
    products: [.library(name: "MedBrainsUI", targets: ["MedBrainsUI"])],
    dependencies: [.package(path: "../MedBrainsKit")],
    targets: [.target(name: "MedBrainsUI", dependencies: ["MedBrainsKit"], resources: [.copy("Fonts")])]
)
