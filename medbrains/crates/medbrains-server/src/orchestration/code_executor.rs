//! Code Execution Engine — sandboxed multi-language pipeline code runner.
//!
//! Supports:
//! - **Expression** — simple field comparisons and math
//! - **JSON Logic** — declarative rule evaluation
//! - **Lua** — full scripting via sandboxed mlua (no I/O, instruction limits)
//! - **WASM** — pre-compiled WebAssembly modules via wasmtime

use anyhow::{Context, Result, bail};
use serde_json::Value;
use std::time::Duration;
use tracing::info;

/// Execute custom code in the specified language.
///
/// Returns the output JSON value produced by the code.
pub async fn execute_code(
    language: &str,
    code: &str,
    input: &Value,
    timeout_ms: u64,
) -> Result<Value> {
    let timeout = Duration::from_millis(timeout_ms);

    match language {
        "expression" => execute_expression(code, input),
        "json_logic" => execute_json_logic(code, input),
        "lua" => {
            let code = code.to_string();
            let input = input.clone();
            tokio::time::timeout(timeout, tokio::task::spawn_blocking(move || {
                execute_lua_sync(&code, &input)
            }))
            .await
            .context("Lua execution timed out")?
            .context("Lua task panicked")?
        }
        "wasm" => {
            let code_bytes = decode_wasm_bytes(code)?;
            let input = input.clone();
            tokio::time::timeout(timeout, tokio::task::spawn_blocking(move || {
                execute_wasm_sync(&code_bytes, &input)
            }))
            .await
            .context("WASM execution timed out")?
            .context("WASM task panicked")?
        }
        other => bail!("unsupported language: {other}"),
    }
}

/// Validate WASM module bytes (check it's a valid WASM binary).
pub fn validate_wasm(wasm_bytes: &[u8]) -> Result<()> {
    use wasmtime::*;
    let engine = Engine::default();
    Module::new(&engine, wasm_bytes).context("invalid WASM module")?;
    Ok(())
}

/// Compile Rust source code to WASM bytecode.
///
/// Requires `rustc` with `wasm32-wasip1` target installed on the server.
pub async fn compile_rust_to_wasm(rust_code: &str) -> Result<Vec<u8>> {
    let code = rust_code.to_string();
    tokio::task::spawn_blocking(move || compile_rust_sync(&code))
        .await
        .context("compilation task panicked")?
}

fn compile_rust_sync(source: &str) -> Result<Vec<u8>> {
    let tmp_dir = std::env::temp_dir().join(format!("mb_wasm_{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&tmp_dir)?;

    let src_path = tmp_dir.join("lib.rs");
    let out_path = tmp_dir.join("output.wasm");

    std::fs::write(&src_path, source)?;

    let output = std::process::Command::new("rustc")
        .args([
            "--target", "wasm32-wasip1",
            "--edition", "2021",
            "-O",
            "--crate-type", "cdylib",
            "-o", &out_path.to_string_lossy(),
            &src_path.to_string_lossy(),
        ])
        .output()
        .context("failed to invoke rustc — is wasm32-wasip1 target installed?")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        std::fs::remove_dir_all(&tmp_dir).ok();
        bail!("Rust compilation failed:\n{stderr}");
    }

    let wasm_bytes = std::fs::read(&out_path)
        .context("failed to read compiled WASM")?;

    std::fs::remove_dir_all(&tmp_dir).ok();
    info!(size = wasm_bytes.len(), "Rust → WASM compilation successful");
    Ok(wasm_bytes)
}

// ── Expression evaluator ──────────────────────────────────

fn execute_expression(expr: &str, input: &Value) -> Result<Value> {
    let expr = expr.trim();
    if expr.is_empty() {
        return Ok(Value::Null);
    }

    // Simple field access: "field_name"
    if let Some(val) = resolve_path(input, expr) {
        return Ok(val.clone());
    }

    // Comparison: "field op value"
    let ops = [">=", "<=", "!=", "==", ">", "<"];
    for op in ops {
        if let Some((left, right)) = expr.split_once(op) {
            let left_val = resolve_or_parse(input, left.trim());
            let right_val = resolve_or_parse(input, right.trim());
            let result = compare_values(&left_val, op, &right_val);
            return Ok(Value::Bool(result));
        }
    }

    // Try as JSON literal
    if let Ok(v) = serde_json::from_str::<Value>(expr) {
        return Ok(v);
    }

    bail!("cannot evaluate expression: {expr}")
}

fn resolve_path<'a>(obj: &'a Value, path: &str) -> Option<&'a Value> {
    let mut current = obj;
    for segment in path.split('.') {
        current = current.get(segment)?;
    }
    Some(current)
}

fn resolve_or_parse(obj: &Value, token: &str) -> Value {
    if let Some(v) = resolve_path(obj, token) {
        return v.clone();
    }
    if let Ok(n) = token.parse::<f64>() {
        return Value::Number(serde_json::Number::from_f64(n).unwrap_or_else(|| serde_json::Number::from(0)));
    }
    let unquoted = token.trim_matches('"').trim_matches('\'');
    Value::String(unquoted.to_string())
}

fn compare_values(left: &Value, op: &str, right: &Value) -> bool {
    let lf = as_f64(left);
    let rf = as_f64(right);
    if let (Some(l), Some(r)) = (lf, rf) {
        return match op {
            ">" => l > r,
            "<" => l < r,
            ">=" => l >= r,
            "<=" => l <= r,
            "==" => (l - r).abs() < f64::EPSILON,
            "!=" => (l - r).abs() >= f64::EPSILON,
            _ => false,
        };
    }
    let ls = left.as_str().unwrap_or("");
    let rs = right.as_str().unwrap_or("");
    match op {
        "==" => ls == rs,
        "!=" => ls != rs,
        _ => false,
    }
}

fn as_f64(v: &Value) -> Option<f64> {
    match v {
        Value::Number(n) => n.as_f64(),
        Value::String(s) => s.parse::<f64>().ok(),
        Value::Bool(b) => Some(if *b { 1.0 } else { 0.0 }),
        _ => None,
    }
}

// ── JSON Logic evaluator ──────────────────────────────────

fn execute_json_logic(rule_str: &str, data: &Value) -> Result<Value> {
    let rule: Value = serde_json::from_str(rule_str)
        .context("invalid JSON Logic rule")?;
    Ok(eval_logic(&rule, data))
}

fn eval_logic(rule: &Value, data: &Value) -> Value {
    let obj = match rule.as_object() {
        Some(o) if o.len() == 1 => o,
        _ => return rule.clone(),
    };

    let (op, args) = obj.iter().next().map(|(k, v)| (k.as_str(), v)).unwrap_or(("", &Value::Null));
    let arr = args.as_array();

    match op {
        "var" => {
            let path = args.as_str().unwrap_or("");
            resolve_path(data, path).cloned().unwrap_or(Value::Null)
        }
        "==" => {
            let a = arr.and_then(|a| a.first()).map(|v| eval_logic(v, data)).unwrap_or(Value::Null);
            let b = arr.and_then(|a| a.get(1)).map(|v| eval_logic(v, data)).unwrap_or(Value::Null);
            Value::Bool(a == b)
        }
        "!=" => {
            let a = arr.and_then(|a| a.first()).map(|v| eval_logic(v, data)).unwrap_or(Value::Null);
            let b = arr.and_then(|a| a.get(1)).map(|v| eval_logic(v, data)).unwrap_or(Value::Null);
            Value::Bool(a != b)
        }
        ">" | "<" | ">=" | "<=" => {
            let a = arr.and_then(|a| a.first()).map(|v| eval_logic(v, data)).unwrap_or(Value::Null);
            let b = arr.and_then(|a| a.get(1)).map(|v| eval_logic(v, data)).unwrap_or(Value::Null);
            Value::Bool(compare_values(&a, op, &b))
        }
        "and" => {
            let items = arr.map(|a| a.iter().map(|v| eval_logic(v, data)).collect::<Vec<_>>()).unwrap_or_default();
            Value::Bool(items.iter().all(is_truthy))
        }
        "or" => {
            let items = arr.map(|a| a.iter().map(|v| eval_logic(v, data)).collect::<Vec<_>>()).unwrap_or_default();
            Value::Bool(items.iter().any(is_truthy))
        }
        "!" => {
            let v = arr.and_then(|a| a.first()).map(|v| eval_logic(v, data)).unwrap_or(Value::Null);
            Value::Bool(!is_truthy(&v))
        }
        "if" => {
            let items = arr.map(|a| a.as_slice()).unwrap_or(&[]);
            let mut i = 0;
            while i + 1 < items.len() {
                let cond = eval_logic(&items[i], data);
                if is_truthy(&cond) {
                    return eval_logic(&items[i + 1], data);
                }
                i += 2;
            }
            items.get(i).map(|v| eval_logic(v, data)).unwrap_or(Value::Null)
        }
        _ => rule.clone(),
    }
}

fn is_truthy(v: &Value) -> bool {
    match v {
        Value::Null => false,
        Value::Bool(b) => *b,
        Value::Number(n) => n.as_f64().map_or(false, |f| f != 0.0),
        Value::String(s) => !s.is_empty(),
        Value::Array(a) => !a.is_empty(),
        Value::Object(_) => true,
    }
}

// ── Lua executor (sandboxed) ──────────────────────────────

fn execute_lua_sync(code: &str, input: &Value) -> Result<Value> {
    use mlua::prelude::*;

    let lua = Lua::new();

    // Remove dangerous libraries
    let globals = lua.globals();
    for lib in &["os", "io", "debug", "package", "loadfile", "dofile"] {
        let _ = globals.set(*lib, LuaValue::Nil);
    }

    // Set instruction limit (prevent infinite loops)
    lua.set_hook(
        mlua::HookTriggers::new().every_nth_instruction(10_000),
        |_lua, _debug| {
            Err(mlua::Error::runtime("instruction limit exceeded (10,000)"))
        },
    );

    // Inject input as global table
    let input_val: LuaValue = lua.to_value(input)
        .map_err(|e| anyhow::anyhow!("failed to convert input to Lua value: {e}"))?;
    globals.set("input", input_val)
        .map_err(|e| anyhow::anyhow!("failed to set input global: {e}"))?;

    // Execute user code
    let result: LuaValue = lua.load(code).eval()
        .map_err(|e| anyhow::anyhow!("Lua execution failed: {e}"))?;

    // Convert result back to JSON
    let json_val: Value = lua.from_value(result)
        .map_err(|e| anyhow::anyhow!("failed to convert Lua result to JSON: {e}"))?;

    info!("Lua code executed successfully");
    Ok(json_val)
}

// ── WASM executor (wasmtime) ──────────────────────────────

fn decode_wasm_bytes(code: &str) -> Result<Vec<u8>> {
    // code can be base64-encoded WASM bytes
    base64::Engine::decode(
        &base64::engine::general_purpose::STANDARD,
        code.trim(),
    )
    .context("invalid base64 WASM module")
}

fn execute_wasm_sync(wasm_bytes: &[u8], input: &Value) -> Result<Value> {
    use wasmtime::*;

    let engine = Engine::default();
    let module = Module::new(&engine, wasm_bytes)
        .context("failed to compile WASM module")?;

    let mut store = Store::new(&engine, ());

    // Set fuel limit for execution bounds
    store.set_fuel(100_000)
        .context("failed to set fuel limit")?;

    let linker = Linker::new(&engine);
    let instance = linker.instantiate(&mut store, &module)
        .context("failed to instantiate WASM module")?;

    // Get memory for data exchange
    let memory = instance.get_memory(&mut store, "memory")
        .context("WASM module must export 'memory'")?;

    // Serialize input to JSON bytes
    let input_bytes = serde_json::to_vec(input)?;
    let input_len = input_bytes.len();

    // Call alloc function to get pointer for input
    let alloc = instance.get_typed_func::<i32, i32>(&mut store, "alloc")
        .context("WASM module must export 'alloc(size: i32) -> i32'")?;
    let input_ptr = alloc.call(&mut store, input_len as i32)
        .context("alloc failed")?;

    // Write input to WASM memory
    memory.write(&mut store, input_ptr as usize, &input_bytes)
        .context("failed to write input to WASM memory")?;

    // Call transform function
    let transform = instance.get_typed_func::<(i32, i32), i64>(&mut store, "transform")
        .context("WASM module must export 'transform(ptr: i32, len: i32) -> i64'")?;
    let result = transform.call(&mut store, (input_ptr, input_len as i32))
        .context("transform execution failed")?;

    // Decode result: high 32 bits = ptr, low 32 bits = len
    let result_ptr = (result >> 32) as usize;
    let result_len = (result & 0xFFFF_FFFF) as usize;

    // Read output from WASM memory
    let mut output_bytes = vec![0u8; result_len];
    memory.read(&store, result_ptr, &mut output_bytes)
        .context("failed to read output from WASM memory")?;

    let output: Value = serde_json::from_slice(&output_bytes)
        .context("WASM output is not valid JSON")?;

    info!(output_len = result_len, "WASM code executed successfully");
    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_expression_comparison() {
        let input = json!({ "age": 25, "status": "active" });
        let result = execute_expression("age > 18", &input).unwrap();
        assert_eq!(result, Value::Bool(true));
    }

    #[test]
    fn test_expression_field_access() {
        let input = json!({ "patient": { "name": "Test" } });
        let result = execute_expression("patient.name", &input).unwrap();
        assert_eq!(result, Value::String("Test".to_string()));
    }

    #[test]
    fn test_json_logic_var() {
        let data = json!({ "temp": 100 });
        let result = execute_json_logic(r#"{">":[{"var":"temp"}, 90]}"#, &data).unwrap();
        assert_eq!(result, Value::Bool(true));
    }

    #[tokio::test]
    async fn test_lua_basic() {
        let input = json!({ "x": 10, "y": 20 });
        let result = execute_code("lua", "return input.x + input.y", &input, 5000).await.unwrap();
        assert_eq!(result, Value::Number(30.into()));
    }
}
