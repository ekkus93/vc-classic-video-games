use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

const MAX_JSON_BYTES: usize = 2 * 1024 * 1024;
static NEXT_TEMP_ID: AtomicU64 = AtomicU64::new(0);

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

fn create_unique_temp(parent: &Path, file_name: &str) -> Result<(PathBuf, File), String> {
    loop {
        let attempt = NEXT_TEMP_ID.fetch_add(1, Ordering::Relaxed);
        let temp = parent.join(format!(
            ".{file_name}.{}.{}.tmp",
            std::process::id(),
            attempt
        ));
        match OpenOptions::new().write(true).create_new(true).open(&temp) {
            Ok(file) => return Ok((temp, file)),
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(error) => {
                return Err(format!("failed to create {}: {error}", temp.display()));
            }
        }
    }
}

fn save_json_document_with_hook<F>(
    root: &Path,
    document: &str,
    game_id: Option<&str>,
    json: &str,
    after_temp_created: F,
) -> Result<(), String>
where
    F: FnOnce(),
{
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
    let (temp, mut file) = create_unique_temp(parent, file_name)?;
    after_temp_created();
    let result = (|| -> Result<(), String> {
        file.write_all(json.as_bytes())
            .map_err(|error| format!("failed to write {}: {error}", temp.display()))?;
        file.sync_all()
            .map_err(|error| format!("failed to sync {}: {error}", temp.display()))?;
        fs::rename(&temp, &path)
            .map_err(|error| format!("failed to replace {}: {error}", path.display()))?;
        Ok(())
    })();
    if result.is_err() {
        // Preserve the primary save error. Cleanup is best-effort and is scoped to this attempt's
        // unique temp path, so a cleanup failure cannot delete or obscure another writer's work.
        let _ = fs::remove_file(&temp);
    }
    result
}

pub fn save_json_document(
    root: &Path,
    document: &str,
    game_id: Option<&str>,
    json: &str,
) -> Result<(), String> {
    save_json_document_with_hook(root, document, game_id, json, || {})
}

#[cfg(test)]
mod tests {
    use super::{
        document_path, load_json_document, save_json_document, save_json_document_with_hook,
    };
    use std::fs;
    use std::path::PathBuf;
    use std::sync::{Arc, Barrier};
    use std::thread;
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
        let temp_files = fs::read_dir(&root)
            .expect("read root")
            .filter_map(Result::ok)
            .filter(|entry| {
                let name = entry.file_name();
                let name = name.to_string_lossy();
                name.starts_with(".settings.json.") && name.ends_with(".tmp")
            })
            .count();
        assert_eq!(temp_files, 0);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn concurrent_same_document_saves_use_independent_temp_files() {
        let root = Arc::new(temp_root());
        let barrier = Arc::new(Barrier::new(2));
        let payload_a = r#"{"writer":"a","value":111111}"#.to_owned();
        let payload_b = r#"{"writer":"b","value":222222}"#.to_owned();

        let root_a = Arc::clone(&root);
        let barrier_a = Arc::clone(&barrier);
        let payload_a_for_thread = payload_a.clone();
        let writer_a = thread::spawn(move || {
            save_json_document_with_hook(&root_a, "settings", None, &payload_a_for_thread, || {
                barrier_a.wait();
            })
        });

        let root_b = Arc::clone(&root);
        let barrier_b = Arc::clone(&barrier);
        let payload_b_for_thread = payload_b.clone();
        let writer_b = thread::spawn(move || {
            save_json_document_with_hook(&root_b, "settings", None, &payload_b_for_thread, || {
                barrier_b.wait();
            })
        });

        writer_a
            .join()
            .expect("writer a thread")
            .expect("writer a save");
        writer_b
            .join()
            .expect("writer b thread")
            .expect("writer b save");

        let final_json = load_json_document(&root, "settings", None)
            .expect("load")
            .expect("settings document");
        assert!(final_json == payload_a || final_json == payload_b);

        let temp_files = fs::read_dir(root.as_ref())
            .expect("read root")
            .filter_map(Result::ok)
            .filter(|entry| {
                let name = entry.file_name();
                let name = name.to_string_lossy();
                name.starts_with(".settings.json.") && name.ends_with(".tmp")
            })
            .count();
        assert_eq!(temp_files, 0);
        let _ = fs::remove_dir_all(root.as_ref());
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
