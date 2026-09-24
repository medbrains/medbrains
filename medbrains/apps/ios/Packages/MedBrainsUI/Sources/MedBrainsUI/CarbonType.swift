import CoreText
import SwiftUI
import UIKit

/// IBM Plex, the Carbon face, bundled with the package (SIL OFL 1.1) and
/// registered once at launch. Every size is Dynamic-Type relative so a
/// nurse who scales text still gets the Carbon scale, larger.
public enum CarbonType {
    private static let faces = ["IBMPlexSans-Light", "IBMPlexSans-Regular", "IBMPlexSans-Medium", "IBMPlexSans-SemiBold", "IBMPlexMono-Regular"]

    /// Call from the app's `init`. Idempotent; a face already registered is skipped quietly.
    public static func register() {
        for face in faces {
            guard let url = Bundle.module.url(forResource: face, withExtension: "ttf", subdirectory: "Fonts") else { continue }
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
        // The bars are UIKit underneath SwiftUI; they take the face from appearance, not from Font.
        let nav = UINavigationBar.appearance()
        nav.largeTitleTextAttributes = [.font: UIFont(name: "IBMPlexSans-Light", size: 32) ?? .preferredFont(forTextStyle: .largeTitle)]
        nav.titleTextAttributes = [.font: UIFont(name: "IBMPlexSans-SemiBold", size: 16) ?? .preferredFont(forTextStyle: .headline)]
        UITabBarItem.appearance().setTitleTextAttributes([.font: UIFont(name: "IBMPlexSans-Regular", size: 11) ?? .preferredFont(forTextStyle: .caption2)], for: .normal)
    }

    // Carbon type scale (productive): the names are Carbon's, the sizes its 16px-base scale.
    public static let display = Font.custom("IBMPlexSans-Light", size: 42, relativeTo: .largeTitle)
    public static let heading05 = Font.custom("IBMPlexSans-Light", size: 32, relativeTo: .largeTitle)
    public static let heading04 = Font.custom("IBMPlexSans-Regular", size: 28, relativeTo: .title)
    public static let heading03 = Font.custom("IBMPlexSans-Regular", size: 20, relativeTo: .title2)
    public static let heading02 = Font.custom("IBMPlexSans-SemiBold", size: 16, relativeTo: .headline)
    public static let heading01 = Font.custom("IBMPlexSans-SemiBold", size: 14, relativeTo: .subheadline)
    public static let body = Font.custom("IBMPlexSans-Regular", size: 16, relativeTo: .body)
    public static let bodyCompact = Font.custom("IBMPlexSans-Regular", size: 14, relativeTo: .subheadline)
    public static let label = Font.custom("IBMPlexSans-Regular", size: 12, relativeTo: .caption)
    public static let helper = Font.custom("IBMPlexSans-Regular", size: 12, relativeTo: .caption)
    public static let code = Font.custom("IBMPlexMono-Regular", size: 14, relativeTo: .subheadline)
    public static let codeSmall = Font.custom("IBMPlexMono-Regular", size: 12, relativeTo: .caption)
}
