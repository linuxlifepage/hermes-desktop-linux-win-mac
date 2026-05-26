use crate::error::Result;
use base64::Engine;
use serde::Serialize;

pub fn wrap_payload<T>(payload: &T, body: &str) -> Result<String>
where
    T: Serialize,
{
    let json = serde_json::to_vec(payload)?;
    let encoded = base64::engine::general_purpose::STANDARD.encode(json);
    Ok(format!(
        r#"
import base64
import json
import pathlib
import sys

payload = json.loads(base64.b64decode("{encoded}").decode("utf-8"))

{shared_helpers}

{body}
"#,
        shared_helpers = SHARED_HELPERS
    ))
}

#[cfg(test)]
pub(crate) fn assert_python_payload_compiles<T>(payload: &T, body: &str)
where
    T: Serialize,
{
    use std::fs;
    use std::process::Command;

    let script = wrap_payload(payload, body).expect("payload should wrap");
    let path =
        std::env::temp_dir().join(format!("hermes-remote-payload-{}.py", uuid::Uuid::new_v4()));
    fs::write(&path, script).expect("write generated remote payload");
    let output = Command::new("python3")
        .args(["-m", "py_compile"])
        .arg(&path)
        .output()
        .expect("run python3 -m py_compile");
    let _ = fs::remove_file(&path);

    assert!(
        output.status.success(),
        "generated remote payload should compile\nstdout:\n{}\nstderr:\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
}

const SHARED_HELPERS: &str = r#"
import os
import shutil
import sqlite3

def fail(message):
    print(json.dumps({
        "ok": False,
        "error": message,
    }, ensure_ascii=False))
    sys.exit(1)

def stringify(value):
    if value is None:
        return None
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return str(value)

def normalize_text(value):
    text = stringify(value)
    if text is None:
        return None
    text = text.strip()
    return text or None

def choose_table(tables, needle):
    lowered = needle.lower()
    for name in tables:
        if name.lower() == lowered:
            return name
    for name in tables:
        if lowered in name.lower():
            return name
    return None

def choose_column(columns, choices):
    lowered = {column.lower(): column for column in columns}
    for choice in choices:
        if choice.lower() in lowered:
            return lowered[choice.lower()]
    for choice in choices:
        for column in columns:
            if choice.lower() in column.lower():
                return column
    return None

def quote_ident(value):
    return '"' + str(value).replace('"', '""') + '"'

def quote_text(value):
    return "'" + str(value).replace("'", "''") + "'"

def connect_sqlite_readonly(path):
    connection = None
    try:
        connection = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
        connection.execute("PRAGMA schema_version").fetchone()
        return connection
    except sqlite3.OperationalError as exc:
        if connection is not None:
            try:
                connection.close()
            except Exception:
                pass
        message = str(exc).lower()
        if "unable to open database file" not in message and "readonly database" not in message:
            raise
        return sqlite3.connect(f"file:{path}?mode=ro&immutable=1", uri=True)

def expand_remote_path(value, home=None, base_dir=None):
    if home is None:
        home = pathlib.Path.home()

    normalized = normalize_text(value)
    if normalized is None:
        return None
    expanded = os.path.expandvars(normalized)
    try:
        path = pathlib.Path(expanded).expanduser()
    except Exception:
        path = pathlib.Path(expanded)

    if not path.is_absolute():
        if expanded == "~":
            return home
        if expanded.startswith("~/"):
            return home / expanded[2:]
        if base_dir is not None:
            return base_dir / path
    return path

def resolved_hermes_home(request=None):
    request_data = payload if request is None else request
    home = pathlib.Path.home()
    expanded = expand_remote_path(request_data.get("hermes_home"), home)
    if expanded is not None:
        return expanded
    env_home = expand_remote_path(os.environ.get("HERMES_HOME"), home)
    if env_home is not None:
        return env_home
    return home / ".hermes"

def hermes_search_path(request=None):
    home = pathlib.Path.home()
    hermes_home = resolved_hermes_home(request)
    candidates = [
        hermes_home / "hermes-agent" / "venv" / "bin",
        home / ".local" / "bin",
        home / ".hermes" / "hermes-agent" / "venv" / "bin",
        home / ".cargo" / "bin",
        pathlib.Path("/opt/homebrew/bin"),
        pathlib.Path("/usr/local/bin"),
    ]

    entries = []
    seen = set()
    for candidate in candidates:
        try:
            entry = str(candidate)
        except Exception:
            continue
        if not entry or entry in seen:
            continue
        seen.add(entry)
        entries.append(entry)

    env_path = os.environ.get("PATH", "")
    if env_path:
        entries.append(env_path)
    return os.pathsep.join(entries)

def find_hermes_binary(request=None):
    candidate = shutil.which("hermes", path=hermes_search_path(request))
    if candidate:
        return candidate
    return None

def tilde(path, home=None):
    if home is None:
        home = pathlib.Path.home()
    try:
        relative = path.relative_to(home)
        return "~/" + relative.as_posix() if relative.as_posix() != "." else "~"
    except ValueError:
        return path.as_posix()

def iter_session_store_candidates(hermes_home, home=None, hinted_path=None):
    if home is None:
        home = pathlib.Path.home()

    seen = set()

    def emit(candidate):
        if candidate is None:
            return None
        resolved = str(candidate)
        if resolved in seen or not candidate.is_file():
            return None
        seen.add(resolved)
        return candidate

    hinted_candidate = emit(expand_remote_path(hinted_path, home))
    if hinted_candidate is not None:
        yield hinted_candidate

    preferred = [
        hermes_home / "state.db",
        hermes_home / "state.sqlite",
        hermes_home / "state.sqlite3",
        hermes_home / "store.db",
        hermes_home / "store.sqlite",
        hermes_home / "store.sqlite3",
    ]

    for candidate in preferred:
        candidate = emit(candidate)
        if candidate is not None:
            yield candidate

    for candidate in sorted(
        [
            item
            for pattern in ("*.db", "*.sqlite", "*.sqlite3")
            for item in hermes_home.glob(pattern)
            if item.is_file()
        ],
        key=lambda item: item.stat().st_mtime,
        reverse=True,
    ):
        candidate = emit(candidate)
        if candidate is not None:
            yield candidate

    sessions_dir = hermes_home / "sessions"
    if sessions_dir.exists():
        for candidate in sorted(
            [
                item
                for pattern in ("*.db", "*.sqlite", "*.sqlite3")
                for item in sessions_dir.rglob(pattern)
                if item.is_file()
            ],
            key=lambda item: item.stat().st_mtime,
            reverse=True,
        ):
            candidate = emit(candidate)
            if candidate is not None:
                yield candidate
"#;

#[cfg(test)]
mod tests {
    use super::*;
    use base64::Engine;
    use serde_json::json;

    #[test]
    fn wrap_payload_embeds_base64_json_payload_and_body() {
        let script = wrap_payload(
            &json!({
                "hermes_home": "~/.hermes/profiles/researcher",
                "query": "привет",
            }),
            "print(json.dumps(payload, ensure_ascii=False))",
        )
        .expect("payload should wrap");

        let encoded = script
            .split("base64.b64decode(\"")
            .nth(1)
            .and_then(|tail| tail.split("\")").next())
            .expect("encoded payload should exist");
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(encoded)
            .expect("payload should decode");
        let payload: serde_json::Value =
            serde_json::from_slice(&decoded).expect("payload should be json");

        assert_eq!(payload["hermes_home"], "~/.hermes/profiles/researcher");
        assert_eq!(payload["query"], "привет");
        assert!(script.contains("def hermes_search_path(request=None):"));
        assert!(script.contains(r#"hermes_home / "hermes-agent" / "venv" / "bin""#));
        assert!(script.contains("print(json.dumps(payload, ensure_ascii=False))"));
    }

    #[test]
    fn shared_helpers_keep_remote_workspace_resolution_functions() {
        let script = wrap_payload(&json!({}), "print('ok')").expect("payload should wrap");

        assert!(script.contains("def expand_remote_path(value, home=None, base_dir=None):"));
        assert!(script.contains("def resolved_hermes_home(request=None):"));
        assert!(script.contains("def find_hermes_binary(request=None):"));
        assert!(script.contains("def connect_sqlite_readonly(path):"));
        assert!(script.contains("immutable=1"));
    }
}
