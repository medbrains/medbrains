import Foundation

/// ABHA at the desk, as the web's `components/abha` applies it: what ABDM
/// verified beside what the desk holds, which of them to keep, and the
/// registration values that follow. The server verifies, links and owns the
/// record; this only shapes what is shown and sent. Android keeps the same
/// rules in `com.medbrains.kit.Abha`.
public enum Abha {
    public static let otpLength = 6
    public static let aadhaarLength = 12
    public static let abhaNumberLength = 14
    public static let mobileLength = 10

    /// The digits of whatever was typed or sent ("91-1111-2222-3333").
    public static func digits(_ text: String) -> String { text.filter(\.isASCII).filter(\.isNumber) }

    /// An OTP as it is typed: digits only, never more than ABDM sends.
    public static func otpInput(_ text: String) -> String { String(digits(text).prefix(otpLength)) }

    /// An Aadhaar number as it is typed: digits only, at most twelve. It is
    /// held only by the screen that asks for it and is never stored.
    public static func aadhaarInput(_ text: String) -> String { String(digits(text).prefix(aadhaarLength)) }

    public static func mobileInput(_ text: String) -> String { String(digits(text).prefix(mobileLength)) }

    /// A 10-digit Indian mobile from whatever was sent, or nil (a masked
    /// "XXXXXX1234" is not a number the desk can call).
    public static func mobile(_ text: String?) -> String? {
        let d = digits(text ?? "")
        return d.count >= mobileLength ? String(d.suffix(mobileLength)) : nil
    }

    /// Why the lookup cannot be sent yet, or nil.
    public static func lookupProblem(_ method: AbhaVerifyMethod, _ value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespaces)
        switch method {
        case .abhaNumber: return digits(trimmed).count == abhaNumberLength ? nil : "An ABHA number is 14 digits"
        case .mobile: return digits(trimmed).count == mobileLength ? nil : "Enter the 10-digit mobile"
        case .abhaAddress: return trimmed.isEmpty || trimmed.contains(" ") ? "Enter the ABHA address, e.g. priya.v@abdm" : nil
        }
    }

    /// An ABHA address the patient chose: letters, numbers, dot or
    /// underscore; ABDM adds the @ part.
    public static func addressProblem(_ address: String) -> String? {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "._"))
        if address.isEmpty { return "Choose or type an ABHA address" }
        return address.unicodeScalars.allSatisfy { $0.isASCII && allowed.contains($0) } ? nil : "Letters, numbers, dot or underscore only"
    }

    private static func clean(_ text: String?) -> String {
        (text ?? "").split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }

    private static func name(_ parts: String?...) -> String { parts.map(clean).filter { !$0.isEmpty }.joined(separator: " ") }

    /// ABHA's details beside ours, the rows the desk compares.
    public static func compareRows(_ profile: AbhaVerifiedProfile, ours: OurDetails) -> [AbhaCompareRow] {
        let abhaName = name(profile.firstName, profile.middleName, profile.lastName)
        return [
            AbhaCompareRow(field: .name, label: "Name", abha: abhaName.isEmpty ? clean(profile.fullName) : abhaName, ours: name(ours.firstName, ours.middleName, ours.lastName)),
            AbhaCompareRow(field: .dateOfBirth, label: "Date of birth", abha: clean(profile.dateOfBirth).isEmpty ? clean(profile.yearOfBirth) : clean(profile.dateOfBirth), ours: clean(ours.dateOfBirth)),
            AbhaCompareRow(field: .gender, label: "Gender", abha: clean(profile.gender), ours: clean(ours.gender)),
        ]
    }

    /// At registration, ABHA's value wherever ours is blank or different,
    /// until the desk says otherwise.
    public static func defaultApply(_ profile: AbhaVerifiedProfile, ours: OurDetails) -> Set<AbhaField> {
        Set(compareRows(profile, ours: ours).filter(\.differs).map(\.field))
    }

    /// The registration draft's values once a verified ABHA is used: the
    /// ABHA itself always, and each detail only where the desk chose ABHA's.
    public static func appliedValues(_ profile: AbhaVerifiedProfile, apply: Set<AbhaField>) -> [String: String] {
        var values = ["abha_number": digits(profile.abhaNumber), "abha_address": profile.abhaAddress ?? ""]
        if apply.contains(.name) {
            if let first = profile.firstName { values["first_name"] = first }
            values["middle_name"] = profile.middleName ?? ""
            if let last = profile.lastName { values["last_name"] = last }
        }
        if apply.contains(.dateOfBirth), let dob = profile.dateOfBirth { values["date_of_birth"] = dob }
        if apply.contains(.gender), let gender = profile.gender { values["gender"] = gender }
        return values
    }

    /// The registration form pre-filled from a share the server verified —
    /// the profile the server recorded, never one the phone holds.
    public static func sharePrefill(_ profile: AbhaVerifiedProfile) -> [String: String] {
        let (first, last) = splitName(first: profile.firstName, last: profile.lastName, full: profile.fullName)
        let pairs: [(String, String?)] = [
            ("first_name", first), ("middle_name", profile.middleName), ("last_name", last),
            ("gender", profile.gender), ("date_of_birth", profile.dateOfBirth), ("phone", mobile(profile.mobileMasked)),
            ("abha_number", digits(profile.abhaNumber)), ("abha_address", profile.abhaAddress),
            ("address.line1", profile.address), ("address.district", profile.district),
            ("address.state", profile.state), ("address.postal_code", profile.pincode),
            ("registration_source", "mobile_app"),
        ]
        return pairs.reduce(into: [:]) { out, pair in
            if let v = pair.1, !v.isEmpty { out[pair.0] = v }
        }
    }

    /// Given and family name from the parts, or else from the full name.
    public static func splitName(first: String?, last: String?, full: String?) -> (String, String) {
        if let first { return (first, last ?? "") }
        let words = (full ?? "").split(whereSeparator: \.isWhitespace).map(String.init)
        return (words.first ?? "", words.count > 1 ? words.last ?? "" : "")
    }

    /// The verification to send with a registration: only while the ABHA
    /// number on the form is still the one that was verified. An edited
    /// number is registered unverified, never linked on a stale proof.
    public static func verificationToSend(_ verified: VerifiedAbha?, abhaNumber: String) -> String? {
        guard let verified, verified.digits == digits(abhaNumber) else { return nil }
        return verified.id
    }

    public static func resendLabel(wait: Int) -> String { wait > 0 ? "Resend OTP in \(wait)s" : "Resend OTP" }

    /// ABDM allows "Resend OTP" twice per OTP (M1 CRT_ABHA_106, VRFY_ABHA_405);
    /// the server enforces it. `nil` when nothing needs saying.
    public static func resendNote(left: Int?) -> String? {
        switch left {
        case 0?: "The OTP cannot be sent again. If it has not arrived, close this and start again."
        case 1?: "One resend left"
        case let n?: "\(n) resends left"
        case nil: nil
        }
    }

    /// ABDM's terms and conditions for creating an ABHA with Aadhaar, verbatim
    /// (nha-in/docs catalogue/hiecm/concepts/m1-abha-consent.md (docs.abdm.gov.in, M1 page), CRT_ABHA_102). Never edited (NHA M1 observations, 2 Oct 2026); the server
    /// sends consent code "abha-enrollment", version `enrolConsentVersion`.
    /// Keep identical to the web and Android copies.
    public static let enrolConsent = "I, hereby declare that I am voluntarily sharing my Aadhaar number and demographic information issued by UIDAI, with National Health Authority (NHA) for the sole purpose of creation of ABHA number. I understand that my ABHA number can be used and shared for purposes as may be notified by ABDM from time to time including provision of healthcare services. Further, I am aware that my personal identifiable information (Name, Address, Age, Date of Birth, Gender and Photograph) may be made available to the entities working in the National Digital Health Ecosystem (NDHE) which inter alia includes stakeholders and entities such as healthcare professionals (e.g. doctors), facilities (e.g. hospitals, laboratories) and data fiduciaries (e.g. health programmes), which are registered with or linked to the Ayushman Bharat Digital Mission (ABDM), and various processes there under. I authorize NHA to use my Aadhaar number for performing Aadhaar based authentication with UIDAI as per the provisions of the Aadhaar (Targeted Delivery of Financial and other Subsidies, Benefits and Services) Act, 2016 for the aforesaid purpose. I understand that UIDAI will share my e-KYC details, or response of “Yes” with NHA upon successful authentication. I have been duly informed about the option of using other IDs apart from Aadhaar; however, I consciously choose to use Aadhaar number for the purpose of availing benefits across the NDHE. I am aware that my personal identifiable information excluding Aadhaar number / VID number can be used and shared for purposes as mentioned above. I reserve the right to revoke the given consent at any point of time as per provisions of Aadhaar Act and Regulations."
    public static let enrolConsentVersion = "1.4"
}

/// A verification the desk used: its id, and the ABHA number it proved.
public struct VerifiedAbha: Hashable, Sendable {
    public let id: String
    public let digits: String

    public init(id: String, abhaNumber: String) {
        self.id = id
        self.digits = Abha.digits(abhaNumber)
    }
}

public struct AbhaCompareRow: Hashable, Sendable {
    public let field: AbhaField
    public let label: String
    public let abha: String
    public let ours: String

    public var matches: Bool { abha.lowercased() == ours.lowercased() }
    /// ABHA says something, and not what we hold: the desk must choose.
    public var differs: Bool { !abha.isEmpty && !matches }
}

/// The patient's details as they stand on our side.
public struct OurDetails: Hashable, Sendable {
    public var firstName: String?
    public var middleName: String?
    public var lastName: String?
    /// YYYY-MM-DD
    public var dateOfBirth: String?
    public var gender: String?

    public init(firstName: String?, middleName: String? = nil, lastName: String?, dateOfBirth: String?, gender: String?) {
        self.firstName = firstName
        self.middleName = middleName
        self.lastName = lastName
        self.dateOfBirth = dateOfBirth
        self.gender = gender
    }
}

/// How the desk finds the person's ABHA.
public enum AbhaVerifyMethod: String, CaseIterable, Codable, Hashable, Sendable {
    case abhaNumber = "abha_number", mobile, abhaAddress = "abha_address"

    public var label: String {
        switch self {
        case .abhaNumber: "ABHA number"
        case .mobile: "Mobile"
        case .abhaAddress: "ABHA address"
        }
    }
}

/// Where ABDM sends the OTP for an ABHA number or address lookup.
public enum AbhaOtpVia: String, CaseIterable, Codable, Hashable, Sendable {
    case aadhaar, abdm
}

/// Demographics the desk may take from ABHA.
public enum AbhaField: String, Codable, Hashable, Sendable {
    case name, dateOfBirth = "date_of_birth", gender
}

public enum AbhaStage: String, Sendable {
    case otpSent = "otp_sent", mobileOtpSent = "mobile_otp_sent", chooseAccount = "choose_account", chooseAddress = "choose_address", verified
}

public struct AbhaAccountChoice: Decodable, Hashable, Sendable {
    public let abhaNumber: String
    public let abhaAddress: String?
    public let name: String?
    public let gender: String?
    public let yearOfBirth: String?
}

/// What ABDM holds for the person, in our patient shape.
public struct AbhaVerifiedProfile: Decodable, Hashable, Sendable {
    public let abhaNumber: String
    public let abhaAddress: String?
    public let fullName: String?
    public let firstName: String?
    public let middleName: String?
    public let lastName: String?
    public let dateOfBirth: String?
    public let yearOfBirth: String?
    public let gender: String?
    public let mobileMasked: String?
    public let email: String?
    public let address: String?
    public let pincode: String?
    public let state: String?
    public let district: String?
    public let kycVerified: Bool
    /// Base64 JPEG, shown to confirm the person; never stored.
    public let photo: String?
}

public struct AbhaLinkedPatient: Decodable, Hashable, Sendable {
    public let patientId: String
    public let uhid: String
    public let name: String
}

public struct AbhaVerificationStep: Decodable, Hashable, Sendable {
    public let id: String
    public let stage: String
    public let message: String?
    public let resendAfterSeconds: Int?
    /// Resends ABDM still allows for this OTP; `nil` when none is waiting.
    public let resendsLeft: Int?
    public let accounts: [AbhaAccountChoice]
    public let profile: AbhaVerifiedProfile?
    /// Another patient here already carries this ABHA.
    public let alreadyLinked: AbhaLinkedPatient?
    /// ABHA addresses ABDM suggests, when creating one.
    public let suggestions: [String]

    public var stageKind: AbhaStage? { AbhaStage(rawValue: stage) }
}
