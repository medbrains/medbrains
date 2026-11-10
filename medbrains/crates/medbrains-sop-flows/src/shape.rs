//! What a saved draft may look like: registered blocks only, sane sizes,
//! and the fields the server owns (lock, why it is required, its address)
//! set by the server, never taken from the screen.

use std::collections::HashSet;

use crate::blocks;
use crate::checks::block_of;
use crate::model::{FlowDef, Station, StationKind};

pub const MAX_STATIONS: usize = 40;
const MAX_TEXT: usize = 80;
/// A week, the longest expected time a station may have.
const MAX_SLA: i64 = 7 * 24 * 60;

fn text(what: &str, v: &str, required: bool) -> Result<(), String> {
    if required && v.trim().is_empty() {
        return Err(format!("{what} is required"));
    }
    if v.chars().count() > MAX_TEXT {
        return Err(format!("{what} is longer than {MAX_TEXT} characters"));
    }
    Ok(())
}

fn key_ok(key: &str) -> bool {
    (1..=40).contains(&key.len())
        && key
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_')
}

/// Check a draft's stations and fill in what the server owns.
///
/// # Errors
/// A sentence naming the station and what is wrong.
pub fn normalize(flow: &FlowDef, stations: Vec<Station>) -> Result<Vec<Station>, String> {
    if stations.is_empty() || stations.len() > MAX_STATIONS {
        return Err(format!("A track has 1 to {MAX_STATIONS} stations"));
    }
    let mut keys = HashSet::new();
    stations
        .into_iter()
        .map(|mut s| {
            let at =
                |e: String| format!("{}: {e}", if s.name.is_empty() { &s.key } else { &s.name });
            if !key_ok(&s.key) || !keys.insert(s.key.clone()) {
                return Err(at("needs a unique short key".to_owned()));
            }
            text("The name", &s.name, true).map_err(at)?;
            text("The stage", &s.stage, true).map_err(at)?;
            text("The holder", &s.holder, false).map_err(at)?;
            if let Some(lane) = &s.lane {
                text("The branch name", lane, true).map_err(at)?;
            }
            if let Some(role) = &s.holder_role {
                text("The holder role", role, true).map_err(at)?;
            }
            if s.sla_minutes.is_some_and(|m| !(0..=MAX_SLA).contains(&m)) {
                return Err(at(
                    "the expected time must be between 0 and 7 days".to_owned()
                ));
            }
            let block = block_of(&s.kind);
            match (&s.kind, block) {
                (StationKind::Switch { fact }, _) if blocks::fact(fact).is_none() => {
                    return Err(at(format!("\"{fact}\" is not a registered fact")));
                }
                (_, Some((kind, code))) => {
                    let b = blocks::block(kind, code).ok_or_else(|| {
                        at(format!("\"{code}\" is not a registered building block"))
                    })?;
                    if s.holder.trim().is_empty() {
                        b.holder.clone_into(&mut s.holder);
                    }
                }
                _ => {}
            }
            // The lock is the library's, matched by block: never the screen's.
            let lib = flow
                .stations
                .iter()
                .find(|l| l.locked && block.is_some() && block_of(&l.kind) == block);
            s.locked = lib.is_some();
            s.required_by = lib.and_then(|l| l.required_by.clone());
            s.path = format!("Hospital › {} › {} › {}", flow.name, s.stage, s.name);
            Ok(s)
        })
        .collect()
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::indexing_slicing)]
mod tests {
    use super::*;
    use crate::discharge;

    #[test]
    fn the_server_owns_the_lock_and_rejects_unregistered_blocks() {
        let flow = discharge::flow();
        let mut track = flow.stations.clone();
        track[0].locked = false;
        track[0].required_by = None;
        let out = normalize(&flow, track.clone()).unwrap();
        assert!(out[0].locked, "a screen cannot unlock Summary signed");
        assert!(out[0].required_by.is_some());
        track[1].kind = StationKind::Signal {
            signal: "free.code".to_owned(),
        };
        assert!(
            normalize(&flow, track)
                .unwrap_err()
                .contains("not a registered")
        );
    }

    #[test]
    fn keys_must_be_unique_and_tracks_bounded() {
        let flow = discharge::flow();
        let mut track = flow.stations.clone();
        track[1].key = track[0].key.clone();
        assert!(normalize(&flow, track).unwrap_err().contains("unique"));
        assert!(normalize(&flow, Vec::new()).is_err());
    }
}
