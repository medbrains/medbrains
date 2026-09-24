// swift-tools-version: 5.9
// Offline authorisation over the Rust core. Separate from MedBrainsKit so the
// kit's tests run on the Mac; app targets link this one.
import PackageDescription

let package = Package(
    name: "MedBrainsOffline",
    platforms: [.iOS(.v17)],
    products: [.library(name: "MedBrainsOffline", targets: ["MedBrainsOffline"])],
    dependencies: [.package(path: "../MedBrainsCore")],
    targets: [
        .target(name: "MedBrainsOffline", dependencies: [.product(name: "MedBrainsCore", package: "MedBrainsCore")]),
    ]
)
