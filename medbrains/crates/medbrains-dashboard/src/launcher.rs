//! The signed-in person's launcher: the screens they starred and the app names.
//!
//! Both routes are the person's own data, like the notification feed: there is
//! no role that should be refused a favourite, so no permission gates them.
//! Every query names the caller's tenant (RLS) and `user_id = claims.sub`, and
//! the routes sit under `/api/users/me/`, which an API key can never reach.
//! A path is stored as given and never opens anything: the web app shows a
//! starred screen only while the person may open it.

use axum::Json;
use axum::extract::{Extension, State};
use medbrains_core::bricks::BRICKS;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// The most screens one person may star; the launcher shows them all.
pub const MAX_FAVOURITES: i64 = 50;
/// The longest route path a favourite may hold (matches the table's CHECK).
const MAX_PATH_LEN: usize = 200;

/// An app brick's code and the name the launcher shows for it.
#[derive(Debug, Serialize)]
pub struct BrickName {
    pub id: &'static str,
    pub name: &'static str,
}

/// `GET /api/users/me/launcher`.
#[derive(Debug, Serialize)]
pub struct LauncherResponse {
    pub favourites: Vec<String>,
    pub bricks: Vec<BrickName>,
}

/// `PUT /api/users/me/favourites` body: star or unstar one screen.
#[derive(Debug, Deserialize)]
pub struct SetFavourite {
    pub path: String,
    pub starred: bool,
}

/// `PUT /api/users/me/favourites` answer: the list after the change.
#[derive(Debug, Serialize)]
pub struct FavouritesResponse {
    pub favourites: Vec<String>,
}

/// Whether `path` is a route path a favourite may hold: `/` then letters,
/// digits, `/`, `_` or `-`. Refusing anything else here gives a plain 400
/// instead of the table's CHECK failing as a 500.
fn is_screen_path(path: &str) -> bool {
    path.len() <= MAX_PATH_LEN
        && path.starts_with('/')
        && path
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'/' | b'_' | b'-'))
}

/// One person's starred paths, oldest first, in the caller's open transaction.
///
/// # Errors
/// The database could not be read.
pub async fn list_favourites(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<String>, sqlx::Error> {
    sqlx::query_scalar!(
        "SELECT path FROM user_favourite_screens \
         WHERE tenant_id = $1 AND user_id = $2 ORDER BY created_at, path LIMIT $3",
        tenant_id,
        user_id,
        MAX_FAVOURITES,
    )
    .fetch_all(&mut **tx)
    .await
}

/// Star or unstar `path` for one person, then answer their list. A star past
/// [`MAX_FAVOURITES`] is not written, so the path is missing from the answer.
///
/// # Errors
/// The database could not be written or read.
pub async fn write_favourite(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    (tenant_id, user_id): (Uuid, Uuid),
    path: &str,
    starred: bool,
) -> Result<Vec<String>, sqlx::Error> {
    if starred {
        sqlx::query!(
            "INSERT INTO user_favourite_screens (tenant_id, user_id, path) \
             SELECT $1, $2, $3 WHERE (SELECT count(*) FROM user_favourite_screens \
             WHERE tenant_id = $1 AND user_id = $2) < $4 ON CONFLICT DO NOTHING",
            tenant_id,
            user_id,
            path,
            MAX_FAVOURITES,
        )
        .execute(&mut **tx)
        .await?;
    } else {
        sqlx::query!(
            "DELETE FROM user_favourite_screens \
             WHERE tenant_id = $1 AND user_id = $2 AND path = $3",
            tenant_id,
            user_id,
            path,
        )
        .execute(&mut **tx)
        .await?;
    }
    list_favourites(tx, tenant_id, user_id).await
}

/// GET /api/users/me/launcher — the caller's favourites and every app's name.
///
/// One round trip. Names come from `bricks.rs`, the one table that names
/// apps; the web app hides the bricks that are off or that the person cannot open.
pub async fn get_launcher(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<LauncherResponse>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let favourites = list_favourites(&mut tx, claims.tenant_id, claims.sub).await?;
    tx.commit().await?;
    let bricks = BRICKS
        .iter()
        .map(|b| BrickName {
            id: b.id,
            name: b.name,
        })
        .collect();
    Ok(Json(LauncherResponse { favourites, bricks }))
}

/// PUT /api/users/me/favourites — star or unstar one screen for the caller.
pub async fn set_favourite(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<SetFavourite>,
) -> Result<Json<FavouritesResponse>, AppError> {
    if !is_screen_path(&body.path) {
        return Err(AppError::BadRequest("That is not a screen address.".into()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let owner = (claims.tenant_id, claims.sub);
    let favourites = write_favourite(&mut tx, owner, &body.path, body.starred).await?;
    tx.commit().await?;
    if body.starred && !favourites.contains(&body.path) {
        return Err(AppError::BadRequest(format!(
            "You can keep up to {MAX_FAVOURITES} favourites. Unstar one first."
        )));
    }
    Ok(Json(FavouritesResponse { favourites }))
}

#[cfg(test)]
mod tests {
    use super::is_screen_path;

    #[test]
    fn only_route_paths_are_accepted() {
        assert!(is_screen_path("/pharmacy/h1-register"));
        assert!(!is_screen_path("pharmacy"));
        assert!(!is_screen_path("/x?next=https://evil"));
        assert!(!is_screen_path("javascript:alert(1)"));
        assert!(!is_screen_path(&format!("/{}", "a".repeat(200))));
    }
}
