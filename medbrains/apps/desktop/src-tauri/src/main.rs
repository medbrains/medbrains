// Prevents additional console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Manager, Url, WebviewUrl, WebviewWindowBuilder};

mod commands;

fn start_route() -> String {
    let route = std::env::var("MEDBRAINS_DESKTOP_START_ROUTE").unwrap_or_else(|_| "/".into());
    if route.starts_with('/') {
        route
    } else {
        format!("/{route}")
    }
}

fn dev_url() -> Result<Url, url::ParseError> {
    let base = std::env::var("MEDBRAINS_DESKTOP_DEV_URL")
        .unwrap_or_else(|_| "https://medbrains-desktop.localhost".into());
    let base = base.trim_end_matches('/');
    let mut url: Url = format!("{base}{}", start_route()).parse()?;
    if let Some(api_base) = desktop_api_base() {
        url.query_pairs_mut()
            .append_pair("desktopApiBase", &api_base);
    }
    Ok(url)
}

fn desktop_api_base() -> Option<String> {
    let value = std::env::var("MEDBRAINS_DESKTOP_API_BASE").ok()?;
    let value = value.trim().trim_end_matches('/');
    if value.is_empty() {
        None
    } else {
        Some(value.into())
    }
}

fn app_index_path() -> String {
    let route = start_route();
    let api_base = desktop_api_base();
    if route == "/" && api_base.is_none() {
        return "index.html".into();
    }

    let mut query = url::form_urlencoded::Serializer::new(String::new());
    if route != "/" {
        query.append_pair("desktopStartRoute", &route);
    }
    if let Some(api_base) = api_base {
        query.append_pair("desktopApiBase", &api_base);
    }
    format!("index.html?{}", query.finish())
}

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
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_deep_link::init())
        .invoke_handler(tauri::generate_handler![
            commands::system::system_info,
            commands::system::open_settings_dir,
            commands::printer::list_printers,
            commands::printer::print_pdf,
        ])
        .setup(|app| {
            // Main window opens to the SPA's login route. Production
            // installs ship the dist/ bundle bundled in the binary;
            // dev points at the running Vite server.
            let url = if cfg!(debug_assertions) {
                WebviewUrl::External(dev_url()?)
            } else {
                WebviewUrl::App(app_index_path().into())
            };

            WebviewWindowBuilder::new(app, "main", url)
                .title("MedBrains HMS")
                .inner_size(1440.0, 900.0)
                .min_inner_size(1024.0, 720.0)
                .center()
                .visible(true)
                .build()?;

            tracing::info!("medbrains desktop ready");
            Ok(())
        })
        .run(tauri::generate_context!())
}
