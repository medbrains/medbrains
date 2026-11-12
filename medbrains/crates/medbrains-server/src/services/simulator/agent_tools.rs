//! Tool catalog + authenticated HTTP client for the LLM-driven simulator.
//!
//! The agent drives the SAME public API a real user hits. Each tool is a fixed
//! spec (name = the `simulator_run_steps.step_type`, method, path template).
//! The LLM picks a tool by name and supplies `path_params` + `body`; the host
//! renders the path, injects `is_dummy = true` on writes, and calls the live
//! endpoint with the cell's bearer token. Login requests the native-token
//! response (`x-medbrains-client: desktop-agent`) so the token comes back in
//! the body and every call uses `Authorization: Bearer` (skips CSRF), exactly
//! as `scripts/simulators/day-run.mjs` does.

use std::collections::HashMap;
use std::sync::OnceLock;

use reqwest::Client;
use serde::Deserialize;
use serde_json::{Value, json};
use uuid::Uuid;

/// A callable endpoint the agent may choose. `name` doubles as the persisted
/// `step_type`, so it must be `&'static str`.
#[derive(Debug)]
pub struct ToolSpec {
    pub name: &'static str,
    pub method: &'static str,
    pub path: &'static str,
    pub about: &'static str,
}

/// The fixed catalog — the real endpoints `day-run.mjs` already exercises,
/// plus GET pickers so the agent can discover ids.
pub const TOOLS: &[ToolSpec] = &[
    ToolSpec {
        name: "list_patients",
        method: "GET",
        path: "/api/patients?per_page=50",
        about: "List patients; pick a patient_id.",
    },
    ToolSpec {
        name: "list_doctors",
        method: "GET",
        path: "/api/admin/doctors?per_page=50",
        about: "List doctors; pick doctor_id and its department_id.",
    },
    ToolSpec {
        name: "list_departments",
        method: "GET",
        path: "/api/admin/departments",
        about: "List departments.",
    },
    ToolSpec {
        name: "create_opd_encounter",
        method: "POST",
        path: "/api/opd/encounters",
        about: "Open an OPD encounter. body: {patient_id, doctor_id, department_id, chief_complaint}.",
    },
    ToolSpec {
        name: "add_vitals",
        method: "POST",
        path: "/api/opd/encounters/{encounter_id}/vitals",
        about: "Record vitals. path_params:{encounter_id}. body:{systolic,diastolic,pulse,temperature_c,...}.",
    },
    ToolSpec {
        name: "add_diagnosis",
        method: "POST",
        path: "/api/opd/encounters/{encounter_id}/diagnoses",
        about: "Add a diagnosis. path_params:{encounter_id}. body:{icd_code,description}.",
    },
    ToolSpec {
        name: "add_prescription",
        method: "POST",
        path: "/api/opd/encounters/{encounter_id}/prescriptions",
        about: "Prescribe. path_params:{encounter_id}. body:{items:[{drug,dose,frequency}]}.",
    },
    ToolSpec {
        name: "order_lab",
        method: "POST",
        path: "/api/lab/orders",
        about: "Order a lab test. body:{encounter_id,test_id}.",
    },
    ToolSpec {
        name: "order_radiology",
        method: "POST",
        path: "/api/radiology/orders",
        about: "Order imaging. body:{encounter_id,modality_id}.",
    },
    ToolSpec {
        name: "admit_ipd",
        method: "POST",
        path: "/api/ipd/admissions",
        about: "Admit to a ward. body:{patient_id,department_id}.",
    },
    ToolSpec {
        name: "create_er_visit",
        method: "POST",
        path: "/api/emergency/visits",
        about: "Register an ER visit. body:{patient_id,chief_complaint}.",
    },
    ToolSpec {
        name: "triage_er",
        method: "POST",
        path: "/api/emergency/visits/{visit_id}/triage",
        about: "Triage an ER visit. path_params:{visit_id}. body:{level}.",
    },
    ToolSpec {
        name: "admit_er",
        method: "POST",
        path: "/api/emergency/visits/{visit_id}/admit",
        about: "Admit from ER. path_params:{visit_id}.",
    },
    ToolSpec {
        name: "register_patient",
        method: "POST",
        path: "/api/patients",
        about: "Register a new patient. body:{first_name,last_name,gender,date_of_birth,phone}.",
    },
    ToolSpec {
        name: "book_appointment",
        method: "POST",
        path: "/api/opd/appointments",
        about: "Book an OPD appointment. body:{patient_id,doctor_id,department_id,scheduled_at}.",
    },
    ToolSpec {
        name: "list_drugs",
        method: "GET",
        path: "/api/pharmacy/catalog",
        about: "List pharmacy catalog items; pick a catalog_item_id.",
    },
    ToolSpec {
        name: "pharmacy_sale",
        method: "POST",
        path: "/api/pharmacy/pos/sales",
        about: "Dispense/sell at the pharmacy POS. body:{items:[{catalog_item_id,quantity}],payment_mode}.",
    },
    ToolSpec {
        name: "create_invoice",
        method: "POST",
        path: "/api/billing/invoices",
        about: "Create a patient invoice. body:{patient_id,items:[{description,amount}]}.",
    },
    ToolSpec {
        name: "list_wards",
        method: "GET",
        path: "/api/ipd/wards",
        about: "List wards; pick a ward_id for an admission.",
    },
];

/// Look up a tool spec by the name the model returned.
pub fn find_tool(name: &str) -> Option<&'static ToolSpec> {
    TOOLS.iter().find(|t| t.name == name)
}

// ── Contract-exact field shapes (anti-hallucination) ─────────────────
//
// `tool_shapes.json` is generated offline from the real request structs (Rust)
// / TS types by `scripts/fetch_api_shape.py --emit-sim` and embedded at compile
// time. It gives every write tool its exact field list, so we can show the model
// the real contract and strip any field it invents that isn't in it. Regenerate
// with `make sim-tool-shapes` after changing the catalog or a request struct.

#[derive(Debug, Deserialize)]
struct ToolShapeFile {
    tools: HashMap<String, ToolShape>,
}

#[derive(Debug, Deserialize)]
struct ToolShape {
    fields: Vec<ToolField>,
}

#[derive(Debug, Deserialize)]
struct ToolField {
    name: String,
    #[serde(rename = "type")]
    field_type: String,
    required: bool,
}

fn shapes() -> &'static HashMap<String, ToolShape> {
    static SHAPES: OnceLock<HashMap<String, ToolShape>> = OnceLock::new();
    SHAPES.get_or_init(|| {
        serde_json::from_str::<ToolShapeFile>(include_str!("tool_shapes.json"))
            .map(|f| f.tools)
            .unwrap_or_default()
    })
}

/// Render a compact catalog listing for the model preamble.
///
/// When a tool has a known contract shape, list its exact fields (`*` = required)
/// so the model fills real fields instead of inventing them; otherwise fall back
/// to the hand-written hint.
pub fn catalog_text() -> String {
    let shapes = shapes();
    TOOLS
        .iter()
        .map(|t| {
            shapes.get(t.name).filter(|s| !s.fields.is_empty()).map_or_else(
                || format!("- {} ({}): {}", t.name, t.method, t.about),
                |shape| {
                    let fields = shape
                        .fields
                        .iter()
                        .map(|f| {
                            format!("{}{}: {}", f.name, if f.required { "*" } else { "" }, f.field_type)
                        })
                        .collect::<Vec<_>>()
                        .join(", ");
                    format!("- {} ({}): {} body fields: {{{fields}}} (*=required)", t.name, t.method, t.about)
                },
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// A function tool offered to the model for native function-calling.
#[derive(Debug)]
pub struct ToolDef {
    pub name: String,
    pub description: String,
    /// JSON Schema (object) for the tool's arguments.
    pub parameters: Value,
}

fn canon_to_json_type(canon: &str) -> &'static str {
    match canon {
        "number" => "number",
        "bool" => "boolean",
        "array" => "array",
        "object" | "map" | "json" => "object",
        _ => "string", // string, datetime, or unknown
    }
}

/// Extract `{placeholder}` names from a path template (e.g. `{encounter_id}`).
fn path_placeholders(path: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut rest = path;
    while let Some(start) = rest.find('{') {
        let Some(rel_end) = rest[start..].find('}') else { break };
        let end = start + rel_end;
        out.push(rest[start + 1..end].to_owned());
        rest = &rest[end + 1..];
    }
    out
}

/// The path-placeholder names for a tool, so the host can split the model's flat
/// argument object into path params vs body.
pub fn tool_path_params(name: &str) -> Vec<String> {
    find_tool(name).map(|t| path_placeholders(t.path)).unwrap_or_default()
}

/// Build one endpoint tool's argument schema: path placeholders (required
/// strings) + body fields (typed, required per the contract). `additionalProperties`
/// is false so the schema itself forbids invented fields.
fn tool_parameters(spec: &ToolSpec) -> Value {
    let mut props = serde_json::Map::new();
    let mut required: Vec<Value> = Vec::new();
    for ph in path_placeholders(spec.path) {
        props.insert(ph.clone(), json!({ "type": "string" }));
        required.push(Value::String(ph));
    }
    if let Some(shape) = shapes().get(spec.name) {
        for f in &shape.fields {
            props.insert(f.name.clone(), json!({ "type": canon_to_json_type(&f.field_type) }));
            if f.required {
                required.push(Value::String(f.name.clone()));
            }
        }
    }
    json!({
        "type": "object",
        "properties": Value::Object(props),
        "required": required,
        "additionalProperties": false,
    })
}

/// The full tool list offered to the model: control tools + one per endpoint,
/// each carrying its contract-exact typed argument schema.
pub fn build_tool_defs() -> Vec<ToolDef> {
    let mut defs = vec![
        ToolDef {
            name: "finish".to_owned(),
            description: "Call when the goal is achieved or clearly impossible.".to_owned(),
            parameters: json!({
                "type": "object",
                "properties": { "reason": { "type": "string" } },
                "additionalProperties": false,
            }),
        },
        ToolDef {
            name: "report_finding".to_owned(),
            description: "Report a bug, confusing UX, permission problem, or untranslated text you hit."
                .to_owned(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "kind": { "type": "string",
                        "enum": ["usability","permission","locale","error","workflow","discovery","logic"] },
                    "severity": { "type": "string", "enum": ["low","medium","high","critical"] },
                    "message": { "type": "string" }
                },
                "required": ["kind","severity","message"],
                "additionalProperties": false,
            }),
        },
    ];
    for spec in TOOLS {
        defs.push(ToolDef {
            name: spec.name.to_owned(),
            description: spec.about.to_owned(),
            parameters: tool_parameters(spec),
        });
    }
    defs
}

/// Drop any body key the model invented that isn't in the tool's contract.
///
/// Reports the dropped names. A no-op when the tool has no known shape (the
/// contract stays permissive rather than blocking an unknown tool). Prevents
/// "delusional properties" from ever reaching the live endpoint.
pub fn sanitize_body(tool_name: &str, body: &mut Value) -> Vec<String> {
    let Some(shape) = shapes().get(tool_name).filter(|s| !s.fields.is_empty()) else {
        return Vec::new();
    };
    let Some(obj) = body.as_object_mut() else {
        return Vec::new();
    };
    let allowed: std::collections::HashSet<&str> =
        shape.fields.iter().map(|f| f.name.as_str()).collect();
    // `is_dummy` is host-injected downstream, so it is always allowed through.
    let dropped: Vec<String> = obj
        .keys()
        .filter(|k| k.as_str() != "is_dummy" && !allowed.contains(k.as_str()))
        .cloned()
        .collect();
    for key in &dropped {
        obj.remove(key);
    }
    dropped
}

/// Fill `{key}` placeholders in a path template from a string-valued object.
pub fn render_path(template: &str, params: &Value) -> String {
    let mut out = template.to_owned();
    if let Some(obj) = params.as_object() {
        for (key, value) in obj {
            if let Some(s) = value.as_str() {
                out = out.replace(&format!("{{{key}}}"), s);
            }
        }
    }
    out
}

/// The result of one tool call, fed back to the agent and used for steps/findings.
#[derive(Debug)]
pub struct HttpOutcome {
    pub success: bool,
    pub status: u16,
    pub target_id: Option<Uuid>,
    pub body: String,
}

/// An authenticated session for one factor cell (one role login).
#[derive(Debug)]
pub struct SimClient {
    http: Client,
    base: String,
    token: String,
}

impl SimClient {
    /// Log in as a demo user and hold the bearer token for the run.
    pub async fn login(base: &str, username: &str, password: &str) -> Result<Self, String> {
        let http = Client::builder().build().map_err(|e| e.to_string())?;
        let resp = http
            .post(format!("{base}/api/auth/login"))
            .header("x-medbrains-client", "desktop-agent")
            .json(&json!({ "username": username, "password": password }))
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let status = resp.status();
        if !status.is_success() {
            return Err(format!("login failed: HTTP {}", status.as_u16()));
        }
        let body: Value = resp.json().await.map_err(|e| e.to_string())?;
        let token = body
            .get("token")
            .and_then(Value::as_str)
            .ok_or_else(|| "login returned no bearer token".to_owned())?
            .to_owned();
        Ok(Self {
            http,
            base: base.to_owned(),
            token,
        })
    }

    /// Call one endpoint. `body` is ignored for GET.
    pub async fn call(&self, method: &str, path: &str, body: &Value) -> HttpOutcome {
        let url = format!("{}{}", self.base, path);
        let builder = if method == "POST" {
            self.http.post(&url).json(body)
        } else {
            self.http.get(&url)
        };
        match builder.bearer_auth(&self.token).send().await {
            Ok(resp) => {
                let status = resp.status();
                let text = resp.text().await.unwrap_or_default();
                HttpOutcome {
                    success: status.is_success(),
                    status: status.as_u16(),
                    target_id: extract_id(&text),
                    body: truncate(&text, 800),
                }
            }
            Err(err) => HttpOutcome {
                success: false,
                status: 0,
                target_id: None,
                body: err.to_string(),
            },
        }
    }
}

/// Pull a created row's id out of a `{id}` or `{data:{id}}` response.
fn extract_id(text: &str) -> Option<Uuid> {
    let value: Value = serde_json::from_str(text).ok()?;
    let id = value
        .get("id")
        .or_else(|| value.get("data").and_then(|d| d.get("id")))?;
    id.as_str().and_then(|s| Uuid::parse_str(s).ok())
}

/// Char-safe truncation for snippets shown to the model / stored in findings.
pub fn truncate(text: &str, max: usize) -> String {
    if text.len() <= max {
        return text.to_owned();
    }
    let end = text
        .char_indices()
        .nth(max)
        .map_or(text.len(), |(idx, _)| idx);
    text[..end].to_owned()
}

#[cfg(test)]
mod tests {
    use super::{catalog_text, extract_id, find_tool, render_path, sanitize_body, truncate};
    use serde_json::json;

    #[test]
    fn renders_path_params() {
        let out = render_path("/api/opd/encounters/{encounter_id}/vitals", &json!({"encounter_id": "abc"}));
        assert_eq!(out, "/api/opd/encounters/abc/vitals");
    }

    #[test]
    fn leaves_unknown_placeholders() {
        assert_eq!(render_path("/api/x/{id}", &json!({})), "/api/x/{id}");
    }

    #[test]
    fn extracts_id_from_body_and_nested() {
        assert!(extract_id(r#"{"id":"550e8400-e29b-41d4-a716-446655440000"}"#).is_some());
        assert!(extract_id(r#"{"data":{"id":"550e8400-e29b-41d4-a716-446655440000"}}"#).is_some());
        assert!(extract_id("not json").is_none());
        assert!(extract_id(r#"{"id":"not-a-uuid"}"#).is_none());
    }

    #[test]
    fn truncate_respects_max() {
        assert_eq!(truncate("hi", 10), "hi");
        assert_eq!(truncate("abcdef", 3), "abc");
    }

    #[test]
    fn catalog_known_and_unknown() {
        assert!(find_tool("create_opd_encounter").is_some());
        assert!(find_tool("register_patient").is_some());
        assert!(find_tool("does_not_exist").is_none());
        assert!(catalog_text().contains("create_opd_encounter"));
    }

    #[test]
    fn catalog_lists_contract_fields() {
        // The embedded shapes give create_opd_encounter its real required fields.
        let text = catalog_text();
        assert!(text.contains("patient_id*"), "required field should be starred: {text}");
        assert!(text.contains("body fields:"));
    }

    #[test]
    fn sanitize_body_drops_invented_fields() {
        let mut body = json!({
            "patient_id": "p1",
            "department_id": "d1",
            "totally_made_up": "x",   // not in CreateEncounterRequest
        });
        let dropped = sanitize_body("create_opd_encounter", &mut body);
        assert_eq!(dropped, vec!["totally_made_up".to_owned()]);
        let obj = body.as_object().unwrap();
        assert!(obj.contains_key("patient_id"));
        assert!(!obj.contains_key("totally_made_up"));
    }

    #[test]
    fn sanitize_body_noop_without_shape() {
        // A GET picker / unknown tool has no shape → body passes through untouched.
        let mut body = json!({ "anything": 1 });
        assert!(sanitize_body("list_patients", &mut body).is_empty());
        assert!(sanitize_body("nonexistent_tool", &mut body).is_empty());
        assert!(body.as_object().unwrap().contains_key("anything"));
    }
}
