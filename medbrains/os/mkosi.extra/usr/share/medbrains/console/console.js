// The status page: shown until the app can take over, and whenever the server stops
// answering. It is written once and never reloads. Each poll changes only the text
// that differs; if nothing differs it touches nothing, so nothing is repainted.
"use strict";

const APP_URL = "https://127.0.0.1:8443/";
// Both must answer. The front end alone is not enough: it answers 502 with the server down,
// and to this page (no-cors, opaque) a 502 looks the same as a 200.
const PROBE_URLS = [APP_URL + "api/health", "http://127.0.0.1:3000/api/health"];
const STATUS_SCRIPT = "file:///run/medbrains-console/status.js";
const POLL_MS = 5000;
const PROBE_TIMEOUT_MS = 3000;
const MAX_DWELL_S = 300;

/** How long to stay after recovering; 0 on boot, doubling with each return so a flapping server cannot bounce the screen. */
function dwellSeconds() {
  const attempt = Number(new URLSearchParams(location.search).get("attempt")) || 0;
  return attempt === 0 ? 0 : Math.min(10 * 2 ** (attempt - 1), MAX_DWELL_S);
}

// True once the server has answered, or if the app sent us here: silence then means an outage.
let hasAnswered = dwellSeconds() > 0;
let healthySince = null;

const byId = (id) => document.getElementById(id);

/** Sets an element's text only if it differs, so an unchanged value causes no paint. */
function setText(id, value) {
  const el = byId(id);
  if (el.textContent !== value) el.textContent = value;
}

/** Shows the state in words and colour; the words alone are enough to read it. */
function setState(kind, text, lead) {
  const el = byId("state");
  const cls = "state " + kind;
  if (el.className !== cls) el.className = cls;
  setText("state", text);
  setText("lead", lead);
}

/** True only if the local front end and the server behind it both accept a connection. */
async function probeHealth() {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), PROBE_TIMEOUT_MS);
  const probe = (url) => fetch(url, { mode: "no-cors", cache: "no-store", signal: ctl.signal });
  try {
    await Promise.all(PROBE_URLS.map(probe));
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Loads status.js, which console-status rewrites only when it changes. A script tag,
 * because WebKit cannot fetch file:// URLs and the flag that would allow it lets a
 * page read any local file. Resolves to null if it is missing or unreadable.
 */
function loadStatus() {
  return new Promise((resolve) => {
    const tag = document.createElement("script");
    window.MB_STATUS = null;
    tag.src = STATUS_SCRIPT + "?" + Date.now();
    tag.onload = () => { tag.remove(); resolve(window.MB_STATUS); };
    tag.onerror = () => { tag.remove(); resolve(null); };
    document.head.appendChild(tag);
  });
}

/** Shows or hides the first sign-in panel and moves keyboard focus to Continue when it appears. */
function renderFirstSignIn(first) {
  const panel = byId("first");
  const show = Boolean(first && first.password);
  if (panel.hidden === show) {
    panel.hidden = !show;
    document.body.classList.toggle("idle", !show);
    if (show) byId("continue").focus();
  }
  if (show) {
    setText("user", first.user);
    setText("password", first.password);
  }
}

/** Rebuilds the address list only when it differs. */
function renderAddresses(status) {
  const lines = status ? ["https://" + status.hostname + ".local", ...status.addresses.map((a) => "https://" + a)] : [];
  const list = byId("addr");
  if (Array.from(list.children).map((li) => li.textContent).join() === lines.join()) return;
  list.replaceChildren(...lines.map((line) => {
    const li = document.createElement("li");
    li.textContent = line;
    return li;
  }));
}

/** Words for the server not answering: starting up on a first load, an outage after that. */
function renderNotAnswering(status) {
  if (hasAnswered) {
    setState("attention", "Not answering", "MedBrains has stopped answering. This screen goes back to it by itself when it recovers. If it stays here, call your system administrator.");
  } else {
    setState("starting", "Starting", "Setting up. The first start takes a few minutes; there is nothing you need to do.");
  }
  if (status && status.system === "degraded") {
    setState("attention", "Attention needed", "A service has stopped. Call your system administrator.");
  }
}

/** One poll: read both signals, update what differs, hand over to the app when it is time. */
async function poll() {
  const [healthy, status] = await Promise.all([probeHealth(), loadStatus()]);
  renderAddresses(status);
  setText("host", status ? status.hostname : "");
  setText("system", status ? "System: " + status.system : "System: unknown");
  setText("disk", status && status.disk === "unencrypted-chosen" ? "This disk is not encrypted" : "");
  renderFirstSignIn(healthy && status ? status.firstSignIn : null);

  if (!status) {
    setState("attention", "Status unknown", "This screen cannot read the system status. Call your system administrator.");
    healthySince = null;
    return;
  }
  if (!healthy) {
    renderNotAnswering(status);
    healthySince = null;
    return;
  }
  hasAnswered = true;
  healthySince ??= Date.now();
  setState("ready", "Ready", status.firstSignIn
    ? "Sign in on this screen, or from a browser on another computer."
    : "Opening MedBrains.");
  if (!status.firstSignIn && (Date.now() - healthySince) / 1000 >= dwellSeconds()) openApp();
}

/** Hands this window over to the app, replacing this page in history. */
function openApp() {
  location.replace(APP_URL);
}

// Keeps this page in history, so Alt+Left comes back to the first sign-in details.
byId("continue").addEventListener("click", () => location.assign(APP_URL));
poll();
setInterval(poll, POLL_MS);
