import UserNotifications
import XCTest
@testable import MedBrainsKit

/// The phone rings the way the browser does: the rules mirror
/// `packages/alert-sounds/alert-sounds.json`, and this reads that file.
final class AlertSoundTests: XCTestCase {
    private struct SharedRules: Decodable {
        let sounds: [String]
        let silent_scopes: [String]
        let patient_sound: String
        let urgent_kinds: [String]
        let calm_kinds: [String]
        let urgent_entity_types: [String]
        let attention_entity_types: [String]
        let default_sound: String
        let throttle_ms: Int
    }

    private func shared() throws -> SharedRules {
        let url = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .appendingPathComponent("../../../../../../packages/alert-sounds/alert-sounds.json")
            .standardizedFileURL
        return try JSONDecoder().decode(SharedRules.self, from: Data(contentsOf: url))
    }

    func testTheMirrorMatchesTheSharedRules() throws {
        let rules = try shared()
        XCTAssertEqual(AlertSound.allCases.map(\.rawValue), rules.sounds)
        XCTAssertEqual(AlertSoundRules.silentScopes, Set(rules.silent_scopes))
        XCTAssertEqual(AlertSoundRules.patientSound.rawValue, rules.patient_sound)
        XCTAssertEqual(AlertSoundRules.urgentKinds, Set(rules.urgent_kinds))
        XCTAssertEqual(AlertSoundRules.calmKinds, Set(rules.calm_kinds))
        XCTAssertEqual(AlertSoundRules.urgentEntityTypes, Set(rules.urgent_entity_types))
        XCTAssertEqual(AlertSoundRules.attentionEntityTypes, Set(rules.attention_entity_types))
        XCTAssertEqual(AlertSoundRules.defaultSound.rawValue, rules.default_sound)
        XCTAssertEqual(AlertSoundRules.throttleSeconds * 1000, TimeInterval(rules.throttle_ms))
    }

    func testRealNotificationsSoundAsTheWebDoes() {
        XCTAssertEqual(AlertSoundRules.sound(kind: "danger", entityType: "lab_order", audience: .staff), .urgent)
        XCTAssertEqual(AlertSoundRules.sound(kind: "error", entityType: "code_blue", audience: .staff), .urgent)
        XCTAssertEqual(AlertSoundRules.sound(kind: "sla_breach", entityType: "bedside_nurse_request", audience: .staff), .urgent)
        // A code blue standing down is news, not an alarm.
        XCTAssertEqual(AlertSoundRules.sound(kind: "info", entityType: "code_blue", audience: .staff), .calm)
        XCTAssertEqual(AlertSoundRules.sound(kind: "info", entityType: "lab_order", audience: .staff), .attention)
        XCTAssertEqual(AlertSoundRules.sound(kind: "break_glass", audience: .staff), .attention)
        XCTAssertEqual(AlertSoundRules.sound(kind: "info", entityType: "appointment", audience: .staff), .calm)
        XCTAssertNil(AlertSoundRules.sound(kind: "danger", scope: "board", audience: .staff))
    }

    func testThePatientAppOnlyEverHearsCalm() {
        for kind in ["danger", "error", "warning", "info"] {
            XCTAssertEqual(AlertSoundRules.sound(kind: kind, entityType: "code_blue", audience: .patient), .calm)
        }
    }

    func testOnlyUrgentInterruptsHarderAndCriticalNeedsTheGrant() {
        XCTAssertEqual(AlertSound.calm.interruptionLevel(criticalAllowed: true), .active)
        XCTAssertEqual(AlertSound.attention.interruptionLevel(criticalAllowed: true), .active)
        XCTAssertEqual(AlertSound.urgent.interruptionLevel(criticalAllowed: false), .timeSensitive)
        XCTAssertEqual(AlertSound.urgent.interruptionLevel(criticalAllowed: true), .critical)
    }

    func testANotificationGetsItsSoundAndLevel() {
        let content = UNMutableNotificationContent()
        AlertSound.urgent.decorate(content, criticalAllowed: false)
        XCTAssertEqual(content.interruptionLevel, .timeSensitive)
        XCTAssertNotNil(content.sound)
        XCTAssertEqual(AlertSound.calm.fileName, "alert_calm.wav")
    }

    @MainActor
    func testAMissingSoundIsSkippedNotCrashed() {
        // The test bundle carries no sounds, as the patient app carries no urgent.
        XCTAssertFalse(AlertSoundPlayer(bundle: Bundle(for: Self.self)).play(.urgent))
    }

    func testEveryBundledFileExists() {
        let dir = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
            .appendingPathComponent("../../../../../../packages/alert-sounds/ios").standardizedFileURL
        for sound in AlertSound.allCases {
            XCTAssertTrue(FileManager.default.fileExists(atPath: dir.appendingPathComponent(sound.fileName).path), sound.fileName)
        }
    }
}
