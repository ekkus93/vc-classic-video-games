use tauri::Manager;

fn app_data_root(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|error| format!("failed to resolve app data directory: {error}"))
}

#[tauri::command]
pub fn load_json_document(
    app: tauri::AppHandle,
    document: String,
    game_id: Option<String>,
) -> Result<Option<String>, String> {
    let root = app_data_root(&app)?;
    crate::persistence::load_json_document(&root, &document, game_id.as_deref())
}

#[tauri::command]
pub fn save_json_document(
    app: tauri::AppHandle,
    document: String,
    game_id: Option<String>,
    json: String,
) -> Result<(), String> {
    let root = app_data_root(&app)?;
    crate::persistence::save_json_document(&root, &document, game_id.as_deref(), &json)
}
