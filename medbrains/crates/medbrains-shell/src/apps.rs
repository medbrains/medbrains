//! Which apps this machine has: one small JSON file each in `/usr/share/medbrains/apps/`. A file
//! that is missing, damaged or breaks a rule simply gives no tile; it never breaks the desktop.
//! The format is documented in `os/README.md`.

use std::path::Path;

use gtk4::glib;
use serde::Deserialize;
use serde_json::{Value, json};

use crate::child;

/// Where manifests live, in the read-only system.
const APPS_DIR: &str = "/usr/share/medbrains/apps";
/// Icons given as a path must be under here, so a manifest can't read an arbitrary file.
const ICON_ROOT: &str = "/usr/share/medbrains/";
/// The one origin scheme and host an app may have. Only this host has a certificate the
/// screen trusts, so the rule and the trust agree.
const ORIGIN_PREFIX: &str = "https://127.0.0.1";
/// Whole origins allowed besides that, one by one and never by pattern. Kanidm needs a name, because
/// WebAuthn cannot use an address and its cookies go to its own name. `/etc/hosts` points this name at
/// this machine, and first boot adds its certificate to what the screen trusts. The screen's own name is the
/// MedBrains app's origin, so Kanidm sends the screen back to a name no other computer resolves.
const NAMED_ORIGINS: [&str; 2] = [
    "https://idm.medbrains.local:9443",
    "https://screen.medbrains.local:8443",
];
const HEALTH_PREFIX: &str = "http://127.0.0.1:";
const MAX_APPS: usize = 32;
const MAX_MANIFEST_BYTES: u64 = 16 * 1024;
const MAX_NAME_CHARS: usize = 40;
const LOG: &str = "medbrains-shell";

/// One app as its manifest declares it.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub(crate) struct App {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) icon: String,
    /// The local address it opens. Only the built-in Settings has none.
    #[serde(default)]
    pub(crate) url: Option<String>,
    /// "main", "node" or "any".
    pub(crate) role: String,
    /// The systemd unit it depends on, whose state its tile shows.
    #[serde(default)]
    pub(crate) unit: Option<String>,
    /// Optional plain-HTTP loopback address to ask before opening.
    #[serde(default)]
    pub(crate) health: Option<String>,
    /// Draws the tile in the brand colour.
    #[serde(default)]
    pub(crate) accent: bool,
    /// A second origin this app may visit to sign in. Only one of the named origins.
    #[serde(default)]
    pub(crate) sign_in_origin: Option<String>,
}

/// The origin of a URL this file accepts, such as `https://127.0.0.1:8443`, or `None` if the URL
/// is anywhere but this machine. Written out so no user-info or look-alike host can slip by.
pub(crate) fn local_origin(url: &str) -> Option<&str> {
    for origin in NAMED_ORIGINS {
        if url
            .strip_prefix(origin)
            .is_some_and(|path| path.starts_with('/'))
        {
            return Some(&url[..origin.len()]);
        }
    }
    let rest = url.strip_prefix(ORIGIN_PREFIX)?;
    let path_at = match rest.strip_prefix(':') {
        Some(after) => {
            let digits = after.find('/')?;
            after[..digits]
                .parse::<u16>()
                .ok()
                .filter(|port| *port > 0)?;
            digits + 1
        }
        None if rest.starts_with('/') => 0,
        None => return None,
    };
    Some(&url[..ORIGIN_PREFIX.len() + path_at])
}

/// The address and path to probe, from a `health` value, such as `127.0.0.1:3000`, `/api/health`.
pub(crate) fn health_target(health: &str) -> Option<(String, String)> {
    let rest = health.strip_prefix(HEALTH_PREFIX)?;
    let slash = rest.find('/')?;
    rest[..slash].parse::<u16>().ok()?;
    Some((
        format!("127.0.0.1:{}", &rest[..slash]),
        rest[slash..].to_owned(),
    ))
}

/// True for an id that is safe as a page name and a storage name.
fn is_id(id: &str) -> bool {
    (1..=32).contains(&id.len())
        && id
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

/// True for a systemd unit name that cannot be taken for a command's option.
fn is_unit(unit: &str) -> bool {
    !unit.starts_with('-')
        && unit.contains('.')
        && unit
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "-_.@:".contains(c))
}

/// True for an icon: a theme icon's name, or a file under the shared directory.
fn is_icon(icon: &str) -> bool {
    match icon.strip_prefix(ICON_ROOT) {
        Some(rest) => !rest
            .split('/')
            .any(|part| part.is_empty() || part.starts_with('.')),
        None => !icon.is_empty() && icon.chars().all(|c| c.is_ascii_alphanumeric() || c == '-'),
    }
}

/// Why an app is refused, if it is. Settings alone may lack a URL, being built into the shell.
fn refusal(app: &App, file_stem: &str) -> Option<&'static str> {
    let name_length = app.name.trim().chars().count();
    if !is_id(&app.id) || app.id != file_stem {
        Some("its id must be simple and match its file name")
    } else if name_length == 0
        || name_length > MAX_NAME_CHARS
        || app.name.contains(char::is_control)
    {
        Some("its name is empty, too long or has control characters")
    } else if !is_icon(&app.icon) {
        Some("its icon must be a theme icon or a file under /usr/share/medbrains/")
    } else if !matches!(app.role.as_str(), "main" | "node" | "any") {
        Some("its role must be main, node or any")
    } else if app.unit.as_deref().is_some_and(|unit| !is_unit(unit)) {
        Some("its unit is not a unit name")
    } else if app
        .sign_in_origin
        .as_deref()
        .is_some_and(|origin| !NAMED_ORIGINS.contains(&origin))
    {
        Some("its sign-in origin is not one this machine allows")
    } else if app
        .health
        .as_deref()
        .is_some_and(|health| health_target(health).is_none())
    {
        Some("its health address must be plain HTTP on 127.0.0.1")
    } else {
        match app.url.as_deref() {
            Some(url) if local_origin(url).is_none() => Some("its URL is outside this machine"),
            None if app.id != "settings" => Some("it has no URL"),
            _ => None,
        }
    }
}

/// Reads one manifest, or says why not.
fn read_manifest(path: &Path) -> Result<App, String> {
    let stem = path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or_default();
    let size = std::fs::metadata(path).map_err(|e| e.to_string())?.len();
    if size > MAX_MANIFEST_BYTES {
        return Err("it is too large".to_owned());
    }
    let text = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    let app: App = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    refusal(&app, stem).map_or(Ok(app), |why| Err(why.to_owned()))
}

/// Every usable app in a directory that fits this role: apps by name, then Settings, which is
/// always last. A bad file is logged and skipped, and so is anything past the limit.
fn load_from(dir: &Path, role: &str) -> Vec<App> {
    let mut paths: Vec<_> = std::fs::read_dir(dir)
        .map(|entries| entries.flatten().map(|entry| entry.path()).collect())
        .unwrap_or_default();
    paths.retain(|path| path.extension().is_some_and(|ext| ext == "json"));
    paths.sort();
    paths.truncate(MAX_APPS);
    let mut apps: Vec<App> = paths
        .iter()
        .filter_map(|path| {
            read_manifest(path)
                .map_err(|why| {
                    glib::g_warning!(LOG, "no tile for {}: {why}", path.display());
                })
                .ok()
        })
        .filter(|app| app.role == "any" || app.role == role)
        .collect();
    apps.sort_by_key(|app| (app.url.is_none(), app.name.to_lowercase()));
    apps
}

/// This machine's apps.
pub(crate) fn load(role: &str) -> Vec<App> {
    load_from(Path::new(APPS_DIR), role)
}

/// WebKit's content filter for one app: block everything, then allow its own origin, its WebSockets
/// to the same host and what it makes in memory. Regex metacharacters in the origin are escaped; the
/// rules run in order. Seen on the VM: without the second rule, notifications never connected.
pub(crate) fn content_filter(origin: &str, sign_in: Option<&str>) -> String {
    let escape = |origin: &str| origin.replace('.', "\\.");
    let escaped = escape(origin);
    let allow = |pattern: String| -> Value {
        json!({ "trigger": { "url-filter": pattern }, "action": { "type": "ignore-previous-rules" } })
    };
    let mut rules = vec![
        json!({ "trigger": { "url-filter": ".*" }, "action": { "type": "block" } }),
        allow(format!("^{escaped}/")),
        allow(format!("^{}/", escaped.replacen("https://", "wss://", 1))),
        allow("^blob:".to_owned()),
        allow("^data:".to_owned()),
    ];
    if let Some(sign_in) = sign_in {
        rules.push(allow(format!("^{}/", escape(sign_in))));
    }
    Value::Array(rules).to_string()
}

/// The state of each unit, in order, asked of systemd in one call.
pub(crate) fn unit_states(units: &[String]) -> Vec<String> {
    let args: Vec<&str> = std::iter::once("is-active")
        .chain(units.iter().map(String::as_str))
        .collect();
    // `is-active` exits non-zero when any unit isn't active, and its output is still the answer.
    let Some(done) = child::run("systemctl", &args, child::USUAL_LIMIT) else {
        return Vec::new();
    };
    String::from_utf8_lossy(&done.stdout)
        .lines()
        .map(str::to_owned)
        .collect()
}

/// A tile's plain words for its unit's state; nothing at all while it is running.
pub(crate) fn unit_words(state: &str) -> &'static str {
    match state {
        "active" => "",
        "activating" | "reloading" | "deactivating" => "Starting",
        "failed" => "Stopped with a problem",
        _ => "Not running",
    }
}

#[cfg(test)]
mod tests {
    use super::{content_filter, health_target, load_from, local_origin, unit_words};
    use std::path::PathBuf;

    const GOOD: &str = r#"{"id":"mail","name":"Mail","icon":"mail-symbolic","url":"https://127.0.0.1:8443/mail/","role":"main","unit":"mail.service"}"#;

    /// A directory of manifests that removes itself.
    struct Dir(PathBuf);

    impl Dir {
        /// Makes the directory with these files.
        fn with(name: &str, files: &[(&str, &str)]) -> Self {
            let path = std::env::temp_dir().join(format!("mb-apps-{}-{name}", std::process::id()));
            drop(std::fs::remove_dir_all(&path));
            drop(std::fs::create_dir_all(&path));
            for (file, text) in files {
                drop(std::fs::write(path.join(file), text));
            }
            Self(path)
        }
    }

    impl Drop for Dir {
        fn drop(&mut self) {
            drop(std::fs::remove_dir_all(&self.0));
        }
    }

    /// The names of the apps a directory yields for a role.
    fn names(dir: &Dir, role: &str) -> Vec<String> {
        load_from(&dir.0, role)
            .into_iter()
            .map(|app| app.name)
            .collect()
    }

    /// The owner's rule: a tile exists only if its manifest does, and it never breaks the desktop.
    #[test]
    fn a_missing_or_malformed_manifest_leaves_the_rest_working() {
        assert!(names(&Dir::with("empty", &[]), "main").is_empty());
        assert!(load_from(&PathBuf::from("/nonexistent/apps"), "main").is_empty());
        let dir = Dir::with(
            "bad",
            &[
                ("mail.json", GOOD),
                ("broken.json", "{ not json"),
                ("empty.json", ""),
                ("wrong.json", r#"{"id":"wrong","name":7}"#),
                ("notes.txt", GOOD),
                ("other.json", GOOD),
            ],
        );
        assert_eq!(names(&dir, "main"), ["Mail"]);
    }

    /// A URL off this machine would let a tile open anything, so it gets no tile at all.
    #[test]
    fn a_url_outside_loopback_is_refused() {
        for url in [
            "https://example.org/",
            "http://127.0.0.1:8443/",
            "https://127.0.0.1.example.org/",
            "https://127.0.0.1:8443@example.org/",
            "https://127.0.0.1:99999/",
            "https://127.0.0.1:8443",
            "file:///etc/passwd",
        ] {
            assert_eq!(local_origin(url), None, "{url}");
            let text = GOOD.replace("https://127.0.0.1:8443/mail/", url);
            assert!(
                names(&Dir::with("url", &[("mail.json", &text)]), "main").is_empty(),
                "{url}"
            );
        }
        assert_eq!(
            local_origin("https://127.0.0.1:8443/a/"),
            Some("https://127.0.0.1:8443")
        );
        assert_eq!(
            local_origin("https://127.0.0.1/"),
            Some("https://127.0.0.1")
        );
    }

    /// The one name allowed besides loopback, exactly: no other port, scheme or look-alike host.
    #[test]
    fn the_identity_provider_is_allowed_by_its_exact_origin_only() {
        assert_eq!(
            local_origin("https://idm.medbrains.local:9443/"),
            Some("https://idm.medbrains.local:9443")
        );
        assert_eq!(
            local_origin("https://idm.medbrains.local:9443/ui/profile"),
            Some("https://idm.medbrains.local:9443")
        );
        for url in [
            "https://idm.medbrains.local:9443",
            "https://idm.medbrains.local/",
            "https://idm.medbrains.local:443/",
            "https://idm.medbrains.local:9444/",
            "https://idm.medbrains.local:94430/",
            "http://idm.medbrains.local:9443/",
            "https://idm.medbrains.local:9443.evil.example/",
            "https://idm.medbrains.local:9443@evil.example/",
            "https://idm.medbrains.local.evil.example:9443/",
            "https://evil.example/https://idm.medbrains.local:9443/",
            "https://medbrains.local:9443/",
        ] {
            assert_eq!(local_origin(url), None, "{url}");
        }
    }

    #[test]
    fn a_tile_appears_only_on_a_machine_of_its_role() {
        let any = GOOD.replace("\"main\"", "\"any\"");
        let dir = Dir::with("role", &[("mail.json", GOOD)]);
        assert_eq!(names(&dir, "main"), ["Mail"]);
        assert!(names(&dir, "node").is_empty());
        assert_eq!(
            names(&Dir::with("any", &[("mail.json", &any)]), "node"),
            ["Mail"]
        );
        let invented = GOOD.replace("\"main\"", "\"root\"");
        assert!(names(&Dir::with("invented", &[("mail.json", &invented)]), "root").is_empty());
    }

    #[test]
    fn only_settings_may_have_no_url_and_it_is_listed_last() {
        let settings = r#"{"id":"settings","name":"Settings","icon":"preferences-system-symbolic","role":"any"}"#;
        let other = r#"{"id":"other","name":"Other","icon":"x","role":"any"}"#;
        let zed = GOOD
            .replace("\"Mail\"", "\"Zed\"")
            .replace("\"mail\"", "\"zed\"");
        let dir = Dir::with(
            "last",
            &[
                ("settings.json", settings),
                ("other.json", other),
                ("zed.json", &zed),
            ],
        );
        assert_eq!(names(&dir, "main"), ["Zed", "Settings"]);
    }

    #[test]
    fn a_manifest_cannot_reach_files_or_options_through_its_fields() {
        for (from, to) in [
            ("mail-symbolic", "/etc/passwd"),
            ("mail-symbolic", "/usr/share/medbrains/../../../etc/passwd"),
            ("mail.service", "--help"),
            ("\"id\":\"mail\"", "\"id\":\"../mail\""),
        ] {
            let text = GOOD.replace(from, to);
            assert!(
                names(&Dir::with("field", &[("mail.json", &text)]), "main").is_empty(),
                "{to}"
            );
        }
    }

    /// The navigation limit is per app: this app's origin must be the only site it allows.
    #[test]
    fn each_app_is_default_deny_and_allows_only_its_own_origin() {
        let text = content_filter("https://127.0.0.1:8443", None);
        let rules: serde_json::Value = serde_json::from_str(&text).unwrap_or_default();
        assert_eq!(rules[0]["trigger"]["url-filter"], ".*");
        assert_eq!(rules[0]["action"]["type"], "block");
        assert_eq!(
            rules[1]["trigger"]["url-filter"],
            "^https://127\\.0\\.0\\.1:8443/"
        );
        assert_eq!(
            rules[2]["trigger"]["url-filter"],
            "^wss://127\\.0\\.0\\.1:8443/"
        );
        assert_eq!(rules.as_array().map(Vec::len), Some(5));
    }

    /// An app may visit one more origin to sign in, and only one this file names.
    #[test]
    fn a_sign_in_origin_must_be_a_named_one_and_opens_only_that() {
        let with =
            |origin: &str| GOOD.replacen('{', &format!("{{\"sign_in_origin\":\"{origin}\","), 1);
        let good = with("https://idm.medbrains.local:9443");
        assert_eq!(
            names(&Dir::with("signin", &[("mail.json", &good)]), "main"),
            ["Mail"]
        );
        let bad = with("https://evil.example");
        assert!(names(&Dir::with("badsignin", &[("mail.json", &bad)]), "main").is_empty());
        assert_eq!(
            local_origin("https://screen.medbrains.local:8443/dashboard"),
            Some("https://screen.medbrains.local:8443")
        );
        assert_eq!(
            local_origin("https://screen.medbrains.local:8443.evil.example/"),
            None
        );
        let text = content_filter(
            "https://127.0.0.1:8443",
            Some("https://idm.medbrains.local:9443"),
        );
        let rules: serde_json::Value = serde_json::from_str(&text).unwrap_or_default();
        assert_eq!(
            rules[5]["trigger"]["url-filter"],
            "^https://idm\\.medbrains\\.local:9443/"
        );
        assert_eq!(rules.as_array().map(Vec::len), Some(6));
    }

    #[test]
    fn health_is_plain_http_on_this_machine_and_states_read_plainly() {
        assert_eq!(
            health_target("http://127.0.0.1:3000/api/health"),
            Some(("127.0.0.1:3000".to_owned(), "/api/health".to_owned()))
        );
        assert_eq!(health_target("http://10.0.0.1:3000/x"), None);
        assert_eq!(health_target("https://127.0.0.1:3000/x"), None);
        assert_eq!(unit_words("active"), "");
        assert_eq!(unit_words("inactive"), "Not running");
        assert_eq!(unit_words("failed"), "Stopped with a problem");
    }
}
