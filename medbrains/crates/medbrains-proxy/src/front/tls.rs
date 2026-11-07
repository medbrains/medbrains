//! Certificates. Files are read once at start, and a bad one is an error, never a panic and never
//! a fallback to plain HTTP. Key material stays inside rustls: no error here prints any of it.

use anyhow::{Context, ensure};
use pingora_core::listeners::tls::Acceptor;
use pingora_core::utils::tls::WrappedX509;
use rustls::ServerConfig;
use rustls::crypto::ring::default_provider;
use rustls::pki_types::pem::PemObject;
use rustls::pki_types::{CertificateDer, PrivateKeyDer};
use std::path::Path;
use std::sync::Arc;
use x509_parser::prelude::{FromDer, X509Certificate};

/// HTTP/1.1 only, offered explicitly. HTTP/2 stays unreachable until it earns its limits.
const ALPN_HTTP11: &[u8] = b"http/1.1";

/// Every certificate in a PEM file.
fn load_certificates(path: &Path) -> anyhow::Result<Vec<CertificateDer<'static>>> {
    let certs = CertificateDer::pem_file_iter(path)
        .with_context(|| format!("cannot read certificate {}", path.display()))?
        .collect::<Result<Vec<_>, _>>()
        .with_context(|| format!("bad certificate {}", path.display()))?;
    ensure!(!certs.is_empty(), "no certificate in {}", path.display());
    Ok(certs)
}

/// A TLS acceptor for one listener: TLS 1.2 and 1.3 only, and this certificate for every name.
///
/// One certificate covers the machine's whole bounded set of names, so a made-up SNI costs nothing
/// and stores nothing. A client that asks for another name gets this one, and its browser decides.
pub(crate) fn acceptor(cert: &Path, key: &Path) -> anyhow::Result<Arc<Acceptor>> {
    let chain = load_certificates(cert)?;
    let key = PrivateKeyDer::from_pem_file(key)
        // Says which file, never what was in it.
        .map_err(|_| anyhow::anyhow!("cannot read private key {}", key.display()))?;
    let mut config = ServerConfig::builder_with_provider(Arc::new(default_provider()))
        .with_protocol_versions(&[&rustls::version::TLS13, &rustls::version::TLS12])?
        .with_no_client_auth()
        .with_single_cert(chain, key)
        .context("the certificate and key do not match")?;
    config.alpn_protocols = vec![ALPN_HTTP11.to_vec()];
    Ok(Arc::new(Acceptor::from_server_config(Arc::new(config))))
}

/// The certificates a back end must chain to. Parsed here with `try_new`, because Pingora's own
/// helper panics on a certificate it cannot parse.
pub(crate) fn load_ca(path: &Path) -> anyhow::Result<Vec<WrappedX509>> {
    load_certificates(path)?
        .into_iter()
        .map(|der| {
            WrappedX509::try_new(der.to_vec(), |raw| {
                X509Certificate::from_der(raw).map(|(_, parsed)| parsed)
            })
            .map_err(|_| anyhow::anyhow!("bad certificate {}", path.display()))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::{acceptor, load_ca};
    use std::path::Path;

    #[test]
    fn a_missing_certificate_is_an_error_not_a_panic() {
        let result = acceptor(Path::new("/nonexistent/c"), Path::new("/nonexistent/k"));
        assert!(result.is_err());
    }

    #[test]
    fn a_garbage_certificate_is_an_error_not_a_panic() -> anyhow::Result<()> {
        let dir = std::env::temp_dir().join(format!("mb-front-tls-{}", std::process::id()));
        std::fs::create_dir_all(&dir)?;
        let garbage = dir.join("garbage.pem");
        std::fs::write(
            &garbage,
            "-----BEGIN CERTIFICATE-----\n!!!\n-----END CERTIFICATE-----\n",
        )?;
        let result = acceptor(&garbage, &garbage);
        std::fs::write(
            &garbage,
            "-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----\n",
        )?;
        let authority = load_ca(&garbage);
        std::fs::remove_dir_all(&dir)?;
        assert!(result.is_err());
        assert!(authority.is_err(), "valid base64 that is no certificate");
        Ok(())
    }
}
