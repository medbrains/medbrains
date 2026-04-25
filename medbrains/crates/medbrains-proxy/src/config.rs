use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct ProxyConfig {
    pub http_port: Option<u16>,
    pub https_port: Option<u16>,
    pub routes: Vec<RouteConfig>,
}

#[derive(Debug, Deserialize)]
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
        Ok(config)
    }
}
