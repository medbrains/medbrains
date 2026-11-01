//! Which stations a route takes, and which switch settings are allowed.
//! Pure functions over values: no database, exhaustively unit-tested.

use medbrains_approvals_core::conditions::matches;
use serde_json::Value;

use crate::discharge;
use crate::model::{FlowDef, Station, SwitchKind, Switches};

/// Every library flow, by code.
#[must_use]
pub fn library() -> Vec<FlowDef> {
    vec![discharge::flow()]
}

#[must_use]
pub fn find(code: &str) -> Option<FlowDef> {
    library().into_iter().find(|f| f.code == code)
}

/// Whether the switches put `station` on the route (for some patients).
#[must_use]
pub fn on_switch_route(station: &Station, switches: &Switches) -> bool {
    station.switch_when.is_null() || matches(&station.switch_when, &Value::Object(switches.clone()))
}

/// Whether this patient, with these facts, stops at `station`.
#[must_use]
pub fn on_patient_route(station: &Station, switches: &Switches, facts: &Value) -> bool {
    on_switch_route(station, switches)
        && (station.fact_when.is_null() || matches(&station.fact_when, facts))
}

/// The station keys the switches route through.
#[must_use]
pub fn route_keys(stations: &[Station], switches: &Switches) -> Vec<String> {
    stations
        .iter()
        .filter(|s| on_switch_route(s, switches))
        .map(|s| s.key.clone())
        .collect()
}

/// Check a full set of switch settings against the flow.
///
/// Refuses unknown keys, a value the switch does not offer, a missing switch,
/// and — first, with its reason — any attempt to switch off a locked safety
/// signal (RFC §3.1).
///
/// # Errors
/// A sentence saying what is wrong.
pub fn validate(flow: &FlowDef, switches: &Switches) -> Result<(), String> {
    for key in switches.keys() {
        if let Some(locked) = flow.stations.iter().find(|s| s.locked && &s.key == key) {
            return Err(format!(
                "\"{}\" is a required safety signal and cannot be removed or switched off ({})",
                locked.name,
                locked
                    .required_by
                    .as_deref()
                    .unwrap_or("required by law or safety")
            ));
        }
    }
    for key in switches.keys() {
        if !flow.switches.iter().any(|s| &s.key == key) {
            return Err(format!("This flow has no switch \"{key}\""));
        }
    }
    for def in &flow.switches {
        let value = switches
            .get(&def.key)
            .ok_or_else(|| format!("\"{}\" needs a setting", def.sentence))?;
        let fits = match &def.kind {
            SwitchKind::OnOff { .. } => value.is_boolean(),
            SwitchKind::Choice { options, .. } => value
                .as_str()
                .is_some_and(|v| options.iter().any(|o| o.value == v)),
        };
        if !fits {
            return Err(format!("\"{}\" cannot be set to {value}", def.sentence));
        }
    }
    Ok(())
}

/// The switches as the flow ships them: today's behaviour.
#[must_use]
pub fn defaults(flow: &FlowDef) -> Switches {
    flow.switches
        .iter()
        .map(|s| (s.key.clone(), s.default_value()))
        .collect()
}

fn audience(station: &Station) -> &'static str {
    if station.fact_when.is_null() {
        "every patient"
    } else {
        "insurance patients"
    }
}

/// Plain sentences for what moving from `before` to `after` does to the route.
#[must_use]
pub fn route_changes(flow: &FlowDef, before: &Switches, after: &Switches) -> Vec<String> {
    flow.stations
        .iter()
        .filter_map(
            |s| match (on_switch_route(s, before), on_switch_route(s, after)) {
                (false, true) => Some(format!("Route now stops at {} for {}", s.name, audience(s))),
                (true, false) => Some(format!("Route now skips {} for {}", s.name, audience(s))),
                _ => None,
            },
        )
        .collect()
}

#[cfg(test)]
#[allow(clippy::expect_used, clippy::unwrap_used, clippy::indexing_slicing)]
mod tests {
    use super::*;
    use crate::discharge::{SW_SIGNOFF, SW_TPA};
    use serde_json::json;

    fn with(pairs: &[(&str, Value)]) -> Switches {
        let mut s = defaults(&discharge::flow());
        for (k, v) in pairs {
            s.insert((*k).to_owned(), v.clone());
        }
        s
    }

    #[test]
    fn defaults_reproduce_todays_discharge() {
        let flow = discharge::flow();
        let keys = route_keys(&flow.stations, &defaults(&flow));
        assert_eq!(
            keys,
            [
                "summary_signed",
                "doctor_cleared",
                "ward_handover",
                "nursing_cleared",
                "pharmacy_returns",
                "insurance_check",
                "billing_cleared",
                "finalize",
                "done"
            ]
        );
        assert!(validate(&flow, &defaults(&flow)).is_ok());
    }

    #[test]
    fn insurance_switch_adds_tpa_for_insurance_patients_only() {
        let flow = discharge::flow();
        let on = with(&[(SW_TPA, json!(true))]);
        let tpa = flow
            .stations
            .iter()
            .find(|s| s.key == "tpa_clearance")
            .unwrap();
        assert!(on_patient_route(tpa, &on, &json!({ "is_insurance": true })));
        assert!(!on_patient_route(
            tpa,
            &on,
            &json!({ "is_insurance": false })
        ));
        assert!(!on_patient_route(
            tpa,
            &defaults(&flow),
            &json!({ "is_insurance": true })
        ));
        let keys = route_keys(&flow.stations, &on);
        let tpa_at = keys.iter().position(|k| k == "tpa_clearance").unwrap();
        let billing_at = keys.iter().position(|k| k == "billing_cleared").unwrap();
        assert!(tpa_at < billing_at, "TPA clearance comes before billing");
    }

    #[test]
    fn signoff_choice_routes_through_the_superintendent() {
        let flow = discharge::flow();
        let ms = with(&[(SW_SIGNOFF, json!("medical_superintendent"))]);
        assert!(route_keys(&flow.stations, &ms).contains(&"ms_signoff".to_owned()));
        assert_eq!(
            route_changes(&flow, &defaults(&flow), &ms),
            ["Route now stops at Superintendent sign-off for every patient"]
        );
    }

    #[test]
    fn a_locked_signal_cannot_be_switched_off() {
        let flow = discharge::flow();
        let err = validate(&flow, &with(&[("summary_signed", json!(false))])).unwrap_err();
        assert!(err.contains("required safety signal"), "{err}");
    }

    #[test]
    fn locked_signals_are_on_every_route() {
        let flow = discharge::flow();
        for tpa in [true, false] {
            for signoff in ["treating_doctor", "medical_superintendent"] {
                let s = with(&[(SW_TPA, json!(tpa)), (SW_SIGNOFF, json!(signoff))]);
                for locked in flow.stations.iter().filter(|s| s.locked) {
                    assert!(on_switch_route(locked, &s), "{} dropped", locked.key);
                    assert!(locked.switch_when.is_null() && locked.fact_when.is_null());
                }
            }
        }
    }

    #[test]
    fn unknown_or_ill_typed_switches_are_refused() {
        let flow = discharge::flow();
        assert!(validate(&flow, &with(&[("free_code", json!(true))])).is_err());
        assert!(validate(&flow, &with(&[(SW_TPA, json!("yes"))])).is_err());
        assert!(validate(&flow, &with(&[(SW_SIGNOFF, json!("nobody"))])).is_err());
        let mut missing = defaults(&flow);
        missing.remove(SW_TPA);
        assert!(validate(&flow, &missing).is_err());
    }

    #[test]
    fn every_station_names_a_registered_block() {
        use crate::model::StationKind;
        use crate::registry::{ACTIONS, FACTS, SIGNALS, TASKS};
        for flow in library() {
            for st in &flow.stations {
                let ok = match &st.kind {
                    StationKind::Action { action } => ACTIONS.contains(&action.as_str()),
                    StationKind::Task { task } => TASKS.contains(&task.as_str()),
                    StationKind::Switch { fact } => FACTS.contains(&fact.as_str()),
                    StationKind::Signal { signal } => SIGNALS.contains(&signal.as_str()),
                    StationKind::End => true,
                };
                assert!(ok, "{} names an unregistered block", st.key);
                assert!(st.path.starts_with("Hospital › "), "{}", st.path);
            }
        }
    }
}
