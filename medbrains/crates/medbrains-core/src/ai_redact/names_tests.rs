//! Precision and recall on a synthetic Indian clinical-notes set
//! (`names_corpus.txt`: English, Hinglish/Tanglish, Tamil and Devanagari),
//! plus the clinical words that must never be taken for a name.

use super::find;

/// The names marked `{like this}` in a line, and the line without the marks.
fn marked(line: &str) -> (String, Vec<String>) {
    let mut plain = String::new();
    let mut names = Vec::new();
    let mut rest = line;
    while let Some(open) = rest.find('{') {
        plain.push_str(&rest[..open]);
        let after = &rest[open + 1..];
        let close = after.find('}').unwrap_or(after.len());
        names.push(after[..close].to_owned());
        plain.push_str(&after[..close]);
        rest = after.get(close + 1..).unwrap_or_default();
    }
    plain.push_str(rest);
    (plain, names)
}

#[test]
fn bare_names_are_found_and_clinical_words_are_not() {
    let (precision, recall, misses) = measure(include_str!("names_corpus.txt"));
    assert!(
        precision >= 0.97 && recall >= 0.95,
        "tuned set: precision {precision:.3}, recall {recall:.3}\n{}",
        misses.join("\n")
    );
}

#[test]
fn drugs_and_eponyms_are_never_names() {
    let words = "Ramipril Metformin Amlodipine Atorvastatin Pantoprazole Paracetamol Ceftriaxone \
        Amoxicillin Azithromycin Levothyroxine Insulin Heparin Warfarin Clopidogrel Aspirin \
        Losartan Telmisartan Ondansetron Salbutamol Budesonide Prednisolone Dexamethasone \
        Parkinson Alzheimer Crohn Hodgkin Cushing Addison Graves Hashimoto Wilson Raynaud \
        Babinski Kernig Romberg Glasgow Apgar Murphy McBurney Trendelenburg Korotkoff Wernicke";
    for w in words.split_whitespace() {
        for text in [
            format!("Started {w} today."),
            format!("{w} given at night, review tomorrow."),
            format!("Continue {w} as before; {w}'s effect noted."),
        ] {
            assert!(find(&text).unwrap_or_default().is_empty(), "{text}");
        }
    }
}

/// Precision and recall over `corpus`, with what went wrong.
fn measure(corpus: &str) -> (f64, f64, Vec<String>) {
    let (mut right, mut found, mut expected) = (0_usize, 0_usize, 0_usize);
    let mut misses = Vec::new();
    for line in corpus
        .lines()
        .filter(|l| !l.starts_with('#') && !l.trim().is_empty())
    {
        let (plain, names) = marked(line);
        let hits: Vec<String> = find(&plain)
            .unwrap_or_default()
            .into_iter()
            .map(|r| plain[r].to_owned())
            .collect();
        expected += names.len();
        found += hits.len();
        right += hits.iter().filter(|h| names.contains(h)).count();
        misses.extend(
            hits.iter()
                .filter(|h| !names.contains(h))
                .map(|h| format!("wrong: {h:?} in {plain:?}")),
        );
        misses.extend(
            names
                .iter()
                .filter(|n| !hits.contains(n))
                .map(|n| format!("missed: {n:?} in {plain:?}")),
        );
    }
    #[expect(clippy::cast_precision_loss, reason = "counts of a few hundred")]
    let ratio = |a: usize, b: usize| a as f64 / b.max(1) as f64;
    (ratio(right, found), ratio(right, expected), misses)
}

#[test]
fn held_out_notes_measure_close_to_the_tuned_ones() {
    let (precision, recall, misses) = measure(include_str!("names_holdout.txt"));
    assert!(
        // Measured once at 0.957 / 0.957 (23 names); the floor leaves room
        // for the list to grow without hiding a real drop.
        precision >= 0.9 && recall >= 0.9,
        "held out: precision {precision:.3}, recall {recall:.3}\n{}",
        misses.join("\n")
    );
}

#[test]
fn codes_and_json_keys_are_not_words() {
    let json = r#"{"diagnosis":"Pneumonia, right lower lobe (J18.1)","signed_by":null,"S":"said"}"#;
    assert!(find(json).unwrap_or_default().is_empty(), "{json}");
    assert_eq!(find("Ramesh, said nothing.").unwrap_or_default().len(), 1);
}

/// The drug formulary, diagnosis and lab references the hospital is seeded
/// with: not one name in them.
#[test]
fn seeded_clinical_vocabulary_holds_no_names() {
    let seeds = [
        include_str!("../../../medbrains-seed/src/data/drug_formulary.csv"),
        include_str!("../../../medbrains-seed/src/data/drug_ingredients.csv"),
        include_str!("../../../medbrains-seed/src/data/diagnosis_reference.csv"),
        include_str!("../../../medbrains-seed/src/data/lab_reference.csv"),
    ];
    let hits: Vec<String> = seeds
        .iter()
        .flat_map(|csv| csv.lines())
        .flat_map(|l| {
            find(l)
                .unwrap_or_default()
                .into_iter()
                .map(move |r| format!("{} <- {l}", &l[r]))
        })
        .collect();
    assert!(hits.is_empty(), "{} hits:\n{}", hits.len(), hits.join("\n"));
}
