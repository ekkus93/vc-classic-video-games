use crate::APP_NAME;

const MAX_DIAGNOSTIC_MESSAGE_BYTES: usize = 64;

#[tauri::command]
pub fn diagnostic_ping(message: String) -> Result<(String, &'static str), String> {
    let message = message.trim();

    if message.is_empty() {
        return Err("diagnostic message must not be empty".to_owned());
    }

    if message.len() > MAX_DIAGNOSTIC_MESSAGE_BYTES {
        return Err(format!(
            "diagnostic message must be at most {MAX_DIAGNOSTIC_MESSAGE_BYTES} bytes"
        ));
    }

    Ok((message.to_owned(), APP_NAME))
}

#[cfg(test)]
mod tests {
    use super::diagnostic_ping;
    use crate::APP_NAME;

    #[test]
    fn ping_trims_and_echoes_valid_input() {
        let response = diagnostic_ping(" launcher-ready ".to_owned()).expect("valid ping");

        assert_eq!(response.0, "launcher-ready");
        assert_eq!(response.1, APP_NAME);
    }

    #[test]
    fn ping_rejects_empty_input() {
        let error = diagnostic_ping("   ".to_owned()).expect_err("empty ping must fail");

        assert_eq!(error, "diagnostic message must not be empty");
    }

    #[test]
    fn ping_rejects_oversized_input() {
        let error = diagnostic_ping("x".repeat(65)).expect_err("oversized ping must fail");

        assert_eq!(error, "diagnostic message must be at most 64 bytes");
    }
}
