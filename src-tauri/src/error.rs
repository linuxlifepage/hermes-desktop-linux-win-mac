use std::io;

#[derive(Debug, thiserror::Error)]
pub enum HermesError {
    #[error("{0}")]
    Validation(String),
    #[error("{0}")]
    Remote(String),
    #[error("Unable to read or write local app data: {0}")]
    Storage(#[from] io::Error),
    #[error("Unable to encode or decode app data: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Unable to start ssh: {0}")]
    Launch(String),
    #[error("Remote output was not valid UTF-8.")]
    InvalidUtf8,
    #[error("Remote output was not valid JSON: {0}")]
    InvalidJson(String),
}

pub type Result<T> = std::result::Result<T, HermesError>;
