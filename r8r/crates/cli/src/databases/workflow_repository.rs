use super::Database;
use chrono::Utc;
use r8r_workflow::Workflow;
use rusqlite::{Row, params};
use serde_json::{Map, Value};

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredWorkflow {
    #[serde(flatten)]
    pub workflow: Workflow,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug)]
pub struct WorkflowRepository<'a> {
    pub(super) db: &'a Database,
}

impl WorkflowRepository<'_> {
    pub fn list(&self) -> rusqlite::Result<Vec<StoredWorkflow>> {
        let conn = self.db.conn();
        let mut stmt = conn.prepare(
            "SELECT id, name, active, nodes, connections, settings, created_at, updated_at
             FROM workflow_entity ORDER BY updated_at DESC",
        )?;
        let rows = stmt.query_map([], from_row)?;
        rows.collect()
    }

    pub fn find(&self, id: &str) -> rusqlite::Result<Option<StoredWorkflow>> {
        let conn = self.db.conn();
        let mut stmt = conn.prepare(
            "SELECT id, name, active, nodes, connections, settings, created_at, updated_at
             FROM workflow_entity WHERE id = ?1",
        )?;
        let mut rows = stmt.query_map(params![id], from_row)?;
        rows.next().transpose()
    }

    /// Every active workflow — what the scheduler and webhook router scan.
    pub fn active(&self) -> rusqlite::Result<Vec<StoredWorkflow>> {
        let conn = self.db.conn();
        let mut stmt = conn.prepare(
            "SELECT id, name, active, nodes, connections, settings, created_at, updated_at
             FROM workflow_entity WHERE active = 1",
        )?;
        let rows = stmt.query_map([], from_row)?;
        rows.collect()
    }

    pub fn insert(&self, wf: &Workflow) -> rusqlite::Result<StoredWorkflow> {
        let now = Utc::now().to_rfc3339();
        self.db.conn().execute(
            "INSERT INTO workflow_entity
               (id, name, active, nodes, connections, settings, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
            params![
                wf.id,
                wf.name,
                i64::from(wf.active),
                json_text(&wf.nodes),
                json_text(&wf.connections),
                json_text(&wf.settings),
                now,
            ],
        )?;
        Ok(StoredWorkflow {
            workflow: wf.clone(),
            created_at: now.clone(),
            updated_at: now,
        })
    }

    pub fn update(&self, wf: &Workflow) -> rusqlite::Result<usize> {
        self.db.conn().execute(
            "UPDATE workflow_entity
                SET name = ?2, active = ?3, nodes = ?4, connections = ?5,
                    settings = ?6, updated_at = ?7
              WHERE id = ?1",
            params![
                wf.id,
                wf.name,
                i64::from(wf.active),
                json_text(&wf.nodes),
                json_text(&wf.connections),
                json_text(&wf.settings),
                Utc::now().to_rfc3339(),
            ],
        )
    }

    pub fn set_active(&self, id: &str, active: bool) -> rusqlite::Result<usize> {
        self.db.conn().execute(
            "UPDATE workflow_entity SET active = ?2, updated_at = ?3 WHERE id = ?1",
            params![id, i64::from(active), Utc::now().to_rfc3339()],
        )
    }

    pub fn delete(&self, id: &str) -> rusqlite::Result<usize> {
        self.db
            .conn()
            .execute("DELETE FROM workflow_entity WHERE id = ?1", params![id])
    }
}

fn json_text<T: serde::Serialize>(v: &T) -> String {
    serde_json::to_string(v).unwrap_or_else(|_| "null".into())
}

fn from_row(row: &Row<'_>) -> rusqlite::Result<StoredWorkflow> {
    let parse = |s: String, fallback: Value| serde_json::from_str(&s).unwrap_or(fallback);
    Ok(StoredWorkflow {
        workflow: Workflow {
            id: row.get(0)?,
            name: row.get(1)?,
            active: row.get::<_, i64>(2)? != 0,
            nodes: serde_json::from_str(&row.get::<_, String>(3)?).unwrap_or_default(),
            connections: serde_json::from_str(&row.get::<_, String>(4)?).unwrap_or_default(),
            settings: parse(row.get::<_, String>(5)?, Value::Object(Map::default())),
        },
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}
