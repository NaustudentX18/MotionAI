// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri_plugin_deep_link::DeepLinkExt;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            // Handle deep links on desktop during development
            #[cfg(desktop)]
            {
                app.deep_link().register_all().map_err(|e| {
                    eprintln!("Failed to register deep link scheme: {}", e);
                }).ok();
            }

            // Register handler for when app is opened via deep link
            app.deep_link().on_open_url(|event| {
                println!("Deep link URLs: {:?}", event.urls());
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
