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
        Ok(Self { db: Arc::new(db) })
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
    fn an_insert_replaces_the_old_value() -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempfile::tempdir()?;
        let store = Store::open(dir.path())?;
        store.insert(b"k", b"old")?;
        store.insert(b"k", b"new")?;
        assert_eq!(store.entries()?, vec![(b"k".to_vec(), b"new".to_vec())]);
        Ok(())
    }
}
