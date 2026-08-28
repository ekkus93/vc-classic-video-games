#![forbid(unsafe_code)]

mod commands;
mod persistence;

pub const APP_NAME: &str = "VC Classic Video Games";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> tauri::Result<()> {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::diagnostics::diagnostic_ping,
            commands::platform::platform_info,
            commands::platform::set_fullscreen,
            commands::persistence::load_json_document,
            commands::persistence::save_json_document,
        ])
        .run(tauri::generate_context!())
}

#[cfg(test)]
mod tests {
    use super::APP_NAME;

    #[test]
    fn app_name_is_stable() {
        assert_eq!(APP_NAME, "VC Classic Video Games");
    }
}
