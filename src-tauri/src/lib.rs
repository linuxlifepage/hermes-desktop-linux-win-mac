mod connection;
mod cron;
mod discovery;
mod error;
mod file;
mod kanban;
mod local_export;
mod models;
mod remote_python;
mod session;
mod skill;
mod ssh;
mod storage;
mod terminal;
mod usage;
mod workflow;

use chrono::Utc;
use connection::{
    delete_connection_inner, list_connections_inner, save_connection_inner,
    set_active_connection_inner,
};
use cron::{
    create_cron_job_inner, list_cron_jobs_inner, pause_cron_job_inner, remove_cron_job_inner,
    resume_cron_job_inner, run_cron_job_now_inner, update_cron_job_inner,
};
use discovery::discover_inner;
use file::{
    list_remote_directory_inner, list_workspace_file_bookmarks_inner, read_workspace_file_inner,
    remove_workspace_file_bookmark_inner, save_workspace_file_inner,
    upsert_workspace_file_bookmark_inner,
};
use kanban::{
    add_kanban_comment_inner, archive_kanban_board_inner, archive_kanban_task_inner,
    assign_kanban_task_inner, block_kanban_task_inner, complete_kanban_task_inner,
    create_kanban_board_inner, create_kanban_task_inner, delete_kanban_task_inner,
    dispatch_kanban_now_inner, edit_kanban_task_result_inner, list_kanban_boards_inner,
    load_kanban_board_inner, load_kanban_task_detail_inner, reassign_kanban_task_inner,
    reclaim_kanban_task_inner, set_kanban_home_subscription_inner, set_kanban_task_children_inner,
    set_kanban_task_parents_inner, specify_kanban_task_inner, unblock_kanban_task_inner,
    update_kanban_task_fields_inner,
};
use local_export::{save_hermes_directory_backup_inner, save_local_export_inner};
use models::{
    AppSnapshot, ConnectionProfile, CronJob, CronJobDraftPayload, FileSaveResult, FileSnapshot,
    HermesChatTurnResult, KanbanBoard, KanbanBoardDraftPayload, KanbanBoardOperationResponse,
    KanbanBoardsResponse, KanbanDispatchResult, KanbanOperationResponse, KanbanTaskDetail,
    KanbanTaskDraftPayload, PinnedSession, RemoteDirectoryListing, RemoteDiscovery,
    RemoteSessionStore, SessionListPage, SessionMessage, SessionSummary, SkillDetail, SkillLocator,
    SkillSummary, TerminalCommandResult, UsageSummary, WorkflowDraftPayload, WorkflowLaunchPreview,
    WorkflowPreset, WorkspaceFileBookmark,
};
use session::{
    delete_session_inner, list_pinned_sessions_inner, list_sessions_inner,
    load_session_transcript_inner, pin_session_inner, send_session_message_inner,
    session_resume_command_inner, session_resume_startup_command_inner,
    session_tui_startup_command_inner, unpin_session_inner,
};
use skill::{create_skill_inner, list_skills_inner, load_skill_detail_inner, update_skill_inner};
use storage::{load_preferences, load_snapshot, save_preferences, AppStorage};
use tauri::{AppHandle, Manager, State};
use terminal::{
    resize_terminal_session_inner, run_terminal_command_inner, start_terminal_session_inner,
    stop_terminal_session_inner, write_terminal_session_inner, TerminalSessionInfo, TerminalState,
};
use usage::load_usage_inner;
use workflow::{
    create_workflow_inner, delete_workflow_inner, list_workflows_inner, update_workflow_inner,
    workflow_launch_preview_inner,
};

#[tauri::command]
fn app_snapshot(storage: State<'_, AppStorage>) -> Result<AppSnapshot, String> {
    load_snapshot(&storage).map_err(|error| error.to_string())
}

#[tauri::command]
fn set_automatic_update_checks(
    storage: State<'_, AppStorage>,
    enabled: bool,
) -> Result<AppSnapshot, String> {
    let mut preferences = load_preferences(&storage).map_err(|error| error.to_string())?;
    preferences.automatically_checks_for_updates = enabled;
    save_preferences(&storage, &preferences).map_err(|error| error.to_string())?;
    load_snapshot(&storage).map_err(|error| error.to_string())
}

#[tauri::command]
fn set_app_locale(
    storage: State<'_, AppStorage>,
    locale: Option<String>,
) -> Result<AppSnapshot, String> {
    let normalized = locale
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .filter(|value| matches!(value.as_str(), "en" | "ru" | "zh-Hans"));
    let mut preferences = load_preferences(&storage).map_err(|error| error.to_string())?;
    preferences.app_locale = normalized;
    save_preferences(&storage, &preferences).map_err(|error| error.to_string())?;
    load_snapshot(&storage).map_err(|error| error.to_string())
}

#[tauri::command]
fn mark_automatic_update_check(storage: State<'_, AppStorage>) -> Result<AppSnapshot, String> {
    let mut preferences = load_preferences(&storage).map_err(|error| error.to_string())?;
    preferences.last_automatic_update_check_at = Some(Utc::now());
    save_preferences(&storage, &preferences).map_err(|error| error.to_string())?;
    load_snapshot(&storage).map_err(|error| error.to_string())
}

#[tauri::command]
fn save_local_export(file_name: String, contents: String) -> Result<String, String> {
    save_local_export_inner(file_name, contents).map_err(|error| error.to_string())
}

#[tauri::command]
async fn save_hermes_directory_backup(profile: ConnectionProfile) -> Result<String, String> {
    save_hermes_directory_backup_inner(profile)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn list_connections(storage: State<'_, AppStorage>) -> Result<Vec<ConnectionProfile>, String> {
    list_connections_inner(&storage).map_err(|error| error.to_string())
}

#[tauri::command]
fn save_connection(
    storage: State<'_, AppStorage>,
    profile: ConnectionProfile,
) -> Result<ConnectionProfile, String> {
    save_connection_inner(&storage, profile).map_err(|error| error.to_string())
}

#[tauri::command]
fn delete_connection(storage: State<'_, AppStorage>, id: String) -> Result<(), String> {
    delete_connection_inner(&storage, &id).map_err(|error| error.to_string())
}

#[tauri::command]
fn set_active_connection(
    storage: State<'_, AppStorage>,
    id: Option<String>,
) -> Result<AppSnapshot, String> {
    set_active_connection_inner(&storage, id).map_err(|error| error.to_string())
}

#[tauri::command]
async fn discover_connection(profile: ConnectionProfile) -> Result<RemoteDiscovery, String> {
    discover_inner(profile)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn test_connection(profile: ConnectionProfile) -> Result<RemoteDiscovery, String> {
    discover_inner(profile)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn list_sessions(
    profile: ConnectionProfile,
    offset: usize,
    limit: usize,
    query: String,
) -> Result<SessionListPage, String> {
    list_sessions_inner(profile, offset, limit, query)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn load_session_transcript(
    profile: ConnectionProfile,
    session_id: String,
) -> Result<Vec<SessionMessage>, String> {
    load_session_transcript_inner(profile, session_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn delete_session(
    profile: ConnectionProfile,
    session_id: String,
    hinted_store: Option<RemoteSessionStore>,
) -> Result<(), String> {
    delete_session_inner(profile, session_id, hinted_store)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn list_pinned_sessions(
    storage: State<'_, AppStorage>,
    profile: ConnectionProfile,
) -> Result<Vec<PinnedSession>, String> {
    list_pinned_sessions_inner(&storage, profile).map_err(|error| error.to_string())
}

#[tauri::command]
fn pin_session(
    storage: State<'_, AppStorage>,
    profile: ConnectionProfile,
    session: SessionSummary,
) -> Result<Vec<PinnedSession>, String> {
    pin_session_inner(&storage, profile, session).map_err(|error| error.to_string())
}

#[tauri::command]
fn unpin_session(
    storage: State<'_, AppStorage>,
    profile: ConnectionProfile,
    session_id: String,
) -> Result<Vec<PinnedSession>, String> {
    unpin_session_inner(&storage, profile, session_id).map_err(|error| error.to_string())
}

#[tauri::command]
async fn send_session_message(
    profile: ConnectionProfile,
    session_id: String,
    prompt: String,
    auto_approve_commands: bool,
) -> Result<HermesChatTurnResult, String> {
    send_session_message_inner(profile, session_id, prompt, auto_approve_commands)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn session_resume_command(profile: ConnectionProfile, session_id: String) -> String {
    session_resume_command_inner(profile, session_id)
}

#[tauri::command]
fn session_resume_startup_command(profile: ConnectionProfile, session_id: String) -> String {
    session_resume_startup_command_inner(profile, session_id)
}

#[tauri::command]
fn session_tui_startup_command(profile: ConnectionProfile, session_id: Option<String>) -> String {
    session_tui_startup_command_inner(profile, session_id)
}

#[tauri::command]
fn list_workspace_file_bookmarks(
    storage: State<'_, AppStorage>,
    profile: ConnectionProfile,
) -> Result<Vec<WorkspaceFileBookmark>, String> {
    list_workspace_file_bookmarks_inner(&storage, profile).map_err(|error| error.to_string())
}

#[tauri::command]
fn upsert_workspace_file_bookmark(
    storage: State<'_, AppStorage>,
    profile: ConnectionProfile,
    remote_path: String,
    title: Option<String>,
) -> Result<Vec<WorkspaceFileBookmark>, String> {
    upsert_workspace_file_bookmark_inner(&storage, profile, remote_path, title)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn remove_workspace_file_bookmark(
    storage: State<'_, AppStorage>,
    profile: ConnectionProfile,
    id: String,
) -> Result<Vec<WorkspaceFileBookmark>, String> {
    remove_workspace_file_bookmark_inner(&storage, profile, id).map_err(|error| error.to_string())
}

#[tauri::command]
fn list_workflows(
    storage: State<'_, AppStorage>,
    profile: ConnectionProfile,
) -> Result<Vec<WorkflowPreset>, String> {
    list_workflows_inner(&storage, profile).map_err(|error| error.to_string())
}

#[tauri::command]
fn create_workflow(
    storage: State<'_, AppStorage>,
    profile: ConnectionProfile,
    draft: WorkflowDraftPayload,
) -> Result<WorkflowPreset, String> {
    create_workflow_inner(&storage, profile, draft).map_err(|error| error.to_string())
}

#[tauri::command]
fn update_workflow(
    storage: State<'_, AppStorage>,
    profile: ConnectionProfile,
    workflow_id: String,
    draft: WorkflowDraftPayload,
) -> Result<WorkflowPreset, String> {
    update_workflow_inner(&storage, profile, workflow_id, draft).map_err(|error| error.to_string())
}

#[tauri::command]
fn delete_workflow(
    storage: State<'_, AppStorage>,
    profile: ConnectionProfile,
    workflow_id: String,
) -> Result<Vec<WorkflowPreset>, String> {
    delete_workflow_inner(&storage, profile, workflow_id).map_err(|error| error.to_string())
}

#[tauri::command]
fn workflow_launch_preview(
    storage: State<'_, AppStorage>,
    profile: ConnectionProfile,
    workflow_id: String,
) -> Result<WorkflowLaunchPreview, String> {
    workflow_launch_preview_inner(&storage, profile, workflow_id).map_err(|error| error.to_string())
}

#[tauri::command]
async fn read_workspace_file(
    profile: ConnectionProfile,
    remote_path: String,
) -> Result<FileSnapshot, String> {
    read_workspace_file_inner(profile, remote_path)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn save_workspace_file(
    profile: ConnectionProfile,
    remote_path: String,
    content: String,
    expected_content_hash: Option<String>,
) -> Result<FileSaveResult, String> {
    save_workspace_file_inner(profile, remote_path, content, expected_content_hash)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn list_remote_directory(
    profile: ConnectionProfile,
    remote_path: String,
    hermes_home: Option<String>,
) -> Result<RemoteDirectoryListing, String> {
    list_remote_directory_inner(profile, remote_path, hermes_home)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn load_usage(
    profile: ConnectionProfile,
    hinted_store: Option<RemoteSessionStore>,
) -> Result<UsageSummary, String> {
    load_usage_inner(profile, hinted_store)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn list_skills(profile: ConnectionProfile) -> Result<Vec<SkillSummary>, String> {
    list_skills_inner(profile)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn load_skill_detail(
    profile: ConnectionProfile,
    locator: SkillLocator,
) -> Result<SkillDetail, String> {
    load_skill_detail_inner(profile, locator)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn create_skill(
    profile: ConnectionProfile,
    relative_path: String,
    markdown_content: String,
    create_references_folder: bool,
    create_scripts_folder: bool,
    create_templates_folder: bool,
) -> Result<SkillDetail, String> {
    create_skill_inner(
        profile,
        relative_path,
        markdown_content,
        create_references_folder,
        create_scripts_folder,
        create_templates_folder,
    )
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
async fn update_skill(
    profile: ConnectionProfile,
    locator: SkillLocator,
    markdown_content: String,
    expected_content_hash: String,
    ensure_references_folder: bool,
    ensure_scripts_folder: bool,
    ensure_templates_folder: bool,
) -> Result<SkillDetail, String> {
    update_skill_inner(
        profile,
        locator,
        markdown_content,
        expected_content_hash,
        ensure_references_folder,
        ensure_scripts_folder,
        ensure_templates_folder,
    )
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
async fn list_cron_jobs(profile: ConnectionProfile) -> Result<Vec<CronJob>, String> {
    list_cron_jobs_inner(profile)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn create_cron_job(
    profile: ConnectionProfile,
    draft: CronJobDraftPayload,
) -> Result<String, String> {
    create_cron_job_inner(profile, draft)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn update_cron_job(
    profile: ConnectionProfile,
    job_id: String,
    draft: CronJobDraftPayload,
) -> Result<String, String> {
    update_cron_job_inner(profile, job_id, draft)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn pause_cron_job(profile: ConnectionProfile, job_id: String) -> Result<(), String> {
    pause_cron_job_inner(profile, job_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn resume_cron_job(profile: ConnectionProfile, job_id: String) -> Result<(), String> {
    resume_cron_job_inner(profile, job_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn remove_cron_job(profile: ConnectionProfile, job_id: String) -> Result<(), String> {
    remove_cron_job_inner(profile, job_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn run_cron_job_now(profile: ConnectionProfile, job_id: String) -> Result<(), String> {
    run_cron_job_now_inner(profile, job_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn run_terminal_command(
    profile: ConnectionProfile,
    command_line: String,
) -> Result<TerminalCommandResult, String> {
    run_terminal_command_inner(profile, command_line)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn start_terminal_session(
    app: AppHandle,
    terminal_state: State<'_, TerminalState>,
    profile: ConnectionProfile,
    startup_command_line: Option<String>,
    initial_input: Option<String>,
    cols: Option<u16>,
    rows: Option<u16>,
) -> Result<TerminalSessionInfo, String> {
    start_terminal_session_inner(
        app,
        &terminal_state,
        profile,
        startup_command_line,
        initial_input,
        cols,
        rows,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn write_terminal_session(
    terminal_state: State<'_, TerminalState>,
    session_id: String,
    input: String,
) -> Result<(), String> {
    write_terminal_session_inner(&terminal_state, session_id, input)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn resize_terminal_session(
    terminal_state: State<'_, TerminalState>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    resize_terminal_session_inner(&terminal_state, session_id, cols, rows)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn stop_terminal_session(
    terminal_state: State<'_, TerminalState>,
    session_id: String,
) -> Result<(), String> {
    stop_terminal_session_inner(&terminal_state, session_id).map_err(|error| error.to_string())
}

#[tauri::command]
async fn list_kanban_boards(
    profile: ConnectionProfile,
    include_archived: bool,
) -> Result<KanbanBoardsResponse, String> {
    list_kanban_boards_inner(profile, include_archived)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn load_kanban_board(
    profile: ConnectionProfile,
    board_slug: String,
    include_archived: bool,
) -> Result<KanbanBoard, String> {
    load_kanban_board_inner(profile, board_slug, include_archived)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn load_kanban_task_detail(
    profile: ConnectionProfile,
    board_slug: String,
    task_id: String,
) -> Result<KanbanTaskDetail, String> {
    load_kanban_task_detail_inner(profile, board_slug, task_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn create_kanban_board(
    profile: ConnectionProfile,
    draft: KanbanBoardDraftPayload,
) -> Result<KanbanBoardOperationResponse, String> {
    create_kanban_board_inner(profile, draft)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn archive_kanban_board(
    profile: ConnectionProfile,
    board_slug: String,
) -> Result<KanbanBoardOperationResponse, String> {
    archive_kanban_board_inner(profile, board_slug)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn create_kanban_task(
    profile: ConnectionProfile,
    board_slug: String,
    draft: KanbanTaskDraftPayload,
) -> Result<String, String> {
    create_kanban_task_inner(profile, board_slug, draft)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn add_kanban_comment(
    profile: ConnectionProfile,
    board_slug: String,
    task_id: String,
    body: String,
) -> Result<KanbanOperationResponse, String> {
    add_kanban_comment_inner(profile, board_slug, task_id, body)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn update_kanban_task_fields(
    profile: ConnectionProfile,
    board_slug: String,
    task_id: String,
    body: String,
    tenant: String,
    priority: i64,
    skills: Vec<String>,
) -> Result<KanbanOperationResponse, String> {
    update_kanban_task_fields_inner(profile, board_slug, task_id, body, tenant, priority, skills)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn set_kanban_task_parents(
    profile: ConnectionProfile,
    board_slug: String,
    task_id: String,
    parent_ids: Vec<String>,
) -> Result<KanbanOperationResponse, String> {
    set_kanban_task_parents_inner(profile, board_slug, task_id, parent_ids)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn set_kanban_task_children(
    profile: ConnectionProfile,
    board_slug: String,
    task_id: String,
    child_ids: Vec<String>,
) -> Result<KanbanOperationResponse, String> {
    set_kanban_task_children_inner(profile, board_slug, task_id, child_ids)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn assign_kanban_task(
    profile: ConnectionProfile,
    board_slug: String,
    task_id: String,
    assignee: Option<String>,
) -> Result<KanbanOperationResponse, String> {
    assign_kanban_task_inner(profile, board_slug, task_id, assignee)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn specify_kanban_task(
    profile: ConnectionProfile,
    board_slug: String,
    task_id: String,
) -> Result<KanbanOperationResponse, String> {
    specify_kanban_task_inner(profile, board_slug, task_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn block_kanban_task(
    profile: ConnectionProfile,
    board_slug: String,
    task_id: String,
    reason: Option<String>,
) -> Result<KanbanOperationResponse, String> {
    block_kanban_task_inner(profile, board_slug, task_id, reason)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn unblock_kanban_task(
    profile: ConnectionProfile,
    board_slug: String,
    task_id: String,
) -> Result<KanbanOperationResponse, String> {
    unblock_kanban_task_inner(profile, board_slug, task_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn complete_kanban_task(
    profile: ConnectionProfile,
    board_slug: String,
    task_id: String,
    result: Option<String>,
) -> Result<KanbanOperationResponse, String> {
    complete_kanban_task_inner(profile, board_slug, task_id, result)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn reclaim_kanban_task(
    profile: ConnectionProfile,
    board_slug: String,
    task_id: String,
    reason: Option<String>,
) -> Result<KanbanOperationResponse, String> {
    reclaim_kanban_task_inner(profile, board_slug, task_id, reason)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn reassign_kanban_task(
    profile: ConnectionProfile,
    board_slug: String,
    task_id: String,
    assignee: Option<String>,
    reclaim_first: bool,
    reason: Option<String>,
) -> Result<KanbanOperationResponse, String> {
    reassign_kanban_task_inner(
        profile,
        board_slug,
        task_id,
        assignee,
        reclaim_first,
        reason,
    )
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
async fn edit_kanban_task_result(
    profile: ConnectionProfile,
    board_slug: String,
    task_id: String,
    result: String,
    summary: Option<String>,
    metadata_json: Option<String>,
) -> Result<KanbanOperationResponse, String> {
    edit_kanban_task_result_inner(profile, board_slug, task_id, result, summary, metadata_json)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn archive_kanban_task(
    profile: ConnectionProfile,
    board_slug: String,
    task_id: String,
) -> Result<KanbanOperationResponse, String> {
    archive_kanban_task_inner(profile, board_slug, task_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn delete_kanban_task(
    profile: ConnectionProfile,
    board_slug: String,
    task_id: String,
) -> Result<KanbanOperationResponse, String> {
    delete_kanban_task_inner(profile, board_slug, task_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn dispatch_kanban_now(
    profile: ConnectionProfile,
    board_slug: String,
    max_spawn: i64,
) -> Result<Option<KanbanDispatchResult>, String> {
    dispatch_kanban_now_inner(profile, board_slug, max_spawn)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn set_kanban_home_subscription(
    profile: ConnectionProfile,
    board_slug: String,
    task_id: String,
    platform: String,
    subscribed: bool,
) -> Result<KanbanOperationResponse, String> {
    set_kanban_home_subscription_inner(profile, board_slug, task_id, platform, subscribed)
        .await
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod smoke_tests {
    use super::*;

    #[test]
    #[ignore = "requires HERMES_SMOKE_HOST and key/password-capable SSH access"]
    fn real_host_read_only_smoke() {
        let Some(profile) = smoke_profile() else {
            eprintln!("Skipping real-host smoke: HERMES_SMOKE_HOST is not set.");
            return;
        };

        tauri::async_runtime::block_on(async move {
            let discovery = discover_inner(profile.clone())
                .await
                .expect("discover remote Hermes workspace");
            assert!(discovery.ok);
            assert!(!discovery.remote_home.trim().is_empty());
            assert!(!discovery.hermes_home.trim().is_empty());
            eprintln!(
                "discovery ok: hermes_home={}, session_store={:?}, kanban={}",
                discovery.hermes_home,
                discovery.session_store.as_ref().map(|store| &store.kind),
                discovery
                    .kanban
                    .as_ref()
                    .map(|kanban| kanban.exists)
                    .unwrap_or(false)
            );

            let terminal =
                run_terminal_command_inner(profile.clone(), "printf 'tauri-smoke-ok'".to_string())
                    .await
                    .expect("run terminal command");
            assert_eq!(terminal.exit_code, 0);
            assert!(terminal.stdout.contains("tauri-smoke-ok"));

            let listing =
                list_remote_directory_inner(profile.clone(), discovery.hermes_home.clone(), None)
                    .await
                    .expect("list Hermes home");
            assert!(listing.ok);
            eprintln!(
                "files ok: {} entries under {}",
                listing.total_entry_count, listing.display_path
            );

            if discovery.exists.soul {
                let snapshot = read_workspace_file_inner(profile.clone(), discovery.paths.soul)
                    .await
                    .expect("read SOUL.md");
                assert!(snapshot.ok);
                assert!(!snapshot.content_hash.trim().is_empty());
                eprintln!("file read ok: SOUL.md {} bytes", snapshot.content.len());
            }

            let sessions = list_sessions_inner(profile.clone(), 0, 5, String::new())
                .await
                .expect("list sessions");
            eprintln!(
                "sessions ok: {} returned of {}",
                sessions.items.len(),
                sessions.total_count
            );
            if let Some(session) = sessions.items.first() {
                let messages = load_session_transcript_inner(profile.clone(), session.id.clone())
                    .await
                    .expect("load session transcript");
                eprintln!(
                    "session transcript ok: {} has {} messages",
                    session.id,
                    messages.len()
                );
            }

            let usage = load_usage_inner(profile.clone(), discovery.session_store.clone())
                .await
                .expect("load usage");
            assert!(usage.ok);
            eprintln!(
                "usage ok: state={}, sessions={}",
                usage.state, usage.session_count
            );

            let skills = list_skills_inner(profile.clone())
                .await
                .expect("list skills");
            eprintln!("skills ok: {} skills", skills.len());
            if let Some(skill) = skills.first() {
                let detail = load_skill_detail_inner(profile.clone(), skill.locator.clone())
                    .await
                    .expect("load skill detail");
                assert!(!detail.markdown_content.trim().is_empty());
                eprintln!("skill detail ok: {}", detail.relative_path);
            }

            let cron_jobs = list_cron_jobs_inner(profile.clone())
                .await
                .expect("list cron jobs");
            eprintln!("cron ok: {} jobs", cron_jobs.len());

            let boards = list_kanban_boards_inner(profile.clone(), false)
                .await
                .expect("list kanban boards");
            eprintln!("kanban boards ok: {} boards", boards.boards.len());
            let board_slug = boards
                .current
                .clone()
                .or_else(|| boards.boards.first().map(|board| board.slug.clone()))
                .unwrap_or_else(|| "default".to_string());
            let board = load_kanban_board_inner(profile, board_slug.clone(), false)
                .await
                .expect("load kanban board");
            assert!(board.has_hermes_cli || board.is_initialized);
            eprintln!(
                "kanban board ok: {} has {} tasks",
                board_slug,
                board.tasks.len()
            );
        });
    }

    #[test]
    #[ignore = "requires HERMES_SMOKE_HOST, HERMES_SMOKE_MUTATIONS=1, and disposable remote writes"]
    fn real_host_mutation_smoke() {
        if std::env::var("HERMES_SMOKE_MUTATIONS").ok().as_deref() != Some("1") {
            eprintln!("Skipping mutation smoke: set HERMES_SMOKE_MUTATIONS=1 to enable.");
            return;
        }
        let Some(profile) = smoke_profile() else {
            eprintln!("Skipping mutation smoke: HERMES_SMOKE_HOST is not set.");
            return;
        };

        let run_id = uuid::Uuid::new_v4().simple().to_string();
        tauri::async_runtime::block_on(async move {
            cleanup_smoke_paths(&profile, &run_id).await;

            let remote_file = format!("~/.hermes/.tauri-smoke/{run_id}/workspace-file.txt");
            let first_content = format!("tauri mutation smoke {run_id}\n");
            let first_save = save_workspace_file_inner(
                profile.clone(),
                remote_file.clone(),
                first_content,
                None,
            )
            .await
            .expect("create disposable workspace file");
            assert!(first_save.ok);
            let loaded = read_workspace_file_inner(profile.clone(), remote_file.clone())
                .await
                .expect("read disposable workspace file");
            assert!(loaded.content.contains(&run_id));
            let second_save = save_workspace_file_inner(
                profile.clone(),
                remote_file.clone(),
                format!("tauri mutation smoke {run_id}\nupdated\n"),
                Some(loaded.content_hash),
            )
            .await
            .expect("update disposable workspace file");
            assert!(second_save.ok);
            eprintln!("file mutation ok: {remote_file}");

            let skill_path = format!("tauri-smoke/{run_id}");
            let created_skill = create_skill_inner(
                profile.clone(),
                skill_path.clone(),
                smoke_skill_markdown(&run_id, "created"),
                true,
                true,
                true,
            )
            .await
            .expect("create disposable skill");
            assert_eq!(created_skill.relative_path, skill_path);
            let updated_skill = update_skill_inner(
                profile.clone(),
                created_skill.locator.clone(),
                smoke_skill_markdown(&run_id, "updated"),
                created_skill.content_hash,
                true,
                true,
                true,
            )
            .await
            .expect("update disposable skill");
            assert!(updated_skill.markdown_content.contains("updated"));
            eprintln!("skill mutation ok: {skill_path}");

            let cron_draft = smoke_cron_draft(&run_id, "created");
            let cron_job_id = create_cron_job_inner(profile.clone(), cron_draft)
                .await
                .expect("create disposable cron job");
            let updated_cron_job_id = update_cron_job_inner(
                profile.clone(),
                cron_job_id.clone(),
                smoke_cron_draft(&run_id, "updated"),
            )
            .await
            .expect("update disposable cron job");
            assert_eq!(updated_cron_job_id, cron_job_id);
            pause_cron_job_inner(profile.clone(), cron_job_id.clone())
                .await
                .expect("pause disposable cron job");
            resume_cron_job_inner(profile.clone(), cron_job_id.clone())
                .await
                .expect("resume disposable cron job");
            remove_cron_job_inner(profile.clone(), cron_job_id.clone())
                .await
                .expect("remove disposable cron job");
            eprintln!("cron mutation ok: {cron_job_id}");

            let boards = list_kanban_boards_inner(profile.clone(), false)
                .await
                .expect("list boards for mutation smoke");
            let board_slug = boards
                .current
                .clone()
                .or_else(|| boards.boards.first().map(|board| board.slug.clone()))
                .unwrap_or_else(|| "default".to_string());
            let disposable_board_slug = format!("tauri-smoke-{}", &run_id[..12]);
            let created_board = create_kanban_board_inner(
                profile.clone(),
                KanbanBoardDraftPayload {
                    slug: disposable_board_slug.clone(),
                    name: Some(format!("Tauri smoke {run_id}")),
                    description: Some("Disposable Tauri mutation smoke board.".to_string()),
                    icon: Some("test".to_string()),
                    color: Some("blue".to_string()),
                    switch_after_create: false,
                },
            )
            .await
            .expect("create disposable kanban board");
            assert_eq!(
                created_board
                    .board
                    .as_ref()
                    .map(|board| board.slug.as_str()),
                Some(disposable_board_slug.as_str())
            );
            let boards_with_created = list_kanban_boards_inner(profile.clone(), false)
                .await
                .expect("list boards after disposable board create");
            assert!(boards_with_created
                .boards
                .iter()
                .any(|board| board.slug == disposable_board_slug));
            let archived_board =
                archive_kanban_board_inner(profile.clone(), disposable_board_slug.clone())
                    .await
                    .expect("archive disposable kanban board");
            assert_eq!(
                archived_board
                    .board
                    .as_ref()
                    .map(|board| board.slug.as_str()),
                Some(disposable_board_slug.as_str())
            );
            let boards_without_archived = list_kanban_boards_inner(profile.clone(), false)
                .await
                .expect("list boards after disposable board archive");
            assert!(!boards_without_archived
                .boards
                .iter()
                .any(|board| board.slug == disposable_board_slug));
            let boards_with_archived = list_kanban_boards_inner(profile.clone(), true)
                .await
                .expect("list archived boards after disposable board archive");
            assert!(boards_with_archived
                .boards
                .iter()
                .any(|board| board.slug == disposable_board_slug));
            eprintln!("kanban board mutation ok: {disposable_board_slug}");

            let task_id = create_kanban_task_inner(
                profile.clone(),
                board_slug.clone(),
                KanbanTaskDraftPayload {
                    title: format!("Tauri smoke {run_id}"),
                    body: Some("Disposable Tauri mutation smoke task.".to_string()),
                    assignee: None,
                    priority: 0,
                    tenant: Some("tauri-smoke".to_string()),
                    skills: Vec::new(),
                    triage: false,
                    max_retries: None,
                    parent_ids: Vec::new(),
                },
            )
            .await
            .expect("create disposable kanban task");
            add_kanban_comment_inner(
                profile.clone(),
                board_slug.clone(),
                task_id.clone(),
                "Disposable Tauri smoke comment.".to_string(),
            )
            .await
            .expect("comment disposable kanban task");
            update_kanban_task_fields_inner(
                profile.clone(),
                board_slug.clone(),
                task_id.clone(),
                "Updated by Tauri mutation smoke.".to_string(),
                "tauri-smoke".to_string(),
                1,
                Vec::new(),
            )
            .await
            .expect("update disposable kanban task");
            block_kanban_task_inner(
                profile.clone(),
                board_slug.clone(),
                task_id.clone(),
                Some("Tauri mutation smoke block/unblock.".to_string()),
            )
            .await
            .expect("block disposable kanban task");
            unblock_kanban_task_inner(profile.clone(), board_slug.clone(), task_id.clone())
                .await
                .expect("unblock disposable kanban task");
            delete_kanban_task_inner(profile.clone(), board_slug.clone(), task_id.clone())
                .await
                .expect("delete disposable kanban task");
            eprintln!("kanban mutation ok: {board_slug}/{task_id}");

            cleanup_smoke_paths(&profile, &run_id).await;
        });
    }

    fn smoke_profile() -> Option<ConnectionProfile> {
        let host = std::env::var("HERMES_SMOKE_HOST").ok()?;
        let now = Utc::now();
        Some(ConnectionProfile {
            id: uuid::Uuid::new_v4(),
            label: std::env::var("HERMES_SMOKE_LABEL")
                .unwrap_or_else(|_| "Hermes smoke host".to_string()),
            ssh_alias: String::new(),
            ssh_host: host,
            ssh_port: std::env::var("HERMES_SMOKE_PORT")
                .ok()
                .and_then(|value| value.parse::<u16>().ok()),
            ssh_user: std::env::var("HERMES_SMOKE_USER").unwrap_or_default(),
            hermes_profile: std::env::var("HERMES_SMOKE_PROFILE")
                .ok()
                .filter(|value| !value.trim().is_empty()),
            custom_hermes_home_path: std::env::var("HERMES_SMOKE_HOME")
                .ok()
                .filter(|value| !value.trim().is_empty()),
            created_at: now,
            updated_at: now,
            last_connected_at: None,
        })
    }

    fn smoke_skill_markdown(run_id: &str, state: &str) -> String {
        format!(
            r#"---
name: "Tauri Smoke {run_id}"
description: "Disposable {state} mutation smoke skill."
---

# Tauri Smoke

This disposable skill was {state} by the Tauri mutation smoke test.
"#
        )
    }

    fn smoke_cron_draft(run_id: &str, state: &str) -> CronJobDraftPayload {
        CronJobDraftPayload {
            name: format!("Tauri smoke {run_id} {state}"),
            prompt: format!("Disposable Tauri mutation smoke cron job {run_id} {state}."),
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
        }
    }

    async fn cleanup_smoke_paths(profile: &ConnectionProfile, run_id: &str) {
        let command = format!(
            "rm -rf ~/.hermes/.tauri-smoke/{run_id} ~/.hermes/skills/tauri-smoke/{run_id} ~/.hermes/kanban/boards/tauri-smoke-*"
        );
        let _ = run_terminal_command_inner(profile.clone(), command).await;
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let storage = AppStorage::new(app.handle())?;
            app.manage(storage);
            app.manage(TerminalState::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_snapshot,
            set_automatic_update_checks,
            set_app_locale,
            mark_automatic_update_check,
            save_local_export,
            save_hermes_directory_backup,
            list_connections,
            save_connection,
            delete_connection,
            set_active_connection,
            discover_connection,
            test_connection,
            list_sessions,
            load_session_transcript,
            delete_session,
            list_pinned_sessions,
            pin_session,
            unpin_session,
            send_session_message,
            session_resume_command,
            session_resume_startup_command,
            session_tui_startup_command,
            list_workspace_file_bookmarks,
            upsert_workspace_file_bookmark,
            remove_workspace_file_bookmark,
            list_workflows,
            create_workflow,
            update_workflow,
            delete_workflow,
            workflow_launch_preview,
            read_workspace_file,
            save_workspace_file,
            list_remote_directory,
            load_usage,
            list_skills,
            load_skill_detail,
            create_skill,
            update_skill,
            list_cron_jobs,
            create_cron_job,
            update_cron_job,
            pause_cron_job,
            resume_cron_job,
            remove_cron_job,
            run_cron_job_now,
            run_terminal_command,
            start_terminal_session,
            write_terminal_session,
            resize_terminal_session,
            stop_terminal_session,
            list_kanban_boards,
            load_kanban_board,
            load_kanban_task_detail,
            create_kanban_board,
            archive_kanban_board,
            create_kanban_task,
            add_kanban_comment,
            update_kanban_task_fields,
            set_kanban_task_parents,
            set_kanban_task_children,
            assign_kanban_task,
            specify_kanban_task,
            block_kanban_task,
            unblock_kanban_task,
            complete_kanban_task,
            reclaim_kanban_task,
            reassign_kanban_task,
            edit_kanban_task_result,
            archive_kanban_task,
            delete_kanban_task,
            set_kanban_home_subscription,
            dispatch_kanban_now
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hermes Desktop");
}
