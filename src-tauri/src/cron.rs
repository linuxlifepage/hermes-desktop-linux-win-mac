use crate::connection::remote_hermes_home_path;
use crate::error::{HermesError, Result};
use crate::models::{ConnectionProfile, CronJob, CronJobDraftPayload, CronJobListResponse};
use crate::remote_python;
use crate::ssh;
use serde::{Deserialize, Serialize};

pub async fn list_cron_jobs_inner(profile: ConnectionProfile) -> Result<Vec<CronJob>> {
    let payload = EmptyCronRequest {
        hermes_home: remote_hermes_home_path(&profile),
        profile_name: cli_profile_name(&profile),
    };
    let script = remote_python::wrap_payload(&payload, CRON_LIST_BODY)?;
    let response = ssh::execute_json::<CronJobListResponse>(profile, script).await?;
    Ok(response.jobs)
}

pub async fn create_cron_job_inner(
    profile: ConnectionProfile,
    draft: CronJobDraftPayload,
) -> Result<String> {
    let payload = CronMutationRequest {
        action: "create",
        job_id: None,
        hermes_home: remote_hermes_home_path(&profile),
        profile_name: cli_profile_name(&profile),
        draft,
    };
    let script = remote_python::wrap_payload(&payload, CRON_MUTATION_BODY)?;
    let response = ssh::execute_json::<CronMutationResponse>(profile, script).await?;
    response.job_id.ok_or_else(|| {
        HermesError::Remote("The remote cron create command did not return a job ID.".to_string())
    })
}

pub async fn update_cron_job_inner(
    profile: ConnectionProfile,
    job_id: String,
    draft: CronJobDraftPayload,
) -> Result<String> {
    let payload = CronMutationRequest {
        action: "update",
        job_id: Some(job_id),
        hermes_home: remote_hermes_home_path(&profile),
        profile_name: cli_profile_name(&profile),
        draft,
    };
    let script = remote_python::wrap_payload(&payload, CRON_MUTATION_BODY)?;
    let response = ssh::execute_json::<CronMutationResponse>(profile, script).await?;
    response.job_id.ok_or_else(|| {
        HermesError::Remote("The remote cron update command did not return a job ID.".to_string())
    })
}

pub async fn pause_cron_job_inner(profile: ConnectionProfile, job_id: String) -> Result<()> {
    run_cron_command(profile, job_id, "pause").await
}

pub async fn resume_cron_job_inner(profile: ConnectionProfile, job_id: String) -> Result<()> {
    run_cron_command(profile, job_id, "resume").await
}

pub async fn remove_cron_job_inner(profile: ConnectionProfile, job_id: String) -> Result<()> {
    run_cron_command(profile, job_id, "remove").await
}

pub async fn run_cron_job_now_inner(profile: ConnectionProfile, job_id: String) -> Result<()> {
    run_cron_command(profile, job_id, "run").await
}

async fn run_cron_command(
    profile: ConnectionProfile,
    job_id: String,
    command: &'static str,
) -> Result<()> {
    let payload = CronCommandRequest {
        job_id,
        command,
        hermes_home: remote_hermes_home_path(&profile),
        profile_name: cli_profile_name(&profile),
    };
    let script = remote_python::wrap_payload(&payload, CRON_COMMAND_BODY)?;
    let _response = ssh::execute_json::<serde_json::Value>(profile, script).await?;
    Ok(())
}

fn cli_profile_name(profile: &ConnectionProfile) -> Option<String> {
    if profile.custom_hermes_home_path.is_some() {
        return None;
    }
    profile.hermes_profile.clone()
}

#[derive(Serialize)]
struct EmptyCronRequest {
    hermes_home: String,
    profile_name: Option<String>,
}

#[derive(Serialize)]
struct CronCommandRequest {
    job_id: String,
    command: &'static str,
    hermes_home: String,
    profile_name: Option<String>,
}

#[derive(Serialize)]
struct CronMutationRequest {
    action: &'static str,
    job_id: Option<String>,
    hermes_home: String,
    profile_name: Option<String>,
    draft: CronJobDraftPayload,
}

#[derive(Deserialize)]
struct CronMutationResponse {
    job_id: Option<String>,
}

const CRON_LIST_BODY: &str = r#"
from datetime import datetime, timezone

def normalize_bool(value):
    if isinstance(value, bool):
        return value
    if value is None:
        return None

    lowered = str(value).strip().lower()
    if lowered in {"1", "true", "yes", "on"}:
        return True
    if lowered in {"0", "false", "no", "off"}:
        return False
    return None

def normalize_list(value):
    if value is None:
        return []
    if isinstance(value, (list, tuple, set)):
        items = []
        for item in value:
            normalized = normalize_text(item)
            if normalized is not None:
                items.append(normalized)
        return items

    normalized = normalize_text(value)
    return [normalized] if normalized is not None else []

def first_text(*values):
    for value in values:
        normalized = normalize_text(value)
        if normalized is not None:
            return normalized
    return None

def first_int(*values):
    for value in values:
        if value is None:
            continue
        try:
            return int(value)
        except Exception:
            continue
    return None

def normalize_date(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(float(value), tz=timezone.utc).isoformat(timespec="seconds")

    text = normalize_text(value)
    if text is None:
        return None

    try:
        return datetime.fromtimestamp(float(text), tz=timezone.utc).isoformat(timespec="seconds")
    except Exception:
        pass

    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if parsed.tzinfo is not None:
            parsed = parsed.astimezone(timezone.utc)
        return parsed.isoformat(timespec="seconds")
    except Exception:
        return text

def normalize_state(item):
    raw_state = first_text(
        item.get("state"),
        item.get("status"),
        item.get("job_state"),
    )
    if raw_state is not None:
        return raw_state.lower()

    if item.get("paused_at") is not None:
        return "paused"
    if normalize_bool(item.get("running")) is True:
        return "running"
    if normalize_bool(item.get("enabled")) is False:
        return "paused"
    return "scheduled"

def normalize_schedule(item):
    schedule = item.get("schedule") if isinstance(item.get("schedule"), dict) else {}
    expr = first_text(
        schedule.get("expr"),
        schedule.get("expression"),
        item.get("cron"),
        item.get("schedule_expr"),
    )
    schedule_display = first_text(
        item.get("schedule_display"),
        item.get("scheduleDisplay"),
        schedule.get("display"),
        schedule.get("summary"),
        expr,
    ) or "Custom schedule"

    normalized_schedule = {
        "kind": first_text(schedule.get("kind"), item.get("schedule_kind")),
        "expr": expr,
        "timezone": first_text(schedule.get("timezone"), schedule.get("tz"), item.get("timezone")),
    }

    if normalized_schedule["kind"] is None and normalized_schedule["expr"] is None and normalized_schedule["timezone"] is None:
        normalized_schedule = None

    return normalized_schedule, schedule_display

def normalize_recurrence(item):
    recurrence = item.get("recurrence")
    if not isinstance(recurrence, dict):
        recurrence = item.get("repeat")
    if not isinstance(recurrence, dict):
        return None

    times = first_int(recurrence.get("times"))
    remaining = first_int(recurrence.get("remaining"), recurrence.get("remaining_runs"))

    if times is None and remaining is None:
        return None

    return {
        "times": times,
        "remaining": remaining,
    }

def normalize_origin(item):
    origin = item.get("origin")
    if not isinstance(origin, dict):
        return None

    normalized = {
        "kind": first_text(origin.get("kind"), origin.get("type")),
        "source": first_text(origin.get("source"), origin.get("path")),
        "label": first_text(origin.get("label"), origin.get("name")),
    }

    if normalized["kind"] is None and normalized["source"] is None and normalized["label"] is None:
        return None

    return normalized

def delivery_target(item, payload_data):
    delivery = item.get("delivery")
    if isinstance(delivery, dict):
        return first_text(delivery.get("target"), delivery.get("destination"), delivery.get("mode"))

    return first_text(
        item.get("deliver"),
        item.get("delivery_target"),
        delivery,
        payload_data.get("deliver") if isinstance(payload_data, dict) else None,
    )

def normalize_job(item):
    if not isinstance(item, dict):
        return None

    job_id = first_text(item.get("id"), item.get("job_id"), item.get("slug"))
    if job_id is None:
        return None

    payload_data = item.get("payload")
    payload_payload = payload_data if isinstance(payload_data, dict) else {}
    prompt = first_text(
        item.get("prompt"),
        item.get("message"),
        payload_payload.get("prompt"),
        payload_payload.get("message"),
        payload_payload.get("task"),
    ) or ""

    name = first_text(
        item.get("name"),
        item.get("title"),
        payload_payload.get("name"),
        prompt.splitlines()[0] if prompt else None,
        job_id,
    ) or job_id

    skills = normalize_list(item.get("skills"))
    if not skills:
        skills = normalize_list(payload_payload.get("skills"))

    schedule, schedule_display = normalize_schedule(item)
    state = normalize_state(item)
    enabled = normalize_bool(item.get("enabled"))
    if enabled is None:
        enabled = state != "paused"

    return {
        "id": job_id,
        "name": name,
        "prompt": prompt,
        "script": first_text(item.get("script"), payload_payload.get("script")),
        "workdir": first_text(item.get("workdir"), item.get("cwd"), payload_payload.get("workdir"), payload_payload.get("cwd")),
        "no_agent": normalize_bool(item.get("no_agent")) or False,
        "skills": skills,
        "model": first_text(item.get("model"), payload_payload.get("model")),
        "provider": first_text(item.get("provider"), item.get("billing_provider"), payload_payload.get("provider")),
        "base_url": first_text(item.get("base_url"), payload_payload.get("base_url")),
        "schedule": schedule,
        "schedule_display": schedule_display,
        "recurrence": normalize_recurrence(item),
        "enabled": enabled,
        "state": state,
        "created_at": normalize_date(item.get("created_at")),
        "next_run_at": normalize_date(item.get("next_run_at")),
        "last_run_at": normalize_date(item.get("last_run_at")),
        "last_status": first_text(item.get("last_status"), item.get("run_status")),
        "last_error": first_text(item.get("last_error"), item.get("error")),
        "delivery_target": delivery_target(item, payload_payload),
        "origin": normalize_origin(item),
        "last_delivery_error": first_text(item.get("last_delivery_error")),
    }

try:
    jobs_path = resolved_hermes_home() / "cron" / "jobs.json"
    if not jobs_path.exists():
        print(json.dumps({
            "ok": True,
            "jobs": [],
        }, ensure_ascii=False))
        sys.exit(0)

    raw_data = json.loads(jobs_path.read_text(encoding="utf-8"))
    if isinstance(raw_data, dict):
        raw_jobs = raw_data.get("jobs") or raw_data.get("items") or raw_data.get("cron_jobs") or []
    elif isinstance(raw_data, list):
        raw_jobs = raw_data
    else:
        fail(f"Unsupported cron metadata format in {jobs_path}.")

    jobs = []
    for item in raw_jobs:
        normalized = normalize_job(item)
        if normalized is not None:
            jobs.append(normalized)

    jobs.sort(
        key=lambda item: (
            item.get("next_run_at") is None,
            item.get("next_run_at") or "",
            item.get("name", "").lower(),
        )
    )

    print(json.dumps({
        "ok": True,
        "jobs": jobs,
    }, ensure_ascii=False))
except Exception as exc:
    fail(f"Unable to read the remote Hermes cron jobs: {exc}")
"#;

const CRON_COMMAND_BODY: &str = r#"
import subprocess

job_id = str(payload.get("job_id") or "").strip()
command = str(payload.get("command") or "").strip()

if not job_id:
    fail("The cron job ID is required.")
if not command:
    fail("The cron command is required.")

hermes_binary = find_hermes_binary()
if hermes_binary is None:
    fail("Hermes CLI was not found on the active host.")

profile_name = str(payload.get("profile_name") or "").strip()
command_args = [hermes_binary]
if profile_name and profile_name.lower() != "default":
    command_args.extend(["-p", profile_name])
command_args.extend(["cron", command, job_id])

try:
    env = os.environ.copy()
    env["HERMES_HOME"] = str(resolved_hermes_home())
    env["PATH"] = hermes_search_path()
    completed = subprocess.run(
        command_args,
        capture_output=True,
        text=True,
        env=env,
    )
except Exception as exc:
    fail(f"Unable to launch Hermes CLI: {exc}")

if completed.returncode != 0:
    message = (completed.stderr or completed.stdout or f"Hermes cron {command} failed.").strip()
    fail(message)

print(json.dumps({
    "ok": True,
    "message": (completed.stdout or "").strip() or None,
}, ensure_ascii=False))
"#;

const CRON_MUTATION_BODY: &str = r#"
import fcntl
import re
import secrets
import tempfile
from datetime import datetime, timezone

def normalize_list(value):
    if value is None:
        return []
    if isinstance(value, (list, tuple, set)):
        items = []
        for item in value:
            normalized = normalize_text(item)
            if normalized is not None:
                items.append(normalized)
        return items
    normalized = normalize_text(value)
    return [normalized] if normalized is not None else []

def load_container(path):
    if not path.exists():
        return [], "list", None, None

    raw = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(raw, list):
        return raw, "list", None, None

    if isinstance(raw, dict):
        for key in ("jobs", "items", "cron_jobs"):
            jobs = raw.get(key)
            if isinstance(jobs, list):
                return jobs, "dict", key, raw
        fail(f"Unsupported cron metadata wrapper in {path}.")

    fail(f"Unsupported cron metadata format in {path}.")

def save_container(path, jobs, container_kind, container_key, container_payload):
    if container_kind == "list":
        payload_to_write = jobs
    else:
        payload_to_write = dict(container_payload) if isinstance(container_payload, dict) else {}
        payload_to_write[container_key or "jobs"] = jobs

    path.parent.mkdir(parents=True, exist_ok=True)
    content_bytes = (
        json.dumps(payload_to_write, ensure_ascii=False, indent=2) + "\n"
    ).encode("utf-8")
    temp_name = None
    directory_fd = None

    try:
        fd, temp_name = tempfile.mkstemp(
            dir=str(path.parent),
            prefix=f".{path.name}.",
            suffix=".tmp",
        )
        with os.fdopen(fd, "wb") as handle:
            handle.write(content_bytes)
            handle.flush()
            os.fsync(handle.fileno())

        if path.exists():
            os.chmod(temp_name, path.stat().st_mode)

        os.replace(temp_name, path)
        directory_fd = os.open(path.parent, os.O_RDONLY)
        os.fsync(directory_fd)
    finally:
        if directory_fd is not None:
            os.close(directory_fd)
        if temp_name and os.path.exists(temp_name):
            os.unlink(temp_name)

def with_jobs_lock(path, callback):
    path.parent.mkdir(parents=True, exist_ok=True)
    lock_path = path.with_name(path.name + ".lock")
    lock_fd = os.open(str(lock_path), os.O_CREAT | os.O_RDWR, 0o600)
    try:
        os.chmod(str(lock_path), 0o600)
    except OSError:
        pass

    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX)
        return callback()
    finally:
        try:
            fcntl.flock(lock_fd, fcntl.LOCK_UN)
        finally:
            os.close(lock_fd)

def iso_now():
    return datetime.now(timezone.utc).isoformat()

def normalize_origin_payload(value):
    if not isinstance(value, dict):
        return None

    normalized = {
        "kind": normalize_text(value.get("kind")) or normalize_text(value.get("type")) or normalize_text(value.get("platform")),
        "source": normalize_text(value.get("source")) or normalize_text(value.get("path")),
        "label": normalize_text(value.get("label")) or normalize_text(value.get("name")) or normalize_text(value.get("chat_name")),
    }

    normalized = {
        key: item
        for key, item in normalized.items()
        if item is not None
    }
    return normalized or None

def detect_schedule(value):
    if value is None:
        return None, None

    text = value.strip()
    lowered = text.lower()

    if re.fullmatch(r"\d+[mhd]", lowered):
        return "delay", 1

    if re.fullmatch(r"every\s+\d+[mhd]", lowered):
        return "every", None

    try:
        datetime.fromisoformat(text.replace("Z", "+00:00"))
        return "at", 1
    except Exception:
        pass

    if len(text.split()) == 5:
        return "cron", None

    return None, None

action = normalize_text(payload.get("action"))
if action not in {"create", "update"}:
    fail("Unsupported cron mutation action.")

draft = payload.get("draft")
if not isinstance(draft, dict):
    fail("A cron draft payload is required.")

name = normalize_text(draft.get("name"))
prompt_text = normalize_text(draft.get("prompt"))
script_path = normalize_text(draft.get("script"))
workdir = normalize_text(draft.get("workdir"))
no_agent = bool(draft.get("no_agent"))
schedule_expr = normalize_text(draft.get("schedule"))
skills = normalize_list(draft.get("skills"))
model = normalize_text(draft.get("model"))
provider = normalize_text(draft.get("provider"))
base_url = normalize_text(draft.get("base_url"))
delivery = normalize_text(draft.get("deliver"))
timezone_name = normalize_text(draft.get("timezone"))
schedule_kind, repeat_times = detect_schedule(schedule_expr)

if name is None:
    fail("The cron job title is required.")
if no_agent and script_path is None:
    fail("The cron job script is required for script-only jobs.")
if not no_agent and prompt_text is None:
    fail("The cron job prompt is required.")
if schedule_expr is None:
    fail("The cron job schedule is required.")
if delivery is None:
    fail("A delivery target is required.")

def mutate_jobs():
    jobs, container_kind, container_key, container_payload = load_container(jobs_path)

    if action == "create":
        existing_ids = {
            normalize_text(item.get("id"))
            for item in jobs
            if isinstance(item, dict)
        }
        job_id = secrets.token_hex(6)
        while job_id in existing_ids:
            job_id = secrets.token_hex(6)

        job = {
            "id": job_id,
            "name": name,
            "prompt": prompt_text or "",
            "script": script_path,
            "workdir": workdir,
            "no_agent": no_agent,
            "skills": skills,
            "model": model,
            "provider": provider,
            "base_url": base_url,
            "schedule": {
                "kind": schedule_kind,
                "expr": schedule_expr,
                "timezone": timezone_name,
                "display": schedule_expr,
            },
            "schedule_display": schedule_expr,
            "repeat": {
                "times": repeat_times,
                "completed": 0,
            },
            "enabled": True,
            "state": "scheduled",
            "paused_at": None,
            "paused_reason": None,
            "created_at": iso_now(),
            "next_run_at": None,
            "last_run_at": None,
            "last_status": None,
            "last_error": None,
            "deliver": delivery,
            "origin": {
                "kind": "desktop",
                "label": "Hermes Desktop",
            },
        }
        jobs.append(job)
        save_container(jobs_path, jobs, container_kind, container_key, container_payload)
        return job_id

    job_id = normalize_text(payload.get("job_id"))
    if job_id is None:
        fail("The cron job ID is required.")

    target = None
    for item in jobs:
        if not isinstance(item, dict):
            continue
        if normalize_text(item.get("id")) == job_id:
            target = item
            break

    if target is None:
        fail(f"Cron job {job_id} was not found.")

    old_expr = normalize_text(
        ((target.get("schedule") or {}).get("expr")) if isinstance(target.get("schedule"), dict) else None
    )
    schedule_changed = old_expr != schedule_expr

    target["name"] = name
    target["prompt"] = prompt_text or ""
    target["script"] = script_path
    target["workdir"] = workdir
    target["no_agent"] = no_agent
    target["skills"] = skills
    target.pop("skill", None)
    target["model"] = model
    target["provider"] = provider
    target["base_url"] = base_url
    target["deliver"] = delivery

    normalized_origin = normalize_origin_payload(target.get("origin"))
    if normalized_origin is not None:
        target["origin"] = normalized_origin
    else:
        target.pop("origin", None)

    schedule_data = target.get("schedule")
    if not isinstance(schedule_data, dict):
        schedule_data = {}
    schedule_data["kind"] = schedule_kind
    schedule_data["expr"] = schedule_expr
    schedule_data["timezone"] = timezone_name
    schedule_data["display"] = schedule_expr
    target["schedule"] = schedule_data
    target["schedule_display"] = schedule_expr

    repeat_data = target.get("repeat")
    if not isinstance(repeat_data, dict):
        repeat_data = {}
    repeat_data["times"] = repeat_times
    if schedule_changed:
        repeat_data["completed"] = 0
    elif "completed" not in repeat_data:
        repeat_data["completed"] = 0
    target["repeat"] = repeat_data

    if schedule_changed:
        target["next_run_at"] = None
        if normalize_text(target.get("state")) != "paused":
            target["state"] = "scheduled"
        if target.get("enabled") is not False:
            target["enabled"] = True

    save_container(jobs_path, jobs, container_kind, container_key, container_payload)
    return job_id

jobs_path = resolved_hermes_home() / "cron" / "jobs.json"
job_id = with_jobs_lock(jobs_path, mutate_jobs)
print(json.dumps({
    "ok": True,
    "job_id": job_id,
}, ensure_ascii=False))
"#;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::remote_python::assert_python_payload_compiles;

    #[test]
    fn cron_payloads_compile() {
        let draft = CronJobDraftPayload {
            name: "Tauri smoke".to_string(),
            prompt: "Run a smoke check.".to_string(),
            script: None,
            workdir: None,
            no_agent: false,
            schedule: "2099-01-01T00:00:00Z".to_string(),
            skills: Vec::new(),
            model: None,
            provider: None,
            base_url: None,
            deliver: Some("desktop".to_string()),
            timezone: Some("UTC".to_string()),
        };
        assert_python_payload_compiles(
            &EmptyCronRequest {
                hermes_home: "~/.hermes".to_string(),
                profile_name: None,
            },
            CRON_LIST_BODY,
        );
        assert_python_payload_compiles(
            &CronCommandRequest {
                job_id: "job-id".to_string(),
                command: "pause",
                hermes_home: "~/.hermes".to_string(),
                profile_name: None,
            },
            CRON_COMMAND_BODY,
        );
        assert_python_payload_compiles(
            &CronMutationRequest {
                action: "create",
                job_id: None,
                hermes_home: "~/.hermes".to_string(),
                profile_name: None,
                draft,
            },
            CRON_MUTATION_BODY,
        );
    }
}
