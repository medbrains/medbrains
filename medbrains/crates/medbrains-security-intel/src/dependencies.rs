//! Vulnerable dependencies (RFC-OSINT §3.1), daily.
//!
//! The release carries the exact crate and npm versions it was built from
//! (`build.rs`); the check compares them with OSV advisories (`RustSec` and
//! the GitHub Advisory Database).
//!
//! Two sources, in order:
//! 1. **online** — OSV's API, only when network lookups are allowed
//!    ([`crate::network_lookups_allowed`]);
//! 2. **bundle** — the advisory file shipped with the release
//!    (`MEDBRAINS_ADVISORY_BUNDLE`, made by `scripts/build_advisory_bundle.py`),
//!    for installs that never call out.
//!
//! Neither available, or the lookup failing, is an error ("could not
//! check"), never zero findings.

use std::collections::{BTreeSet, HashMap, HashSet};
use std::time::Duration;

use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::model::{CheckError, Found, Report, Severity};
use crate::runner::{Check, Ctx};

pub const KEY: &str = "dependencies";
const PACKAGES: &str = include_str!(concat!(env!("OUT_DIR"), "/packages.tsv"));
const OSV_URL: &str = "https://api.osv.dev";
const DEFAULT_BUNDLE: &str = "/usr/share/medbrains/advisories.json";
/// OSV accepts up to 1000 queries per batch.
const BATCH: usize = 1000;
/// Advisories whose details are fetched in one run.
const MAX_DETAILS: usize = 200;
/// A bundle older than this is reported as stale.
const STALE_DAYS: i64 = 30;
const TIMEOUT: Duration = Duration::from_secs(30);

/// One package this release ships.
#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct Package {
    pub ecosystem: String,
    pub name: String,
    pub version: String,
}

/// Every package embedded at build time.
#[must_use]
pub fn shipped() -> Vec<Package> {
    parse_packages(PACKAGES)
}

fn parse_packages(tsv: &str) -> Vec<Package> {
    let unique: BTreeSet<Package> = tsv
        .lines()
        .filter_map(|l| {
            let mut c = l.split('\t');
            Some(Package {
                ecosystem: c.next()?.to_owned(),
                name: c.next()?.to_owned(),
                version: c.next()?.to_owned(),
            })
        })
        .collect();
    unique.into_iter().collect()
}

/// One advisory against one shipped package.
#[derive(Debug, Clone, Deserialize)]
pub struct Advisory {
    pub ecosystem: String,
    pub name: String,
    pub version: String,
    pub id: String,
    #[serde(default)]
    pub summary: String,
    pub severity: Option<String>,
    /// `RustSec` notices with no severity: "unmaintained", "unsound", "notice".
    #[serde(default)]
    pub informational: Option<String>,
    pub fixed: Option<String>,
}

/// The release's advisory file.
#[derive(Debug, Deserialize)]
pub struct Bundle {
    pub generated_at: DateTime<Utc>,
    pub advisories: Vec<Advisory>,
}

/// Where advisories come from on this install.
#[derive(Debug, Clone)]
pub enum Source {
    Online(String),
    Bundle(String),
}

impl Source {
    /// Online when allowed, else the shipped bundle.
    #[must_use]
    pub fn configured() -> Self {
        if crate::network_lookups_allowed() {
            Self::Online(std::env::var("MEDBRAINS_OSV_URL").unwrap_or_else(|_| OSV_URL.to_owned()))
        } else {
            Self::Bundle(
                std::env::var("MEDBRAINS_ADVISORY_BUNDLE")
                    .unwrap_or_else(|_| DEFAULT_BUNDLE.to_owned()),
            )
        }
    }
}

#[derive(Debug)]
pub struct Dependencies;

#[async_trait::async_trait]
impl Check for Dependencies {
    fn key(&self) -> &'static str {
        KEY
    }

    async fn run(&self, _ctx: &Ctx, _tenant: Option<Uuid>) -> Result<Report, CheckError> {
        check(&Source::configured(), &shipped()).await
    }
}

/// Compare `packages` with the advisories from `source`.
///
/// # Errors
/// The advisories could not be read: "could not check", never "none found".
pub async fn check(source: &Source, packages: &[Package]) -> Result<Report, CheckError> {
    let (advisories, mut detail, stale) = match source {
        Source::Online(url) => (
            fetch_online(url, packages).await?,
            json!({ "source": "osv" }),
            None,
        ),
        Source::Bundle(path) => {
            let raw = tokio::fs::read_to_string(path).await.map_err(|e| {
                CheckError(format!(
                    "could not check: network lookups are off and there is no advisory bundle at {path} ({e})"
                ))
            })?;
            let bundle: Bundle = serde_json::from_str(&raw).map_err(|e| {
                CheckError(format!("could not check: advisory bundle unreadable ({e})"))
            })?;
            let age = (Utc::now() - bundle.generated_at).num_days();
            let shipped: HashSet<&Package> = packages.iter().collect();
            let mine = bundle
                .advisories
                .into_iter()
                .filter(|a| {
                    shipped.contains(&Package {
                        ecosystem: a.ecosystem.clone(),
                        name: a.name.clone(),
                        version: a.version.clone(),
                    })
                })
                .collect();
            (
                mine,
                json!({ "source": "bundle", "bundle_generated_at": bundle.generated_at }),
                Some(age),
            )
        }
    };
    let mut findings: Vec<Found> = advisories.iter().map(to_finding).collect();
    if let Some(days) = stale.filter(|d| *d > STALE_DAYS) {
        findings.push(Found {
            asset: "Advisory bundle".to_owned(),
            key: "stale".to_owned(),
            title: format!("Advisory data is {days} days old"),
            severity: Severity::Medium,
            evidence: json!({ "age_days": days }),
            how_to_fix: "Install the current MedBrains release (it ships fresh advisories), or \
                         allow advisory lookups with MEDBRAINS_ADVISORY_FETCH=on."
                .to_owned(),
            cve_id: None,
        });
    }
    if let Some(obj) = detail.as_object_mut() {
        obj.insert("packages_checked".into(), packages.len().into());
    }
    Ok(Report::found(findings, detail))
}

/// GHSA's words where present. An informational notice (unmaintained,
/// unsound) is low; any other advisory that states no severity is high until
/// someone reads it (under-reporting is the worse error).
fn severity(word: Option<&str>, informational: Option<&str>) -> Severity {
    match (word.map(str::to_ascii_lowercase).as_deref(), informational) {
        (Some("low"), _) | (None, Some(_)) => Severity::Low,
        (Some("moderate" | "medium"), _) => Severity::Medium,
        (Some("critical"), _) => Severity::Critical,
        _ => Severity::High,
    }
}

fn to_finding(a: &Advisory) -> Found {
    let fix = a.fixed.as_deref().map_or_else(
        || format!("No fixed version yet: see https://osv.dev/vulnerability/{} for a workaround, or replace {}.", a.id, a.name),
        |v| format!("Upgrade {} to {v} or later and ship a new release.", a.name),
    );
    Found {
        asset: format!("{} {}@{}", a.ecosystem, a.name, a.version),
        key: a.id.clone(),
        title: if a.summary.is_empty() {
            a.id.clone()
        } else {
            format!("{}: {}", a.id, a.summary)
        },
        severity: severity(a.severity.as_deref(), a.informational.as_deref()),
        evidence: json!({ "advisory": a.id, "url": format!("https://osv.dev/vulnerability/{}", a.id) }),
        how_to_fix: fix,
        cve_id: a.id.starts_with("CVE-").then(|| a.id.clone()),
    }
}

async fn fetch_online(base: &str, packages: &[Package]) -> Result<Vec<Advisory>, CheckError> {
    let client = reqwest::Client::builder()
        .timeout(TIMEOUT)
        .build()
        .map_err(|e| CheckError(format!("could not check: {e}")))?;
    let mut hits: Vec<(&Package, String)> = Vec::new();
    for chunk in packages.chunks(BATCH) {
        let queries: Vec<Value> = chunk
            .iter()
            .map(|p| json!({ "package": { "name": p.name, "ecosystem": p.ecosystem }, "version": p.version }))
            .collect();
        let body: Value = client
            .post(format!("{base}/v1/querybatch"))
            .json(&json!({ "queries": queries }))
            .send()
            .await
            .and_then(reqwest::Response::error_for_status)
            .map_err(|e| CheckError(format!("could not check: advisory lookup failed ({e})")))?
            .json()
            .await
            .map_err(|e| CheckError(format!("could not check: advisory reply unreadable ({e})")))?;
        let results = body["results"]
            .as_array()
            .filter(|r| r.len() == chunk.len())
            .ok_or_else(|| {
                CheckError("could not check: advisory reply did not match the query".into())
            })?;
        for (package, result) in chunk.iter().zip(results) {
            for vuln in result["vulns"].as_array().into_iter().flatten() {
                if let Some(id) = vuln["id"].as_str() {
                    hits.push((package, id.to_owned()));
                }
            }
        }
    }
    let mut details: HashMap<String, Value> = HashMap::new();
    for (_, id) in &hits {
        if details.len() >= MAX_DETAILS || details.contains_key(id) {
            continue;
        }
        // A detail that cannot be fetched still leaves the finding, worded
        // from the id alone: losing the severity is better than losing the hit.
        let detail = match client.get(format!("{base}/v1/vulns/{id}")).send().await {
            Ok(r) if r.status().is_success() => r.json().await.unwrap_or(Value::Null),
            _ => Value::Null,
        };
        details.insert(id.clone(), detail);
    }
    Ok(hits
        .into_iter()
        .map(|(p, id)| {
            let d = details.get(&id).unwrap_or(&Value::Null);
            Advisory {
                ecosystem: p.ecosystem.clone(),
                name: p.name.clone(),
                version: p.version.clone(),
                summary: d["summary"].as_str().unwrap_or_default().to_owned(),
                severity: d["database_specific"]["severity"]
                    .as_str()
                    .map(str::to_owned),
                informational: informational(d, &p.name),
                fixed: fixed_version(d, &p.name),
                id,
            }
        })
        .collect())
}

/// `RustSec` puts its notice kind on the affected package, not the advisory.
fn informational(detail: &Value, name: &str) -> Option<String> {
    detail["affected"].as_array()?.iter().find_map(|a| {
        (a["package"]["name"].as_str() == Some(name)).then(|| {
            a["database_specific"]["informational"]
                .as_str()
                .map(str::to_owned)
        })?
    })
}

fn fixed_version(detail: &Value, name: &str) -> Option<String> {
    detail["affected"].as_array()?.iter().find_map(|a| {
        (a["package"]["name"].as_str() == Some(name)).then(|| {
            a["ranges"].as_array()?.iter().find_map(|r| {
                r["events"]
                    .as_array()?
                    .iter()
                    .find_map(|e| e["fixed"].as_str().map(str::to_owned))
            })
        })?
    })
}

#[cfg(test)]
#[allow(clippy::panic)]
mod tests {
    use super::*;

    fn pkg(e: &str, n: &str, v: &str) -> Package {
        Package {
            ecosystem: e.into(),
            name: n.into(),
            version: v.into(),
        }
    }

    #[test]
    fn the_release_embeds_its_crates() {
        let all = shipped();
        assert!(
            all.iter()
                .any(|p| p.ecosystem == "crates.io" && p.name == "tokio")
        );
    }

    #[tokio::test]
    async fn an_unreachable_advisory_service_is_could_not_check_not_zero() {
        let result = check(
            &Source::Online("http://127.0.0.1:1".into()),
            &[pkg("crates.io", "tokio", "1.0.0")],
        )
        .await;
        let Err(CheckError(msg)) = result else {
            panic!("an outage must not read as no vulnerabilities");
        };
        assert!(msg.starts_with("could not check"), "{msg}");
    }

    #[tokio::test]
    async fn a_missing_bundle_is_could_not_check() {
        let result = check(&Source::Bundle("/nonexistent/advisories.json".into()), &[]).await;
        assert!(matches!(result, Err(CheckError(m)) if m.starts_with("could not check")));
    }

    #[tokio::test]
    async fn a_bundle_reports_only_this_release_and_flags_its_age() {
        let dir = std::env::temp_dir().join(format!("secintel-{}", Uuid::new_v4()));
        let generated = Utc::now() - chrono::Duration::days(STALE_DAYS + 5);
        let bundle = json!({
            "generated_at": generated,
            "advisories": [
                { "ecosystem": "crates.io", "name": "smallvec", "version": "1.0.0", "id": "RUSTSEC-2021-0003",
                  "summary": "Buffer overflow", "severity": "CRITICAL", "fixed": "1.6.1" },
                { "ecosystem": "npm", "name": "left-pad", "version": "9.9.9", "id": "GHSA-xxxx" }
            ]
        });
        tokio::fs::write(&dir, bundle.to_string())
            .await
            .unwrap_or_default();
        let report = check(
            &Source::Bundle(dir.display().to_string()),
            &[pkg("crates.io", "smallvec", "1.0.0")],
        )
        .await
        .unwrap_or_default();
        let _ = tokio::fs::remove_file(&dir).await;
        assert_eq!(report.findings.len(), 2, "{:?}", report.findings);
        let vuln = &report.findings[0];
        assert_eq!(
            (vuln.severity, vuln.key.as_str()),
            (Severity::Critical, "RUSTSEC-2021-0003")
        );
        assert!(vuln.how_to_fix.contains("1.6.1"));
        assert_eq!(report.findings[1].key, "stale");
    }

    #[test]
    fn unstated_severity_is_high() {
        assert_eq!(severity(None, None), Severity::High);
        assert_eq!(severity(None, Some("unmaintained")), Severity::Low);
        assert_eq!(severity(Some("MODERATE"), None), Severity::Medium);
    }
}
