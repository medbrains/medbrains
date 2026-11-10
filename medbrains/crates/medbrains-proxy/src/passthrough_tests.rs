use super::{MedBrainsProxy, PASSTHROUGH_CLASS, ProxyConfig};

const CONFIG: &str = r#"
    [[routes]]
    domain = "hims.example.in"
    upstream = "127.0.0.1:3000"

    [[routes]]
    domain = "errors.hims.example.in"
    upstream = "127.0.0.1:8180"
    passthrough = true
"#;

fn proxy() -> anyhow::Result<MedBrainsProxy> {
    let cfg: ProxyConfig = toml::from_str(CONFIG)?;
    MedBrainsProxy::from_config(&cfg)
}

#[test]
fn a_passthrough_route_lets_its_application_take_any_method_on_any_path() -> anyhow::Result<()> {
    let proxy = proxy()?;
    let errors = proxy
        .routes
        .get("errors.hims.example.in")
        .ok_or_else(|| anyhow::anyhow!("route"))?;
    let policy = proxy.edge_policy_for_route(errors, "/auth/login");
    assert_eq!(policy.class, PASSTHROUGH_CLASS);
    assert!(policy.allowed_methods.is_empty(), "every method but TRACE");
    assert!(policy.cache_control.is_none());
    Ok(())
}

#[test]
fn the_hospital_route_keeps_the_medbrains_edge_policies() -> anyhow::Result<()> {
    let proxy = proxy()?;
    let app = proxy
        .routes
        .get("hims.example.in")
        .ok_or_else(|| anyhow::anyhow!("route"))?;
    let policy = proxy.edge_policy_for_route(app, "/auth/login");
    assert_eq!(policy.class, "spa");
    assert!(!policy.allowed_methods.iter().any(|m| m == "POST"));
    Ok(())
}
