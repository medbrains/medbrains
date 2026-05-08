use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct SystemInfo {
    pub platform: String,
    pub arch: String,
    pub version: String,
    pub app_version: String,
    pub locale: String,
}

#[tauri::command]
pub fn system_info() -> SystemInfo {
    SystemInfo {
        platform: std::env::consts::OS.into(),
        arch: std::env::consts::ARCH.into(),
        version: tauri_plugin_os::version().to_string(),
        app_version: env!("CARGO_PKG_VERSION").into(),
        locale: tauri_plugin_os::locale().unwrap_or_else(|| "en-IN".into()),
    }
}

#[tauri::command]
pub async fn open_settings_dir(app: tauri::AppHandle) -> Result<(), tauri::Error> {
    use tauri_plugin_shell::ShellExt;
    let dir = app.path().app_data_dir()?;
    app.shell().open(dir.to_string_lossy().to_string(), None)?;
    Ok(())
}
