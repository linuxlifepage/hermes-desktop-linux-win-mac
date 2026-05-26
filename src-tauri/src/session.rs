use crate::connection::{
    remote_hermes_command_line, remote_hermes_home_path, shell_quote, workspace_scope_fingerprint,
};
use crate::error::Result;
use crate::models::{
    ConnectionProfile, HermesChatTurnResult, PinnedSession, RemoteSessionStore,
    SessionDetailResponse, SessionListPage, SessionMessage, SessionSummary,
};
use crate::remote_python::wrap_payload;
use crate::ssh;
use crate::storage::{load_preferences, save_preferences, AppStorage};
use chrono::Utc;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
struct SessionPageRequest {
    offset: usize,
    limit: usize,
    query: String,
    #[serde(rename = "hermes_home")]
    hermes_home: String,
}

#[derive(Debug, Serialize)]
struct SessionDetailRequest {
    #[serde(rename = "session_id")]
    session_id: String,
    #[serde(rename = "hermes_home")]
    hermes_home: String,
}

#[derive(Debug, Serialize)]
struct SessionDeleteRequest {
    #[serde(rename = "session_id")]
    session_id: String,
    #[serde(rename = "hermes_home")]
    hermes_home: String,
    #[serde(rename = "hinted_store_path")]
    hinted_store_path: Option<String>,
    #[serde(rename = "hinted_session_table")]
    hinted_session_table: Option<String>,
    #[serde(rename = "hinted_message_table")]
    hinted_message_table: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SessionDeleteResponse {
    ok: bool,
}

#[derive(Debug, Serialize)]
struct HermesChatRequest {
    #[serde(rename = "hermes_home")]
    hermes_home: String,
    #[serde(rename = "session_id")]
    session_id: Option<String>,
    #[serde(rename = "timeout_seconds")]
    timeout_seconds: usize,
    #[serde(rename = "auto_approve_commands")]
    auto_approve_commands: bool,
    arguments: Vec<String>,
}

pub async fn list_sessions_inner(
    profile: ConnectionProfile,
    offset: usize,
    limit: usize,
    query: String,
) -> Result<SessionListPage> {
    let request = SessionPageRequest {
        offset,
        limit,
        query,
        hermes_home: remote_hermes_home_path(&profile),
    };
    let body = format!("{SHARED_SESSION_HELPERS}\n{SESSION_LIST_BODY}");
    let script = wrap_payload(&request, &body)?;
    ssh::execute_json::<SessionListPage>(profile, script).await
}

pub async fn load_session_transcript_inner(
    profile: ConnectionProfile,
    session_id: String,
) -> Result<Vec<SessionMessage>> {
    let request = SessionDetailRequest {
        session_id,
        hermes_home: remote_hermes_home_path(&profile),
    };
    let body = format!("{SHARED_SESSION_HELPERS}\n{SESSION_DETAIL_BODY}");
    let script = wrap_payload(&request, &body)?;
    let response = ssh::execute_json::<SessionDetailResponse>(profile, script).await?;
    Ok(response.items)
}

pub async fn delete_session_inner(
    profile: ConnectionProfile,
    session_id: String,
    hinted_store: Option<RemoteSessionStore>,
) -> Result<()> {
    let request = SessionDeleteRequest {
        session_id,
        hermes_home: remote_hermes_home_path(&profile),
        hinted_store_path: hinted_store.as_ref().map(|store| store.path.clone()),
        hinted_session_table: hinted_store
            .as_ref()
            .and_then(|store| store.session_table.clone()),
        hinted_message_table: hinted_store
            .as_ref()
            .and_then(|store| store.message_table.clone()),
    };
    let body = format!("{SHARED_SESSION_HELPERS}\n{SESSION_DELETE_BODY}");
    let script = wrap_payload(&request, &body)?;
    let response = ssh::execute_json::<SessionDeleteResponse>(profile, script).await?;
    let _ok = response.ok;
    Ok(())
}

pub fn list_pinned_sessions_inner(
    storage: &AppStorage,
    profile: ConnectionProfile,
) -> Result<Vec<PinnedSession>> {
    let scope = workspace_scope_fingerprint(&profile);
    let mut pinned = load_preferences(storage)?
        .pinned_sessions
        .into_iter()
        .filter(|session| session.workspace_scope_fingerprint == scope)
        .collect::<Vec<_>>();
    pinned.sort_by(|left, right| right.created_at.cmp(&left.created_at));
    Ok(pinned)
}

pub fn pin_session_inner(
    storage: &AppStorage,
    profile: ConnectionProfile,
    session: SessionSummary,
) -> Result<Vec<PinnedSession>> {
    let scope = workspace_scope_fingerprint(&profile);
    let mut preferences = load_preferences(storage)?;
    let now = Utc::now();
    if let Some(existing) = preferences
        .pinned_sessions
        .iter_mut()
        .find(|item| item.workspace_scope_fingerprint == scope && item.id == session.id)
    {
        existing.title = session.title;
        existing.model = session.model;
        existing.parent_session_id = session.parent_session_id;
        existing.started_at = session.started_at;
        existing.last_active = session.last_active;
        existing.message_count = session.message_count;
        existing.preview = session.preview;
        existing.updated_at = now;
    } else {
        preferences.pinned_sessions.push(PinnedSession {
            id: session.id,
            workspace_scope_fingerprint: scope.clone(),
            title: session.title,
            model: session.model,
            parent_session_id: session.parent_session_id,
            started_at: session.started_at,
            last_active: session.last_active,
            message_count: session.message_count,
            preview: session.preview,
            created_at: now,
            updated_at: now,
        });
    }
    save_preferences(storage, &preferences)?;
    list_pinned_sessions_inner(storage, profile)
}

pub fn unpin_session_inner(
    storage: &AppStorage,
    profile: ConnectionProfile,
    session_id: String,
) -> Result<Vec<PinnedSession>> {
    let scope = workspace_scope_fingerprint(&profile);
    let mut preferences = load_preferences(storage)?;
    preferences.pinned_sessions.retain(|session| {
        !(session.workspace_scope_fingerprint == scope && session.id == session_id)
    });
    save_preferences(storage, &preferences)?;
    list_pinned_sessions_inner(storage, profile)
}

pub async fn send_session_message_inner(
    profile: ConnectionProfile,
    session_id: String,
    prompt: String,
    auto_approve_commands: bool,
) -> Result<HermesChatTurnResult> {
    let mut arguments = vec!["--resume".to_string(), session_id.clone()];
    if auto_approve_commands {
        arguments.push("--yolo".to_string());
    }
    arguments.extend([
        "chat".to_string(),
        "--quiet".to_string(),
        "--query".to_string(),
        prompt,
    ]);
    let request = HermesChatRequest {
        hermes_home: remote_hermes_home_path(&profile),
        session_id: Some(session_id),
        timeout_seconds: 1800,
        auto_approve_commands,
        arguments,
    };
    let script = wrap_payload(&request, CHAT_BODY)?;
    ssh::execute_json::<HermesChatTurnResult>(profile, script).await
}

pub fn session_resume_command_inner(profile: ConnectionProfile, session_id: String) -> String {
    let arguments = session_tui_arguments(&profile, Some(session_id));
    format!(
        "hermes {}",
        arguments
            .iter()
            .map(|argument| shell_quote(argument))
            .collect::<Vec<_>>()
            .join(" ")
    )
}

pub fn session_resume_startup_command_inner(
    profile: ConnectionProfile,
    session_id: String,
) -> String {
    let arguments = session_tui_arguments(&profile, Some(session_id));
    remote_hermes_command_line(&profile, &arguments)
}

pub fn session_tui_startup_command_inner(
    profile: ConnectionProfile,
    session_id: Option<String>,
) -> String {
    let arguments = session_tui_arguments(&profile, session_id);
    remote_hermes_command_line(&profile, &arguments)
}

fn session_tui_arguments(profile: &ConnectionProfile, session_id: Option<String>) -> Vec<String> {
    let mut arguments = Vec::new();
    if profile.custom_hermes_home_path.is_none() {
        if let Some(profile_name) = profile.hermes_profile.as_ref() {
            if !profile_name.trim().is_empty() {
                arguments.extend(["--profile".to_string(), profile_name.trim().to_string()]);
            }
        }
    }
    arguments.push("--tui".to_string());
    if let Some(session_id) = session_id
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        arguments.extend(["--resume".to_string(), session_id]);
    }
    arguments
}

const CHAT_BODY: &str = r#"
import os
import selectors
import subprocess
import time

def compact_output(stdout, stderr, exit_code):
    merged = "\n".join([
        stringify(stderr).strip() if stringify(stderr) else "",
        stringify(stdout).strip() if stringify(stdout) else "",
    ]).strip()
    if not merged:
        return f"Hermes chat exited with code {exit_code}."
    if len(merged) <= 4000:
        return merged
    return merged[-4000:]

def compact_text(value, limit=12000):
    text = stringify(value)
    if text is None or len(text) <= limit:
        return text
    return text[-limit:]

def looks_like_approval_request(text):
    lowered = (text or "").lower()
    approval_markers = [
        "approval required",
        "requires confirmation",
        "requires approval",
        "command approval",
        "approve command",
        "approve this command",
        "confirm command",
        "do you want to proceed",
        "allow command",
        "authorization required",
    ]
    if any(marker in lowered for marker in approval_markers):
        return True
    if "dangerous command" in lowered and "choice [o/s/a/d]" in lowered:
        return True
    if all(marker in lowered for marker in ["[o]nce", "[s]ession", "[a]lways", "[d]eny"]):
        return True
    return (
        "approve" in lowered and
        "deny" in lowered and
        any(marker in lowered for marker in ["command", "choice", "permission", "approval", "request"])
    )

def approval_error(message):
    return (
        "Hermes requested command approval, but this chat turn cannot collect manual approvals. "
        "Retry this turn with Auto-approve enabled, or resume the session in Terminal to review the command yourself."
        + ("\n\n" + message if message else "")
    )

def stop_process(process):
    if process.poll() is not None:
        return
    try:
        process.terminate()
        process.wait(timeout=5)
    except Exception:
        try:
            process.kill()
            process.wait(timeout=2)
        except Exception:
            pass

def run_hermes_chat(command, cwd, env, timeout_seconds, auto_approve_commands):
    process = subprocess.Popen(
        command,
        cwd=cwd,
        env=env,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    selector = selectors.DefaultSelector()
    stdout_chunks = []
    stderr_chunks = []
    started_at = time.monotonic()
    approval_seen_at = None
    last_output_at = started_at
    approval_grace_seconds = 8.0

    if process.stdout is not None:
        selector.register(process.stdout, selectors.EVENT_READ, "stdout")
    if process.stderr is not None:
        selector.register(process.stderr, selectors.EVENT_READ, "stderr")

    def append_chunk(stream_name, data):
        text = stringify(data)
        if stream_name == "stderr":
            stderr_chunks.append(text)
        else:
            stdout_chunks.append(text)

    try:
        while True:
            now = time.monotonic()
            if now - started_at > timeout_seconds:
                stdout = "".join(stdout_chunks)
                stderr = "".join(stderr_chunks)
                partial = compact_output(stdout, stderr, 124)
                stop_process(process)
                if looks_like_approval_request(partial):
                    fail(approval_error(partial))
                fail(
                    "Hermes did not finish within the allotted time. The turn was stopped so the app would not remain blocked indefinitely."
                    + ("\n\n" + partial if partial else "")
                )

            events = selector.select(timeout=0.2)
            for key, _ in events:
                try:
                    data = key.fileobj.read1(4096)
                except AttributeError:
                    data = key.fileobj.read(4096)
                if data:
                    append_chunk(key.data, data)
                    last_output_at = time.monotonic()
                else:
                    try:
                        selector.unregister(key.fileobj)
                    except Exception:
                        pass

            exit_code = process.poll()
            if exit_code is not None:
                for pipe, stream_name in ((process.stdout, "stdout"), (process.stderr, "stderr")):
                    if pipe is None:
                        continue
                    try:
                        remaining = pipe.read()
                    except Exception:
                        remaining = b""
                    if remaining:
                        append_chunk(stream_name, remaining)
                return "".join(stdout_chunks), "".join(stderr_chunks), exit_code

            if not auto_approve_commands:
                partial = compact_output("".join(stdout_chunks), "".join(stderr_chunks), None)
                if looks_like_approval_request(partial):
                    if approval_seen_at is None:
                        approval_seen_at = now
                    elif (
                        now - approval_seen_at >= approval_grace_seconds and
                        now - last_output_at >= approval_grace_seconds
                    ):
                        stop_process(process)
                        fail(approval_error(partial))
                else:
                    approval_seen_at = None
    finally:
        selector.close()

try:
    hermes_home = resolved_hermes_home()
    home = pathlib.Path.home()
    env = os.environ.copy()
    env["HERMES_HOME"] = str(hermes_home)
    env.setdefault("NO_COLOR", "1")
    env.setdefault("TERM", "dumb")
    env["PATH"] = hermes_search_path()

    hermes_path = find_hermes_binary()
    if hermes_path is None:
        fail("Hermes CLI was not found in the remote SSH environment. Verify that `hermes` is installed and available on PATH for non-interactive SSH commands.")

    arguments = payload.get("arguments") or []
    if not isinstance(arguments, list) or not all(isinstance(item, str) for item in arguments):
        fail("Invalid Hermes chat invocation.")

    timeout_seconds = int(payload.get("timeout_seconds") or 1800)
    auto_approve_commands = bool(payload.get("auto_approve_commands"))

    stdout, stderr, exit_code = run_hermes_chat(
        [hermes_path] + arguments,
        cwd=str(home),
        env=env,
        timeout_seconds=timeout_seconds,
        auto_approve_commands=auto_approve_commands,
    )

    message = compact_output(stdout, stderr, exit_code)
    if exit_code != 0:
        if not auto_approve_commands and looks_like_approval_request(message):
            fail(approval_error(message))
        fail(message)

    print(json.dumps({
        "ok": True,
        "session_id": payload.get("session_id"),
        "stdout": compact_text(stdout),
        "stderr": compact_text(stderr),
    }, ensure_ascii=False))
except Exception as exc:
    fail(f"Unable to run Hermes chat over SSH: {exc}")
"#;

const SESSION_LIST_BODY: &str = r#"
request = payload
context = None

try:
    context = try_open_store()
    search_query = normalize_search_text(request.get("query"))

    if context is None:
        items = build_jsonl_session_summaries(search_query)
        if not items:
            fail(
                f"No readable SQLite session store was discovered under {display_hermes_home()}, "
                f"and no JSONL session artifacts were found under {display_hermes_home()}/sessions."
            )
    else:
        session_rows = context["connection"].execute(
            f"SELECT * FROM {quote_ident(context['session_table'])}"
        ).fetchall()

        items = []
        for row in session_rows:
            record = dict(zip(context["session_columns"], row))
            session_id = stringify(record.get(context["session_id_column"]))
            if not session_id:
                continue

            last_active, message_count = session_stats(context, session_id, record)
            preview = session_preview(context, session_id)
            title = sanitize_title(record.get(context["session_title_column"])) if context["session_title_column"] else None
            if title is None and preview:
                title = preview[:80]

            model = sanitize_model(record.get(context["session_model_column"])) if context["session_model_column"] else None
            model = latest_model_for_session(context, session_id, model)

            items.append({
                "id": session_id,
                "title": title,
                "model": model,
                "parent_session_id": stringify(record.get(context["session_parent_column"])) if context["session_parent_column"] else None,
                "started_at": normalize_json_value(record.get(context["session_started_column"])) if context["session_started_column"] else None,
                "last_active": normalize_json_value(last_active),
                "message_count": message_count,
                "preview": preview,
            })

        items.sort(key=lambda item: sort_key(item.get("last_active") or item.get("started_at")), reverse=True)

    if search_query is not None:
        search_matches = build_sqlite_session_search_matches(context, search_query) if context is not None else {}
        filtered_items = []
        for item in items:
            session_id = stringify(item.get("id"))
            if session_id and session_id in search_matches:
                item["search_match"] = search_matches[session_id]
                filtered_items.append(item)
                continue

            if item.get("search_match") or session_matches_query(item, search_query):
                if not item.get("search_match"):
                    metadata_match = metadata_search_match(item, search_query)
                    if metadata_match:
                        item["search_match"] = metadata_match
                filtered_items.append(item)
        items = filtered_items

    start = int(request.get("offset", 0))
    end = start + int(request.get("limit", 50))

    print(json.dumps({
        "ok": True,
        "total_count": len(items),
        "items": items[start:end],
    }, ensure_ascii=False))
except Exception as exc:
    fail(f"Unable to read the remote Hermes session list: {exc}")
finally:
    close_context(context)
"#;

const SESSION_DETAIL_BODY: &str = r#"
request = payload
context = None

try:
    session_id = stringify(request.get("session_id"))
    if not session_id:
        fail("The session ID is required.")

    context = try_open_store()

    if context is None:
        items = load_jsonl_transcript(session_id)
    else:
        query = (
            f"SELECT * FROM {quote_ident(context['message_table'])} "
            f"WHERE {quote_ident(context['message_session_id_column'])} = ? "
            "ORDER BY "
        )
        if context["message_timestamp_column"]:
            query += f"{quote_ident(context['message_timestamp_column'])}, "
        query += quote_ident(context["message_id_column"])

        rows = context["connection"].execute(query, (session_id,)).fetchall()

        items = []
        for row in rows:
            record = dict(zip(context["message_columns"], row))
            metadata = message_metadata(record, context)
            items.append({
                "id": stringify(record.get(context["message_id_column"])) or str(len(items) + 1),
                "role": stringify(record.get(context["message_role_column"])) if context["message_role_column"] else "event",
                "content": extract_record_content(record),
                "timestamp": normalize_json_value(record.get(context["message_timestamp_column"])) if context["message_timestamp_column"] else None,
                "metadata": metadata or None,
            })

    print(json.dumps({
        "ok": True,
        "items": items,
    }, ensure_ascii=False))
except Exception as exc:
    fail(f"Unable to read the remote Hermes transcript: {exc}")
finally:
    close_context(context)
"#;

const SESSION_DELETE_BODY: &str = r#"
request = payload

try:
    session_id = stringify(request.get("session_id"))
    if not session_id:
        fail("The session ID is required.")

    deleted_session_rows = 0
    deleted_message_rows = 0
    deleted_jsonl_artifact = False

    store_path, session_table, message_table = discover_store_location(
        request.get("hinted_store_path"),
        request.get("hinted_session_table"),
        request.get("hinted_message_table")
    )

    if store_path is not None:
        connection = sqlite3.connect(store_path)
        connection.execute("PRAGMA busy_timeout = 2000")

        try:
            session_columns = [row[1] for row in connection.execute(
                f"PRAGMA table_info({quote_ident(session_table)})"
            ).fetchall()]
            message_columns = [row[1] for row in connection.execute(
                f"PRAGMA table_info({quote_ident(message_table)})"
            ).fetchall()]

            session_id_column = choose_column(session_columns, ["id", "session_id"])
            message_session_id_column = choose_column(message_columns, ["session_id", "conversation_id"])

            missing = [
                name for name, value in [
                    ("session id", session_id_column),
                    ("message session id", message_session_id_column),
                ] if value is None
            ]

            if missing:
                fail("Unsupported session schema: missing " + ", ".join(missing))

            with connection:
                deleted_message_rows = connection.execute(
                    f"DELETE FROM {quote_ident(message_table)} "
                    f"WHERE {quote_ident(message_session_id_column)} = ?",
                    (session_id,)
                ).rowcount

                deleted_session_rows = connection.execute(
                    f"DELETE FROM {quote_ident(session_table)} "
                    f"WHERE {quote_ident(session_id_column)} = ?",
                    (session_id,)
                ).rowcount
        finally:
            connection.close()

    artifact = None
    for path in discover_jsonl_artifacts():
        if path.stem == session_id:
            artifact = path
            break

    if artifact is not None:
        artifact.unlink()
        deleted_jsonl_artifact = True

    if deleted_session_rows <= 0 and deleted_message_rows <= 0 and not deleted_jsonl_artifact:
        fail(f"No remote Hermes session matching '{session_id}' was found to delete.")

    print(json.dumps({
        "ok": True,
    }, ensure_ascii=False))
except Exception as exc:
    fail(f"Unable to delete the remote Hermes session: {exc}")
"#;

const SHARED_SESSION_HELPERS: &str = r#"
import datetime
import json
import pathlib
import re
import sqlite3

def close_context(context):
    try:
        if context and context.get("connection"):
            context["connection"].close()
    except Exception:
        pass

def display_hermes_home():
    requested = stringify(payload.get("hermes_home"))
    if requested:
        return requested
    return "~/.hermes"

def normalize_json_value(value):
    if value is None:
        return None
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    if isinstance(value, dict):
        return {
            stringify(key) or "key": normalize_json_value(item)
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [normalize_json_value(item) for item in value]
    if isinstance(value, (str, int, float, bool)):
        return value
    return str(value)

def normalize_search_text(value):
    text = stringify(value)
    if text is None:
        return None
    text = text.strip()
    return text.casefold() if text else None

def session_matches_query(item, query):
    for field in (item.get("id"), item.get("title"), item.get("preview"), item.get("model")):
        text = normalize_search_text(field)
        if text is not None and query in text:
            return True
    return False

def metadata_search_match(item, query):
    for field in (item.get("title"), item.get("preview"), item.get("model"), item.get("id")):
        snippet = search_snippet(field, query)
        if snippet:
            return {
                "match_count": 1,
                "message_id": None,
                "role": None,
                "timestamp": None,
                "snippet": snippet,
            }
    return None

def search_snippet(value, query, radius=80, limit=220):
    text = sanitize_preview(searchable_text(value))
    if not text:
        return None
    folded = text.casefold()
    index = folded.find(query)
    if index < 0:
        return None
    start = max(0, index - radius)
    end = min(len(text), index + len(query) + radius)
    snippet = text[start:end].strip()
    if start > 0:
        snippet = "..." + snippet
    if end < len(text):
        snippet = snippet + "..."
    if len(snippet) > limit:
        snippet = snippet[:limit - 3].rstrip() + "..."
    return snippet

def searchable_text(value):
    if value is None:
        return None
    if isinstance(value, (dict, list, tuple)):
        return json.dumps(value, ensure_ascii=False)
    return stringify(value)

def value_matches_query(value, query):
    text = searchable_text(value)
    if text is None:
        return False
    return query in text.casefold()

def escape_like_pattern(value):
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")

def is_ascii_text(value):
    try:
        value.encode("ascii")
        return True
    except Exception:
        return False

def role_priority(role):
    normalized = normalize_search_text(role) or ""
    if normalized in ("user", "assistant"):
        return 0
    if normalized == "system":
        return 1
    return 2

def prune_metadata_value(value):
    if value is None:
        return None
    if isinstance(value, dict):
        cleaned = {}
        for key, item in value.items():
            normalized_item = prune_metadata_value(item)
            if normalized_item is not None:
                cleaned[key] = normalized_item
        return cleaned or None
    if isinstance(value, list):
        cleaned = []
        for item in value:
            normalized_item = prune_metadata_value(item)
            if normalized_item is not None:
                cleaned.append(normalized_item)
        return cleaned or None
    return value

def sort_key(value):
    if value is None:
        return (0, 0.0, "")
    if isinstance(value, (int, float)):
        return (2, float(value), "")
    try:
        return (2, float(value), "")
    except Exception:
        parsed = parse_timestamp_value(value)
        if isinstance(parsed, (int, float)):
            return (2, float(parsed), "")
        return (1, 0.0, str(value))

def sanitize_preview(text):
    if text is None:
        return None
    return text.replace("\n", " ").replace("\r", " ").strip()

def sanitize_title(value):
    text = sanitize_preview(stringify(value))
    if text is None or not text:
        return None
    if text.lower().startswith("<think>"):
        return None
    return text[:120]

def sanitize_model(value):
    text = sanitize_preview(stringify(value))
    if text is None or not text:
        return None
    return text[:160]

def extract_model_from_record(record):
    direct = sanitize_model(record.get("model") or record.get("model_name"))
    if direct:
        return direct

    metadata = record.get("metadata")
    if not isinstance(metadata, dict):
        metadata_text = stringify(metadata)
        if metadata_text:
            try:
                parsed_metadata = json.loads(metadata_text)
                if isinstance(parsed_metadata, dict):
                    metadata = parsed_metadata
            except Exception:
                pass
    if isinstance(metadata, dict):
        nested = sanitize_model(
            metadata.get("model") or
            metadata.get("model_name") or
            metadata.get("default_model") or
            metadata.get("active_model")
        )
        if nested:
            return nested

    return None

def latest_model_for_session(context, session_id, fallback=None):
    query = (
        f"SELECT * FROM {quote_ident(context['message_table'])} "
        f"WHERE {quote_ident(context['message_session_id_column'])} = ? "
        "ORDER BY "
    )
    if context["message_timestamp_column"]:
        query += f"{quote_ident(context['message_timestamp_column'])} DESC, "
    query += f"{quote_ident(context['message_id_column'])} DESC LIMIT 80"
    try:
        rows = context["connection"].execute(query, (session_id,)).fetchall()
    except Exception:
        return fallback
    for row in rows:
        record = dict(zip(context["message_columns"], row))
        model = extract_model_from_record(record)
        if model:
            return model
    return fallback

def parse_timestamp_value(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    value = stringify(value)
    if value is None:
        return None
    try:
        return float(value)
    except Exception:
        pass
    normalized = value.replace("Z", "+00:00")
    try:
        return datetime.datetime.fromisoformat(normalized).timestamp()
    except Exception:
        return value

def filename_timestamp(path):
    match = re.match(r"^(\d{8})_(\d{6})", path.stem)
    if not match:
        return None
    try:
        return datetime.datetime.strptime(match.group(1) + match.group(2), "%Y%m%d%H%M%S").timestamp()
    except Exception:
        return None

def extract_record_content(record):
    content = record.get("content")
    if content in (None, "") and record.get("text") is not None:
        content = record.get("text")
    if content in (None, "") and record.get("body") is not None:
        content = record.get("body")
    if content in (None, "") and record.get("reasoning") is not None:
        content = record.get("reasoning")
    if content in (None, "") and record.get("reasoning_content") is not None:
        content = record.get("reasoning_content")
    if content in (None, "") and record.get("tool_calls") is not None:
        content = record.get("tool_calls")
    if content is None:
        return None
    if isinstance(content, (dict, list, tuple)):
        return json.dumps(content, ensure_ascii=False)
    return stringify(content)

def choose_columns(columns, choices):
    results = []
    lowered = {column.lower(): column for column in columns}
    for choice in choices:
        exact = lowered.get(choice.lower())
        if exact and exact not in results:
            results.append(exact)
    for choice in choices:
        needle = choice.lower()
        for column in columns:
            if needle in column.lower() and column not in results:
                results.append(column)
    return results

def extract_record_search_texts(record, context):
    texts = []
    seen = set()

    def append(value):
        text = searchable_text(value)
        if text is None or text in seen:
            return
        seen.add(text)
        texts.append(text)

    display_content = extract_record_content(record)
    append(display_content)
    if display_content in (None, ""):
        for column in context.get("message_search_columns") or []:
            append(record.get(column))
    return texts

def build_sqlite_session_search_matches(context, query):
    search_columns = context.get("message_search_columns") or []
    if not search_columns:
        return {}

    search_sql = f"SELECT * FROM {quote_ident(context['message_table'])}"
    args = ()
    if is_ascii_text(query):
        where = " OR ".join(
            f"CAST({quote_ident(column)} AS TEXT) COLLATE NOCASE LIKE ? ESCAPE '\\'"
            for column in search_columns
        )
        args = tuple([f"%{escape_like_pattern(query)}%"] * len(search_columns))
        search_sql += f" WHERE {where}"

    search_sql += " ORDER BY "
    if context["message_timestamp_column"]:
        search_sql += f"{quote_ident(context['message_timestamp_column'])}, "
    search_sql += quote_ident(context["message_id_column"])
    rows = context["connection"].execute(search_sql, args)

    matches = {}
    for row in rows:
        record = dict(zip(context["message_columns"], row))
        session_id = stringify(record.get(context["message_session_id_column"]))
        if not session_id:
            continue

        matched_text = None
        for text in extract_record_search_texts(record, context):
            if value_matches_query(text, query):
                matched_text = text
                break
        if matched_text is None:
            continue

        role = stringify(record.get(context["message_role_column"])) if context["message_role_column"] else None
        timestamp = normalize_json_value(record.get(context["message_timestamp_column"])) if context["message_timestamp_column"] else None
        message_id = stringify(record.get(context["message_id_column"])) or None
        snippet = search_snippet(matched_text, query)
        priority = role_priority(role)

        existing = matches.get(session_id)
        if existing is None:
            matches[session_id] = {
                "match_count": 1,
                "message_id": message_id,
                "role": role,
                "timestamp": timestamp,
                "snippet": snippet,
                "_priority": priority,
            }
            continue

        existing["match_count"] += 1
        if priority < existing.get("_priority", 99):
            existing["message_id"] = message_id
            existing["role"] = role
            existing["timestamp"] = timestamp
            existing["snippet"] = snippet
            existing["_priority"] = priority

    for match in matches.values():
        match.pop("_priority", None)
    return matches

def discover_jsonl_artifacts():
    sessions_dir = resolved_hermes_home() / "sessions"
    if not sessions_dir.exists():
        return []
    return sorted(
        [item for item in sessions_dir.rglob("*.jsonl") if item.is_file()],
        key=lambda item: item.stat().st_mtime,
        reverse=True,
    )

def discover_store_location(hinted_path=None, hinted_session_table=None, hinted_message_table=None):
    home = pathlib.Path.home()
    hermes_home = resolved_hermes_home()
    if not hermes_home.exists():
        return None, None, None

    for candidate in iter_session_store_candidates(hermes_home, home, hinted_path):
        try:
            connection = connect_sqlite_readonly(candidate)
            connection.execute("PRAGMA busy_timeout = 2000")
            tables = [row[0] for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
            ).fetchall()]
            session_table = table_by_hint(tables, hinted_session_table) or choose_table(tables, "sessions")
            message_table = table_by_hint(tables, hinted_message_table) or choose_table(tables, "messages")
            connection.close()
            if session_table and message_table:
                return str(candidate), session_table, message_table
        except Exception:
            continue
    return None, None, None

def table_by_hint(tables, hint):
    if not hint:
        return None
    for table in tables:
        if table.lower() == str(hint).lower():
            return table
    return None

def try_open_store(hinted_path=None, hinted_session_table=None, hinted_message_table=None):
    store_path, session_table, message_table = discover_store_location(
        hinted_path,
        hinted_session_table,
        hinted_message_table
    )
    if not store_path:
        return None

    connection = connect_sqlite_readonly(store_path)
    connection.execute("PRAGMA busy_timeout = 2000")

    session_columns = [row[1] for row in connection.execute(
        f"PRAGMA table_info({quote_ident(session_table)})"
    ).fetchall()]
    message_columns = [row[1] for row in connection.execute(
        f"PRAGMA table_info({quote_ident(message_table)})"
    ).fetchall()]

    session_id_column = choose_column(session_columns, ["id", "session_id"])
    session_title_column = choose_column(session_columns, ["title", "summary", "name"])
    session_started_column = choose_column(session_columns, ["started_at", "created_at", "timestamp"])
    session_message_count_column = choose_column(session_columns, ["message_count"])
    session_model_column = choose_column(session_columns, ["model"])
    session_parent_column = choose_column(session_columns, ["parent_session_id", "parent_id"])

    message_id_column = choose_column(message_columns, ["id", "message_id"])
    message_session_id_column = choose_column(message_columns, ["session_id", "conversation_id"])
    message_role_column = choose_column(message_columns, ["role", "sender", "author"])
    message_content_column = choose_column(message_columns, ["content", "text", "body"])
    message_timestamp_column = choose_column(message_columns, ["timestamp", "created_at", "time"])
    message_search_columns = choose_columns(message_columns, [
        "content",
        "text",
        "body",
        "reasoning",
        "reasoning_content",
        "tool_calls",
    ])

    missing = [
        name for name, value in [
            ("session id", session_id_column),
            ("message id", message_id_column),
            ("message session id", message_session_id_column),
        ] if value is None
    ]
    if missing:
        fail("Unsupported session schema: missing " + ", ".join(missing))

    return {
        "connection": connection,
        "store_path": store_path,
        "session_table": session_table,
        "message_table": message_table,
        "session_columns": session_columns,
        "message_columns": message_columns,
        "session_id_column": session_id_column,
        "session_title_column": session_title_column,
        "session_started_column": session_started_column,
        "session_message_count_column": session_message_count_column,
        "session_model_column": session_model_column,
        "session_parent_column": session_parent_column,
        "message_id_column": message_id_column,
        "message_session_id_column": message_session_id_column,
        "message_role_column": message_role_column,
        "message_content_column": message_content_column,
        "message_timestamp_column": message_timestamp_column,
        "message_search_columns": message_search_columns,
    }

def session_stats(context, session_id, session_record):
    if context["message_timestamp_column"]:
        stats = context["connection"].execute(
            f"SELECT COUNT(*), MAX({quote_ident(context['message_timestamp_column'])}) "
            f"FROM {quote_ident(context['message_table'])} "
            f"WHERE {quote_ident(context['message_session_id_column'])} = ?",
            (session_id,)
        ).fetchone()
    else:
        stats = context["connection"].execute(
            f"SELECT COUNT(*), NULL "
            f"FROM {quote_ident(context['message_table'])} "
            f"WHERE {quote_ident(context['message_session_id_column'])} = ?",
            (session_id,)
        ).fetchone()

    if context["session_message_count_column"] and session_record.get(context["session_message_count_column"]) is not None:
        message_count = int(session_record.get(context["session_message_count_column"]))
    else:
        message_count = int(stats[0]) if stats and stats[0] is not None else None
    last_active = stats[1] if stats and stats[1] is not None else (
        session_record.get(context["session_started_column"]) if context["session_started_column"] else None
    )
    return last_active, message_count

def session_preview(context, session_id):
    if not context["message_content_column"]:
        return None
    preview_query = (
        f"SELECT {quote_ident(context['message_content_column'])} "
        f"FROM {quote_ident(context['message_table'])} "
        f"WHERE {quote_ident(context['message_session_id_column'])} = ? "
    )
    preview_args = [session_id]
    if context["message_role_column"]:
        preview_query += f"AND {quote_ident(context['message_role_column'])} IN ('user', 'assistant', 'system') "
    preview_query += "ORDER BY "
    if context["message_timestamp_column"]:
        preview_query += f"{quote_ident(context['message_timestamp_column'])}, "
    preview_query += f"{quote_ident(context['message_id_column'])} LIMIT 1"
    preview_row = context["connection"].execute(preview_query, tuple(preview_args)).fetchone()
    if preview_row and preview_row[0] is not None:
        return sanitize_preview(stringify(preview_row[0]))[:120]
    return None

def message_metadata(record, context):
    metadata = {}
    skip_columns = {
        context["message_id_column"],
        context["message_session_id_column"],
        context["message_role_column"],
        context["message_content_column"],
        context["message_timestamp_column"],
    }
    for key, value in record.items():
        if key in skip_columns:
            continue
        normalized_value = prune_metadata_value(normalize_json_value(value))
        if normalized_value is not None:
            metadata[key] = normalized_value
    return metadata

def build_jsonl_session_summaries(search_query=None):
    items = []
    for path in discover_jsonl_artifacts():
        started_at = filename_timestamp(path) or path.stat().st_mtime
        last_active = started_at
        message_count = 0
        preview = None
        title = None
        model = None
        parent_session_id = None
        match_count = 0
        best_match = None

        try:
            with path.open("r", encoding="utf-8") as handle:
                for line in handle:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        record = json.loads(line)
                    except Exception:
                        continue
                    if not isinstance(record, dict):
                        continue

                    role = stringify(record.get("role"))
                    if role == "session_meta":
                        if parent_session_id is None:
                            parent_session_id = stringify(
                                record.get("parent_session_id")
                                or record.get("parent_id")
                                or record.get("parentSessionId")
                            )
                        continue

                    if model is None:
                        model = extract_model_from_record(record)
                    timestamp = parse_timestamp_value(record.get("timestamp"))
                    if timestamp is not None:
                        if started_at is None:
                            started_at = timestamp
                        last_active = timestamp

                    content = sanitize_preview(extract_record_content(record))
                    message_count += 1
                    if preview is None and content:
                        preview = content[:120]
                    if title is None and role in ("user", "assistant", "system") and content:
                        title = sanitize_title(content[:80])

                    if search_query is not None and value_matches_query(content, search_query):
                        match_count += 1
                        candidate_priority = role_priority(role)
                        if best_match is None or candidate_priority < best_match["_priority"]:
                            best_match = {
                                "match_count": 0,
                                "message_id": str(message_count),
                                "role": role,
                                "timestamp": normalize_json_value(timestamp),
                                "snippet": search_snippet(content, search_query),
                                "_priority": candidate_priority,
                            }
        except Exception:
            continue

        item = {
            "id": path.stem,
            "title": title or path.stem,
            "model": model,
            "parent_session_id": parent_session_id,
            "started_at": normalize_json_value(started_at),
            "last_active": normalize_json_value(last_active or path.stat().st_mtime),
            "message_count": message_count,
            "preview": preview,
        }

        if best_match is not None:
            best_match["match_count"] = match_count
            best_match.pop("_priority", None)
            item["search_match"] = best_match

        items.append(item)

    items.sort(key=lambda item: sort_key(item.get("last_active") or item.get("started_at")), reverse=True)
    return items

def load_jsonl_transcript(session_id):
    artifact = None
    for path in discover_jsonl_artifacts():
        if path.stem == session_id:
            artifact = path
            break
    if artifact is None:
        fail(f"No JSONL transcript artifact was found for session '{session_id}'.")

    items = []
    with artifact.open("r", encoding="utf-8") as handle:
        for index, line in enumerate(handle, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
            except Exception:
                continue
            if not isinstance(record, dict):
                continue

            role = stringify(record.get("role")) or "event"
            if role == "session_meta":
                continue

            metadata = {}
            for key, value in record.items():
                if key in {"role", "content", "timestamp"}:
                    continue
                normalized_value = prune_metadata_value(normalize_json_value(value))
                if normalized_value is not None:
                    metadata[key] = normalized_value

            items.append({
                "id": str(index),
                "role": role,
                "content": extract_record_content(record),
                "timestamp": normalize_json_value(parse_timestamp_value(record.get("timestamp"))),
                "metadata": metadata or None,
            })

    return items
"#;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::remote_python::assert_python_payload_compiles;

    #[test]
    fn session_payloads_compile() {
        assert_python_payload_compiles(
            &SessionPageRequest {
                offset: 0,
                limit: 20,
                query: String::new(),
                hermes_home: "~/.hermes".to_string(),
            },
            &format!("{SHARED_SESSION_HELPERS}\n{SESSION_LIST_BODY}"),
        );
        assert_python_payload_compiles(
            &SessionDetailRequest {
                session_id: "session-id".to_string(),
                hermes_home: "~/.hermes".to_string(),
            },
            &format!("{SHARED_SESSION_HELPERS}\n{SESSION_DETAIL_BODY}"),
        );
        assert_python_payload_compiles(
            &SessionDeleteRequest {
                session_id: "session-id".to_string(),
                hermes_home: "~/.hermes".to_string(),
                hinted_store_path: None,
                hinted_session_table: None,
                hinted_message_table: None,
            },
            &format!("{SHARED_SESSION_HELPERS}\n{SESSION_DELETE_BODY}"),
        );
        assert_python_payload_compiles(
            &HermesChatRequest {
                hermes_home: "~/.hermes".to_string(),
                session_id: Some("session-id".to_string()),
                timeout_seconds: 1,
                auto_approve_commands: false,
                arguments: vec!["--resume".to_string(), "session-id".to_string()],
            },
            CHAT_BODY,
        );
    }

    #[test]
    fn session_tui_arguments_cover_new_and_resumed_chats() {
        let profile = ConnectionProfile {
            hermes_profile: Some("staging".to_string()),
            ..ConnectionProfile::default()
        };

        assert_eq!(
            session_tui_arguments(&profile, None),
            vec![
                "--profile".to_string(),
                "staging".to_string(),
                "--tui".to_string()
            ]
        );
        assert_eq!(
            session_tui_arguments(&profile, Some(" session-id ".to_string())),
            vec![
                "--profile".to_string(),
                "staging".to_string(),
                "--tui".to_string(),
                "--resume".to_string(),
                "session-id".to_string()
            ]
        );
    }

    #[test]
    fn session_tui_arguments_omit_profile_for_custom_home() {
        let profile = ConnectionProfile {
            hermes_profile: Some("staging".to_string()),
            custom_hermes_home_path: Some("~/.hermes".to_string()),
            ..ConnectionProfile::default()
        };

        assert_eq!(
            session_tui_arguments(&profile, None),
            vec!["--tui".to_string()]
        );
    }
}
