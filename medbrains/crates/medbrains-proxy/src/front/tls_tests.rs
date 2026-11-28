//! The key exchange the front agrees, driven in memory: a client offers one group only, and the
//! handshake must finish on that group. Proves the hybrid post-quantum group (MB-113) and the
//! classical groups old clients still need.

use super::acceptor;
use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::crypto::{CryptoProvider, SupportedKxGroup, aws_lc_rs, verify_tls13_signature};
use rustls::pki_types::{CertificateDer, ServerName, UnixTime};
use rustls::{ClientConfig, ClientConnection, DigitallySignedStruct, NamedGroup, SignatureScheme};
use rustls::{Connection, ServerConnection};
use std::path::PathBuf;
use std::sync::Arc;

/// Accepts any certificate: these tests are about the key exchange, not the chain.
#[derive(Debug)]
struct AnyCertificate(CryptoProvider);

impl ServerCertVerifier for AnyCertificate {
    /// Trusts the certificate without looking at it.
    fn verify_server_cert(
        &self,
        _: &CertificateDer<'_>,
        _: &[CertificateDer<'_>],
        _: &ServerName<'_>,
        _: &[u8],
        _: UnixTime,
    ) -> Result<ServerCertVerified, rustls::Error> {
        Ok(ServerCertVerified::assertion())
    }

    /// Never reached: every client here speaks TLS 1.3 only.
    fn verify_tls12_signature(
        &self,
        _: &[u8],
        _: &CertificateDer<'_>,
        _: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        Err(rustls::Error::General("TLS 1.2 is not under test".into()))
    }

    /// Checks the handshake signature for real, so the server must hold the key.
    fn verify_tls13_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        verify_tls13_signature(
            message,
            cert,
            dss,
            &self.0.signature_verification_algorithms,
        )
    }

    /// The schemes the provider can check.
    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        self.0.signature_verification_algorithms.supported_schemes()
    }
}

/// The test certificate and key shipped with the vendored Pingora.
fn fixture(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../vendor/pingora-core-0.9.1/examples/keys/server")
        .join(name)
}

/// A TLS 1.3 client that offers only `group`.
fn client_offering(group: &'static dyn SupportedKxGroup) -> anyhow::Result<ClientConnection> {
    let provider = CryptoProvider {
        kx_groups: vec![group],
        ..aws_lc_rs::default_provider()
    };
    let config = ClientConfig::builder_with_provider(Arc::new(provider.clone()))
        .with_protocol_versions(&[&rustls::version::TLS13])?
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(AnyCertificate(provider)))
        .with_no_client_auth();
    Ok(ClientConnection::new(
        Arc::new(config),
        ServerName::try_from("openrusty.org")?,
    )?)
}

/// Moves one flight of records from `from` to `to`.
fn send(from: &mut Connection, to: &mut Connection) -> anyhow::Result<()> {
    let mut wire = Vec::new();
    while from.wants_write() {
        from.write_tls(&mut wire)?;
    }
    let mut rest = wire.as_slice();
    while !rest.is_empty() {
        to.read_tls(&mut rest)?;
        to.process_new_packets()?;
    }
    Ok(())
}

/// Runs the front's acceptor against a client offering only `group`; the group agreed.
fn handshake(group: &'static dyn SupportedKxGroup) -> anyhow::Result<NamedGroup> {
    let front = acceptor(&fixture("cert.pem"), &fixture("key.pem"))?;
    let mut server = Connection::from(ServerConnection::new(Arc::clone(front.acceptor.config()))?);
    let mut client = Connection::from(client_offering(group)?);
    // Bounded: a TLS 1.3 handshake is three flights; ten means it is stuck.
    for _ in 0..10 {
        if !client.is_handshaking() && !server.is_handshaking() {
            let agreed = client.negotiated_key_exchange_group();
            return agreed
                .map(SupportedKxGroup::name)
                .ok_or_else(|| anyhow::anyhow!("no group agreed"));
        }
        send(&mut client, &mut server)?;
        send(&mut server, &mut client)?;
    }
    anyhow::bail!("the handshake did not finish")
}

#[test]
fn a_client_offering_only_hybrid_post_quantum_connects() -> anyhow::Result<()> {
    let agreed = handshake(aws_lc_rs::kx_group::X25519MLKEM768)?;
    assert_eq!(agreed, NamedGroup::X25519MLKEM768);
    Ok(())
}

#[test]
fn classical_only_clients_still_connect() -> anyhow::Result<()> {
    for group in [aws_lc_rs::kx_group::X25519, aws_lc_rs::kx_group::SECP256R1] {
        assert_eq!(handshake(group)?, group.name());
    }
    Ok(())
}

#[test]
fn the_front_prefers_hybrid_post_quantum() -> anyhow::Result<()> {
    let front = acceptor(&fixture("cert.pem"), &fixture("key.pem"))?;
    let groups = &front.acceptor.config().crypto_provider().kx_groups;
    assert_eq!(
        groups.first().map(|g| g.name()),
        Some(NamedGroup::X25519MLKEM768)
    );
    Ok(())
}
