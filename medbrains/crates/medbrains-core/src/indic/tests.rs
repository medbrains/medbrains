use super::{Script, from_latin, script_of, to_latin};

fn offers(latin: &str, script: Script, expected: &str) {
    let got = from_latin(latin, script);
    assert!(
        got.iter().any(|g| g == expected),
        "{latin} in {script:?}: {got:?}, wanted {expected}"
    );
}

#[test]
fn common_names_reach_devanagari() {
    offers("Ramesh", Script::Devanagari, "रमेश");
    offers("Ramesh Kumar", Script::Devanagari, "रमेश कुमार");
    offers("Sunita", Script::Devanagari, "सुनीता");
    offers("Lakshmi", Script::Devanagari, "लक्ष्मी");
    offers("Priya", Script::Devanagari, "प्रिया");
    offers("Sundar", Script::Devanagari, "सुंदर");
    offers("Suresh Sharma", Script::Devanagari, "सुरेश शर्मा");
    offers("Mohan", Script::Devanagari, "मोहन");
}

#[test]
fn the_same_spelling_reaches_tamil_and_the_southern_scripts() {
    offers("Murugan", Script::Tamil, "முருகன்");
    offers("Ramesh", Script::Tamil, "ரமேஷ்");
    offers("Ramesh", Script::Telugu, "రమేశ్");
    offers("Suresh", Script::Kannada, "ಸುರೇಶ್");
    offers("Ramesh", Script::Bengali, "রমেশ");
    offers("Ramesh", Script::Gujarati, "રમેશ");
}

#[test]
fn any_script_reads_back_as_an_english_spelling() {
    assert_eq!(to_latin("रमेश कुमार"), "Ramesh Kumar");
    assert_eq!(to_latin("सुनीता"), "Sunita");
    assert_eq!(to_latin("लक्ष्मी"), "Lakshmi");
    assert_eq!(to_latin("प्रिया"), "Priya");
    assert_eq!(to_latin("முருகன்"), "Murugan");
    assert_eq!(to_latin("ரமேஷ்"), "Ramesh");
    assert_eq!(to_latin("ಸುರೇಶ್"), "Suresh");
    assert_eq!(to_latin("Already English"), "Already English");
}

#[test]
fn the_script_of_a_text_is_found() {
    assert_eq!(script_of("रमेश"), Some(Script::Devanagari));
    assert_eq!(script_of("முருகன்"), Some(Script::Tamil));
    assert_eq!(script_of("Ramesh"), None);
}
