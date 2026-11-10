//! A hospital's early-warning policy: how often to observe at each band,
//! which bands call for escalation, and how long an escalation may wait for
//! acknowledgement before it goes further.
//!
//! The NEWS2 frequencies are the minimums of RCP NEWS2 Chart 4 — 0:
//! 12-hourly; 1–4: 4–6-hourly (the 4-hour end); a 3 in one parameter:
//! hourly; 5–6: hourly; 7+: continuous monitoring, charted here as a full
//! set every 15 minutes. HQSC leaves PEWS frequencies to local policy, and
//! the MEOWS sources set none, so their defaults are this system's safe
//! starting points, to be set per hospital. Acknowledgement windows are
//! likewise hospital policy (defaults 30 minutes urgent, 15 emergency).

use serde::{Deserialize, Serialize};

use super::{Band, EwsScore, Tool};

/// Minutes to the next full set of observations, per band.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct BandMinutes {
    pub routine: i32,
    pub low: i32,
    pub low_medium: i32,
    pub urgent: i32,
    pub emergency: i32,
}

impl BandMinutes {
    #[must_use]
    pub const fn get(&self, band: Band) -> i32 {
        match band {
            Band::Routine => self.routine,
            Band::Low => self.low,
            Band::LowMedium => self.low_medium,
            Band::Urgent => self.urgent,
            Band::Emergency => self.emergency,
        }
    }

    const fn ordered(&self) -> [i32; 5] {
        [
            self.routine,
            self.low,
            self.low_medium,
            self.urgent,
            self.emergency,
        ]
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EwsPolicy {
    pub news2: BandMinutes,
    pub pews: BandMinutes,
    pub meows: BandMinutes,
    /// An incomplete set is repeated within this many minutes at most.
    pub incomplete_max_minutes: i32,
    /// Bands that notify the nurse in charge and the duty doctor.
    pub escalate_bands: Vec<Band>,
    /// Minutes an urgent escalation may wait for acknowledgement.
    pub ack_minutes_urgent: i32,
    /// Minutes an emergency escalation may wait for acknowledgement.
    pub ack_minutes_emergency: i32,
    /// How many times an unacknowledged escalation goes further.
    pub max_escalation_levels: i32,
}

impl Default for EwsPolicy {
    fn default() -> Self {
        Self {
            news2: BandMinutes {
                routine: 720,
                low: 240,
                low_medium: 60,
                urgent: 60,
                emergency: 15,
            },
            pews: BandMinutes {
                routine: 240,
                low: 120,
                low_medium: 60,
                urgent: 30,
                emergency: 15,
            },
            meows: BandMinutes {
                routine: 240,
                low: 60,
                low_medium: 60,
                urgent: 30,
                emergency: 15,
            },
            incomplete_max_minutes: 60,
            escalate_bands: vec![Band::Urgent, Band::Emergency],
            ack_minutes_urgent: 30,
            ack_minutes_emergency: 15,
            max_escalation_levels: 3,
        }
    }
}

/// Why a hospital's policy was refused.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PolicyError(pub String);

impl std::fmt::Display for PolicyError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

impl EwsPolicy {
    #[must_use]
    pub const fn minutes(&self, tool: Tool) -> &BandMinutes {
        match tool {
            Tool::News2 => &self.news2,
            Tool::Pews => &self.pews,
            Tool::Meows => &self.meows,
        }
    }

    /// Minutes to the next full set for this score. An incomplete set never
    /// waits longer than `incomplete_max_minutes`.
    #[must_use]
    pub fn next_due_minutes(&self, s: &EwsScore) -> i32 {
        let m = self.minutes(s.tool).get(s.band);
        if s.incomplete {
            m.min(self.incomplete_max_minutes)
        } else {
            m
        }
    }

    #[must_use]
    pub fn escalates(&self, band: Band) -> bool {
        self.escalate_bands.contains(&band)
    }

    #[must_use]
    pub const fn ack_minutes(&self, band: Band) -> i32 {
        if matches!(band, Band::Emergency) {
            self.ack_minutes_emergency
        } else {
            self.ack_minutes_urgent
        }
    }

    /// Refuse a policy that would make a sicker patient wait longer, drop
    /// the emergency escalation, or stretch any interval past a day.
    ///
    /// # Errors
    /// The first rule the policy breaks, in words an administrator can fix.
    pub fn validate(&self) -> Result<(), PolicyError> {
        for (tool, m) in [
            ("NEWS2", &self.news2),
            ("PEWS", &self.pews),
            ("MEOWS", &self.meows),
        ] {
            let o = m.ordered();
            if o.iter().any(|v| !(5..=1440).contains(v)) {
                return Err(PolicyError(format!(
                    "{tool}: every interval must be 5 to 1440 minutes"
                )));
            }
            if o.windows(2).any(|w| w[1] > w[0]) {
                return Err(PolicyError(format!(
                    "{tool}: a higher band cannot be observed less often than a lower one"
                )));
            }
        }
        if !(5..=240).contains(&self.incomplete_max_minutes) {
            return Err(PolicyError(
                "An incomplete set must be repeated within 5 to 240 minutes".into(),
            ));
        }
        if !self.escalate_bands.contains(&Band::Emergency) {
            return Err(PolicyError(
                "The emergency band must always escalate".into(),
            ));
        }
        if self.escalate_bands.iter().any(|b| *b < Band::LowMedium) {
            return Err(PolicyError(
                "Only low-medium bands and above can escalate".into(),
            ));
        }
        let ack_ok = |m: i32| (5..=120).contains(&m);
        if !ack_ok(self.ack_minutes_urgent) || !ack_ok(self.ack_minutes_emergency) {
            return Err(PolicyError(
                "Acknowledgement windows must be 5 to 120 minutes".into(),
            ));
        }
        if self.ack_minutes_emergency > self.ack_minutes_urgent {
            return Err(PolicyError(
                "An emergency cannot wait longer than an urgent review".into(),
            ));
        }
        if !(1..=5).contains(&self.max_escalation_levels) {
            return Err(PolicyError("Escalation goes 1 to 5 levels further".into()));
        }
        Ok(())
    }
}
