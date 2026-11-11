import CoreText
import SwiftUI
import UIKit

/// MedBrains Sans (IBM Plex Sans with Atkinson Hyperlegible Next's b d p q l 1,
/// slashed zero, spacing +12, Regular cut at weight 440) and IBM Plex Mono, bundled with the package (SIL OFL 1.1, Fonts/OFL.txt) and
/// registered once at launch. Every size is Dynamic-Type relative so a
/// nurse who scales text still gets the Carbon scale, larger.
public enum CarbonType {
    private static let faces = [
        "MedBrainsSans-Light", "MedBrainsSans-Regular", "MedBrainsSans-Medium",
        "MedBrainsSans-SemiBold", "IBMPlexMono-Regular",
    ]

    /// Call from the app's `init`. Idempotent; a face already registered is skipped quietly.
    public static func register() {
        for face in faces {
            guard
                let url = Bundle.module.url(
                    forResource: face, withExtension: "ttf", subdirectory: "Fonts")
            else { continue }
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
        // The bars are UIKit underneath SwiftUI; they take the face from appearance, not from Font.
        let nav = UINavigationBar.appearance()
        nav.largeTitleTextAttributes = [
            .font: UIFont(name: "MedBrainsSans-Light", size: 32)
                ?? .preferredFont(forTextStyle: .largeTitle)
        ]
        nav.titleTextAttributes = [
            .font: UIFont(name: "MedBrainsSans-SemiBold", size: 16)
                ?? .preferredFont(forTextStyle: .headline)
        ]
        UITabBarItem.appearance().setTitleTextAttributes(
            [
                .font: UIFont(name: "MedBrainsSans-Regular", size: 11)
                    ?? .preferredFont(forTextStyle: .caption2)
            ], for: .normal)
    }

    // Carbon type scale (productive): the names are Carbon's, the sizes its 16px-base scale.
    public static let display = Font.custom(
        "MedBrainsSans-Light", size: 42, relativeTo: .largeTitle)
    public static let heading05 = Font.custom(
        "MedBrainsSans-Light", size: 32, relativeTo: .largeTitle)
    public static let heading04 = Font.custom("MedBrainsSans-Regular", size: 28, relativeTo: .title)
    public static let heading03 = Font.custom(
        "MedBrainsSans-Regular", size: 20, relativeTo: .title2)
    public static let heading02 = Font.custom(
        "MedBrainsSans-SemiBold", size: 16, relativeTo: .headline)
    public static let heading01 = Font.custom(
        "MedBrainsSans-SemiBold", size: 14, relativeTo: .subheadline)
    public static let body = Font.custom("MedBrainsSans-Regular", size: 16, relativeTo: .body)
    public static let bodyCompact = Font.custom(
        "MedBrainsSans-Regular", size: 14, relativeTo: .subheadline)
    public static let label = Font.custom("MedBrainsSans-Regular", size: 12, relativeTo: .caption)
    public static let helper = Font.custom("MedBrainsSans-Regular", size: 12, relativeTo: .caption)
    public static let code = Font.custom("IBMPlexMono-Regular", size: 14, relativeTo: .subheadline)
    public static let codeSmall = Font.custom("IBMPlexMono-Regular", size: 12, relativeTo: .caption)
}
