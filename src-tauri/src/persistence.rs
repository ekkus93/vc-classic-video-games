use std::fs::{self, File};
use std::io::{self, Write};
use std::path::{Path, PathBuf};

const MAX_JSON_BYTES: usize = 2 * 1024 * 1024;

fn valid_game_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
        && !value.starts_with('-')
}

pub fn document_path(
    root: &Path,
    document: &str,
    game_id: Option<&str>,
) -> Result<PathBuf, String> {
    match document {
        "settings" if game_id.is_none() => Ok(root.join("settings.json")),
        "scores" if game_id.is_none() => Ok(root.join("scores.json")),
        "game-state" => {
            let game_id = game_id.ok_or_else(|| "game-state requires gameId".to_owned())?;
            if !valid_game_id(game_id) {
                return Err("invalid gameId".to_owned());
            }
            Ok(root.join("games").join(format!("{game_id}.json")))
        }
        "settings" | "scores" => Err(format!("{document} does not accept gameId")),
        _ => Err("unsupported persistence document".to_owned()),
    }
}

pub fn load_json_document(
    root: &Path,
    document: &str,
    game_id: Option<&str>,
) -> Result<Option<String>, String> {
    let path = document_path(root, document, game_id)?;
    match fs::read_to_string(&path) {
        Ok(value) => Ok(Some(value)),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("failed to read {}: {error}", path.display())),
    }
}

pub fn save_json_document(
    root: &Path,
    document: &str,
    game_id: Option<&str>,
    json: &str,
) -> Result<(), String> {
    if json.len() > MAX_JSON_BYTES {
        return Err(format!("JSON document exceeds {MAX_JSON_BYTES} bytes"));
    }
    let path = document_path(root, document, game_id)?;
    let parent = path
        .parent()
        .ok_or_else(|| "persistence path has no parent".to_owned())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;

    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "invalid persistence filename".to_owned())?;
    let temp = parent.join(format!(".{file_name}.tmp"));
    let result = (|| -> Result<(), String> {
        let mut file = File::create(&temp)
            .map_err(|error| format!("failed to create {}: {error}", temp.display()))?;
        file.write_all(json.as_bytes())
            .map_err(|error| format!("failed to write {}: {error}", temp.display()))?;
        file.sync_all()
            .map_err(|error| format!("failed to sync {}: {error}", temp.display()))?;
        fs::rename(&temp, &path)
            .map_err(|error| format!("failed to replace {}: {error}", path.display()))?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::{document_path, load_json_document, save_json_document};
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_root() -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time")
            .as_nanos();
        std::env::temp_dir().join(format!("vc-classic-persistence-{nonce}"))
    }

    #[test]
    fn atomically_round_trips_json_document() {
        let root = temp_root();
        save_json_document(&root, "settings", None, r#"{"version":1}"#).expect("save");
        assert_eq!(
            load_json_document(&root, "settings", None)
                .expect("load")
                .as_deref(),
            Some(r#"{"version":1}"#)
        );
        assert!(!root.join(".settings.json.tmp").exists());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn game_state_is_namespaced_and_rejects_path_traversal() {
        let root = temp_root();
        let a = document_path(&root, "game-state", Some("game-a")).expect("game a");
        let b = document_path(&root, "game-state", Some("game-b")).expect("game b");
        assert_ne!(a, b);
        assert!(document_path(&root, "game-state", Some("../escape")).is_err());
    }

    #[test]
    fn stale_temp_file_is_ignored_during_read() {
        let root = temp_root();
        fs::create_dir_all(&root).expect("mkdir");
        fs::write(root.join("settings.json"), "good").expect("main");
        fs::write(root.join(".settings.json.tmp"), "partial").expect("temp");
        assert_eq!(
            load_json_document(&root, "settings", None)
                .expect("load")
                .as_deref(),
            Some("good")
        );
        let _ = fs::remove_dir_all(root);
    }
}
