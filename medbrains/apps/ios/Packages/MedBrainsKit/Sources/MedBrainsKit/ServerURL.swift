import Foundation

/// The server an app launch talks to, in order: a debug-build override from the
/// launch arguments (simulator runs and UI tests), the hospital this device was
/// bound to by its QR, and finally the server the build was made for. A blank
/// value is skipped rather than used as a server; nil means none was given.
/// Mirrors `chooseServerUrl` in the Android kit.
public func chooseServerURL(
    debugOverride: String?, boundApiBase: String?, buildDefault: String?
) -> URL? {
    [debugOverride, boundApiBase, buildDefault]
        .lazy
        .compactMap { $0?.trimmingCharacters(in: .whitespaces) }
        .first { !$0.isEmpty }
        .flatMap(URL.init(string:))
}
