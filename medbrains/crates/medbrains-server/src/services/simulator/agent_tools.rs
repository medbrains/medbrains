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

use reqwest::Client;
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

/// Render a compact catalog listing for the model preamble.
pub fn catalog_text() -> String {
    TOOLS
        .iter()
        .map(|t| format!("- {} ({}): {}", t.name, t.method, t.about))
        .collect::<Vec<_>>()
        .join("\n")
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
    use super::{catalog_text, extract_id, find_tool, render_path, truncate};
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
}
