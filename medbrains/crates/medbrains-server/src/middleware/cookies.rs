use axum_extra::extract::cookie::{Cookie, SameSite};
use time::Duration;

use crate::state::CookieConfig;

/// Build the `access_token` cookie — `HttpOnly`, not readable by JS.
pub fn build_access_cookie<'a>(token: &str, cfg: &CookieConfig) -> Cookie<'a> {
    let mut cookie = Cookie::build(("access_token", token.to_owned()))
        .http_only(true)
        .same_site(SameSite::Lax)
        .path("/api")
        .max_age(Duration::minutes(15))
        .secure(cfg.secure)
        .build();
    if let Some(ref domain) = cfg.domain {
        cookie.set_domain(domain.clone());
    }
    cookie
}

/// Build the `refresh_token` cookie — `HttpOnly`, scoped to auth path only.
pub fn build_refresh_cookie<'a>(token: &str, cfg: &CookieConfig) -> Cookie<'a> {
    let mut cookie = Cookie::build(("refresh_token", token.to_owned()))
        .http_only(true)
        .same_site(SameSite::Lax)
        .path("/api/auth")
        .max_age(Duration::days(7))
        .secure(cfg.secure)
        .build();
    if let Some(ref domain) = cfg.domain {
        cookie.set_domain(domain.clone());
    }
    cookie
}

/// Build the `csrf_token` cookie — readable by JS for double-submit pattern.
pub fn build_csrf_cookie<'a>(token: &str, cfg: &CookieConfig) -> Cookie<'a> {
    let mut cookie = Cookie::build(("csrf_token", token.to_owned()))
        .http_only(false)
        .same_site(SameSite::Lax)
        .path("/")
        .max_age(Duration::minutes(15))
        .secure(cfg.secure)
        .build();
    if let Some(ref domain) = cfg.domain {
        cookie.set_domain(domain.clone());
    }
    cookie
}

/// Build the `step_up` cookie — a short-lived (5 min) re-auth proof, `HttpOnly`,
/// scoped to the API. Set by POST /api/auth/step-up; checked by `require_step_up`.
pub fn build_step_up_cookie<'a>(token: &str, cfg: &CookieConfig) -> Cookie<'a> {
    let mut cookie = Cookie::build(("step_up", token.to_owned()))
        .http_only(true)
        .same_site(SameSite::Lax)
        .path("/api")
        .max_age(Duration::minutes(5))
        .secure(cfg.secure)
        .build();
    if let Some(ref domain) = cfg.domain {
        cookie.set_domain(domain.clone());
    }
    cookie
}

/// Build a cookie that clears (deletes) an existing cookie by name.
pub fn clear_cookie<'a>(name: &str, path: &str, cfg: &CookieConfig) -> Cookie<'a> {
    let mut cookie = Cookie::build((name.to_owned(), String::new()))
        .http_only(true)
        .same_site(SameSite::Lax)
        .path(path.to_owned())
        .max_age(Duration::ZERO)
        .secure(cfg.secure)
        .build();
    if let Some(ref domain) = cfg.domain {
        cookie.set_domain(domain.clone());
    }
    cookie
}
