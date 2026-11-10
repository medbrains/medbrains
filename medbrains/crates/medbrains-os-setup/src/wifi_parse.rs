//! Reads iwd's D-Bus replies. No I/O, so all of it is tested.

use serde_json::{Value, json};

const WEAKEST_DBM: f64 = -100.0;
/// How many networks the list shows. Bounded, however crowded the air is.
const MAX_NETWORKS: usize = 50;

/// One network iwd can see.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Network {
    pub(crate) path: String,
    pub(crate) name: String,
    pub(crate) kind: String,
    pub(crate) connected: bool,
    pub(crate) known: bool,
}

/// What iwd reports, read from its object tree.
#[derive(Debug, Default, PartialEq, Eq)]
pub(crate) struct Snapshot {
    /// The card's object path, also its station's.
    pub(crate) device: Option<String>,
    pub(crate) interface: String,
    pub(crate) powered: bool,
    pub(crate) scanning: bool,
    pub(crate) networks: Vec<Network>,
    /// Object paths of saved networks by name.
    pub(crate) known: Vec<(String, String)>,
}

/// One property of an object from `busctl --json`: `{"type":…,"data":…}`.
fn property<'a>(object: &'a Value, interface: &str, name: &str) -> Option<&'a Value> {
    object.get(interface)?.get(name)?.get("data")
}

/// Reads `GetManagedObjects` output into what the screen needs.
pub(crate) fn parse_objects(reply: &Value) -> Snapshot {
    let mut snapshot = Snapshot::default();
    let objects = reply
        .get("data")
        .and_then(|d| d.get(0))
        .and_then(Value::as_object);
    for (path, object) in objects.into_iter().flatten() {
        let text = |interface: &str, name: &str| {
            property(object, interface, name)
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_owned()
        };
        let flag = |interface: &str, name: &str| {
            property(object, interface, name)
                .and_then(Value::as_bool)
                .unwrap_or(false)
        };
        if object.get("net.connman.iwd.Device").is_some() && snapshot.device.is_none() {
            snapshot.device = Some(path.clone());
            snapshot.interface = text("net.connman.iwd.Device", "Name");
            snapshot.powered = flag("net.connman.iwd.Device", "Powered");
            snapshot.scanning = flag("net.connman.iwd.Station", "Scanning");
        }
        if object.get("net.connman.iwd.Network").is_some() {
            snapshot.networks.push(Network {
                path: path.clone(),
                name: text("net.connman.iwd.Network", "Name"),
                kind: text("net.connman.iwd.Network", "Type"),
                connected: flag("net.connman.iwd.Network", "Connected"),
                known: property(object, "net.connman.iwd.Network", "KnownNetwork").is_some(),
            });
        }
        if object.get("net.connman.iwd.KnownNetwork").is_some() {
            snapshot
                .known
                .push((text("net.connman.iwd.KnownNetwork", "Name"), path.clone()));
        }
    }
    snapshot
}

/// Network paths and signal in dBm from `GetOrderedNetworks`, strongest first. iwd gives 100 × dBm.
pub(crate) fn parse_ordered(reply: &Value) -> Vec<(String, f64)> {
    let list = reply
        .get("data")
        .and_then(|d| d.get(0))
        .and_then(Value::as_array);
    list.into_iter()
        .flatten()
        .filter_map(|pair| {
            let path = pair.get(0)?.as_str()?.to_owned();
            Some((path, pair.get(1)?.as_f64()? / 100.0))
        })
        .collect()
}

/// Signal as 0 to 100: −100 dBm is nothing and −50 dBm or better is full.
fn signal_percent(dbm: f64) -> u8 {
    ((dbm - WEAKEST_DBM) * 2.0).clamp(0.0, 100.0) as u8
}

/// The list for the screen: strongest first, then any iwd hasn't ranked, bounded.
pub(crate) fn network_list(snapshot: &Snapshot, ordered: &[(String, f64)]) -> Vec<Value> {
    let signal_of = |path: &str| ordered.iter().find(|(p, _)| p == path).map(|(_, dbm)| *dbm);
    let mut networks: Vec<&Network> = snapshot.networks.iter().collect();
    networks.sort_by(|a, b| {
        let (a, b) = (
            signal_of(&a.path).unwrap_or(WEAKEST_DBM),
            signal_of(&b.path).unwrap_or(WEAKEST_DBM),
        );
        b.total_cmp(&a)
    });
    networks.truncate(MAX_NETWORKS);
    networks
        .iter()
        .map(|network| {
            json!({
                "ssid": network.name,
                "secured": network.kind != "open",
                "enterprise": network.kind == "8021x",
                "saved": network.known,
                "connected": network.connected,
                "signal": signal_of(&network.path).map_or(0, signal_percent),
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::{network_list, parse_objects, parse_ordered, signal_percent};
    use serde_json::json;

    /// The shape `busctl --json=short` gives for iwd's objects.
    fn objects() -> serde_json::Value {
        let s = |value: &str| json!({ "type": "s", "data": value });
        let b = |value: bool| json!({ "type": "b", "data": value });
        json!({ "type": "a{oa{sa{sv}}}", "data": [{
            "/net/connman/iwd/0/4": {
                "net.connman.iwd.Device": { "Name": s("wlan0"), "Powered": b(true) },
                "net.connman.iwd.Station": { "Scanning": b(false), "State": s("connected") },
            },
            "/net/connman/iwd/0/4/ward_psk": {
                "net.connman.iwd.Network": {
                    "Name": s("Ward"), "Type": s("psk"), "Connected": b(true),
                    "KnownNetwork": { "type": "o", "data": "/net/connman/iwd/ward_psk" },
                },
            },
            "/net/connman/iwd/0/4/guest_open": {
                "net.connman.iwd.Network": { "Name": s("Guest"), "Type": s("open"), "Connected": b(false) },
            },
            "/net/connman/iwd/ward_psk": {
                "net.connman.iwd.KnownNetwork": { "Name": s("Ward"), "Type": s("psk") },
            },
        }]})
    }

    #[test]
    fn the_list_comes_from_iwds_objects_strongest_first() {
        let snapshot = parse_objects(&objects());
        assert_eq!(snapshot.interface, "wlan0");
        assert!(snapshot.powered);
        assert_eq!(snapshot.known.len(), 1);
        let ordered = parse_ordered(&json!({ "type": "a(on)", "data": [[
            ["/net/connman/iwd/0/4/guest_open", -4000],
            ["/net/connman/iwd/0/4/ward_psk", -7500],
        ]]}));
        let list = network_list(&snapshot, &ordered);
        assert_eq!(list[0]["ssid"], "Guest");
        assert_eq!(list[0]["secured"], false);
        assert_eq!(list[0]["signal"], 100);
        assert_eq!(list[1]["ssid"], "Ward");
        assert_eq!(list[1]["secured"], true);
        assert_eq!(list[1]["saved"], true);
        assert_eq!(list[1]["connected"], true);
        assert_eq!(list[1]["signal"], 50);
    }

    #[test]
    fn damaged_replies_read_as_nothing_found() {
        let empty = parse_objects(&json!(null));
        assert!(empty.device.is_none() && empty.networks.is_empty());
        assert!(parse_ordered(&json!({ "data": "nonsense" })).is_empty());
        assert_eq!(signal_percent(-120.0), 0);
        assert_eq!(signal_percent(-30.0), 100);
    }
}
