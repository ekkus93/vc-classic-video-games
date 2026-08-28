#![forbid(unsafe_code)]

/// Product name shared by the native scaffold.
pub const APP_NAME: &str = "VC Classic Video Games";

#[cfg(test)]
mod tests {
    use super::APP_NAME;

    #[test]
    fn app_name_is_stable() {
        assert_eq!(APP_NAME, "VC Classic Video Games");
    }
}
