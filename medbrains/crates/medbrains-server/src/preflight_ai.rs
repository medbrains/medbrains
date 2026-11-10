//! Startup checks for where the AI assistant sends its prompts. Every
//! assistant call can carry patient data, and patient data never leaves India.

use medbrains_anthropic_auth::{AuthError, FederationConfig};
use medbrains_infra_settings::preflight::Finding;
use medbrains_server_services::llm;

/// The Bedrock region, a warning when the default provider is outside India,
/// and — for Anthropic — whether its federation is configured.
#[must_use]
pub fn checks() -> Vec<Finding> {
    let region = std::env::var("BEDROCK_REGION").ok();
    let base = std::env::var("BEDROCK_BASE_URL").ok();
    let provider = std::env::var("AI_PROVIDER").unwrap_or_default();
    let mut found = vec![
        region_check(region.as_deref(), base.as_deref()),
        provider_check(&provider),
    ];
    if provider == "anthropic" {
        found.push(federation_check(&FederationConfig::from_env()));
    }
    found
}

/// Anthropic has no API key: without its federation IDs every AI call fails.
fn federation_check(cfg: &Result<FederationConfig, AuthError>) -> Finding {
    match cfg {
        Ok(cfg) => Finding::ok(
            "ai.anthropic_federation",
            format!(
                "Anthropic access via AWS identity federation (token signed in {})",
                cfg.aws_region
            ),
        ),
        Err(e) => Finding::fail(
            "ai.anthropic_federation",
            e.to_string(),
            "Set ANTHROPIC_FEDERATION_RULE_ID, ANTHROPIC_ORGANIZATION_ID, ANTHROPIC_SERVICE_ACCOUNT_ID and ANTHROPIC_WORKSPACE_ID (see .env.example), or use AI_PROVIDER=bedrock",
        ),
    }
}

fn region_check(region: Option<&str>, base: Option<&str>) -> Finding {
    match llm::bedrock_url_from(region, base) {
        Ok(url) => Finding::ok("ai.bedrock_region", format!("Bedrock calls go to {url}")),
        Err(why) => Finding::fail(
            "ai.bedrock_region",
            why,
            "Set BEDROCK_REGION=ap-south-1 (or ap-south-2), or unset BEDROCK_BASE_URL",
        ),
    }
}

fn provider_check(provider: &str) -> Finding {
    match provider {
        "anthropic" | "openrouter" => Finding::warn(
            "ai.provider_region",
            format!("AI_PROVIDER={provider} sends assistant prompts outside India"),
            "Set AI_PROVIDER=bedrock (ap-south-1) or ollama",
        ),
        "" => Finding::ok("ai.provider_region", "AI_PROVIDER not set"),
        other => Finding::ok("ai.provider_region", format!("AI_PROVIDER={other}")),
    }
}

#[cfg(test)]
mod tests {
    use super::{AuthError, FederationConfig, federation_check, provider_check, region_check};
    use medbrains_infra_settings::preflight::Level;

    #[test]
    fn a_us_region_fails_the_check() {
        assert_eq!(region_check(Some("us-east-1"), None).level, Level::Fail);
        assert_eq!(region_check(None, None).level, Level::Ok);
    }

    #[test]
    fn a_provider_outside_india_warns() {
        assert_eq!(provider_check("anthropic").level, Level::Warn);
        assert_eq!(provider_check("bedrock").level, Level::Ok);
    }

    #[test]
    fn anthropic_without_federation_fails_and_names_what_is_missing() {
        let missing = federation_check(&Err(AuthError::Missing(
            "ANTHROPIC_WORKSPACE_ID".to_owned(),
        )));
        assert_eq!(missing.level, Level::Fail);
        assert!(missing.detail.contains("ANTHROPIC_WORKSPACE_ID"));
        let cfg = FederationConfig::from_lookup(|k| Some(format!("{k}-value")));
        assert_eq!(federation_check(&cfg).level, Level::Ok);
    }
}
