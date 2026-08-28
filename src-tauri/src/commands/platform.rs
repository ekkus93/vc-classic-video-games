#[tauri::command]
pub fn platform_info() -> (&'static str, &'static str, &'static str) {
    (
        std::env::consts::OS,
        std::env::consts::ARCH,
        env!("CARGO_PKG_VERSION"),
    )
}

#[tauri::command]
pub fn set_fullscreen(window: tauri::WebviewWindow, fullscreen: bool) -> Result<(), String> {
    window
        .set_fullscreen(fullscreen)
        .map_err(|error| format!("failed to change fullscreen state: {error}"))
}

#[cfg(test)]
mod tests {
    use super::platform_info;

    #[test]
    fn platform_info_is_non_empty_and_uses_package_version() {
        let info = platform_info();

        assert!(!info.0.is_empty());
        assert!(!info.1.is_empty());
        assert_eq!(info.2, env!("CARGO_PKG_VERSION"));
    }
}
