//! The persistent tier behind the offline caches: one redb file per cache directory.
//!
//! Replaced sled 0.34, unmaintained since 2021 (RUSTSEC for its fxhash and instant
//! dependencies, #5471). redb is pure Rust, keeps one file, and every commit is durable, so
//! a revocation written before a power cut is still there after it.
//!
//! The caches only need byte keys to byte values: put, delete, and read everything at boot
//! or for a prune pass, which is what this exposes.

use std::path::Path;
use std::sync::Arc;

use redb::{Database, ReadableDatabase, ReadableTable, TableDefinition};

/// The one table each cache keeps.
const TABLE: TableDefinition<&[u8], &[u8]> = TableDefinition::new("entries");

/// The database file inside a cache's directory.
const FILE: &str = "store.redb";

/// Every storage fault the caches can see.
pub type StoreError = redb::Error;

/// One stored key and its value, as owned bytes.
pub type Entry = (Vec<u8>, Vec<u8>);

/// Delete what sled 0.34 left in `dir` once the redb store there has opened: its `conf`, `db`,
/// `blobs/` and `snap.*` files. Nothing reads them any more, and they can hold revoked user
/// ids and cached decisions. A file that will not go is logged, not fatal: the cache works
/// without its removal.
fn remove_sled_leftovers(dir: &Path) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let name = entry.file_name();
        let name = name.to_string_lossy();
        let path = entry.path();
        let removed = match name.as_ref() {
            "conf" | "db" => std::fs::remove_file(&path),
            "blobs" => std::fs::remove_dir_all(&path),
            n if n.starts_with("snap.") => std::fs::remove_file(&path),
            _ => continue,
        };
        if let Err(err) = removed {
            tracing::warn!(?err, path = %path.display(), "could not remove a sled leftover");
        }
    }
}

/// A byte-keyed store. Cheap to clone: the database is shared.
#[derive(Clone)]
pub struct Store {
    db: Arc<Database>,
}

impl std::fmt::Debug for Store {
    /// The handle has nothing worth printing; say what it is.
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Store").finish_non_exhaustive()
    }
}

impl Store {
    /// Open (or create) the store in directory `dir`, creating the directory and the table.
    ///
    /// `dir` stays a directory, as it was for sled, so callers' paths do not change. A sled
    /// layout already in it is left alone and not read: both caches refill from the server
    /// on the next sync (see the PR for the upgrade note on revocations).
    pub fn open(dir: &Path) -> Result<Self, StoreError> {
        std::fs::create_dir_all(dir)?;
        let db = Database::create(dir.join(FILE))?;
        let tx = db.begin_write()?;
        tx.open_table(TABLE)?;
        tx.commit()?;
        remove_sled_leftovers(dir);
        Ok(Self { db: Arc::new(db) })
    }

    /// The value stored under `key`, if any.
    pub fn get(&self, key: &[u8]) -> Result<Option<Vec<u8>>, StoreError> {
        let tx = self.db.begin_read()?;
        let table = tx.open_table(TABLE)?;
        Ok(table.get(key)?.map(|value| value.value().to_vec()))
    }

    /// Set every `(key, value)` in `rows` in one durable transaction: one fsync for a whole
    /// pulled page rather than one per row.
    pub fn insert_all<K: AsRef<[u8]>, V: AsRef<[u8]>>(
        &self,
        rows: &[(K, V)],
    ) -> Result<(), StoreError> {
        if rows.is_empty() {
            return Ok(());
        }
        let tx = self.db.begin_write()?;
        {
            let mut table = tx.open_table(TABLE)?;
            for (key, value) in rows {
                table.insert(key.as_ref(), value.as_ref())?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    /// Set `key` to `value`, durably.
    pub fn insert(&self, key: &[u8], value: &[u8]) -> Result<(), StoreError> {
        let tx = self.db.begin_write()?;
        tx.open_table(TABLE)?.insert(key, value)?;
        tx.commit()?;
        Ok(())
    }

    /// Delete every key in `keys` in one transaction; absent keys are not an error.
    pub fn remove_all<K: AsRef<[u8]>>(&self, keys: &[K]) -> Result<(), StoreError> {
        if keys.is_empty() {
            return Ok(());
        }
        let tx = self.db.begin_write()?;
        {
            let mut table = tx.open_table(TABLE)?;
            for key in keys {
                table.remove(key.as_ref())?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    /// Every entry, as owned bytes. The caches read it whole at boot and to prune.
    pub fn entries(&self) -> Result<Vec<Entry>, StoreError> {
        let tx = self.db.begin_read()?;
        let table = tx.open_table(TABLE)?;
        let mut out = Vec::new();
        for row in table.iter()? {
            let (key, value) = row?;
            out.push((key.value().to_vec(), value.value().to_vec()));
        }
        Ok(out)
    }
}

#[cfg(test)]
mod tests {
    use super::Store;

    #[test]
    fn entries_survive_a_reopen_and_removal_is_durable() -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempfile::tempdir()?;
        let store = Store::open(dir.path())?;
        store.insert(b"a", b"1")?;
        store.insert(b"b", b"2")?;
        store.remove_all(&[b"a".as_slice(), b"missing".as_slice()])?;
        drop(store);
        let store = Store::open(dir.path())?;
        assert_eq!(store.entries()?, vec![(b"b".to_vec(), b"2".to_vec())]);
        Ok(())
    }

    #[test]
    fn opening_removes_what_sled_left_and_keeps_everything_else()
    -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempfile::tempdir()?;
        for file in ["conf", "db", "snap.0000000000123", "keep.txt"] {
            std::fs::write(dir.path().join(file), b"x")?;
        }
        std::fs::create_dir(dir.path().join("blobs"))?;
        let store = Store::open(dir.path())?;
        store.insert(b"k", b"v")?;
        let mut left: Vec<String> = std::fs::read_dir(dir.path())?
            .map(|e| e.map(|e| e.file_name().to_string_lossy().into_owned()))
            .collect::<Result<_, _>>()?;
        left.sort();
        assert_eq!(left, vec!["keep.txt".to_owned(), "store.redb".to_owned()]);
        assert_eq!(store.get(b"k")?, Some(b"v".to_vec()));
        assert_eq!(store.get(b"missing")?, None);
        Ok(())
    }

    #[test]
    fn an_insert_replaces_the_old_value() -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempfile::tempdir()?;
        let store = Store::open(dir.path())?;
        store.insert(b"k", b"old")?;
        store.insert(b"k", b"new")?;
        assert_eq!(store.entries()?, vec![(b"k".to_vec(), b"new".to_vec())]);
        Ok(())
    }
}
