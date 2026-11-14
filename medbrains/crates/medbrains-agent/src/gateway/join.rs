//! A machine asking to join: commit, nonces, reveal, then waiting for a person's decision.

use std::net::IpAddr;
use std::sync::PoisonError;
use std::time::Instant;

use anyhow::{Context, bail};
use iroh::endpoint::Connection;
use tokio::io::BufReader;

use super::door::Arrival;
use super::{
    CLOSE_UNKNOWN, Gateway, HANDSHAKE_TIMEOUT, JOINING_PAUSED, MAX_LABEL, STATUS_EVERY, decode_32,
};
use crate::code::{commitment, confirm_code, join_code, new_nonce};
use crate::hospital::Filing;
use crate::wire::{
    CLOSE_GRACE, Hello, JoinState, NonceFrame, StatusFrame, read_frame, write_frame,
};

impl Gateway {
    /// The handshake: commit, nonces, reveal. Returns what to file. Every step has a time limit.
    async fn hear_request(
        &self,
        conn: &Connection,
        address: IpAddr,
        send: &mut iroh::endpoint::SendStream,
        reader: &mut BufReader<iroh::endpoint::RecvStream>,
    ) -> anyhow::Result<Filing> {
        let hello: Hello = tokio::time::timeout(HANDSHAKE_TIMEOUT, read_frame(reader))
            .await
            .context("silent")??;
        let label = clean_label(&hello.name).context("no usable name")?;
        let main_nonce = new_nonce()?;
        write_frame(
            send,
            &NonceFrame {
                nonce: hex::encode(main_nonce),
            },
        )
        .await?;
        let Some(node_nonce) = self.hear_reveal(reader, &hello.commitment).await else {
            let now = Instant::now();
            self.given_up
                .lock()
                .unwrap_or_else(PoisonError::into_inner)
                .count(now);
            bail!("it saw our nonce and did not reveal its own");
        };
        let node = conn.remote_id();
        let main = self.endpoint.id();
        let code = join_code(main.as_bytes(), node.as_bytes(), &main_nonce, &node_nonce);
        let confirm_code = confirm_code(main.as_bytes(), node.as_bytes(), &main_nonce, &node_nonce);
        Ok(Filing {
            node_id: node.to_string(),
            address: address.to_string(),
            label,
            kind: hello.kind,
            code,
            confirm_code,
        })
    }

    /// The node's nonce, if it reveals one that matches what it committed to. Anything else, including
    /// silence, is what someone testing a guessed code does on a miss.
    async fn hear_reveal(
        &self,
        reader: &mut BufReader<iroh::endpoint::RecvStream>,
        committed: &str,
    ) -> Option<[u8; 32]> {
        let reveal = tokio::time::timeout(HANDSHAKE_TIMEOUT, read_frame::<NonceFrame>(reader));
        let nonce = decode_32(&reveal.await.ok()?.ok()?.nonce).ok()?;
        (hex::encode(commitment(&nonce)) == committed).then_some(nonce)
    }

    /// One join conversation, from the node's commitment until its request is decided.
    pub(super) async fn serve_join(
        &self,
        conn: &Connection,
        address: IpAddr,
        arrival: Arrival,
    ) -> anyhow::Result<()> {
        if self
            .given_up
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .paused(Instant::now())
        {
            conn.close(CLOSE_UNKNOWN.into(), JOINING_PAUSED.as_bytes());
            bail!("joining is paused: too many handshakes were given up on");
        }
        let _place = self
            .limits
            .enter(address, Instant::now())
            .context("this address has had its share")?;
        let slot = self
            .joining
            .try_acquire()
            .context("too many machines joining")?;
        let (mut send, recv) = tokio::time::timeout(HANDSHAKE_TIMEOUT, conn.accept_bi())
            .await
            .context("silent")??;
        let mut reader = BufReader::new(recv);
        let filing = self
            .hear_request(conn, address, &mut send, &mut reader)
            .await?;
        let mut answer = self.hospital.file_join(&filing).await?;
        drop(slot);
        // The server bounds requests that wait, so this needs no place of its own from here.
        drop(arrival);
        loop {
            write_frame(&mut send, &self.status(answer.state)).await?;
            if answer.state.is_final() {
                send.finish().context("finish")?;
                // Long enough for it to read this; its address's place must not be held for ever.
                drop(tokio::time::timeout(CLOSE_GRACE, conn.closed()).await);
                return Ok(());
            }
            tokio::time::sleep(STATUS_EVERY).await;
            answer = self.hospital.join_state(&filing.node_id).await?;
        }
    }

    /// What a machine is told. The certificate goes only to an approved one.
    fn status(&self, state: JoinState) -> StatusFrame {
        let approved = state == JoinState::Approved;
        let name = self.name.read().unwrap_or_else(PoisonError::into_inner);
        StatusFrame {
            state,
            hospital: approved.then(|| name.clone()),
            certificate: approved.then(|| self.certificate.clone()),
        }
    }
}

/// A name fit for a list on an administrator's screen, or `None`.
pub(super) fn clean_label(name: &str) -> Option<String> {
    let cleaned: String = name
        .chars()
        .filter(|c| !c.is_control())
        .take(MAX_LABEL)
        .collect();
    let cleaned = cleaned.trim();
    (!cleaned.is_empty()).then(|| cleaned.to_owned())
}
