//! Operating-system packages with security updates (RFC-OSINT §3.1), daily.
//!
//! On Debian or Ubuntu, `apt-get -s upgrade` (a simulation: no root, no
//! change, no network) lists what the host's package lists say can be
//! upgraded; the ones from a security suite are findings. Not Debian:
//! "not applicable", honestly. Debian without apt: "could not check".

use std::path::Path;
use std::time::{Duration, SystemTime};

use serde_json::json;
use uuid::Uuid;

use crate::model::{CheckError, Found, Report, Severity};
use crate::runner::{Check, Ctx};

pub const KEY: &str = "debian";
const APT_TIMEOUT: Duration = Duration::from_secs(120);
const LISTS: &str = "/var/lib/apt/lists";
/// Package lists older than this may miss recent security updates.
const LISTS_STALE_DAYS: u64 = 7;

#[derive(Debug)]
pub struct Debian;

#[async_trait::async_trait]
impl Check for Debian {
    fn key(&self) -> &'static str {
        KEY
    }

    async fn run(&self, _ctx: &Ctx, _tenant: Option<Uuid>) -> Result<Report, CheckError> {
        if !Path::new("/etc/debian_version").exists() {
            return Ok(Report::not_applicable("not a Debian or Ubuntu host"));
        }
        let output = tokio::time::timeout(
            APT_TIMEOUT,
            tokio::process::Command::new("apt-get")
                .args(["-s", "-o", "Debug::NoLocking=1", "upgrade"])
                .env("LC_ALL", "C")
                .output(),
        )
        .await
        .map_err(|_| CheckError("could not check: apt-get did not finish in time".into()))?
        .map_err(|e| CheckError(format!("could not check: apt-get is not available ({e})")))?;
        if !output.status.success() {
            return Err(CheckError(format!(
                "could not check: apt-get failed ({})",
                String::from_utf8_lossy(&output.stderr).trim()
            )));
        }
        let mut findings = security_updates(&String::from_utf8_lossy(&output.stdout));
        let updates = findings.len();
        if let Some(days) = lists_age_days().filter(|d| *d > LISTS_STALE_DAYS) {
            findings.push(Found {
                asset: "apt package lists".to_owned(),
                key: "stale".to_owned(),
                title: format!("Package lists are {days} days old, so updates may be missing"),
                severity: Severity::Medium,
                evidence: json!({ "age_days": days }),
                how_to_fix: "Run sudo apt-get update, or enable unattended-upgrades.".to_owned(),
                cve_id: None,
            });
        }
        Ok(Report::found(
            findings,
            json!({ "security_updates": updates }),
        ))
    }
}

fn lists_age_days() -> Option<u64> {
    let modified = std::fs::metadata(LISTS).ok()?.modified().ok()?;
    Some(SystemTime::now().duration_since(modified).ok()?.as_secs() / 86_400)
}

/// `Inst openssl [3.0.11-1~deb12u1] (3.0.11-1~deb12u2 Debian-Security:12/stable-security [amd64])`
/// → a finding when the origin is a security suite.
#[must_use]
pub fn security_updates(apt_output: &str) -> Vec<Found> {
    apt_output
        .lines()
        .filter_map(|line| {
            let rest = line.strip_prefix("Inst ")?;
            let (name, rest) = rest.split_once(' ')?;
            let current = rest.strip_prefix('[').and_then(|r| r.split_once(']')).map(|(v, _)| v);
            let target = rest.split_once('(')?.1;
            let (version, origin) = target.split_once(' ')?;
            if !origin.to_ascii_lowercase().contains("security") {
                return None;
            }
            Some(Found {
                asset: format!("Debian package {name}"),
                key: name.to_owned(),
                title: format!(
                    "{name} has a security update ({} → {version})",
                    current.unwrap_or("installed")
                ),
                severity: Severity::High,
                evidence: json!({ "installed": current, "available": version, "origin": origin.trim_end_matches(')') }),
                how_to_fix: format!("sudo apt-get update && sudo apt-get install --only-upgrade {name}"),
                cve_id: None,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_security_suite_upgrades_are_findings() {
        let out = "Reading package lists...\n\
            Inst openssl [3.0.11-1~deb12u1] (3.0.11-1~deb12u2 Debian-Security:12/stable-security [amd64])\n\
            Inst tzdata [2024a-0+deb12u1] (2025b-0+deb12u1 Debian:12.11/stable [all])\n\
            Conf openssl (3.0.11-1~deb12u2 Debian-Security:12/stable-security [amd64])\n";
        let found = security_updates(out);
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].key, "openssl");
        assert!(
            found[0]
                .title
                .contains("3.0.11-1~deb12u1 → 3.0.11-1~deb12u2")
        );
    }

    #[test]
    fn ubuntu_security_pockets_count() {
        let out =
            "Inst libc6 [2.35-0ubuntu3.6] (2.35-0ubuntu3.8 Ubuntu:22.04/jammy-security [amd64])";
        assert_eq!(security_updates(out).len(), 1);
    }
}
