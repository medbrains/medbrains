//! Images of the person's ABHA — the printable card and the QR code (ABHA V3
//! SOP §9, §10, §12.3.2–3). All need the person's token, so they are only
//! available while their verification at the desk is live.

use crate::abha::{AbdmAbhaClient, AbdmError, UserToken, abdm_message};

pub const ABHA_CARD_PATH: &str = "/v3/profile/account/abha-card";
pub const ABHA_QR_PATH: &str = "/v3/profile/account/qrCode";
pub const PHR_CARD_PATH: &str = "/login/profile/abha/phr-card";
pub const PHR_QR_PATH: &str = "/login/profile/abha/qr-code";

/// An image ABDM returns, with its content type.
#[derive(Debug)]
pub struct AbhaCard {
    pub bytes: Vec<u8>,
    pub content_type: String,
}

/// Which ABHA image to fetch.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AbhaImage {
    Card,
    Qr,
}

impl AbdmAbhaClient {
    /// The ABHA card or QR, made with the person's X-token. `by_address` picks
    /// the ABHA-address (PHR) APIs, whose tokens the ABHA-number APIs refuse.
    ///
    /// # Errors
    /// [`AbdmError`] as for every call.
    pub async fn abha_image(
        &self,
        session: &str,
        x_token: &str,
        image: AbhaImage,
        by_address: bool,
    ) -> Result<AbhaCard, AbdmError> {
        let user = Some(UserToken::X(x_token));
        let builder = match (by_address, image) {
            (false, AbhaImage::Card) => self.get(ABHA_CARD_PATH, session, user),
            (false, AbhaImage::Qr) => self.get(ABHA_QR_PATH, session, user),
            (true, AbhaImage::Card) => self.phr_get(PHR_CARD_PATH, session, user),
            (true, AbhaImage::Qr) => self.phr_get(PHR_QR_PATH, session, user),
        };
        let response = builder.send().await?;
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
