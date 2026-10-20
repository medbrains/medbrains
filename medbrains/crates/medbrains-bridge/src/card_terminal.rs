//! Card machines wired to this PC (#4874): take the card sales MedBrains
//! queues for them, run each on the machine, and report how it went.
//!
//! Each machine is driven through a [`CardMachine`] adapter. Real ECR
//! protocols (a brand's commands over USB-serial or Bluetooth SPP) plug in
//! here one brand at a time; today there is the [`Simulator`], a pretend
//! machine that answers the way it is configured to.
//!
//! One poll is the heartbeat too: it tells MedBrains which machines answer,
//! and MedBrains hands back the sales and cancels waiting for them.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use anyhow::Result;
use async_trait::async_trait;
use serde::Deserialize;
use serde_json::json;
use tokio::sync::Notify;
use tracing::{info, warn};

use crate::config::{BridgeConfig, CardTerminalConfig};
use crate::ingest::authed;

/// What the machine did with the card.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Outcome {
    Approved {
        reference: String,
        approved_paise: Option<i64>,
        card_last4: Option<String>,
        auth_code: Option<String>,
    },
    Declined(String),
    TimedOut,
    Cancelled,
}

#[async_trait]
pub trait CardMachine: Send + Sync {
    /// Is the machine there and answering?
    async fn ping(&self) -> Result<()>;
    /// Run a sale; `cancel` fires if the counter cancels it meanwhile.
    async fn sale(
        &self,
        amount_paise: i64,
        reference: &str,
        cancel: Arc<Notify>,
    ) -> Result<Outcome>;
}

/// A pretend machine: after `delay` it answers `outcome` (approve, decline,
/// timeout), unless cancelled first.
#[derive(Debug)]
pub struct Simulator {
    pub outcome: String,
    pub delay: Duration,
}

#[async_trait]
impl CardMachine for Simulator {
    async fn ping(&self) -> Result<()> {
        Ok(())
    }

    async fn sale(
        &self,
        amount_paise: i64,
        reference: &str,
        cancel: Arc<Notify>,
    ) -> Result<Outcome> {
        tokio::select! {
            () = cancel.notified() => Ok(Outcome::Cancelled),
            () = tokio::time::sleep(self.delay) => Ok(match self.outcome.as_str() {
                "decline" => Outcome::Declined("Declined by the bank (bridge simulator)".to_owned()),
                "timeout" => Outcome::TimedOut,
                _ => Outcome::Approved {
                    reference: format!("BRSIM-{}", &reference[..8.min(reference.len())]),
                    approved_paise: Some(amount_paise),
                    card_last4: Some("4242".to_owned()),
                    auth_code: Some("BR0K01".to_owned()),
                },
            }),
        }
    }
}

/// The adapter for a configured machine; `None` for one this bridge cannot drive yet.
pub fn adapter_for(t: &CardTerminalConfig) -> Option<Arc<dyn CardMachine>> {
    match t.adapter.as_str() {
        "simulator" => Some(Arc::new(Simulator {
            outcome: t
                .simulator_outcome
                .clone()
                .unwrap_or_else(|| "approve".to_owned()),
            delay: Duration::from_secs(t.simulator_delay_secs.unwrap_or(3)),
        })),
        _ => None,
    }
}

#[derive(Debug, Deserialize)]
struct Job {
    job_id: String,
    action: String,
    terminal_id: String,
    amount_paise: i64,
}

fn result_body(outcome: &Outcome) -> serde_json::Value {
    match outcome {
        Outcome::Approved {
            reference,
            approved_paise,
            card_last4,
            auth_code,
        } => json!({
            "outcome": "approved", "reference": reference, "approved_paise": approved_paise,
            "card_last4": card_last4, "auth_code": auth_code }),
        Outcome::Declined(why) => json!({ "outcome": "declined", "message": why }),
        Outcome::TimedOut => json!({ "outcome": "timed_out" }),
        Outcome::Cancelled => json!({ "outcome": "cancelled" }),
    }
}

async fn report(
    client: &reqwest::Client,
    cfg: &BridgeConfig,
    job: &str,
    body: &serde_json::Value,
) -> Result<()> {
    authed(
        client.post(format!(
            "{}/api/payments/terminal-jobs/{job}/result",
            cfg.api_base
        )),
        cfg,
    )
    .json(body)
    .send()
    .await?
    .error_for_status()?;
    Ok(())
}

/// Sales running now, by terminal, so a cancel can reach them.
type Running = Arc<Mutex<HashMap<String, Arc<Notify>>>>;

/// Run one sale on its machine and report it, waiting first.
async fn run_sale(
    client: reqwest::Client,
    cfg: BridgeConfig,
    machine: Arc<dyn CardMachine>,
    job: Job,
    running: Running,
) {
    let cancel = Arc::new(Notify::new());
    if let Ok(mut r) = running.lock() {
        r.insert(job.terminal_id.clone(), Arc::clone(&cancel));
    }
    let waiting = report(&client, &cfg, &job.job_id, &json!({ "outcome": "waiting" })).await;
    if let Err(e) = waiting {
        warn!(job = %job.job_id, error = %e, "could not say the sale reached the machine");
    }
    let outcome = machine
        .sale(job.amount_paise, &job.job_id, cancel)
        .await
        .unwrap_or_else(|e| Outcome::Declined(format!("The machine failed: {e:#}")));
    if let Ok(mut r) = running.lock() {
        r.remove(&job.terminal_id);
    }
    // Retried: an approval that never reaches MedBrains is money off the books.
    for attempt in 1..=5u64 {
        match report(&client, &cfg, &job.job_id, &result_body(&outcome)).await {
            Ok(()) => return,
            Err(e) => {
                warn!(job = %job.job_id, attempt, error = %e, "card result not delivered — retrying")
            }
        }
        tokio::time::sleep(Duration::from_secs(attempt * 2)).await;
    }
}

/// One poll: report each machine's health, take jobs, start them.
pub async fn poll_once(
    client: &reqwest::Client,
    cfg: &BridgeConfig,
    running: &Running,
) -> Result<usize> {
    let machines: HashMap<String, Arc<dyn CardMachine>> = cfg
        .card_terminals
        .iter()
        .flatten()
        .filter_map(|t| adapter_for(t).map(|m| (t.id.clone(), m)))
        .collect();
    let mut health = Vec::with_capacity(machines.len());
    for (id, m) in &machines {
        let answered = m.ping().await;
        health.push(json!({ "terminal_id": id, "online": answered.is_ok(),
                            "error": answered.err().map(|e| format!("{e:#}")) }));
    }
    let jobs: Vec<Job> = authed(
        client.post(format!("{}/api/payments/terminal-jobs/claim", cfg.api_base)),
        cfg,
    )
    .json(&json!({ "terminals": health }))
    .send()
    .await?
    .error_for_status()?
    .json()
    .await?;
    let taken = jobs.len();
    for job in jobs {
        if job.action == "cancel" {
            let found = running
                .lock()
                .ok()
                .and_then(|r| r.get(&job.terminal_id).cloned());
            match found {
                Some(cancel) => cancel.notify_one(),
                None => report(client, cfg, &job.job_id, &result_body(&Outcome::Cancelled)).await?,
            }
            continue;
        }
        let Some(machine) = machines.get(&job.terminal_id).cloned() else {
            report(
                client,
                cfg,
                &job.job_id,
                &json!({ "outcome": "declined",
                "message": "This bridge has no adapter for the machine" }),
            )
            .await?;
            continue;
        };
        tokio::spawn(run_sale(
            client.clone(),
            cfg.clone(),
            machine,
            job,
            Arc::clone(running),
        ));
    }
    Ok(taken)
}

pub async fn poll_loop(client: &reqwest::Client, cfg: &BridgeConfig, every: Duration) {
    for t in cfg.card_terminals.iter().flatten() {
        let drivable = adapter_for(t).is_some();
        info!(terminal = %t.id, adapter = %t.adapter, address = ?t.address, drivable, "card machine");
    }
    let running: Running = Arc::default();
    loop {
        match poll_once(client, cfg, &running).await {
            Ok(0) => {}
            Ok(n) => info!(jobs = n, "card machine jobs taken"),
            Err(e) => warn!(error = %e, "card machine poll failed — will retry"),
        }
        tokio::time::sleep(every).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn the_simulator_answers_as_configured_and_a_cancel_stops_it() {
        let approve = Simulator {
            outcome: "approve".into(),
            delay: Duration::from_millis(5),
        };
        let out = approve
            .sale(12_345, "0a1b2c3d-x", Arc::new(Notify::new()))
            .await
            .unwrap();
        assert!(matches!(
            out,
            Outcome::Approved {
                approved_paise: Some(12_345),
                ..
            }
        ));
        let decline = Simulator {
            outcome: "decline".into(),
            delay: Duration::from_millis(5),
        };
        let out = decline.sale(1, "r", Arc::new(Notify::new())).await.unwrap();
        assert!(matches!(out, Outcome::Declined(_)));
        let slow = Simulator {
            outcome: "approve".into(),
            delay: Duration::from_secs(30),
        };
        let cancel = Arc::new(Notify::new());
        cancel.notify_one();
        assert_eq!(slow.sale(1, "r", cancel).await.unwrap(), Outcome::Cancelled);
    }

    #[test]
    fn each_outcome_reports_in_the_words_the_server_reads() {
        assert_eq!(result_body(&Outcome::TimedOut)["outcome"], "timed_out");
        assert_eq!(result_body(&Outcome::Cancelled)["outcome"], "cancelled");
        let approved = Outcome::Approved {
            reference: "R".into(),
            approved_paise: Some(5),
            card_last4: None,
            auth_code: Some("A".into()),
        };
        assert_eq!(result_body(&approved)["auth_code"], "A");
    }
}
