import Foundation

/// NHA's M1 rules for what the desk types, and NHA's exact words when it is
/// wrong. The server's `medbrains_abdm::rules` is the authority and refuses
/// the same; this mirror lets the screen say so before anything is sent. The
/// web (`components/abha/abhaRules.ts`) and Android (`com.medbrains.kit.AbhaRules`)
/// keep identical copies — change all four together.
public enum AbhaRules {
    /// NHA's words (CRT_ABHA_104, 106, 112, VRFY_ABHA_301, 307), verbatim.
    public static let aadhaarInvalid = "Aadhaar Number is not valid"
    public static let mobileInvalid = "Please enter a valid mobile number."
    public static let otpInvalid = "Invalid OTP. Please enter a valid OTP."
    public static let resendLocked = "Maximum OTP resend attempts reached. Please try again after 30 mins"
    public static let addressTaken = "ABHA address already exists."

    private static let d: [[Int]] = [
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
        [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
        [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
        [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
        [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
    ]
    private static let p: [[Int]] = [
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
        [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
        [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 3, 2, 7, 6, 5, 8, 1, 0, 9],
        [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 5, 8, 3, 2],
    ]

    /// Whether `digits` (check digit last) passes Verhoeff, UIDAI's Aadhaar check.
    public static func verhoeffOk(_ digits: String) -> Bool {
        guard !digits.isEmpty, digits.allSatisfy({ $0.isASCII && $0.isNumber }) else { return false }
        var c = 0
        for (i, ch) in digits.reversed().enumerated() {
            c = d[c][p[i % 8][Int(String(ch)) ?? 0]]
        }
        return c == 0
    }

    /// The typed text without spaces — the only separator the desk may type.
    private static func withoutSpaces(_ typed: String) -> String { typed.filter { !$0.isWhitespace } }

    /// A valid Aadhaar number: 12 digits (spaces allowed) passing Verhoeff (CRT_ABHA_104).
    public static func isValidAadhaar(_ typed: String) -> Bool {
        let digits = withoutSpaces(typed)
        return digits.count == 12 && verhoeffOk(digits)
    }

    /// A valid mobile: exactly 10 digits, spaces allowed, nothing else (VRFY_ABHA_301).
    public static func isValidMobile(_ typed: String) -> Bool {
        let digits = withoutSpaces(typed)
        return digits.count == 10 && digits.allSatisfy { $0.isASCII && $0.isNumber }
    }

    /// The part before the `@`, whether or not the desk typed `@{domain}`.
    public static func addressName(_ typed: String, domain: String) -> String {
        let t = typed.trimmingCharacters(in: .whitespaces)
        return t.hasSuffix("@\(domain)") ? String(t.dropLast(domain.count + 1)) : t
    }

    /// Each CRT_ABHA_112 rule for `name@{domain}`, in the words and order shown.
    public static func addressChecklist(_ name: String, domain: String) -> [AbhaAddressRule] {
        let total = name.count + 1 + domain.count
        let alnum = { (c: Character) in c.isASCII && (c.isLetter || c.isNumber) }
        let special = { (c: Character?) in c == "." || c == "_" }
        return [
            AbhaAddressRule(label: "8–18 characters, including @\(domain)", met: (8...18).contains(total)),
            AbhaAddressRule(label: "Letters and numbers only, besides . and _", met: name.allSatisfy { alnum($0) || special($0) } && name.contains(where: alnum)),
            AbhaAddressRule(label: "At most one dot (.)", met: name.filter { $0 == "." }.count <= 1),
            AbhaAddressRule(label: "At most one underscore (_)", met: name.filter { $0 == "_" }.count <= 1),
            AbhaAddressRule(label: "No . or _ at the start or end", met: !special(name.first) && !special(name.last)),
        ]
    }

    /// Whether every address rule is met.
    public static func isValidAddress(_ name: String, domain: String) -> Bool {
        addressChecklist(name, domain: domain).allSatisfy(\.met)
    }

    /// ABDM's refusal as the server words it: ABDM's own message, then on the
    /// next line our hint (with the code).
    public static func splitAbdmMessage(_ detail: String) -> (message: String, hint: String?) {
        guard let at = detail.firstIndex(of: "\n") else { return (detail, nil) }
        return (String(detail[..<at]), String(detail[detail.index(after: at)...]))
    }
}

/// One ABHA address rule and whether the typed address meets it.
public struct AbhaAddressRule: Hashable, Sendable {
    public let label: String
    public let met: Bool
}
