use tauri_plugin_store::StoreExt;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
async fn store_key(app: tauri::AppHandle, workspace_id: String, key: String) -> Result<(), String> {
    let store = app.store("keychain.json").map_err(|e| e.to_string())?;
    store.set(&workspace_id, serde_json::Value::String(key));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn retrieve_key(app: tauri::AppHandle, workspace_id: String) -> Result<Option<String>, String> {
    let store = app.store("keychain.json").map_err(|e| e.to_string())?;
    let value = store.get(&workspace_id);
    Ok(value.and_then(|v| v.as_str().map(String::from)))
}

#[tauri::command]
async fn delete_key(app: tauri::AppHandle, workspace_id: String) -> Result<(), String> {
    let store = app.store("keychain.json").map_err(|e| e.to_string())?;
    let _ = store.delete(&workspace_id);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .invoke_handler(tauri::generate_handler![store_key, retrieve_key, delete_key])
        .setup(|app| {
            // Handle deep links on desktop during development
            #[cfg(desktop)]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                app.deep_link().register_all().map_err(|e| {
                    eprintln!("Failed to register deep link scheme: {}", e);
                }).ok();
            }

            // Register handler for when app is opened via deep link
            #[cfg(desktop)]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                app.deep_link().on_open_url(|event| {
                    println!("Deep link URLs: {:?}", event.urls());
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
