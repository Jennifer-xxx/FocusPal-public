#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(MainWindowSizeState::default())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_global_idle_ms, log_ai_event])
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::GlobalShortcutExt;

                if let Err(error) = app
                    .global_shortcut()
                    .on_shortcut(FOCUSPAL_SHORTCUT, handle_global_shortcut)
                {
                    eprintln!("failed to register FocusPal shortcut: {error}");
                }
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app, event| {
        if let tauri::RunEvent::Reopen { .. } = event {
            handle_app_reopen(app);
        }
    });
}

#[cfg(desktop)]
const FOCUSPAL_SHORTCUT: &str = "CmdOrCtrl+Shift+Space";
#[cfg(desktop)]
const OPEN_THOUGHT_CATCHER_EVENT: &str = "focuspal://open-thought-catcher";
#[cfg(desktop)]
const OPEN_MAIN_PAGE_EVENT: &str = "focuspal://open-main-page";
#[cfg(desktop)]
const MAIN_WINDOW_MIN_WIDTH: f64 = 380.0;
#[cfg(desktop)]
const MAIN_WINDOW_MIN_HEIGHT: f64 = 320.0;
#[cfg(desktop)]
const THOUGHT_CATCHER_WINDOW_WIDTH: f64 = 420.0;
#[cfg(desktop)]
const THOUGHT_CATCHER_WINDOW_HEIGHT: f64 = 320.0;
#[cfg(target_os = "macos")]
const CG_EVENT_SOURCE_STATE_COMBINED_SESSION_STATE: u32 = 0;
#[cfg(target_os = "macos")]
const CG_ANY_INPUT_EVENT_TYPE: u32 = u32::MAX;

#[derive(Default)]
struct MainWindowSizeState(std::sync::Mutex<Option<tauri::LogicalSize<f64>>>);

#[cfg(desktop)]
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenThoughtCatcherPayload {
    restore_main_page: bool,
}

#[tauri::command]
fn get_global_idle_ms() -> Result<u64, String> {
    get_global_idle_ms_impl()
}

#[tauri::command]
fn log_ai_event(feature: String, event: String, detail: String) {
    eprintln!("[FocusPal AI] {feature}: {event} - {detail}");
}

#[cfg(target_os = "macos")]
fn get_global_idle_ms_impl() -> Result<u64, String> {
    #[link(name = "ApplicationServices", kind = "framework")]
    extern "C" {
        fn CGEventSourceSecondsSinceLastEventType(state_id: u32, event_type: u32) -> f64;
    }

    // Reads only aggregate system idle duration. It does not capture keys, mouse
    // positions, app names, window titles, or user content.
    let idle_seconds = unsafe {
        CGEventSourceSecondsSinceLastEventType(
            CG_EVENT_SOURCE_STATE_COMBINED_SESSION_STATE,
            CG_ANY_INPUT_EVENT_TYPE,
        )
    };

    if !idle_seconds.is_finite() || idle_seconds < 0.0 {
        return Err("Global idle time is unavailable.".to_string());
    }

    Ok((idle_seconds * 1000.0).round() as u64)
}

#[cfg(not(target_os = "macos"))]
fn get_global_idle_ms_impl() -> Result<u64, String> {
    Err("Global idle time is currently implemented only on macOS.".to_string())
}

#[cfg(desktop)]
fn handle_global_shortcut(
    app: &tauri::AppHandle,
    _shortcut: &tauri_plugin_global_shortcut::Shortcut,
    event: tauri_plugin_global_shortcut::ShortcutEvent,
) {
    use tauri::{Emitter, Manager};
    use tauri_plugin_global_shortcut::ShortcutState;

    if event.state != ShortcutState::Pressed {
        return;
    }

    let restore_main_page = app
        .get_webview_window("main")
        .map(|window| window.is_visible().unwrap_or(false))
        .unwrap_or(false);

    #[cfg(target_os = "macos")]
    let _ = app.show();

    if let Some(window) = app.get_webview_window("main") {
        if restore_main_page {
            let _ = apply_main_window_min_size(&window);
        } else {
            remember_main_window_size(app, &window);
            let _ = apply_thought_catcher_window_size(&window);
        }
        let _ = window.set_always_on_top(true);
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }

    let _ = app.emit(
        OPEN_THOUGHT_CATCHER_EVENT,
        OpenThoughtCatcherPayload { restore_main_page },
    );
}

#[cfg(desktop)]
fn handle_app_reopen(app: &tauri::AppHandle) {
    use tauri::{Emitter, Manager};

    #[cfg(target_os = "macos")]
    let _ = app.show();

    if let Some(window) = app.get_webview_window("main") {
        let _ = apply_main_window_min_size(&window);
        restore_main_window_size(app, &window);
        let _ = window.set_always_on_top(true);
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }

    let _ = app.emit(OPEN_MAIN_PAGE_EVENT, ());
}

#[cfg(desktop)]
fn apply_main_window_min_size<R: tauri::Runtime>(
    window: &tauri::WebviewWindow<R>,
) -> tauri::Result<()> {
    use tauri::LogicalSize;

    window.set_min_size(Some(LogicalSize::new(
        MAIN_WINDOW_MIN_WIDTH,
        MAIN_WINDOW_MIN_HEIGHT,
    )))
}

#[cfg(desktop)]
fn apply_thought_catcher_window_size<R: tauri::Runtime>(
    window: &tauri::WebviewWindow<R>,
) -> tauri::Result<()> {
    use tauri::LogicalSize;

    let size = LogicalSize::new(THOUGHT_CATCHER_WINDOW_WIDTH, THOUGHT_CATCHER_WINDOW_HEIGHT);
    window.set_min_size(Some(size))?;
    window.set_size(size)
}

#[cfg(desktop)]
fn remember_main_window_size<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    window: &tauri::WebviewWindow<R>,
) {
    use tauri::Manager;

    let state = app.state::<MainWindowSizeState>();
    let Ok(mut saved_size) = state.0.lock() else {
        return;
    };

    if saved_size.is_some() {
        return;
    }

    let Ok(physical_size) = window.outer_size() else {
        return;
    };
    let Ok(scale_factor) = window.scale_factor() else {
        return;
    };

    *saved_size = Some(tauri::LogicalSize::new(
        physical_size.width as f64 / scale_factor,
        physical_size.height as f64 / scale_factor,
    ));
}

#[cfg(desktop)]
fn restore_main_window_size<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    window: &tauri::WebviewWindow<R>,
) {
    use tauri::Manager;

    let state = app.state::<MainWindowSizeState>();
    let Ok(mut saved_size) = state.0.lock() else {
        return;
    };

    if let Some(size) = saved_size.take() {
        let _ = window.set_size(size);
    }
}

#[cfg(all(test, desktop))]
mod tests {
    use super::{
        FOCUSPAL_SHORTCUT, MAIN_WINDOW_MIN_HEIGHT, MAIN_WINDOW_MIN_WIDTH, OPEN_MAIN_PAGE_EVENT,
        OPEN_THOUGHT_CATCHER_EVENT, THOUGHT_CATCHER_WINDOW_HEIGHT, THOUGHT_CATCHER_WINDOW_WIDTH,
    };

    #[test]
    fn shortcut_uses_fixed_demo_accelerator() {
        assert_eq!(FOCUSPAL_SHORTCUT, "CmdOrCtrl+Shift+Space");
    }

    #[test]
    fn shortcut_event_name_matches_frontend_listener() {
        assert_eq!(
            OPEN_THOUGHT_CATCHER_EVENT,
            "focuspal://open-thought-catcher"
        );
    }

    #[test]
    fn reopen_event_name_matches_frontend_listener() {
        assert_eq!(OPEN_MAIN_PAGE_EVENT, "focuspal://open-main-page");
    }

    #[test]
    fn main_window_minimum_allows_compact_resize() {
        assert_eq!(
            (MAIN_WINDOW_MIN_WIDTH, MAIN_WINDOW_MIN_HEIGHT),
            (380.0, 320.0)
        );
    }

    #[test]
    fn shortcut_catcher_window_size_wraps_the_capture_form() {
        assert_eq!(
            (THOUGHT_CATCHER_WINDOW_WIDTH, THOUGHT_CATCHER_WINDOW_HEIGHT),
            (420.0, 320.0)
        );
    }

    #[test]
    fn default_capability_allows_sql_writes() {
        let capability: serde_json::Value =
            serde_json::from_str(include_str!("../capabilities/default.json")).unwrap();
        let permissions = capability["permissions"].as_array().unwrap();

        assert!(permissions
            .iter()
            .any(|permission| permission == "sql:default"));
        assert!(permissions
            .iter()
            .any(|permission| permission == "sql:allow-execute"));
        assert!(permissions
            .iter()
            .any(|permission| permission == "core:window:allow-set-size"));
        assert!(permissions
            .iter()
            .any(|permission| permission == "core:window:allow-start-dragging"));
        assert!(permissions
            .iter()
            .any(|permission| permission == "core:window:allow-center"));
        assert!(permissions
            .iter()
            .any(|permission| permission == "core:window:allow-outer-position"));
        assert!(permissions
            .iter()
            .any(|permission| permission == "core:window:allow-set-position"));
        assert!(permissions
            .iter()
            .any(|permission| permission == "core:window:allow-set-background-color"));
        assert!(permissions
            .iter()
            .any(|permission| permission == "core:window:allow-set-decorations"));
        assert!(permissions
            .iter()
            .any(|permission| permission == "core:window:allow-set-shadow"));
    }

    #[test]
    fn main_window_supports_transparent_companion_surfaces() {
        let config: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        let window = &config["app"]["windows"][0];

        assert_eq!(window["transparent"], true);
        assert_eq!(config["app"]["macOSPrivateApi"], true);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_global_idle_uses_aggregate_input_event_constants() {
        assert_eq!(super::CG_EVENT_SOURCE_STATE_COMBINED_SESSION_STATE, 0);
        assert_eq!(super::CG_ANY_INPUT_EVENT_TYPE, u32::MAX);
    }
}
