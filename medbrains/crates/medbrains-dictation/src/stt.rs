//! Speech to text behind one trait.
//!
//! [`LocalWhisper`] calls a whisper.cpp `whisper-server` on the hospital's own
//! machine; it is the default and the only adapter unless an admin turns on
//! [`CloudStt`], an OpenAI-compatible transcription API. Which one runs is
//! [`choose`]'s decision alone, so a disabled cloud adapter is never built and
//! so can never be called.

use std::future::Future;
use std::time::Duration;

use serde::Deserialize;

use crate::settings::DictationConfig;

/// A recording of ten minutes takes well under this on a CPU whisper server.
const STT_TIMEOUT: Duration = Duration::from_secs(120);
const BOUNDARY: &str = "medbrains-dictation-7f3a9c";

/// One recording, as uploaded.
#[derive(Debug, Clone, Copy)]
pub struct Audio<'a> {
    pub bytes: &'a [u8],
    pub content_type: &'a str,
}

/// Why no transcript came back. Each is a class, stored and shown, never the
/// error text (which can echo the request).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SttFailure {
    Unreachable,
    Timeout,
    /// The server answered, but not with a transcript.
    Refused,
}

impl SttFailure {
    /// The class stored on the session.
    #[must_use]
    pub const fn class(self) -> &'static str {
        match self {
            Self::Unreachable => "stt_unreachable",
            Self::Timeout => "stt_timeout",
            Self::Refused => "stt_refused",
        }
    }
}

/// A speech-to-text service.
pub trait SpeechToText {
    /// `local` or `cloud`, stored on the session.
    fn name(&self) -> &'static str;
    /// The words spoken in `audio`.
    fn transcribe(
        &self,
        audio: Audio<'_>,
    ) -> impl Future<Output = Result<String, SttFailure>> + Send;
}

/// whisper.cpp's server: `POST {base}/inference`, multipart `file`.
#[derive(Debug, Clone)]
pub struct LocalWhisper {
    pub base_url: String,
}

/// An OpenAI-compatible `POST {base}/v1/audio/transcriptions`.
#[derive(Debug, Clone)]
pub struct CloudStt {
    pub base_url: String,
    pub api_key: String,
    pub model: String,
}

/// The adapter a tenant's configuration selects.
#[derive(Debug, Clone)]
pub enum Adapter {
    Local(LocalWhisper),
    Cloud(CloudStt),
}

/// Local unless the cloud is explicitly enabled; the cloud key is resolved
/// only then (`resolve_key` is not called otherwise).
///
/// # Errors
/// Whatever `resolve_key` returns.
pub async fn choose<E, F, Fut>(config: &DictationConfig, resolve_key: F) -> Result<Adapter, E>
where
    F: FnOnce(String) -> Fut,
    Fut: Future<Output = Result<String, E>>,
{
    if !config.cloud_enabled {
        return Ok(Adapter::Local(LocalWhisper {
            base_url: config.stt_url.clone(),
        }));
    }
    let secret = config.cloud_api_key_secret.clone().unwrap_or_default();
    Ok(Adapter::Cloud(CloudStt {
        base_url: config.cloud_url.clone().unwrap_or_default(),
        api_key: resolve_key(secret).await?,
        model: config
            .cloud_model
            .clone()
            .unwrap_or_else(|| "whisper-1".to_owned()),
    }))
}

impl SpeechToText for Adapter {
    /// The selected adapter's name.
    fn name(&self) -> &'static str {
        match self {
            Self::Local(a) => a.name(),
            Self::Cloud(a) => a.name(),
        }
    }

    /// Transcribe with the selected adapter.
    async fn transcribe(&self, audio: Audio<'_>) -> Result<String, SttFailure> {
        match self {
            Self::Local(a) => a.transcribe(audio).await,
            Self::Cloud(a) => a.transcribe(audio).await,
        }
    }
}

impl SpeechToText for LocalWhisper {
    /// Always `local`.
    fn name(&self) -> &'static str {
        "local"
    }

    /// One `/inference` call; `--convert` on the server decodes webm/ogg.
    async fn transcribe(&self, audio: Audio<'_>) -> Result<String, SttFailure> {
        let url = format!("{}/inference", self.base_url.trim_end_matches('/'));
        let fields = [("response_format", "json"), ("temperature", "0.0")];
        post_multipart(reqwest::Client::new().post(url), &fields, audio).await
    }
}

impl SpeechToText for CloudStt {
    /// Always `cloud`.
    fn name(&self) -> &'static str {
        "cloud"
    }

    /// One `/v1/audio/transcriptions` call with the tenant's key.
    async fn transcribe(&self, audio: Audio<'_>) -> Result<String, SttFailure> {
        let url = format!(
            "{}/v1/audio/transcriptions",
            self.base_url.trim_end_matches('/')
        );
        let fields = [("model", self.model.as_str()), ("response_format", "json")];
        let request = reqwest::Client::new().post(url).bearer_auth(&self.api_key);
        post_multipart(request, &fields, audio).await
    }
}

/// Both services answer `{ "text": "…" }`.
#[derive(Deserialize)]
struct Transcription {
    text: String,
}

/// Send `audio` as multipart form data with `fields`, bounded by
/// [`STT_TIMEOUT`], and read the transcript.
async fn post_multipart(
    request: reqwest::RequestBuilder,
    fields: &[(&str, &str)],
    audio: Audio<'_>,
) -> Result<String, SttFailure> {
    let response = request
        .timeout(STT_TIMEOUT)
        .header(
            "content-type",
            format!("multipart/form-data; boundary={BOUNDARY}"),
        )
        .body(multipart_body(fields, audio))
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                SttFailure::Timeout
            } else {
                SttFailure::Unreachable
            }
        })?;
    if !response.status().is_success() {
        return Err(SttFailure::Refused);
    }
    let body: Transcription = response.json().await.map_err(|_| SttFailure::Refused)?;
    Ok(body.text.trim().to_owned())
}

/// A `multipart/form-data` body: the text fields, then the recording as
/// `file`. Written by hand to keep reqwest's multipart feature (and a
/// workspace-wide rebuild) out for one form.
fn multipart_body(fields: &[(&str, &str)], audio: Audio<'_>) -> Vec<u8> {
    let mut body = Vec::with_capacity(audio.bytes.len() + 512);
    for (name, value) in fields {
        body.extend_from_slice(
            format!(
                "--{BOUNDARY}\r\ncontent-disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n"
            )
            .as_bytes(),
        );
    }
    body.extend_from_slice(
        format!(
            "--{BOUNDARY}\r\ncontent-disposition: form-data; name=\"file\"; filename=\"dictation.{}\"\r\ncontent-type: {}\r\n\r\n",
            extension(audio.content_type),
            audio.content_type
        )
        .as_bytes(),
    );
    body.extend_from_slice(audio.bytes);
    body.extend_from_slice(format!("\r\n--{BOUNDARY}--\r\n").as_bytes());
    body
}

/// A file extension the server's decoder recognises for `content_type`.
fn extension(content_type: &str) -> &'static str {
    match content_type.split(';').next().unwrap_or_default().trim() {
        "audio/webm" => "webm",
        "audio/ogg" => "ogg",
        "audio/wav" | "audio/x-wav" | "audio/wave" => "wav",
        "audio/mpeg" => "mp3",
        "audio/mp4" | "audio/x-m4a" | "audio/m4a" => "m4a",
        "audio/flac" => "flac",
        _ => "bin",
    }
}

#[cfg(test)]
mod tests {
    use super::{Adapter, Audio, SpeechToText, SttFailure, choose, multipart_body};
    use crate::settings::DictationConfig;

    /// A stand-in service: answers with `reply`, counting nothing.
    struct Fake(Result<String, SttFailure>);

    impl SpeechToText for Fake {
        fn name(&self) -> &'static str {
            "fake"
        }
        async fn transcribe(&self, _audio: Audio<'_>) -> Result<String, SttFailure> {
            self.0.clone()
        }
    }

    #[tokio::test]
    async fn cloud_off_never_resolves_its_key() {
        let config = DictationConfig {
            cloud_url: Some("https://stt.example.com".to_owned()),
            cloud_api_key_secret: Some("k".to_owned()),
            ..DictationConfig::default()
        };
        let adapter = choose(&config, |_| async { Err::<String, ()>(()) }).await;
        assert!(matches!(adapter, Ok(Adapter::Local(_))));
    }

    #[tokio::test]
    async fn cloud_on_is_chosen_only_when_enabled() {
        let config = DictationConfig {
            cloud_enabled: true,
            cloud_url: Some("https://stt.example.com".to_owned()),
            cloud_api_key_secret: Some("k".to_owned()),
            ..DictationConfig::default()
        };
        let adapter = choose(&config, |_| async { Ok::<_, ()>("key".to_owned()) }).await;
        assert!(matches!(adapter, Ok(Adapter::Cloud(ref c)) if c.api_key == "key"));
    }

    #[tokio::test]
    async fn the_trait_carries_failures_through() {
        let audio = Audio {
            bytes: b"x",
            content_type: "audio/webm",
        };
        assert_eq!(
            Fake(Err(SttFailure::Timeout)).transcribe(audio).await,
            Err(SttFailure::Timeout)
        );
        assert_eq!(
            Fake(Ok("hi".to_owned())).transcribe(audio).await.as_deref(),
            Ok("hi")
        );
    }

    #[test]
    fn the_body_names_the_file_by_its_type() {
        let body = multipart_body(
            &[("response_format", "json")],
            Audio {
                bytes: b"RIFF",
                content_type: "audio/webm;codecs=opus",
            },
        );
        let text = String::from_utf8_lossy(&body);
        assert!(text.contains("name=\"response_format\"\r\n\r\njson\r\n"));
        assert!(text.contains("filename=\"dictation.webm\""));
        assert!(text.ends_with("--\r\n"));
    }
}
