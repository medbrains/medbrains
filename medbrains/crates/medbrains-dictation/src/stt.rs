//! Speech to text behind one trait.
//!
//! [`LocalWhisper`] calls a whisper.cpp `whisper-server` on the hospital's own
//! machine; it is the default and the only adapter unless an admin turns on
//! [`CloudStt`], an OpenAI-compatible transcription API. Which one runs is
//! [`choose`]'s decision alone, so a disabled cloud adapter is never built and
//! so can never be called.
//!
//! Every call is bounded: one shared client that never follows a redirect (a
//! redirect could carry the recording, or the cloud key, somewhere else), a
//! timeout, and a cap on how much of the answer is read.

use std::future::Future;
use std::ops::Range;
use std::sync::OnceLock;
use std::time::Duration;

use axum::body::Bytes;
use serde::Deserialize;

use crate::settings::DictationConfig;

/// A recording of ten minutes takes well under this on a CPU whisper server.
const STT_TIMEOUT: Duration = Duration::from_secs(120);
/// A transcript is text: ten minutes of speech is about 10 KB. Anything
/// larger than this is not a transcript and is not read.
pub const MAX_RESPONSE_BYTES: usize = 1024 * 1024;
const BOUNDARY: &str = "medbrains-dictation-7f3a9c";
const DEFAULT_CLOUD_MODEL: &str = "whisper-1";

/// The recording as the multipart form both services read, built once from
/// the upload. The audio is a slice of it, so the server holds one copy.
#[derive(Debug, Clone)]
pub struct Form {
    body: Bytes,
    audio: Range<usize>,
    content_type: String,
}

impl Form {
    /// The form for `audio` of `content_type`. `model` names the cloud
    /// model; whisper.cpp ignores the field.
    #[must_use]
    pub fn new(audio: &[u8], content_type: &str, model: &str) -> Self {
        let fields = [
            ("response_format", "json"),
            ("temperature", "0.0"),
            ("model", model),
        ];
        let mut body = Vec::with_capacity(audio.len() + 640);
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
                "--{BOUNDARY}\r\ncontent-disposition: form-data; name=\"file\"; filename=\"dictation.{}\"\r\ncontent-type: {content_type}\r\n\r\n",
                extension(content_type),
            )
            .as_bytes(),
        );
        let start = body.len();
        body.extend_from_slice(audio);
        let end = body.len();
        body.extend_from_slice(format!("\r\n--{BOUNDARY}--\r\n").as_bytes());
        Self {
            body: Bytes::from(body),
            audio: start..end,
            content_type: content_type.to_owned(),
        }
    }

    /// The recording inside the form, to store.
    #[must_use]
    pub fn audio(&self) -> &[u8] {
        self.body.get(self.audio.clone()).unwrap_or_default()
    }

    /// The recording's media type.
    #[must_use]
    pub fn content_type(&self) -> &str {
        &self.content_type
    }
}

/// The model field a tenant's configuration puts in the form.
#[must_use]
pub fn form_model(config: &DictationConfig) -> &str {
    config.cloud_model.as_deref().unwrap_or(DEFAULT_CLOUD_MODEL)
}

/// Why no transcript came back. Each is a class, stored and shown, never the
/// error text (which can echo the request).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SttFailure {
    Unreachable,
    Timeout,
    /// The server answered, but not with a transcript (an error, a redirect,
    /// something too large to be one).
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
    /// The words spoken in the recording the form carries.
    fn transcribe(&self, form: &Form) -> impl Future<Output = Result<String, SttFailure>> + Send;
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
}

/// The adapter a tenant's configuration selects.
#[derive(Debug, Clone)]
pub enum Adapter {
    Local(LocalWhisper),
    Cloud(CloudStt),
}

/// Local unless the cloud is explicitly enabled; the cloud key is resolved
/// only then (`resolve_key` is not called otherwise), by its short name.
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
    let name = config.cloud_api_key_secret.clone().unwrap_or_default();
    Ok(Adapter::Cloud(CloudStt {
        base_url: config.cloud_url.clone().unwrap_or_default(),
        api_key: resolve_key(name).await?,
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
    async fn transcribe(&self, form: &Form) -> Result<String, SttFailure> {
        match self {
            Self::Local(a) => a.transcribe(form).await,
            Self::Cloud(a) => a.transcribe(form).await,
        }
    }
}

impl SpeechToText for LocalWhisper {
    /// Always `local`.
    fn name(&self) -> &'static str {
        "local"
    }

    /// One `/inference` call; `--convert` on the server decodes webm/ogg.
    async fn transcribe(&self, form: &Form) -> Result<String, SttFailure> {
        let url = format!("{}/inference", self.base_url.trim_end_matches('/'));
        post_form(client()?.post(url), form).await
    }
}

impl SpeechToText for CloudStt {
    /// Always `cloud`.
    fn name(&self) -> &'static str {
        "cloud"
    }

    /// One `/v1/audio/transcriptions` call with the tenant's key.
    async fn transcribe(&self, form: &Form) -> Result<String, SttFailure> {
        let url = format!(
            "{}/v1/audio/transcriptions",
            self.base_url.trim_end_matches('/')
        );
        post_form(client()?.post(url).bearer_auth(&self.api_key), form).await
    }
}

/// The one client: no redirects, no proxy. Built once; if it
/// cannot be built, every call fails closed as unreachable.
fn client() -> Result<&'static reqwest::Client, SttFailure> {
    static CLIENT: OnceLock<Option<reqwest::Client>> = OnceLock::new();
    CLIENT
        .get_or_init(|| {
            reqwest::Client::builder()
                .redirect(reqwest::redirect::Policy::none())
                // A proxy from the environment would carry recordings off the
                // hospital's network; the services are reached directly.
                .no_proxy()
                .timeout(STT_TIMEOUT)
                .build()
                .ok()
        })
        .as_ref()
        .ok_or(SttFailure::Unreachable)
}

/// Both services answer `{ "text": "…" }`.
#[derive(Deserialize)]
struct Transcription {
    text: String,
}

/// Send the form and read the transcript, at most [`MAX_RESPONSE_BYTES`].
async fn post_form(request: reqwest::RequestBuilder, form: &Form) -> Result<String, SttFailure> {
    let mut response = request
        .header(
            "content-type",
            format!("multipart/form-data; boundary={BOUNDARY}"),
        )
        .body(form.body.clone())
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
    if response
        .content_length()
        .is_some_and(|n| n > MAX_RESPONSE_BYTES as u64)
    {
        return Err(SttFailure::Refused);
    }
    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|e| {
        if e.is_timeout() {
            SttFailure::Timeout
        } else {
            SttFailure::Unreachable
        }
    })? {
        if body.len() + chunk.len() > MAX_RESPONSE_BYTES {
            return Err(SttFailure::Refused);
        }
        body.extend_from_slice(&chunk);
    }
    let answer: Transcription = serde_json::from_slice(&body).map_err(|_| SttFailure::Refused)?;
    Ok(answer.text.trim().to_owned())
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
    use super::{Adapter, Form, SpeechToText, SttFailure, choose};
    use crate::settings::DictationConfig;
    use std::future::Future;

    /// A stand-in service: answers with `reply`.
    struct Fake(Result<String, SttFailure>);

    impl SpeechToText for Fake {
        fn name(&self) -> &'static str {
            "fake"
        }
        fn transcribe(
            &self,
            _form: &Form,
        ) -> impl Future<Output = Result<String, SttFailure>> + Send {
            std::future::ready(self.0.clone())
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
        let form = Form::new(b"x", "audio/webm", "whisper-1");
        assert_eq!(
            Fake(Err(SttFailure::Timeout)).transcribe(&form).await,
            Err(SttFailure::Timeout)
        );
        assert_eq!(
            Fake(Ok("hi".to_owned())).transcribe(&form).await.as_deref(),
            Ok("hi")
        );
    }

    #[test]
    fn the_form_holds_the_audio_once_and_names_the_file_by_its_type() {
        let form = Form::new(b"RIFF", "audio/webm", "whisper-1");
        assert_eq!(form.audio(), b"RIFF");
        let text = String::from_utf8_lossy(&form.body);
        assert!(text.contains("name=\"response_format\"\r\n\r\njson\r\n"));
        assert!(text.contains("filename=\"dictation.webm\""));
        assert!(text.ends_with("--\r\n"));
    }
}
