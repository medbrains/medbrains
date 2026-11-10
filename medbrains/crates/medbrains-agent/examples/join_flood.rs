//! A stranger flooding a main machine with join connections, to measure what it costs on a VM.
//!
//!     cargo run -p medbrains-agent --example join_flood -- <main key> <address:port> <connections>

use std::net::SocketAddr;

use iroh::{EndpointAddr, SecretKey};
use medbrains_edge::iroh_transport::build_lan_endpoint;

/// Dials `count` times at once, each with a fresh key, and says how many got through the door.
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let mut args = std::env::args().skip(1);
    let (Some(key), Some(address), Some(count)) = (args.next(), args.next(), args.next()) else {
        anyhow::bail!("usage: join_flood <main key> <address:port> <connections>");
    };
    let address: SocketAddr = address.parse()?;
    let target = EndpointAddr::new(key.parse()?).with_ip_addr(address);
    let mut dials = Vec::new();
    for _ in 0..count.parse::<usize>()? {
        let target = target.clone();
        dials.push(tokio::spawn(async move {
            let endpoint = build_lan_endpoint(SecretKey::generate(), Vec::new(), None).await.ok()?;
            let conn = endpoint.connect(target, b"medbrains/join/1").await.ok()?;
            // Holds it open and says nothing, as a flood would.
            tokio::time::sleep(std::time::Duration::from_secs(5)).await;
            Some(conn)
        }));
    }
    let mut through = 0_usize;
    for dial in dials {
        through += usize::from(matches!(dial.await, Ok(Some(_))));
    }
    std::io::Write::write_all(&mut std::io::stderr(), format!("through the door: {through}\n").as_bytes())?;
    Ok(())
}
