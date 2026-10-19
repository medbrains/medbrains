//! RF2 release format: which files a package holds, what their columns are,
//! and turning one line into a row for `COPY`.
//!
//! Only the **Snapshot** view is loaded — the current state of every
//! component, which is what search, hierarchy and analytics need. Full and
//! Delta files are skipped. Every file is tab-separated UTF-8 with a header
//! row and CRLF line endings.

use chrono::NaiveDate;

/// The RF2 files the store loads.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Rf2Kind {
    Concept,
    Description,
    Relationship,
    /// `der2_Refset_*SimpleSnapshot*` — membership only.
    SimpleRefset,
    /// `der2_cRefset_LanguageSnapshot*` — membership plus acceptability.
    LanguageRefset,
}

impl Rf2Kind {
    /// Classify a file by its base name. `None` = not loaded (Full/Delta
    /// views, stated relationships, text definitions, map refsets, readmes).
    pub fn classify(file_name: &str) -> Option<Self> {
        if !file_name.ends_with(".txt") || !file_name.contains("Snapshot") {
            return None;
        }
        if file_name.starts_with("sct2_Concept_Snapshot") {
            Some(Self::Concept)
        } else if file_name.starts_with("sct2_Description_Snapshot") {
            Some(Self::Description)
        } else if file_name.starts_with("sct2_Relationship_Snapshot") {
            Some(Self::Relationship)
        } else if file_name.starts_with("der2_cRefset_LanguageSnapshot") {
            Some(Self::LanguageRefset)
        } else if file_name.starts_with("der2_Refset_") && file_name.contains("SimpleSnapshot") {
            Some(Self::SimpleRefset)
        } else {
            None
        }
    }

    /// The header row the file must carry, column for column.
    pub const fn header(self) -> &'static [&'static str] {
        match self {
            Self::Concept => &[
                "id",
                "effectiveTime",
                "active",
                "moduleId",
                "definitionStatusId",
            ],
            Self::Description => &[
                "id",
                "effectiveTime",
                "active",
                "moduleId",
                "conceptId",
                "languageCode",
                "typeId",
                "term",
                "caseSignificanceId",
            ],
            Self::Relationship => &[
                "id",
                "effectiveTime",
                "active",
                "moduleId",
                "sourceId",
                "destinationId",
                "relationshipGroup",
                "typeId",
                "characteristicTypeId",
                "modifierId",
            ],
            Self::SimpleRefset => &[
                "id",
                "effectiveTime",
                "active",
                "moduleId",
                "refsetId",
                "referencedComponentId",
            ],
            Self::LanguageRefset => &[
                "id",
                "effectiveTime",
                "active",
                "moduleId",
                "refsetId",
                "referencedComponentId",
                "acceptabilityId",
            ],
        }
    }

    /// Load order: concepts and descriptions before the relationships and
    /// refsets that point at them, so progress reads naturally.
    pub const fn order(self) -> u8 {
        match self {
            Self::Concept => 0,
            Self::Description => 1,
            Self::Relationship => 2,
            Self::LanguageRefset => 3,
            Self::SimpleRefset => 4,
        }
    }
}

/// What a package is: `INT` / `IN1000189` and its release date, read from a
/// file name such as `sct2_Concept_Snapshot_INT_20250101.txt`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReleaseIdentity {
    pub edition: String,
    pub version_date: NaiveDate,
}

pub fn release_identity(file_name: &str) -> Option<ReleaseIdentity> {
    let stem = file_name.strip_suffix(".txt")?;
    let mut parts = stem.rsplitn(3, '_');
    let date = parts.next()?;
    let edition = parts.next()?;
    let version_date = NaiveDate::parse_from_str(date, "%Y%m%d").ok()?;
    let valid = !edition.is_empty()
        && edition.len() <= 32
        && edition.bytes().all(|b| b.is_ascii_alphanumeric());
    valid.then(|| ReleaseIdentity {
        edition: edition.to_owned(),
        version_date,
    })
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum Rf2Error {
    #[error("the header row is not an RF2 {0:?} header")]
    Header(Rf2Kind),
    #[error("line {line}: expected {expected} columns, found {found}")]
    Columns {
        line: u64,
        expected: usize,
        found: usize,
    },
    #[error("line {line}: column {column} is not valid ({value})")]
    Value {
        line: u64,
        column: &'static str,
        value: String,
    },
}

pub fn check_header(kind: Rf2Kind, line: &str) -> Result<(), Rf2Error> {
    // A byte-order mark is tolerated: some tools add one when re-saving.
    let line = line.trim_start_matches('\u{feff}');
    let cols: Vec<&str> = line.trim_end_matches(['\r', '\n']).split('\t').collect();
    if cols == kind.header() {
        Ok(())
    } else {
        Err(Rf2Error::Header(kind))
    }
}

/// Validate one data line and append it to `out` as a `COPY … (FORMAT text)`
/// row. Returns the line's `moduleId`, so the caller can record which
/// modules a release carried.
pub fn push_copy_row<'a>(
    kind: Rf2Kind,
    line_no: u64,
    line: &'a str,
    out: &mut String,
) -> Result<&'a str, Rf2Error> {
    let header = kind.header();
    let cols: Vec<&str> = line.trim_end_matches(['\r', '\n']).split('\t').collect();
    if cols.len() != header.len() {
        return Err(Rf2Error::Columns {
            line: line_no,
            expected: header.len(),
            found: cols.len(),
        });
    }
    for (i, (value, column)) in cols.iter().zip(header).enumerate() {
        validate(kind, line_no, *column, value)?;
        if i > 0 {
            out.push('\t');
        }
        push_escaped(out, value);
    }
    out.push('\n');
    Ok(cols[3])
}

fn validate(kind: Rf2Kind, line: u64, column: &'static str, value: &str) -> Result<(), Rf2Error> {
    let ok = match column {
        "effectiveTime" => NaiveDate::parse_from_str(value, "%Y%m%d").is_ok(),
        "active" => value == "0" || value == "1",
        "relationshipGroup" => value.parse::<i32>().is_ok(),
        "languageCode" => (2..=8).contains(&value.len()),
        "term" => !value.is_empty(),
        // Refset member ids are UUIDs; every other id column is an SCTID.
        "id" if matches!(kind, Rf2Kind::SimpleRefset | Rf2Kind::LanguageRefset) => {
            uuid::Uuid::parse_str(value).is_ok()
        }
        _ => is_sctid_shape(value),
    };
    if ok {
        Ok(())
    } else {
        let value = value.chars().take(40).collect();
        Err(Rf2Error::Value {
            line,
            column,
            value,
        })
    }
}

/// Digits that fit a bigint. The check digit is trusted here: a release is
/// signed off by its publisher, and checking 5M rows twice buys nothing.
fn is_sctid_shape(value: &str) -> bool {
    (6..=18).contains(&value.len()) && value.bytes().all(|b| b.is_ascii_digit())
}

/// `COPY` text format treats backslash as an escape; RF2 forbids tabs and
/// newlines inside a field, so the backslash is the only character to guard.
fn push_escaped(out: &mut String, value: &str) {
    for ch in value.chars() {
        if ch == '\\' {
            out.push_str("\\\\");
        } else {
            out.push(ch);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{Rf2Error, Rf2Kind, check_header, push_copy_row, release_identity};

    #[test]
    fn classifies_snapshot_files_only() {
        let c = Rf2Kind::classify;
        assert_eq!(
            c("sct2_Concept_Snapshot_INT_20250101.txt"),
            Some(Rf2Kind::Concept)
        );
        assert_eq!(
            c("sct2_Description_Snapshot-hi_IN1000189_20240701.txt"),
            Some(Rf2Kind::Description)
        );
        assert_eq!(
            c("sct2_Relationship_Snapshot_INT_20250101.txt"),
            Some(Rf2Kind::Relationship)
        );
        assert_eq!(
            c("der2_cRefset_LanguageSnapshot-en_INT_20250101.txt"),
            Some(Rf2Kind::LanguageRefset)
        );
        assert_eq!(
            c("der2_Refset_SimpleSnapshot_IN1000189_20240701.txt"),
            Some(Rf2Kind::SimpleRefset)
        );
        assert_eq!(
            c("sct2_Concept_Full_INT_20250101.txt"),
            None,
            "full view skipped"
        );
        assert_eq!(c("sct2_StatedRelationship_Snapshot_INT_20250101.txt"), None);
        assert_eq!(c("sct2_TextDefinition_Snapshot-en_INT_20250101.txt"), None);
        assert_eq!(
            c("der2_iisssccRefset_ExtendedMapSnapshot_INT_20250101.txt"),
            None
        );
        assert_eq!(c("Readme_en_20250101.txt"), None);
    }

    #[test]
    fn reads_edition_and_date_from_the_name() {
        let id = release_identity("sct2_Concept_Snapshot_IN1000189_20240701.txt");
        let id = id
            .as_ref()
            .map(|r| (r.edition.as_str(), r.version_date.to_string()));
        assert_eq!(id, Some(("IN1000189", "2024-07-01".to_owned())));
        assert!(release_identity("sct2_Concept_Snapshot_INT_2025.txt").is_none());
        assert!(release_identity("sct2_Concept_Snapshot_../x_20250101.txt").is_none());
    }

    #[test]
    fn header_must_match_exactly() {
        let ok = "id\teffectiveTime\tactive\tmoduleId\tdefinitionStatusId\r\n";
        assert_eq!(check_header(Rf2Kind::Concept, ok), Ok(()));
        let bom = format!("\u{feff}{ok}");
        assert_eq!(check_header(Rf2Kind::Concept, &bom), Ok(()));
        let bad = "id\tactive\teffectiveTime\tmoduleId\tdefinitionStatusId";
        assert_eq!(
            check_header(Rf2Kind::Concept, bad),
            Err(Rf2Error::Header(Rf2Kind::Concept))
        );
    }

    #[test]
    fn copy_row_escapes_backslash_and_returns_module() {
        let mut out = String::new();
        let line = "101\t20250101\t1\t900000000000207008\t22298006\ten\t900000000000013009\tA\\B\t900000000000448009\r\n";
        let module = push_copy_row(Rf2Kind::Description, 2, line, &mut out);
        assert_eq!(module, Ok("900000000000207008"));
        assert!(out.contains("A\\\\B"), "{out}");
        assert!(out.ends_with("900000000000448009\n"));
    }

    #[test]
    fn copy_row_rejects_bad_values_with_the_line() {
        let mut out = String::new();
        let short = "101\t20250101\t1";
        assert!(matches!(
            push_copy_row(Rf2Kind::Concept, 7, short, &mut out),
            Err(Rf2Error::Columns {
                line: 7,
                expected: 5,
                found: 3
            })
        ));
        let active = "100005\t20250101\tyes\t900000000000207008\t900000000000074008";
        assert!(matches!(
            push_copy_row(Rf2Kind::Concept, 9, active, &mut out),
            Err(Rf2Error::Value {
                line: 9,
                column: "active",
                ..
            })
        ));
        let member = "not-a-uuid\t20250101\t1\t900000000000207008\t723264001\t100005";
        assert!(push_copy_row(Rf2Kind::SimpleRefset, 3, member, &mut out).is_err());
    }
}
