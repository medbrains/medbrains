//! The key the server presents to `SpiceDB` (`SPICEDB_TOKEN`).
//!
//! `devsecret` is the preshared key of the local `SpiceDB` in
//! `docker-compose.yml` and the dev scripts: public, in this repository. A
//! server that fell back to it outside development would reach a `SpiceDB`
//! started with that key, or fail to reach a real one and quietly run on the
//! Postgres backend. So outside development a missing token refuses the boot,
//! the way a missing JWT pair does.

/// The local `SpiceDB`'s key (`docker-compose.yml`). Development only.
const DEV_PRESHARED_KEY: &str = "devsecret";

/// `token` (the value of `SPICEDB_TOKEN`), or the local development key when
/// `environment` is `development` and no token is set. Anywhere else a
/// missing or blank token is an error naming the fix.
///
/// # Errors
/// The refusal message, when the token is missing outside development.
pub fn preshared_key(token: Option<String>, environment: &str) -> Result<String, String> {
    match token.filter(|t| !t.trim().is_empty()) {
        Some(token) => Ok(token),
        None if environment == "development" => {
            tracing::warn!("SPICEDB_TOKEN unset: using the local development key");
            Ok(DEV_PRESHARED_KEY.to_owned())
        }
        None => Err(format!(
            "refusing to start: SPICEDB_ENDPOINT is set but SPICEDB_TOKEN is not \
             (MEDBRAINS_ENV={environment}). Set SPICEDB_TOKEN to the SpiceDB preshared \
             key, or unset SPICEDB_ENDPOINT to use the Postgres backend"
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::preshared_key;

    #[test]
    fn production_without_a_token_refuses() {
        for blank in [None, Some(String::new()), Some("  ".to_owned())] {
            let refused = preshared_key(blank, "production");
            assert!(
                refused.as_ref().is_err_and(|e| e.contains("SPICEDB_TOKEN")),
                "{refused:?}"
            );
        }
    }

    #[test]
    fn an_unknown_mode_is_treated_as_production() {
        assert!(preshared_key(None, "staging").is_err());
    }

    #[test]
    fn a_set_token_is_used_in_every_mode() {
        for mode in ["production", "development"] {
            assert_eq!(
                preshared_key(Some("k3y".to_owned()), mode),
                Ok("k3y".to_owned())
            );
        }
    }

    #[test]
    fn development_keeps_the_local_key() {
        assert_eq!(
            preshared_key(None, "development"),
            Ok("devsecret".to_owned())
        );
    }
}
