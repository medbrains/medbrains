use serde::Deserialize;
use std::net::ToSocketAddrs;

#[derive(Debug, Clone, Deserialize)]
pub struct ProxyConfig {
    pub http_port: Option<u16>,
    pub https_port: Option<u16>,
    pub body_limit_bytes: Option<u64>,
    pub block_source_maps: Option<bool>,
    pub downstream_read_timeout_ms: Option<u64>,
    pub downstream_write_timeout_ms: Option<u64>,
    pub upstream_connect_timeout_ms: Option<u64>,
    pub upstream_total_timeout_ms: Option<u64>,
    pub upstream_read_timeout_ms: Option<u64>,
    pub upstream_idle_timeout_ms: Option<u64>,
    pub drain_timeout_ms: Option<u64>,
    #[serde(default)]
    pub edge_policies: Vec<EdgePolicyConfig>,
    pub routes: Vec<RouteConfig>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct EdgePolicyConfig {
    pub prefix: String,
    pub class: Option<String>,
    pub upstream: Option<String>,
    pub body_limit_bytes: Option<u64>,
    pub upstream_total_timeout_ms: Option<u64>,
    pub upstream_read_timeout_ms: Option<u64>,
    pub require_idempotency_key: Option<bool>,
    pub retry_after_seconds: Option<u64>,
    pub cache_control: Option<String>,
    pub block: Option<bool>,
    pub allowed_methods: Option<Vec<String>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RouteConfig {
    pub domain: String,
    pub upstream: String,
    #[serde(rename = "gzip")]
    pub _gzip: Option<bool>,
    /// Per-domain TLS cert (for SNI)
    pub cert_path: Option<String>,
    pub key_path: Option<String>,
}

impl ProxyConfig {
    pub fn load(path: &str) -> anyhow::Result<Self> {
        let contents = std::fs::read_to_string(path)?;
        let config: ProxyConfig = toml::from_str(&contents)?;
        config.validate()?;
        Ok(config)
    }

    pub fn http_port(&self) -> u16 {
        self.http_port.unwrap_or(80)
    }

    pub fn https_port(&self) -> u16 {
        self.https_port.unwrap_or(443)
    }

    pub fn body_limit_bytes(&self) -> u64 {
        self.body_limit_bytes.unwrap_or(25 * 1024 * 1024)
    }

    pub fn block_source_maps(&self) -> bool {
        self.block_source_maps.unwrap_or(true)
    }

    pub fn downstream_read_timeout_ms(&self) -> u64 {
        self.downstream_read_timeout_ms.unwrap_or(30_000)
    }

    pub fn downstream_write_timeout_ms(&self) -> u64 {
        self.downstream_write_timeout_ms.unwrap_or(30_000)
    }

    pub fn upstream_connect_timeout_ms(&self) -> u64 {
        self.upstream_connect_timeout_ms.unwrap_or(5_000)
    }

    pub fn upstream_total_timeout_ms(&self) -> u64 {
        self.upstream_total_timeout_ms.unwrap_or(15_000)
    }

    pub fn upstream_read_timeout_ms(&self) -> u64 {
        self.upstream_read_timeout_ms.unwrap_or(60_000)
    }

    pub fn upstream_idle_timeout_ms(&self) -> u64 {
        self.upstream_idle_timeout_ms.unwrap_or(60_000)
    }

    pub fn drain_timeout_ms(&self) -> u64 {
        self.drain_timeout_ms.unwrap_or(1_000)
    }

    fn validate(&self) -> anyhow::Result<()> {
        if self.routes.is_empty() {
            anyhow::bail!("proxy config requires at least one route");
        }

        for route in &self.routes {
            if route.domain.trim().is_empty() {
                anyhow::bail!("proxy route domain cannot be empty");
            }
            route
                .upstream
                .to_socket_addrs()
                .map_err(|e| anyhow::anyhow!("invalid upstream {}: {e}", route.upstream))?
                .next()
                .ok_or_else(|| {
                    anyhow::anyhow!("upstream {} resolved no addresses", route.upstream)
                })?;

            if route.cert_path.is_some() != route.key_path.is_some() {
                anyhow::bail!(
                    "route {} must set cert_path and key_path together",
                    route.domain
                );
            }
        }

        for policy in &self.edge_policies {
            if !policy.prefix.starts_with('/') {
                anyhow::bail!("edge policy prefix must start with /: {}", policy.prefix);
            }
            if policy.prefix.trim().is_empty() {
                anyhow::bail!("edge policy prefix cannot be empty");
            }
            if let Some(methods) = &policy.allowed_methods {
                for method in methods {
                    if method.trim().is_empty() {
                        anyhow::bail!("edge policy {} has an empty method", policy.prefix);
                    }
                }
            }
            if let Some(upstream) = &policy.upstream {
                upstream
                    .to_socket_addrs()
                    .map_err(|e| anyhow::anyhow!("invalid upstream {upstream}: {e}"))?
                    .next()
                    .ok_or_else(|| anyhow::anyhow!("upstream {upstream} resolved no addresses"))?;
            }
        }

        Ok(())
    }
}
