//! The telephony port.
//!
//! FreePBX is a web front end over Asterisk, and Asterisk offers four ways in:
//! **AMI** (a socket of live channel events), **ARI** (REST plus a WebSocket),
//! **AGI** (a hook inside the dialplan) and the **CDR/CEL** tables it writes
//! after the fact. Only the first two are fast enough for a screen-pop — a CDR
//! row lands when the call ends, which is the one moment the agent no longer
//! needs it.
//!
//! None of that appears below, on purpose.
//!
//! ## Why this module has no network code
//!
//! The specification says to buy telephony before owning it: a misconfigured
//! Asterisk means dropped OPD calls and toll-fraud exposure, and neither is a
//! good week two. But "buy it" and "self-host FreePBX" are the same decision
//! made twice, and the module should not have to be rewritten when it flips.
//!
//! So the rest of the crate consumes [`CallEvent`] and knows nothing else. A
//! FreePBX adapter turns AMI's `Newchannel` / `Dial` / `Bridge` / `Hangup`
//! into these; an Exotel adapter turns their webhook into the same shape. The
//! pipeline, the screen-pop and the missed-call count are written once.
//!
//! ## What the adapter must get right
//!
//! - **`caller_number` arrives raw.** Asterisk gives whatever the carrier sent
//!   — `09840012345`, `+919840012345`, sometimes `Anonymous`. Normalisation
//!   belongs at ingestion, in [`crate::phone`], not in the adapter and not at
//!   read time.
//! - **Answered is not the absence of a hangup.** In Asterisk a call is
//!   answered when the channel bridges. A `Hangup` with no preceding `Bridge`
//!   is the missed call this product is sold on, and it is the event most
//!   easily lost.
//! - **`external_ref` is the channel's unique id** (`uniqueid`, or `linkedid`
//!   where a transfer splits the channel). It is what makes the recording, the
//!   CDR row and the interaction the same call three systems later.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// What happened to a call, in the only vocabulary this crate knows.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CallOutcome {
    /// Bridged to an agent.
    Answered,
    /// Rang out. The number the hospital is buying this product to fix.
    NoAnswer,
    /// Caller hung up while queued.
    Abandoned,
    /// Rejected before ringing — engaged, blocked, or out of hours.
    Rejected,
}

impl CallOutcome {
    /// Whether a human spoke to the caller.
    #[must_use]
    pub const fn answered(self) -> bool {
        matches!(self, Self::Answered)
    }

    /// Whether this call should raise a callback task.
    ///
    /// A rejected call is usually the switch, not a lost enquiry; an abandoned
    /// one is somebody who waited and gave up, which is the most winnable lead
    /// in the queue.
    #[must_use]
    pub const fn needs_callback(self) -> bool {
        matches!(self, Self::NoAnswer | Self::Abandoned)
    }
}

/// Which way the call went.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CallDirection {
    Inbound,
    Outbound,
}

impl CallDirection {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Inbound => "inbound",
            Self::Outbound => "outbound",
        }
    }
}

/// One completed call, from whichever telephony system produced it.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallEvent {
    /// The channel's unique id — Asterisk `uniqueid`/`linkedid`, or the
    /// provider's call sid. Carried through so the recording and the CDR can
    /// be matched to this interaction later.
    pub external_ref: String,
    pub direction: CallDirection,
    /// Raw, as the carrier sent it. Normalised at ingestion, not here.
    pub caller_number: String,
    /// The DID or queue dialled, which is how a call maps to a specialty.
    pub dialled_number: Option<String>,
    pub outcome: CallOutcome,
    pub started_at: DateTime<Utc>,
    pub duration_secs: Option<i32>,
    /// The agent who took it, if the adapter can resolve one.
    pub agent_id: Option<uuid::Uuid>,
    /// Where the recording landed. FreePBX writes to disk; a provider gives a
    /// URL. Either way it is held behind `marketing.interactions.play_recording`.
    pub recording_ref: Option<String>,
}

impl CallEvent {
    /// The interaction row's `kind`.
    #[must_use]
    pub const fn kind(&self) -> &'static str {
        "call"
    }
}

#[cfg(test)]
mod tests {
    use super::{CallDirection, CallOutcome};

    #[test]
    fn only_an_answered_call_counts_as_answered() {
        assert!(CallOutcome::Answered.answered());
        for missed in [CallOutcome::NoAnswer, CallOutcome::Abandoned, CallOutcome::Rejected] {
            assert!(!missed.answered(), "{missed:?}");
        }
    }

    #[test]
    fn a_rejected_call_does_not_raise_a_callback_but_an_abandoned_one_does() {
        // Somebody who queued and gave up is a lead. An engaged tone is the
        // switch, and chasing it fills the callback list with noise.
        assert!(CallOutcome::Abandoned.needs_callback());
        assert!(CallOutcome::NoAnswer.needs_callback());
        assert!(!CallOutcome::Rejected.needs_callback());
        assert!(!CallOutcome::Answered.needs_callback());
    }

    #[test]
    fn direction_matches_the_column_the_missed_call_index_filters_on() {
        // 0975_marketing.sql indexes WHERE direction = 'inbound'.
        assert_eq!(CallDirection::Inbound.as_str(), "inbound");
        assert_eq!(CallDirection::Outbound.as_str(), "outbound");
    }
}
