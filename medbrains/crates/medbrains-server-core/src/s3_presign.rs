use std::time::Duration;

use aws_sdk_s3::{
    Client,
    config::{Credentials, Region},
    presigning::PresigningConfig,
};
use uuid::Uuid;

use crate::config::AppConfig;

/// Generates presigned upload (PUT) and download (GET) URLs for S3-compatible storage.
///
/// Key format: `{tenant_id}/{category}/{YYYY-MM}/{uuid}/{filename}`
#[derive(Debug, Clone)]
pub struct S3PresignClient {
    client: Client,
    bucket: String,
}

impl S3PresignClient {
    pub async fn from_config(cfg: &AppConfig) -> Option<Self> {
        let bucket = cfg.s3_bucket.clone()?;
        let region = cfg
            .s3_region
            .clone()
            .unwrap_or_else(|| "ap-south-1".to_owned());

        let mut builder =
            aws_config::defaults(aws_config::BehaviorVersion::latest()).region(Region::new(region));

        if let (Some(key_id), Some(secret)) = (
            cfg.s3_access_key_id.clone(),
            cfg.s3_secret_access_key.clone(),
        ) {
            builder = builder.credentials_provider(Credentials::new(
                key_id,
                secret,
                None,
                None,
                "medbrains-config",
            ));
        }

        let sdk_config = builder.load().await;
        let mut s3_config = aws_sdk_s3::config::Builder::from(&sdk_config);

        if let Some(ref endpoint) = cfg.s3_endpoint {
            s3_config = s3_config.endpoint_url(endpoint).force_path_style(true);
        }

        let client = Client::from_conf(s3_config.build());
        tracing::info!(bucket = %bucket, "S3 presign client initialised");
        Some(Self { client, bucket })
    }

    /// Build an S3 key for uploading a file.
    pub fn make_key(tenant_id: Uuid, category: &str, filename: &str) -> String {
        let month = chrono::Utc::now().format("%Y-%m");
        let safe_name = sanitize_filename(filename);
        let part = Uuid::new_v4();
        format!("{tenant_id}/{category}/{month}/{part}/{safe_name}")
    }

    /// Generate a presigned PUT URL (15 min default) for a direct-to-S3 upload.
    pub async fn presign_upload(
        &self,
        key: &str,
        mime_type: Option<&str>,
        expires: Duration,
    ) -> Result<String, S3PresignError> {
        let mut req = self.client.put_object().bucket(&self.bucket).key(key);

        if let Some(ct) = mime_type {
            req = req.content_type(ct);
        }

        let presigned = req
            .presigned(
                PresigningConfig::expires_in(expires).map_err(|e| S3PresignError(e.to_string()))?,
            )
            .await
            .map_err(|e| S3PresignError(e.to_string()))?;

        Ok(presigned.uri().to_string())
    }

    /// Generate a presigned GET URL for downloading a file.
    pub async fn presign_download(
        &self,
        key: &str,
        expires: Duration,
    ) -> Result<String, S3PresignError> {
        let presigned = self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(key)
            .presigned(
                PresigningConfig::expires_in(expires).map_err(|e| S3PresignError(e.to_string()))?,
            )
            .await
            .map_err(|e| S3PresignError(e.to_string()))?;

        Ok(presigned.uri().to_string())
    }

    /// Download an object's bytes directly (server-side, e.g. for OCR).
    pub async fn download_object(&self, key: &str) -> Result<Vec<u8>, S3PresignError> {
        let output = self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(key)
            .send()
            .await
            .map_err(|e| S3PresignError(e.to_string()))?;
        let body = output
            .body
            .collect()
            .await
            .map_err(|e| S3PresignError(e.to_string()))?;
        Ok(body.to_vec())
    }
}

#[derive(Debug, thiserror::Error)]
#[error("S3 presign error: {0}")]
pub struct S3PresignError(String);

/// Strips path traversal, keeps alphanumeric + safe chars, max 200 bytes.
fn sanitize_filename(name: &str) -> String {
    let base = std::path::Path::new(name)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("file");

    let cleaned: String = base
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || matches!(c, '-' | '_' | '.') {
                c
            } else {
                '_'
            }
        })
        .take(200)
        .collect();

    if cleaned.is_empty() {
        "file".to_owned()
    } else {
        cleaned
    }
}
