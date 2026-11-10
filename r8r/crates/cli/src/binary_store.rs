//! Files kept beside the database.
//!
//! One directory per run, so forgetting a run's files is removing a directory
//! rather than working out which of ten thousand files belonged to it.

use async_trait::async_trait;
use r8r_core::{BinaryMeta, BinaryRef, BinaryStore, CoreError, Result};
use std::path::{Path, PathBuf};

/// Where files live, relative to the database.
///
/// Beside it rather than inside a temporary directory, because these outlive
/// the process: an execution from last night still has its attachment, and
/// somebody looking at that run expects to be able to open it.
pub const DIRECTORY: &str = "binaries";

#[derive(Debug, Clone)]
pub struct FileBinaryStore {
    root: PathBuf,
}

impl FileBinaryStore {
    /// Keep files beside `database_path`.
    #[must_use]
    pub fn beside(database_path: &str) -> Self {
        let root = Path::new(database_path)
            .parent()
            .unwrap_or_else(|| Path::new("."))
            .join(DIRECTORY);
        FileBinaryStore { root }
    }

    /// Where one run's files live.
    ///
    /// The id is checked rather than trusted: it reaches here from an
    /// execution row, but a path built by joining an unchecked string is one
    /// refactor away from writing outside the directory.
    fn run_dir(&self, execution_id: &str) -> Result<PathBuf> {
        if !is_safe_component(execution_id) {
            return Err(CoreError::Node(format!(
                "`{execution_id}` is not a usable run identifier"
            )));
        }
        Ok(self.root.join(execution_id))
    }

    /// Split a stored id back into the run it belongs to and the file itself.
    fn locate(&self, id: &str) -> Result<PathBuf> {
        let (execution_id, file) = id
            .split_once('/')
            .ok_or_else(|| CoreError::Node(format!("`{id}` is not a stored file")))?;

        if !is_safe_component(file) {
            return Err(CoreError::Node(format!("`{id}` is not a stored file")));
        }
        Ok(self.run_dir(execution_id)?.join(file))
    }
}

#[async_trait]
impl BinaryStore for FileBinaryStore {
    async fn put(
        &self,
        execution_id: &str,
        meta: &BinaryMeta,
        bytes: Vec<u8>,
    ) -> Result<BinaryRef> {
        let dir = self.run_dir(execution_id)?;
        let name = uuid::Uuid::new_v4().to_string();
        let path = dir.join(&name);
        let size = bytes.len();

        tokio::fs::create_dir_all(&dir)
            .await
            .map_err(|e| CoreError::Node(format!("could not make room for a file: {e}")))?;
        tokio::fs::write(&path, &bytes)
            .await
            .map_err(|e| CoreError::Node(format!("could not save a file: {e}")))?;

        tracing::debug!(execution = %execution_id, size, "stored a file");

        Ok(BinaryRef {
            id: format!("{execution_id}/{name}"),
            file_name: meta.file_name.clone(),
            mime_type: meta.mime_type.clone(),
            size,
        })
    }

    async fn get(&self, id: &str) -> Result<Vec<u8>> {
        let path = self.locate(id)?;
        tokio::fs::read(&path).await.map_err(|e| {
            // A file that is gone is usually a run whose history was pruned,
            // which is worth saying plainly rather than as an IO error.
            CoreError::Node(format!(
                "`{id}` is no longer here — it may belong to a run that has \
                 been pruned from the history ({e})"
            ))
        })
    }

    async fn forget(&self, execution_id: &str) -> Result<usize> {
        let dir = self.run_dir(execution_id)?;

        let Ok(mut entries) = tokio::fs::read_dir(&dir).await else {
            // Nothing there: a run that carried no files, which is most of
            // them. Not worth an error.
            return Ok(0);
        };

        let mut count: usize = 0;
        // Bounded loop (Power of 10 rule 2): one run's files, and a run that
        // produced more than a directory can hold has other problems.
        while let Ok(Some(_)) = entries.next_entry().await {
            count = count.saturating_add(1);
        }

        tokio::fs::remove_dir_all(&dir)
            .await
            .map_err(|e| CoreError::Node(format!("could not remove a run's files: {e}")))?;

        Ok(count)
    }
}

/// Whether a string is safe to use as one path component.
///
/// Deliberately strict: run and file identifiers are uuids, so anything with a
/// separator, a dot or a control character in it did not come from here.
fn is_safe_component(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 128
        && value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_uuid_is_a_usable_component() {
        assert!(is_safe_component("3f1a9c02-0000-4000-8000-000000000001"));
        assert!(is_safe_component("worker_1"));
    }

    #[test]
    fn nothing_that_could_leave_the_directory_is_usable() {
        // The identifiers reaching here are uuids from our own rows, but a
        // path built by joining an unchecked string is one refactor away from
        // writing wherever the string says.
        for attempt in ["..", "../../etc/passwd", "a/b", "a\\b", ".", "", "a.b"] {
            assert!(!is_safe_component(attempt), "{attempt} was accepted");
        }
    }

    #[tokio::test]
    async fn a_stored_file_comes_back_byte_for_byte() {
        let dir = tempfile::tempdir().expect("temp dir");
        let store = FileBinaryStore::beside(&dir.path().join("r8r.sqlite").to_string_lossy());
        let bytes = vec![0x89, b'P', b'N', b'G', 0x00, 0xFF];

        let stored = store
            .put("run-1", &BinaryMeta::default(), bytes.clone())
            .await
            .expect("store");

        assert_eq!(store.get(&stored.id).await.expect("read"), bytes);
        assert_eq!(stored.size, 6);
    }

    #[tokio::test]
    async fn forgetting_a_run_takes_every_file_it_produced() {
        let dir = tempfile::tempdir().expect("temp dir");
        let store = FileBinaryStore::beside(&dir.path().join("r8r.sqlite").to_string_lossy());
        for _ in 0..3 {
            store
                .put("run-1", &BinaryMeta::default(), vec![1, 2, 3])
                .await
                .expect("store");
        }
        let other = store
            .put("run-2", &BinaryMeta::default(), vec![4])
            .await
            .expect("store");

        assert_eq!(store.forget("run-1").await.expect("forget"), 3);

        // One run's files, not everybody's.
        assert!(store.get(&other.id).await.is_ok());
    }

    #[tokio::test]
    async fn forgetting_a_run_that_carried_no_files_is_not_an_error() {
        let dir = tempfile::tempdir().expect("temp dir");
        let store = FileBinaryStore::beside(&dir.path().join("r8r.sqlite").to_string_lossy());

        assert_eq!(store.forget("run-never-existed").await.expect("forget"), 0);
    }

    #[tokio::test]
    async fn a_file_that_is_gone_says_the_run_may_have_been_pruned() {
        let dir = tempfile::tempdir().expect("temp dir");
        let store = FileBinaryStore::beside(&dir.path().join("r8r.sqlite").to_string_lossy());

        let error = store.get("run-1/missing").await.expect_err("should fail");

        assert!(error.to_string().contains("pruned"), "{error}");
    }
}
