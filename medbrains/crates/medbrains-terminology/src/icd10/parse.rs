//! Read a licensed ICD-10 file into code / title / chapter rows: WHO `ClaML`
//! (the XML WHO distributes ICD-10 in) or a plain `code,title,chapter` CSV.
//!
//! Only real ICD-10 codes are accepted (a letter then a digit, see
//! [`icd_system_of_code`]), so an ICD-11 or unrelated file is refused rather
//! than loaded as "ICD-10".

use std::collections::{HashMap, HashSet};

use medbrains_core::diagnosis_coding::icd_system_of_code;
use quick_xml::Reader;
use quick_xml::events::{BytesStart, Event};

/// More rows than any ICD-10 edition (WHO ~12k, ICD-10-CM ~75k) holds.
pub const MAX_CODES: usize = 200_000;
const MAX_TITLE: usize = 500;
/// A `ClaML` hierarchy is chapter → block → category → subcategory; more
/// hops than this is a malformed (or cyclic) file.
const MAX_DEPTH: usize = 12;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Format {
    Claml,
    Csv,
}

impl Format {
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "claml" => Some(Self::Claml),
            "csv" => Some(Self::Csv),
            _ => None,
        }
    }

    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Claml => "claml",
            Self::Csv => "csv",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Entry {
    pub code: String,
    pub title: String,
    pub chapter: Option<String>,
}

pub fn parse(format: Format, content: &str) -> Result<Vec<Entry>, String> {
    let entries = match format {
        Format::Claml => parse_claml(content)?,
        Format::Csv => parse_csv(content)?,
    };
    if entries.is_empty() {
        return Err("the file holds no ICD-10 codes".to_owned());
    }
    if entries.len() > MAX_CODES {
        return Err(format!("the file holds more than {MAX_CODES} codes"));
    }
    Ok(entries)
}

fn clean_code(raw: &str) -> Result<String, String> {
    let code = raw.trim().to_ascii_uppercase();
    if (3..=16).contains(&code.len()) && icd_system_of_code(&code) == Some("icd10") {
        Ok(code)
    } else {
        Err(format!("\"{}\" is not an ICD-10 code", raw.trim()))
    }
}

fn clean_title(raw: &str) -> Option<String> {
    let title = raw.split_whitespace().collect::<Vec<_>>().join(" ");
    (!title.is_empty()).then(|| title.chars().take(MAX_TITLE).collect())
}

fn push(
    out: &mut Vec<Entry>,
    seen: &mut HashSet<String>,
    entry: Entry,
    at: &str,
) -> Result<(), String> {
    if !seen.insert(entry.code.clone()) {
        return Err(format!("{at}: code {} appears twice", entry.code));
    }
    out.push(entry);
    Ok(())
}

/// `code,title[,chapter]`, an optional header row starting `code`.
fn parse_csv(content: &str) -> Result<Vec<Entry>, String> {
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(false)
        .flexible(true)
        .trim(csv::Trim::All)
        .from_reader(content.as_bytes());
    let mut out = Vec::new();
    let mut seen = HashSet::new();
    for (i, record) in reader.records().enumerate() {
        let line = i + 1;
        let record = record.map_err(|e| format!("line {line}: {e}"))?;
        let code = record.get(0).unwrap_or_default();
        if code.is_empty() || (line == 1 && code.eq_ignore_ascii_case("code")) {
            continue;
        }
        let code = clean_code(code).map_err(|e| format!("line {line}: {e}"))?;
        let title = record
            .get(1)
            .and_then(clean_title)
            .ok_or_else(|| format!("line {line}: {code} has no title"))?;
        let chapter = record.get(2).and_then(clean_title);
        push(
            &mut out,
            &mut seen,
            Entry {
                code,
                title,
                chapter,
            },
            &format!("line {line}"),
        )?;
    }
    Ok(out)
}

#[derive(Default)]
struct Class {
    code: String,
    kind: String,
    parent: Option<String>,
    title: Option<String>,
}

fn attr(e: &BytesStart<'_>, name: &[u8]) -> Result<Option<String>, String> {
    for a in e.attributes() {
        let a = a.map_err(|err| format!("bad XML attribute: {err}"))?;
        if a.key.as_ref() == name {
            let v = a
                .unescape_value()
                .map_err(|err| format!("bad XML attribute: {err}"))?;
            return Ok(Some(v.into_owned()));
        }
    }
    Ok(None)
}

/// `ClaML`: every `<Class kind="category" code="…">` with its preferred
/// `<Rubric>` label; the chapter is found by walking `<SuperClass>` up.
fn parse_claml(content: &str) -> Result<Vec<Entry>, String> {
    let mut reader = Reader::from_str(content);
    let mut classes: Vec<Class> = Vec::new();
    let mut current: Option<Class> = None;
    let mut preferred = false;
    let mut label: Option<String> = None;
    loop {
        let event = reader.read_event().map_err(|e| {
            format!(
                "not valid ClaML XML at byte {}: {e}",
                reader.buffer_position()
            )
        })?;
        match event {
            Event::Start(e) | Event::Empty(e) => match e.name().as_ref() {
                b"Class" => {
                    current = Some(Class {
                        code: attr(&e, b"code")?.unwrap_or_default(),
                        kind: attr(&e, b"kind")?.unwrap_or_default(),
                        ..Class::default()
                    });
                }
                b"SuperClass" => {
                    if let Some(c) = current.as_mut() {
                        c.parent = attr(&e, b"code")?;
                    }
                }
                b"Rubric" => preferred = attr(&e, b"kind")?.as_deref() == Some("preferred"),
                b"Label" if preferred && current.as_ref().is_some_and(|c| c.title.is_none()) => {
                    label = Some(String::new());
                }
                _ => {}
            },
            Event::Text(t) => {
                if let Some(l) = label.as_mut() {
                    l.push_str(&t.unescape().map_err(|e| format!("bad XML text: {e}"))?);
                    l.push(' ');
                }
            }
            Event::End(e) => match e.name().as_ref() {
                b"Label" => {
                    if let (Some(c), Some(l)) = (current.as_mut(), label.take()) {
                        c.title = clean_title(&l);
                    }
                }
                b"Rubric" => preferred = false,
                b"Class" => classes.extend(current.take()),
                _ => {}
            },
            Event::Eof => break,
            _ => {}
        }
    }
    claml_entries(&classes)
}

fn claml_entries(classes: &[Class]) -> Result<Vec<Entry>, String> {
    let by_code: HashMap<&str, &Class> = classes.iter().map(|c| (c.code.as_str(), c)).collect();
    // Memo of class code → chapter label, so each chain is walked once.
    let mut chapter_of: HashMap<&str, Option<String>> = HashMap::new();
    let mut out = Vec::new();
    let mut seen = HashSet::new();
    for class in classes.iter().filter(|c| c.kind == "category") {
        let code = clean_code(&class.code)?;
        let title = class
            .title
            .clone()
            .ok_or_else(|| format!("{code} has no preferred label"))?;
        let chapter = chapter(class, &by_code, &mut chapter_of);
        push(
            &mut out,
            &mut seen,
            Entry {
                code,
                title,
                chapter,
            },
            "ClaML",
        )?;
    }
    Ok(out)
}

fn chapter<'a>(
    class: &'a Class,
    by_code: &HashMap<&'a str, &'a Class>,
    memo: &mut HashMap<&'a str, Option<String>>,
) -> Option<String> {
    let mut path = Vec::new();
    let mut at = Some(class);
    let mut found = None;
    while let Some(c) = at {
        if let Some(hit) = memo.get(c.code.as_str()) {
            found.clone_from(hit);
            break;
        }
        if c.kind == "chapter" {
            found = Some(
                c.title
                    .as_ref()
                    .map_or_else(|| c.code.clone(), |t| format!("{} {t}", c.code)),
            );
            break;
        }
        if path.len() >= MAX_DEPTH {
            break;
        }
        path.push(c.code.as_str());
        at = c.parent.as_deref().and_then(|p| by_code.get(p).copied());
    }
    for code in path {
        memo.insert(code, found.clone());
    }
    found
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    // Hand-written fixtures, three codes — not a catalogue.
    const CLAML_FIXTURE: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<ClaML version="2.0.0">
  <Title name="TEST-FIXTURE" version="fixture">Fixture, not ICD-10 content</Title>
  <Class code="I" kind="chapter">
    <Rubric kind="preferred"><Label xml:lang="en">Fixture chapter one</Label></Rubric>
  </Class>
  <Class code="A90-A99" kind="block">
    <SuperClass code="I"/>
    <Rubric kind="preferred"><Label xml:lang="en">Fixture block</Label></Rubric>
  </Class>
  <Class code="A90" kind="category">
    <SuperClass code="A90-A99"/>
    <Rubric kind="inclusion"><Label xml:lang="en">Not the title</Label></Rubric>
    <Rubric kind="preferred"><Label xml:lang="en">Fixture fever &amp; <Fragment>ache</Fragment></Label></Rubric>
  </Class>
  <Class code="A91.0" kind="category">
    <SuperClass code="A90"/>
    <Rubric kind="preferred"><Label xml:lang="en">Fixture subcategory</Label></Rubric>
  </Class>
</ClaML>"#;

    #[test]
    fn claml_reads_categories_with_their_chapter() {
        let rows = parse(Format::Claml, CLAML_FIXTURE).unwrap();
        assert_eq!(rows.len(), 2, "chapters and blocks are not codes");
        assert_eq!(rows[0].code, "A90");
        assert_eq!(rows[0].title, "Fixture fever & ache");
        assert_eq!(rows[0].chapter.as_deref(), Some("I Fixture chapter one"));
        assert_eq!(rows[1].chapter.as_deref(), Some("I Fixture chapter one"));
    }

    #[test]
    fn csv_reads_rows_and_skips_a_header() {
        let csv = "code,title,chapter\nA90,\"Fixture, quoted\",I\n e11.9 ,Fixture two\n";
        let rows = parse(Format::Csv, csv).unwrap();
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].title, "Fixture, quoted");
        assert_eq!(rows[1].code, "E11.9");
        assert_eq!(rows[1].chapter, None);
    }

    #[test]
    fn refuses_what_is_not_icd10() {
        let icd11 = parse(Format::Csv, "1D2Z,Fixture eleven\n").unwrap_err();
        assert!(icd11.contains("not an ICD-10 code"), "{icd11}");
        assert!(
            parse(Format::Csv, "A90,One\nA90,Two\n")
                .unwrap_err()
                .contains("twice")
        );
        assert!(
            parse(Format::Csv, "A90,\n")
                .unwrap_err()
                .contains("no title")
        );
        assert!(
            parse(Format::Csv, "code,title\n")
                .unwrap_err()
                .contains("no ICD-10 codes")
        );
        assert!(parse(Format::Claml, "<ClaML><Class").is_err());
    }
}
