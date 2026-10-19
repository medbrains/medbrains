import Foundation

/// ABDM Scan & Share at the registration desk, as the web's
/// `components/abha/scanShare.ts` applies it: who the share names, their age,
/// which shares can still be acted on, and which existing patients it may
/// really be. Android keeps the same rules in `com.medbrains.kit.ScanShare`.
public enum ScanShare {
    /// A patient who just scanned is at the desk within a minute.
    public static let refreshSeconds: Double = 15
    /// Candidates listed at most; the match endpoint answers up to 20.
    public static let candidateLimit = 5

    public enum Tone: Sendable { case primary, success, neutral, warning }

    /// Who the share names, for the queue row.
    public static func name(_ p: AbdmSharedProfile) -> String {
        let parts = [p.firstName, p.middleName, p.lastName].compactMap { $0 }.filter { !$0.isEmpty }
        return parts.isEmpty ? (p.fullName ?? p.abhaAddress) : parts.joined(separator: " ")
    }

    /// Age in whole years from the date of birth, else the year; nil when neither was shared.
    public static func age(dateOfBirth: String?, yearOfBirth: String?, today: Date, calendar: Calendar = .current) -> Int? {
        let now = calendar.dateComponents([.year, .month, .day], from: today)
        guard let year = now.year, let month = now.month, let day = now.day else { return nil }
        if let dob = dateOfBirth {
            let parts = dob.split(separator: "-").compactMap { Int($0) }
            guard parts.count == 3 else { return nil }
            let hadBirthday = month > parts[1] || (month == parts[1] && day >= parts[2])
            return year - parts[0] - (hadBirthday ? 0 : 1)
        }
        guard let born = yearOfBirth.flatMap(Int.init), born > 1900 else { return nil }
        return year - born
    }

    /// "34 y · female", or a dash.
    public static func ageAndGender(_ p: AbdmSharedProfile, today: Date) -> String {
        let parts = [age(dateOfBirth: p.dateOfBirth, yearOfBirth: p.yearOfBirth, today: today).map { "\($0) y" }, p.gender]
        let shown = parts.compactMap { $0 }
        return shown.isEmpty ? "—" : shown.joined(separator: " · ")
    }

    /// Only a share still waiting (or missed today) can be acted on.
    public static func isActionable(_ status: String) -> Bool { status == "waiting" || status == "expired" }

    public static func status(_ status: String) -> (label: String, tone: Tone) {
        switch status {
        case "waiting": ("Waiting", .primary)
        case "linked": ("Linked", .success)
        case "registered": ("Registered", .success)
        case "expired": ("Token expired", .warning)
        case "dismissed": ("Dismissed", .neutral)
        default: (status.replacingOccurrences(of: "_", with: " "), .neutral)
        }
    }

    /// The registration duplicate check (`POST /api/patients/match`) for a share.
    public static func matchQuery(_ p: AbdmSharedProfile) -> (firstName: String, lastName: String, dateOfBirth: String?, phone: String?) {
        let (first, last) = Abha.splitName(first: p.firstName, last: p.lastName, full: p.fullName)
        return (first, last, p.dateOfBirth, Abha.mobile(p.mobile))
    }

    private static func nameWords(_ parts: [String?]) -> [String] {
        parts.compactMap { $0 }.joined(separator: " ").lowercased()
            .split { !($0.isLetter || $0.isNumber) }.map(String.init).filter { $0.count >= 3 }
    }

    /// A word in common, or one a prefix of the other ("Ravi" / "Ravindran").
    private static func overlap(_ a: [String], _ b: [String]) -> Bool {
        a.contains { x in b.contains { y in x.hasPrefix(y) || y.hasPrefix(x) } }
    }

    /// The MPI's matches for a share, same mobile first and then by the
    /// server's score — a family can share a mobile, so the reasons are
    /// shown, not assumed.
    public static func rank(_ p: AbdmSharedProfile, _ matches: [PatientMatch]) -> [ShareCandidate] {
        let phone = Abha.mobile(p.mobile)
        let shared = nameWords([p.firstName, p.middleName, p.lastName, p.fullName])
        return matches.map { m in
            ShareCandidate(
                match: m,
                sameMobile: phone != nil && Abha.mobile(m.phone) == phone,
                sameDob: p.dateOfBirth != nil && m.dateOfBirth == p.dateOfBirth,
                similarName: overlap(shared, nameWords([m.firstName, m.lastName]))
            )
        }
        .sorted { a, b in a.sameMobile != b.sameMobile ? a.sameMobile : a.match.score > b.match.score }
    }

    /// Probably the same person, so registering would make a second UHID:
    /// the same mobile with a similar name or the same date of birth, or a
    /// similar name born the same day.
    public static func likelyDuplicates(_ p: AbdmSharedProfile, _ matches: [PatientMatch]) -> [ShareCandidate] {
        rank(p, matches).filter(\.isLikely)
    }

    public enum Intent: Sendable { case register, compare }

    /// Where a verified share goes next.
    public enum Next: Equatable, Sendable {
        case compare(patientId: String, notice: String?)
        case register
    }

    /// The ABHA's own patient wins over one picked by search: it may have
    /// been linked at another counter since the queue loaded.
    public static func next(intent: Intent, sharePatientId: String?, alreadyLinked: AbhaLinkedPatient?, picked: String?) -> Next? {
        let owner = sharePatientId ?? alreadyLinked?.patientId ?? picked
        let uhid = alreadyLinked?.uhid ?? "another patient"
        if let picked, let owner, owner != picked {
            return .compare(patientId: owner, notice: "This ABHA is already on \(uhid); compare that record.")
        }
        if let owner {
            return .compare(patientId: owner, notice: intent == .register ? "This ABHA is already on \(uhid); compare and link." : nil)
        }
        return intent == .compare ? nil : .register
    }
}

/// A possible existing patient from `POST /api/patients/match`.
public struct PatientMatch: Hashable, Sendable {
    public let id: String
    public let uhid: String
    public let firstName: String
    public let lastName: String
    public let dateOfBirth: String?
    public let phone: String
    public let score: Double

    public init(id: String, uhid: String, firstName: String, lastName: String, dateOfBirth: String?, phone: String, score: Double) {
        self.id = id
        self.uhid = uhid
        self.firstName = firstName
        self.lastName = lastName
        self.dateOfBirth = dateOfBirth
        self.phone = phone
        self.score = score
    }
}

public struct ShareCandidate: Hashable, Sendable, Identifiable {
    public let match: PatientMatch
    public let sameMobile: Bool
    public let sameDob: Bool
    public let similarName: Bool

    public var id: String { match.id }
    public var isLikely: Bool { (sameMobile && (similarName || sameDob)) || (sameDob && similarName) }
    /// What it matched on, in words.
    public var reasons: [String] {
        [sameMobile ? "Mobile" : nil, sameDob ? "Date of birth" : nil, similarName ? "Name" : nil].compactMap { $0 }
    }
}

/// The ABHA profile as the patient shared it.
public struct AbdmSharedProfile: Decodable, Hashable, Sendable {
    public let abhaNumber: String?
    public let abhaAddress: String
    public let fullName: String?
    public let firstName: String?
    public let middleName: String?
    public let lastName: String?
    public let gender: String?
    public let dateOfBirth: String?
    public let yearOfBirth: String?
    public let mobile: String?
    public let address: String?
    public let district: String?
    public let state: String?
    public let pincode: String?
    public let counter: String?
}

public struct AbdmProfileShare: Decodable, Hashable, Sendable, Identifiable {
    public let id: String
    public let stationId: String?
    public let counterName: String?
    public let tokenNumber: String?
    public let status: String
    public let abhaNumber: String?
    public let abhaAddress: String
    public let profile: AbdmSharedProfile
    /// The patient whose verified ABHA this is, or who was registered from it.
    public let patientId: String?
    public let patientUhid: String?
    public let patientName: String?
    public let expiresAt: String
    public let createdAt: String
}
