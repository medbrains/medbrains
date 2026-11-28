//! The `SpiceDB` sidecar's settings: where it is and the key the server presents.

use super::{AppConfig, ConfigError};

/// The `SpiceDB` sidecar the server talks to, and the key it presents.
#[derive(Debug, Clone)]
pub struct SpiceDbConfig {
    pub endpoint: String,
    pub preshared_key: String,
}

impl AppConfig {
    /// The `SpiceDB` sidecar from `SPICEDB_ENDPOINT` / `SPICEDB_TOKEN`, or `None` when no endpoint
    /// is set and the Postgres backend serves. Resolved here, under the same mode rule as the JWT
    /// pair, so the server never reads a security setting from the environment itself.
    ///
    /// # Errors
    /// An endpoint without a token outside development.
    pub fn spicedb(&self) -> Result<Option<SpiceDbConfig>, ConfigError> {
        let Ok(endpoint) = std::env::var("SPICEDB_ENDPOINT") else {
            return Ok(None);
        };
        let token = std::env::var("SPICEDB_TOKEN").ok();
        let preshared_key = spicedb_preshared_key(token, &self.environment)?;
        Ok(Some(SpiceDbConfig {
            endpoint,
            preshared_key,
        }))
    }
}

/// The local `SpiceDB`'s key (`docker-compose.yml`): public, in this repository. Development only.
const DEV_SPICEDB_KEY: &str = "devsecret";

/// `token`, or the local development key when `environment` is development and no token is set.
/// Anywhere else (an unknown mode included) a missing or blank token refuses the boot: with the
/// public key a production `SpiceDB` would be open to anyone, and a real one would refuse the
/// server, which then ran on the Postgres backend without saying so.
///
/// # Errors
/// The token is missing or blank outside development.
fn spicedb_preshared_key(token: Option<String>, environment: &str) -> Result<String, ConfigError> {
    match token.filter(|t| !t.trim().is_empty()) {
        Some(token) => Ok(token),
        None if environment == medbrains_core::secrets::sealing::DEVELOPMENT => {
            tracing::warn!("SPICEDB_TOKEN unset: using the local development key");
            Ok(DEV_SPICEDB_KEY.to_owned())
        }
        None => Err(ConfigError::Invalid {
            key: "SPICEDB_TOKEN".to_owned(),
            reason: format!(
                "SPICEDB_ENDPOINT is set but SPICEDB_TOKEN is not (MEDBRAINS_ENV={environment}). \
                 Set SPICEDB_TOKEN to the SpiceDB preshared key, or unset SPICEDB_ENDPOINT to use \
                 the Postgres backend"
            ),
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::{ConfigError, spicedb_preshared_key};

    #[test]
    fn an_endpoint_without_a_token_refuses_outside_development() {
        for (token, env) in [
            (None, "production"),
            (Some(String::new()), "production"),
            (Some("  ".to_owned()), "staging"),
        ] {
            assert!(
                matches!(
                    spicedb_preshared_key(token, env),
                    Err(ConfigError::Invalid { ref key, .. }) if key == "SPICEDB_TOKEN"
                ),
                "{env}"
            );
        }
    }

    #[test]
    fn a_set_token_is_used_and_development_keeps_the_local_key() {
        for env in ["production", "development"] {
            assert!(
                matches!(spicedb_preshared_key(Some("k3y".to_owned()), env), Ok(k) if k == "k3y")
            );
        }
        assert!(matches!(spicedb_preshared_key(None, "development"), Ok(k) if k == "devsecret"));
    }
}
