//! Leak suite: realistic Indian records, and nothing identifying may reach the
//! model payload. These cases seed the AI eval harness.

use chrono::NaiveDate;

use super::{Kind, KnownIdentifiers, PseudonymMap, Redactor, StreamRehydrator};

fn today() -> NaiveDate {
    NaiveDate::from_ymd_opt(2026, 10, 25).unwrap_or_default()
}

/// The patient's own record, as the assistant would load it.
fn kavitha() -> KnownIdentifiers {
    let mut k = KnownIdentifiers::default();
    k.add(Kind::Patient, Some("Kavitha Subramanian"));
    k.add(Kind::Relative, Some("Murugan Subramanian"));
    k.add(Kind::Relative, Some("Selvi Ramasamy"));
    k.add(Kind::Phone, Some("9840012345"));
    k.add(Kind::Uhid, Some("AMH-2026-004512"));
    k.add(Kind::Abha, Some("91-4411-2233-5566"));
    k.add(Kind::AbhaAddress, Some("kavitha.s@abdm"));
    k.add(Kind::Address, Some("14, Kamaraj Salai, Mylapore"));
    k.add(Kind::Staff, Some("Priya Venkatesan"));
    k
}

fn assert_absent(out: &str, secrets: &[&str]) {
    let lower = out.to_lowercase();
    for s in secrets {
        assert!(
            !lower.contains(&s.to_lowercase()),
            "LEAK of {s:?} in:\n{out}"
        );
    }
}

#[test]
fn a_tamil_nursing_note_leaves_no_one_identifiable() {
    let mut r = Redactor::new(PseudonymMap::default(), &kavitha(), today());
    let note = "Kavitha c/o chest pain since 2 days. Husband Murugan says she missed metformin. \
        Mother Selvi Ramasamy at bedside, mob 98400 12345. Seen by Dr Arunachalam Pillai. \
        Discussed with Sr. Priya Venkatesan. UHID AMH-2026-004512, ABHA 91-4411-2233-5566 \
        (kavitha.s@abdm). Address 14, Kamaraj Salai, Mylapore. K+ 5.9, creatinine 1.8, \
        BP 150/90. Admitted 22/10/2026.";
    let out = r
        .redact(note)
        .map(|x| x.for_model().to_owned())
        .unwrap_or_default();
    assert_absent(
        &out,
        &[
            "Kavitha",
            "Subramanian",
            "Murugan",
            "Selvi",
            "Ramasamy",
            "98400",
            "12345",
            "Arunachalam",
            "Pillai",
            "Priya",
            "Venkatesan",
            "AMH-2026",
            "4411",
            "kavitha.s",
            "Kamaraj",
            "Mylapore",
            "22/10/2026",
        ],
    );
    // The clinical content the model needs survives.
    for keep in [
        "chest pain",
        "metformin",
        "K+ 5.9",
        "creatinine 1.8",
        "BP 150/90",
    ] {
        assert!(out.contains(keep), "lost {keep:?}:\n{out}");
    }
    assert!(
        out.contains("[PATIENT_1]") && out.contains("[DATE_-3d]"),
        "{out}"
    );
}

#[test]
fn a_hindi_billing_note_hides_every_number_that_identifies_or_pays() {
    let mut r = Redactor::new(
        PseudonymMap::default(),
        &KnownIdentifiers::default(),
        today(),
    );
    let note = "Smt Sunita Devi W/o Ramesh Kumar Yadav. Aadhaar 4991 1866 5246, PAN ABCPY1234K, \
        voter id XYZ1234567, passport K1234567, DL MH12 2015 0012345, vehicle MH 12 AB 1234. \
        Paid ₹12,500 via UPI sunita.yadav@okaxis, card 4111 1111 1111 1111, a/c no 123456789012 \
        IFSC SBIN0001234. Star Health policy no SH/2026/778899, claim no CLM-99812, TPA member id \
        MDI445566. GSTIN 27ABCPY1234K1Z5, invoice no INV-2026-0042. From 10.0.0.12, \
        email sunita.devi@gmail.com, pin code 411001, DOB 12-03-1979.";
    let out = r
        .redact(note)
        .map(|x| x.for_model().to_owned())
        .unwrap_or_default();
    assert_absent(
        &out,
        &[
            "Sunita",
            "Ramesh",
            "Yadav",
            "4991",
            "5246",
            "ABCPY1234K",
            "XYZ1234567",
            "K1234567",
            "0012345",
            "AB 1234",
            "12,500",
            "okaxis",
            "4111",
            "123456789012",
            "SBIN0001234",
            "778899",
            "99812",
            "445566",
            "27ABCPY",
            "0042",
            "10.0.0.12",
            "gmail",
            "411001",
            "12-03-1979",
        ],
    );
    assert!(out.contains("[AADHAAR_1]") && out.contains("[CARD_1]") && out.contains("[UPI_1]"));
    assert!(
        out.contains("policy no [POLICY_1]"),
        "keyword kept for context: {out}"
    );
}

#[test]
fn identity_fields_of_a_record_go_and_the_clinical_facts_stay() {
    let mut r = Redactor::new(
        PseudonymMap::default(),
        &KnownIdentifiers::default(),
        today(),
    );
    let record = r#"{"first_name":"Lakshmi","last_name":"Narayanan","father_name":"Gopal Iyer",
        "phone":"9123456780","date_of_birth":"1980-11-02","uhid":"UH-77","photo_url":"https://x/p.jpg",
        "allergies":[{"name":"Penicillin","severity":"severe"}],"hb":9.1,
        "notes":"Lakshmi's father Gopal reports fever"}"#;
    let out = r
        .redact(record)
        .map(|x| x.for_model().to_owned())
        .unwrap_or_default();
    assert_absent(
        &out,
        &[
            "Lakshmi",
            "Narayanan",
            "Gopal",
            "9123456780",
            "1980-11-02",
            "UH-77",
            "p.jpg",
        ],
    );
    assert!(
        out.contains("Penicillin") && out.contains("9.1") && out.contains("[AGE 45y]"),
        "{out}"
    );
    assert!(out.contains("[ATTACHMENT_WITHHELD]"));
}

#[test]
fn a_record_cut_short_is_still_redacted() {
    let mut r = Redactor::new(
        PseudonymMap::default(),
        &KnownIdentifiers::default(),
        today(),
    );
    let cut = r#"[{"id":"1","full_name":"Ravi Kum"#;
    let out = r
        .redact(cut)
        .map(|x| x.for_model().to_owned())
        .unwrap_or_default();
    assert_absent(&out, &["Ravi"]);
}

#[test]
fn placeholders_are_stable_and_the_answer_is_rehydrated_for_the_user() {
    let mut r = Redactor::new(PseudonymMap::default(), &kavitha(), today());
    let first = r
        .redact("Kavitha's husband Murugan called")
        .map(|x| x.for_model().to_owned());
    let second = r
        .redact("Does Kavitha need dialysis?")
        .map(|x| x.for_model().to_owned());
    assert_eq!(
        first.as_deref().ok(),
        Some("[PATIENT_1]'s husband [RELATIVE_1] called")
    );
    assert_eq!(
        second.as_deref().ok(),
        Some("Does [PATIENT_1] need dialysis?")
    );
    // A later turn restored from the stored map keeps the same placeholders.
    let mut later = Redactor::new(r.map().clone(), &kavitha(), today());
    let third = later
        .redact("Kavitha again")
        .map(|x| x.for_model().to_owned());
    assert_eq!(third.as_deref().ok(), Some("[PATIENT_1] again"));
    let answer = "[PATIENT_1] should be reviewed; inform [RELATIVE_1].";
    assert_eq!(
        later.rehydrate(answer),
        "Kavitha Subramanian should be reviewed; inform Murugan Subramanian."
    );
}

#[test]
fn a_streamed_placeholder_split_across_chunks_is_rehydrated_whole() {
    let mut r = Redactor::new(PseudonymMap::default(), &kavitha(), today());
    let _ = r.redact("Kavitha");
    let mut s = StreamRehydrator::default();
    let mut shown = String::new();
    for chunk in ["Review [PATI", "ENT_1] to", "day. [unclosed"] {
        shown.push_str(&s.push(chunk, r.map()));
    }
    shown.push_str(&s.finish(r.map()));
    assert_eq!(shown, "Review Kavitha Subramanian today. [unclosed");
}

#[test]
fn clinical_numbers_and_dosing_survive() {
    let mut r = Redactor::new(
        PseudonymMap::default(),
        &KnownIdentifiers::default(),
        today(),
    );
    let q = "BP 120/80, potassium 5.6, dose 500 mg every 8 hours, platelets 250000, HbA1c 7.2";
    assert_eq!(
        r.redact(q)
            .map(|x| x.for_model().to_owned())
            .ok()
            .as_deref(),
        Some(q)
    );
}

#[test]
fn amounts_stay_only_when_the_task_needs_them() {
    let mut plain = Redactor::new(
        PseudonymMap::default(),
        &KnownIdentifiers::default(),
        today(),
    );
    let mut billing = plain.clone().keeping_amounts();
    let text = "Deposit Rs 20,000 collected";
    assert!(
        !plain
            .redact(text)
            .map(|x| x.for_model().to_owned())
            .unwrap_or_default()
            .contains("20,000")
    );
    assert!(
        billing
            .redact(text)
            .map(|x| x.for_model().to_owned())
            .unwrap_or_default()
            .contains("20,000")
    );
}

/// Fail closed: if a known identifier is still there after redaction, the
/// call is refused (an error), never sent.
#[test]
fn an_identifier_that_survives_refuses_the_call() {
    let r = Redactor::new(PseudonymMap::default(), &kavitha(), today());
    assert_eq!(
        r.verify("note about Kavitha"),
        Err(super::RedactError::Residual(Kind::Patient))
    );
    assert_eq!(r.verify("note about [PATIENT_1]"), Ok(()));
}

#[test]
fn care_of_is_not_complains_of() {
    let mut r = Redactor::new(
        PseudonymMap::default(),
        &KnownIdentifiers::default(),
        today(),
    );
    let out = r
        .redact("C/o Chest pain, S/o Venkat Raman")
        .map(|x| x.for_model().to_owned());
    assert_eq!(
        out.ok().as_deref(),
        Some("C/o Chest pain, S/o [RELATIVE_1]")
    );
}

#[test]
fn numbers_typed_in_a_question_are_replaced() {
    let mut r = Redactor::new(
        PseudonymMap::default(),
        &KnownIdentifiers::default(),
        today(),
    );
    let q = "Patient on 98765 43210? no, +91 9876543210, Aadhaar 4991 1866 5246, \
        ABHA 12-3456-7890-1234, mail a@b.in";
    let out = r
        .redact(q)
        .map(|x| x.for_model().to_owned())
        .unwrap_or_default();
    assert_absent(
        &out,
        &["98765", "9876543210", "4991", "3456-7890", "a@b.in"],
    );
    assert!(out.contains("[PHONE_1]") && out.contains("[AADHAAR_1]") && out.contains("[ABHA_1]"));
}

#[test]
fn a_restricted_class_never_reaches_the_model_unless_the_text_is_a_topic() {
    let mut record = Redactor::new(PseudonymMap::default(), &kavitha(), today());
    let out = record
        .redact(r#"[{"description":"Type 2 diabetes"},{"description":"HIV disease","icd_code":"B20"}]"#)
        .map(|x| x.for_model().to_owned())
        .unwrap_or_default();
    assert!(out.contains("Type 2 diabetes") && !out.contains("HIV"), "{out}");
    let mut topic = Redactor::new(PseudonymMap::default(), &KnownIdentifiers::default(), today())
        .allowing_clinical_topics();
    let course = topic.redact("A course on HIV counselling for nurses").map(|x| x.for_model().to_owned());
    assert_eq!(course.ok().as_deref(), Some("A course on HIV counselling for nurses"));
}

#[test]
fn an_iso_timestamp_has_its_date_shifted_and_keeps_its_time() {
    let mut r = Redactor::new(PseudonymMap::default(), &KnownIdentifiers::default(), today());
    let text = "Seen 2026-10-24T22:00, record created 2026-10-22T08:15:30.5+05:30.";
    let out = r.redact(text).map(|t| t.for_model().to_owned()).unwrap_or_default();
    assert_absent(&out, &["2026-10-24", "2026-10-22"]);
    assert!(out.contains("[DATE_-1d]T22:00") && out.contains("[DATE_-3d]T08:15:30.5+05:30"), "{out}");
    assert_eq!(r.rehydrate(&out), text);
}

#[test]
fn a_relative_named_in_tamil_or_hindi_script_is_redacted() {
    let mut r = Redactor::new(PseudonymMap::default(), &KnownIdentifiers::default(), today());
    let note = "காய்ச்சல் 101 F. மனைவி செல்வி அழைத்தார். पत्नी सुनीता ने फोन किया।";
    let out = r.redact(note).map(|t| t.for_model().to_owned()).unwrap_or_default();
    assert_absent(&out, &["செல்வி", "सुनीता"]);
    assert!(out.contains("காய்ச்சல் 101 F") && out.contains("[RELATIVE_2]"), "{out}");
}
