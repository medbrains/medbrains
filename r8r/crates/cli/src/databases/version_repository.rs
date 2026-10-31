//! Workflow history.
//!
//! Every save records what the workflow looked like, so that "it worked
//! yesterday" is a question with an answer. History is append-only — see
//! migration 7 for why a restore adds a version rather than removing them.

use super::Database;
use chrono::Utc;
use r8r_workflow::{Workflow, diff::WorkflowDiff};
use rusqlite::{Row, params};

/// How many versions of one workflow are kept.
///
/// Unbounded history on a workflow somebody edits fifty times an afternoon is
/// a table that grows without anybody choosing it. The newest version is
/// always the current one, so trimming the oldest never discards what is
/// deployed.
pub const KEEP_VERSIONS: usize = 50;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowVersion {
    pub id: String,
    pub workflow_id: String,
    pub version: i64,
    pub name: String,
    pub created_at: String,
    pub note: Option<String>,
}

/// A version with the workflow it held, for viewing or restoring.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredVersion {
    #[serde(flatten)]
    pub meta: WorkflowVersion,
    pub workflow: Workflow,
}

/// A history entry, with what changed since the version before it.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionEntry {
    #[serde(flatten)]
    pub meta: WorkflowVersion,
    /// What this save changed. `None` for the first version, which changed
    /// everything and so says nothing useful.
    pub changes: Option<WorkflowDiff>,
    pub summary: String,
}

#[derive(Debug)]
pub struct VersionRepository<'a> {
    pub(super) db: &'a Database,
}

impl VersionRepository<'_> {
    /// Record what a workflow looks like now.
    ///
    /// Returns the version number written. Saving a workflow that has not
    /// changed writes nothing and returns the version it already had — a
    /// history full of identical entries hides the ones that matter.
    pub fn record(&self, workflow: &Workflow, note: Option<&str>) -> rusqlite::Result<i64> {
        if let Some(latest) = self.latest(&workflow.id)?
            && r8r_workflow::diff::diff(&latest.workflow, workflow).is_empty()
        {
            return Ok(latest.meta.version);
        }

        let version = self.next_version(&workflow.id)?;
        self.db.conn().execute(
            "INSERT INTO workflow_version
               (id, workflow_id, version, name, nodes, connections, settings, created_at, note)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                uuid::Uuid::new_v4().to_string(),
                workflow.id,
                version,
                workflow.name,
                json_text(&workflow.nodes),
                json_text(&workflow.connections),
                json_text(&workflow.settings),
                Utc::now().to_rfc3339(),
                note,
            ],
        )?;

        self.trim(&workflow.id)?;
        Ok(version)
    }

    /// The history of one workflow, newest first, each entry carrying what it
    /// changed relative to the one before it.
    pub fn history(&self, workflow_id: &str) -> rusqlite::Result<Vec<VersionEntry>> {
        let versions = self.all(workflow_id)?;

        Ok(versions
            .iter()
            .enumerate()
            .map(|(index, stored)| {
                // `versions` is newest first, so the version before this one is
                // the next element.
                let previous = versions.get(index + 1);
                let changes = previous
                    .map(|earlier| r8r_workflow::diff::diff(&earlier.workflow, &stored.workflow));
                let summary = changes.as_ref().map_or_else(
                    || "Created".to_owned(),
                    r8r_workflow::diff::WorkflowDiff::summary,
                );
                VersionEntry {
                    meta: stored.meta.clone(),
                    changes,
                    summary,
                }
            })
            .collect())
    }

    pub fn find(&self, workflow_id: &str, version: i64) -> rusqlite::Result<Option<StoredVersion>> {
        let conn = self.db.conn();
        let mut stmt = conn.prepare(
            "SELECT id, workflow_id, version, name, nodes, connections, settings, created_at, note
             FROM workflow_version WHERE workflow_id = ?1 AND version = ?2",
        )?;
        let mut rows = stmt.query_map(params![workflow_id, version], from_row)?;
        rows.next().transpose()
    }

    /// What changed between two versions, in either direction.
    pub fn compare(
        &self,
        workflow_id: &str,
        from: i64,
        to: i64,
    ) -> rusqlite::Result<Option<WorkflowDiff>> {
        let (Some(before), Some(after)) =
            (self.find(workflow_id, from)?, self.find(workflow_id, to)?)
        else {
            return Ok(None);
        };
        Ok(Some(r8r_workflow::diff::diff(
            &before.workflow,
            &after.workflow,
        )))
    }

    pub fn latest(&self, workflow_id: &str) -> rusqlite::Result<Option<StoredVersion>> {
        let conn = self.db.conn();
        let mut stmt = conn.prepare(
            "SELECT id, workflow_id, version, name, nodes, connections, settings, created_at, note
             FROM workflow_version WHERE workflow_id = ?1 ORDER BY version DESC LIMIT 1",
        )?;
        let mut rows = stmt.query_map(params![workflow_id], from_row)?;
        rows.next().transpose()
    }

    pub fn count(&self, workflow_id: &str) -> rusqlite::Result<i64> {
        self.db.conn().query_row(
            "SELECT COUNT(*) FROM workflow_version WHERE workflow_id = ?1",
            params![workflow_id],
            |row| row.get(0),
        )
    }

    fn all(&self, workflow_id: &str) -> rusqlite::Result<Vec<StoredVersion>> {
        let conn = self.db.conn();
        let mut stmt = conn.prepare(
            "SELECT id, workflow_id, version, name, nodes, connections, settings, created_at, note
             FROM workflow_version WHERE workflow_id = ?1 ORDER BY version DESC",
        )?;
        let rows = stmt.query_map(params![workflow_id], from_row)?;
        rows.collect()
    }

    fn next_version(&self, workflow_id: &str) -> rusqlite::Result<i64> {
        let highest: Option<i64> = self.db.conn().query_row(
            "SELECT MAX(version) FROM workflow_version WHERE workflow_id = ?1",
            params![workflow_id],
            |row| row.get(0),
        )?;
        Ok(highest.unwrap_or(0).saturating_add(1))
    }

    /// Drop the oldest versions past the retention cap.
    fn trim(&self, workflow_id: &str) -> rusqlite::Result<usize> {
        self.db.conn().execute(
            "DELETE FROM workflow_version
              WHERE workflow_id = ?1
                AND version <= (
                    SELECT MAX(version) - ?2 FROM workflow_version WHERE workflow_id = ?1
                )",
            params![
                workflow_id,
                i64::try_from(KEEP_VERSIONS).unwrap_or(i64::MAX)
            ],
        )
    }
}

fn from_row(row: &Row<'_>) -> rusqlite::Result<StoredVersion> {
    let workflow = Workflow {
        id: row.get("workflow_id")?,
        name: row.get("name")?,
        // A stored version does not remember whether the workflow was switched
        // on at the time: activation is an operational state, not a revision of
        // what the workflow does, and restoring one must not silently start it.
        active: false,
        nodes: parse(&row.get::<_, String>("nodes")?),
        connections: parse(&row.get::<_, String>("connections")?),
        settings: parse(&row.get::<_, String>("settings")?),
    };

    Ok(StoredVersion {
        meta: WorkflowVersion {
            id: row.get("id")?,
            workflow_id: row.get("workflow_id")?,
            version: row.get("version")?,
            name: row.get("name")?,
            created_at: row.get("created_at")?,
            note: row.get("note")?,
        },
        workflow,
    })
}

fn parse<T: serde::de::DeserializeOwned + Default>(text: &str) -> T {
    serde_json::from_str(text).unwrap_or_default()
}

fn json_text<T: serde::Serialize>(value: &T) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| String::from("null"))
}
