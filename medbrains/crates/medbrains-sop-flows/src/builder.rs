//! The track builder's service layer (RFC §11).
//!
//! Read the builder, save a draft, dry run it with what-if replay, discard it — and the check a
//! change set carrying a new track must pass when it is created, previewed
//! and applied. Every operation checks `flows.build` itself.

use std::collections::HashMap;

use medbrains_core::permissions;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::{error::AppError, middleware::auth::Claims};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

use crate::blocks::{self, BLOCKS, Block};
use crate::checks::{self, Check};
use crate::drafts::{self, Draft, Named};
use crate::engine::{begin, flow};
use crate::model::{FlowDef, Station, SwitchDef, Switches};
use crate::paths::{self, describe_combo};
use crate::registry::{self, Tx};
use crate::replay::{self, Journey, Replay};
use crate::{shape, store};

#[derive(Debug, Clone, Serialize)]
pub struct FactView {
    pub key: &'static str,
    pub label: &'static str,
    #[serde(rename = "type")]
    pub ty: blocks::FactType,
    pub operators: &'static [&'static str],
}

#[derive(Debug, Clone, Serialize)]
pub struct Catalogue {
    pub blocks: &'static [Block],
    pub facts: Vec<FactView>,
    pub departments: Vec<Named>,
    pub roles: Vec<Named>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DraftView {
    #[serde(flatten)]
    pub draft: Draft,
    /// Another change was published after this draft started from it.
    pub stale: bool,
}

/// `GET /api/flows/{code}/build`: everything the Build tab draws.
#[derive(Debug, Clone, Serialize)]
pub struct BuilderView {
    pub code: String,
    pub name: String,
    pub template_id: Uuid,
    pub version: i32,
    pub published: Vec<Station>,
    pub library: Vec<Station>,
    pub switches: Value,
    pub switch_defs: Vec<SwitchDef>,
    pub draft: Option<DraftView>,
    /// The checks on the draft, or on the published track when there is none.
    pub checks: Vec<Check>,
    pub catalogue: Catalogue,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SaveDraft {
    /// The revision the screen last saw; 0 starts a new draft.
    pub revision: i32,
    pub stations: Vec<Station>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DryRunRequest {
    pub revision: i32,
}

/// One sample patient's route on the draft.
#[derive(Debug, Clone, Serialize)]
pub struct Sample {
    pub label: String,
    pub facts: Value,
    pub route: Vec<String>,
    pub skipped: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TestDrive {
    pub revision: i32,
    pub samples: Vec<Sample>,
    pub replay: Replay,
}

fn facts() -> Vec<FactView> {
    blocks::FACTS
        .iter()
        .map(|f| FactView {
            key: f.key,
            label: f.label,
            ty: f.ty,
            operators: f.ty.operators(),
        })
        .collect()
}

async fn view(tx: &mut Tx<'_>, tenant: Uuid, flow: &FlowDef) -> Result<BuilderView, AppError> {
    let t = store::ensure_published(tx, tenant, flow).await?;
    let published = store::stations(&t)?;
    let draft = drafts::open(tx, tenant, &flow.code).await?;
    let roles = drafts::roles(tx, tenant).await?;
    let checks = match &draft {
        Some(d) => checks::run(
            flow,
            &d.track()?,
            Some(&roles),
            d.dry_run_revision == Some(d.revision),
        ),
        None => checks::run(flow, &published, Some(&roles), false),
    };
    Ok(BuilderView {
        code: flow.code.clone(),
        name: flow.name.clone(),
        template_id: t.id,
        version: t.version,
        published,
        library: flow.stations.clone(),
        switches: t.switches.clone(),
        switch_defs: flow.switches.clone(),
        draft: draft.map(|d| DraftView {
            stale: d.base_template_id != Some(t.id),
            draft: d,
        }),
        checks,
        catalogue: Catalogue {
            blocks: BLOCKS,
            facts: facts(),
            departments: drafts::departments(tx, tenant).await?,
            roles: drafts::role_names(tx, tenant).await?,
        },
    })
}

/// # Errors
/// Forbidden without `flows.build`; not found for an unknown flow.
pub async fn get(pool: &PgPool, claims: &Claims, code: &str) -> Result<BuilderView, AppError> {
    let flow = flow(code)?;
    require_permission(claims, permissions::flows::BUILD)?;
    let mut tx = begin(pool, claims).await?;
    let v = view(&mut tx, claims.tenant_id, &flow).await?;
    tx.commit().await?;
    Ok(v)
}

/// Save the draft (creating it on the first save). Drafts never touch a
/// patient; the checks are recomputed and returned with it.
///
/// # Errors
/// Forbidden without `flows.build`; bad request for a malformed track;
/// conflict when the screen has not seen the latest revision.
pub async fn save(
    pool: &PgPool,
    claims: &Claims,
    code: &str,
    body: SaveDraft,
) -> Result<BuilderView, AppError> {
    let flow = flow(code)?;
    require_permission(claims, permissions::flows::BUILD)?;
    let track = shape::normalize(&flow, body.stations).map_err(AppError::BadRequest)?;
    let mut tx = begin(pool, claims).await?;
    let t = store::ensure_published(&mut tx, claims.tenant_id, &flow).await?;
    // A new draft starts from what is published now; a saved one keeps its base.
    let base = match drafts::open(&mut tx, claims.tenant_id, code).await? {
        Some(d) if body.revision != 0 => d.base_template_id.unwrap_or(t.id),
        _ => t.id,
    };
    drafts::save(
        &mut tx,
        &drafts::Save {
            tenant: claims.tenant_id,
            code,
            base,
            revision: body.revision,
            stations: serde_json::to_value(&track)
                .map_err(|e| AppError::Internal(e.to_string()))?,
            user: claims.sub,
        },
    )
    .await?;
    let v = view(&mut tx, claims.tenant_id, &flow).await?;
    tx.commit().await?;
    Ok(v)
}

/// Discard the open draft; the published track is untouched.
///
/// # Errors
/// Forbidden without `flows.build`.
pub async fn discard(pool: &PgPool, claims: &Claims, code: &str) -> Result<BuilderView, AppError> {
    let flow = flow(code)?;
    require_permission(claims, permissions::flows::BUILD)?;
    let mut tx = begin(pool, claims).await?;
    if let Some(d) = drafts::open(&mut tx, claims.tenant_id, code).await? {
        drafts::close(&mut tx, claims.tenant_id, d.id, None).await?;
    }
    let v = view(&mut tx, claims.tenant_id, &flow).await?;
    tx.commit().await?;
    Ok(v)
}

fn samples(
    flow: &FlowDef,
    track: &[Station],
    switches: &Switches,
) -> Result<Vec<Sample>, AppError> {
    let all = paths::paths(flow, track, Some(switches)).ok_or_else(|| {
        AppError::BadRequest(
            "The branches combine into too many cases to test; simplify them".to_owned(),
        )
    })?;
    Ok(all
        .into_iter()
        .map(|p| Sample {
            label: describe_combo(&p.combo),
            facts: Value::Object(p.combo.facts),
            route: p
                .route
                .iter()
                .filter_map(|&i| track.get(i))
                .map(|s| s.key.clone())
                .collect(),
            skipped: track
                .iter()
                .enumerate()
                .filter(|(i, _)| !p.route.contains(i))
                .map(|(_, s)| s.key.clone())
                .collect(),
        })
        .collect())
}

#[derive(sqlx::FromRow)]
struct Done {
    id: Uuid,
    subject_id: Uuid,
    minutes: i64,
    state: Value,
}

#[derive(sqlx::FromRow)]
struct Cleared {
    instance_id: Uuid,
    step_name: String,
    minutes: i64,
}

/// The last 30 days of finished journeys on this flow, with their facts
/// (as recorded, filled from the admission where not) and station times.
/// Three queries, however many journeys.
async fn history(tx: &mut Tx<'_>, tenant: Uuid, code: &str) -> Result<Vec<Journey>, AppError> {
    let done = sqlx::query_as::<_, Done>(
        "SELECT id, subject_id, \
                (EXTRACT(EPOCH FROM completed_at - started_at) / 60)::bigint AS minutes, state \
           FROM workflow_instances WHERE tenant_id = $1 AND flow_code = $2 AND status = 'completed' \
            AND subject_id IS NOT NULL AND completed_at >= now() - interval '30 days' \
            AND deleted_at IS NULL ORDER BY completed_at DESC LIMIT $3",
    )
    .bind(tenant)
    .bind(code)
    .bind(replay::MAX_JOURNEYS)
    .fetch_all(&mut **tx)
    .await?;
    let ids: Vec<Uuid> = done.iter().map(|d| d.id).collect();
    let subjects: Vec<Uuid> = done.iter().map(|d| d.subject_id).collect();
    let mut logs: HashMap<Uuid, Vec<Cleared>> = HashMap::new();
    for c in sqlx::query_as::<_, Cleared>(
        "SELECT instance_id, step_name, \
                COALESCE((EXTRACT(EPOCH FROM completed_at - started_at) / 60)::bigint, 0) AS minutes \
           FROM workflow_step_logs WHERE tenant_id = $1 AND instance_id = ANY($2) \
            AND action = 'cleared' AND deleted_at IS NULL ORDER BY started_at, step_index",
    )
    .bind(tenant)
    .bind(&ids)
    .fetch_all(&mut **tx)
    .await?
    {
        logs.entry(c.instance_id).or_default().push(c);
    }
    let mut now = registry::facts_bulk(tx, tenant, &subjects).await?;
    Ok(done
        .into_iter()
        .map(|d| {
            let mut facts = now.remove(&d.subject_id).unwrap_or_default();
            if let Some(recorded) = d.state.get("facts").and_then(Value::as_object) {
                facts.extend(recorded.clone());
            }
            let rows = logs.remove(&d.id).unwrap_or_default();
            Journey {
                facts,
                cleared: rows.iter().map(|r| r.step_name.clone()).collect(),
                minutes: rows.into_iter().map(|r| (r.step_name, r.minutes)).collect(),
                total_minutes: d.minutes,
            }
        })
        .collect())
}

/// Dry run this revision of the draft: one sample patient per route, and
/// the last 30 days replayed through it. Records that the server ran it.
///
/// # Errors
/// Forbidden without `flows.build`; conflict when the draft moved on.
pub async fn dry_run(
    pool: &PgPool,
    claims: &Claims,
    code: &str,
    body: &DryRunRequest,
) -> Result<TestDrive, AppError> {
    let flow = flow(code)?;
    require_permission(claims, permissions::flows::BUILD)?;
    let mut tx = begin(pool, claims).await?;
    let t = store::ensure_published(&mut tx, claims.tenant_id, &flow).await?;
    let d = drafts::open(&mut tx, claims.tenant_id, code)
        .await?
        .filter(|d| d.revision == body.revision)
        .ok_or_else(|| AppError::Conflict("Save the draft first; it has changed".to_owned()))?;
    let track = d.track()?;
    let switches = store::switches(&t);
    let drive = TestDrive {
        revision: d.revision,
        samples: samples(&flow, &track, &switches)?,
        replay: replay::replay(
            &history(&mut tx, claims.tenant_id, code).await?,
            &track,
            &switches,
        ),
    };
    drafts::mark_dry_run(&mut tx, claims.tenant_id, d.id, d.revision).await?;
    tx.commit().await?;
    Ok(drive)
}

/// The authoritative check on a change set's track (§11.2).
///
/// Run when the set is created, previewed and applied — whatever the
/// screen showed. A track equal to the published one is a switch change and passes. A new
/// track must be a draft's exact, dry-run revision built on what is
/// published now; a rollback to a track published before needs no new dry
/// run. Either way every check runs against the hospital's roles today.
///
/// # Errors
/// Database faults; the outer `Err(String)` is the refusal in words.
pub async fn check_proposal(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    code: &str,
    track: &[Station],
    draft: Option<(Uuid, i32)>,
) -> Result<Result<(), String>, AppError> {
    let flow = flow(code)?;
    let t = store::ensure_published(tx, tenant, &flow).await?;
    if store::stations(&t)? == track {
        return Ok(Ok(()));
    }
    let dry_run = match draft {
        Some((id, revision)) => {
            let Some(d) = drafts::by_id(tx, tenant, id).await? else {
                return Ok(Err(
                    "The draft this change came from no longer exists".to_owned()
                ));
            };
            if d.flow_code != code
                || d.status != "draft"
                || d.revision != revision
                || d.track()? != track
            {
                return Ok(Err(
                    "The draft changed after it was proposed; propose it again".to_owned(),
                ));
            }
            if d.base_template_id != Some(t.id) {
                return Ok(Err(
                    "Another change was published after this draft was started; rebuild it on the current track".to_owned(),
                ));
            }
            d.dry_run_revision == Some(d.revision)
        }
        None => drafts::was_published(tx, tenant, code, track).await?,
    };
    if draft.is_none() && !dry_run {
        return Ok(Err(
            "A new track must come from a draft that has been dry-run".to_owned(),
        ));
    }
    let roles = drafts::roles(tx, tenant).await?;
    let results = checks::run(&flow, track, Some(&roles), dry_run);
    if checks::all_pass(&results) {
        return Ok(Ok(()));
    }
    let problems: Vec<String> = results
        .iter()
        .filter(|c| !c.pass)
        .flat_map(|c| c.problems.iter().cloned())
        .collect();
    Ok(Err(format!(
        "The track fails its checks: {}",
        problems.join("; ")
    )))
}
