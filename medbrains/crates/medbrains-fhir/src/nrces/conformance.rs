//! A structural check of a `NRCeS` document bundle against the rules of the
//! IG 6.5.0 profiles it claims: required elements, section slices (fixed
//! code and display, cardinality, entry types, `openAtEnd`), entry slices of
//! the single-section records, coding systems the profiles fix, identifier
//! parts, and that every `urn:uuid:` reference resolves inside the bundle.
//!
//! The rules come from `profiles.json`, extracted from the published
//! `StructureDefinitions` by `scripts/nrces_profile_fixture.py`. This is not a
//! full FHIR validator (no terminology, no `FHIRPath` invariants beyond the
//! ones above); the HAPI validator with the IG package is the full check.

use std::collections::{HashMap, HashSet};
use std::sync::OnceLock;

use serde_json::Value;

const PROFILES: &str = include_str!("profiles.json");

fn profiles() -> &'static Value {
    static CELL: OnceLock<Value> = OnceLock::new();
    CELL.get_or_init(|| serde_json::from_str(PROFILES).unwrap_or(Value::Null))
}

fn present(v: &Value) -> bool {
    match v {
        Value::Null => false,
        Value::String(s) => !s.is_empty(),
        Value::Array(a) => !a.is_empty(),
        Value::Object(o) => !o.is_empty(),
        Value::Bool(_) | Value::Number(_) => true,
    }
}

/// The element at `name`, where `medication[x]` matches `medicationCodeableConcept`.
fn element<'a>(resource: &'a Value, name: &str) -> Option<&'a Value> {
    match name.strip_suffix("[x]") {
        Some(prefix) => resource
            .as_object()?
            .iter()
            .find(|(k, _)| k.starts_with(prefix))
            .map(|(_, v)| v),
        None => resource.get(name),
    }
}

fn below(max: &Value, n: usize) -> bool {
    max.as_str()
        .and_then(|m| m.parse::<usize>().ok())
        .is_none_or(|m| n <= m)
}

fn profile_name(resource: &Value) -> Option<&str> {
    resource["meta"]["profile"][0].as_str()?.rsplit('/').next()
}

/// Every rule the bundle breaks, as readable lines; empty means conformant.
#[must_use]
pub fn violations(bundle: &Value) -> Vec<String> {
    let mut out = Vec::new();
    let entries = bundle["entry"].as_array().cloned().unwrap_or_default();
    let mut by_url: HashMap<&str, &Value> = HashMap::new();
    for e in &entries {
        let url = e["fullUrl"].as_str().unwrap_or_default();
        if by_url.insert(url, &e["resource"]).is_some() {
            out.push(format!("duplicate fullUrl {url}"));
        }
    }
    if bundle["type"] != "document" {
        out.push("Bundle.type is not document".into());
    }
    if profile_name(bundle) != Some("DocumentBundle") {
        out.push("Bundle.meta.profile must be DocumentBundle".into());
    }
    if !present(&bundle["timestamp"]) {
        out.push("Bundle.timestamp missing".into());
    }
    if !present(&bundle["identifier"]["system"]) || !present(&bundle["identifier"]["value"]) {
        out.push("Bundle.identifier needs system and value".into());
    }
    let mut refs = Vec::new();
    collect_refs(bundle, &mut refs);
    for r in refs {
        if !by_url.contains_key(r) {
            out.push(format!("reference {r} does not resolve in the bundle"));
        }
    }
    match entries.first().map(|e| &e["resource"]) {
        Some(c) if c["resourceType"] == "Composition" => composition(c, &by_url, &mut out),
        _ => out.push("first entry is not a Composition".into()),
    }
    for e in &entries {
        resource(&e["resource"], &mut out);
    }
    out
}

fn collect_refs<'a>(v: &'a Value, out: &mut Vec<&'a str>) {
    match v {
        Value::Object(map) => {
            for (k, x) in map {
                match x.as_str() {
                    Some(s) if k == "reference" && s.starts_with("urn:uuid:") => out.push(s),
                    _ => collect_refs(x, out),
                }
            }
        }
        Value::Array(a) => a.iter().for_each(|x| collect_refs(x, out)),
        _ => {}
    }
}

fn composition(c: &Value, by_url: &HashMap<&str, &Value>, out: &mut Vec<String>) {
    let name = profile_name(c).unwrap_or_default();
    let Some(rules) = profiles()["compositions"].get(name) else {
        out.push(format!("Composition profile {name} is not one we check"));
        return;
    };
    for r in rules["required"].as_array().into_iter().flatten() {
        let r = r.as_str().unwrap_or_default();
        if !element(c, r).is_some_and(present) {
            out.push(format!("{name}: Composition.{r} is required"));
        }
    }
    if let Some(code) = rules["type_code"].as_str() {
        if c["type"]["coding"][0]["code"] != code {
            out.push(format!("{name}: Composition.type must be {code}"));
        }
    }
    let sections = c["section"].as_array().cloned().unwrap_or_default();
    if !below(&rules["section_max"], sections.len()) {
        out.push(format!(
            "{name}: {} sections, profile allows {}",
            sections.len(),
            rules["section_max"]
        ));
    }
    let resolve = |r: &Value| {
        by_url
            .get(r["reference"].as_str().unwrap_or_default())
            .copied()
    };
    if rules["entry_slices"]
        .as_array()
        .is_some_and(|s| !s.is_empty())
    {
        for s in &sections {
            entry_sliced(name, rules, s, &resolve, out);
        }
    } else {
        sliced(name, rules, &sections, &resolve, out);
    }
}

fn sliced<'a>(
    name: &str,
    rules: &Value,
    sections: &[Value],
    resolve: &dyn Fn(&Value) -> Option<&'a Value>,
    out: &mut Vec<String>,
) {
    let slices = rules["slices"].as_array().cloned().unwrap_or_default();
    let mut counts: HashMap<String, usize> = HashMap::new();
    let mut unsliced_seen = false;
    for s in sections {
        let code = s["code"]["coding"][0]["code"].as_str().unwrap_or_default();
        let Some(slice) = slices.iter().find(|x| x["code"] == code) else {
            unsliced_seen = true;
            continue;
        };
        let slice_name = slice["name"].as_str().unwrap_or_default();
        if unsliced_seen && rules["section_rules"] == "openAtEnd" {
            out.push(format!(
                "{name}: section {slice_name} comes after an unsliced section"
            ));
        }
        if s["code"]["coding"][0]["display"] != slice["display"] {
            out.push(format!(
                "{name}: section {slice_name} display must be {}",
                slice["display"]
            ));
        }
        let n = counts.entry(slice_name.to_owned()).or_default();
        *n += 1;
        if !below(&slice["max"], *n) {
            out.push(format!("{name}: section {slice_name} repeated"));
        }
        let allowed: HashSet<&str> = slice["entry_types"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(Value::as_str)
            .collect();
        for e in s["entry"].as_array().into_iter().flatten() {
            let target = resolve(e).and_then(profile_name).unwrap_or_default();
            if !allowed.contains(target) {
                out.push(format!("{name}: section {slice_name} cannot hold {target}"));
            }
        }
    }
}

fn entry_sliced<'a>(
    name: &str,
    rules: &Value,
    s: &Value,
    resolve: &dyn Fn(&Value) -> Option<&'a Value>,
    out: &mut Vec<String>,
) {
    let coding = &s["code"]["coding"][0];
    if coding["system"] != rules["section_system"] {
        out.push(format!(
            "{name}: section code system must be {}",
            rules["section_system"]
        ));
    }
    if let Some(code) = rules["section_code"].as_str() {
        if coding["code"] != code {
            out.push(format!("{name}: section code must be {code}"));
        }
    }
    let entries = s["entry"].as_array().cloned().unwrap_or_default();
    let min = rules["entry_min"].as_u64().unwrap_or(0);
    if (entries.len() as u64) < min || !below(&rules["entry_max"], entries.len()) {
        out.push(format!(
            "{name}: {} section entries is outside its cardinality",
            entries.len()
        ));
    }
    let slices = rules["entry_slices"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    let mut counts: HashMap<String, usize> = HashMap::new();
    for e in &entries {
        let ty = e["type"].as_str().unwrap_or_default();
        let Some(slice) = slices.iter().find(|x| x["type"] == ty) else {
            out.push(format!(
                "{name}: section entry type {ty:?} matches no slice (closed)"
            ));
            continue;
        };
        if resolve(e).is_none_or(|r| r["resourceType"] != ty) {
            out.push(format!("{name}: section entry is not the {ty} it claims"));
        }
        let n = counts.entry(ty.to_owned()).or_default();
        *n += 1;
        if !below(&slice["max"], *n) {
            out.push(format!("{name}: too many {ty} entries"));
        }
    }
}

fn resource(r: &Value, out: &mut Vec<String>) {
    let Some(name) = profile_name(r) else { return };
    let Some(rules) = profiles()["resources"].get(name) else {
        return;
    };
    let ty = r["resourceType"].as_str().unwrap_or_default();
    for f in rules["required"].as_array().into_iter().flatten() {
        let f = f.as_str().unwrap_or_default();
        if !element(r, f).is_some_and(present) {
            out.push(format!("{name} {}: {ty}.{f} is required", r["id"]));
        }
    }
    for rule in rules["codings"].as_array().into_iter().flatten() {
        codings(name, r, rule, out);
    }
    for id in r["identifier"].as_array().into_iter().flatten() {
        for f in rules["identifier_requires"]
            .as_array()
            .into_iter()
            .flatten()
        {
            let f = f.as_str().unwrap_or_default();
            if !present(&id[f]) {
                out.push(format!("{name}: identifier.{f} is required"));
            }
        }
    }
}

fn codings(name: &str, r: &Value, rule: &Value, out: &mut Vec<String>) {
    let path = rule["path"].as_str().unwrap_or_default();
    let Some(concepts) = element(r, path) else {
        return;
    };
    let list: Vec<&Value> = match concepts {
        Value::Array(a) => a.iter().collect(),
        v => vec![v],
    };
    for coding in list
        .iter()
        .flat_map(|c| c["coding"].as_array().into_iter().flatten())
    {
        if let Some(allowed) = rule["closed_systems"].as_array() {
            if !allowed.contains(&coding["system"]) {
                out.push(format!(
                    "{name}: {path} coding system {} matches no slice (closed)",
                    coding["system"]
                ));
            }
        }
        if let Some(only) = rule["only_system"].as_str() {
            if coding["system"] != only {
                out.push(format!(
                    "{name}: {path} codings must be {only}, got {}",
                    coding["system"]
                ));
            }
        }
        if rule["system"]
            .as_str()
            .is_some_and(|s| coding["system"] == s)
        {
            for f in rule["requires"].as_array().into_iter().flatten() {
                let f = f.as_str().unwrap_or_default();
                if !present(&coding[f]) {
                    out.push(format!(
                        "{name}: {path} {} coding needs {f}",
                        rule["system"]
                    ));
                }
            }
        }
    }
}
