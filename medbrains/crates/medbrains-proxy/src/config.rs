use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct ProxyConfig {
    pub http_port: Option<u16>,
    pub https_port: Option<u16>,
    pub tls: Option<TlsConfig>,
    pub routes: Vec<RouteConfig>,
}

#[derive(Debug, Deserialize)]
pub struct TlsConfig {
    pub cert_path: String,
    pub key_path: String,
}

#[derive(Debug, Deserialize)]
pub struct RouteConfig {
    pub domain: String,
    pub upstream: String,
    pub static_root: Option<String>,
    pub gzip: Option<bool>,
}

impl ProxyConfig {
    pub fn load(path: &str) -> anyhow::Result<Self> {
        let contents = std::fs::read_to_string(path)?;
        let config: ProxyConfig = toml::from_str(&contents)?;
        Ok(config)
    }
}
