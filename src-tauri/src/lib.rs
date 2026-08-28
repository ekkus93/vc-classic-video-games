#![forbid(unsafe_code)]

mod commands;

pub const APP_NAME: &str = "VC Classic Video Games";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> tauri::Result<()> {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::diagnostic_ping,
            commands::platform_info,
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
