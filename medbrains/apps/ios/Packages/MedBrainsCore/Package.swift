// swift-tools-version: 5.9
// The Rust core (crates/medbrains-edge-rn) as a Swift package: UniFFI-generated
// Swift over a prebuilt xcframework. Regenerate both with
// `make native-core` (bindings + xcframework); never edit Generated/.
import PackageDescription

let package = Package(
    name: "MedBrainsCore",
    platforms: [.iOS(.v17)],
    products: [.library(name: "MedBrainsCore", targets: ["MedBrainsCore"])],
    targets: [
        .binaryTarget(name: "MedBrainsEdgeRn", path: "MedBrainsEdgeRn.xcframework"),
        .target(
            name: "MedBrainsCore",
            dependencies: ["MedBrainsEdgeRn"],
            path: "Generated",
            sources: ["edge_rn.swift"]
        ),
    ]
)
