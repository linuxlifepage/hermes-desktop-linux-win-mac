use crate::connection::{remote_hermes_home_path, workspace_scope_fingerprint};
use crate::error::{HermesError, Result};
use crate::models::{
    ConnectionProfile, FileSaveResult, FileSnapshot, RemoteDirectoryListing, WorkspaceFileBookmark,
};
use crate::remote_python;
use crate::ssh;
use crate::storage::{load_preferences, save_preferences, AppStorage};
use chrono::Utc;
use serde::Serialize;
use uuid::Uuid;

const MAX_EDITABLE_FILE_BYTES: i64 = 10 * 1_000_000;
const MAX_DIRECTORY_ENTRIES: usize = 500;

pub fn list_workspace_file_bookmarks_inner(
    storage: &AppStorage,
    profile: ConnectionProfile,
) -> Result<Vec<WorkspaceFileBookmark>> {
    let scope = workspace_scope_fingerprint(&profile);
    let mut bookmarks = load_preferences(storage)?
        .workspace_file_bookmarks
        .into_iter()
        .filter(|bookmark| bookmark.workspace_scope_fingerprint == scope)
        .collect::<Vec<_>>();
    bookmarks.sort_by(|left, right| {
        display_title(left)
            .to_lowercase()
            .cmp(&display_title(right).to_lowercase())
            .then_with(|| left.remote_path.cmp(&right.remote_path))
            .then_with(|| left.id.cmp(&right.id))
    });
    Ok(bookmarks)
}

pub fn upsert_workspace_file_bookmark_inner(
    storage: &AppStorage,
    profile: ConnectionProfile,
    remote_path: String,
    title: Option<String>,
) -> Result<Vec<WorkspaceFileBookmark>> {
    let normalized_path = remote_path.trim().to_string();
    if normalized_path.is_empty() {
        return Err(HermesError::Validation(
            "Remote file path is required.".to_string(),
        ));
    }

    let normalized_title = normalize_optional(title);
    let scope = workspace_scope_fingerprint(&profile);
    let mut preferences = load_preferences(storage)?;
    let now = Utc::now();

    if let Some(existing) = preferences
        .workspace_file_bookmarks
        .iter_mut()
        .find(|bookmark| {
            bookmark.workspace_scope_fingerprint == scope && bookmark.remote_path == normalized_path
        })
    {
        if normalized_title.is_some() {
            existing.title = normalized_title;
        }
        existing.updated_at = now;
    } else {
        preferences
            .workspace_file_bookmarks
            .push(WorkspaceFileBookmark {
                id: Uuid::new_v4(),
                workspace_scope_fingerprint: scope,
                remote_path: normalized_path,
                title: normalized_title,
                created_at: now,
                updated_at: now,
            });
    }

    save_preferences(storage, &preferences)?;
    list_workspace_file_bookmarks_inner(storage, profile)
}

pub fn remove_workspace_file_bookmark_inner(
    storage: &AppStorage,
    profile: ConnectionProfile,
    id: String,
) -> Result<Vec<WorkspaceFileBookmark>> {
    let bookmark_id = Uuid::parse_str(&id)
        .map_err(|_| HermesError::Validation("The bookmark id is not a valid UUID.".to_string()))?;
    let mut preferences = load_preferences(storage)?;
    preferences
        .workspace_file_bookmarks
        .retain(|bookmark| bookmark.id != bookmark_id);
    save_preferences(storage, &preferences)?;
    list_workspace_file_bookmarks_inner(storage, profile)
}

pub async fn read_workspace_file_inner(
    profile: ConnectionProfile,
    remote_path: String,
) -> Result<FileSnapshot> {
    let payload = FileRequest {
        path: remote_path,
        max_editable_bytes: MAX_EDITABLE_FILE_BYTES,
    };
    let script = remote_python::wrap_payload(&payload, FILE_READ_BODY)?;
    ssh::execute_json::<FileSnapshot>(profile, script).await
}

pub async fn save_workspace_file_inner(
    profile: ConnectionProfile,
    remote_path: String,
    content: String,
    expected_content_hash: Option<String>,
) -> Result<FileSaveResult> {
    let payload = FileWriteRequest {
        path: remote_path,
        content,
        expected_content_hash,
        atomic: true,
    };
    let script = remote_python::wrap_payload(&payload, FILE_WRITE_BODY)?;
    ssh::execute_json::<FileSaveResult>(profile, script).await
}

pub async fn list_remote_directory_inner(
    profile: ConnectionProfile,
    remote_path: String,
    hermes_home: Option<String>,
) -> Result<RemoteDirectoryListing> {
    let payload = DirectoryListRequest {
        path: remote_path,
        hermes_home: hermes_home.or_else(|| Some(remote_hermes_home_path(&profile))),
        max_entries: MAX_DIRECTORY_ENTRIES,
    };
    let script = remote_python::wrap_payload(&payload, DIRECTORY_LIST_BODY)?;
    ssh::execute_json::<RemoteDirectoryListing>(profile, script).await
}

fn normalize_optional(value: Option<String>) -> Option<String> {
    value
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
}

fn display_title(bookmark: &WorkspaceFileBookmark) -> String {
    if let Some(title) = bookmark
        .title
        .as_deref()
        .map(str::trim)
        .filter(|item| !item.is_empty())
    {
        return title.to_string();
    }

    let trimmed = bookmark.remote_path.trim();
    if trimmed.is_empty() {
        return "Untitled file".to_string();
    }
    let without_trailing_slash = if trimmed.len() > 1 && trimmed.ends_with('/') {
        &trimmed[..trimmed.len() - 1]
    } else {
        trimmed
    };
    without_trailing_slash
        .rsplit('/')
        .next()
        .filter(|item| !item.is_empty())
        .unwrap_or(without_trailing_slash)
        .to_string()
}

#[derive(Serialize)]
struct FileRequest {
    path: String,
    max_editable_bytes: i64,
}

#[derive(Serialize)]
struct DirectoryListRequest {
    path: String,
    hermes_home: Option<String>,
    max_entries: usize,
}

#[derive(Serialize)]
struct FileWriteRequest {
    path: String,
    content: String,
    expected_content_hash: Option<String>,
    atomic: bool,
}

const FILE_READ_BODY: &str = r#"
import hashlib
import json
import pathlib

def editable_file_target(path):
    if path.is_symlink():
        try:
            resolved = path.resolve(strict=True)
        except FileNotFoundError:
            fail(f"{payload['path']} is a dangling symlink.")
        if not resolved.is_file():
            fail(f"{payload['path']} points to a non-file target.")
        return resolved

    return path

try:
    requested = expand_remote_path(payload["path"]) or pathlib.Path(payload["path"])
    target = editable_file_target(requested)
    if not target.exists():
        fail(f"{payload['path']} does not exist on the active host.")
    if not target.is_file():
        fail(f"{payload['path']} is not a regular file.")

    size = target.stat().st_size
    max_size = int(payload.get("max_editable_bytes") or 0)
    if max_size > 0 and size > max_size:
        size_mb = size / 1000000
        limit_mb = max_size / 1000000
        fail(f"This file is {size_mb:.1f} MB. Hermes Desktop can edit remote text files up to {limit_mb:g} MB.")

    raw_content = target.read_bytes()
    content_hash = hashlib.sha256(raw_content).hexdigest()
    content = raw_content.decode("utf-8")
    print(json.dumps({
        "ok": True,
        "content": content,
        "content_hash": content_hash,
    }, ensure_ascii=False))
except UnicodeDecodeError:
    fail(f"{payload['path']} is not valid UTF-8.")
except PermissionError:
    fail(f"Permission denied while reading {payload['path']}.")
except Exception as exc:
    fail(f"Unable to read {payload['path']}: {exc}")
"#;

const DIRECTORY_LIST_BODY: &str = r#"
import json
import os
import pathlib

try:
    home = pathlib.Path.home()
    hermes_home = resolved_hermes_home(payload)
    requested_path = payload.get("path") or payload.get("hermes_home") or str(hermes_home)
    target = expand_remote_path(requested_path, home=home, base_dir=hermes_home)

    if not target.exists():
        fail(f"{payload['path']} does not exist on the active host.")
    if not target.is_dir():
        fail(f"{payload['path']} is not a directory.")

    max_entries = int(payload.get("max_entries") or 500)
    children = list(target.iterdir())

    def entry_sort_key(item):
        try:
            is_directory = item.is_dir()
        except OSError:
            is_directory = False
        return (0 if is_directory else 1, item.name.lower())

    children.sort(key=entry_sort_key)
    limited_children = children[:max_entries]

    entries = []
    for item in limited_children:
        stat_result = None
        try:
            stat_result = item.stat()
        except OSError:
            stat_result = None

        try:
            is_directory = item.is_dir()
        except OSError:
            is_directory = False

        try:
            is_file = item.is_file()
        except OSError:
            is_file = False

        is_symlink = item.is_symlink()
        if is_symlink:
            kind = "symlink"
        elif is_directory:
            kind = "directory"
        elif is_file:
            kind = "file"
        else:
            kind = "other"

        entries.append({
            "name": item.name,
            "path": item.as_posix(),
            "display_path": tilde(item, home),
            "kind": kind,
            "size": None if is_directory or stat_result is None else stat_result.st_size,
            "modified_at": None if stat_result is None else stat_result.st_mtime,
            "is_readable": os.access(item, os.R_OK),
            "is_writable": os.access(item, os.W_OK),
            "is_symlink": is_symlink,
        })

    parent = target.parent if target.parent != target else None

    print(json.dumps({
        "ok": True,
        "requested_path": requested_path,
        "resolved_path": target.as_posix(),
        "display_path": tilde(target, home),
        "parent_path": None if parent is None else parent.as_posix(),
        "parent_display_path": None if parent is None else tilde(parent, home),
        "entries": entries,
        "total_entry_count": len(children),
        "is_truncated": len(children) > len(limited_children),
    }, ensure_ascii=False))
except PermissionError:
    fail(f"Permission denied while reading {payload['path']}.")
except Exception as exc:
    fail(f"Unable to list {payload['path']}: {exc}")
"#;

const FILE_WRITE_BODY: &str = r#"
import hashlib
import json
import os
import pathlib
import tempfile

temp_name = None
directory_fd = None
content_bytes = payload["content"].encode("utf-8")
expected_hash = payload.get("expected_content_hash")

def editable_file_target(path):
    if path.is_symlink():
        try:
            resolved = path.resolve(strict=True)
        except FileNotFoundError:
            fail(f"{payload['path']} is a dangling symlink.")
        if not resolved.is_file():
            fail(f"{payload['path']} points to a non-file target.")
        return resolved

    return path

try:
    requested = expand_remote_path(payload["path"]) or pathlib.Path(payload["path"])
    target = editable_file_target(requested)

    if expected_hash is not None:
        if not target.exists():
            fail(f"{payload['path']} was removed on the active host after it was loaded. Reload from Remote before saving.")
        if not target.is_file():
            fail(f"{payload['path']} is not a regular file anymore. Reload from Remote before saving.")

        current_bytes = target.read_bytes()
        current_hash = hashlib.sha256(current_bytes).hexdigest()
        if current_hash != expected_hash:
            fail(f"{payload['path']} changed on the active host after it was loaded. Reload from Remote before saving.")

    target.parent.mkdir(parents=True, exist_ok=True)

    fd, temp_name = tempfile.mkstemp(
        dir=str(target.parent),
        prefix=f".{target.name}.",
        suffix=".tmp",
    )

    with os.fdopen(fd, "wb") as handle:
        handle.write(content_bytes)
        handle.flush()
        os.fsync(handle.fileno())

    if target.exists():
        os.chmod(temp_name, target.stat().st_mode)

    os.replace(temp_name, target)

    directory_fd = os.open(target.parent, os.O_RDONLY)
    os.fsync(directory_fd)

    print(json.dumps({
        "ok": True,
        "path": payload["path"],
        "content_hash": hashlib.sha256(content_bytes).hexdigest(),
    }, ensure_ascii=False))
except PermissionError:
    fail(f"Permission denied while writing {payload['path']}.")
except Exception as exc:
    fail(f"Unable to write {payload['path']}: {exc}")
finally:
    if directory_fd is not None:
        os.close(directory_fd)
    if temp_name and os.path.exists(temp_name):
        os.unlink(temp_name)
"#;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::remote_python::assert_python_payload_compiles;

    #[test]
    fn file_payloads_compile() {
        assert_python_payload_compiles(
            &FileRequest {
                path: "~/.hermes/SOUL.md".to_string(),
                max_editable_bytes: MAX_EDITABLE_FILE_BYTES,
            },
            FILE_READ_BODY,
        );
        assert_python_payload_compiles(
            &DirectoryListRequest {
                path: "~/.hermes".to_string(),
                hermes_home: Some("~/.hermes".to_string()),
                max_entries: MAX_DIRECTORY_ENTRIES,
            },
            DIRECTORY_LIST_BODY,
        );
        assert_python_payload_compiles(
            &FileWriteRequest {
                path: "~/.hermes/.tauri-smoke/test.txt".to_string(),
                content: "smoke\n".to_string(),
                expected_content_hash: None,
                atomic: true,
            },
            FILE_WRITE_BODY,
        );
    }
}
