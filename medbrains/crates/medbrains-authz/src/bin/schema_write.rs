use std::{env, fs, path::PathBuf, time::Duration};

use anyhow::{Context, bail};
use spicedb_rs_client::{ClientBuilder, v1::WriteSchemaRequest};
use tokio::time::sleep;
use tonic::Code;

const DEFAULT_SCHEMA_PATH: &str = "infra/spicedb/schema.zed";
const DEFAULT_ENDPOINT: &str = "http://localhost:50051";
const DEFAULT_TOKEN: &str = "devsecret";
const MAX_ATTEMPTS: u8 = 40;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let schema_path = env::args()
        .nth(1)
        .map_or_else(|| PathBuf::from(DEFAULT_SCHEMA_PATH), PathBuf::from);
    let endpoint = env::var("SPICEDB_ENDPOINT").unwrap_or_else(|_| DEFAULT_ENDPOINT.to_owned());
    let token = env::var("SPICEDB_TOKEN").unwrap_or_else(|_| DEFAULT_TOKEN.to_owned());
    let schema = fs::read_to_string(&schema_path)
        .with_context(|| format!("read SpiceDB schema file {}", schema_path.display()))?;

    let mut last_error = String::new();
    for attempt in 1..=MAX_ATTEMPTS {
        match write_schema_once(&endpoint, &token, &schema).await {
            Ok(()) => return Ok(()),
            Err(err) => {
                last_error = err.to_string();
                if attempt == MAX_ATTEMPTS {
                    break;
                }
                sleep(Duration::from_millis(500)).await;
            }
        }
    }

    bail!("SpiceDB schema write failed after {MAX_ATTEMPTS} attempts: {last_error}")
}

async fn write_schema_once(endpoint: &str, token: &str, schema: &str) -> anyhow::Result<()> {
    let client = ClientBuilder::new(endpoint)
        .with_token(token)
        .insecure(endpoint.starts_with("http://") || !endpoint.starts_with("https://"))
        .connect()
        .await
        .context("connect to SpiceDB")?;

    let mut schema_client = client.schema();
    schema_client
        .write_schema(WriteSchemaRequest {
            schema: schema.to_owned(),
        })
        .await
        .map_err(|status| {
            if matches!(
                status.code(),
                Code::Unavailable | Code::Unknown | Code::DeadlineExceeded
            ) {
                anyhow::anyhow!("SpiceDB not ready: {status}")
            } else {
                anyhow::anyhow!("write SpiceDB schema: {status}")
            }
        })?;

    Ok(())
}
