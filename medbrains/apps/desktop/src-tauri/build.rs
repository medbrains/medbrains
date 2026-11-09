/// Generates the Tauri context and an `allow-<command>` permission for every
/// app command, so capabilities can grant each one by name. Without the
/// manifest a remote page could not be granted a command one at a time.
fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let commands = tauri_build::AppManifest::new().commands(&[
        "system_info",
        "open_settings_dir",
        "list_printers",
        "print_pdf",
        "keyring_set",
        "keyring_get",
        "keyring_delete",
        "desktop_server_read_code",
        "desktop_server_connect",
        "desktop_server_forget",
    ]);
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(commands))?;
    Ok(())
}
