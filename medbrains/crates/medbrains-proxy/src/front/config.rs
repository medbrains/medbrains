//! The front's plain configuration file. Everything is checked at start, so a bad file stops the
//! service with a message instead of a machine that half works. Unknown keys are refused, so a
//! misspelt limit cannot silently leave the default in force.

use anyhow::{Context, bail, ensure};
use serde::Deserialize;
use std::net::SocketAddr;
use std::path::{Path, PathBuf};

/// The whole file.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct Config {
    /// The names and addresses this machine answers to, one per line.
    pub(crate) names_file: PathBuf,
    /// Where plain HTTP is answered with a redirect.
    pub(crate) redirect_listen: Vec<ListenerConfig>,
    pub(crate) sites: Vec<SiteConfig>,
}

/// One port.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct ListenerConfig {
    pub(crate) addr: SocketAddr,
    /// Both or neither. Only redirect listeners may have neither.
    pub(crate) cert: Option<PathBuf>,
    pub(crate) key: Option<PathBuf>,
    #[serde(default = "default_max_connections")]
    pub(crate) max_connections: usize,
    /// Zero for no limit per address.
    #[serde(default = "default_max_per_address")]
    pub(crate) max_per_address: usize,
}

/// One back end and the rules in front of it.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct SiteConfig {
    pub(crate) name: String,
    pub(crate) listen: Vec<ListenerConfig>,
    pub(crate) upstream: SocketAddr,
    /// Set when the back end itself speaks TLS.
    pub(crate) upstream_tls: Option<UpstreamTlsConfig>,
    /// The plain sentence a person reads when the back end does not answer.
    pub(crate) error_page: String,
    /// When not empty, only these Host names may use this site.
    #[serde(default)]
    pub(crate) only_hosts: Vec<String>,
    /// Path prefixes answered 404, matched after decoding.
    #[serde(default)]
    pub(crate) block_paths: Vec<String>,
    #[serde(default = "default_max_body_bytes")]
    pub(crate) max_body_bytes: u64,
    #[serde(default)]
    pub(crate) limits: Vec<LimitConfig>,
}

/// How to reach a back end over TLS: this one certificate authority, this name.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct UpstreamTlsConfig {
    pub(crate) ca: PathBuf,
    pub(crate) server_name: String,
}

/// A rate limit per client address on a path prefix, such as a sign-in.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct LimitConfig {
    pub(crate) path: String,
    pub(crate) burst: u32,
    pub(crate) per_minute: u32,
}

/// A big hospital's browsers behind one front: each holds up to six connections.
const fn default_max_connections() -> usize {
    4096
}

/// Generous enough for a terminal server, a ward's worth of sessions on one address.
const fn default_max_per_address() -> usize {
    256
}

/// Above the server's largest upload route; the server still applies its own limits per route.
const fn default_max_body_bytes() -> u64 {
    256 * 1024 * 1024
}

impl Config {
    /// Reads and checks the file at `path`.
    pub(crate) fn load(path: &Path) -> anyhow::Result<Self> {
        let text = std::fs::read_to_string(path)
            .with_context(|| format!("cannot read {}", path.display()))?;
        Self::parse(&text)
    }

    /// Parses and checks the text of a configuration file.
    pub(crate) fn parse(text: &str) -> anyhow::Result<Self> {
        let config: Self = toml::from_str(text)?;
        config.validate()?;
        Ok(config)
    }

    /// Everything a request must be able to rely on.
    fn validate(&self) -> anyhow::Result<()> {
        ensure!(!self.sites.is_empty(), "no sites");
        for listener in &self.redirect_listen {
            listener.validate(false)?;
        }
        for site in &self.sites {
            site.validate()?;
        }
        Ok(())
    }
}

impl Config {
    /// File descriptors the limits can use: one per connection on a redirect port, two on a site's,
    /// which also opens one to its back end, and a few for the process itself.
    pub(crate) fn fds_needed(&self) -> usize {
        const OWN_FDS: usize = 64;
        let redirect: usize = self.redirect_listen.iter().map(|l| l.max_connections).sum();
        let sites = self.sites.iter().flat_map(|site| &site.listen);
        OWN_FDS + redirect + sites.map(|l| l.max_connections * 2).sum::<usize>()
    }
}

impl SiteConfig {
    /// A site must listen somewhere, say something when it fails, and have rules that can match.
    fn validate(&self) -> anyhow::Result<()> {
        let name = &self.name;
        ensure!(!self.listen.is_empty(), "site {name} listens nowhere");
        ensure!(
            !self.error_page.trim().is_empty(),
            "site {name} has no error page"
        );
        for listener in &self.listen {
            listener.validate(true)?;
        }
        let limit_paths = self.limits.iter().map(|limit| &limit.path);
        for path in self.block_paths.iter().chain(limit_paths) {
            ensure!(
                path.starts_with('/'),
                "site {name}: {path} must start with /"
            );
        }
        for limit in &self.limits {
            ensure!(
                limit.burst > 0 && limit.per_minute > 0,
                "limit on {} is zero",
                limit.path
            );
        }
        Ok(())
    }
}

impl ListenerConfig {
    /// A site's port must have a certificate, so TLS cannot be lost by a missing line.
    fn validate(&self, tls_required: bool) -> anyhow::Result<()> {
        ensure!(
            self.max_connections > 0,
            "{} takes no connections",
            self.addr
        );
        match (&self.cert, &self.key) {
            (Some(_), Some(_)) => Ok(()),
            (None, None) if !tls_required => Ok(()),
            (None, None) => bail!("{} needs a certificate", self.addr),
            _ => bail!("{} needs both cert and key", self.addr),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::Config;

    const GOOD: &str = r#"
        names_file = "/n"
        [[redirect_listen]]
        addr = "[::]:80"
        [[sites]]
        name = "app"
        upstream = "127.0.0.1:3000"
        error_page = "Not answering."
        [[sites.listen]]
        addr = "127.0.0.1:8443"
        cert = "/c"
        key = "/k"
    "#;

    #[test]
    fn the_shape_parses_with_bounded_defaults() -> anyhow::Result<()> {
        let config = Config::parse(GOOD)?;
        let site = config
            .sites
            .first()
            .ok_or_else(|| anyhow::anyhow!("site"))?;
        let listener = site
            .listen
            .first()
            .ok_or_else(|| anyhow::anyhow!("listener"))?;
        assert_eq!(listener.max_connections, 4096);
        assert_eq!(listener.max_per_address, 256);
        assert_eq!(site.max_body_bytes, 256 * 1024 * 1024);
        Ok(())
    }

    #[test]
    fn the_shipped_file_is_valid() -> anyhow::Result<()> {
        let text = include_str!("../../../../os/mkosi.extra/usr/lib/medbrains/front.toml");
        let config = Config::parse(text)?;
        assert!(config.sites.iter().all(|site| !site.error_page.is_empty()));
        Ok(())
    }

    /// A flood that runs the process out of descriptors takes the screen's port down with the rest.
    #[test]
    fn the_shipped_limits_fit_the_shipped_unit() -> anyhow::Result<()> {
        let toml = include_str!("../../../../os/mkosi.extra/usr/lib/medbrains/front.toml");
        let unit = include_str!(
            "../../../../os/mkosi.extra/usr/lib/systemd/system/medbrains-front.service"
        );
        let limit: usize = unit
            .lines()
            .find_map(|line| line.strip_prefix("LimitNOFILE="))
            .ok_or_else(|| anyhow::anyhow!("no LimitNOFILE"))?
            .parse()?;
        let needed = Config::parse(toml)?.fds_needed();
        assert!(
            needed <= limit,
            "{needed} descriptors over the unit's {limit}"
        );
        Ok(())
    }

    #[test]
    fn a_site_port_without_a_certificate_is_refused() {
        let bad = GOOD
            .replace("cert = \"/c\"\n", "")
            .replace("key = \"/k\"\n", "");
        assert!(Config::parse(&bad).is_err());
    }

    #[test]
    fn half_a_certificate_is_refused_even_on_a_redirect_port() {
        let bad = GOOD.replace("addr = \"[::]:80\"", "addr = \"[::]:80\"\ncert = \"/c\"");
        assert!(Config::parse(&bad).is_err());
    }

    #[test]
    fn a_misspelt_limit_is_refused_rather_than_ignored() {
        let bad = GOOD.replace("name = \"app\"", "name = \"app\"\nmax_body_byte = 1");
        assert!(Config::parse(&bad).is_err());
    }

    #[test]
    fn a_block_rule_must_be_a_path() {
        let bad = GOOD.replace("name = \"app\"", "name = \"app\"\nblock_paths = [\"scim\"]");
        assert!(Config::parse(&bad).is_err());
    }

    #[test]
    fn a_limit_of_zero_is_refused() {
        let bad = format!("{GOOD}\n[[sites.limits]]\npath = \"/a\"\nburst = 0\nper_minute = 1\n");
        assert!(Config::parse(&bad).is_err());
    }
}
