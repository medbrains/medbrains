//! A node's side: finds main machines, asks to join, and once approved carries its screen to the
//! main machine over iroh. Opens nothing to the network: its endpoint has no protocols to answer,
//! and the screen's way in is loopback.

mod carry;

use std::collections::BTreeMap;
use std::net::{IpAddr, SocketAddr};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, PoisonError};
use std::time::Duration;

use anyhow::{Context, bail};
use iroh::endpoint::Connection;
use iroh::{Endpoint, EndpointAddr, EndpointId};
use iroh_mdns_address_lookup::DiscoveryEvent;
use serde::{Deserialize, Serialize};
use tokio::io::BufReader;
use tokio::net::UdpSocket;

use crate::code::{commitment, confirm_code, join_code, new_nonce};
use crate::gateway::{WHOAMI_SIZE, decode_32};
use crate::wire::{
    Hello, IROH_PORT, JOIN_ALPN, JoinState, Kind, NonceFrame, StatusFrame, TUNNEL_ALPN,
    WHOAMI_PORT, read_frame, write_frame,
};

/// Where the agent records what it joined. The setup service reads it to finish setup.
const JOINED_FILE: &str = "joined.json";
const DIAL_TIMEOUT: Duration = Duration::from_secs(10);
const WHOAMI_TRIES: usize = 3;
const WHOAMI_WAIT: Duration = Duration::from_secs(1);
/// How many main machines one list shows, however many a network claims to have.
const MAX_FOUND: usize = 32;

/// True if the digits match, without stopping at the first difference.
fn same_digits(expected: &str, typed: &str) -> bool {
    expected.len() == typed.len()
        && !expected.is_empty()
        && expected
            .bytes()
            .zip(typed.bytes())
            .fold(0_u8, |diff, (x, y)| diff | (x ^ y))
            == 0
}

/// Wrong digits allowed on the node before the join is thrown away.
const MAX_CONFIRM_TRIES: u32 = 3;

/// A main machine on the network.
#[derive(Debug, Clone, Serialize)]
pub(crate) struct Found {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) addresses: Vec<SocketAddr>,
    /// A person typed this one, so no amount of mDNS noise may push it off the list.
    #[serde(skip)]
    pub(crate) typed: bool,
}

/// An approval that claims to come from the main machine, believed by nothing until a person has
/// typed the digits from the real main machine's screen.
#[derive(Debug)]
struct Unconfirmed {
    joined: Joined,
    confirm_code: String,
    join_code: String,
    tries: u32,
}

/// What this machine joined, kept across restarts.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct Joined {
    pub(crate) main_id: String,
    pub(crate) addresses: Vec<SocketAddr>,
    pub(crate) kind: Kind,
    pub(crate) hospital: String,
    pub(crate) certificate: String,
}

/// How a join stands, as the screen shows it.
#[derive(Debug, Clone, Default, Serialize)]
pub(crate) struct Standing {
    /// `idle`, `connecting`, `unreachable`, or a [`JoinState`] in words.
    pub(crate) state: String,
    pub(crate) code: Option<String>,
}

/// Everything a node's agent holds.
pub(crate) struct Node {
    endpoint: Endpoint,
    state_dir: PathBuf,
    /// Where the screen connects.
    screen_port: SocketAddr,
    /// Where this machine's chrony asks. Below 1024 on a real machine.
    time_port: SocketAddr,
    unconfirmed: Mutex<Option<Unconfirmed>>,
    found: Mutex<BTreeMap<String, Found>>,
    standing: Mutex<Standing>,
    /// Held across opening, so it is only true of a tunnel that really opened.
    tunnel_open: tokio::sync::Mutex<bool>,
}

impl Node {
    /// A node. If it has already joined, its tunnel opens straight away.
    pub(crate) async fn start(
        endpoint: Endpoint,
        state_dir: &Path,
        screen_port: SocketAddr,
        time_port: SocketAddr,
    ) -> anyhow::Result<Arc<Self>> {
        let node = Arc::new(Self {
            endpoint,
            state_dir: state_dir.to_owned(),
            screen_port,
            time_port,
            unconfirmed: Mutex::default(),
            found: Mutex::default(),
            standing: Mutex::new(Standing {
                state: "idle".to_owned(),
                code: None,
            }),
            tunnel_open: tokio::sync::Mutex::new(false),
        });
        if node.joined()?.is_some() {
            node.open_tunnel().await?;
        }
        Ok(node)
    }

    /// What this machine joined. Nothing there means it has not; a file it cannot read is a fault,
    /// which must not read as "not joined" and send a person through joining again.
    pub(crate) fn joined(&self) -> anyhow::Result<Option<Joined>> {
        let raw = match std::fs::read(self.state_dir.join(JOINED_FILE)) {
            Ok(raw) => raw,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(error).context("This machine can't read what it joined."),
        };
        let joined = serde_json::from_slice(&raw)
            .context("This machine's record of what it joined is damaged.")?;
        Ok(Some(joined))
    }

    /// The main machines seen so far.
    pub(crate) fn found(&self) -> Vec<Found> {
        self.found
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .values()
            .cloned()
            .collect()
    }

    /// Adds to the list, bounded so a noisy network cannot grow it for ever.
    fn remember(&self, found: Found) {
        let mut list = self.found.lock().unwrap_or_else(PoisonError::into_inner);
        if list.len() >= MAX_FOUND && !list.contains_key(&found.id) {
            // Only something a person typed may push out what mDNS heard, never the reverse.
            let heard = list
                .iter()
                .find(|(_, entry)| !entry.typed)
                .map(|(id, _)| id.clone());
            match heard {
                Some(id) if found.typed => drop(list.remove(&id)),
                _ => return,
            }
        }
        list.insert(found.id.clone(), found);
    }

    /// Puts a main machine on the list directly, as discovery would.
    #[cfg(test)]
    pub(crate) fn test_remember(&self, id: String, name: &str, addresses: Vec<SocketAddr>) {
        self.remember(Found {
            id,
            name: name.to_owned(),
            addresses,
            typed: false,
        });
    }

    /// Dials the tunnel with this node's own key, ignoring whether it has joined.
    #[cfg(test)]
    pub(crate) async fn test_dial_tunnel(&self, addr: EndpointAddr) -> anyhow::Result<Connection> {
        Ok(self.endpoint.connect(addr, TUNNEL_ALPN).await?)
    }

    /// Takes in what mDNS heard.
    pub(crate) fn heard(&self, event: DiscoveryEvent) {
        match event {
            DiscoveryEvent::Discovered { endpoint_info, .. } => {
                let name = endpoint_info.data.user_data().map(ToString::to_string);
                self.remember(Found {
                    id: endpoint_info.endpoint_id.to_string(),
                    name: name.unwrap_or_else(|| "Main machine".to_owned()),
                    addresses: endpoint_info.data.ip_addrs().copied().collect(),
                    typed: false,
                });
            }
            DiscoveryEvent::Expired { endpoint_id } => {
                let mut list = self.found.lock().unwrap_or_else(PoisonError::into_inner);
                list.remove(&endpoint_id.to_string());
            }
            _ => {}
        }
    }

    /// Asks a typed address who it is, and adds the answer to the list. Unauthenticated: a liar
    /// is caught when the codes do not match.
    pub(crate) async fn find_address(&self, address: IpAddr) -> anyhow::Result<Found> {
        self.find_at(address, WHOAMI_PORT, IROH_PORT).await
    }

    /// `find_address`, with the ports spelled out.
    pub(crate) async fn find_at(
        &self,
        address: IpAddr,
        whoami: u16,
        iroh: u16,
    ) -> anyhow::Result<Found> {
        let any: SocketAddr = if address.is_ipv4() {
            ([0, 0, 0, 0], 0).into()
        } else {
            ([0_u16; 8], 0).into()
        };
        let socket = UdpSocket::bind(any).await?;
        socket.connect((address, whoami)).await?;
        let mut buffer = [0_u8; WHOAMI_SIZE];
        for _ in 0..WHOAMI_TRIES {
            socket.send(&[0_u8; WHOAMI_SIZE]).await?;
            if let Ok(Ok(read)) = tokio::time::timeout(WHOAMI_WAIT, socket.recv(&mut buffer)).await
            {
                let answer: serde_json::Value = serde_json::from_slice(&buffer[..read])?;
                let id = answer["id"].as_str().context("no key in the answer")?;
                id.parse::<EndpointId>().context("not a key")?;
                let found = Found {
                    id: id.to_owned(),
                    name: answer["name"].as_str().unwrap_or("Main machine").to_owned(),
                    addresses: vec![(address, iroh).into()],
                    typed: true,
                };
                self.remember(found.clone());
                return Ok(found);
            }
        }
        bail!("nothing answered at {address}")
    }

    /// How the join stands.
    pub(crate) fn standing(&self) -> Standing {
        self.standing
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .clone()
    }

    /// Records how the join stands.
    fn set_standing(&self, state: &str, code: Option<String>) {
        *self.standing.lock().unwrap_or_else(PoisonError::into_inner) = Standing {
            state: state.to_owned(),
            code,
        };
    }

    /// Starts asking to join a main machine on the list. The answer arrives through `standing`.
    pub(crate) fn start_join(
        self: &Arc<Self>,
        main_id: &str,
        name: String,
        kind: Kind,
    ) -> anyhow::Result<()> {
        // Approved before a power cut stopped setup finishing: nothing to ask, just finish.
        if self.joined()?.is_some() {
            self.set_standing("approved", None);
            return Ok(());
        }
        let target = self
            .found
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .get(main_id)
            .cloned();
        let target = target.context("That main machine is not on the list.")?;
        self.set_standing("connecting", None);
        let this = Arc::clone(self);
        tokio::spawn(async move {
            if let Err(error) = this.join(&target, name, kind).await {
                tracing::warn!(%error, "join failed");
                this.set_standing("unreachable", None);
            }
        });
        Ok(())
    }

    /// The whole conversation: commit, exchange nonces, show the code, wait for the decision.
    async fn join(
        self: &Arc<Self>,
        target: &Found,
        name: String,
        kind: Kind,
    ) -> anyhow::Result<()> {
        let main_id: EndpointId = target.id.parse()?;
        let conn = self.dial(main_id, &target.addresses, JOIN_ALPN).await?;
        let (mut send, recv) = conn.open_bi().await?;
        let mut reader = BufReader::new(recv);
        let node_nonce = new_nonce()?;
        let commitment = hex::encode(commitment(&node_nonce));
        write_frame(
            &mut send,
            &Hello {
                name,
                kind,
                commitment,
            },
        )
        .await?;
        let theirs: NonceFrame = read_frame(&mut reader).await?;
        let main_nonce = decode_32(&theirs.nonce)?;
        write_frame(
            &mut send,
            &NonceFrame {
                nonce: hex::encode(node_nonce),
            },
        )
        .await?;
        let code = join_code(
            main_id.as_bytes(),
            self.endpoint.id().as_bytes(),
            &main_nonce,
            &node_nonce,
        );
        self.set_standing("connecting", Some(code.clone()));
        loop {
            let status: StatusFrame = read_frame(&mut reader).await?;
            match status.state {
                JoinState::Pending => self.set_standing("pending", Some(code.clone())),
                JoinState::Approved => {
                    // Believed by nothing yet: anyone on the LAN can answer "approved".
                    let joined = Joined {
                        main_id: target.id.clone(),
                        addresses: target.addresses.clone(),
                        kind,
                        hospital: status.hospital.unwrap_or_default(),
                        certificate: status.certificate.context("approved with no certificate")?,
                    };
                    let confirm_code = confirm_code(
                        main_id.as_bytes(),
                        self.endpoint.id().as_bytes(),
                        &main_nonce,
                        &node_nonce,
                    );
                    *self
                        .unconfirmed
                        .lock()
                        .unwrap_or_else(PoisonError::into_inner) = Some(Unconfirmed {
                        joined,
                        confirm_code,
                        join_code: code.clone(),
                        tries: 0,
                    });
                    self.set_standing("confirm", Some(code));
                    return Ok(());
                }
                refused => {
                    self.set_standing(&format!("{refused:?}").to_lowercase(), Some(code));
                    return Ok(());
                }
            }
        }
    }

    /// Takes the digits a person read off the main machine's screen. Only a match lets this machine
    /// save the certificate or open its tunnel: this is what stops a fake main machine, which can say
    /// "approved" but cannot put digits on the hospital's own screen. Three wrong throws it all away.
    pub(crate) async fn confirm(self: &Arc<Self>, typed: &str) -> anyhow::Result<()> {
        let typed: String = typed.chars().filter(|c| !c.is_whitespace()).collect();
        let accepted = {
            let mut held = self
                .unconfirmed
                .lock()
                .unwrap_or_else(PoisonError::into_inner);
            let waiting = held
                .as_mut()
                .context("Nothing is waiting for those digits.")?;
            if same_digits(&waiting.confirm_code, &typed) {
                held.take()
            } else {
                waiting.tries += 1;
                if waiting.tries >= MAX_CONFIRM_TRIES {
                    let code = held.take().map(|gone| gone.join_code);
                    drop(held);
                    self.set_standing("mismatch", code);
                }
                None
            }
        };
        let Some(accepted) = accepted else {
            bail!(
                "Those are not the digits on the main machine. If you are sure of them, this may not be your main machine: tell your administrator."
            );
        };
        self.write_joined(&accepted.joined)?;
        self.open_tunnel().await?;
        self.set_standing("approved", Some(accepted.join_code));
        Ok(())
    }

    /// Writes what this machine joined in one step and to the disk, so a power cut leaves all of it
    /// or none.
    fn write_joined(&self, joined: &Joined) -> anyhow::Result<()> {
        let path = self.state_dir.join(JOINED_FILE);
        let temporary = path.with_extension("new");
        let mut file = std::fs::File::create(&temporary)?;
        std::io::Write::write_all(&mut file, &serde_json::to_vec(joined)?)?;
        file.sync_all()?;
        std::fs::rename(&temporary, &path)?;
        std::fs::File::open(&self.state_dir)?.sync_all()?;
        Ok(())
    }

    /// Connects to the joined main machine by its key. The saved addresses are a first guess, read
    /// fresh each time so a typed one takes effect; mDNS says where the key is now.
    async fn dial_main(&self, alpn: &[u8]) -> anyhow::Result<Connection> {
        let joined = self.joined()?.context("this machine has not joined")?;
        self.dial(joined.main_id.parse()?, &joined.addresses, alpn)
            .await
    }

    /// Looks for the joined main machine at a typed address, for a network where mDNS cannot find
    /// it. The key was fixed when a person approved this machine and never changes here: whatever
    /// answers with another key is refused, and the saved address stays as it was.
    pub(crate) async fn readdress(&self, address: IpAddr) -> anyhow::Result<()> {
        self.readdress_at(address, WHOAMI_PORT, IROH_PORT).await
    }

    /// `readdress`, with the ports spelled out.
    pub(crate) async fn readdress_at(
        &self,
        address: IpAddr,
        whoami: u16,
        iroh: u16,
    ) -> anyhow::Result<()> {
        let mut joined = self.joined()?.context("This machine has not joined.")?;
        let found = self
            .find_at(address, whoami, iroh)
            .await
            .context("Nothing answered at that address.")?;
        if found.id != joined.main_id {
            bail!(
                "A different machine answered at that address, so nothing was changed. Check the address, and tell your administrator."
            );
        }
        // That answer proves nothing, since anyone can claim a key. Only the key's own handshake does.
        let conn = self
            .dial(joined.main_id.parse()?, &found.addresses, TUNNEL_ALPN)
            .await;
        conn.context("Something at that address claims to be the main machine, but could not prove it, so nothing was changed.")?;
        joined.addresses = found.addresses;
        self.write_joined(&joined)
    }

    /// Connects to the main machine by its key; nothing else can answer.
    async fn dial(
        &self,
        id: EndpointId,
        addresses: &[SocketAddr],
        alpn: &[u8],
    ) -> anyhow::Result<Connection> {
        let mut addr = EndpointAddr::new(id);
        for address in addresses {
            addr = addr.with_ip_addr(*address);
        }
        let dialled = tokio::time::timeout(DIAL_TIMEOUT, self.endpoint.connect(addr, alpn));
        Ok(dialled.await.context("timed out")??)
    }
}
