//! Where a hospital's PACS is, and how the server is allowed to reach it.
//!
//! Every call to the PACS — the worklist handler, the study sync — goes
//! through [`target_from_config`], which enforces two things:
//!
//! - **The address is on the hospital's network.** Private, VPN (CGNAT) or
//!   unique-local addresses only, plus hosts the server operator approved in
//!   `MEDBRAINS_PACS_ALLOWED_HOSTS` (https only). The name is resolved once and
//!   the connection pinned to the vetted addresses, so a DNS answer cannot
//!   change between the check and the call, and redirects are never followed —
//!   a credential goes to the vetted address or nowhere.
//! - **The password is the hospital's own, and bound to the address.** It is
//!   sealed (AEAD) with a server-held key, and the tenant, address and
//!   username are the sealing context. Pointing the PACS somewhere else —
//!   through the settings screen or by editing the row — makes the saved
//!   password unreadable, so it can never be replayed to a new host.

use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::time::Duration;

use medbrains_core::secrets::SecretResolver;
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

/// Secret-store key holding the sealing key.
pub const SEALING_KEY_NAME: &str = "MEDBRAINS_PACS_SECRET_KEY";
/// Development fallback only; production refuses it (see [`sealing_key`]).
const DEV_SEALING_KEY: &[u8] = b"medbrains-dev-pacs-secret-key-32";
const MIN_SEALING_KEY_LEN: usize = 32;
/// Operator-approved PACS hosts outside the hospital network, comma-separated.
const ALLOWED_HOSTS_ENV: &str = "MEDBRAINS_PACS_ALLOWED_HOSTS";
/// The JSON field in `tenant_settings(radiology, pacs_config)` that holds the
/// sealed password. Never returned to a client.
pub const SEALED_PASSWORD_KEY: &str = "orthanc_password_sealed";
const REQUEST_TIMEOUT_SECS: u64 = 20;
/// Addresses checked per name; a PACS name with more is not a LAN host.
const MAX_ADDRESSES: usize = 16;

#[derive(Debug, thiserror::Error)]
pub enum PacsError {
    /// The address breaks the network policy; the message says why.
    #[error("{0}")]
    NotAllowed(String),
    /// Something the hospital or the operator must set up; the message says what.
    #[error("{0}")]
    NotSetUp(String),
    #[error("database: {0}")]
    Db(#[from] sqlx::Error),
}

/// Which addresses a PACS may have.
#[derive(Debug, Clone, Default)]
pub struct Policy {
    /// Production refuses loopback: the server's own ports are not a PACS.
    pub production: bool,
    /// Lower-cased hosts the operator approved; reachable over https only.
    pub approved_hosts: Vec<String>,
}

impl Policy {
    #[must_use]
    pub fn from_env() -> Self {
        Self {
            production: std::env::var("MEDBRAINS_ENV").is_ok_and(|e| e == "production"),
            approved_hosts: std::env::var(ALLOWED_HOSTS_ENV)
                .unwrap_or_default()
                .split(',')
                .map(|h| h.trim().to_ascii_lowercase())
                .filter(|h| !h.is_empty())
                .collect(),
        }
    }
}

/// A vetted PACS: a client pinned to its checked addresses, its base URL, and
/// the credential to present, if any.
#[derive(Debug, Clone)]
pub struct Target {
    pub client: reqwest::Client,
    pub base: String,
    pub auth: Option<(String, String)>,
}

impl Target {
    pub fn get(&self, path: &str) -> reqwest::RequestBuilder {
        self.authorize(self.client.get(format!("{}{path}", self.base)))
    }

    pub fn post(&self, path: &str) -> reqwest::RequestBuilder {
        self.authorize(self.client.post(format!("{}{path}", self.base)))
    }

    fn authorize(&self, request: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        match &self.auth {
            Some((user, password)) => request.basic_auth(user, Some(password)),
            None => request,
        }
    }
}

/// The address as stored and compared: trimmed, no trailing slash.
#[must_use]
pub fn normalize_url(raw: &str) -> String {
    raw.trim().trim_end_matches('/').to_owned()
}

/// 100.64.0.0/10 — carrier-grade NAT, where WireGuard/Tailscale VPNs live.
const fn is_cgnat(ip: Ipv4Addr) -> bool {
    let [a, b, ..] = ip.octets();
    a == 100 && (b & 0xC0) == 64
}

/// May an un-approved PACS name resolve here?
// ponytail: "private" includes a cloud VPC's own range; narrow with an
// operator list of LAN/VPN prefixes if a SaaS install shares its VPC.
#[must_use]
pub const fn is_hospital_network(ip: IpAddr, production: bool) -> bool {
    match ip.to_canonical() {
        IpAddr::V4(v4) => v4.is_private() || is_cgnat(v4) || (!production && v4.is_loopback()),
        IpAddr::V6(v6) => v6.is_unique_local() || (!production && v6.is_loopback()),
    }
}

/// Never a PACS, even for an approved name: link-local holds the cloud
/// metadata service.
pub const fn is_reserved(ip: IpAddr, production: bool) -> bool {
    match ip.to_canonical() {
        IpAddr::V4(v4) => {
            v4.is_link_local()
                || v4.is_unspecified()
                || v4.is_broadcast()
                || v4.is_multicast()
                || (production && v4.is_loopback())
        }
        IpAddr::V6(v6) => {
            v6.is_unicast_link_local()
                || v6.is_unspecified()
                || v6.is_multicast()
                || (production && v6.is_loopback())
        }
    }
}

async fn resolve(host: &str, port: u16) -> Result<Vec<SocketAddr>, PacsError> {
    let not_found = || PacsError::NotAllowed(format!("The PACS address {host} could not be found"));
    let addrs: Vec<SocketAddr> = tokio::net::lookup_host((host, port))
        .await
        .map_err(|_| not_found())?
        .take(MAX_ADDRESSES)
        .collect();
    if addrs.is_empty() {
        return Err(not_found());
    }
    Ok(addrs)
}

/// Check `raw` against `policy` and build a client that can only reach the
/// addresses checked, with redirects off.
///
/// # Errors
/// [`PacsError::NotAllowed`] with a message for the settings screen.
pub async fn vet(raw: &str, policy: &Policy) -> Result<(reqwest::Client, String), PacsError> {
    let base = normalize_url(raw);
    let url = reqwest::Url::parse(&base).map_err(|_| {
        PacsError::NotAllowed(
            "The PACS address must look like https://pacs.hospital.local:8042".to_owned(),
        )
    })?;
    let https = match url.scheme() {
        "https" => true,
        "http" => false,
        _ => {
            return Err(PacsError::NotAllowed(
                "The PACS address must start with http:// or https://".to_owned(),
            ));
        }
    };
    if !url.username().is_empty() || url.password().is_some() {
        return Err(PacsError::NotAllowed(
            "Put the username and password in their own fields, not in the address".to_owned(),
        ));
    }
    let host = url
        .host_str()
        .map(|h| {
            h.trim_start_matches('[')
                .trim_end_matches(']')
                .to_ascii_lowercase()
        })
        .ok_or_else(|| PacsError::NotAllowed("The PACS address has no host".to_owned()))?;
    let port = url
        .port_or_known_default()
        .unwrap_or(if https { 443 } else { 80 });
    let addrs = resolve(&host, port).await?;
    let approved = policy.approved_hosts.contains(&host);
    if approved && !https {
        return Err(PacsError::NotAllowed(format!(
            "{host} is outside the hospital network, so it must use https://"
        )));
    }
    for addr in &addrs {
        if is_reserved(addr.ip(), policy.production) {
            return Err(PacsError::NotAllowed(format!(
                "{host} points at a reserved address ({}) and cannot be a PACS",
                addr.ip()
            )));
        }
        if !approved && !is_hospital_network(addr.ip(), policy.production) {
            return Err(PacsError::NotAllowed(format!(
                "{host} is not on the hospital network. Use the PACS's private or VPN address \
                 (10.x, 172.16–31.x, 192.168.x or 100.64–127.x), or ask your MedBrains \
                 administrator to approve this host"
            )));
        }
    }
    let mut builder = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS));
    if url.domain().is_some() {
        builder = builder.resolve_to_addrs(&host, &addrs);
    }
    let client = builder
        .build()
        .map_err(|e| PacsError::NotSetUp(format!("PACS client: {e}")))?;
    Ok((client, base))
}

/// The sealing key. Outside production a missing key falls back to the
/// development key; production refuses rather than seal with a public value.
///
/// # Errors
/// [`PacsError::NotSetUp`] in production when the key is missing or short.
pub async fn sealing_key(resolver: &dyn SecretResolver) -> Result<Vec<u8>, PacsError> {
    match resolver.get(SEALING_KEY_NAME).await {
        Ok(value) if value.len() >= MIN_SEALING_KEY_LEN => Ok(value.into_bytes()),
        _ if std::env::var("MEDBRAINS_ENV").is_ok_and(|e| e == "production") => {
            Err(PacsError::NotSetUp(format!(
                "PACS passwords cannot be stored on this server yet — ask your administrator \
                 to set {SEALING_KEY_NAME}"
            )))
        }
        _ => Ok(DEV_SEALING_KEY.to_vec()),
    }
}

fn context(tenant_id: Uuid, url: &str, username: &str) -> Vec<u8> {
    format!(
        "pacs-password|{tenant_id}|{}|{username}",
        normalize_url(url)
    )
    .into_bytes()
}

/// Seal a password to this tenant, address and username.
///
/// # Errors
/// When encryption fails (a key shorter than 32 bytes).
pub fn seal(
    key: &[u8],
    tenant_id: Uuid,
    url: &str,
    username: &str,
    password: &str,
) -> Result<String, PacsError> {
    medbrains_crypto::aead::encrypt_token(key, &context(tenant_id, url, username), &password)
        .map_err(|e| PacsError::NotSetUp(format!("PACS password could not be sealed: {e}")))
}

/// Open a sealed password — only for the tenant, address and username it was
/// sealed for.
///
/// # Errors
/// [`PacsError::NotSetUp`] when any of the three changed, or the key did.
pub fn unseal(
    key: &[u8],
    tenant_id: Uuid,
    url: &str,
    username: &str,
    sealed: &str,
) -> Result<String, PacsError> {
    medbrains_crypto::aead::decrypt_token(key, &context(tenant_id, url, username), sealed).map_err(
        |_| {
            PacsError::NotSetUp(
                "The saved PACS password does not match the PACS address — enter it again \
                 in Radiology → PACS"
                    .to_owned(),
            )
        },
    )
}

fn text(config: &Value, key: &str) -> String {
    config
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_owned()
}

/// The PACS one tenant's `pacs_config` names, vetted and with its credential
/// opened. `None` when the hospital has switched the PACS off.
///
/// # Errors
/// [`PacsError`] when the address breaks policy or the password is unusable;
/// nothing is sent anywhere in either case.
pub async fn target_from_config(
    tenant_id: Uuid,
    config: &Value,
    resolver: &dyn SecretResolver,
    policy: &Policy,
) -> Result<Option<Target>, PacsError> {
    let url = normalize_url(&text(config, "orthanc_url"));
    if url.is_empty() {
        return Ok(None);
    }
    let (client, base) = vet(&url, policy).await?;
    let username = text(config, "orthanc_username");
    let auth = if username.is_empty() {
        None
    } else {
        let sealed = config
            .get(SEALED_PASSWORD_KEY)
            .and_then(Value::as_str)
            .ok_or_else(|| {
                PacsError::NotSetUp(
                    "No PACS password is saved — enter it in Radiology → PACS".to_owned(),
                )
            })?;
        let key = sealing_key(resolver).await?;
        let password = unseal(&key, tenant_id, &url, &username, sealed)?;
        Some((username, password))
    };
    Ok(Some(Target { client, base, auth }))
}

/// [`target_from_config`] for the tenant's saved configuration.
///
/// # Errors
/// As [`target_from_config`], plus database errors.
pub async fn load_target(
    pool: &PgPool,
    tenant_id: Uuid,
    resolver: &dyn SecretResolver,
    policy: &Policy,
) -> Result<Option<Target>, PacsError> {
    let config: Option<Value> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings \
          WHERE tenant_id = $1 AND category = 'radiology' AND key = 'pacs_config' \
            AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .fetch_optional(pool)
    .await?;
    match config {
        Some(config) => target_from_config(tenant_id, &config, resolver, policy).await,
        None => Ok(None),
    }
}

#[cfg(test)]
mod tests;
