use std::{env, fs, path::PathBuf, time::Duration};

use anyhow::{Context, bail};
use medbrains_spicedb_proto::authzed::api::v1::{
    WriteSchemaRequest, schema_service_client::SchemaServiceClient,
};
use tokio::time::sleep;
use tonic::{Code, Request, transport::Endpoint};

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
    let channel = Endpoint::from_shared(endpoint.to_owned())
        .context("SpiceDB endpoint")?
        .connect()
        .await
        .context("connect to SpiceDB")?;
    let mut schema_client = SchemaServiceClient::new(channel);
    let mut request = Request::new(WriteSchemaRequest {
        schema: schema.to_owned(),
    });
    request
        .metadata_mut()
        .insert("authorization", format!("Bearer {token}").parse()?);

    schema_client
        .write_schema(request)
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
