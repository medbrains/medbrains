use thiserror::Error;

#[derive(Debug, Error)]
pub enum FormatError {
    #[error("could not read {format}: {message}")]
    Parse {
        format: &'static str,
        message: String,
    },

    #[error("could not write {format}: {message}")]
    Serialize {
        format: &'static str,
        message: String,
    },
}

impl FormatError {
    pub(crate) fn json(error: &serde_json::Error) -> Self {
        FormatError::Parse {
            format: "JSON",
            message: error.to_string(),
        }
    }
}

pub type Result<T> = std::result::Result<T, FormatError>;
