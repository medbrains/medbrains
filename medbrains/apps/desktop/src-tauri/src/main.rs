// Prevents additional console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::menu::{Menu, MenuEvent, MenuItem, Submenu};
use tauri::{App, AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, Wry};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tauri_plugin_updater::UpdaterExt;

mod commands;
mod error_tracking;

use commands::server::{self, ChosenServer, MAIN_WINDOW, SETUP_PAGE};

/// The menu item that sends the window back to the setup screen.
const CHANGE_SERVER_MENU_ID: &str = "change-server";

/// Starts the desktop client: plugins, commands, the menu, the window.
fn main() -> tauri::Result<()> {
    let subscriber = tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "medbrains_desktop=info,tauri=info".into()),
        )
        .json()
        .finish();
    tracing::subscriber::set_global_default(subscriber).ok();

    tauri::Builder::default()
        // One running instance per machine — second launch focuses the
        // existing window instead of spawning a duplicate process.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_deep_link::init())
        .manage(ChosenServer::default())
        .invoke_handler(tauri::generate_handler![
            server::desktop_server_read_code,
            server::desktop_server_connect,
            server::desktop_server_forget,
        ])
        .menu(app_menu)
        .on_menu_event(|app, event| on_menu_event(app, &event))
        .setup(|app| {
            if let Some(origin) = server::configured(app.handle()) {
                tauri::async_runtime::spawn(error_tracking::start(origin));
            }
            open_main_window(app)?;
            if !cfg!(debug_assertions) {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(error) = offer_update(handle).await {
                        tracing::warn!(%error, "update check failed");
                    }
                });
            }
            tracing::info!("medbrains desktop ready");
            Ok(())
        })
        .run(tauri::generate_context!())
}

/// The platform's default menu plus a "Server" menu, so a server that stops
/// answering never leaves the person with no way back to setup.
fn app_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let menu = Menu::default(app)?;
    let change = MenuItem::with_id(
        app,
        CHANGE_SERVER_MENU_ID,
        "Change hospital server…",
        true,
        None::<&str>,
    )?;
    menu.append(&Submenu::with_items(app, "Server", true, &[&change])?)?;
    Ok(menu)
}

/// "Change hospital server…": confirm, then forget the server and restart.
fn on_menu_event(app: &AppHandle, event: &MenuEvent) {
    if event.id() != CHANGE_SERVER_MENU_ID {
        return;
    }
    let handle = app.clone();
    app.dialog()
        .message("MedBrains will restart and ask for the hospital server's address.")
        .title("Change hospital server")
        .buttons(MessageDialogButtons::OkCancelCustom(
            "Change".into(),
            "Cancel".into(),
        ))
        .show(move |confirmed| {
            if confirmed && let Err(error) = server::forget(&handle) {
                tracing::warn!(%error, "could not forget the hospital server");
            }
        });
}

/// Open the chosen server's web app, or the setup screen when none is chosen.
/// Every navigation passes the lock in [`server::may_navigate`].
fn open_main_window(app: &App) -> tauri::Result<()> {
    let handle = app.handle().clone();
    let url = match server::configured(&handle) {
        Some(origin) => WebviewUrl::External(server::admit(&handle, &origin)?),
        None => WebviewUrl::App(SETUP_PAGE.into()),
    };
    let lock = handle;
    WebviewWindowBuilder::new(app, MAIN_WINDOW, url)
        .title("MedBrains")
        .inner_size(1440.0, 900.0)
        .min_inner_size(1024.0, 720.0)
        .center()
        .visible(true)
        .on_navigation(move |url| {
            let allowed = server::may_navigate(&lock, url);
            if !allowed {
                tracing::warn!(%url, "navigation outside the hospital server blocked");
            }
            allowed
        })
        .build()?;
    Ok(())
}

/// Check GitHub Releases for a signed update and offer to install it. The
/// updater refuses any package not signed by the key in `tauri.conf.json`.
async fn offer_update(app: AppHandle) -> tauri_plugin_updater::Result<()> {
    let Some(update) = app.updater()?.check().await? else {
        return Ok(());
    };
    let version = update.version.clone();
    let handle = app.clone();
    app.dialog()
        .message(format!(
            "MedBrains {version} is ready. Install it and restart?"
        ))
        .title("Update available")
        .buttons(MessageDialogButtons::OkCancelCustom(
            "Install and restart".into(),
            "Later".into(),
        ))
        .show(move |install| {
            if !install {
                return;
            }
            tauri::async_runtime::spawn(async move {
                match update.download_and_install(|_, _| {}, || {}).await {
                    Ok(()) => handle.restart(),
                    Err(error) => tracing::warn!(%error, "update install failed"),
                }
            });
        });
    Ok(())
}
