//! An RF2 release package (a zip): check its layout from the central
//! directory, then extract only the snapshot files the store loads.
//!
//! The archive is untrusted input from an upload. Three guards:
//! * **zip-slip** — any entry whose name escapes the archive root rejects
//!   the whole package, and extracted files are written by base name into a
//!   fresh directory, so no entry name ever becomes a path;
//! * **size** — bytes are counted as they are written, not taken from the
//!   header, with a per-package ceiling (a zip bomb stops at the limit);
//! * **count** — at most [`MAX_ENTRIES`] entries are examined.

use std::collections::HashSet;
use std::fs::File;
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};

use crate::rf2::{ReleaseIdentity, Rf2Kind, release_identity};

/// A real International Edition package holds well under a thousand files.
pub const MAX_ENTRIES: usize = 20_000;

#[derive(Debug, thiserror::Error)]
pub enum PackageError {
    #[error("not a readable zip archive: {0}")]
    Zip(#[from] zip::result::ZipError),
    #[error("{0}")]
    Io(#[from] io::Error),
    #[error("the archive has an unsafe entry name: {0}")]
    UnsafeEntry(String),
    #[error("the archive has more than {MAX_ENTRIES} entries")]
    TooManyEntries,
    #[error(
        "no RF2 Snapshot files (sct2_Concept_Snapshot…, sct2_Description_Snapshot…) were found"
    )]
    NotRf2,
    #[error("two files in the archive are both named {0}")]
    Duplicate(String),
    #[error("cannot tell the edition and release date from {0}")]
    NoIdentity(String),
    #[error("the release unpacks to more than {0} bytes")]
    TooLarge(u64),
}

/// One file the importer will load.
#[derive(Debug, Clone)]
pub struct PackageFile {
    pub index: usize,
    pub name: String,
    pub kind: Rf2Kind,
}

#[derive(Debug, Clone)]
pub struct PackageLayout {
    pub identity: ReleaseIdentity,
    pub files: Vec<PackageFile>,
    /// Names of snapshot-looking files that are not loaded (map refsets,
    /// stated relationships …), so the screen can say what was left out.
    pub skipped: Vec<String>,
}

/// Read the central directory only — fast even for a 1 GB package.
pub fn inspect(zip_path: &Path) -> Result<PackageLayout, PackageError> {
    let mut archive = zip::ZipArchive::new(File::open(zip_path)?)?;
    if archive.len() > MAX_ENTRIES {
        return Err(PackageError::TooManyEntries);
    }
    let mut files = Vec::new();
    let mut skipped = Vec::new();
    let mut seen = HashSet::new();
    for index in 0..archive.len() {
        let entry = archive.by_index_raw(index)?;
        let Some(path) = entry.enclosed_name() else {
            return Err(PackageError::UnsafeEntry(
                entry.name().chars().take(120).collect(),
            ));
        };
        if entry.is_dir() {
            continue;
        }
        let Some(name) = path.file_name().and_then(|n| n.to_str()).map(str::to_owned) else {
            continue;
        };
        match Rf2Kind::classify(&name) {
            Some(kind) => {
                if !seen.insert(name.clone()) {
                    return Err(PackageError::Duplicate(name));
                }
                files.push(PackageFile { index, name, kind });
            }
            None if name.contains("Snapshot") => skipped.push(name),
            None => {}
        }
    }
    files.sort_by_key(|f| (f.kind.order(), f.name.clone()));
    let first = files.first().ok_or(PackageError::NotRf2)?;
    let anchor = files
        .iter()
        .find(|f| f.kind == Rf2Kind::Concept)
        .unwrap_or(first);
    let identity = release_identity(&anchor.name)
        .ok_or_else(|| PackageError::NoIdentity(anchor.name.clone()))?;
    skipped.sort();
    Ok(PackageLayout {
        identity,
        files,
        skipped,
    })
}

/// Extract the layout's files into `dest` (created fresh), stopping at
/// `max_bytes` of unpacked data. Returns the extracted paths in load order.
pub fn extract(
    zip_path: &Path,
    layout: &PackageLayout,
    dest: &Path,
    max_bytes: u64,
) -> Result<Vec<(PathBuf, Rf2Kind)>, PackageError> {
    std::fs::create_dir_all(dest)?;
    let mut archive = zip::ZipArchive::new(File::open(zip_path)?)?;
    let mut budget = max_bytes;
    let mut out = Vec::with_capacity(layout.files.len());
    for file in &layout.files {
        let entry = archive.by_index(file.index)?;
        let target = dest.join(&file.name);
        let mut writer = File::create(&target)?;
        let written = io::copy(&mut entry.take(budget.saturating_add(1)), &mut writer)?;
        writer.flush()?;
        if written > budget {
            return Err(PackageError::TooLarge(max_bytes));
        }
        budget -= written;
        out.push((target, file.kind));
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use std::io::Write;

    use super::{PackageError, extract, inspect};
    use crate::rf2::Rf2Kind;

    fn write_zip(path: &std::path::Path, entries: &[(&str, &str)]) -> zip::result::ZipResult<()> {
        let mut writer = zip::ZipWriter::new(std::fs::File::create(path)?);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Stored);
        for (name, body) in entries {
            writer.start_file(*name, options)?;
            writer.write_all(body.as_bytes())?;
        }
        writer.finish()?;
        Ok(())
    }

    fn temp(name: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!("mb-snomed-pkg-{}-{name}", uuid::Uuid::new_v4()))
    }

    #[test]
    fn finds_snapshot_files_and_the_release_identity() -> Result<(), PackageError> {
        let zip = temp("ok.zip");
        write_zip(
            &zip,
            &[
                (
                    "Pkg/Full/Terminology/sct2_Concept_Full_INT_20250101.txt",
                    "x",
                ),
                (
                    "Pkg/Snapshot/Terminology/sct2_Description_Snapshot-en_INT_20250101.txt",
                    "d",
                ),
                (
                    "Pkg/Snapshot/Terminology/sct2_Concept_Snapshot_INT_20250101.txt",
                    "c",
                ),
                (
                    "Pkg/Snapshot/Refset/Map/der2_iisssccRefset_ExtendedMapSnapshot_INT_20250101.txt",
                    "m",
                ),
            ],
        )?;
        let layout = inspect(&zip)?;
        assert_eq!(layout.identity.edition, "INT");
        let kinds: Vec<Rf2Kind> = layout.files.iter().map(|f| f.kind).collect();
        assert_eq!(
            kinds,
            vec![Rf2Kind::Concept, Rf2Kind::Description],
            "load order, full view skipped"
        );
        assert_eq!(layout.skipped.len(), 1, "map refset named as skipped");

        let dest = temp("out");
        let files = extract(&zip, &layout, &dest, 1024)?;
        assert_eq!(files.len(), 2);
        assert!(
            files
                .iter()
                .all(|(p, _)| p.parent() == Some(dest.as_path())),
            "flattened"
        );
        let _ = std::fs::remove_dir_all(&dest);
        let _ = std::fs::remove_file(&zip);
        Ok(())
    }

    #[test]
    fn refuses_zip_slip_and_non_rf2_and_oversize() -> Result<(), PackageError> {
        let slip = temp("slip.zip");
        write_zip(
            &slip,
            &[("../../etc/sct2_Concept_Snapshot_INT_20250101.txt", "c")],
        )?;
        assert!(matches!(inspect(&slip), Err(PackageError::UnsafeEntry(_))));

        let other = temp("other.zip");
        write_zip(&other, &[("photo.txt", "hello")])?;
        assert!(matches!(inspect(&other), Err(PackageError::NotRf2)));

        let big = temp("big.zip");
        write_zip(
            &big,
            &[("sct2_Concept_Snapshot_INT_20250101.txt", "0123456789")],
        )?;
        let layout = inspect(&big)?;
        let dest = temp("big-out");
        assert!(matches!(
            extract(&big, &layout, &dest, 5),
            Err(PackageError::TooLarge(5))
        ));
        for p in [&slip, &other, &big] {
            let _ = std::fs::remove_file(p);
        }
        let _ = std::fs::remove_dir_all(&dest);
        Ok(())
    }
}
