//! Observation results (ORU^R01 and friends) out of a parsed message.
//!
//! Walks the segments in order: a PID names the patient for what follows,
//! each OBR opens an order group, each OBX is one result in that group, and
//! an NTE annotates the OBX it follows. Nothing is keyed by field name, so a
//! CBC's twenty OBX stay twenty results, in the order the analyser sent them.

use serde::{Deserialize, Serialize};

use super::{Message, Segment};

/// One OBX.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Observation {
    /// OBX-1.
    pub set_id: Option<String>,
    /// OBX-2: NM, ST, SN, CE, CWE, TX, FT...
    pub value_type: Option<String>,
    /// OBX-3.1, the analyser's test code.
    pub test_code: String,
    /// OBX-3.2.
    pub test_name: Option<String>,
    /// OBX-4: distinguishes repeated OBX-3 codes within one order.
    pub sub_id: Option<String>,
    /// OBX-5, rendered as text: `<0.01` for an SN, the text of a coded value.
    pub value: String,
    /// OBX-6.1, else OBX-6.2.
    pub unit: Option<String>,
    /// OBX-7.
    pub reference_range: Option<String>,
    /// OBX-8, first repetition (HL7 table 0078).
    pub abnormal_flag: Option<String>,
    /// OBX-11 (HL7 table 0085): F final, P preliminary, C correction...
    pub status: Option<String>,
    /// OBX-14.
    pub observed_at: Option<String>,
    /// NTE-3 of every NTE that followed this OBX, one per line.
    pub notes: Option<String>,
}

/// One OBR and the OBX under it.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct ObservationGroup {
    /// PID-3.1 of the patient this group belongs to, else PID-2.1.
    pub patient_id: Option<String>,
    /// OBR-3.1 (filler order number, where analysers echo the tube's
    /// barcode), else SPM-2.1.
    pub sample_barcode: Option<String>,
    /// OBR-2.1, the placer order number MedBrains sent in the ORM.
    pub placer_order: Option<String>,
    /// OBR-4.1.
    pub service_code: Option<String>,
    pub results: Vec<Observation>,
}

fn non_empty(s: String) -> Option<String> {
    let t = s.trim();
    (!t.is_empty()).then(|| t.to_owned())
}

/// Every order group in the message, in order. OBX before any OBR get a
/// group of their own with no barcode, so they are never lost.
pub fn observation_groups(msg: &Message) -> Vec<ObservationGroup> {
    let mut groups: Vec<ObservationGroup> = Vec::new();
    let mut patient: Option<String> = None;
    // Whether the last OBX/OBR seen is the one an NTE would annotate.
    let mut last_was_obx = false;
    for seg in &msg.segments {
        match seg.name.as_str() {
            "PID" => {
                patient = non_empty(msg.component(seg, 3, 1))
                    .or_else(|| non_empty(msg.component(seg, 2, 1)));
                last_was_obx = false;
            }
            "OBR" => {
                groups.push(ObservationGroup {
                    patient_id: patient.clone(),
                    sample_barcode: non_empty(msg.component(seg, 3, 1)),
                    placer_order: non_empty(msg.component(seg, 2, 1)),
                    service_code: non_empty(msg.component(seg, 4, 1)),
                    results: Vec::new(),
                });
                last_was_obx = false;
            }
            "SPM" => {
                if let Some(group) = groups.last_mut().filter(|g| g.sample_barcode.is_none()) {
                    let id = msg.component(seg, 2, 1);
                    let id = id
                        .split(msg.delimiters.subcomponent)
                        .next()
                        .unwrap_or_default();
                    group.sample_barcode = non_empty(id.to_owned());
                }
            }
            "OBX" => {
                if groups.is_empty() {
                    groups.push(ObservationGroup {
                        patient_id: patient.clone(),
                        ..Default::default()
                    });
                }
                if let Some(group) = groups.last_mut() {
                    group.results.push(observation(msg, seg));
                }
                last_was_obx = true;
            }
            "NTE" if last_was_obx => {
                let obx = groups.last_mut().and_then(|g| g.results.last_mut());
                if let (Some(obx), Some(text)) = (obx, non_empty(note_text(msg, seg))) {
                    obx.notes = Some(match obx.notes.take() {
                        Some(prev) => format!("{prev}\n{text}"),
                        None => text,
                    });
                }
            }
            _ => {}
        }
    }
    groups
}

fn note_text(msg: &Message, seg: &Segment) -> String {
    msg.repetitions(seg, 3)
        .into_iter()
        .map(|r| msg.unescape_repetition(r))
        .collect::<Vec<_>>()
        .join("\n")
}

fn observation(msg: &Message, seg: &Segment) -> Observation {
    let value_type = non_empty(msg.component(seg, 2, 1));
    Observation {
        set_id: non_empty(msg.component(seg, 1, 1)),
        test_code: msg.component(seg, 3, 1).trim().to_owned(),
        test_name: non_empty(msg.component(seg, 3, 2)),
        sub_id: non_empty(msg.component(seg, 4, 1)),
        value: value_text(msg, seg, value_type.as_deref()),
        unit: non_empty(msg.component(seg, 6, 1)).or_else(|| non_empty(msg.component(seg, 6, 2))),
        reference_range: non_empty(msg.text(seg, 7)),
        abnormal_flag: non_empty(msg.component(seg, 8, 1)),
        status: non_empty(msg.component(seg, 11, 1)),
        observed_at: non_empty(msg.component(seg, 14, 1)),
        notes: None,
        value_type,
    }
}

/// OBX-5 as text, by its OBX-2 type.
fn value_text(msg: &Message, seg: &Segment, value_type: Option<&str>) -> String {
    let reps = msg.repetitions(seg, 5);
    let first = reps.first().copied().unwrap_or_default();
    let value = match value_type {
        // Structured numeric: comparator ^ num1 ^ separator ^ num2, so
        // `<^0.01` is "<0.01" and `^1^:^128` a titre of "1:128".
        Some("SN") => (1..=4)
            .map(|c| msg.component_of(first, c))
            .collect::<String>(),
        // Coded: the text when sent, else the code.
        Some("CE" | "CWE" | "CNE") => {
            non_empty(msg.component_of(first, 2)).unwrap_or_else(|| msg.component_of(first, 1))
        }
        _ => reps
            .iter()
            .map(|r| msg.unescape_repetition(r))
            .collect::<Vec<_>>()
            .join("\n"),
    };
    value.trim().to_owned()
}
