use std::{path::Path, process::Command};

use serde::Serialize;
use tauri::Manager;

#[derive(Debug, Serialize)]
pub(crate) struct SystemInfo {
    pub(crate) platform: String,
    pub(crate) arch: String,
    pub(crate) version: String,
    pub(crate) app_version: String,
    pub(crate) locale: String,
}

#[tauri::command]
pub(crate) fn system_info() -> SystemInfo {
    SystemInfo {
        platform: std::env::consts::OS.into(),
        arch: std::env::consts::ARCH.into(),
        version: tauri_plugin_os::version().to_string(),
        app_version: env!("CARGO_PKG_VERSION").into(),
        locale: tauri_plugin_os::locale().unwrap_or_else(|| "en-IN".into()),
    }
}

#[tauri::command]
pub(crate) async fn open_settings_dir(app: tauri::AppHandle) -> Result<(), String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("resolve app settings dir: {err}"))?;
    open_path(&dir)
}

fn open_path(path: &Path) -> Result<(), String> {
    let mut command = if cfg!(target_os = "macos") {
        Command::new("open")
    } else if cfg!(target_os = "windows") {
        Command::new("explorer")
    } else {
        Command::new("xdg-open")
    };

    let status = command
        .arg(path)
        .status()
        .map_err(|err| format!("open settings dir: {err}"))?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("open settings dir exited with status {status}"))
    }
}
