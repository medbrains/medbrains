import XCTest
@testable import MedBrainsKit

/// The desk's ABHA rules, the same decisions the web's `AbhaCompare` and
/// `scanShare.test.ts` pin and Android's `AbhaTest` repeats.
final class AbhaTests: XCTestCase {
    private func profile(first: String? = "Priya", middle: String? = nil, last: String? = "Venkat", full: String? = nil, dob: String? = "1990-04-12", year: String? = nil, gender: String? = "female", mobile: String? = nil) throws -> AbhaVerifiedProfile {
        var json: [String: Any] = ["abha_number": "91-1111-2222-3333", "abha_address": "priya.v@sbx", "kyc_verified": true]
        let optional: [String: String?] = ["first_name": first, "middle_name": middle, "last_name": last, "full_name": full, "date_of_birth": dob, "year_of_birth": year, "gender": gender, "mobile_masked": mobile]
        for (k, v) in optional { if let v { json[k] = v } }
        return try JSONDecoder.medbrains.decode(AbhaVerifiedProfile.self, from: JSONSerialization.data(withJSONObject: json))
    }

    func testTypedSecretsKeepOnlyDigitsAndNeverRunLong() {
        XCTAssertEqual(Abha.aadhaarInput("1234 5678 9012 99"), "123456789012")
        XCTAssertEqual(Abha.otpInput("12-34 567"), "123456")
        XCTAssertEqual(Abha.mobileInput("+91 98765 43210"), "9198765432", "as typed: the first ten, like the web")
        XCTAssertEqual(Abha.mobile("+91 98765 43210"), "9876543210")
        XCTAssertNil(Abha.mobile("XXXXXX3210"), "a masked mobile is no number to call")
    }

    func testTheLookupSaysWhatIsMissing() {
        XCTAssertNil(Abha.lookupProblem(.abhaNumber, "91-1111-2222-3333"))
        XCTAssertEqual(Abha.lookupProblem(.abhaNumber, "91111122223"), "An ABHA number is 14 digits")
        XCTAssertNil(Abha.lookupProblem(.mobile, "98765 43210"))
        XCTAssertNotNil(Abha.lookupProblem(.mobile, "98765"))
        XCTAssertNil(Abha.lookupProblem(.abhaAddress, "priya.v@abdm"))
        XCTAssertNotNil(Abha.lookupProblem(.abhaAddress, "priya v"))
        XCTAssertNil(Abha.addressProblem("priya_v.90"))
        XCTAssertNotNil(Abha.addressProblem("priya@abdm"))
        XCTAssertNotNil(Abha.addressProblem(""))
    }

    /// Finding by Aadhaar or by mobile (M1 VRFY_ABHA_301–305, 401–405):
    /// each says what it needs, and only a number or address lookup lets the
    /// desk choose where the OTP goes.
    func testFindingByAadhaarOrMobileSaysWhatItNeeds() {
        XCTAssertNil(Abha.lookupProblem(.aadhaar, "1234 5678 9012"))
        XCTAssertEqual(Abha.lookupProblem(.aadhaar, "12345"), "An Aadhaar number is 12 digits")
        XCTAssertNil(Abha.lookupProblem(.findMobile, "98765 43210"))
        XCTAssertEqual(Abha.lookupInput(.aadhaar, "1234-5678-9012-34"), "123456789012", "never more than twelve digits")
        XCTAssertEqual(Abha.lookupInput(.abhaAddress, "priya.v@abdm"), "priya.v@abdm")
        XCTAssertEqual(AbhaVerifyMethod.allCases.filter(Abha.choosesOtpVia), [.abhaNumber, .abhaAddress])
        XCTAssertEqual(AbhaStage(rawValue: "search_results"), .searchResults)
    }

    /// A scanned card leads to verifying its number, else its address; what
    /// it says is shown, never trusted.
    func testAScannedCardLeadsToItsNumberThenItsAddress() throws {
        let decode = { (json: String) in try JSONDecoder.medbrains.decode(AbhaCardQr.self, from: Data(json.utf8)) }
        let full = try decode(#"{"abha_number":"91-4173-3253-1234","abha_address":"x@abdm","name":"Priya V","gender":"female","date_of_birth":"21-11-1990","mobile":null}"#)
        XCTAssertEqual(Abha.lookup(from: full)?.0, .abhaNumber)
        XCTAssertEqual(Abha.lookup(from: full)?.1, "91-4173-3253-1234")
        XCTAssertEqual(Abha.cardSummary(full), "Priya V · female · born 21-11-1990")
        let address = try decode(#"{"abha_number":null,"abha_address":"x@abdm","name":null,"gender":null,"date_of_birth":null,"mobile":null}"#)
        XCTAssertEqual(Abha.lookup(from: address)?.0, .abhaAddress)
        XCTAssertEqual(Abha.cardSummary(address), "The card names an ABHA but no details.")
    }

    func testRowsDifferOnlyWhereAbhaSaysSomethingElse() throws {
        let p = try profile(middle: "K")
        let rows = Abha.compareRows(p, ours: OurDetails(firstName: " priya ", middleName: "k", lastName: "venkat", dateOfBirth: nil, gender: "female"))
        XCTAssertEqual(rows.map(\.abha), ["Priya K Venkat", "1990-04-12", "female"])
        XCTAssertEqual(rows.map(\.differs), [false, true, false], "case and spacing are not a difference; a blank of ours is")
        XCTAssertEqual(Abha.defaultApply(p, ours: OurDetails(firstName: "Priya", middleName: "K", lastName: "Venkat", dateOfBirth: nil, gender: "female")), [.dateOfBirth])
    }

    func testTheYearStandsInWhenAbdmHasNoWholeDate() throws {
        let rows = Abha.compareRows(try profile(dob: nil, year: "1990"), ours: OurDetails(firstName: nil, lastName: nil, dateOfBirth: nil, gender: nil))
        XCTAssertEqual(rows[1].abha, "1990")
    }

    func testUsingAVerifiedAbhaTakesOnlyTheChosenDetails() throws {
        let p = try profile()
        XCTAssertEqual(Abha.appliedValues(p, apply: []), ["abha_number": "91111122223333", "abha_address": "priya.v@sbx"])
        let all = Abha.appliedValues(p, apply: [.name, .dateOfBirth, .gender])
        XCTAssertEqual(all["first_name"], "Priya")
        XCTAssertEqual(all["middle_name"], "", "the middle name is cleared when ABHA has none")
        XCTAssertEqual(all["date_of_birth"], "1990-04-12")
        XCTAssertEqual(all["gender"], "female")
    }

    func testAShareFillsTheFormFromTheServersProfile() throws {
        let values = Abha.sharePrefill(try profile(first: nil, last: nil, full: "Ravi Kumar Das", gender: "male", mobile: "+91 98765 43210"))
        XCTAssertEqual(values["first_name"], "Ravi")
        XCTAssertEqual(values["last_name"], "Das")
        XCTAssertEqual(values["phone"], "9876543210")
        XCTAssertEqual(values["abha_number"], "91111122223333")
        XCTAssertEqual(values["registration_source"], "mobile_app")
        XCTAssertNil(values["address.line1"], "nothing shared, nothing filled")
    }

    func testAnEditedAbhaNumberIsNeverSentAsVerified() {
        let verified = VerifiedAbha(id: "v1", abhaNumber: "91-1111-2222-3333")
        XCTAssertEqual(Abha.verificationToSend(verified, abhaNumber: "91111122223333"), "v1")
        XCTAssertNil(Abha.verificationToSend(verified, abhaNumber: "91111122223334"))
        XCTAssertNil(Abha.verificationToSend(nil, abhaNumber: "91111122223333"))
    }

    func testTheStepDecodesTheServersShape() throws {
        let json = #"{"id":"v1","stage":"choose_account","message":null,"resend_after_seconds":30,"accounts":[{"abha_number":"91111122223333","abha_address":null,"name":"Priya","gender":"F","year_of_birth":"1990"}],"profile":null,"already_linked":{"patient_id":"p1","uhid":"UH-1","name":"Priya V"},"suggestions":[]}"#
        let step = try JSONDecoder.medbrains.decode(AbhaVerificationStep.self, from: Data(json.utf8))
        XCTAssertEqual(step.stageKind, .chooseAccount)
        XCTAssertEqual(step.alreadyLinked?.uhid, "UH-1")
        XCTAssertEqual(step.accounts.first?.yearOfBirth, "1990")
        XCTAssertEqual(Abha.resendLabel(wait: 12), "Resend OTP in 12s")
        XCTAssertNil(step.resendsLeft, "an older server without the cap still decodes")
    }

    /// ABDM allows two resends; once none are left the screen says so instead of offering one.
    func testResendsLeftDecodeAndAreSaidPlainly() throws {
        let json = #"{"id":"v1","stage":"otp_sent","message":null,"resend_after_seconds":60,"resends_left":0,"accounts":[],"profile":null,"already_linked":null,"suggestions":[]}"#
        let step = try JSONDecoder.medbrains.decode(AbhaVerificationStep.self, from: Data(json.utf8))
        XCTAssertEqual(step.resendsLeft, 0)
        XCTAssertEqual(Abha.resendNote(left: 0), "The OTP cannot be sent again. If it has not arrived, close this and start again.")
        XCTAssertEqual(Abha.resendNote(left: 1), "One resend left")
        XCTAssertNil(Abha.resendNote(left: nil))
    }
}

final class ScanShareTests: XCTestCase {
    private func shared(first: String? = "Ravi", last: String? = "Kumar", dob: String? = "1980-06-15", year: String? = nil, mobile: String? = "9876543210") throws -> AbdmSharedProfile {
        var json: [String: Any] = ["abha_address": "ravi@sbx"]
        let optional: [String: String?] = ["first_name": first, "last_name": last, "date_of_birth": dob, "year_of_birth": year, "mobile": mobile]
        for (k, v) in optional { if let v { json[k] = v } }
        return try JSONDecoder.medbrains.decode(AbdmSharedProfile.self, from: JSONSerialization.data(withJSONObject: json))
    }

    private let today: Date = {
        var c = DateComponents(); c.year = 2026; c.month = 6; c.day = 14
        return Calendar(identifier: .gregorian).date(from: c) ?? Date()
    }()

    func testAgeCountsTheBirthdayAndFallsBackToTheYear() throws {
        let cal = Calendar(identifier: .gregorian)
        XCTAssertEqual(ScanShare.age(dateOfBirth: "1980-06-15", yearOfBirth: nil, today: today, calendar: cal), 45, "a day before the birthday")
        XCTAssertEqual(ScanShare.age(dateOfBirth: "1980-06-14", yearOfBirth: nil, today: today, calendar: cal), 46)
        XCTAssertEqual(ScanShare.age(dateOfBirth: nil, yearOfBirth: "1990", today: today, calendar: cal), 36)
        XCTAssertNil(ScanShare.age(dateOfBirth: nil, yearOfBirth: nil, today: today, calendar: cal))
        XCTAssertEqual(ScanShare.name(try shared(first: nil, last: nil)), "ravi@sbx", "no name shared: the ABHA address")
    }

    func testOnlyAWaitingOrMissedShareCanBeActedOn() {
        XCTAssertTrue(ScanShare.isActionable("waiting"))
        XCTAssertTrue(ScanShare.isActionable("expired"))
        XCTAssertFalse(ScanShare.isActionable("linked"))
        XCTAssertEqual(ScanShare.status("expired").label, "Token expired")
    }

    func testTheSameMobileRanksFirstAndTheLikelyAreNamed() throws {
        let p = try shared()
        let matches = [
            PatientMatch(id: "a", uhid: "U1", firstName: "Anil", lastName: "Rao", dateOfBirth: nil, phone: "9000000000", score: 0.9),
            PatientMatch(id: "b", uhid: "U2", firstName: "Ravindran", lastName: "K", dateOfBirth: nil, phone: "+91 98765 43210", score: 0.4),
            PatientMatch(id: "c", uhid: "U3", firstName: "Meena", lastName: "Kumar", dateOfBirth: "1980-06-15", phone: "9111111111", score: 0.7),
        ]
        let ranked = ScanShare.rank(p, matches)
        XCTAssertEqual(ranked.map(\.id), ["b", "a", "c"])
        XCTAssertEqual(ranked[0].reasons, ["Mobile", "Name"], "Ravi / Ravindran share a prefix")
        XCTAssertEqual(ScanShare.likelyDuplicates(p, matches).map(\.id), ["b", "c"], "same mobile + name, or same birthday + name")
    }

    func testAVerifiedShareGoesToItsOwnPatientFirst() {
        let other = AbhaLinkedPatient(patientId: "p2", uhid: "UH-2", name: "X")
        XCTAssertEqual(ScanShare.next(intent: .register, sharePatientId: nil, alreadyLinked: nil, picked: nil), .register)
        XCTAssertNil(ScanShare.next(intent: .compare, sharePatientId: nil, alreadyLinked: nil, picked: nil))
        XCTAssertEqual(ScanShare.next(intent: .compare, sharePatientId: "p1", alreadyLinked: nil, picked: nil), .compare(patientId: "p1", notice: nil))
        XCTAssertEqual(ScanShare.next(intent: .register, sharePatientId: nil, alreadyLinked: other, picked: nil), .compare(patientId: "p2", notice: "This ABHA is already on UH-2; compare and link."))
        XCTAssertEqual(ScanShare.next(intent: .compare, sharePatientId: nil, alreadyLinked: other, picked: "p9"), .compare(patientId: "p2", notice: "This ABHA is already on UH-2; compare that record."))
        XCTAssertEqual(ScanShare.next(intent: .compare, sharePatientId: nil, alreadyLinked: nil, picked: "p9"), .compare(patientId: "p9", notice: nil))
    }
}
