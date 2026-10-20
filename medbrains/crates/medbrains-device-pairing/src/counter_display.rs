//! The customer display at a counter (#4883): what it shows, and the
//! in-process hub that carries it from the cashier's drawer to the screen.
//!
//! No major soundbox lets a third party push an announcement
//! (`docs/research-pos-payments-2026-10.md` §7), so a counter shows the
//! patient their payment on a screen of its own. The cashier's drawer sends
//! one event per change; the server folds them into one snapshot per counter
//! and the display only ever renders a snapshot. A display that reconnects,
//! or falls back to polling, reads the same snapshot — never a replay.
//!
//! Privacy is enforced here, not trusted from the drawer: the patient's name
//! is cut to a first name and an initial, item lines are bounded, and only a
//! UPI URI or an `https` image may become the QR.

use std::collections::HashMap;
use std::sync::{LazyLock, Mutex, PoisonError};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tokio::sync::watch;
use uuid::Uuid;

/// How long "Paid" stays on a screen read back later (poll or reconnect).
/// The live screen returns to idle on its own sooner; this stops a display
/// that was offline from coming back to an old "Paid".
pub const PAID_VISIBLE: Duration = Duration::from_secs(20);
/// A session nobody touched for this long is abandoned, not in progress.
pub const SESSION_STALE: Duration = Duration::from_secs(10 * 60);
/// A display that polled this recently counts as connected.
pub const POLL_FRESH: Duration = Duration::from_secs(15);

const MAX_LINES: usize = 12;
const MAX_LABEL: usize = 40;
const MAX_FIRST_NAME: usize = 20;
const MAX_QR_TEXT: usize = 1024;
/// ₹10 crore in paise: anything above is a typo, not a counter payment.
const MAX_PAISE: i64 = 1_000_000_000;

const TENDERS: [&str; 7] = ["cash", "card", "upi", "online", "advance", "credit", "link"];
const CARD_STATUSES: [&str; 5] = ["waiting", "approved", "declined", "timed_out", "cancelled"];

/// One change in the drawer. Every event but `session_start` names the
/// session it belongs to; one for any other session is dropped, so a late
/// event from the last patient never lands on this one's screen.
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum DisplayEvent {
    SessionStart {
        session: Uuid,
        patient_name: Option<String>,
    },
    Items {
        session: Uuid,
        lines: Vec<DisplayLine>,
        total_due_paise: i64,
    },
    TenderSelected {
        session: Uuid,
        tender: String,
        amount_paise: i64,
    },
    QrShown {
        session: Uuid,
        amount_paise: i64,
        upi_uri: Option<String>,
        image_url: Option<String>,
        /// Unix seconds.
        close_by: Option<i64>,
    },
    CardStatus {
        session: Uuid,
        status: String,
        amount_paise: i64,
    },
    Paid {
        session: Uuid,
        amount_paise: i64,
        change_paise: Option<i64>,
    },
    Cleared {
        session: Uuid,
    },
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct DisplayLine {
    pub label: String,
    pub amount_paise: i64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct DisplayQr {
    pub upi_uri: Option<String>,
    pub image_url: Option<String>,
    pub close_by: Option<i64>,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum Phase {
    #[default]
    Idle,
    Session,
    Qr,
    Card,
    Paid,
}

/// Everything a display may show. Nothing else about the patient exists here.
#[derive(Debug, Clone, Serialize, PartialEq, Eq, Default)]
pub struct DisplayState {
    /// Bumped on every change, so a display can tell a new "Paid" from one it
    /// already announced.
    pub seq: u64,
    pub session: Option<Uuid>,
    pub phase: Phase,
    pub patient: Option<String>,
    pub lines: Vec<DisplayLine>,
    pub total_due_paise: i64,
    pub tender: Option<String>,
    pub amount_paise: i64,
    pub qr: Option<DisplayQr>,
    pub card_status: Option<String>,
    pub change_paise: Option<i64>,
}

/// Why an event was refused. Answered as 400 with this text.
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum Rejected {
    #[error("amount out of range")]
    Amount,
    #[error("unknown way of paying")]
    Tender,
    #[error("unknown card status")]
    CardStatus,
    #[error("the QR must be a upi:// link or an https image")]
    Qr,
}

/// "Ravi Kumar Sharma" → "Ravi S.". A first name and an initial is what the
/// patient recognises and what the queue behind them may see; no more.
#[must_use]
pub fn short_name(full: &str) -> Option<String> {
    let mut words = full.split_whitespace();
    let first: String = words.next()?.chars().take(MAX_FIRST_NAME).collect();
    Some(match words.last().and_then(|w| w.chars().next()) {
        Some(initial) => format!("{first} {}.", initial.to_uppercase()),
        None => first,
    })
}

fn paise(value: i64) -> Result<i64, Rejected> {
    if (0..=MAX_PAISE).contains(&value) {
        Ok(value)
    } else {
        Err(Rejected::Amount)
    }
}

fn bounded_lines(lines: Vec<DisplayLine>) -> Result<Vec<DisplayLine>, Rejected> {
    lines
        .into_iter()
        .take(MAX_LINES)
        .map(|l| {
            Ok(DisplayLine {
                label: l.label.trim().chars().take(MAX_LABEL).collect(),
                amount_paise: paise(l.amount_paise)?,
            })
        })
        .collect()
}

fn qr_text(value: Option<String>, scheme: &str) -> Result<Option<String>, Rejected> {
    match value {
        None => Ok(None),
        Some(v) if v.starts_with(scheme) && v.len() <= MAX_QR_TEXT => Ok(Some(v)),
        Some(_) => Err(Rejected::Qr),
    }
}

const fn session_of(event: &DisplayEvent) -> Uuid {
    match event {
        DisplayEvent::SessionStart { session, .. }
        | DisplayEvent::Items { session, .. }
        | DisplayEvent::TenderSelected { session, .. }
        | DisplayEvent::QrShown { session, .. }
        | DisplayEvent::CardStatus { session, .. }
        | DisplayEvent::Paid { session, .. }
        | DisplayEvent::Cleared { session } => *session,
    }
}

/// Fold one event into the counter's snapshot. `Ok(None)` is an event for
/// another session: nothing changes.
///
/// # Errors
///
/// `Rejected` when the event carries something a display must not show.
pub fn apply(state: &DisplayState, event: DisplayEvent) -> Result<Option<DisplayState>, Rejected> {
    let session = session_of(&event);
    let same = state.session == Some(session);
    // A start for the session already showing only renames it (the drawer
    // learns the name after it opens); a start for a new one wipes the last.
    let mut next = if same {
        state.clone()
    } else if let DisplayEvent::SessionStart { .. } = event {
        DisplayState::default()
    } else {
        return Ok(None);
    };
    next.seq = state.seq + 1;
    next.session = Some(session);
    match event {
        DisplayEvent::SessionStart { patient_name, .. } => {
            if next.phase == Phase::Idle {
                next.phase = Phase::Session;
            }
            next.patient = patient_name.as_deref().and_then(short_name);
        }
        DisplayEvent::Items {
            lines,
            total_due_paise,
            ..
        } => {
            next.lines = bounded_lines(lines)?;
            next.total_due_paise = paise(total_due_paise)?;
        }
        DisplayEvent::TenderSelected {
            tender,
            amount_paise,
            ..
        } => {
            if !TENDERS.contains(&tender.as_str()) {
                return Err(Rejected::Tender);
            }
            next.phase = Phase::Session;
            next.tender = Some(tender);
            next.amount_paise = paise(amount_paise)?;
            next.qr = None;
            next.card_status = None;
        }
        DisplayEvent::QrShown {
            amount_paise,
            upi_uri,
            image_url,
            close_by,
            ..
        } => {
            let upi_uri = qr_text(upi_uri, "upi://")?;
            let image_url = qr_text(image_url, "https://")?;
            if upi_uri.is_none() && image_url.is_none() {
                return Err(Rejected::Qr);
            }
            next.phase = Phase::Qr;
            next.amount_paise = paise(amount_paise)?;
            next.qr = Some(DisplayQr {
                upi_uri,
                image_url,
                close_by,
            });
        }
        DisplayEvent::CardStatus {
            status,
            amount_paise,
            ..
        } => {
            if !CARD_STATUSES.contains(&status.as_str()) {
                return Err(Rejected::CardStatus);
            }
            next.phase = Phase::Card;
            next.amount_paise = paise(amount_paise)?;
            next.card_status = Some(status);
        }
        DisplayEvent::Paid {
            amount_paise,
            change_paise,
            ..
        } => {
            next.phase = Phase::Paid;
            next.amount_paise = paise(amount_paise)?;
            next.change_paise = change_paise.map(paise).transpose()?;
            next.qr = None;
        }
        DisplayEvent::Cleared { .. } => {
            return Ok(Some(DisplayState {
                seq: next.seq,
                ..DisplayState::default()
            }));
        }
    }
    Ok(Some(next))
}

/// What a display reading the snapshot `age` after its last change may see:
/// an old "Paid" or an abandoned session reads as idle.
#[must_use]
pub fn visible(state: &DisplayState, age: Duration) -> DisplayState {
    let expired = match state.phase {
        Phase::Idle => false,
        Phase::Paid => age > PAID_VISIBLE,
        _ => age > SESSION_STALE,
    };
    if expired {
        DisplayState {
            seq: state.seq,
            ..DisplayState::default()
        }
    } else {
        state.clone()
    }
}

/// One counter's live snapshot and when it last changed.
#[derive(Debug, Clone)]
pub struct Stamped {
    pub state: DisplayState,
    pub at: Instant,
}

#[derive(Debug)]
struct Counter {
    tx: watch::Sender<Stamped>,
    last_poll: Option<Instant>,
}

/// Snapshots by (tenant, counter). Bounded by the number of counters that
/// ever published or were watched — one small entry each.
// ponytail: in-process, like the queue and notification sockets beside it;
// a second app instance needs a shared bus (Postgres NOTIFY) before it can
// serve displays.
static HUB: LazyLock<Mutex<HashMap<(Uuid, Uuid), Counter>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

fn with_counter<T>(tenant: Uuid, station: Uuid, f: impl FnOnce(&mut Counter) -> T) -> T {
    let mut hub = HUB.lock().unwrap_or_else(PoisonError::into_inner);
    let counter = hub.entry((tenant, station)).or_insert_with(|| Counter {
        tx: watch::channel(Stamped {
            state: DisplayState::default(),
            at: Instant::now(),
        })
        .0,
        last_poll: None,
    });
    f(counter)
}

/// Apply an event to a counter and wake its displays. Returns the new
/// sequence number and whether a display is connected.
///
/// # Errors
///
/// `Rejected` from [`apply`]; the snapshot is left as it was.
pub fn publish(tenant: Uuid, station: Uuid, event: DisplayEvent) -> Result<(u64, bool), Rejected> {
    with_counter(tenant, station, |c| {
        let current = c.tx.borrow().state.clone();
        let seq = match apply(&current, event)? {
            Some(next) => {
                let seq = next.seq;
                c.tx.send_replace(Stamped {
                    state: next,
                    at: Instant::now(),
                });
                seq
            }
            None => current.seq,
        };
        Ok((seq, connected(c)))
    })
}

fn connected(c: &Counter) -> bool {
    c.tx.receiver_count() > 0 || c.last_poll.is_some_and(|t| t.elapsed() <= POLL_FRESH)
}

/// Whether a display is reading this counter now (socket open or polled).
#[must_use]
pub fn is_connected(tenant: Uuid, station: Uuid) -> bool {
    with_counter(tenant, station, |c| connected(c))
}

/// A polling display's read: the visible snapshot, and it counts as seen.
#[must_use]
pub fn poll(tenant: Uuid, station: Uuid) -> DisplayState {
    with_counter(tenant, station, |c| {
        c.last_poll = Some(Instant::now());
        let stamped = c.tx.borrow();
        visible(&stamped.state, stamped.at.elapsed())
    })
}

/// A socket's subscription to one counter.
#[must_use]
pub fn subscribe(tenant: Uuid, station: Uuid) -> watch::Receiver<Stamped> {
    with_counter(tenant, station, |c| c.tx.subscribe())
}

#[cfg(test)]
#[path = "counter_display_tests.rs"]
mod tests;
