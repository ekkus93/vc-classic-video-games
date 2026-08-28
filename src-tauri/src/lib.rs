#![forbid(unsafe_code)]

pub const APP_NAME: &str = "VC Classic Video Games";

pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("failed to run VC Classic Video Games");
}

#[cfg(test)]
mod tests {
    use super::APP_NAME;

    #[test]
    fn app_name_is_stable() {
        assert_eq!(APP_NAME, "VC Classic Video Games");
    }
}
