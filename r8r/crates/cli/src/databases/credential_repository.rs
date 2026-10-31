//! Storage for credentials. The `data` column is always ciphertext: this
//! module is the only place that holds the key, and it never hands plaintext
//! to anything but the execution engine.

use super::Database;
use chrono::Utc;
use r8r_core::{CoreError, Encryptor, Result as CoreResult};
use rusqlite::{Row, params};
use serde_json::Value;

/// A credential as the API describes it — no secret values.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialSummary {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub type_name: String,
    pub created_at: String,
    pub updated_at: String,
}

/// A credential with its decrypted contents. Never serialise this.
#[derive(Debug, Clone)]
pub struct DecryptedCredential {
    pub summary: CredentialSummary,
    pub data: Value,
}

#[derive(Debug)]
pub struct CredentialRepository<'a> {
    pub(super) db: &'a Database,
    pub(super) encryptor: &'a Encryptor,
}

const COLUMNS: &str = "id, name, type, created_at, updated_at";

impl CredentialRepository<'_> {
    pub fn list(&self) -> rusqlite::Result<Vec<CredentialSummary>> {
        let conn = self.db.conn();
        let sql = format!("SELECT {COLUMNS} FROM credential_entity ORDER BY name");
        let mut stmt = conn.prepare(&sql)?;
        stmt.query_map([], summary_from_row)?.collect()
    }

    pub fn find(&self, id: &str) -> rusqlite::Result<Option<CredentialSummary>> {
        let conn = self.db.conn();
        let sql = format!("SELECT {COLUMNS} FROM credential_entity WHERE id = ?1");
        let mut stmt = conn.prepare(&sql)?;
        let mut rows = stmt.query_map(params![id], summary_from_row)?;
        rows.next().transpose()
    }

    /// Read and decrypt. Used by the execution engine and by "save" so an
    /// unchanged secret can be carried over.
    pub fn decrypt(&self, id: &str) -> CoreResult<Option<DecryptedCredential>> {
        let row: Option<(CredentialSummary, String)> = {
            let conn = self.db.conn();
            let sql = format!("SELECT {COLUMNS}, data FROM credential_entity WHERE id = ?1");
            let mut stmt = conn.prepare(&sql).map_err(|e| db_error(&e))?;
            let mut rows = stmt
                .query_map(params![id], |row| {
                    Ok((summary_from_row(row)?, row.get::<_, String>(5)?))
                })
                .map_err(|e| db_error(&e))?;
            rows.next().transpose().map_err(|e| db_error(&e))?
        };

        let Some((summary, sealed)) = row else {
            return Ok(None);
        };
        let plaintext = self.encryptor.decrypt(&sealed)?;
        let data = serde_json::from_str(&plaintext)
            .map_err(|e| CoreError::Node(format!("stored credential is not valid JSON: {e}")))?;

        Ok(Some(DecryptedCredential { summary, data }))
    }

    pub fn insert(&self, id: &str, name: &str, type_name: &str, data: &Value) -> CoreResult<()> {
        let sealed = self.encryptor.encrypt(&data.to_string())?;
        let now = Utc::now().to_rfc3339();
        self.db
            .conn()
            .execute(
                "INSERT INTO credential_entity (id, name, type, data, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
                params![id, name, type_name, sealed, now],
            )
            .map_err(|e| db_error(&e))?;
        Ok(())
    }

    pub fn update(&self, id: &str, name: &str, data: &Value) -> CoreResult<usize> {
        let sealed = self.encryptor.encrypt(&data.to_string())?;
        self.db
            .conn()
            .execute(
                "UPDATE credential_entity SET name = ?2, data = ?3, updated_at = ?4 WHERE id = ?1",
                params![id, name, sealed, Utc::now().to_rfc3339()],
            )
            .map_err(|e| db_error(&e))
    }

    pub fn delete(&self, id: &str) -> rusqlite::Result<usize> {
        self.db
            .conn()
            .execute("DELETE FROM credential_entity WHERE id = ?1", params![id])
    }
}

fn db_error(e: &rusqlite::Error) -> CoreError {
    CoreError::Node(format!("database error: {e}"))
}

fn summary_from_row(row: &Row<'_>) -> rusqlite::Result<CredentialSummary> {
    Ok(CredentialSummary {
        id: row.get(0)?,
        name: row.get(1)?,
        type_name: row.get(2)?,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
    })
}
