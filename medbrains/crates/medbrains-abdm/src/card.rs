//! The person's ABHA card (ABHA V3 SOP §10), for printing at the desk.

use crate::abha::{AbdmAbhaClient, AbdmError, UserToken, abdm_message};

pub const ABHA_CARD_PATH: &str = "/v3/profile/account/abha-card";

/// The card image ABDM returns, with its content type.
#[derive(Debug)]
pub struct AbhaCard {
    pub bytes: Vec<u8>,
    pub content_type: String,
}

impl AbdmAbhaClient {
    /// The ABHA card, made with the person's X-token.
    ///
    /// # Errors
    /// [`AbdmError`] as for every call.
    pub async fn abha_card(&self, session: &str, x_token: &str) -> Result<AbhaCard, AbdmError> {
        let response = self
            .get(ABHA_CARD_PATH, session, Some(UserToken::X(x_token)))
            .send()
            .await?;
        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(AbdmError::Status {
                status,
                message: abdm_message(&body),
            });
        }
        let content_type = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("image/png")
            .to_owned();
        Ok(AbhaCard {
            bytes: response.bytes().await?.to_vec(),
            content_type,
        })
    }
}
