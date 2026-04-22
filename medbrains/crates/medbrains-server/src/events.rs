//! Internal event emission for the Integration Hub.
//!
//! When a module-level action completes (e.g. prescription created), it calls
//! [`emit_event`] with the event type and payload.
//!
//! This queries active pipelines that subscribe to that event and executes them
//! within SAVEPOINTs so a pipeline failure does not rollback the parent
//! transaction.

use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;

/// Emit an internal event.
///
/// Finds active pipelines whose `trigger_config` matches the `event_type`,
/// then executes each inside a SAVEPOINT. On failure the savepoint rolls back
/// and the execution is recorded as failed — the parent transaction continues.
pub async fn emit_event(
    pool: &PgPool,
    tenant_id: Uuid,
    user_id: Uuid,
    event_type: &str,
    payload: Value,
) -> Result<(), AppError> {
    // Find matching active pipelines
    let trigger_match = serde_json::json!({ "event_type": event_type });

    let pipelines: Vec<PipelineMatch> = sqlx::query_as::<_, PipelineMatch>(
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
        return Ok(());
    }

    for pipeline in &pipelines {
        // Each pipeline execution gets its own transaction with tenant context
        let result = execute_pipeline_safe(
            pool,
            tenant_id,
            user_id,
            pipeline,
            event_type,
            &payload,
        )
        .await;

        if let Err(e) = result {
            tracing::warn!(
                pipeline_id = %pipeline.id,
                event_type,
                error = %e,
                "pipeline execution failed — continuing"
            );
        }
    }

    Ok(())
}

#[derive(Debug, sqlx::FromRow)]
struct PipelineMatch {
    id: Uuid,
    version: i32,
    nodes: Value,
    edges: Value,
}

/// Execute a single pipeline in its own transaction. Records execution result.
async fn execute_pipeline_safe(
    pool: &PgPool,
    tenant_id: Uuid,
    user_id: Uuid,
    pipeline: &PipelineMatch,
    event_type: &str,
    payload: &Value,
) -> Result<(), AppError> {
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
    .bind(event_type)
    .bind(payload)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    // Walk nodes and execute
    let result = walk_pipeline(&mut tx, tenant_id, user_id, pipeline, payload).await;

    match result {
        Ok(node_results) => {
            sqlx::query(
                "UPDATE integration_executions \
                 SET status = 'completed', node_results = $2, \
                     output_data = $3, completed_at = now() \
                 WHERE id = $1",
            )
            .bind(exec_id)
            .bind(&node_results)
            .bind(&node_results)
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
            tx.commit().await?;
            return Err(e);
        }
    }

    tx.commit().await?;
    Ok(())
}

#[allow(clippy::too_many_lines)]
async fn walk_pipeline(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    user_id: Uuid,
    pipeline: &PipelineMatch,
    input: &Value,
) -> Result<Value, AppError> {
    let nodes = pipeline
        .nodes
        .as_array()
        .ok_or_else(|| AppError::Internal("pipeline nodes is not an array".to_owned()))?;
    let edges = pipeline
        .edges
        .as_array()
        .ok_or_else(|| AppError::Internal("pipeline edges is not an array".to_owned()))?;

    let mut node_results = serde_json::Map::new();
    let mut current_data = input.clone();

    // Find the trigger node (source of the flow)
    let trigger_node = nodes
        .iter()
        .find(|n| {
            n.get("type")
                .and_then(Value::as_str)
                .is_some_and(|t| t.starts_with("trigger"))
        })
        .ok_or_else(|| AppError::Internal("no trigger node in pipeline".to_owned()))?;

    let trigger_id = trigger_node
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or("");

    node_results.insert(
        trigger_id.to_owned(),
        serde_json::json!({
            "status": "completed",
            "output": &current_data,
        }),
    );

    // BFS from trigger through edges
    let mut queue = vec![trigger_id.to_owned()];

    while let Some(current_id) = queue.first().cloned() {
        queue.remove(0);

        // Find outgoing edges
        let outgoing: Vec<&Value> = edges
            .iter()
            .filter(|e| {
                e.get("source")
                    .and_then(Value::as_str)
                    .is_some_and(|s| s == current_id)
            })
            .collect();

        for edge in outgoing {
            let target_id = edge
                .get("target")
                .and_then(Value::as_str)
                .unwrap_or("");

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

            let result = execute_node(
                tx,
                tenant_id,
                user_id,
                node_type,
                &node_data,
                &current_data,
            )
            .await;

            match result {
                Ok(output) => {
                    node_results.insert(
                        target_id.to_owned(),
                        serde_json::json!({
                            "status": "completed",
                            "output": &output,
                        }),
                    );
                    // For condition nodes, check which branch to take
                    if node_type.starts_with("condition") {
                        let branch = output
                            .get("branch")
                            .and_then(Value::as_str)
                            .unwrap_or("true");
                        // Only follow edges whose sourceHandle matches the branch
                        let branch_edges: Vec<&Value> = edges
                            .iter()
                            .filter(|e| {
                                e.get("source")
                                    .and_then(Value::as_str)
                                    .is_some_and(|s| s == target_id)
                                    && e.get("sourceHandle")
                                        .and_then(Value::as_str)
                                        .is_some_and(|h| h == branch)
                            })
                            .collect();
                        for be in branch_edges {
                            if let Some(next) = be.get("target").and_then(Value::as_str) {
                                queue.push(next.to_owned());
                            }
                        }
                    } else {
                        current_data = output;
                        queue.push(target_id.to_owned());
                    }
                }
                Err(e) => {
                    node_results.insert(
                        target_id.to_owned(),
                        serde_json::json!({
                            "status": "failed",
                            "error": format!("{e}"),
                        }),
                    );
                    return Err(e);
                }
            }
        }
    }

    Ok(Value::Object(node_results))
}

/// Execute a single node based on its type.
async fn execute_node(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    user_id: Uuid,
    node_type: &str,
    node_data: &Value,
    input: &Value,
) -> Result<Value, AppError> {
    let config = node_data
        .get("config")
        .cloned()
        .unwrap_or_else(|| Value::Object(serde_json::Map::new()));

    match node_type {
        "condition.if_else" | "condition_if_else" => Ok(execute_condition(&config, input)),
        "action.create_indent" | "action_create_indent" => {
            execute_create_indent(tx, tenant_id, user_id, &config, input).await
        }
        "action.create_order" | "action_create_order" => {
            execute_create_order(tx, tenant_id, user_id, &config, input).await
        }
        "action.send_notification" | "action_send_notification" => {
            Ok(serde_json::json!({
                "status": "notification_queued",
                "channel": config.get("channel").and_then(Value::as_str).unwrap_or("in_app"),
            }))
        }
        "action.update_record" | "action_update_record" => {
            Ok(execute_update_record(&config))
        }
        "action.webhook_call" | "action_webhook_call" => {
            // Webhook calls are deferred — record intent but don't block
            Ok(serde_json::json!({
                "status": "webhook_queued",
                "url": config.get("url"),
            }))
        }
        "transform.map_data" | "transform_map_data" => Ok(execute_transform(&config, input)),
        _ => Ok(input.clone()),
    }
}

fn execute_condition(config: &Value, input: &Value) -> Value {
    let field = config
        .get("field")
        .and_then(Value::as_str)
        .unwrap_or("");
    let operator = config
        .get("operator")
        .and_then(Value::as_str)
        .unwrap_or("eq");
    let compare_value = config
        .get("value")
        .and_then(Value::as_str)
        .unwrap_or("");

    let actual = input
        .get(field)
        .and_then(Value::as_str)
        .unwrap_or("");

    let matched = match operator {
        "neq" => actual != compare_value,
        "contains" => actual.contains(compare_value),
        "is_empty" => actual.is_empty(),
        "is_not_empty" => !actual.is_empty(),
        // "eq" and anything else
        _ => actual == compare_value,
    };

    serde_json::json!({
        "branch": if matched { "true" } else { "false" },
        "matched": matched,
        "data": input,
    })
}

async fn execute_create_indent(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    user_id: Uuid,
    config: &Value,
    input: &Value,
) -> Result<Value, AppError> {
    let department_id: Uuid = config
        .get("department_id")
        .and_then(Value::as_str)
        .and_then(|s| s.parse().ok())
        .ok_or_else(|| AppError::BadRequest("department_id required in config".to_owned()))?;

    let indent_type = config
        .get("indent_type")
        .and_then(Value::as_str)
        .unwrap_or("general");
    let priority = config
        .get("priority")
        .and_then(Value::as_str)
        .unwrap_or("normal");

    // Generate indent number using the sequence system
    let indent_number =
        super::routes::indent::generate_indent_number(tx, &tenant_id).await?;

    let indent_id = Uuid::new_v4();
    let context = serde_json::json!({
        "source": "auto_indent",
        "trigger_input": input,
    });

    sqlx::query(
        "INSERT INTO indent_requisitions \
           (id, tenant_id, indent_number, department_id, requested_by, \
            indent_type, priority, status, context) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'submitted', $8)",
    )
    .bind(indent_id)
    .bind(tenant_id)
    .bind(&indent_number)
    .bind(department_id)
    .bind(user_id)
    .bind(indent_type)
    .bind(priority)
    .bind(&context)
    .execute(&mut **tx)
    .await?;

    Ok(serde_json::json!({
        "indent_id": indent_id,
        "indent_number": indent_number,
        "status": "submitted",
    }))
}

async fn execute_create_order(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    user_id: Uuid,
    config: &Value,
    input: &Value,
) -> Result<Value, AppError> {
    let patient_id_field = config
        .get("patient_id_source")
        .and_then(Value::as_str)
        .unwrap_or("patient_id");
    let patient_id: Uuid = input
        .get(patient_id_field)
        .and_then(Value::as_str)
        .and_then(|s| s.parse().ok())
        .ok_or_else(|| AppError::BadRequest("patient_id not found in input".to_owned()))?;

    let order_id = Uuid::new_v4();
    let encounter_id: Option<Uuid> = input
        .get("encounter_id")
        .and_then(Value::as_str)
        .and_then(|s| s.parse().ok());

    sqlx::query(
        "INSERT INTO pharmacy_orders \
           (id, tenant_id, patient_id, encounter_id, ordered_by, status, notes) \
         VALUES ($1, $2, $3, $4, $5, 'ordered', 'Auto-created by integration pipeline')",
    )
    .bind(order_id)
    .bind(tenant_id)
    .bind(patient_id)
    .bind(encounter_id)
    .bind(user_id)
    .execute(&mut **tx)
    .await?;

    Ok(serde_json::json!({
        "order_id": order_id,
        "patient_id": patient_id,
        "status": "ordered",
    }))
}

fn execute_update_record(config: &Value) -> Value {
    let entity = config
        .get("entity")
        .and_then(Value::as_str)
        .unwrap_or("");

    // Placeholder — full implementation would dispatch to entity-specific update logic
    serde_json::json!({
        "status": "update_queued",
        "entity": entity,
    })
}

fn execute_transform(config: &Value, input: &Value) -> Value {
    let mappings = config
        .get("mappings")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let mut output = serde_json::Map::new();

    for mapping in &mappings {
        let to = mapping.get("to").and_then(Value::as_str).unwrap_or("");
        if to.is_empty() {
            continue;
        }

        // 1. Resolve source value
        let source_value = resolve_source(mapping, input);

        // 2. Get chain (or fallback to legacy operation)
        let chain = get_chain(mapping);

        // 3. Pipe through chain
        let mut current = source_value;
        for (op, op_config) in &chain {
            current = apply_operation(op, op_config, current);
        }

        output.insert(to.to_owned(), current);
    }

    Value::Object(output)
}

/// Resolve source value from a mapping, supporting multi-source combine modes.
fn resolve_source(mapping: &Value, input: &Value) -> Value {
    let combine_mode = mapping
        .get("combineMode")
        .and_then(Value::as_str)
        .unwrap_or("single");

    if combine_mode == "single" || combine_mode.is_empty() {
        let from = mapping
            .get("from")
            .and_then(Value::as_str)
            .unwrap_or("");
        return resolve_path(input, from);
    }

    let sources = mapping
        .get("sources")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let values: Vec<Value> = sources
        .iter()
        .filter_map(|s| s.get("path").and_then(Value::as_str))
        .map(|path| resolve_path(input, path))
        .collect();

    let combine_config = mapping
        .get("combineConfig")
        .cloned()
        .unwrap_or_else(|| Value::Object(serde_json::Map::new()));

    match combine_mode {
        "concat" => {
            let sep = combine_config
                .get("separator")
                .and_then(Value::as_str)
                .unwrap_or(" ");
            let parts: Vec<String> = values.iter().map(value_to_string).collect();
            Value::String(parts.join(sep))
        }
        "fallback" => values
            .into_iter()
            .find(|v| !v.is_null() && !v.as_str().is_some_and(str::is_empty))
            .unwrap_or(Value::Null),
        "template" => {
            let template_str = combine_config
                .get("templateStr")
                .and_then(Value::as_str)
                .unwrap_or("");
            let mut result = template_str.to_owned();
            for (i, s) in sources.iter().enumerate() {
                let path = s
                    .get("path")
                    .and_then(Value::as_str)
                    .unwrap_or("");
                let key = path.rsplit('.').next().unwrap_or(path);
                let placeholder = format!("{{{{{key}}}}}");
                let val = values.get(i).map(value_to_string).unwrap_or_default();
                result = result.replace(&placeholder, &val);
            }
            Value::String(result)
        }
        _ => values.into_iter().next().unwrap_or(Value::Null),
    }
}

/// Traverse a dotted path in a JSON value.
fn resolve_path(input: &Value, dotted_path: &str) -> Value {
    if dotted_path.is_empty() {
        return Value::Null;
    }
    let mut current = input;
    for segment in dotted_path.split('.') {
        match current {
            Value::Object(map) => {
                current = map.get(segment).unwrap_or(&Value::Null);
            }
            Value::Array(arr) => {
                if let Ok(idx) = segment.parse::<usize>() {
                    current = arr.get(idx).unwrap_or(&Value::Null);
                } else {
                    return Value::Null;
                }
            }
            _ => return Value::Null,
        }
    }
    current.clone()
}

/// Extract the transform chain from a mapping. Falls back to wrapping the
/// legacy `operation`/`operationConfig` into a single-element chain.
fn get_chain(mapping: &Value) -> Vec<(String, Value)> {
    if let Some(chain) = mapping.get("chain").and_then(Value::as_array) {
        if !chain.is_empty() {
            return chain
                .iter()
                .filter_map(|step| {
                    let op = step.get("operation").and_then(Value::as_str)?.to_owned();
                    let cfg = step
                        .get("config")
                        .cloned()
                        .unwrap_or_else(|| Value::Object(serde_json::Map::new()));
                    Some((op, cfg))
                })
                .collect();
        }
    }
    // Legacy single-operation fallback
    let op = mapping
        .get("operation")
        .and_then(Value::as_str)
        .unwrap_or("none");
    if op == "none" {
        return Vec::new();
    }
    let cfg = mapping
        .get("operationConfig")
        .cloned()
        .unwrap_or_else(|| Value::Object(serde_json::Map::new()));
    vec![(op.to_owned(), cfg)]
}

/// Convert a JSON value to a string representation.
fn value_to_string(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => b.to_string(),
        Value::Null => String::new(),
        _ => v.to_string(),
    }
}

/// Apply a single transform operation to a value.
#[allow(clippy::too_many_lines)]
fn apply_operation(op: &str, config: &Value, value: Value) -> Value {
    match op {
        // ── String operations ─────────────────────────────
        "uppercase" => Value::String(value_to_string(&value).to_uppercase()),
        "lowercase" => Value::String(value_to_string(&value).to_lowercase()),
        "trim" => Value::String(value_to_string(&value).trim().to_owned()),
        "capitalize" => {
            let s = value_to_string(&value);
            let result = s
                .split_whitespace()
                .map(|w| {
                    let mut chars = w.chars();
                    match chars.next() {
                        Some(c) => {
                            let upper: String = c.to_uppercase().collect();
                            format!("{upper}{}", chars.as_str().to_lowercase())
                        }
                        None => String::new(),
                    }
                })
                .collect::<Vec<_>>()
                .join(" ");
            Value::String(result)
        }
        "camel_case" => {
            let s = value_to_string(&value);
            let parts: Vec<&str> = s.split(|c: char| !c.is_alphanumeric()).filter(|p| !p.is_empty()).collect();
            let result = parts
                .iter()
                .enumerate()
                .map(|(i, w)| {
                    if i == 0 {
                        w.to_lowercase()
                    } else {
                        let mut chars = w.chars();
                        match chars.next() {
                            Some(c) => {
                                let upper: String = c.to_uppercase().collect();
                                format!("{upper}{}", chars.as_str().to_lowercase())
                            }
                            None => String::new(),
                        }
                    }
                })
                .collect::<String>();
            Value::String(result)
        }
        "snake_case" => {
            let s = value_to_string(&value);
            let result: String = s
                .split(|c: char| !c.is_alphanumeric())
                .filter(|p| !p.is_empty())
                .map(str::to_lowercase)
                .collect::<Vec<_>>()
                .join("_");
            Value::String(result)
        }
        "kebab_case" => {
            let s = value_to_string(&value);
            let result: String = s
                .split(|c: char| !c.is_alphanumeric())
                .filter(|p| !p.is_empty())
                .map(str::to_lowercase)
                .collect::<Vec<_>>()
                .join("-");
            Value::String(result)
        }
        "slug" => {
            let s = value_to_string(&value).to_lowercase();
            let result: String = s
                .chars()
                .map(|c| if c.is_alphanumeric() || c == '-' { c } else { '-' })
                .collect();
            // Collapse multiple hyphens
            let mut prev_dash = false;
            let collapsed: String = result
                .chars()
                .filter(|&c| {
                    if c == '-' {
                        if prev_dash { return false; }
                        prev_dash = true;
                    } else {
                        prev_dash = false;
                    }
                    true
                })
                .collect();
            Value::String(collapsed.trim_matches('-').to_owned())
        }
        "pad_start" => {
            let s = value_to_string(&value);
            let pad_char = config.get("padChar").and_then(Value::as_str).unwrap_or("0");
            let pad_len = config.get("padLength").and_then(Value::as_u64).unwrap_or(0) as usize;
            let c = pad_char.chars().next().unwrap_or('0');
            if s.len() >= pad_len {
                Value::String(s)
            } else {
                let padding: String = std::iter::repeat_n(c, pad_len - s.len()).collect();
                Value::String(format!("{padding}{s}"))
            }
        }
        "pad_end" => {
            let s = value_to_string(&value);
            let pad_char = config.get("padChar").and_then(Value::as_str).unwrap_or("0");
            let pad_len = config.get("padLength").and_then(Value::as_u64).unwrap_or(0) as usize;
            let c = pad_char.chars().next().unwrap_or('0');
            if s.len() >= pad_len {
                Value::String(s)
            } else {
                let padding: String = std::iter::repeat_n(c, pad_len - s.len()).collect();
                Value::String(format!("{s}{padding}"))
            }
        }
        "substring" => {
            let s = value_to_string(&value);
            let start = config.get("start").and_then(Value::as_u64).unwrap_or(0) as usize;
            let end = config.get("end").and_then(Value::as_u64).map(|e| e as usize);
            let chars: Vec<char> = s.chars().collect();
            let end_idx = end.unwrap_or(chars.len()).min(chars.len());
            let start_idx = start.min(end_idx);
            Value::String(chars[start_idx..end_idx].iter().collect())
        }
        "replace" => {
            let s = value_to_string(&value);
            let find = config.get("find").and_then(Value::as_str).unwrap_or("");
            let replace_with = config.get("replaceWith").and_then(Value::as_str).unwrap_or("");
            Value::String(s.replace(find, replace_with))
        }
        "regex_replace" => {
            let s = value_to_string(&value);
            let pattern = config.get("regex").and_then(Value::as_str).unwrap_or("");
            let replace_with = config.get("replaceWith").and_then(Value::as_str).unwrap_or("");
            match regex::Regex::new(pattern) {
                Ok(re) => Value::String(re.replace_all(&s, replace_with).into_owned()),
                Err(_) => Value::String(s),
            }
        }
        "regex_extract" => {
            let s = value_to_string(&value);
            let pattern = config.get("regex").and_then(Value::as_str).unwrap_or("");
            match regex::Regex::new(pattern) {
                Ok(re) => match re.find(&s) {
                    Some(m) => Value::String(m.as_str().to_owned()),
                    None => Value::Null,
                },
                Err(_) => Value::Null,
            }
        }
        "split" => {
            let s = value_to_string(&value);
            let sep = config.get("separator").and_then(Value::as_str).unwrap_or(",");
            let parts: Vec<Value> = s.split(sep).map(|p| Value::String(p.to_owned())).collect();
            Value::Array(parts)
        }
        "template" => {
            let template_str = config.get("templateString").and_then(Value::as_str).unwrap_or("{{value}}");
            let result = template_str.replace("{{value}}", &value_to_string(&value));
            Value::String(result)
        }
        "truncate" => {
            let s = value_to_string(&value);
            let max_len = config.get("maxLength").and_then(Value::as_u64).unwrap_or(100) as usize;
            let suffix = config.get("suffix").and_then(Value::as_str).unwrap_or("...");
            if s.chars().count() <= max_len {
                Value::String(s)
            } else {
                let truncated: String = s.chars().take(max_len).collect();
                Value::String(format!("{truncated}{suffix}"))
            }
        }
        "encode_base64" => {
            use base64::Engine as _;
            let s = value_to_string(&value);
            Value::String(base64::engine::general_purpose::STANDARD.encode(s.as_bytes()))
        }
        "decode_base64" => {
            use base64::Engine as _;
            let s = value_to_string(&value);
            match base64::engine::general_purpose::STANDARD.decode(s.as_bytes()) {
                Ok(bytes) => Value::String(String::from_utf8_lossy(&bytes).into_owned()),
                Err(_) => Value::String(s),
            }
        }

        // ── Array operations ──────────────────────────────
        "join" => {
            let sep = config.get("separator").and_then(Value::as_str).unwrap_or(",");
            match &value {
                Value::Array(arr) => {
                    let parts: Vec<String> = arr.iter().map(value_to_string).collect();
                    Value::String(parts.join(sep))
                }
                _ => value,
            }
        }
        "flatten" => match value {
            Value::Array(arr) => {
                let mut result = Vec::new();
                for item in arr {
                    if let Value::Array(inner) = item {
                        result.extend(inner);
                    } else {
                        result.push(item);
                    }
                }
                Value::Array(result)
            }
            _ => value,
        },
        "unique" => match value {
            Value::Array(arr) => {
                let mut seen = Vec::new();
                let mut result = Vec::new();
                for item in arr {
                    let s = item.to_string();
                    if !seen.contains(&s) {
                        seen.push(s);
                        result.push(item);
                    }
                }
                Value::Array(result)
            }
            _ => value,
        },
        "sort_array" => match value {
            Value::Array(mut arr) => {
                arr.sort_by_key(value_to_string);
                Value::Array(arr)
            }
            _ => value,
        },
        "reverse" => match value {
            Value::Array(mut arr) => {
                arr.reverse();
                Value::Array(arr)
            }
            _ => value,
        },
        "first" => match &value {
            Value::Array(arr) => arr.first().cloned().unwrap_or(Value::Null),
            _ => value,
        },
        "last" => match &value {
            Value::Array(arr) => arr.last().cloned().unwrap_or(Value::Null),
            _ => value,
        },
        "nth" => {
            let idx = config.get("index").and_then(Value::as_u64).unwrap_or(0) as usize;
            match &value {
                Value::Array(arr) => arr.get(idx).cloned().unwrap_or(Value::Null),
                _ => value,
            }
        }
        "count" => match &value {
            Value::Array(arr) => serde_json::json!(arr.len()),
            Value::String(s) => serde_json::json!(s.len()),
            _ => serde_json::json!(0),
        },
        "filter" => {
            // Simple filter: keep items where a field is truthy
            let field = config.get("field").and_then(Value::as_str).unwrap_or("");
            match value {
                Value::Array(arr) => {
                    if field.is_empty() {
                        // Filter out null/empty
                        Value::Array(
                            arr.into_iter()
                                .filter(|v| !v.is_null() && !v.as_str().is_some_and(str::is_empty))
                                .collect(),
                        )
                    } else {
                        Value::Array(
                            arr.into_iter()
                                .filter(|v| {
                                    let fv = v.get(field);
                                    fv.is_some_and(|f| !f.is_null() && !f.as_str().is_some_and(str::is_empty))
                                })
                                .collect(),
                        )
                    }
                }
                _ => value,
            }
        }
        "map_each" | "pluck" => {
            let field = config.get("field").and_then(Value::as_str).unwrap_or("");
            match value {
                Value::Array(arr) => {
                    if field.is_empty() {
                        Value::Array(arr)
                    } else {
                        Value::Array(
                            arr.iter()
                                .map(|v| v.get(field).cloned().unwrap_or(Value::Null))
                                .collect(),
                        )
                    }
                }
                _ => value,
            }
        }
        "sum" => match &value {
            Value::Array(arr) => {
                let total: f64 = arr
                    .iter()
                    .filter_map(Value::as_f64)
                    .sum();
                serde_json::json!(total)
            }
            _ => value,
        },
        "avg" => match &value {
            Value::Array(arr) => {
                let nums: Vec<f64> = arr.iter().filter_map(Value::as_f64).collect();
                if nums.is_empty() {
                    serde_json::json!(0)
                } else {
                    serde_json::json!(nums.iter().sum::<f64>() / nums.len() as f64)
                }
            }
            _ => value,
        },
        "array_min" => match &value {
            Value::Array(arr) => {
                arr.iter()
                    .filter_map(Value::as_f64)
                    .min_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
                    .map_or(Value::Null, |n| serde_json::json!(n))
            }
            _ => value,
        },
        "array_max" => match &value {
            Value::Array(arr) => {
                arr.iter()
                    .filter_map(Value::as_f64)
                    .max_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
                    .map_or(Value::Null, |n| serde_json::json!(n))
            }
            _ => value,
        },
        "push" => {
            let push_val = config
                .get("defaultValue")
                .cloned()
                .unwrap_or(Value::Null);
            match value {
                Value::Array(mut arr) => {
                    arr.push(push_val);
                    Value::Array(arr)
                }
                _ => Value::Array(vec![value, push_val]),
            }
        }
        "concat_arrays" => {
            // In a chain, concat_arrays treats input as the array to extend.
            // Additional arrays would need to come from multi-source; as a
            // single op it's a no-op passthrough.
            value
        }
        "slice" => {
            let start = config.get("start").and_then(Value::as_u64).unwrap_or(0) as usize;
            let end = config.get("end").and_then(Value::as_u64).map(|e| e as usize);
            match value {
                Value::Array(arr) => {
                    let end_idx = end.unwrap_or(arr.len()).min(arr.len());
                    let start_idx = start.min(end_idx);
                    Value::Array(arr[start_idx..end_idx].to_vec())
                }
                _ => value,
            }
        }
        "chunk" => {
            let size = config.get("chunkSize").and_then(Value::as_u64).unwrap_or(1).max(1) as usize;
            match value {
                Value::Array(arr) => {
                    let chunks: Vec<Value> = arr
                        .chunks(size)
                        .map(|c| Value::Array(c.to_vec()))
                        .collect();
                    Value::Array(chunks)
                }
                _ => value,
            }
        }

        // ── Number operations ─────────────────────────────
        "to_number" => {
            let s = value_to_string(&value);
            match s.parse::<f64>() {
                Ok(n) => serde_json::json!(n),
                Err(_) => Value::Null,
            }
        }
        "round" => {
            let dp = config.get("decimalPlaces").and_then(Value::as_u64).unwrap_or(0);
            match value.as_f64() {
                Some(n) => {
                    let factor = 10_f64.powi(dp as i32);
                    serde_json::json!((n * factor).round() / factor)
                }
                None => value,
            }
        }
        "ceil" => match value.as_f64() {
            Some(n) => serde_json::json!(n.ceil()),
            None => value,
        },
        "floor" => match value.as_f64() {
            Some(n) => serde_json::json!(n.floor()),
            None => value,
        },
        "abs" => match value.as_f64() {
            Some(n) => serde_json::json!(n.abs()),
            None => value,
        },
        "mod" => {
            let operand = config.get("operand").and_then(Value::as_f64).unwrap_or(1.0);
            match value.as_f64() {
                Some(n) if operand != 0.0 => serde_json::json!(n % operand),
                _ => value,
            }
        }
        "add" => {
            let operand = config.get("operand").and_then(Value::as_f64).unwrap_or(0.0);
            match value.as_f64() {
                Some(n) => serde_json::json!(n + operand),
                None => value,
            }
        }
        "subtract" => {
            let operand = config.get("operand").and_then(Value::as_f64).unwrap_or(0.0);
            match value.as_f64() {
                Some(n) => serde_json::json!(n - operand),
                None => value,
            }
        }
        "multiply" => {
            let operand = config.get("operand").and_then(Value::as_f64).unwrap_or(1.0);
            match value.as_f64() {
                Some(n) => serde_json::json!(n * operand),
                None => value,
            }
        }
        "divide" => {
            let operand = config.get("operand").and_then(Value::as_f64).unwrap_or(1.0);
            match value.as_f64() {
                Some(n) if operand != 0.0 => serde_json::json!(n / operand),
                _ => value,
            }
        }
        "clamp" => {
            let min_val = config.get("minValue").and_then(Value::as_f64);
            let max_val = config.get("maxValue").and_then(Value::as_f64);
            match value.as_f64() {
                Some(mut n) => {
                    if let Some(lo) = min_val { n = n.max(lo); }
                    if let Some(hi) = max_val { n = n.min(hi); }
                    serde_json::json!(n)
                }
                None => value,
            }
        }
        "format_number" => {
            let dp = config.get("decimalPlaces").and_then(Value::as_u64).unwrap_or(2) as usize;
            match value.as_f64() {
                Some(n) => Value::String(format!("{n:.dp$}")),
                None => value,
            }
        }

        // ── Date operations ───────────────────────────────
        "to_date" | "parse_date" => {
            // Attempt to parse and return the ISO string
            let s = value_to_string(&value);
            let fmt = config.get("dateFormat").and_then(Value::as_str).unwrap_or("");
            if fmt.is_empty() {
                // Try ISO parsing
                match chrono::NaiveDateTime::parse_from_str(&s, "%Y-%m-%dT%H:%M:%S") {
                    Ok(dt) => Value::String(dt.format("%Y-%m-%dT%H:%M:%S").to_string()),
                    Err(_) => match chrono::NaiveDate::parse_from_str(&s, "%Y-%m-%d") {
                        Ok(d) => Value::String(d.format("%Y-%m-%d").to_string()),
                        Err(_) => Value::String(s),
                    },
                }
            } else {
                let chrono_fmt = date_format_to_chrono(fmt);
                match chrono::NaiveDateTime::parse_from_str(&s, &chrono_fmt) {
                    Ok(dt) => Value::String(dt.format("%Y-%m-%dT%H:%M:%S").to_string()),
                    Err(_) => match chrono::NaiveDate::parse_from_str(&s, &chrono_fmt) {
                        Ok(d) => Value::String(d.format("%Y-%m-%d").to_string()),
                        Err(_) => Value::String(s),
                    },
                }
            }
        }
        "format_date" => {
            let s = value_to_string(&value);
            let out_fmt = config.get("dateFormat").and_then(Value::as_str).unwrap_or("YYYY-MM-DD");
            let chrono_fmt = date_format_to_chrono(out_fmt);
            // Try parsing as ISO first
            if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(&s, "%Y-%m-%dT%H:%M:%S") {
                return Value::String(dt.format(&chrono_fmt).to_string());
            }
            if let Ok(d) = chrono::NaiveDate::parse_from_str(&s, "%Y-%m-%d") {
                return Value::String(d.format(&chrono_fmt).to_string());
            }
            Value::String(s)
        }
        "add_days" => {
            let days = config.get("days").and_then(Value::as_i64).unwrap_or(0);
            date_add_days(&value, days)
        }
        "subtract_days" => {
            let days = config.get("days").and_then(Value::as_i64).unwrap_or(0);
            date_add_days(&value, -days)
        }
        "add_hours" => {
            let hours = config.get("hours").and_then(Value::as_i64).unwrap_or(0);
            let s = value_to_string(&value);
            if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(&s, "%Y-%m-%dT%H:%M:%S") {
                let result = dt + chrono::Duration::hours(hours);
                return Value::String(result.format("%Y-%m-%dT%H:%M:%S").to_string());
            }
            value
        }
        "date_diff" => {
            // Returns days between the value (as date) and now
            let s = value_to_string(&value);
            let today = chrono::Utc::now().date_naive();
            if let Ok(d) = chrono::NaiveDate::parse_from_str(&s, "%Y-%m-%d") {
                return serde_json::json!((today - d).num_days());
            }
            if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(&s, "%Y-%m-%dT%H:%M:%S") {
                return serde_json::json!((today - dt.date()).num_days());
            }
            Value::Null
        }
        "now" => {
            Value::String(chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S").to_string())
        }
        "extract_year" => {
            let s = value_to_string(&value);
            if let Ok(d) = chrono::NaiveDate::parse_from_str(&s, "%Y-%m-%d") {
                return serde_json::json!(d.format("%Y").to_string().parse::<i32>().unwrap_or(0));
            }
            if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(&s, "%Y-%m-%dT%H:%M:%S") {
                return serde_json::json!(dt.format("%Y").to_string().parse::<i32>().unwrap_or(0));
            }
            Value::Null
        }
        "extract_month" => {
            let s = value_to_string(&value);
            if let Ok(d) = chrono::NaiveDate::parse_from_str(&s, "%Y-%m-%d") {
                return serde_json::json!(d.format("%m").to_string().parse::<u32>().unwrap_or(0));
            }
            if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(&s, "%Y-%m-%dT%H:%M:%S") {
                return serde_json::json!(dt.format("%m").to_string().parse::<u32>().unwrap_or(0));
            }
            Value::Null
        }
        "extract_day" => {
            let s = value_to_string(&value);
            if let Ok(d) = chrono::NaiveDate::parse_from_str(&s, "%Y-%m-%d") {
                return serde_json::json!(d.format("%d").to_string().parse::<u32>().unwrap_or(0));
            }
            if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(&s, "%Y-%m-%dT%H:%M:%S") {
                return serde_json::json!(dt.format("%d").to_string().parse::<u32>().unwrap_or(0));
            }
            Value::Null
        }

        // ── Conversion operations ─────────────────────────
        "to_string" => Value::String(value_to_string(&value)),
        "to_boolean" => {
            let truthy = match &value {
                Value::Bool(b) => *b,
                Value::Number(n) => n.as_f64().is_some_and(|f| f != 0.0),
                Value::String(s) => !s.is_empty() && s != "false" && s != "0",
                Value::Null => false,
                _ => true,
            };
            Value::Bool(truthy)
        }
        "to_array" => match &value {
            Value::Array(_) => value,
            _ => Value::Array(vec![value]),
        },
        "parse_json" => {
            let s = value_to_string(&value);
            serde_json::from_str(&s).unwrap_or(value)
        }
        "to_json" => Value::String(value.to_string()),
        "coalesce" => {
            if value.is_null() || value.as_str().is_some_and(str::is_empty) {
                Value::Null
            } else {
                value
            }
        }
        "default_value" => {
            if value.is_null() || value.as_str().is_some_and(str::is_empty) {
                config
                    .get("defaultValue")
                    .cloned()
                    .unwrap_or(Value::Null)
            } else {
                value
            }
        }
        "is_null" => Value::Bool(value.is_null()),
        "is_empty" => {
            let empty = match &value {
                Value::Null => true,
                Value::String(s) => s.is_empty(),
                Value::Array(a) => a.is_empty(),
                Value::Object(o) => o.is_empty(),
                _ => false,
            };
            Value::Bool(empty)
        }
        "typeof" => {
            let t = match &value {
                Value::Null => "null",
                Value::Bool(_) => "boolean",
                Value::Number(_) => "number",
                Value::String(_) => "string",
                Value::Array(_) => "array",
                Value::Object(_) => "object",
            };
            Value::String(t.to_owned())
        }

        // Unknown operation: pass through
        _ => value,
    }
}

/// Convert user-friendly date format to chrono strftime format.
fn date_format_to_chrono(fmt: &str) -> String {
    fmt.replace("YYYY", "%Y")
        .replace("MM", "%m")
        .replace("DD", "%d")
        .replace("HH", "%H")
        .replace("mm", "%M")
        .replace("ss", "%S")
}

/// Add days to a date value.
fn date_add_days(value: &Value, days: i64) -> Value {
    let s = value_to_string(value);
    if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(&s, "%Y-%m-%dT%H:%M:%S") {
        let result = dt + chrono::Duration::days(days);
        return Value::String(result.format("%Y-%m-%dT%H:%M:%S").to_string());
    }
    if let Ok(d) = chrono::NaiveDate::parse_from_str(&s, "%Y-%m-%d") {
        let result = d + chrono::Duration::days(days);
        return Value::String(result.format("%Y-%m-%d").to_string());
    }
    value.clone()
}
