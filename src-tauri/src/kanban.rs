use crate::connection::{remote_hermes_home_path, resolved_hermes_profile_name};
use crate::error::{HermesError, Result};
use crate::models::{
    ConnectionProfile, KanbanBoard, KanbanBoardDraftPayload, KanbanBoardOperationResponse,
    KanbanBoardResponse, KanbanBoardsResponse, KanbanDispatchResult, KanbanOperationResponse,
    KanbanTaskDetail, KanbanTaskDetailResponse, KanbanTaskDraftPayload,
};
use crate::remote_python;
use crate::ssh;
use serde::Serialize;

pub async fn list_kanban_boards_inner(
    profile: ConnectionProfile,
    include_archived: bool,
) -> Result<KanbanBoardsResponse> {
    let payload = KanbanBoardsRequest {
        kanban_home: remote_kanban_home_path(),
        hermes_home: remote_hermes_home_path(&profile),
        include_archived,
    };
    let script = remote_python::wrap_payload(&payload, &kanban_body(KANBAN_BOARDS_BODY))?;
    ssh::execute_json::<KanbanBoardsResponse>(profile, script).await
}

pub async fn load_kanban_board_inner(
    profile: ConnectionProfile,
    board_slug: String,
    include_archived: bool,
) -> Result<KanbanBoard> {
    let payload = KanbanBoardRequest {
        kanban_home: remote_kanban_home_path(),
        hermes_home: remote_hermes_home_path(&profile),
        board_slug,
        include_archived,
    };
    let script = remote_python::wrap_payload(&payload, &kanban_body(KANBAN_BOARD_BODY))?;
    let response = ssh::execute_json::<KanbanBoardResponse>(profile, script).await?;
    Ok(response.board)
}

pub async fn load_kanban_task_detail_inner(
    profile: ConnectionProfile,
    board_slug: String,
    task_id: String,
) -> Result<KanbanTaskDetail> {
    let payload = KanbanTaskDetailRequest {
        kanban_home: remote_kanban_home_path(),
        hermes_home: remote_hermes_home_path(&profile),
        board_slug,
        task_id,
    };
    let script = remote_python::wrap_payload(&payload, &kanban_body(KANBAN_TASK_DETAIL_BODY))?;
    let response = ssh::execute_json::<KanbanTaskDetailResponse>(profile, script).await?;
    Ok(response.detail)
}

pub async fn create_kanban_board_inner(
    profile: ConnectionProfile,
    draft: KanbanBoardDraftPayload,
) -> Result<KanbanBoardOperationResponse> {
    let payload = KanbanBoardCreateRequest {
        kanban_home: remote_kanban_home_path(),
        hermes_home: remote_hermes_home_path(&profile),
        slug: draft.slug,
        name: draft.name,
        description: draft.description,
        icon: draft.icon,
        color: draft.color,
        switch_after_create: draft.switch_after_create,
    };
    let script = remote_python::wrap_payload(&payload, &kanban_body(KANBAN_CREATE_BOARD_BODY))?;
    ssh::execute_json::<KanbanBoardOperationResponse>(profile, script).await
}

pub async fn archive_kanban_board_inner(
    profile: ConnectionProfile,
    board_slug: String,
) -> Result<KanbanBoardOperationResponse> {
    let payload = KanbanBoardArchiveRequest {
        kanban_home: remote_kanban_home_path(),
        hermes_home: remote_hermes_home_path(&profile),
        board_slug,
    };
    let script = remote_python::wrap_payload(&payload, &kanban_body(KANBAN_ARCHIVE_BOARD_BODY))?;
    ssh::execute_json::<KanbanBoardOperationResponse>(profile, script).await
}

pub async fn create_kanban_task_inner(
    profile: ConnectionProfile,
    board_slug: String,
    draft: KanbanTaskDraftPayload,
) -> Result<String> {
    let response = perform_kanban_mutation(
        profile,
        board_slug,
        KanbanMutationRequest {
            action: "create",
            title: Some(draft.title),
            body: draft.body,
            assignee: draft.assignee,
            priority: Some(draft.priority),
            tenant: draft.tenant,
            skills: Some(draft.skills),
            triage: Some(draft.triage),
            max_retries: draft.max_retries,
            parent_ids: Some(draft.parent_ids),
            ..KanbanMutationRequest::empty()
        },
    )
    .await?;
    response.task_id.ok_or_else(|| {
        HermesError::Remote(
            "The remote Kanban create operation did not return a task ID.".to_string(),
        )
    })
}

pub async fn add_kanban_comment_inner(
    profile: ConnectionProfile,
    board_slug: String,
    task_id: String,
    body: String,
) -> Result<KanbanOperationResponse> {
    perform_kanban_mutation(
        profile,
        board_slug,
        KanbanMutationRequest {
            action: "comment",
            task_id: Some(task_id),
            text: Some(body),
            ..KanbanMutationRequest::empty()
        },
    )
    .await
}

pub async fn update_kanban_task_fields_inner(
    profile: ConnectionProfile,
    board_slug: String,
    task_id: String,
    body: String,
    tenant: String,
    priority: i64,
    skills: Vec<String>,
) -> Result<KanbanOperationResponse> {
    perform_kanban_mutation(
        profile,
        board_slug,
        KanbanMutationRequest {
            action: "update_fields",
            task_id: Some(task_id),
            body: Some(body),
            tenant: Some(tenant),
            priority: Some(priority),
            skills: Some(skills),
            ..KanbanMutationRequest::empty()
        },
    )
    .await
}

pub async fn set_kanban_task_parents_inner(
    profile: ConnectionProfile,
    board_slug: String,
    task_id: String,
    parent_ids: Vec<String>,
) -> Result<KanbanOperationResponse> {
    perform_kanban_mutation(
        profile,
        board_slug,
        KanbanMutationRequest {
            action: "set_parents",
            task_id: Some(task_id),
            parent_ids: Some(parent_ids),
            ..KanbanMutationRequest::empty()
        },
    )
    .await
}

pub async fn set_kanban_task_children_inner(
    profile: ConnectionProfile,
    board_slug: String,
    task_id: String,
    child_ids: Vec<String>,
) -> Result<KanbanOperationResponse> {
    perform_kanban_mutation(
        profile,
        board_slug,
        KanbanMutationRequest {
            action: "set_children",
            task_id: Some(task_id),
            child_ids: Some(child_ids),
            ..KanbanMutationRequest::empty()
        },
    )
    .await
}

pub async fn assign_kanban_task_inner(
    profile: ConnectionProfile,
    board_slug: String,
    task_id: String,
    assignee: Option<String>,
) -> Result<KanbanOperationResponse> {
    task_action(profile, board_slug, task_id, "assign", assignee, None).await
}

pub async fn specify_kanban_task_inner(
    profile: ConnectionProfile,
    board_slug: String,
    task_id: String,
) -> Result<KanbanOperationResponse> {
    task_action(profile, board_slug, task_id, "specify", None, None).await
}

pub async fn block_kanban_task_inner(
    profile: ConnectionProfile,
    board_slug: String,
    task_id: String,
    reason: Option<String>,
) -> Result<KanbanOperationResponse> {
    task_action(profile, board_slug, task_id, "block", None, reason).await
}

pub async fn unblock_kanban_task_inner(
    profile: ConnectionProfile,
    board_slug: String,
    task_id: String,
) -> Result<KanbanOperationResponse> {
    task_action(profile, board_slug, task_id, "unblock", None, None).await
}

pub async fn complete_kanban_task_inner(
    profile: ConnectionProfile,
    board_slug: String,
    task_id: String,
    result: Option<String>,
) -> Result<KanbanOperationResponse> {
    perform_kanban_mutation(
        profile,
        board_slug,
        KanbanMutationRequest {
            action: "complete",
            task_id: Some(task_id),
            result,
            ..KanbanMutationRequest::empty()
        },
    )
    .await
}

pub async fn reclaim_kanban_task_inner(
    profile: ConnectionProfile,
    board_slug: String,
    task_id: String,
    reason: Option<String>,
) -> Result<KanbanOperationResponse> {
    task_action(profile, board_slug, task_id, "reclaim", None, reason).await
}

pub async fn reassign_kanban_task_inner(
    profile: ConnectionProfile,
    board_slug: String,
    task_id: String,
    assignee: Option<String>,
    reclaim_first: bool,
    reason: Option<String>,
) -> Result<KanbanOperationResponse> {
    perform_kanban_mutation(
        profile,
        board_slug,
        KanbanMutationRequest {
            action: "reassign",
            task_id: Some(task_id),
            assignee,
            text: reason,
            reclaim_first: Some(reclaim_first),
            ..KanbanMutationRequest::empty()
        },
    )
    .await
}

pub async fn edit_kanban_task_result_inner(
    profile: ConnectionProfile,
    board_slug: String,
    task_id: String,
    result: String,
    summary: Option<String>,
    metadata_json: Option<String>,
) -> Result<KanbanOperationResponse> {
    perform_kanban_mutation(
        profile,
        board_slug,
        KanbanMutationRequest {
            action: "edit_result",
            task_id: Some(task_id),
            result: Some(result),
            summary,
            metadata_json,
            ..KanbanMutationRequest::empty()
        },
    )
    .await
}

pub async fn archive_kanban_task_inner(
    profile: ConnectionProfile,
    board_slug: String,
    task_id: String,
) -> Result<KanbanOperationResponse> {
    task_action(profile, board_slug, task_id, "archive", None, None).await
}

pub async fn delete_kanban_task_inner(
    profile: ConnectionProfile,
    board_slug: String,
    task_id: String,
) -> Result<KanbanOperationResponse> {
    task_action(profile, board_slug, task_id, "delete", None, None).await
}

pub async fn dispatch_kanban_now_inner(
    profile: ConnectionProfile,
    board_slug: String,
    max_spawn: i64,
) -> Result<Option<KanbanDispatchResult>> {
    let response = perform_kanban_mutation(
        profile,
        board_slug,
        KanbanMutationRequest {
            action: "dispatch",
            max_spawn: Some(max_spawn),
            ..KanbanMutationRequest::empty()
        },
    )
    .await?;
    Ok(response.dispatch)
}

pub async fn set_kanban_home_subscription_inner(
    profile: ConnectionProfile,
    board_slug: String,
    task_id: String,
    platform: String,
    subscribed: bool,
) -> Result<KanbanOperationResponse> {
    let payload = KanbanHomeSubscriptionRequest {
        kanban_home: remote_kanban_home_path(),
        hermes_home: remote_hermes_home_path(&profile),
        board_slug,
        task_id,
        platform,
        subscribed,
    };
    let script =
        remote_python::wrap_payload(&payload, &kanban_body(KANBAN_HOME_SUBSCRIPTION_BODY))?;
    ssh::execute_json::<KanbanOperationResponse>(profile, script).await
}

async fn task_action(
    profile: ConnectionProfile,
    board_slug: String,
    task_id: String,
    action: &'static str,
    assignee: Option<String>,
    text: Option<String>,
) -> Result<KanbanOperationResponse> {
    perform_kanban_mutation(
        profile,
        board_slug,
        KanbanMutationRequest {
            action,
            task_id: Some(task_id),
            assignee,
            text,
            ..KanbanMutationRequest::empty()
        },
    )
    .await
}

async fn perform_kanban_mutation(
    profile: ConnectionProfile,
    board_slug: String,
    request: KanbanMutationRequest,
) -> Result<KanbanOperationResponse> {
    let payload = request.with_context(
        remote_kanban_home_path(),
        remote_hermes_home_path(&profile),
        board_slug,
        kanban_cli_profile_name(&profile),
    );
    let script = remote_python::wrap_payload(&payload, &kanban_body(KANBAN_MUTATION_BODY))?;
    ssh::execute_json::<KanbanOperationResponse>(profile, script).await
}

fn remote_kanban_home_path() -> String {
    "~/.hermes".to_string()
}

fn kanban_cli_profile_name(profile: &ConnectionProfile) -> String {
    if profile.custom_hermes_home_path.is_some() {
        return "default".to_string();
    }
    resolved_hermes_profile_name(profile)
}

fn kanban_body(body: &str) -> String {
    format!("{KANBAN_HELPERS}\n{body}")
}

#[derive(Serialize)]
struct KanbanBoardsRequest {
    kanban_home: String,
    hermes_home: String,
    include_archived: bool,
}

#[derive(Serialize)]
struct KanbanBoardRequest {
    kanban_home: String,
    hermes_home: String,
    board_slug: String,
    include_archived: bool,
}

#[derive(Serialize)]
struct KanbanTaskDetailRequest {
    kanban_home: String,
    hermes_home: String,
    board_slug: String,
    task_id: String,
}

#[derive(Serialize)]
struct KanbanBoardCreateRequest {
    kanban_home: String,
    hermes_home: String,
    slug: String,
    name: Option<String>,
    description: Option<String>,
    icon: Option<String>,
    color: Option<String>,
    switch_after_create: bool,
}

#[derive(Serialize)]
struct KanbanBoardArchiveRequest {
    kanban_home: String,
    hermes_home: String,
    board_slug: String,
}

#[derive(Serialize)]
struct KanbanHomeSubscriptionRequest {
    kanban_home: String,
    hermes_home: String,
    board_slug: String,
    task_id: String,
    platform: String,
    subscribed: bool,
}

#[derive(Serialize)]
struct KanbanMutationRequest {
    #[serde(skip_serializing)]
    action: &'static str,
    #[serde(skip_serializing)]
    task_id: Option<String>,
    #[serde(skip_serializing)]
    title: Option<String>,
    #[serde(skip_serializing)]
    body: Option<String>,
    #[serde(skip_serializing)]
    assignee: Option<String>,
    #[serde(skip_serializing)]
    priority: Option<i64>,
    #[serde(skip_serializing)]
    tenant: Option<String>,
    #[serde(skip_serializing)]
    skills: Option<Vec<String>>,
    #[serde(skip_serializing)]
    triage: Option<bool>,
    #[serde(skip_serializing)]
    text: Option<String>,
    #[serde(skip_serializing)]
    result: Option<String>,
    #[serde(skip_serializing)]
    max_spawn: Option<i64>,
    #[serde(skip_serializing)]
    max_retries: Option<i64>,
    #[serde(skip_serializing)]
    parent_ids: Option<Vec<String>>,
    #[serde(skip_serializing)]
    child_ids: Option<Vec<String>>,
    #[serde(skip_serializing)]
    summary: Option<String>,
    #[serde(skip_serializing)]
    metadata_json: Option<String>,
    #[serde(skip_serializing)]
    reclaim_first: Option<bool>,
}

#[derive(Serialize)]
struct KanbanMutationPayload {
    kanban_home: String,
    hermes_home: String,
    board_slug: String,
    author: String,
    action: &'static str,
    task_id: Option<String>,
    title: Option<String>,
    body: Option<String>,
    assignee: Option<String>,
    priority: Option<i64>,
    tenant: Option<String>,
    skills: Option<Vec<String>>,
    triage: Option<bool>,
    text: Option<String>,
    result: Option<String>,
    max_spawn: Option<i64>,
    max_retries: Option<i64>,
    parent_ids: Option<Vec<String>>,
    child_ids: Option<Vec<String>>,
    summary: Option<String>,
    metadata_json: Option<String>,
    reclaim_first: Option<bool>,
}

impl KanbanMutationRequest {
    fn empty() -> Self {
        Self {
            action: "",
            task_id: None,
            title: None,
            body: None,
            assignee: None,
            priority: None,
            tenant: None,
            skills: None,
            triage: None,
            text: None,
            result: None,
            max_spawn: None,
            max_retries: None,
            parent_ids: None,
            child_ids: None,
            summary: None,
            metadata_json: None,
            reclaim_first: None,
        }
    }

    fn with_context(
        self,
        kanban_home: String,
        hermes_home: String,
        board_slug: String,
        author: String,
    ) -> KanbanMutationPayload {
        KanbanMutationPayload {
            kanban_home,
            hermes_home,
            board_slug,
            author,
            action: self.action,
            task_id: self.task_id,
            title: self.title,
            body: self.body,
            assignee: self.assignee,
            priority: self.priority,
            tenant: self.tenant,
            skills: self.skills,
            triage: self.triage,
            text: self.text,
            result: self.result,
            max_spawn: self.max_spawn,
            max_retries: self.max_retries,
            parent_ids: self.parent_ids,
            child_ids: self.child_ids,
            summary: self.summary,
            metadata_json: self.metadata_json,
            reclaim_first: self.reclaim_first,
        }
    }
}

const KANBAN_BOARDS_BODY: &str = r#"
try:
    response = list_boards_response(include_archived=bool(payload.get("include_archived")))
    print(json.dumps({
        "ok": True,
        "boards": response.get("boards", []),
        "current": response.get("current"),
        "supports_board_management": response.get("supports_board_management", False),
    }, ensure_ascii=False))
except Exception as exc:
    fail(f"Unable to load remote Hermes Kanban boards: {exc}")
"#;

const KANBAN_BOARD_BODY: &str = r#"
try:
    board_slug = requested_board_slug()
    board = load_board(board_slug, include_archived=bool(payload.get("include_archived")))
    print(json.dumps({
        "ok": True,
        "board": board,
    }, ensure_ascii=False))
except Exception as exc:
    fail(f"Unable to load the remote Hermes Kanban board: {exc}")
"#;

const KANBAN_TASK_DETAIL_BODY: &str = r#"
try:
    board_slug = requested_board_slug()
    task_id = normalize_text(payload.get("task_id"))
    if not task_id:
        fail("The Kanban task ID is required.")
    detail = load_task_detail(task_id, board_slug)
    if detail is None:
        fail(f"No such Kanban task: {task_id}")
    print(json.dumps({
        "ok": True,
        "detail": detail,
    }, ensure_ascii=False))
except Exception as exc:
    fail(f"Unable to load the remote Kanban task: {exc}")
"#;

const KANBAN_CREATE_BOARD_BODY: &str = r#"
try:
    slug = normalize_board_slug(payload.get("slug"))
    if not slug:
        fail("Board slug is required.")
    if slug == DEFAULT_BOARD:
        fail("The default Kanban board already exists.")
    directory = board_dir(slug)
    directory.mkdir(parents=True, exist_ok=True)
    metadata = read_board_metadata_direct(slug)
    metadata.update({
        "slug": slug,
        "name": normalize_text(payload.get("name")) or metadata.get("name") or default_board_display_name(slug),
        "description": normalize_text(payload.get("description")) or "",
        "icon": normalize_text(payload.get("icon")) or "",
        "color": normalize_text(payload.get("color")) or "",
        "created_at": int(metadata.get("created_at") or time.time()),
        "archived": False,
    })
    board_metadata_path(slug).write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if bool(payload.get("switch_after_create")):
        try_set_current_board(None, slug)
    board = hydrate_board_metadata(metadata, None)
    print(json.dumps({
        "ok": True,
        "board": board,
        "current": current_board_slug(None),
    }, ensure_ascii=False))
except Exception as exc:
    fail(f"Unable to create the remote Hermes Kanban board: {exc}")
"#;

const KANBAN_ARCHIVE_BOARD_BODY: &str = r#"
try:
    board_slug = requested_board_slug()
    if board_slug == DEFAULT_BOARD:
        fail("The default Kanban board cannot be archived.")
    if not board_exists(board_slug, None):
        fail(f"No such Kanban board: {board_slug}")
    metadata = read_board_metadata_direct(board_slug)
    metadata["archived"] = True
    metadata["slug"] = board_slug
    board_metadata_path(board_slug).parent.mkdir(parents=True, exist_ok=True)
    board_metadata_path(board_slug).write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if current_board_slug(None) == board_slug:
        try_set_current_board(None, DEFAULT_BOARD)
    print(json.dumps({
        "ok": True,
        "board": hydrate_board_metadata(metadata, None),
        "current": current_board_slug(None),
    }, ensure_ascii=False))
except Exception as exc:
    fail(f"Unable to archive the remote Hermes Kanban board: {exc}")
"#;

const KANBAN_HOME_SUBSCRIPTION_BODY: &str = r#"
try:
    board_slug = requested_board_slug()
    task_id = normalize_text(payload.get("task_id"))
    platform = normalize_text(payload.get("platform"))
    if not task_id:
        fail("The Kanban task ID is required.")
    if not platform:
        fail("The gateway platform is required.")
    home = home_channel_for_platform(platform)
    if home is None:
        fail(f"No home channel configured for platform {platform!r}.")
    db_path = kanban_db_path(board_slug)
    if not db_path.exists():
        fail(f"No such Kanban task: {task_id}")
    conn = sqlite3.connect(db_path, timeout=30)
    conn.row_factory = sqlite3.Row
    try:
        if not task_exists(conn, task_id):
            fail(f"No such Kanban task: {task_id}")
        set_home_subscription(conn, task_id, home, subscribed=bool(payload.get("subscribed")))
    finally:
        conn.close()
    detail = load_task_detail(task_id, board_slug)
    print(json.dumps({
        "ok": True,
        "task_id": task_id,
        "detail": detail,
        "message": "Home channel subscription updated.",
        "dispatch": None,
    }, ensure_ascii=False))
except Exception as exc:
    fail(f"Unable to update Kanban home-channel subscription: {exc}")
"#;

const KANBAN_MUTATION_BODY: &str = r#"
def mutation_result(message=None, task_id=None, dispatch=None):
    board_slug = requested_board_slug()
    detail = load_task_detail(task_id, board_slug) if task_id else None
    print(json.dumps({
        "ok": True,
        "message": message,
        "task_id": task_id,
        "detail": detail,
        "dispatch": dispatch,
    }, ensure_ascii=False))

def normalized_payload_list(name):
    raw = payload.get(name) or []
    if isinstance(raw, str):
        raw = re.split(r"[\s,]+", raw)
    result = []
    seen = set()
    for item in raw:
        value = normalize_text(item)
        if not value or value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result

def normalized_skill_list():
    result = []
    seen = set()
    for item in payload.get("skills") or []:
        value = normalize_text(item)
        if not value or value in seen:
            continue
        if "," in value:
            fail(f"Skill names must be comma-separated without embedded commas: {value!r}")
        seen.add(value)
        result.append(value)
    return result

def normalized_metadata_object():
    raw = payload.get("metadata")
    if raw is None:
        raw = payload.get("metadata_json")
    if raw is None:
        return None
    if isinstance(raw, dict):
        return raw
    if not isinstance(raw, str):
        fail("Recovery metadata must be a JSON object.")
    text = raw.strip()
    if not text:
        return None
    try:
        parsed = json.loads(text)
    except Exception as exc:
        fail(f"Recovery metadata is not valid JSON: {exc}")
    if not isinstance(parsed, dict):
        fail("Recovery metadata must be a JSON object.")
    return parsed

def run_hermes_cli(args, expect_json=False):
    hermes_binary = find_hermes_binary()
    if hermes_binary is None:
        fail("Hermes CLI was not found on the active host.")
    env = os.environ.copy()
    env["HERMES_HOME"] = str(kanban_home_path())
    env["HERMES_KANBAN_HOME"] = str(kanban_home_path())
    env["PATH"] = hermes_search_path()
    command = [hermes_binary]
    author = normalize_text(payload.get("author"))
    if author and author != "default":
        command.extend(["--profile", author])
    command.extend(list(args))
    completed = subprocess.run(command, capture_output=True, text=True, env=env)
    if completed.returncode != 0:
        message = (completed.stderr or completed.stdout or "Hermes Kanban command failed.").strip()
        fail(message)
    output = (completed.stdout or "").strip()
    if not expect_json:
        return output
    try:
        return json.loads(output or "{}")
    except Exception as exc:
        fail(f"Hermes Kanban command returned invalid JSON: {exc}")

def perform_with_cli(action, task_id, author):
    board_slug = requested_board_slug()
    if action == "create":
        title = normalize_text(payload.get("title"))
        if not title:
            fail("Task title is required.")
        args = kanban_cli_args(board_slug, ["create", "--json", "--created-by", author])
        body = normalize_text(payload.get("body"))
        if body:
            args.extend(["--body", body])
        assignee = normalize_text(payload.get("assignee"))
        if assignee:
            args.extend(["--assignee", assignee])
        tenant = normalize_text(payload.get("tenant"))
        if tenant:
            args.extend(["--tenant", tenant])
        priority = int(payload.get("priority") or 0)
        if priority:
            args.extend(["--priority", str(priority)])
        max_retries = int_value(payload.get("max_retries"))
        if max_retries is not None:
            if max_retries < 1:
                fail("Max retries must be a whole number greater than 0.")
            args.extend(["--max-retries", str(max_retries)])
        if bool(payload.get("triage")):
            args.append("--triage")
        for skill in payload.get("skills") or []:
            skill_text = normalize_text(skill)
            if skill_text:
                args.extend(["--skill", skill_text])
        for parent_id in normalized_payload_list("parent_ids"):
            args.extend(["--parent", parent_id])
        args.append(title)
        data = run_hermes_cli(args, expect_json=True)
        return ("Kanban task created.", normalize_text(data.get("id")), None)

    if not task_id and action != "dispatch":
        fail("The Kanban task ID is required.")

    if action == "comment":
        text = normalize_text(payload.get("text"))
        if not text:
            fail("Comment text is required.")
        run_hermes_cli(kanban_cli_args(board_slug, ["comment", "--author", author, task_id, text]))
        return ("Comment added.", task_id, None)

    if action == "update_fields":
        update_task_fields_direct(board_slug, task_id)
        return ("Task details updated.", task_id, None)

    if action in ("set_parents", "set_children"):
        db_path = kanban_db_path(board_slug)
        if not db_path.exists():
            fail(f"No such Kanban task: {task_id}")
        conn = sqlite3.connect(db_path, timeout=30)
        conn.row_factory = sqlite3.Row
        try:
            if not task_exists(conn, task_id):
                fail(f"No such Kanban task: {task_id}")
            parents = action == "set_parents"
            key = "parent_ids" if parents else "child_ids"
            desired_ids = normalized_payload_list(key)
            if task_id in desired_ids:
                fail("A Kanban task cannot depend on itself.")
            current = link_ids(conn, task_id, parents=parents)
        finally:
            conn.close()

        current_set = set(current)
        desired_set = set(desired_ids)
        for linked_id in [item for item in current if item not in desired_set]:
            if parents:
                run_hermes_cli(kanban_cli_args(board_slug, ["unlink", linked_id, task_id]))
            else:
                run_hermes_cli(kanban_cli_args(board_slug, ["unlink", task_id, linked_id]))
        for linked_id in [item for item in desired_ids if item not in current_set]:
            if parents:
                run_hermes_cli(kanban_cli_args(board_slug, ["link", linked_id, task_id]))
            else:
                run_hermes_cli(kanban_cli_args(board_slug, ["link", task_id, linked_id]))
        conn = sqlite3.connect(db_path, timeout=30)
        conn.row_factory = sqlite3.Row
        try:
            recompute_ready_rows(conn)
        finally:
            conn.close()
        return ("Task dependencies updated.", task_id, None)

    if action == "assign":
        assignee = normalize_text(payload.get("assignee")) or "none"
        run_hermes_cli(kanban_cli_args(board_slug, ["assign", task_id, assignee]))
        return ("Task assigned.", task_id, None)

    if action == "specify":
        data = run_hermes_cli(
            kanban_cli_args(board_slug, ["specify", task_id, "--author", author, "--json"]),
            expect_json=True,
        )
        if not bool(data.get("ok")):
            fail(normalize_text(data.get("reason")) or f"Cannot specify Kanban task: {task_id}")
        return ("Task specified.", normalize_text(data.get("task_id")) or task_id, None)

    if action == "reclaim":
        args = kanban_cli_args(board_slug, ["reclaim", task_id])
        reason = normalize_text(payload.get("text"))
        if reason:
            args.extend(["--reason", reason])
        run_hermes_cli(args)
        return ("Task reclaimed.", task_id, None)

    if action == "reassign":
        assignee = normalize_text(payload.get("assignee")) or "none"
        args = kanban_cli_args(board_slug, ["reassign", task_id, assignee])
        if bool(payload.get("reclaim_first")):
            args.append("--reclaim")
        reason = normalize_text(payload.get("text"))
        if reason:
            args.extend(["--reason", reason])
        run_hermes_cli(args)
        return ("Task reassigned.", task_id, None)

    if action == "block":
        reason = normalize_text(payload.get("text"))
        args = kanban_cli_args(board_slug, ["block", task_id])
        if reason:
            args.append(reason)
        run_hermes_cli(args)
        return ("Task blocked.", task_id, None)

    if action == "unblock":
        run_hermes_cli(kanban_cli_args(board_slug, ["unblock", task_id]))
        return ("Task unblocked.", task_id, None)

    if action == "complete":
        args = kanban_cli_args(board_slug, ["complete", task_id])
        result = normalize_text(payload.get("result"))
        if result:
            args.extend(["--result", result])
        run_hermes_cli(args)
        return ("Task completed.", task_id, None)

    if action == "edit_result":
        result = normalize_text(payload.get("result"))
        if result is None:
            fail("A recovery result is required.")
        args = kanban_cli_args(board_slug, ["edit", task_id, "--result", result])
        summary = normalize_text(payload.get("summary"))
        if summary:
            args.extend(["--summary", summary])
        metadata = normalized_metadata_object()
        if metadata is not None:
            args.extend(["--metadata", json.dumps(metadata, ensure_ascii=False)])
        run_hermes_cli(args)
        return ("Task result edited.", task_id, None)

    if action == "archive":
        run_hermes_cli(kanban_cli_args(board_slug, ["archive", task_id]))
        return ("Task archived.", task_id, None)

    if action == "delete":
        if not delete_task_direct(board_slug, task_id, author):
            fail(f"No such Kanban task: {task_id}")
        db_path = kanban_db_path(board_slug)
        conn = sqlite3.connect(db_path, timeout=30)
        conn.row_factory = sqlite3.Row
        try:
            recompute_ready_rows(conn)
        finally:
            conn.close()
        return ("Task deleted.", None, None)

    if action == "dispatch":
        data = run_hermes_cli(
            kanban_cli_args(board_slug, ["dispatch", "--max", str(int(payload.get("max_spawn") or 8)), "--json"]),
            expect_json=True,
        )
        return ("Dispatcher nudged.", None, data)

    fail(f"Unsupported Kanban action: {action}")

try:
    action = normalize_text(payload.get("action"))
    if not action:
        fail("The Kanban action is required.")
    task_id = normalize_text(payload.get("task_id"))
    author = normalize_text(payload.get("author")) or "desktop"
    message, affected_task_id, dispatch = perform_with_cli(action, task_id, author)
    mutation_result(message=message, task_id=affected_task_id, dispatch=dispatch)
except Exception as exc:
    fail(f"Unable to update the remote Kanban board: {exc}")
"#;

const KANBAN_HELPERS: &str = r#"
import json
import os
import pathlib
import re
import shlex
import sqlite3
import subprocess
import sys
import time

DEFAULT_BOARD = "default"
_BOARD_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9\-_]{0,63}$")

def kanban_home_path():
    home = pathlib.Path.home()
    requested = expand_remote_path(payload.get("kanban_home") or "~/.hermes", home)
    return requested or (home / ".hermes")

def normalize_board_slug(slug):
    if slug is None:
        return None
    value = str(slug).strip().lower()
    if not value:
        return None
    if not _BOARD_SLUG_RE.match(value):
        fail(
            f"Invalid Kanban board slug {slug!r}: use 1-64 lowercase letters, "
            "numbers, hyphens, or underscores."
        )
    return value

def requested_board_slug():
    return normalize_board_slug(payload.get("board_slug")) or DEFAULT_BOARD

def board_dir(board_slug=None):
    return kanban_home_path() / "kanban" / "boards" / (normalize_board_slug(board_slug) or DEFAULT_BOARD)

def current_board_file():
    return kanban_home_path() / "kanban" / "current"

def current_board_slug(_kb=None):
    try:
        path = current_board_file()
        if path.exists():
            return normalize_board_slug(path.read_text(encoding="utf-8")) or DEFAULT_BOARD
    except Exception:
        pass
    return DEFAULT_BOARD

def try_set_current_board(_kb, board_slug):
    normalized = normalize_board_slug(board_slug) or DEFAULT_BOARD
    path = current_board_file()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(normalized + "\n", encoding="utf-8")

def kanban_db_path(board_slug=None):
    normalized = normalize_board_slug(board_slug) or DEFAULT_BOARD
    if normalized == DEFAULT_BOARD:
        return kanban_home_path() / "kanban.db"
    return board_dir(normalized) / "kanban.db"

def board_metadata_path(board_slug=None):
    return board_dir(board_slug) / "board.json"

def worker_log_path(task_id, board_slug=None):
    normalized = normalize_board_slug(board_slug) or DEFAULT_BOARD
    if normalized == DEFAULT_BOARD:
        return kanban_home_path() / "kanban" / "logs" / f"{task_id}.log"
    return board_dir(normalized) / "logs" / f"{task_id}.log"

def default_board_display_name(slug):
    parts = [part.capitalize() for part in str(slug).replace("_", "-").split("-") if part]
    return " ".join(parts) or str(slug)

def read_board_metadata_direct(board_slug=None):
    normalized = normalize_board_slug(board_slug) or DEFAULT_BOARD
    meta = {
        "slug": normalized,
        "name": "Default" if normalized == DEFAULT_BOARD else default_board_display_name(normalized),
        "description": "",
        "icon": "",
        "color": "",
        "created_at": None,
        "archived": False,
    }
    try:
        path = board_metadata_path(normalized)
        if path.exists():
            raw = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                raw["slug"] = normalized
                meta.update(raw)
    except Exception:
        pass
    meta["db_path"] = str(kanban_db_path(normalized))
    return meta

def board_exists(board_slug, _kb=None):
    normalized = normalize_board_slug(board_slug) or DEFAULT_BOARD
    if normalized == DEFAULT_BOARD:
        return True
    directory = board_dir(normalized)
    return directory.is_dir() or (directory / "kanban.db").exists() or (directory / "board.json").exists()

def kanban_cli_args(board_slug, tail):
    normalized = normalize_board_slug(board_slug) or DEFAULT_BOARD
    args = ["kanban"]
    if normalized != DEFAULT_BOARD:
        args.extend(["--board", normalized])
    args.extend(list(tail))
    return args

def int_value(value, default=None):
    if value is None:
        return default
    try:
        return int(value)
    except Exception:
        return default

def parse_json_object(value):
    if value is None:
        return None
    if isinstance(value, dict):
        return value
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        return None

def parse_json_list(value):
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item) for item in value if item]
    try:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return [str(item) for item in parsed if item]
    except Exception:
        pass
    return []

def table_exists(conn, table_name):
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?",
        (table_name,),
    ).fetchone()
    return row is not None

def table_columns(conn, table_name):
    try:
        return {row["name"] for row in conn.execute(f"PRAGMA table_info({quote_ident(table_name)})")}
    except Exception:
        return set()

def board_counts(board_slug):
    path = kanban_db_path(board_slug)
    if not path.exists():
        return {}
    conn = None
    try:
        conn = connect_sqlite_readonly(path)
        conn.row_factory = sqlite3.Row
        if not table_exists(conn, "tasks"):
            return {}
        rows = conn.execute("SELECT status, COUNT(*) AS n FROM tasks GROUP BY status").fetchall()
        return {row["status"]: int(row["n"] or 0) for row in rows}
    except Exception:
        return {}
    finally:
        if conn is not None:
            conn.close()

def hydrate_board_metadata(meta, _kb=None):
    board = dict(meta or {})
    slug = normalize_board_slug(board.get("slug")) or DEFAULT_BOARD
    board["slug"] = slug
    if not board.get("name"):
        board["name"] = "Default" if slug == DEFAULT_BOARD else default_board_display_name(slug)
    if "archived" not in board:
        board["archived"] = False
    board["db_path"] = tilde(kanban_db_path(slug), pathlib.Path.home())
    counts = board_counts(slug)
    board["counts"] = counts
    board["total"] = sum(counts.values())
    board["is_current"] = slug == current_board_slug(None)
    return board

def list_boards_response(include_archived=False):
    entries = []
    seen = set()
    default_meta = hydrate_board_metadata(read_board_metadata_direct(DEFAULT_BOARD), None)
    entries.append(default_meta)
    seen.add(DEFAULT_BOARD)
    root = kanban_home_path() / "kanban" / "boards"
    if root.is_dir():
        for child in sorted(root.iterdir(), key=lambda item: item.name.lower()):
            if not child.is_dir():
                continue
            slug = str(child.name).strip().lower()
            if not _BOARD_SLUG_RE.match(slug) or slug in seen:
                continue
            has_board = (child / "kanban.db").exists() or (child / "board.json").exists()
            if not has_board:
                continue
            meta = hydrate_board_metadata(read_board_metadata_direct(slug), None)
            if meta.get("archived") and not include_archived:
                continue
            entries.append(meta)
            seen.add(slug)
    entries.sort(key=lambda item: (0 if item.get("slug") == DEFAULT_BOARD else 1, str(item.get("slug") or "")))
    return {
        "boards": entries,
        "current": current_board_slug(None),
        "supports_board_management": True,
    }

def add_hermes_agent_import_paths():
    home = pathlib.Path.home()
    candidates = [
        resolved_hermes_home() / "hermes-agent",
        home / ".hermes" / "hermes-agent",
        kanban_home_path() / "hermes-agent",
    ]
    for agent_root in list(candidates):
        venv_lib = agent_root / "venv" / "lib"
        if venv_lib.is_dir():
            for site_packages in sorted(venv_lib.glob("python*/site-packages")):
                candidates.append(site_packages)
    for candidate in candidates:
        try:
            path = str(candidate)
        except Exception:
            continue
        if path and pathlib.Path(path).exists() and path not in sys.path:
            sys.path.insert(0, path)

def load_hermes_env_file():
    home = pathlib.Path.home()
    active_hermes_home = resolved_hermes_home()
    seen = set()
    for path in [active_hermes_home / ".env", kanban_home_path() / ".env", home / ".hermes" / ".env"]:
        if path in seen:
            continue
        seen.add(path)
        if not path.exists():
            continue
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except Exception:
            continue
        for line in lines:
            stripped = line.strip()
            if not stripped or stripped.startswith(chr(35)):
                continue
            try:
                parts = shlex.split(stripped, comments=True, posix=True)
            except Exception:
                continue
            if not parts:
                continue
            if parts[0] == "export":
                parts = parts[1:]
            if len(parts) != 1 or "=" not in parts[0]:
                continue
            key, value = parts[0].split("=", 1)
            key = key.strip()
            if not re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", key):
                continue
            if key not in os.environ:
                os.environ[key] = value

def dispatcher_status():
    return {
        "running": None,
        "message": None,
    }

def configured_home_channels():
    try:
        add_hermes_agent_import_paths()
        load_hermes_env_file()
        from gateway.config import load_gateway_config
        gateway_config = load_gateway_config()
    except Exception:
        return []
    result = []
    try:
        platform_items = gateway_config.platforms.items()
    except Exception:
        platform_items = []
    for platform, platform_config in platform_items:
        if not platform_config:
            continue
        home_channel = getattr(platform_config, "home_channel", None)
        if not home_channel:
            continue
        platform_name = getattr(platform, "value", str(platform))
        result.append({
            "platform": platform_name,
            "chat_id": str(getattr(home_channel, "chat_id", "") or ""),
            "thread_id": str(getattr(home_channel, "thread_id", "") or ""),
            "name": str(getattr(home_channel, "name", "") or "Home"),
            "subscribed": False,
        })
    result.sort(key=lambda item: item["platform"])
    return result

def home_channel_for_platform(platform):
    normalized = normalize_text(platform)
    for home in configured_home_channels():
        if home.get("platform") == normalized:
            return home
    return None

def home_sub_matches(sub, home):
    return (
        str(sub.get("platform") or "") == str(home.get("platform") or "")
        and str(sub.get("chat_id") or "") == str(home.get("chat_id") or "")
        and str(sub.get("thread_id") or "") == str(home.get("thread_id") or "")
    )

def direct_notify_subs(conn, task_id):
    if not conn or not task_id or not table_exists(conn, "kanban_notify_subs"):
        return []
    rows = conn.execute(
        "SELECT task_id, platform, chat_id, thread_id, user_id, created_at, last_event_id "
        "FROM kanban_notify_subs WHERE task_id = ?",
        (task_id,),
    ).fetchall()
    return [dict(row) for row in rows]

def home_channels_for_task(conn, task_id):
    homes = configured_home_channels()
    if not homes:
        return []
    subscribed = direct_notify_subs(conn, task_id)
    result = []
    for home in homes:
        item = dict(home)
        item["subscribed"] = any(home_sub_matches(sub, home) for sub in subscribed)
        result.append(item)
    return result

def ensure_notify_subs_table(conn):
    if table_exists(conn, "kanban_notify_subs"):
        return
    fail("This Hermes Agent build does not support Kanban home-channel subscriptions. Run `hermes update` on the host.")

def task_exists(conn, task_id):
    return bool(
        conn
        and task_id
        and table_exists(conn, "tasks")
        and conn.execute("SELECT 1 FROM tasks WHERE id = ?", (task_id,)).fetchone()
    )

def set_home_subscription(conn, task_id, home, subscribed):
    ensure_notify_subs_table(conn)
    platform = home["platform"]
    chat_id = home["chat_id"]
    thread_id = home.get("thread_id") or ""
    if subscribed:
        conn.execute(
            "INSERT OR IGNORE INTO kanban_notify_subs "
            "(task_id, platform, chat_id, thread_id, user_id, created_at, last_event_id) "
            "VALUES (?, ?, ?, ?, NULL, ?, 0)",
            (task_id, platform, chat_id, thread_id, int(time.time())),
        )
        conn.commit()
        return
    conn.execute(
        "DELETE FROM kanban_notify_subs WHERE task_id = ? AND platform = ? AND chat_id = ? AND thread_id = ?",
        (task_id, platform, chat_id, thread_id),
    )
    conn.commit()

def count_rows(conn, table, column, value):
    if not conn or not table_exists(conn, table):
        return 0
    row = conn.execute(
        f"SELECT COUNT(*) AS n FROM {quote_ident(table)} WHERE {quote_ident(column)} = ?",
        (value,),
    ).fetchone()
    return int(row["n"] or 0) if row else 0

def link_ids(conn, task_id, parents):
    if not conn or not table_exists(conn, "task_links"):
        return []
    column = "parent_id" if parents else "child_id"
    where_column = "child_id" if parents else "parent_id"
    rows = conn.execute(
        f"SELECT {quote_ident(column)} AS id FROM task_links WHERE {quote_ident(where_column)} = ? ORDER BY {quote_ident(column)}",
        (task_id,),
    ).fetchall()
    return [row["id"] for row in rows]

def progress_for_task(conn, task_id):
    if not conn or not table_exists(conn, "task_links") or not table_exists(conn, "tasks"):
        return None
    row = conn.execute(
        "SELECT COUNT(*) AS total, SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS done "
        "FROM task_links l JOIN tasks t ON t.id = l.child_id WHERE l.parent_id = ?",
        (task_id,),
    ).fetchone()
    total = int(row["total"] or 0) if row else 0
    if total <= 0:
        return None
    return {"done": int(row["done"] or 0), "total": total}

def latest_event_timestamp(conn, task_id):
    if not conn or not table_exists(conn, "task_events"):
        return None
    row = conn.execute(
        "SELECT created_at FROM task_events WHERE task_id = ? ORDER BY created_at DESC, id DESC LIMIT 1",
        (task_id,),
    ).fetchone()
    return int_value(row["created_at"]) if row else None

def latest_event_id(conn):
    if not conn or not table_exists(conn, "task_events"):
        return None
    row = conn.execute("SELECT MAX(id) AS id FROM task_events").fetchone()
    return int_value(row["id"]) if row else None

def compute_warnings_for_tasks(conn, task_ids=None):
    if not conn or not table_exists(conn, "task_events"):
        return {}
    params = ()
    if task_ids is not None:
        task_ids = [str(item) for item in task_ids if item]
        if not task_ids:
            return {}
        placeholders = ",".join(["?"] * len(task_ids))
        sql = (
            "SELECT task_id, kind, created_at FROM task_events "
            f"WHERE task_id IN ({placeholders}) AND kind IN "
            "('completion_blocked_hallucination', 'suspected_hallucinated_references', 'completed', 'edited') "
            "ORDER BY task_id, id"
        )
        params = tuple(task_ids)
    else:
        sql = (
            "SELECT task_id, kind, created_at FROM task_events "
            "WHERE kind IN ('completion_blocked_hallucination', 'suspected_hallucinated_references', 'completed', 'edited') "
            "ORDER BY task_id, id"
        )
    result = {}
    try:
        rows = conn.execute(sql, params).fetchall()
    except Exception:
        return {}
    for row in rows:
        task_id = row["task_id"]
        kind = row["kind"]
        if kind in ("completed", "edited"):
            result.pop(task_id, None)
            continue
        bucket = result.setdefault(task_id, {"count": 0, "kinds": {}, "latest_at": 0})
        bucket["count"] += 1
        bucket["kinds"][kind] = int(bucket["kinds"].get(kind, 0) or 0) + 1
        latest = int_value(row["created_at"], 0) or 0
        if latest > int(bucket.get("latest_at") or 0):
            bucket["latest_at"] = latest
    return result

def warning_for_task(conn, task_id):
    return compute_warnings_for_tasks(conn, [task_id]).get(task_id)

def task_row_to_dict(row, conn=None):
    keys = set(row.keys())
    def get(name, default=None):
        return row[name] if name in keys else default
    task_id = get("id", "")
    return {
        "id": task_id,
        "title": get("title"),
        "body": get("body"),
        "assignee": get("assignee"),
        "status": get("status", "unknown"),
        "priority": int_value(get("priority"), 0),
        "created_by": get("created_by"),
        "created_at": int_value(get("created_at")),
        "started_at": int_value(get("started_at")),
        "completed_at": int_value(get("completed_at")),
        "workspace_kind": get("workspace_kind", "scratch"),
        "workspace_path": get("workspace_path"),
        "tenant": get("tenant"),
        "result": get("result"),
        "skills": parse_json_list(get("skills")),
        "spawn_failures": int_value(get("spawn_failures"), 0),
        "worker_pid": int_value(get("worker_pid")),
        "last_spawn_error": get("last_spawn_error"),
        "max_runtime_seconds": int_value(get("max_runtime_seconds")),
        "max_retries": int_value(get("max_retries")),
        "last_heartbeat_at": int_value(get("last_heartbeat_at")),
        "current_run_id": int_value(get("current_run_id")),
        "parent_ids": link_ids(conn, task_id, parents=True) if conn else [],
        "child_ids": link_ids(conn, task_id, parents=False) if conn else [],
        "progress": progress_for_task(conn, task_id),
        "comment_count": count_rows(conn, "task_comments", "task_id", task_id) if conn else 0,
        "event_count": count_rows(conn, "task_events", "task_id", task_id) if conn else 0,
        "run_count": count_rows(conn, "task_runs", "task_id", task_id) if conn else 0,
        "latest_event_at": latest_event_timestamp(conn, task_id) if conn else None,
        "warnings": warning_for_task(conn, task_id) if conn else None,
    }

def direct_tasks(conn, include_archived):
    if not table_exists(conn, "tasks"):
        return []
    query = "SELECT * FROM tasks"
    if not include_archived:
        query += " WHERE status != 'archived'"
    query += " ORDER BY priority DESC, created_at ASC"
    return [task_row_to_dict(row, conn) for row in conn.execute(query).fetchall()]

def direct_assignees(conn):
    names = set()
    counts = {}
    if table_exists(conn, "tasks"):
        for row in conn.execute(
            "SELECT assignee, status, COUNT(*) AS n FROM tasks "
            "WHERE status != 'archived' AND assignee IS NOT NULL GROUP BY assignee, status"
        ).fetchall():
            name = row["assignee"]
            names.add(name)
            counts.setdefault(name, {})[row["status"]] = int(row["n"] or 0)
    profiles_dir = pathlib.Path.home() / ".hermes" / "profiles"
    on_disk = set()
    if profiles_dir.exists():
        for item in sorted(profiles_dir.iterdir()):
            if item.is_dir() and (item / "config.yaml").exists():
                on_disk.add(item.name)
                names.add(item.name)
    return [{"name": name, "on_disk": name in on_disk, "counts": counts.get(name, {})} for name in sorted(names)]

def direct_stats(conn):
    by_status = {}
    by_assignee = {}
    oldest_ready = None
    if table_exists(conn, "tasks"):
        for row in conn.execute("SELECT status, COUNT(*) AS n FROM tasks WHERE status != 'archived' GROUP BY status").fetchall():
            by_status[row["status"]] = int(row["n"] or 0)
        for row in conn.execute(
            "SELECT assignee, status, COUNT(*) AS n FROM tasks "
            "WHERE status != 'archived' AND assignee IS NOT NULL GROUP BY assignee, status"
        ).fetchall():
            by_assignee.setdefault(row["assignee"], {})[row["status"]] = int(row["n"] or 0)
        ready = conn.execute("SELECT MIN(created_at) AS created_at FROM tasks WHERE status = 'ready'").fetchone()
        if ready and ready["created_at"] is not None:
            oldest_ready = max(0, int(time.time()) - int(ready["created_at"]))
    return {"by_status": by_status, "by_assignee": by_assignee, "oldest_ready_age_seconds": oldest_ready, "now": int(time.time())}

def direct_tenants(conn):
    if not conn or not table_exists(conn, "tasks"):
        return []
    rows = conn.execute("SELECT DISTINCT tenant FROM tasks WHERE tenant IS NOT NULL ORDER BY tenant").fetchall()
    return [row["tenant"] for row in rows]

def load_board(board_slug, include_archived=False):
    board_slug = normalize_board_slug(board_slug) or DEFAULT_BOARD
    db_path = kanban_db_path(board_slug)
    base = {
        "database_path": tilde(db_path, pathlib.Path.home()),
        "host_wide": True,
        "is_initialized": db_path.exists(),
        "has_kanban_module": False,
        "has_hermes_cli": find_hermes_binary() is not None,
        "dispatcher": dispatcher_status(),
        "latest_event_id": None,
        "warning": None,
        "tasks": [],
        "assignees": [],
        "tenants": [],
        "stats": None,
    }
    if not db_path.exists():
        return base
    conn = None
    try:
        conn = connect_sqlite_readonly(db_path)
        conn.row_factory = sqlite3.Row
        base.update({
            "tasks": direct_tasks(conn, include_archived),
            "assignees": direct_assignees(conn),
            "tenants": direct_tenants(conn),
            "stats": direct_stats(conn),
            "latest_event_id": latest_event_id(conn),
        })
        return base
    finally:
        if conn is not None:
            conn.close()

def load_task_detail(task_id, board_slug):
    board_slug = normalize_board_slug(board_slug) or DEFAULT_BOARD
    db_path = kanban_db_path(board_slug)
    if not db_path.exists():
        return None
    conn = None
    try:
        conn = connect_sqlite_readonly(db_path)
        conn.row_factory = sqlite3.Row
        if not table_exists(conn, "tasks"):
            return None
        row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        if row is None:
            return None
        comments = []
        if table_exists(conn, "task_comments"):
            comments = [
                {"id": int_value(item["id"], 0), "task_id": item["task_id"], "author": item["author"], "body": item["body"], "created_at": int_value(item["created_at"], 0)}
                for item in conn.execute("SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at ASC, id ASC", (task_id,)).fetchall()
            ]
        events = []
        if table_exists(conn, "task_events"):
            for item in conn.execute("SELECT * FROM task_events WHERE task_id = ? ORDER BY created_at ASC, id ASC", (task_id,)).fetchall():
                events.append({
                    "id": int_value(item["id"], 0),
                    "task_id": item["task_id"],
                    "kind": item["kind"],
                    "payload": parse_json_object(item["payload"]),
                    "created_at": int_value(item["created_at"], 0),
                    "run_id": int_value(item["run_id"]) if "run_id" in item.keys() else None,
                })
        runs = []
        if table_exists(conn, "task_runs"):
            run_columns = table_columns(conn, "task_runs")
            if "task_id" in run_columns:
                order_sql = "started_at ASC, id ASC" if "started_at" in run_columns and "id" in run_columns else "rowid ASC"
                run_rows = conn.execute(f"SELECT * FROM task_runs WHERE task_id = ? ORDER BY {order_sql}", (task_id,)).fetchall()
            else:
                run_rows = []
            for item in run_rows:
                keys = set(item.keys())
                def get(name, default=None):
                    return item[name] if name in keys else default
                runs.append({
                    "id": int_value(get("id"), 0),
                    "task_id": get("task_id"),
                    "profile": get("profile"),
                    "step_key": get("step_key"),
                    "status": get("status", ""),
                    "outcome": get("outcome"),
                    "summary": get("summary"),
                    "error": get("error"),
                    "metadata": parse_json_object(get("metadata")),
                    "worker_pid": int_value(get("worker_pid")),
                    "started_at": int_value(get("started_at"), 0),
                    "ended_at": int_value(get("ended_at")),
                })
        log_path = worker_log_path(task_id, board_slug)
        worker_log = None
        if log_path.exists():
            try:
                worker_log = log_path.read_bytes()[-65536:].decode("utf-8", errors="replace")
            except Exception:
                worker_log = None
        return {
            "task": task_row_to_dict(row, conn),
            "parent_ids": link_ids(conn, task_id, parents=True),
            "child_ids": link_ids(conn, task_id, parents=False),
            "comments": comments,
            "events": events,
            "runs": runs,
            "worker_log": worker_log,
            "home_channels": home_channels_for_task(conn, task_id),
        }
    finally:
        if conn is not None:
            conn.close()

def append_event(conn, task_id, kind, event_payload=None):
    if not table_exists(conn, "task_events"):
        return
    conn.execute(
        "INSERT INTO task_events (task_id, kind, payload, created_at) VALUES (?, ?, ?, ?)",
        (task_id, kind, json.dumps(event_payload, ensure_ascii=False) if event_payload is not None else None, int(time.time())),
    )

def update_task_fields_direct(board_slug, task_id):
    db_path = kanban_db_path(board_slug)
    if not db_path.exists():
        fail(f"No such Kanban task: {task_id}")
    conn = sqlite3.connect(db_path, timeout=30)
    conn.row_factory = sqlite3.Row
    try:
        if not table_exists(conn, "tasks"):
            fail("The Kanban tasks table is missing.")
        body = normalize_text(payload.get("body"))
        tenant = normalize_text(payload.get("tenant"))
        priority = int(payload.get("priority") or 0)
        skills = normalized_skill_list()
        skills_json = json.dumps(skills, ensure_ascii=False) if skills else None
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute("SELECT body, tenant, priority, skills FROM tasks WHERE id = ?", (task_id,)).fetchone()
        if row is None:
            conn.rollback()
            fail(f"No such Kanban task: {task_id}")
        changed = []
        if row["body"] != body:
            changed.append("body")
        if row["tenant"] != tenant:
            changed.append("tenant")
        if int_value(row["priority"], 0) != priority:
            changed.append("priority")
        if parse_json_list(row["skills"]) != skills:
            changed.append("skills")
        if changed:
            conn.execute("UPDATE tasks SET body = ?, tenant = ?, priority = ?, skills = ? WHERE id = ?", (body, tenant, priority, skills_json, task_id))
            append_event(conn, task_id, "updated", {"fields": changed})
        conn.commit()
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    finally:
        conn.close()

def delete_task_direct(board_slug, task_id, author):
    db_path = kanban_db_path(board_slug)
    if not db_path.exists():
        return False
    conn = sqlite3.connect(db_path, timeout=30)
    conn.row_factory = sqlite3.Row
    try:
        if not table_exists(conn, "tasks"):
            return False
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute("SELECT id FROM tasks WHERE id = ?", (task_id,)).fetchone()
        if row is None:
            conn.rollback()
            return False
        if table_exists(conn, "task_links"):
            conn.execute("DELETE FROM task_links WHERE parent_id = ? OR child_id = ?", (task_id, task_id))
        if table_exists(conn, "task_comments"):
            conn.execute("DELETE FROM task_comments WHERE task_id = ?", (task_id,))
        if table_exists(conn, "task_events"):
            conn.execute("DELETE FROM task_events WHERE task_id = ?", (task_id,))
        if table_exists(conn, "task_runs"):
            conn.execute("DELETE FROM task_runs WHERE task_id = ?", (task_id,))
        if table_exists(conn, "kanban_notify_subs"):
            conn.execute("DELETE FROM kanban_notify_subs WHERE task_id = ?", (task_id,))
        cur = conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        conn.commit()
        return cur.rowcount == 1
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    finally:
        conn.close()

def recompute_ready_rows(conn):
    if not conn or not table_exists(conn, "tasks") or not table_exists(conn, "task_links"):
        return 0
    promoted = 0
    try:
        conn.execute("BEGIN IMMEDIATE")
        todo_rows = conn.execute("SELECT id FROM tasks WHERE status = 'todo'").fetchall()
        for row in todo_rows:
            task_id = row["id"]
            parents = conn.execute(
                "SELECT t.status FROM tasks t "
                "JOIN task_links l ON l.parent_id = t.id "
                "WHERE l.child_id = ?",
                (task_id,),
            ).fetchall()
            if all(parent["status"] == "done" for parent in parents):
                cur = conn.execute(
                    "UPDATE tasks SET status = 'ready' WHERE id = ? AND status = 'todo'",
                    (task_id,),
                )
                if cur.rowcount == 1:
                    if table_exists(conn, "task_events"):
                        conn.execute(
                            "INSERT INTO task_events (task_id, kind, payload, created_at) "
                            "VALUES (?, 'promoted', NULL, ?)",
                            (task_id, int(time.time())),
                        )
                    promoted += 1
        conn.commit()
        return promoted
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
"#;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::remote_python::assert_python_payload_compiles;

    #[test]
    fn kanban_payloads_compile() {
        assert_python_payload_compiles(
            &KanbanBoardsRequest {
                kanban_home: "~/.hermes".to_string(),
                hermes_home: "~/.hermes".to_string(),
                include_archived: false,
            },
            &kanban_body(KANBAN_BOARDS_BODY),
        );
        assert_python_payload_compiles(
            &KanbanBoardRequest {
                kanban_home: "~/.hermes".to_string(),
                hermes_home: "~/.hermes".to_string(),
                board_slug: "default".to_string(),
                include_archived: false,
            },
            &kanban_body(KANBAN_BOARD_BODY),
        );
        assert_python_payload_compiles(
            &KanbanTaskDetailRequest {
                kanban_home: "~/.hermes".to_string(),
                hermes_home: "~/.hermes".to_string(),
                board_slug: "default".to_string(),
                task_id: "t_123".to_string(),
            },
            &kanban_body(KANBAN_TASK_DETAIL_BODY),
        );
        assert_python_payload_compiles(
            &KanbanBoardCreateRequest {
                kanban_home: "~/.hermes".to_string(),
                hermes_home: "~/.hermes".to_string(),
                slug: "tauri-smoke".to_string(),
                name: Some("Tauri Smoke".to_string()),
                description: None,
                icon: None,
                color: None,
                switch_after_create: false,
            },
            &kanban_body(KANBAN_CREATE_BOARD_BODY),
        );
        assert_python_payload_compiles(
            &KanbanBoardArchiveRequest {
                kanban_home: "~/.hermes".to_string(),
                hermes_home: "~/.hermes".to_string(),
                board_slug: "tauri-smoke".to_string(),
            },
            &kanban_body(KANBAN_ARCHIVE_BOARD_BODY),
        );
        assert_python_payload_compiles(
            &KanbanHomeSubscriptionRequest {
                kanban_home: "~/.hermes".to_string(),
                hermes_home: "~/.hermes".to_string(),
                board_slug: "default".to_string(),
                task_id: "t_123".to_string(),
                platform: "terminal".to_string(),
                subscribed: true,
            },
            &kanban_body(KANBAN_HOME_SUBSCRIPTION_BODY),
        );
        assert_python_payload_compiles(
            &KanbanMutationRequest {
                action: "create",
                title: Some("Tauri smoke".to_string()),
                body: Some("Smoke body".to_string()),
                priority: Some(0),
                tenant: Some("tauri-smoke".to_string()),
                skills: Some(Vec::new()),
                ..KanbanMutationRequest::empty()
            }
            .with_context(
                "~/.hermes".to_string(),
                "~/.hermes".to_string(),
                "default".to_string(),
                "default".to_string(),
            ),
            &kanban_body(KANBAN_MUTATION_BODY),
        );
    }
}
