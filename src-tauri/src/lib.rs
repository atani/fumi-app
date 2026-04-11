mod imap;
mod smtp;

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::Rng;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::sync::Mutex;
use tauri::image::Image;
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Manager, State, WindowEvent};

struct OAuthState {
    code_verifier: Mutex<Option<String>>,
}

#[derive(Serialize, Clone)]
struct OAuthCallback {
    code: String,
    state: String,
}

fn generate_code_verifier() -> String {
    let random_bytes: Vec<u8> = (0..32).map(|_| rand::thread_rng().gen()).collect();
    URL_SAFE_NO_PAD.encode(&random_bytes)
}

fn generate_code_challenge(verifier: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let result = hasher.finalize();
    URL_SAFE_NO_PAD.encode(result)
}

#[tauri::command]
fn get_oauth_params(state: State<OAuthState>) -> Result<(String, String), String> {
    let verifier = generate_code_verifier();
    let challenge = generate_code_challenge(&verifier);
    *state.code_verifier.lock().map_err(|e| e.to_string())? = Some(verifier);
    Ok((challenge, generate_state_param()))
}

#[tauri::command]
fn get_code_verifier(state: State<OAuthState>) -> Result<String, String> {
    state
        .code_verifier
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or_else(|| "No code verifier available".to_string())
}

fn generate_state_param() -> String {
    let random_bytes: Vec<u8> = (0..16).map(|_| rand::thread_rng().gen()).collect();
    URL_SAFE_NO_PAD.encode(&random_bytes)
}

#[tauri::command]
async fn start_oauth_server(app: tauri::AppHandle) -> Result<u16, String> {
    let ports = [17248, 17249, 17250, 17251];

    for port in ports {
        let addr = format!("127.0.0.1:{}", port);
        match tiny_http::Server::http(&addr) {
            Ok(server) => {
                let app_handle = app.clone();
                std::thread::spawn(move || {
                    if let Some(request) = server.incoming_requests().next() {
                        let url_str = format!("http://localhost{}", request.url());
                        if let Ok(parsed) = url::Url::parse(&url_str) {
                            let params: std::collections::HashMap<_, _> =
                                parsed.query_pairs().into_owned().collect();

                            if let (Some(code), Some(state)) =
                                (params.get("code"), params.get("state"))
                            {
                                let html = r#"<!DOCTYPE html><html><body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f8f9fa"><div style="text-align:center"><h1 style="font-size:48px;margin-bottom:16px">&#x2709;&#xFE0F;</h1><h2>Fumi</h2><p>Authentication successful. You can close this window.</p></div></body></html>"#;
                                let response = tiny_http::Response::from_string(html)
                                    .with_header(
                                        "Content-Type: text/html; charset=utf-8"
                                            .parse::<tiny_http::Header>()
                                            .unwrap(),
                                    );
                                let _ = request.respond(response);

                                let _ = app_handle.emit(
                                    "oauth-callback",
                                    OAuthCallback {
                                        code: code.clone(),
                                        state: state.clone(),
                                    },
                                );
                            }
                        }
                    }
                });
                return Ok(port);
            }
            Err(_) => continue,
        }
    }

    Err("Could not bind to any port".to_string())
}

#[tauri::command]
async fn close_splashscreen(app: tauri::AppHandle) {
    if let Some(splash) = app.get_webview_window("splashscreen") {
        let _ = splash.close();
    }
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // Focus the existing main window when a second instance is launched
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
            // Forward args for deep linking
            let _ = app.emit("single-instance-args", args);
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .manage(OAuthState {
            code_verifier: Mutex::new(None),
        })
        .setup(|app| {
            // Set Windows AUMID for proper notification identity
            #[cfg(windows)]
            {
                use windows::core::w;
                use windows::Win32::UI::Shell::SetCurrentProcessExplicitAppUserModelID;
                unsafe {
                    let _ = SetCurrentProcessExplicitAppUserModelID(w!("app.fumi.mail"));
                }
            }

            let show = MenuItemBuilder::with_id("show", "Show Fumi").build(app)?;
            let check_mail = MenuItemBuilder::with_id("check_mail", "Check Mail").build(app)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit Fumi").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&show)
                .item(&check_mail)
                .item(&separator)
                .item(&quit)
                .build()?;

            let tray_icon = Image::from_path("icons/32x32.png")
                .or_else(|_| Image::from_path("icons/icon.png"))
                .unwrap_or_else(|_| Image::from_bytes(include_bytes!("../icons/32x32.png")).expect("failed to load embedded tray icon"));

            TrayIconBuilder::new()
                .icon(tray_icon)
                .menu(&menu)
                .tooltip("Fumi")
                .on_menu_event(move |app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "check_mail" => {
                        let _ = app.emit("tray-check-mail", ());
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { .. } = event {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    // Hide the window instead of closing it (minimize to tray)
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            start_oauth_server,
            get_oauth_params,
            get_code_verifier,
            close_splashscreen,
            imap::imap_test_connection,
            imap::imap_list_folders,
            imap::imap_fetch_messages,
            imap::imap_fetch_message_body,
            smtp::smtp_test_connection,
            smtp::smtp_send_email
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
