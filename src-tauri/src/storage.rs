use crate::error::Result;
use crate::models::{AppPreferences, AppSnapshot, ConnectionProfile};
use chrono::{SecondsFormat, TimeZone, Utc};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone)]
pub struct AppStorage {
    connections_path: PathBuf,
    preferences_path: PathBuf,
}

impl AppStorage {
    pub fn new(app: &AppHandle) -> std::result::Result<Self, Box<dyn std::error::Error>> {
        let app_data_dir = app.path().app_data_dir()?;
        fs::create_dir_all(&app_data_dir)?;
        private_dir_permissions(&app_data_dir)?;
        if let Err(error) = migrate_legacy_macos_storage(&app_data_dir) {
            eprintln!("warning: unable to migrate legacy Hermes Desktop storage: {error}");
        }

        Ok(Self {
            connections_path: app_data_dir.join("connections.json"),
            preferences_path: app_data_dir.join("preferences.json"),
        })
    }
}

pub fn load_snapshot(storage: &AppStorage) -> Result<AppSnapshot> {
    Ok(AppSnapshot {
        connections: load_connections(storage)?,
        preferences: load_preferences(storage)?,
    })
}

pub fn load_connections(storage: &AppStorage) -> Result<Vec<ConnectionProfile>> {
    read_json_or_default(&storage.connections_path)
}

pub fn save_connections(storage: &AppStorage, connections: &[ConnectionProfile]) -> Result<()> {
    write_json(&storage.connections_path, connections)
}

pub fn load_preferences(storage: &AppStorage) -> Result<AppPreferences> {
    read_json_or_default(&storage.preferences_path)
}

pub fn save_preferences(storage: &AppStorage, preferences: &AppPreferences) -> Result<()> {
    write_json(&storage.preferences_path, preferences)
}

fn read_json_or_default<T>(path: &PathBuf) -> Result<T>
where
    T: serde::de::DeserializeOwned + Default,
{
    match fs::read(path) {
        Ok(data) => Ok(serde_json::from_slice(&data)?),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(T::default()),
        Err(error) => Err(error.into()),
    }
}

fn write_json<T>(path: &PathBuf, value: &T) -> Result<()>
where
    T: serde::Serialize + ?Sized,
{
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
        private_dir_permissions(parent)?;
    }
    let data = serde_json::to_vec_pretty(value)?;
    fs::write(path, data)?;
    private_file_permissions(path)?;
    Ok(())
}

fn migrate_legacy_macos_storage(current_dir: &Path) -> Result<()> {
    let Some(legacy_dir) = legacy_macos_app_support_dir() else {
        return Ok(());
    };
    migrate_legacy_storage(&legacy_dir, current_dir)
}

fn migrate_legacy_storage(legacy_dir: &Path, current_dir: &Path) -> Result<()> {
    if legacy_dir == current_dir || !legacy_dir.is_dir() {
        return Ok(());
    }

    migrate_legacy_json_file(
        &legacy_dir.join("connections.json"),
        &current_dir.join("connections.json"),
        normalize_legacy_json_dates,
    )?;
    migrate_legacy_json_file(
        &legacy_dir.join("preferences.json"),
        &current_dir.join("preferences.json"),
        migrate_legacy_preferences_value,
    )?;
    Ok(())
}

fn legacy_macos_app_support_dir() -> Option<PathBuf> {
    let home = std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE"))?;
    Some(
        PathBuf::from(home)
            .join("Library")
            .join("Application Support")
            .join("HermesDesktop"),
    )
}

fn migrate_legacy_json_file(
    source_path: &Path,
    target_path: &Path,
    transform: fn(&mut serde_json::Value),
) -> Result<()> {
    if target_path.exists() || !source_path.is_file() {
        return Ok(());
    }

    let data = fs::read(source_path)?;
    let mut value = serde_json::from_slice::<serde_json::Value>(&data)?;
    transform(&mut value);
    write_json(&target_path.to_path_buf(), &value)
}

fn migrate_legacy_preferences_value(value: &mut serde_json::Value) {
    if let serde_json::Value::Object(map) = value {
        if !map.contains_key("activeConnectionId") {
            if let Some(last_connection_id) = map.remove("lastConnectionID") {
                map.insert("activeConnectionId".to_string(), last_connection_id);
            }
        }
        map.remove("terminalTheme");
    }
    normalize_legacy_json_dates(value);
}

fn normalize_legacy_json_dates(value: &mut serde_json::Value) {
    match value {
        serde_json::Value::Object(map) => {
            for (key, child) in map.iter_mut() {
                if is_legacy_swift_date_key(key) {
                    if let Some(converted) = legacy_swift_date_to_rfc3339(child) {
                        *child = serde_json::Value::String(converted);
                        continue;
                    }
                }
                normalize_legacy_json_dates(child);
            }
        }
        serde_json::Value::Array(items) => {
            for child in items {
                normalize_legacy_json_dates(child);
            }
        }
        _ => {}
    }
}

fn is_legacy_swift_date_key(key: &str) -> bool {
    matches!(
        key,
        "createdAt" | "updatedAt" | "lastConnectedAt" | "lastAutomaticUpdateCheckAt"
    )
}

fn legacy_swift_date_to_rfc3339(value: &serde_json::Value) -> Option<String> {
    let seconds = value.as_f64()?;
    if !seconds.is_finite() {
        return None;
    }
    let micros = (seconds * 1_000_000.0).round() as i64;
    let reference_date = Utc.with_ymd_and_hms(2001, 1, 1, 0, 0, 0).single()?;
    let date = reference_date.checked_add_signed(chrono::Duration::microseconds(micros))?;
    Some(date.to_rfc3339_opts(SecondsFormat::Millis, true))
}

#[cfg(unix)]
fn private_dir_permissions(path: &std::path::Path) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o700))?;
    Ok(())
}

#[cfg(not(unix))]
fn private_dir_permissions(_path: &std::path::Path) -> Result<()> {
    Ok(())
}

#[cfg(unix)]
fn private_file_permissions(path: &std::path::Path) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o600))?;
    Ok(())
}

#[cfg(not(unix))]
fn private_file_permissions(_path: &std::path::Path) -> Result<()> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{AppPreferences, ConnectionProfile};
    use std::fs;
    use uuid::Uuid;

    #[test]
    fn missing_files_load_default_snapshot() {
        let temp = temporary_storage();

        let snapshot = load_snapshot(&temp.storage).expect("missing files should load defaults");

        assert!(snapshot.connections.is_empty());
        assert!(snapshot.preferences.active_connection_id.is_none());
        assert!(snapshot.preferences.automatically_checks_for_updates);
        assert!(snapshot.preferences.workspace_file_bookmarks.is_empty());
        assert!(snapshot.preferences.pinned_sessions.is_empty());
    }

    #[test]
    fn connections_round_trip_as_json() {
        let temp = temporary_storage();
        let mut profile = ConnectionProfile::default();
        profile.label = "Prod".to_string();
        profile.ssh_host = "example.com".to_string();
        profile.ssh_user = "alice".to_string();

        save_connections(&temp.storage, &[profile.clone()]).expect("save connections");
        let loaded = load_connections(&temp.storage).expect("load connections");

        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].id, profile.id);
        assert_eq!(loaded[0].label, "Prod");
        assert_eq!(loaded[0].ssh_host, "example.com");
        assert_eq!(loaded[0].ssh_user, "alice");
    }

    #[test]
    fn preferences_round_trip_preserves_update_defaults() {
        let temp = temporary_storage();
        let preferences = AppPreferences {
            active_connection_id: Some(Uuid::new_v4().to_string()),
            app_locale: Some("ru".to_string()),
            ..AppPreferences::default()
        };

        save_preferences(&temp.storage, &preferences).expect("save preferences");
        let loaded = load_preferences(&temp.storage).expect("load preferences");

        assert_eq!(
            loaded.active_connection_id,
            preferences.active_connection_id
        );
        assert_eq!(loaded.app_locale.as_deref(), Some("ru"));
        assert!(loaded.automatically_checks_for_updates);
    }

    #[cfg(unix)]
    #[test]
    fn saved_files_and_parent_directory_use_private_permissions() {
        use std::os::unix::fs::PermissionsExt;

        let temp = temporary_storage();
        save_preferences(&temp.storage, &AppPreferences::default()).expect("save preferences");
        save_connections(&temp.storage, &[]).expect("save connections");

        assert_eq!(
            fs::metadata(&temp.root)
                .expect("root metadata")
                .permissions()
                .mode()
                & 0o777,
            0o700
        );
        assert_eq!(
            fs::metadata(&temp.storage.preferences_path)
                .expect("preferences metadata")
                .permissions()
                .mode()
                & 0o777,
            0o600
        );
        assert_eq!(
            fs::metadata(&temp.storage.connections_path)
                .expect("connections metadata")
                .permissions()
                .mode()
                & 0o777,
            0o600
        );
    }

    #[test]
    fn migrates_legacy_macos_connections_and_preferences() {
        let legacy = temporary_storage();
        let current = temporary_storage();
        let connection_id = Uuid::new_v4();
        let workflow_id = Uuid::new_v4();
        let bookmark_id = Uuid::new_v4();

        fs::write(
            legacy.storage.connections_path.clone(),
            serde_json::to_vec_pretty(&serde_json::json!([
                {
                    "id": connection_id,
                    "label": "Legacy Mac",
                    "sshAlias": "legacy-mac",
                    "sshHost": "",
                    "sshPort": 22,
                    "sshUser": "alice",
                    "hermesProfile": null,
                    "customHermesHomePath": null,
                    "createdAt": 0.0,
                    "updatedAt": 60.0,
                    "lastConnectedAt": 120.0
                }
            ]))
            .expect("legacy connection json"),
        )
        .expect("write legacy connections");
        fs::write(
            legacy.storage.preferences_path.clone(),
            serde_json::to_vec_pretty(&serde_json::json!({
                "lastConnectionID": connection_id,
                "terminalTheme": "dusk",
                "automaticallyChecksForUpdates": false,
                "lastAutomaticUpdateCheckAt": 180.0,
                "workspaceFileBookmarks": [
                    {
                        "id": bookmark_id,
                        "workspaceScopeFingerprint": "legacy-mac|alice|22|~/.hermes",
                        "remotePath": "~/.hermes/memories/MEMORY.md",
                        "title": "Memory",
                        "createdAt": 0.0,
                        "updatedAt": 60.0
                    }
                ],
                "pinnedSessions": [],
                "workflows": [
                    {
                        "id": workflow_id,
                        "workspaceScopeFingerprint": "legacy-mac|alice|22|~/.hermes",
                        "name": "Daily check",
                        "prompt": "Summarize status",
                        "assignedSkills": [],
                        "createdAt": 0.0,
                        "updatedAt": 60.0
                    }
                ]
            }))
            .expect("legacy preferences json"),
        )
        .expect("write legacy preferences");

        migrate_legacy_storage(&legacy.root, &current.root).expect("legacy storage should migrate");
        let snapshot = load_snapshot(&current.storage).expect("migrated snapshot should load");

        assert_eq!(snapshot.connections.len(), 1);
        assert_eq!(snapshot.connections[0].id, connection_id);
        assert_eq!(snapshot.connections[0].label, "Legacy Mac");
        assert_eq!(
            snapshot.connections[0]
                .created_at
                .to_rfc3339_opts(SecondsFormat::Millis, true),
            "2001-01-01T00:00:00.000Z"
        );
        assert_eq!(
            snapshot.connections[0]
                .last_connected_at
                .expect("last connected")
                .to_rfc3339_opts(SecondsFormat::Millis, true),
            "2001-01-01T00:02:00.000Z"
        );
        let expected_active_connection_id = connection_id.to_string();
        assert_eq!(
            snapshot.preferences.active_connection_id.as_deref(),
            Some(expected_active_connection_id.as_str())
        );
        assert!(!snapshot.preferences.automatically_checks_for_updates);
        assert_eq!(snapshot.preferences.workspace_file_bookmarks.len(), 1);
        assert_eq!(
            snapshot.preferences.workspace_file_bookmarks[0].id,
            bookmark_id
        );
        assert_eq!(snapshot.preferences.workflows.len(), 1);
        assert_eq!(snapshot.preferences.workflows[0].id, workflow_id);
    }

    #[test]
    fn legacy_migration_does_not_overwrite_current_files() {
        let legacy = temporary_storage();
        let current = temporary_storage();
        let legacy_id = Uuid::new_v4();
        let current_id = Uuid::new_v4();

        fs::write(
            legacy.storage.connections_path.clone(),
            serde_json::to_vec_pretty(&serde_json::json!([
                {
                    "id": legacy_id,
                    "label": "Legacy",
                    "sshAlias": "legacy",
                    "sshHost": "",
                    "sshPort": null,
                    "sshUser": "",
                    "hermesProfile": null,
                    "customHermesHomePath": null,
                    "createdAt": 0.0,
                    "updatedAt": 0.0,
                    "lastConnectedAt": null
                }
            ]))
            .expect("legacy connection json"),
        )
        .expect("write legacy connections");

        let mut current_profile = ConnectionProfile::default();
        current_profile.id = current_id;
        current_profile.label = "Current".to_string();
        current_profile.ssh_host = "current.example.com".to_string();
        save_connections(&current.storage, &[current_profile]).expect("save current connection");

        migrate_legacy_storage(&legacy.root, &current.root).expect("legacy migration should skip");
        let connections =
            load_connections(&current.storage).expect("current connections should load");

        assert_eq!(connections.len(), 1);
        assert_eq!(connections[0].id, current_id);
        assert_eq!(connections[0].label, "Current");
    }

    struct TemporaryStorage {
        root: PathBuf,
        storage: AppStorage,
    }

    impl Drop for TemporaryStorage {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    fn temporary_storage() -> TemporaryStorage {
        let root = std::env::temp_dir().join(format!("hermes-storage-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).expect("create temp storage dir");
        let storage = AppStorage {
            connections_path: root.join("connections.json"),
            preferences_path: root.join("preferences.json"),
        };
        TemporaryStorage { root, storage }
    }
}
