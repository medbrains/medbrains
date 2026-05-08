// Prevents additional console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

mod commands;

fn main() {
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
                WebviewUrl::External("http://localhost:5173".parse().unwrap())
            } else {
                WebviewUrl::App("index.html".into())
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
        .expect("error while running tauri application");
}
