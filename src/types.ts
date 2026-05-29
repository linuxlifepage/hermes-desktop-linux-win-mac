export interface AppSnapshot {
  connections: ConnectionProfile[];
  preferences: AppPreferences;
}

export interface AppPreferences {
  activeConnectionId: string | null;
  appLocale: string | null;
  automaticallyChecksForUpdates: boolean;
  lastAutomaticUpdateCheckAt: string | null;
  pinnedSessions: PinnedSession[];
  workspaceFileBookmarks: WorkspaceFileBookmark[];
  workflows: WorkflowPreset[];
}

export interface ConnectionProfile {
  id: string;
  label: string;
  sshAlias: string;
  sshHost: string;
  sshPort: number | null;
  sshUser: string;
  hermesProfile: string | null;
  customHermesHomePath: string | null;
  createdAt: string;
  updatedAt: string;
  lastConnectedAt: string | null;
}

export interface RemoteDiscovery {
  ok: boolean;
  remote_home: string;
  hermes_home: string;
  active_profile: RemoteHermesProfile;
  available_profiles: RemoteHermesProfile[];
  paths: RemoteHermesPaths;
  exists: RemoteHermesPathExistence;
  session_store: RemoteSessionStore | null;
  kanban: RemoteKanbanDiscovery | null;
}

export interface RemoteHermesProfile {
  name: string;
  path: string;
  is_default: boolean;
  exists: boolean;
}

export interface RemoteHermesPaths {
  user: string;
  memory: string;
  soul: string;
  sessions_dir: string;
  cron_jobs: string;
  kanban_database: string | null;
}

export interface RemoteHermesPathExistence {
  user: boolean;
  memory: boolean;
  soul: boolean;
  sessions_dir: boolean;
  cron_jobs: boolean;
  kanban_database: boolean | null;
}

export interface RemoteSessionStore {
  kind: string;
  path: string;
  session_table: string | null;
  message_table: string | null;
}

export interface RemoteKanbanDiscovery {
  database_path: string;
  exists: boolean;
  host_wide: boolean;
  has_hermes_cli: boolean;
  has_kanban_module: boolean;
  dispatcher: KanbanDispatcherStatus | null;
}

export interface KanbanDispatcherStatus {
  running: boolean | null;
  message: string | null;
}

export interface SessionListPage {
  ok: boolean;
  items: SessionSummary[];
  total_count: number;
}

export interface SessionSummary {
  id: string;
  title: string | null;
  model: string | null;
  parent_session_id: string | null;
  started_at: SessionTimestamp | null;
  last_active: SessionTimestamp | null;
  message_count: number | null;
  preview: string | null;
  search_match: SessionSearchMatch | null;
}

export interface SessionSearchMatch {
  match_count: number;
  message_id: string | null;
  role: string | null;
  timestamp: SessionTimestamp | null;
  snippet: string | null;
}

export interface SessionMessage {
  id: string;
  role: string | null;
  content: string | null;
  timestamp: SessionTimestamp | null;
  metadata: Record<string, unknown> | null;
}

export interface PinnedSession {
  id: string;
  workspaceScopeFingerprint: string;
  title: string | null;
  model: string | null;
  parentSessionId: string | null;
  startedAt: SessionTimestamp | null;
  lastActive: SessionTimestamp | null;
  messageCount: number | null;
  preview: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HermesChatTurnResult {
  ok: boolean;
  session_id: string | null;
  stdout: string | null;
  stderr: string | null;
}

export interface WorkspaceFileBookmark {
  id: string;
  workspaceScopeFingerprint: string;
  remotePath: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceFileReference {
  id: string;
  title: string;
  subtitle: string;
  remotePath: string;
  kind: "canonical" | "bookmark";
  trackedFile: "user" | "memory" | "soul" | null;
  bookmarkId: string | null;
}

export interface WorkflowSkillReference {
  relativePath: string;
  slug: string;
  name: string | null;
}

export interface WorkflowPreset {
  id: string;
  workspaceScopeFingerprint: string;
  name: string;
  prompt: string;
  assignedSkills: WorkflowSkillReference[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowDraftPayload {
  name: string;
  prompt: string;
  assignedSkills: WorkflowSkillReference[];
}

export interface WorkflowLaunchPreview {
  commandLine: string;
  startupCommandLine: string;
  initialInput: string;
  arguments: string[];
  chatCommandLine: string;
  chatStartupCommandLine: string;
  chatInitialInput: string;
  chatArguments: string[];
}

export interface TerminalCommandResult {
  commandLine: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  startedAt: string;
  endedAt: string;
}

export interface TerminalSessionInfo {
  id: string;
  title: string;
  profileId: string;
  profileLabel: string;
  hermesProfileName: string;
  destination: string;
  workspaceScopeFingerprint: string;
  hermesHomePath: string;
  startupCommandLine: string | null;
  initialInput: string | null;
  startedAt: string;
}

export interface TerminalSessionEvent {
  sessionId: string;
  kind: "started" | "stdout" | "stderr" | "initialInputSent" | "exit" | "error";
  data: string | null;
  exitCode: number | null;
  timestamp: string;
}

export interface FileEditorDocument {
  fileId: string;
  title: string;
  remotePath: string;
  content: string;
  originalContent: string;
  remoteContentHash: string | null;
  isLoading: boolean;
  errorMessage: string | null;
  lastSavedAt: string | null;
  hasLoaded: boolean;
}

export interface FileSnapshot {
  ok: boolean;
  content: string;
  content_hash: string;
}

export interface FileSaveResult {
  ok: boolean;
  path: string;
  content_hash: string;
}

export interface RemoteDirectoryListing {
  ok: boolean;
  requested_path: string;
  resolved_path: string;
  display_path: string;
  parent_path: string | null;
  parent_display_path: string | null;
  entries: RemoteDirectoryEntry[];
  total_entry_count: number;
  is_truncated: boolean;
}

export interface RemoteDirectoryEntry {
  name: string;
  path: string;
  display_path: string;
  kind: "directory" | "file" | "symlink" | "other" | string;
  size: number | null;
  modified_at: number | null;
  is_readable: boolean;
  is_writable: boolean;
  is_symlink: boolean;
}

export interface UsageSummary {
  ok: boolean;
  state: "available" | "unavailable" | string;
  session_count: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  reasoning_tokens: number;
  top_sessions: UsageSessionMetric[];
  top_models: UsageTopModel[];
  recent_sessions: UsageSessionMetric[];
  database_path: string | null;
  session_table: string | null;
  message: string | null;
  missing_columns: string[];
}

export interface UsageSessionMetric {
  id: string;
  title: string | null;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export interface UsageTopModel {
  model: string;
  billing_provider: string | null;
  session_count: number;
  total_tokens: number;
  cache_reasoning_tokens: number;
  estimated_cost_usd: number;
}

export interface UsageProfileSlice {
  profileName: string;
  hermesHomePath: string;
  state: "available" | "unavailable" | string;
  sessionCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
  databasePath: string | null;
  message: string | null;
  isActiveProfile: boolean;
}

export interface SkillLocator {
  source_id: string;
  relative_path: string;
}

export interface SkillSource {
  id: string;
  kind: "local" | "external" | string;
  root_path: string;
  is_read_only: boolean;
}

export interface SkillSummary {
  id: string;
  locator: SkillLocator;
  source: SkillSource;
  slug: string;
  category: string | null;
  relative_path: string;
  name: string | null;
  description: string | null;
  version: string | null;
  platforms: string[];
  tags: string[];
  related_skills: string[];
  has_references: boolean;
  has_scripts: boolean;
  has_templates: boolean;
}

export interface SkillDetail extends SkillSummary {
  markdown_content: string;
  content_hash: string;
}

export interface CronJob {
  id: string;
  name: string;
  prompt: string;
  skills: string[];
  model: string | null;
  provider: string | null;
  base_url: string | null;
  schedule: CronSchedule | null;
  schedule_display: string;
  recurrence: CronRecurrence | null;
  enabled: boolean;
  state: string;
  created_at: string | null;
  next_run_at: string | null;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
  delivery_target: string | null;
  origin: CronJobOrigin | null;
  last_delivery_error: string | null;
  script: string | null;
  workdir: string | null;
  no_agent: boolean;
}

export interface CronSchedule {
  kind: string | null;
  expr: string | null;
  timezone: string | null;
}

export interface CronRecurrence {
  times: number | null;
  remaining: number | null;
}

export interface CronJobOrigin {
  kind: string | null;
  source: string | null;
  label: string | null;
}

export interface CronJobDraftPayload {
  name: string;
  prompt: string;
  script: string | null;
  workdir: string | null;
  no_agent: boolean;
  schedule: string;
  skills: string[];
  model: string | null;
  provider: string | null;
  base_url: string | null;
  deliver: string | null;
  timezone: string | null;
}

export interface KanbanBoardsResponse {
  ok: boolean | null;
  boards: KanbanProject[];
  current: string | null;
  supports_board_management: boolean;
}

export interface KanbanProject {
  slug: string;
  name: string | null;
  description: string | null;
  icon: string | null;
  color: string | null;
  created_at: number | null;
  archived: boolean;
  db_path: string | null;
  is_current: boolean;
  counts: Record<string, number>;
  total: number | null;
}

export interface KanbanBoard {
  database_path: string;
  host_wide: boolean;
  is_initialized: boolean;
  has_kanban_module: boolean;
  has_hermes_cli: boolean;
  dispatcher: KanbanDispatcherStatus | null;
  latest_event_id: number | null;
  warning: string | null;
  tasks: KanbanTask[];
  assignees: KanbanAssignee[];
  tenants: string[];
  stats: KanbanStats | null;
}

export interface KanbanTask {
  id: string;
  title: string | null;
  body: string | null;
  assignee: string | null;
  status: string;
  priority: number;
  created_by: string | null;
  created_at: number | null;
  started_at: number | null;
  completed_at: number | null;
  workspace_kind: string;
  workspace_path: string | null;
  tenant: string | null;
  result: string | null;
  skills: string[];
  spawn_failures: number;
  worker_pid: number | null;
  last_spawn_error: string | null;
  max_runtime_seconds: number | null;
  max_retries: number | null;
  last_heartbeat_at: number | null;
  current_run_id: number | null;
  parent_ids: string[];
  child_ids: string[];
  progress: KanbanTaskProgress | null;
  comment_count: number;
  event_count: number;
  run_count: number;
  latest_event_at: number | null;
  warnings: KanbanTaskWarnings | null;
}

export interface KanbanTaskProgress {
  done: number;
  total: number;
}

export interface KanbanTaskWarnings {
  count: number;
  kinds: Record<string, number>;
  latest_at: number | null;
}

export interface KanbanTaskDetail {
  task: KanbanTask;
  parent_ids: string[];
  child_ids: string[];
  comments: KanbanComment[];
  events: KanbanEvent[];
  runs: KanbanRun[];
  worker_log: string | null;
  home_channels: KanbanHomeChannel[];
}

export interface KanbanComment {
  id: number;
  task_id: string;
  author: string;
  body: string;
  created_at: number;
}

export interface KanbanEvent {
  id: number;
  task_id: string;
  kind: string;
  payload: Record<string, unknown> | null;
  created_at: number;
  run_id: number | null;
}

export interface KanbanRun {
  id: number;
  task_id: string | null;
  profile: string | null;
  step_key: string | null;
  status: string;
  outcome: string | null;
  summary: string | null;
  error: string | null;
  metadata: Record<string, unknown> | null;
  worker_pid: number | null;
  started_at: number;
  ended_at: number | null;
}

export interface KanbanHomeChannel {
  platform: string;
  chat_id: string;
  thread_id: string;
  name: string | null;
  subscribed: boolean;
}

export interface KanbanAssignee {
  name: string;
  on_disk: boolean;
  counts: Record<string, number>;
}

export interface KanbanStats {
  by_status: Record<string, number>;
  by_assignee: Record<string, Record<string, number>>;
  oldest_ready_age_seconds: number | null;
  now: number | null;
}

export interface KanbanDispatchResult {
  reclaimed: number;
  crashed: string[];
  timed_out: string[];
  auto_blocked: string[];
  promoted: number;
  spawned: KanbanSpawnedTask[];
  skipped_unassigned: string[];
}

export interface KanbanSpawnedTask {
  task_id: string;
  assignee: string;
  workspace: string;
}

export interface KanbanOperationResponse {
  ok: boolean;
  message: string | null;
  task_id: string | null;
  detail: KanbanTaskDetail | null;
  dispatch: KanbanDispatchResult | null;
}

export interface KanbanBoardOperationResponse {
  ok: boolean | null;
  board: KanbanProject | null;
  boards: KanbanProject[] | null;
  current: string | null;
  result: unknown | null;
  message: string | null;
}

export interface KanbanTaskDraftPayload {
  title: string;
  body: string | null;
  assignee: string | null;
  priority: number;
  tenant: string | null;
  skills: string[];
  triage: boolean;
  max_retries: number | null;
  parent_ids: string[];
}

export interface KanbanBoardDraftPayload {
  slug: string;
  name: string | null;
  description: string | null;
  icon: string | null;
  color: string | null;
  switch_after_create: boolean;
}

export type SessionTimestamp = number | string | boolean | Record<string, unknown> | unknown[];

export type SectionId =
  | "connections"
  | "overview"
  | "sessions"
  | "workflows"
  | "cronjobs"
  | "kanban"
  | "files"
  | "usage"
  | "skills"
  | "terminal"
  | "settings"
  | "changelog";
