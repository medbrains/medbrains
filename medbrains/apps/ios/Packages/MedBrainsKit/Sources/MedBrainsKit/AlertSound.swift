import AudioToolbox
import Foundation
import UserNotifications

/// The three alert sounds (issue #4862). Which one a notification makes is
/// `packages/alert-sounds/alert-sounds.json`, shared with web and Android;
/// `AlertSoundRules` mirrors it and `AlertSoundTests` reads the JSON to catch
/// drift. The files are bundled by `apps/ios/project.yml`: staff gets all
/// three, the patient app only calm.
public enum AlertSound: String, CaseIterable, Sendable {
    case calm, attention, urgent

    /// Resource name in the app bundle (16-bit PCM WAV, which notifications accept).
    public var resourceName: String { "alert_\(rawValue)" }
    public static let resourceExtension = "wav"
    public var fileName: String { "\(resourceName).\(Self.resourceExtension)" }
}

/// Who is listening: patient-facing apps never hear attention or urgent.
public enum AlertAudience: Sendable { case staff, patient }

public enum AlertSoundRules {
    public static let silentScopes: Set<String> = ["board"]
    public static let patientSound = AlertSound.calm
    public static let urgentKinds: Set<String> = ["danger", "error", "critical", "emergency"]
    public static let calmKinds: Set<String> = ["info", "success"]
    public static let urgentEntityTypes: Set<String> = ["code_blue", "mass_casualty_event", "bedside_nurse_request"]
    public static let attentionEntityTypes: Set<String> = ["lab_order", "radiology_order"]
    public static let defaultSound = AlertSound.attention
    /// One sound per category per window, so a burst rings once.
    public static let throttleSeconds: TimeInterval = 4

    /// First matching rule wins, in the order the JSON documents. nil = silent.
    public static func sound(kind: String, entityType: String? = nil, scope: String? = nil, audience: AlertAudience) -> AlertSound? {
        if let scope, silentScopes.contains(scope) { return nil }
        if audience == .patient { return patientSound }
        if urgentKinds.contains(kind) { return .urgent }
        let entity = entityType ?? ""
        if urgentEntityTypes.contains(entity), !calmKinds.contains(kind) { return .urgent }
        if attentionEntityTypes.contains(entity) { return .attention }
        if calmKinds.contains(kind) { return .calm }
        return defaultSound
    }
}

public extension AlertSound {
    /// How loudly a notification of this sound may interrupt. Urgent uses a
    /// critical alert only when the person has granted one — which needs
    /// Apple's critical-alerts entitlement, not requested yet — and is
    /// time-sensitive (breaks through a Focus) otherwise. Passive would be
    /// silent, so calm stays active.
    func interruptionLevel(criticalAllowed: Bool) -> UNNotificationInterruptionLevel {
        guard self == .urgent else { return .active }
        return criticalAllowed ? .critical : .timeSensitive
    }

    func notificationSound(criticalAllowed: Bool) -> UNNotificationSound {
        let name = UNNotificationSoundName(fileName)
        return self == .urgent && criticalAllowed ? .criticalSoundNamed(name) : UNNotificationSound(named: name)
    }

    /// Give a push or local notification this sound and interruption level.
    /// `criticalAllowed` is `settings.criticalAlertSetting == .enabled`.
    func decorate(_ content: UNMutableNotificationContent, criticalAllowed: Bool) {
        content.sound = notificationSound(criticalAllowed: criticalAllowed)
        content.interruptionLevel = interruptionLevel(criticalAllowed: criticalAllowed)
    }
}

/// Plays alert sounds in the foreground. System sounds honour the ring/silent
/// switch; urgent uses the alert variant, which also vibrates. At most three
/// sound ids, created on first use and kept for the life of the app.
@MainActor
public final class AlertSoundPlayer {
    public static let shared = AlertSoundPlayer()

    private var ids: [AlertSound: SystemSoundID] = [:]
    private var lastPlayed: [AlertSound: Date] = [:]
    private let bundle: Bundle

    public init(bundle: Bundle = .main) { self.bundle = bundle }

    /// Plays unless the same sound played within the throttle window. A sound
    /// the app does not bundle (urgent in the patient app) is skipped.
    @discardableResult
    public func play(_ sound: AlertSound, now: Date = Date()) -> Bool {
        if let last = lastPlayed[sound], now.timeIntervalSince(last) < AlertSoundRules.throttleSeconds { return false }
        guard let id = soundID(sound) else { return false }
        lastPlayed[sound] = now
        if sound == .urgent { AudioServicesPlayAlertSound(id) } else { AudioServicesPlaySystemSound(id) }
        return true
    }

    private func soundID(_ sound: AlertSound) -> SystemSoundID? {
        if let id = ids[sound] { return id }
        guard let url = bundle.url(forResource: sound.resourceName, withExtension: AlertSound.resourceExtension) else { return nil }
        var id: SystemSoundID = 0
        guard AudioServicesCreateSystemSoundID(url as CFURL, &id) == kAudioServicesNoError else { return nil }
        ids[sound] = id
        return id
    }
}
