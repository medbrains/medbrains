use super::oru::observation_groups;
use super::*;

/// A Sysmex-style CBC: five OBX, NTEs, PID-3 with repetitions and components,
/// OBR-3 carrying the barcode as an EI with namespace components.
const CBC: &str = "MSH|^~\\&|XN-1000|HAEM|MEDBRAINS|LAB|20261026101500||ORU^R01|CTRL-77|P|2.5.1\r\
PID|1||UHID-0042^^^MB^MR~AADHAAR-XX^^^UIDAI^NI||Kumar^Rajesh||19800101|M\r\
OBR|1|6f1c0d2a-1111-4c3e-9d6f-0a1b2c3d4e5f|SB240001^XN-1000^L|CBC^Complete blood count|||20261026100000\r\
OBX|1|NM|WBC^White blood cells^99XN||12.4|10*3/uL|4.0-11.0|H|||F\r\
NTE|1||Smear reviewed\r\
NTE|2||Left shift noted\r\
OBX|2|NM|RBC^Red blood cells^99XN||4.82|10*6/uL|4.50-5.90|N|||F\r\
OBX|3|NM|HGB^Haemoglobin^99XN||6.1|g/dL|13.0-17.0|LL|||F\r\
OBX|4|NM|PLT^Platelets^99XN||250|10*3/uL|150-450||||F\r\
OBX|5|NM|HCT^Haematocrit^99XN||44.1|%|40-52|N|||C\r";

#[test]
fn every_obx_of_a_cbc_is_kept_in_order() {
    // The regression: the old flatten keyed fields by `OBX.5`, so a CBC over
    // MLLP posted one parameter -- whichever OBX came last.
    let msg = parse(CBC).expect("parses");
    let groups = observation_groups(&msg);
    assert_eq!(groups.len(), 1);
    let codes: Vec<&str> = groups[0]
        .results
        .iter()
        .map(|o| o.test_code.as_str())
        .collect();
    assert_eq!(codes, ["WBC", "RBC", "HGB", "PLT", "HCT"]);
}

#[test]
fn each_result_keeps_its_unit_range_flag_and_status() {
    let msg = parse(CBC).expect("parses");
    let r = &observation_groups(&msg)[0].results;
    assert_eq!(r[0].value, "12.4");
    assert_eq!(r[0].unit.as_deref(), Some("10*3/uL"));
    assert_eq!(r[0].reference_range.as_deref(), Some("4.0-11.0"));
    assert_eq!(r[0].abnormal_flag.as_deref(), Some("H"));
    assert_eq!(r[0].status.as_deref(), Some("F"));
    assert_eq!(r[0].test_name.as_deref(), Some("White blood cells"));
    assert_eq!(r[2].abnormal_flag.as_deref(), Some("LL"));
    assert_eq!(r[3].abnormal_flag, None, "an empty OBX-8 asserts nothing");
    assert_eq!(r[4].status.as_deref(), Some("C"));
}

#[test]
fn notes_attach_to_the_obx_they_follow() {
    let msg = parse(CBC).expect("parses");
    let r = &observation_groups(&msg)[0].results;
    assert_eq!(
        r[0].notes.as_deref(),
        Some("Smear reviewed\nLeft shift noted")
    );
    assert_eq!(r[1].notes, None);
}

#[test]
fn the_barcode_is_the_first_component_of_obr_3_not_the_whole_field() {
    // `SB240001^XN-1000^L` never equals the stored barcode `SB240001`.
    let msg = parse(CBC).expect("parses");
    let g = &observation_groups(&msg)[0];
    assert_eq!(g.sample_barcode.as_deref(), Some("SB240001"));
    assert_eq!(
        g.placer_order.as_deref(),
        Some("6f1c0d2a-1111-4c3e-9d6f-0a1b2c3d4e5f")
    );
    assert_eq!(
        g.patient_id.as_deref(),
        Some("UHID-0042"),
        "first repetition, first component"
    );
}

#[test]
fn a_message_without_a_barcode_says_so() {
    let raw = "MSH|^~\\&|DEV|LAB|MB|HMS|20261026||ORU^R01|9|P|2.5\rPID|||UHID-7\rOBR|1|||GLU\rOBX|1|NM|GLU||126|mg/dL|70-110|H|||F";
    let g = &observation_groups(&parse(raw).expect("parses"))[0];
    assert_eq!(g.sample_barcode, None);
    assert_eq!(g.patient_id.as_deref(), Some("UHID-7"));
    assert_eq!(g.results.len(), 1);
}

#[test]
fn obx_with_no_obr_still_form_a_group() {
    let raw = "MSH|^~\\&|DEV\rPID|||UHID-7\rOBX|1|NM|GLU||126";
    let groups = observation_groups(&parse(raw).expect("parses"));
    assert_eq!(groups.len(), 1);
    assert_eq!(groups[0].sample_barcode, None);
    assert_eq!(groups[0].results[0].value, "126");
}

#[test]
fn two_orders_in_one_message_stay_apart() {
    let raw = "MSH|^~\\&|C501|CHEM\rPID|||U1\rOBR|1||SB1|LFT\rOBX|1|NM|ALT||40|U/L\r\
               PID|||U2\rOBR|2||SB2|RFT\rOBX|1|NM|CREA||1.1|mg/dL\rOBX|2|NM|UREA||30|mg/dL";
    let groups = observation_groups(&parse(raw).expect("parses"));
    assert_eq!(groups.len(), 2);
    assert_eq!(
        (
            groups[0].sample_barcode.as_deref(),
            groups[0].patient_id.as_deref()
        ),
        (Some("SB1"), Some("U1"))
    );
    assert_eq!(
        (
            groups[1].sample_barcode.as_deref(),
            groups[1].patient_id.as_deref()
        ),
        (Some("SB2"), Some("U2"))
    );
    assert_eq!(groups[1].results.len(), 2);
}

#[test]
fn spm_supplies_the_barcode_when_obr_3_is_empty() {
    let raw = "MSH|^~\\&|COBAS\rOBR|1|||TSH\rSPM|1|SB9&LAB^SB9||SER\rOBX|1|NM|TSH||2.1|mIU/L";
    let g = &observation_groups(&parse(raw).expect("parses"))[0];
    assert_eq!(g.sample_barcode.as_deref(), Some("SB9"));
}

#[test]
fn escape_sequences_are_decoded_after_splitting() {
    let raw = "MSH|^~\\&|DEV\rOBR|1||SB\\S\\1\rOBX|1|ST|CMT||A\\F\\B \\T\\ C\\E\\D\\.br\\next\\X41\\\\H\\bold\\N\\";
    let msg = parse(raw).expect("parses");
    let g = &observation_groups(&msg)[0];
    assert_eq!(
        g.sample_barcode.as_deref(),
        Some("SB^1"),
        "an escaped ^ is data, not a component"
    );
    assert_eq!(g.results[0].value, "A|B & C\\D\nnextAbold");
}

#[test]
fn an_unknown_or_unterminated_escape_is_kept_as_sent() {
    let msg = parse("MSH|^~\\&|DEV").expect("parses");
    assert_eq!(msg.unescape("a\\Zxx\\b"), "a\\Zxx\\b");
    assert_eq!(msg.unescape("50\\"), "50\\");
}

#[test]
fn the_delimiters_come_from_msh_not_from_assumption() {
    // An analyser declaring `#` as field separator and `$` `*` `!` `@` as
    // encoding characters.
    let raw = "MSH#$*!@#ANALYSER#LAB\rOBR#1##SB77$X#CBC\rOBX#1#NM#WBC$White##7.5*7.6#10!S!3/uL#4-11#N###F";
    let msg = parse(raw).expect("parses");
    assert_eq!(msg.delimiters.field, '#');
    assert_eq!(msg.delimiters.component, '$');
    assert_eq!(msg.delimiters.repetition, '*');
    assert_eq!(msg.delimiters.escape, '!');
    assert_eq!(msg.delimiters.subcomponent, '@');
    let g = &observation_groups(&msg)[0];
    assert_eq!(g.sample_barcode.as_deref(), Some("SB77"));
    let obx = &g.results[0];
    assert_eq!(obx.test_name.as_deref(), Some("White"));
    assert_eq!(
        obx.value, "7.5\n7.6",
        "repetitions split on the declared character"
    );
    assert_eq!(
        obx.unit.as_deref(),
        Some("10$3/uL"),
        "!S! is the declared component character"
    );
    assert_eq!(obx.status.as_deref(), Some("F"));
}

#[test]
fn msh_fields_are_numbered_as_the_standard_numbers_them() {
    let msg = parse(CBC).expect("parses");
    let msh = msg.first("MSH").expect("msh");
    assert_eq!(msh.raw(1), "|");
    assert_eq!(msh.raw(2), "^~\\&");
    assert_eq!(msh.raw(9), "ORU^R01");
    assert_eq!(msg.component(msh, 9, 1), "ORU");
    assert_eq!(msh.raw(10), "CTRL-77");
}

#[test]
fn cr_lf_and_crlf_terminators_and_blank_lines_all_work() {
    let base = [
        "MSH|^~\\&|DEV",
        "PID|||U1",
        "OBR|1||SB1",
        "OBX|1|NM|A||1",
        "OBX|2|NM|B||2",
    ];
    for sep in ["\r", "\n", "\r\n", "\r\r\n\n"] {
        let msg = parse(&base.join(sep)).expect("parses");
        assert_eq!(msg.segments.len(), 5, "separator {sep:?}");
        assert_eq!(observation_groups(&msg)[0].results.len(), 2);
    }
}

#[test]
fn structured_and_coded_values_render_as_text() {
    let raw = "MSH|^~\\&|DEV\rOBR|1||SB\rOBX|1|SN|TROP||<^0.01|ng/mL\rOBX|2|SN|ANA||^1^:^160\rOBX|3|CWE|HBSAG||NEG^Non-reactive^L";
    let r = &observation_groups(&parse(raw).expect("parses"))[0].results;
    assert_eq!(r[0].value, "<0.01");
    assert_eq!(r[1].value, "1:160");
    assert_eq!(r[2].value, "Non-reactive");
}

#[test]
fn not_hl7_is_refused() {
    assert!(parse("").is_none());
    assert!(parse("H|\\^&|ASTM").is_none());
    assert!(parse("PID|||U1").is_none());
}

#[test]
fn multibyte_text_does_not_panic() {
    // `&raw[3..4]` used to slice bytes; a message with a non-ASCII separator
    // position panicked the listener.
    assert!(parse("MSHé").is_some());
    let msg = parse("MSH|^~\\&|DEV\rPID|||U1||Ñúñez^José").expect("parses");
    let pid = msg.first("PID").expect("pid");
    assert_eq!(msg.component(pid, 5, 2), "José");
}

#[test]
fn mllp_round_trip_and_tolerant_unwrap() {
    let wrapped = mllp_wrap(CBC);
    assert_eq!(wrapped[0], 0x0B);
    assert_eq!(&wrapped[wrapped.len() - 2..], &[0x1C, 0x0D]);
    assert_eq!(mllp_unwrap(&wrapped).as_deref(), Some(CBC));
    // Noise between frames before the start block.
    let mut noisy = b"\r\n".to_vec();
    noisy.extend_from_slice(&wrapped);
    assert_eq!(mllp_unwrap(&noisy).as_deref(), Some(CBC));
    // Latin-1 from an old analyser is decoded, not refused.
    assert!(mllp_unwrap(&[0x0B, b'M', b'S', b'H', b'|', 0xE9, 0x1C, 0x0D]).is_some());
    assert_eq!(mllp_unwrap(b"MSH|x\x1C\x0D"), None, "no start block");
    assert_eq!(mllp_unwrap(&[0x0B, b'M']), None, "no end block");
}

#[test]
fn ack_echoes_the_control_id() {
    let ack = generate_ack("CTRL-77", "AA");
    let msg = parse(&ack).expect("parses");
    let msa = msg.first("MSA").expect("msa");
    assert_eq!((msa.raw(1), msa.raw(2)), ("AA", "CTRL-77"));
}
