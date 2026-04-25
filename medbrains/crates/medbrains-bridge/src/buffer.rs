use anyhow::Result;
use rusqlite::Connection;
use std::sync::{Arc, Mutex};

/// SQLite-backed message buffer for offline resilience.
/// Messages are stored locally and drained to MedBrains API.
#[derive(Clone)]
pub struct MessageBuffer {
    conn: Arc<Mutex<Connection>>,
}

impl MessageBuffer {
    pub fn open(path: &str) -> Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS pending_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_instance_id TEXT NOT NULL,
                module TEXT NOT NULL,
                protocol TEXT NOT NULL,
                parsed_payload TEXT NOT NULL,
                mapped_data TEXT NOT NULL,
                processing_duration_ms INTEGER,
                retry_count INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                last_error TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_pending_retry ON pending_messages(retry_count);",
        )?;
        Ok(Self { conn: Arc::new(Mutex::new(conn)) })
    }

    /// Store a message for delivery.
    pub fn enqueue(
        &self,
        device_instance_id: &str,
        module: &str,
        protocol: &str,
        parsed_payload: &serde_json::Value,
        mapped_data: &serde_json::Value,
        duration_ms: Option<i32>,
    ) -> Result<i64> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("lock: {e}"))?;
        conn.execute(
            "INSERT INTO pending_messages (device_instance_id, module, protocol, parsed_payload, mapped_data, processing_duration_ms)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                device_instance_id,
                module,
                protocol,
                serde_json::to_string(parsed_payload)?,
                serde_json::to_string(mapped_data)?,
                duration_ms,
            ],
        )?;
        Ok(conn.last_insert_rowid())
    }

    /// Get pending messages for delivery (oldest first, max 50).
    pub fn pending(&self, limit: usize) -> Result<Vec<BufferedMessage>> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("lock: {e}"))?;
        let mut stmt = conn.prepare(
            "SELECT id, device_instance_id, module, protocol, parsed_payload, mapped_data, processing_duration_ms, retry_count
             FROM pending_messages WHERE retry_count < 100
             ORDER BY id ASC LIMIT ?1",
        )?;
        let rows = stmt.query_map([limit], |row| {
            Ok(BufferedMessage {
                id: row.get(0)?,
                device_instance_id: row.get(1)?,
                module: row.get(2)?,
                protocol: row.get(3)?,
                parsed_payload: row.get(4)?,
                mapped_data: row.get(5)?,
                processing_duration_ms: row.get(6)?,
                _retry_count: row.get(7)?,
            })
        })?;
        let mut result = Vec::new();
        for r in rows {
            result.push(r?);
        }
        Ok(result)
    }

    /// Remove a delivered message.
    pub fn remove(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("lock: {e}"))?;
        conn.execute("DELETE FROM pending_messages WHERE id = ?1", [id])?;
        Ok(())
    }

    /// Increment retry count and store error.
    pub fn mark_retry(&self, id: i64, error: &str) -> Result<()> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("lock: {e}"))?;
        conn.execute(
            "UPDATE pending_messages SET retry_count = retry_count + 1, last_error = ?2 WHERE id = ?1",
            rusqlite::params![id, error],
        )?;
        Ok(())
    }

}

pub struct BufferedMessage {
    pub id: i64,
    pub device_instance_id: String,
    pub module: String,
    pub protocol: String,
    pub parsed_payload: String,
    pub mapped_data: String,
    pub processing_duration_ms: Option<i32>,
    pub _retry_count: i32,
}
