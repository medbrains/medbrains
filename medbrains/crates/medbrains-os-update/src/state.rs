//! What this machine remembers about updates, in one file on the data disk. Written whole and replaced
//! in one step, so a power cut leaves the old state or the new. Every transition is a plain function
//! here, tested from every starting state.

use std::fs::{self, File};
use std::io::Write;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::version::Version;

const MAX_FAILED: usize = 8;
/// Versions whose database schema is remembered: the running one and the few a machine could go back to.
const MAX_SCHEMAS: usize = 8;
/// Boot files whose hash is remembered: at most two are on the boot partition, plus one staged.
const MAX_BOOT_FILES: usize = 4;
/// The most of a health check's reason kept: a list of failed units can be long, and the record is bounded.
const MAX_REASON_CHARS: usize = 600;

/// Where an update has got to.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Stage {
    /// Nothing under way.
    #[default]
    Idle,
    /// Downloading and checking; nothing has touched the other system partition.
    Fetching,
    /// Writing the other system partition.
    Writing,
    /// Ready in the other partition, waiting for a person or a quiet window.
    Waiting,
    /// Boot file published: the next start, or this one, is the new version on trial.
    Applied,
}

/// The update being worked on.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct Target {
    /// The version being installed.
    pub version: String,
    /// The floor it declares, applied once it proves good.
    pub min_version: String,
    /// A security fix.
    pub security: bool,
    /// One plain sentence for the screen.
    pub summary: String,
    /// When it became ready to apply, so a security fix left waiting too long is said loudly.
    pub ready_at: Option<u64>,
    /// The signed hash of its boot file, checked again when it is applied.
    pub boot_sha256: String,
}

/// A system slot that failed its seal check while its version was in use. The slot is damaged, not the
/// version: the same version may be installed again over it.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct Damaged {
    /// The version the slot holds.
    pub version: String,
    /// The slot's partition UUID, which says which slot it is.
    pub uuid: String,
    /// When it was found, in seconds since 1970.
    pub at: u64,
    /// The start it was found in, so the next start knows it is the next one.
    pub boot_id: String,
}

/// The database schema a version left: its highest migration, or `none` on a machine with no database.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Schema {
    /// The version.
    pub version: String,
    /// Its schema.
    pub schema: String,
}

/// A boot file as it was put on the boot partition, so a change to it is noticed before anything is
/// deleted there.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BootFile {
    /// The version it starts.
    pub version: String,
    /// Its SHA-256.
    pub sha256: String,
}

/// How an attempt ended.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Ending {
    /// The new version passed its checks.
    Good,
    /// The new version failed, and the machine went back by itself.
    RolledBack,
    /// A person chose to go back.
    WentBack,
    /// The bundle was refused before anything was written.
    Refused,
    /// A step failed, and the machine stays on what it runs.
    Failed,
    /// A power cut or restart stopped it, and it can be started again.
    Interrupted,
    /// The system partition failed its seal check.
    SealFailed,
}

/// An attempt's result, for the screen.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Outcome {
    /// The version it concerned, if known.
    pub version: String,
    /// How it ended.
    pub result: Ending,
    /// The sentence to show.
    pub words: String,
    /// When, in seconds since 1970.
    pub at: u64,
}

/// Everything remembered between runs and across restarts.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct State {
    /// Where the current attempt is.
    pub stage: Stage,
    /// The update being worked on.
    pub target: Option<Target>,
    /// Versions below this are refused for good: raised only when a signed update proves good.
    pub floor: Option<String>,
    /// Versions that failed here, so a quiet window can't reboot into the same failure every night.
    pub failed: Vec<String>,
    /// The other partition's version, if a person can go back to it.
    pub previous: Option<String>,
    /// Why a trial boot failed, for the old system to report.
    pub health_reason: Option<String>,
    /// The last attempt's result.
    pub last: Option<Outcome>,
    /// When a signed manifest was last read, so a channel that stops answering shows on the screen.
    pub checked: Option<u64>,
    /// A slot that failed its seal check while in use, until it is installed over.
    pub damaged: Option<Damaged>,
    /// The database schema each recent version left, so going back is allowed only to a compatible one.
    pub schemas: Vec<Schema>,
    /// The hash of each boot file this machine put on the boot partition.
    pub boot_files: Vec<BootFile>,
}

impl State {
    /// Reads the state. A file that is absent is a machine that never updated; a damaged one is a
    /// fault, because treating it as empty would forget the anti-rollback floor.
    pub fn load(path: &Path) -> Result<Self, String> {
        match fs::read(path) {
            Ok(bytes) => serde_json::from_slice(&bytes)
                .map_err(|e| format!("The update record is damaged: {e}")),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Self::default()),
            Err(e) => Err(format!("The update record can't be read: {e}")),
        }
    }

    /// Saves the state whole and in one step.
    pub fn save(&self, path: &Path) -> Result<(), String> {
        let text = serde_json::to_vec_pretty(self).map_err(|e| e.to_string())?;
        write_atomically(path, &text).map_err(|e| format!("The update record can't be saved: {e}"))
    }

    /// Records a version that failed, keeping the list bounded. A version that can't be named is not
    /// recorded: an empty entry would match nothing, and would push a real one out.
    pub fn add_failed(&mut self, version: &str) {
        if version.is_empty() {
            return;
        }
        if !self.failed.iter().any(|known| known == version) {
            self.failed.push(version.to_owned());
        }
        if self.failed.len() > MAX_FAILED {
            self.failed.remove(0);
        }
    }

    /// Remembers the database schema `version` left, keeping the list bounded.
    pub fn record_schema(&mut self, version: &str, schema: &str) {
        self.schemas.retain(|known| known.version != version);
        self.schemas.push(Schema {
            version: version.to_owned(),
            schema: schema.to_owned(),
        });
        if self.schemas.len() > MAX_SCHEMAS {
            self.schemas.remove(0);
        }
    }

    /// True only if `previous` is known to have left the same database schema as `current`, so its
    /// server would start on today's database. Unknown is not compatible.
    pub fn can_go_back(&self, previous: &str, current: &str) -> bool {
        let of = |version: &str| {
            self.schemas
                .iter()
                .find(|known| known.version == version)
                .map(|known| known.schema.as_str())
        };
        of(previous).is_some_and(|schema| Some(schema) == of(current))
    }

    /// Remembers the hash of the boot file that starts `version`, keeping the list bounded.
    pub fn record_boot_file(&mut self, version: &str, sha256: &str) {
        self.boot_files.retain(|known| known.version != version);
        self.boot_files.push(BootFile {
            version: version.to_owned(),
            sha256: sha256.to_owned(),
        });
        if self.boot_files.len() > MAX_BOOT_FILES {
            self.boot_files.remove(0);
        }
    }

    /// The remembered hash of the boot file that starts `version`.
    pub fn boot_file_hash(&self, version: &str) -> Option<&str> {
        self.boot_files
            .iter()
            .find(|known| known.version == version)
            .map(|known| known.sha256.as_str())
    }

    /// Puts things right at each start, after a power cut or a return to the old system.
    /// `current` is the running version, `on_trial` whether this boot still has to prove itself.
    pub fn reconcile(&mut self, current: &str, on_trial: bool, now: u64) {
        match (self.stage, self.target.clone()) {
            (Stage::Fetching | Stage::Writing, target) => {
                let version = target.map_or_else(String::new, |t| t.version);
                let words =
                    "The update was interrupted, and nothing changed. It can be started again.";
                self.finish(&version, Ending::Interrupted, words, now);
            }
            (Stage::Waiting | Stage::Applied, Some(target)) if target.version == current => {
                // A trial boot waits for its health check. Otherwise it is already blessed.
                self.stage = Stage::Applied;
                if !on_trial {
                    self.mark_good(current, now);
                }
            }
            (Stage::Applied, Some(target)) => self.report_return(&target.version, current, now),
            (Stage::Waiting | Stage::Applied, None) => self.stage = Stage::Idle,
            (Stage::Idle | Stage::Waiting, _) => {}
        }
    }

    /// The machine is back on the old version with the new one applied, so the new one failed.
    fn report_return(&mut self, failed: &str, current: &str, now: u64) {
        let reason = self
            .health_reason
            .take()
            .unwrap_or_else(|| "It did not finish starting.".to_owned());
        self.add_failed(failed);
        let words = format!(
            "Version {failed} did not pass its checks, so the machine went back to {current} by itself. {reason}"
        );
        self.finish(failed, Ending::RolledBack, &words, now);
    }

    /// Records a result without disturbing an update that is already waiting.
    pub fn note(&mut self, version: &str, result: Ending, words: &str, now: u64) {
        self.last = Some(Outcome {
            version: version.to_owned(),
            result,
            words: words.to_owned(),
            at: now,
        });
    }

    /// Ends an attempt with a result.
    pub fn finish(&mut self, version: &str, result: Ending, words: &str, now: u64) {
        self.stage = Stage::Idle;
        self.target = None;
        self.health_reason = None;
        self.note(version, result, words, now);
    }

    /// The running version passed its checks: raise the floor and forget any earlier failure of it.
    pub fn mark_good(&mut self, current: &str, now: u64) {
        let declared = self.target.as_ref().map(|t| t.min_version.clone());
        self.floor = raised_floor(self.floor.as_deref(), declared.as_deref());
        self.failed.retain(|version| version != current);
        let words = format!("Updated to version {current}.");
        self.finish(current, Ending::Good, &words, now);
    }

    /// The running version failed its checks: the old system reports it after the restart.
    pub fn mark_failed_health(&mut self, reason: &str) {
        self.stage = Stage::Applied;
        self.health_reason = Some(reason.chars().take(MAX_REASON_CHARS).collect());
    }
}

/// The higher of two floors; one that doesn't parse can't lower or replace a good one.
fn raised_floor(old: Option<&str>, declared: Option<&str>) -> Option<String> {
    let parse = |text: Option<&str>| text.and_then(Version::parse);
    match (parse(old), parse(declared)) {
        (Some(a), Some(b)) => Some(a.max(b).to_string()),
        (Some(a), None) | (None, Some(a)) => Some(a.to_string()),
        (None, None) => None,
    }
}

/// Replaces `path` in one step, flushing the file and then its folder.
pub fn write_atomically(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let temporary = path.with_extension("tmp");
    let mut file = File::create(&temporary)?;
    file.write_all(bytes)?;
    file.sync_all()?;
    fs::rename(&temporary, path)?;
    sync_parent(path)
}

/// Flushes the folder holding `path`, so a rename survives a power cut.
pub fn sync_parent(path: &Path) -> std::io::Result<()> {
    match path.parent() {
        Some(parent) => File::open(parent)?.sync_all(),
        None => Ok(()),
    }
}

#[cfg(test)]
#[path = "state_tests.rs"]
mod tests;
