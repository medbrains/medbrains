//! Event lifecycle — the core of the orchestration engine.
//!
//! Two public entry points:
//!
//! - [`emit_before_event`] — **blocking gate**. Runs matching pipelines
//!   synchronously. If ANY pipeline returns `{ "gate": "blocked" }`, the
//!   caller MUST abort its operation.
//!
//! - [`emit_after_event`] — **non-blocking**. Enqueues a job to `job_queue`
//!   for async execution. Never fails the caller.

use medbrains_core::orchestration::EventGateResult;
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;

/// Pipeline match for lifecycle execution — mirrors `events.rs` pattern.
#[derive(Debug, sqlx::FromRow)]
struct PipelineMatch {
    id: Uuid,
    version: i32,
    nodes: Value,
    edges: Value,
}

/// BEFORE events — blocking gate.
///
/// 1. Verify the event exists in `event_registry` with `phase = 'before'`
/// 2. Find active pipelines subscribed to this event
/// 3. Execute each pipeline synchronously (reusing `events::emit_event` patterns)
/// 4. If any pipeline node output contains `{ "gate": "blocked", "reason": "..." }`,
///    return `allowed = false`
/// 5. Collect any enrichments from pipeline outputs
pub async fn emit_before_event(
    pool: &PgPool,
    tenant_id: Uuid,
    user_id: Uuid,
    event_code: &str,
    payload: &Value,
) -> Result<EventGateResult, AppError> {
    // 1. Verify event exists and is a before-phase event
    let event_exists: bool = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM event_registry \
         WHERE event_code = $1 AND phase = 'before')",
    )
    .bind(event_code)
    .fetch_one(pool)
    .await?;

    if !event_exists {
        tracing::debug!(event_code, "before-event not registered — allowing");
        return Ok(EventGateResult {
            allowed: true,
            reason: None,
            enrichments: None,
        });
    }

    // 2. Find matching active pipelines
    let trigger_match = serde_json::json!({ "event_type": event_code });
    let pipelines = sqlx::query_as::<_, PipelineMatch>(
        "SELECT id, version, nodes, edges \
         FROM integration_pipelines \
         WHERE tenant_id = $1 \
           AND status = 'active' \
           AND trigger_type = 'internal_event' \
           AND trigger_config @> $2",
    )
    .bind(tenant_id)
    .bind(&trigger_match)
    .fetch_all(pool)
    .await?;

    if pipelines.is_empty() {
        return Ok(EventGateResult {
            allowed: true,
            reason: None,
            enrichments: None,
        });
    }

    // 3. Execute each pipeline synchronously, checking for gate blocks
    let mut enrichments = serde_json::Map::new();

    for pipeline in &pipelines {
        let result =
            execute_gate_pipeline(pool, tenant_id, user_id, pipeline, event_code, payload).await;

        match result {
            Ok(output) => {
                // Check if any node blocked the gate
                if let Some(block_reason) = find_gate_block(&output) {
                    tracing::info!(
                        pipeline_id = %pipeline.id,
                        event_code,
                        reason = %block_reason,
                        "before-event gate BLOCKED"
                    );
                    return Ok(EventGateResult {
                        allowed: false,
                        reason: Some(block_reason),
                        enrichments: None,
                    });
                }

                // Collect enrichments from pipeline output
                if let Some(enrich) = extract_enrichments(&output) {
                    for (k, v) in enrich {
                        enrichments.insert(k, v);
                    }
                }
            }
            Err(e) => {
                tracing::warn!(
                    pipeline_id = %pipeline.id,
                    event_code,
                    error = %e,
                    "before-event pipeline failed — treating as allowed"
                );
            }
        }
    }

    let enrichment_value = if enrichments.is_empty() {
        None
    } else {
        Some(Value::Object(enrichments))
    };

    Ok(EventGateResult {
        allowed: true,
        reason: None,
        enrichments: enrichment_value,
    })
}

/// AFTER events — non-blocking.
///
/// Inserts a job into `job_queue` with `job_type = 'pipeline_event'` for
/// async pickup by the background worker. Never fails the caller.
pub async fn emit_after_event(
    pool: &PgPool,
    tenant_id: Uuid,
    user_id: Uuid,
    event_code: &str,
    payload: Value,
) -> Result<(), AppError> {
    let job_payload = serde_json::json!({
        "event_code": event_code,
        "user_id": user_id.to_string(),
        "payload": payload,
    });

    let result = sqlx::query(
        "INSERT INTO job_queue \
           (tenant_id, job_type, payload, priority) \
         VALUES ($1, 'pipeline_event', $2, 5)",
    )
    .bind(tenant_id)
    .bind(&job_payload)
    .execute(pool)
    .await;

    if let Err(e) = result {
        // Log but never fail the caller
        tracing::error!(
            event_code,
            tenant_id = %tenant_id,
            error = %e,
            "failed to enqueue after-event job"
        );
    }

    Ok(())
}

/// Execute a single pipeline in gate mode — returns node results.
///
/// Uses its own transaction with tenant context, mirroring `events.rs`.
async fn execute_gate_pipeline(
    pool: &PgPool,
    tenant_id: Uuid,
    user_id: Uuid,
    pipeline: &PipelineMatch,
    event_code: &str,
    payload: &Value,
) -> Result<Value, AppError> {
    let mut tx = pool.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;

    // Create execution record
    let exec_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO integration_executions \
           (id, tenant_id, pipeline_id, pipeline_version, trigger_event, \
            status, input_data, triggered_by, started_at) \
         VALUES ($1, $2, $3, $4, $5, 'running', $6, $7, now())",
    )
    .bind(exec_id)
    .bind(tenant_id)
    .bind(pipeline.id)
    .bind(pipeline.version)
    .bind(event_code)
    .bind(payload)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    // Walk pipeline nodes
    let result = walk_gate_nodes(pipeline, payload);

    // Record completion
    match &result {
        Ok(output) => {
            sqlx::query(
                "UPDATE integration_executions \
                 SET status = 'completed', node_results = $2, \
                     output_data = $2, completed_at = now() \
                 WHERE id = $1",
            )
            .bind(exec_id)
            .bind(output)
            .execute(&mut *tx)
            .await?;
        }
        Err(e) => {
            let err_msg = format!("{e}");
            sqlx::query(
                "UPDATE integration_executions \
                 SET status = 'failed', error = $2, completed_at = now() \
                 WHERE id = $1",
            )
            .bind(exec_id)
            .bind(&err_msg)
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;
    result
}

/// Walk pipeline nodes for gate evaluation.
///
/// Simplified BFS from trigger node through edges, evaluating condition
/// nodes inline. Returns the aggregated node results as JSON.
fn walk_gate_nodes(pipeline: &PipelineMatch, input: &Value) -> Result<Value, AppError> {
    let nodes = pipeline
        .nodes
        .as_array()
        .ok_or_else(|| AppError::Internal("pipeline nodes is not an array".into()))?;
    let edges = pipeline
        .edges
        .as_array()
        .ok_or_else(|| AppError::Internal("pipeline edges is not an array".into()))?;

    let mut node_results = serde_json::Map::new();

    // Find trigger node
    let trigger_node = nodes
        .iter()
        .find(|n| {
            n.get("type")
                .and_then(Value::as_str)
                .is_some_and(|t| t.starts_with("trigger"))
        })
        .ok_or_else(|| AppError::Internal("no trigger node in pipeline".into()))?;

    let trigger_id = trigger_node.get("id").and_then(Value::as_str).unwrap_or("");

    node_results.insert(
        trigger_id.to_owned(),
        serde_json::json!({ "status": "completed", "output": input }),
    );

    // BFS traversal
    let mut queue = vec![trigger_id.to_owned()];
    let mut current_data = input.clone();

    while let Some(current_id) = queue.first().cloned() {
        queue.remove(0);

        let outgoing: Vec<&Value> = edges
            .iter()
            .filter(|e| {
                e.get("source")
                    .and_then(Value::as_str)
                    .is_some_and(|s| s == current_id)
            })
            .collect();

        for edge in outgoing {
            let target_id = edge.get("target").and_then(Value::as_str).unwrap_or("");

            let target_node = nodes.iter().find(|n| {
                n.get("id")
                    .and_then(Value::as_str)
                    .is_some_and(|id| id == target_id)
            });

            let Some(target_node) = target_node else {
                continue;
            };

            let node_type = target_node
                .get("type")
                .and_then(Value::as_str)
                .unwrap_or("");
            let node_data = target_node
                .get("data")
                .cloned()
                .unwrap_or_else(|| Value::Object(serde_json::Map::new()));

            let output = evaluate_gate_node(node_type, &node_data, &current_data);

            node_results.insert(
                target_id.to_owned(),
                serde_json::json!({ "status": "completed", "output": &output }),
            );

            if node_type.starts_with("condition") {
                let branch = output
                    .get("branch")
                    .and_then(Value::as_str)
                    .unwrap_or("true");
                for be in edges.iter().filter(|e| {
                    e.get("source")
                        .and_then(Value::as_str)
                        .is_some_and(|s| s == target_id)
                        && e.get("sourceHandle")
                            .and_then(Value::as_str)
                            .is_some_and(|h| h == branch)
                }) {
                    if let Some(next) = be.get("target").and_then(Value::as_str) {
                        queue.push(next.to_owned());
                    }
                }
            } else {
                current_data = output;
                queue.push(target_id.to_owned());
            }
        }
    }

    Ok(Value::Object(node_results))
}

/// Evaluate a single node in gate mode (no side effects — pure logic only).
fn evaluate_gate_node(node_type: &str, node_data: &Value, input: &Value) -> Value {
    let config = node_data
        .get("config")
        .cloned()
        .unwrap_or_else(|| Value::Object(serde_json::Map::new()));

    match node_type {
        "condition.if_else" | "condition_if_else" => evaluate_condition(&config, input),
        "action.gate_check" | "action_gate_check" => {
            // Gate check node — can block the event
            let gate = config
                .get("gate")
                .and_then(Value::as_str)
                .unwrap_or("allowed");
            let reason = config
                .get("reason")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_owned();
            serde_json::json!({
                "gate": gate,
                "reason": reason,
                "data": input,
            })
        }
        "transform.enrich" | "transform_enrich" => {
            // Enrichment node — adds data to pass back to caller
            let enrichments = config
                .get("enrichments")
                .cloned()
                .unwrap_or_else(|| Value::Object(serde_json::Map::new()));
            serde_json::json!({
                "enrichments": enrichments,
                "data": input,
            })
        }
        // Pass through for unknown node types
        _ => input.clone(),
    }
}

/// Evaluate a condition node — same logic as `events.rs`.
fn evaluate_condition(config: &Value, input: &Value) -> Value {
    let field = config.get("field").and_then(Value::as_str).unwrap_or("");
    let operator = config
        .get("operator")
        .and_then(Value::as_str)
        .unwrap_or("eq");
    let compare_value = config.get("value").and_then(Value::as_str).unwrap_or("");

    let actual = input.get(field).and_then(Value::as_str).unwrap_or("");

    let matched = match operator {
        "neq" => actual != compare_value,
        "contains" => actual.contains(compare_value),
        "is_empty" => actual.is_empty(),
        "is_not_empty" => !actual.is_empty(),
        _ => actual == compare_value,
    };

    serde_json::json!({
        "branch": if matched { "true" } else { "false" },
        "matched": matched,
        "data": input,
    })
}

/// Search node results for a gate block signal.
fn find_gate_block(node_results: &Value) -> Option<String> {
    let map = node_results.as_object()?;
    for (_node_id, result) in map {
        let output = result.get("output")?;
        let gate = output.get("gate").and_then(Value::as_str)?;
        if gate == "blocked" {
            let reason = output
                .get("reason")
                .and_then(Value::as_str)
                .unwrap_or("blocked by pipeline")
                .to_owned();
            return Some(reason);
        }
    }
    None
}

/// Extract enrichment data from node results.
fn extract_enrichments(node_results: &Value) -> Option<serde_json::Map<String, Value>> {
    let map = node_results.as_object()?;
    let mut merged = serde_json::Map::new();

    for (_node_id, result) in map {
        if let Some(output) = result.get("output") {
            if let Some(enrichments) = output.get("enrichments").and_then(Value::as_object) {
                for (k, v) in enrichments {
                    merged.insert(k.clone(), v.clone());
                }
            }
        }
    }

    if merged.is_empty() {
        None
    } else {
        Some(merged)
    }
}
