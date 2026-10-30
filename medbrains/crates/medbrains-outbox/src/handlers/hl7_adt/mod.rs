//! `hl7.adt.send` — one ADT message to one destination over MLLP.
//!
//! The database queues the event when an admission, transfer, discharge,
//! registration or demographic edit happens (migration 1355). Here the
//! message is built from the record as it stands now, sent to the
//! destination's MLLP address, and judged by its ACK: `AA` is done, `AE`
//! (the receiver failed) is retried, `AR` (the receiver refused it) is
//! not. The address must be on the hospital network — plain MLLP never
//! leaves it.

pub mod build;
mod load;
#[cfg(test)]
mod tests;

use std::time::Duration;

use async_trait::async_trait;
use medbrains_adapter_sdk::hl7;
use serde_json::{Value, json};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use uuid::Uuid;

use super::pacs_target::{Policy, is_hospital_network, is_reserved};
use crate::handler::{Handler, HandlerCtx, HandlerError};

const IO_TIMEOUT: Duration = Duration::from_secs(10);
/// An ACK is a few hundred bytes.
const MAX_ACK: usize = 16 * 1024;

#[derive(Debug, Default)]
pub struct AdtSendHandler;

fn uuid(payload: &Value, key: &str) -> Option<Uuid> {
    payload[key].as_str().and_then(|s| Uuid::parse_str(s).ok())
}

#[async_trait]
impl Handler for AdtSendHandler {
    fn event_type(&self) -> &'static str {
        "hl7.adt.send"
    }

    async fn handle(&self, ctx: &HandlerCtx, payload: &Value) -> Result<Value, HandlerError> {
        let event = payload["event"].as_str().unwrap_or_default();
        if !build::EVENTS.contains(&event) {
            return Err(HandlerError::Permanent(format!(
                "unknown ADT event {event:?}"
            )));
        }
        let dest_id = uuid(payload, "destination_id")
            .ok_or_else(|| HandlerError::Permanent("payload.destination_id missing".into()))?;
        let db = |e: sqlx::Error| HandlerError::Transient(e.to_string());
        let dest = load::destination(&ctx.pool, ctx.tenant_id, dest_id)
            .await
            .map_err(db)?
            .ok_or_else(|| {
                HandlerError::Permanent("the destination was removed or turned off".into())
            })?;
        let ids = load::Ids {
            patient: uuid(payload, "patient_id"),
            admission: uuid(payload, "admission_id"),
            encounter: uuid(payload, "encounter_id"),
            prior_bed: uuid(payload, "prior_bed_id"),
            prior_ward: uuid(payload, "prior_ward_id"),
        };
        let (patient, visit) = load::record(&ctx.pool, ctx.tenant_id, &ids)
            .await
            .map_err(db)?
            .ok_or_else(|| HandlerError::Permanent("the patient no longer exists".into()))?;
        let control_id: String = ctx.event_id.simple().to_string()[..20].to_owned();
        let message = build::build(
            event,
            &build::Header {
                sending_facility: &dest.sending_facility,
                receiving_application: &dest.receiving_application,
                receiving_facility: &dest.receiving_facility,
                control_id: &control_id,
                at: chrono::Utc::now(),
            },
            &patient,
            &visit,
        );
        let reply = send(&dest.host, dest.port, &message).await?;
        judge(&reply).map(|()| json!({ "event": event, "control_id": control_id }))
    }
}

/// The ACK's verdict: `AA`/`CA` done; `AR`/`CR` refused (do not resend);
/// anything else — `AE`, no MSA — retried.
pub fn judge(reply: &str) -> Result<(), HandlerError> {
    let msg = hl7::parse(reply);
    let msa = msg.as_ref().and_then(|m| Some((m, m.first("MSA")?)));
    let code = msa.map(|(m, s)| m.component(s, 1, 1)).unwrap_or_default();
    let why = msa
        .map(|(m, s)| m.text(s, 3))
        .filter(|t| !t.is_empty())
        .unwrap_or_else(|| format!("the receiver answered {code:?}"));
    match code.as_str() {
        "AA" | "CA" => Ok(()),
        "AR" | "CR" => Err(HandlerError::Permanent(format!("refused: {why}"))),
        _ => Err(HandlerError::Transient(why)),
    }
}

/// Connect (to a hospital-network address only), send framed, read the
/// framed ACK.
async fn send(host: &str, port: u16, message: &str) -> Result<String, HandlerError> {
    let transient = |e: String| HandlerError::Transient(e);
    let production = Policy::from_env().production;
    let addrs: Vec<std::net::SocketAddr> = tokio::net::lookup_host((host, port))
        .await
        .map_err(|e| transient(format!("{host} could not be found: {e}")))?
        .take(8)
        .collect();
    let Some(addr) = addrs.first().copied() else {
        return Err(transient(format!("{host} could not be found")));
    };
    if addrs
        .iter()
        .any(|a| is_reserved(a.ip(), production) || !is_hospital_network(a.ip(), production))
    {
        return Err(HandlerError::Permanent(format!(
            "{host} is not on the hospital network; an ADT feed is sent over the LAN or VPN only"
        )));
    }
    let mut stream = tokio::time::timeout(IO_TIMEOUT, TcpStream::connect(addr))
        .await
        .map_err(|_| transient(format!("{host}:{port} did not answer")))?
        .map_err(|e| transient(format!("{host}:{port}: {e}")))?;
    tokio::time::timeout(IO_TIMEOUT, stream.write_all(&hl7::mllp_wrap(message)))
        .await
        .map_err(|_| transient("send timed out".into()))?
        .map_err(|e| transient(e.to_string()))?;
    let mut reply = Vec::new();
    let mut buf = [0u8; 1024];
    while !reply.windows(2).any(|w| w == [0x1C, 0x0D]) {
        let n = tokio::time::timeout(IO_TIMEOUT, stream.read(&mut buf))
            .await
            .map_err(|_| transient("no ACK from the receiver".into()))?
            .map_err(|e| transient(e.to_string()))?;
        if n == 0 {
            return Err(transient("the receiver closed the connection".into()));
        }
        reply.extend_from_slice(&buf[..n]);
        if reply.len() > MAX_ACK {
            return Err(transient("the ACK was too long".into()));
        }
    }
    hl7::mllp_unwrap(&reply).ok_or_else(|| transient("the ACK was not valid MLLP".into()))
}
