use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSnapshot {
    pub connections: Vec<ConnectionProfile>,
    pub preferences: AppPreferences,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppPreferences {
    #[serde(default)]
    pub active_connection_id: Option<String>,
    #[serde(default)]
    pub app_locale: Option<String>,
    #[serde(default = "default_automatic_update_checks")]
    pub automatically_checks_for_updates: bool,
    #[serde(default)]
    pub last_automatic_update_check_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub pinned_sessions: Vec<PinnedSession>,
    #[serde(default)]
    pub workspace_file_bookmarks: Vec<WorkspaceFileBookmark>,
    #[serde(default)]
    pub workflows: Vec<WorkflowPreset>,
}

impl Default for AppPreferences {
    fn default() -> Self {
        Self {
            active_connection_id: None,
            app_locale: None,
            automatically_checks_for_updates: default_automatic_update_checks(),
            last_automatic_update_check_at: None,
            pinned_sessions: Vec::new(),
            workspace_file_bookmarks: Vec::new(),
            workflows: Vec::new(),
        }
    }
}

fn default_automatic_update_checks() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionProfile {
    pub id: Uuid,
    pub label: String,
    pub ssh_alias: String,
    pub ssh_host: String,
    pub ssh_port: Option<u16>,
    pub ssh_user: String,
    #[serde(default, skip_serializing)]
    pub ssh_password: Option<String>,
    pub hermes_profile: Option<String>,
    pub custom_hermes_home_path: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_connected_at: Option<DateTime<Utc>>,
}

impl Default for ConnectionProfile {
    fn default() -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            label: String::new(),
            ssh_alias: String::new(),
            ssh_host: String::new(),
            ssh_port: None,
            ssh_user: String::new(),
            ssh_password: None,
            hermes_profile: None,
            custom_hermes_home_path: None,
            created_at: now,
            updated_at: now,
            last_connected_at: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteDiscovery {
    pub ok: bool,
    #[serde(rename = "remote_home")]
    pub remote_home: String,
    #[serde(rename = "hermes_home")]
    pub hermes_home: String,
    #[serde(rename = "active_profile")]
    pub active_profile: RemoteHermesProfile,
    #[serde(rename = "available_profiles")]
    pub available_profiles: Vec<RemoteHermesProfile>,
    pub paths: RemoteHermesPaths,
    pub exists: RemoteHermesPathExistence,
    #[serde(rename = "session_store")]
    pub session_store: Option<RemoteSessionStore>,
    pub kanban: Option<RemoteKanbanDiscovery>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteHermesProfile {
    pub name: String,
    pub path: String,
    #[serde(rename = "is_default")]
    pub is_default: bool,
    pub exists: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteHermesPaths {
    pub user: String,
    pub memory: String,
    pub soul: String,
    #[serde(rename = "sessions_dir")]
    pub sessions_dir: String,
    #[serde(rename = "cron_jobs")]
    pub cron_jobs: String,
    #[serde(rename = "kanban_database")]
    pub kanban_database: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteHermesPathExistence {
    pub user: bool,
    pub memory: bool,
    pub soul: bool,
    #[serde(rename = "sessions_dir")]
    pub sessions_dir: bool,
    #[serde(rename = "cron_jobs")]
    pub cron_jobs: bool,
    #[serde(rename = "kanban_database")]
    pub kanban_database: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteSessionStore {
    pub kind: String,
    pub path: String,
    #[serde(rename = "session_table")]
    pub session_table: Option<String>,
    #[serde(rename = "message_table")]
    pub message_table: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteKanbanDiscovery {
    #[serde(rename = "database_path")]
    pub database_path: String,
    pub exists: bool,
    #[serde(rename = "host_wide")]
    pub host_wide: bool,
    #[serde(rename = "has_hermes_cli")]
    pub has_hermes_cli: bool,
    #[serde(rename = "has_kanban_module")]
    pub has_kanban_module: bool,
    pub dispatcher: Option<KanbanDispatcherStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanDispatcherStatus {
    pub running: Option<bool>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionListPage {
    pub ok: bool,
    pub items: Vec<SessionSummary>,
    #[serde(rename = "total_count")]
    pub total_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionSummary {
    pub id: String,
    pub title: Option<String>,
    pub model: Option<String>,
    #[serde(rename = "parent_session_id")]
    pub parent_session_id: Option<String>,
    #[serde(rename = "started_at")]
    pub started_at: Option<serde_json::Value>,
    #[serde(rename = "last_active")]
    pub last_active: Option<serde_json::Value>,
    #[serde(rename = "message_count")]
    pub message_count: Option<usize>,
    pub preview: Option<String>,
    #[serde(rename = "search_match")]
    pub search_match: Option<SessionSearchMatch>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionSearchMatch {
    #[serde(rename = "match_count")]
    pub match_count: usize,
    #[serde(rename = "message_id")]
    pub message_id: Option<String>,
    pub role: Option<String>,
    pub timestamp: Option<serde_json::Value>,
    pub snippet: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionDetailResponse {
    pub ok: bool,
    pub items: Vec<SessionMessage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMessage {
    pub id: String,
    pub role: Option<String>,
    pub content: Option<String>,
    pub timestamp: Option<serde_json::Value>,
    pub metadata: Option<serde_json::Map<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PinnedSession {
    pub id: String,
    pub workspace_scope_fingerprint: String,
    pub title: Option<String>,
    pub model: Option<String>,
    pub parent_session_id: Option<String>,
    pub started_at: Option<serde_json::Value>,
    pub last_active: Option<serde_json::Value>,
    pub message_count: Option<usize>,
    pub preview: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HermesChatTurnResult {
    pub ok: bool,
    #[serde(rename = "session_id")]
    pub session_id: Option<String>,
    pub stdout: Option<String>,
    pub stderr: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceFileBookmark {
    pub id: Uuid,
    pub workspace_scope_fingerprint: String,
    pub remote_path: String,
    pub title: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowSkillReference {
    pub relative_path: String,
    pub slug: String,
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowPreset {
    pub id: Uuid,
    pub workspace_scope_fingerprint: String,
    pub name: String,
    pub prompt: String,
    pub assigned_skills: Vec<WorkflowSkillReference>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowDraftPayload {
    pub name: String,
    pub prompt: String,
    #[serde(default)]
    pub assigned_skills: Vec<WorkflowSkillReference>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowLaunchPreview {
    pub command_line: String,
    pub startup_command_line: String,
    pub initial_input: String,
    pub arguments: Vec<String>,
    pub chat_command_line: String,
    pub chat_startup_command_line: String,
    pub chat_initial_input: String,
    pub chat_arguments: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalCommandResult {
    pub command_line: String,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub started_at: DateTime<Utc>,
    pub ended_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileSnapshot {
    pub ok: bool,
    pub content: String,
    #[serde(rename = "content_hash")]
    pub content_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileSaveResult {
    pub ok: bool,
    pub path: String,
    #[serde(rename = "content_hash")]
    pub content_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteDirectoryListing {
    pub ok: bool,
    #[serde(rename = "requested_path")]
    pub requested_path: String,
    #[serde(rename = "resolved_path")]
    pub resolved_path: String,
    #[serde(rename = "display_path")]
    pub display_path: String,
    #[serde(rename = "parent_path")]
    pub parent_path: Option<String>,
    #[serde(rename = "parent_display_path")]
    pub parent_display_path: Option<String>,
    pub entries: Vec<RemoteDirectoryEntry>,
    #[serde(rename = "total_entry_count")]
    pub total_entry_count: usize,
    #[serde(rename = "is_truncated")]
    pub is_truncated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteDirectoryEntry {
    pub name: String,
    pub path: String,
    #[serde(rename = "display_path")]
    pub display_path: String,
    pub kind: String,
    pub size: Option<i64>,
    #[serde(rename = "modified_at")]
    pub modified_at: Option<f64>,
    #[serde(rename = "is_readable")]
    pub is_readable: bool,
    #[serde(rename = "is_writable")]
    pub is_writable: bool,
    #[serde(rename = "is_symlink")]
    pub is_symlink: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageSummary {
    pub ok: bool,
    pub state: String,
    #[serde(rename = "session_count")]
    pub session_count: i64,
    #[serde(rename = "input_tokens")]
    pub input_tokens: i64,
    #[serde(rename = "output_tokens")]
    pub output_tokens: i64,
    #[serde(rename = "cache_read_tokens")]
    pub cache_read_tokens: i64,
    #[serde(rename = "cache_write_tokens")]
    pub cache_write_tokens: i64,
    #[serde(rename = "reasoning_tokens")]
    pub reasoning_tokens: i64,
    #[serde(rename = "top_sessions")]
    pub top_sessions: Vec<UsageSessionMetric>,
    #[serde(rename = "top_models")]
    pub top_models: Vec<UsageTopModel>,
    #[serde(rename = "recent_sessions")]
    pub recent_sessions: Vec<UsageSessionMetric>,
    #[serde(rename = "database_path")]
    pub database_path: Option<String>,
    #[serde(rename = "session_table")]
    pub session_table: Option<String>,
    pub message: Option<String>,
    #[serde(rename = "missing_columns")]
    pub missing_columns: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageSessionMetric {
    pub id: String,
    pub title: Option<String>,
    #[serde(rename = "input_tokens")]
    pub input_tokens: i64,
    #[serde(rename = "output_tokens")]
    pub output_tokens: i64,
    #[serde(rename = "total_tokens")]
    pub total_tokens: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageTopModel {
    pub model: String,
    #[serde(rename = "billing_provider")]
    pub billing_provider: Option<String>,
    #[serde(rename = "session_count")]
    pub session_count: i64,
    #[serde(rename = "total_tokens")]
    pub total_tokens: i64,
    #[serde(rename = "cache_reasoning_tokens")]
    pub cache_reasoning_tokens: i64,
    #[serde(rename = "estimated_cost_usd")]
    pub estimated_cost_usd: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillListResponse {
    pub ok: bool,
    pub items: Vec<SkillSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillDetailResponse {
    pub ok: bool,
    pub item: SkillDetail,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct SkillLocator {
    #[serde(rename = "source_id")]
    pub source_id: String,
    #[serde(rename = "relative_path")]
    pub relative_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct SkillSource {
    pub id: String,
    pub kind: String,
    #[serde(rename = "root_path")]
    pub root_path: String,
    #[serde(rename = "is_read_only")]
    pub is_read_only: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillSummary {
    pub id: String,
    pub locator: SkillLocator,
    pub source: SkillSource,
    pub slug: String,
    pub category: Option<String>,
    #[serde(rename = "relative_path")]
    pub relative_path: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub version: Option<String>,
    pub platforms: Vec<String>,
    pub tags: Vec<String>,
    #[serde(rename = "related_skills")]
    pub related_skills: Vec<String>,
    #[serde(rename = "has_references")]
    pub has_references: bool,
    #[serde(rename = "has_scripts")]
    pub has_scripts: bool,
    #[serde(rename = "has_templates")]
    pub has_templates: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillDetail {
    pub id: String,
    pub locator: SkillLocator,
    pub source: SkillSource,
    pub slug: String,
    pub category: Option<String>,
    #[serde(rename = "relative_path")]
    pub relative_path: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub version: Option<String>,
    pub platforms: Vec<String>,
    pub tags: Vec<String>,
    #[serde(rename = "related_skills")]
    pub related_skills: Vec<String>,
    #[serde(rename = "has_references")]
    pub has_references: bool,
    #[serde(rename = "has_scripts")]
    pub has_scripts: bool,
    #[serde(rename = "has_templates")]
    pub has_templates: bool,
    #[serde(rename = "markdown_content")]
    pub markdown_content: String,
    #[serde(rename = "content_hash")]
    pub content_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CronJobListResponse {
    pub ok: bool,
    pub jobs: Vec<CronJob>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CronJob {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub prompt: String,
    #[serde(default)]
    pub skills: Vec<String>,
    pub model: Option<String>,
    pub provider: Option<String>,
    #[serde(rename = "base_url")]
    pub base_url: Option<String>,
    pub schedule: Option<CronSchedule>,
    #[serde(rename = "schedule_display", default)]
    pub schedule_display: String,
    pub recurrence: Option<CronRecurrence>,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default = "default_cron_state")]
    pub state: String,
    #[serde(rename = "created_at")]
    pub created_at: Option<String>,
    #[serde(rename = "next_run_at")]
    pub next_run_at: Option<String>,
    #[serde(rename = "last_run_at")]
    pub last_run_at: Option<String>,
    #[serde(rename = "last_status")]
    pub last_status: Option<String>,
    #[serde(rename = "last_error")]
    pub last_error: Option<String>,
    #[serde(rename = "delivery_target")]
    pub delivery_target: Option<String>,
    pub origin: Option<CronJobOrigin>,
    #[serde(rename = "last_delivery_error")]
    pub last_delivery_error: Option<String>,
    pub script: Option<String>,
    pub workdir: Option<String>,
    #[serde(rename = "no_agent", default)]
    pub no_agent: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CronSchedule {
    pub kind: Option<String>,
    pub expr: Option<String>,
    pub timezone: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CronRecurrence {
    pub times: Option<i64>,
    pub remaining: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CronJobOrigin {
    pub kind: Option<String>,
    pub source: Option<String>,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CronJobDraftPayload {
    pub name: String,
    pub prompt: String,
    pub script: Option<String>,
    pub workdir: Option<String>,
    #[serde(rename = "no_agent")]
    pub no_agent: bool,
    pub schedule: String,
    #[serde(default)]
    pub skills: Vec<String>,
    pub model: Option<String>,
    pub provider: Option<String>,
    #[serde(rename = "base_url")]
    pub base_url: Option<String>,
    pub deliver: Option<String>,
    pub timezone: Option<String>,
}

fn default_true() -> bool {
    true
}

fn default_cron_state() -> String {
    "scheduled".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanBoardsResponse {
    pub ok: Option<bool>,
    #[serde(default)]
    pub boards: Vec<KanbanProject>,
    pub current: Option<String>,
    #[serde(rename = "supports_board_management", default)]
    pub supports_board_management: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanBoardResponse {
    pub ok: bool,
    pub board: KanbanBoard,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanTaskDetailResponse {
    pub ok: bool,
    pub detail: KanbanTaskDetail,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanOperationResponse {
    pub ok: bool,
    pub message: Option<String>,
    #[serde(rename = "task_id")]
    pub task_id: Option<String>,
    pub detail: Option<KanbanTaskDetail>,
    pub dispatch: Option<KanbanDispatchResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanBoardOperationResponse {
    pub ok: Option<bool>,
    pub board: Option<KanbanProject>,
    pub boards: Option<Vec<KanbanProject>>,
    pub current: Option<String>,
    pub result: Option<serde_json::Value>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanProject {
    pub slug: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    #[serde(rename = "created_at")]
    pub created_at: Option<i64>,
    #[serde(default)]
    pub archived: bool,
    #[serde(rename = "db_path")]
    pub database_path: Option<String>,
    #[serde(rename = "is_current", default)]
    pub is_current: bool,
    #[serde(default)]
    pub counts: HashMap<String, i64>,
    pub total: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanBoard {
    #[serde(rename = "database_path")]
    pub database_path: String,
    #[serde(rename = "host_wide")]
    pub host_wide: bool,
    #[serde(rename = "is_initialized")]
    pub is_initialized: bool,
    #[serde(rename = "has_kanban_module")]
    pub has_kanban_module: bool,
    #[serde(rename = "has_hermes_cli")]
    pub has_hermes_cli: bool,
    pub dispatcher: Option<KanbanDispatcherStatus>,
    #[serde(rename = "latest_event_id")]
    pub latest_event_id: Option<i64>,
    pub warning: Option<String>,
    #[serde(default)]
    pub tasks: Vec<KanbanTask>,
    #[serde(default)]
    pub assignees: Vec<KanbanAssignee>,
    #[serde(default)]
    pub tenants: Vec<String>,
    pub stats: Option<KanbanStats>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanTask {
    pub id: String,
    pub title: Option<String>,
    pub body: Option<String>,
    pub assignee: Option<String>,
    #[serde(default = "default_kanban_status")]
    pub status: String,
    #[serde(default)]
    pub priority: i64,
    #[serde(rename = "created_by")]
    pub created_by: Option<String>,
    #[serde(rename = "created_at")]
    pub created_at: Option<i64>,
    #[serde(rename = "started_at")]
    pub started_at: Option<i64>,
    #[serde(rename = "completed_at")]
    pub completed_at: Option<i64>,
    #[serde(rename = "workspace_kind", default = "default_workspace_kind")]
    pub workspace_kind: String,
    #[serde(rename = "workspace_path")]
    pub workspace_path: Option<String>,
    pub tenant: Option<String>,
    pub result: Option<String>,
    #[serde(default)]
    pub skills: Vec<String>,
    #[serde(rename = "spawn_failures", default)]
    pub spawn_failures: i64,
    #[serde(rename = "worker_pid")]
    pub worker_pid: Option<i64>,
    #[serde(rename = "last_spawn_error")]
    pub last_spawn_error: Option<String>,
    #[serde(rename = "max_runtime_seconds")]
    pub max_runtime_seconds: Option<i64>,
    #[serde(rename = "max_retries")]
    pub max_retries: Option<i64>,
    #[serde(rename = "last_heartbeat_at")]
    pub last_heartbeat_at: Option<i64>,
    #[serde(rename = "current_run_id")]
    pub current_run_id: Option<i64>,
    #[serde(rename = "parent_ids", default)]
    pub parent_ids: Vec<String>,
    #[serde(rename = "child_ids", default)]
    pub child_ids: Vec<String>,
    pub progress: Option<KanbanTaskProgress>,
    #[serde(rename = "comment_count", default)]
    pub comment_count: i64,
    #[serde(rename = "event_count", default)]
    pub event_count: i64,
    #[serde(rename = "run_count", default)]
    pub run_count: i64,
    #[serde(rename = "latest_event_at")]
    pub latest_event_at: Option<i64>,
    pub warnings: Option<KanbanTaskWarnings>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanTaskProgress {
    pub done: i64,
    pub total: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanTaskWarnings {
    #[serde(default)]
    pub count: i64,
    #[serde(default)]
    pub kinds: HashMap<String, i64>,
    #[serde(rename = "latest_at")]
    pub latest_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanTaskDetail {
    pub task: KanbanTask,
    #[serde(rename = "parent_ids", default)]
    pub parent_ids: Vec<String>,
    #[serde(rename = "child_ids", default)]
    pub child_ids: Vec<String>,
    #[serde(default)]
    pub comments: Vec<KanbanComment>,
    #[serde(default)]
    pub events: Vec<KanbanEvent>,
    #[serde(default)]
    pub runs: Vec<KanbanRun>,
    #[serde(rename = "worker_log")]
    pub worker_log: Option<String>,
    #[serde(rename = "home_channels", default)]
    pub home_channels: Vec<KanbanHomeChannel>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanHomeChannel {
    pub platform: String,
    #[serde(rename = "chat_id")]
    pub chat_id: String,
    #[serde(rename = "thread_id", default)]
    pub thread_id: String,
    pub name: Option<String>,
    #[serde(default)]
    pub subscribed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanComment {
    pub id: i64,
    #[serde(rename = "task_id")]
    pub task_id: String,
    pub author: String,
    pub body: String,
    #[serde(rename = "created_at")]
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanEvent {
    pub id: i64,
    #[serde(rename = "task_id")]
    pub task_id: String,
    pub kind: String,
    pub payload: Option<serde_json::Map<String, serde_json::Value>>,
    #[serde(rename = "created_at")]
    pub created_at: i64,
    #[serde(rename = "run_id")]
    pub run_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanRun {
    pub id: i64,
    #[serde(rename = "task_id")]
    pub task_id: Option<String>,
    pub profile: Option<String>,
    #[serde(rename = "step_key")]
    pub step_key: Option<String>,
    pub status: String,
    pub outcome: Option<String>,
    pub summary: Option<String>,
    pub error: Option<String>,
    pub metadata: Option<serde_json::Map<String, serde_json::Value>>,
    #[serde(rename = "worker_pid")]
    pub worker_pid: Option<i64>,
    #[serde(rename = "started_at")]
    pub started_at: i64,
    #[serde(rename = "ended_at")]
    pub ended_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanAssignee {
    pub name: String,
    #[serde(rename = "on_disk", default)]
    pub on_disk: bool,
    #[serde(default)]
    pub counts: HashMap<String, i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanStats {
    #[serde(rename = "by_status", default)]
    pub by_status: HashMap<String, i64>,
    #[serde(rename = "by_assignee", default)]
    pub by_assignee: HashMap<String, HashMap<String, i64>>,
    #[serde(rename = "oldest_ready_age_seconds")]
    pub oldest_ready_age_seconds: Option<i64>,
    pub now: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanDispatchResult {
    #[serde(default)]
    pub reclaimed: i64,
    #[serde(default)]
    pub crashed: Vec<String>,
    #[serde(rename = "timed_out", default)]
    pub timed_out: Vec<String>,
    #[serde(rename = "auto_blocked", default)]
    pub auto_blocked: Vec<String>,
    #[serde(default)]
    pub promoted: i64,
    #[serde(default)]
    pub spawned: Vec<KanbanSpawnedTask>,
    #[serde(rename = "skipped_unassigned", default)]
    pub skipped_unassigned: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanSpawnedTask {
    #[serde(rename = "task_id")]
    pub task_id: String,
    pub assignee: String,
    pub workspace: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanTaskDraftPayload {
    pub title: String,
    pub body: Option<String>,
    pub assignee: Option<String>,
    pub priority: i64,
    pub tenant: Option<String>,
    #[serde(default)]
    pub skills: Vec<String>,
    #[serde(default)]
    pub triage: bool,
    #[serde(rename = "max_retries")]
    pub max_retries: Option<i64>,
    #[serde(rename = "parent_ids", default)]
    pub parent_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanBoardDraftPayload {
    pub slug: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    #[serde(rename = "switch_after_create", default)]
    pub switch_after_create: bool,
}

fn default_kanban_status() -> String {
    "unknown".to_string()
}

fn default_workspace_kind() -> String {
    "scratch".to_string()
}
