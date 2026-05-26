import { invoke } from "@tauri-apps/api/core";
import type {
  AppSnapshot,
  ConnectionProfile,
  CronJob,
  CronJobDraftPayload,
  FileSaveResult,
  FileSnapshot,
  HermesChatTurnResult,
  KanbanBoard,
  KanbanBoardDraftPayload,
  KanbanBoardOperationResponse,
  KanbanBoardsResponse,
  KanbanDispatchResult,
  KanbanOperationResponse,
  KanbanTaskDetail,
  KanbanTaskDraftPayload,
  PinnedSession,
  RemoteDirectoryListing,
  RemoteDiscovery,
  RemoteSessionStore,
  SessionListPage,
  SessionMessage,
  SessionSummary,
  SkillDetail,
  SkillLocator,
  SkillSummary,
  TerminalCommandResult,
  TerminalSessionInfo,
  UsageSummary,
  WorkflowDraftPayload,
  WorkflowLaunchPreview,
  WorkflowPreset,
  WorkspaceFileBookmark,
} from "./types";

export function appSnapshot(): Promise<AppSnapshot> {
  return invoke("app_snapshot");
}

export function setAutomaticUpdateChecks(enabled: boolean): Promise<AppSnapshot> {
  return invoke("set_automatic_update_checks", { enabled });
}

export function setAppLocale(locale: string | null): Promise<AppSnapshot> {
  return invoke("set_app_locale", { locale });
}

export function markAutomaticUpdateCheck(): Promise<AppSnapshot> {
  return invoke("mark_automatic_update_check");
}

export function saveConnection(profile: ConnectionProfile): Promise<ConnectionProfile> {
  return invoke("save_connection", { profile });
}

export function deleteConnection(id: string): Promise<void> {
  return invoke("delete_connection", { id });
}

export function setActiveConnection(id: string | null): Promise<AppSnapshot> {
  return invoke("set_active_connection", { id });
}

export function discoverConnection(profile: ConnectionProfile): Promise<RemoteDiscovery> {
  return invoke("discover_connection", { profile });
}

export function testConnection(profile: ConnectionProfile): Promise<RemoteDiscovery> {
  return invoke("test_connection", { profile });
}

export function listSessions(
  profile: ConnectionProfile,
  offset: number,
  limit: number,
  query: string,
): Promise<SessionListPage> {
  return invoke("list_sessions", { profile, offset, limit, query });
}

export function loadSessionTranscript(
  profile: ConnectionProfile,
  sessionId: string,
): Promise<SessionMessage[]> {
  return invoke("load_session_transcript", { profile, sessionId });
}

export function deleteRemoteSession(
  profile: ConnectionProfile,
  sessionId: string,
  hintedStore: RemoteSessionStore | null,
): Promise<void> {
  return invoke("delete_session", { profile, sessionId, hintedStore });
}

export function listPinnedSessions(profile: ConnectionProfile): Promise<PinnedSession[]> {
  return invoke("list_pinned_sessions", { profile });
}

export function pinSession(
  profile: ConnectionProfile,
  session: SessionSummary,
): Promise<PinnedSession[]> {
  return invoke("pin_session", { profile, session });
}

export function unpinSession(
  profile: ConnectionProfile,
  sessionId: string,
): Promise<PinnedSession[]> {
  return invoke("unpin_session", { profile, sessionId });
}

export function sendSessionMessage(
  profile: ConnectionProfile,
  sessionId: string,
  prompt: string,
  autoApproveCommands: boolean,
): Promise<HermesChatTurnResult> {
  return invoke("send_session_message", { profile, sessionId, prompt, autoApproveCommands });
}

export function sessionResumeCommand(profile: ConnectionProfile, sessionId: string): Promise<string> {
  return invoke("session_resume_command", { profile, sessionId });
}

export function sessionResumeStartupCommand(profile: ConnectionProfile, sessionId: string): Promise<string> {
  return invoke("session_resume_startup_command", { profile, sessionId });
}

export function sessionTuiStartupCommand(profile: ConnectionProfile, sessionId: string | null): Promise<string> {
  return invoke("session_tui_startup_command", { profile, sessionId });
}

export function listWorkspaceFileBookmarks(profile: ConnectionProfile): Promise<WorkspaceFileBookmark[]> {
  return invoke("list_workspace_file_bookmarks", { profile });
}

export function upsertWorkspaceFileBookmark(
  profile: ConnectionProfile,
  remotePath: string,
  title: string | null,
): Promise<WorkspaceFileBookmark[]> {
  return invoke("upsert_workspace_file_bookmark", { profile, remotePath, title });
}

export function removeWorkspaceFileBookmark(
  profile: ConnectionProfile,
  id: string,
): Promise<WorkspaceFileBookmark[]> {
  return invoke("remove_workspace_file_bookmark", { profile, id });
}

export function listWorkflows(profile: ConnectionProfile): Promise<WorkflowPreset[]> {
  return invoke("list_workflows", { profile });
}

export function createWorkflow(
  profile: ConnectionProfile,
  draft: WorkflowDraftPayload,
): Promise<WorkflowPreset> {
  return invoke("create_workflow", { profile, draft });
}

export function updateWorkflow(
  profile: ConnectionProfile,
  workflowId: string,
  draft: WorkflowDraftPayload,
): Promise<WorkflowPreset> {
  return invoke("update_workflow", { profile, workflowId, draft });
}

export function deleteWorkflow(
  profile: ConnectionProfile,
  workflowId: string,
): Promise<WorkflowPreset[]> {
  return invoke("delete_workflow", { profile, workflowId });
}

export function workflowLaunchPreview(
  profile: ConnectionProfile,
  workflowId: string,
): Promise<WorkflowLaunchPreview> {
  return invoke("workflow_launch_preview", { profile, workflowId });
}

export function readWorkspaceFile(
  profile: ConnectionProfile,
  remotePath: string,
): Promise<FileSnapshot> {
  return invoke("read_workspace_file", { profile, remotePath });
}

export function saveWorkspaceFile(
  profile: ConnectionProfile,
  remotePath: string,
  content: string,
  expectedContentHash: string | null,
): Promise<FileSaveResult> {
  return invoke("save_workspace_file", { profile, remotePath, content, expectedContentHash });
}

export function listRemoteDirectory(
  profile: ConnectionProfile,
  remotePath: string,
  hermesHome: string | null,
): Promise<RemoteDirectoryListing> {
  return invoke("list_remote_directory", { profile, remotePath, hermesHome });
}

export function loadUsage(
  profile: ConnectionProfile,
  hintedStore: RemoteSessionStore | null,
): Promise<UsageSummary> {
  return invoke("load_usage", { profile, hintedStore });
}

export function listSkills(profile: ConnectionProfile): Promise<SkillSummary[]> {
  return invoke("list_skills", { profile });
}

export function loadSkillDetail(profile: ConnectionProfile, locator: SkillLocator): Promise<SkillDetail> {
  return invoke("load_skill_detail", { profile, locator });
}

export function createSkill(
  profile: ConnectionProfile,
  relativePath: string,
  markdownContent: string,
  createReferencesFolder: boolean,
  createScriptsFolder: boolean,
  createTemplatesFolder: boolean,
): Promise<SkillDetail> {
  return invoke("create_skill", {
    profile,
    relativePath,
    markdownContent,
    createReferencesFolder,
    createScriptsFolder,
    createTemplatesFolder,
  });
}

export function updateSkill(
  profile: ConnectionProfile,
  locator: SkillLocator,
  markdownContent: string,
  expectedContentHash: string,
  ensureReferencesFolder: boolean,
  ensureScriptsFolder: boolean,
  ensureTemplatesFolder: boolean,
): Promise<SkillDetail> {
  return invoke("update_skill", {
    profile,
    locator,
    markdownContent,
    expectedContentHash,
    ensureReferencesFolder,
    ensureScriptsFolder,
    ensureTemplatesFolder,
  });
}

export function listCronJobs(profile: ConnectionProfile): Promise<CronJob[]> {
  return invoke("list_cron_jobs", { profile });
}

export function createCronJob(profile: ConnectionProfile, draft: CronJobDraftPayload): Promise<string> {
  return invoke("create_cron_job", { profile, draft });
}

export function updateCronJob(
  profile: ConnectionProfile,
  jobId: string,
  draft: CronJobDraftPayload,
): Promise<string> {
  return invoke("update_cron_job", { profile, jobId, draft });
}

export function pauseCronJob(profile: ConnectionProfile, jobId: string): Promise<void> {
  return invoke("pause_cron_job", { profile, jobId });
}

export function resumeCronJob(profile: ConnectionProfile, jobId: string): Promise<void> {
  return invoke("resume_cron_job", { profile, jobId });
}

export function removeCronJob(profile: ConnectionProfile, jobId: string): Promise<void> {
  return invoke("remove_cron_job", { profile, jobId });
}

export function runCronJobNow(profile: ConnectionProfile, jobId: string): Promise<void> {
  return invoke("run_cron_job_now", { profile, jobId });
}

export function runTerminalCommand(
  profile: ConnectionProfile,
  commandLine: string,
): Promise<TerminalCommandResult> {
  return invoke("run_terminal_command", { profile, commandLine });
}

export function startTerminalSession(
  profile: ConnectionProfile,
  startupCommandLine: string | null,
  initialInput: string | null,
  cols?: number | null,
  rows?: number | null,
): Promise<TerminalSessionInfo> {
  return invoke("start_terminal_session", { profile, startupCommandLine, initialInput, cols: cols ?? null, rows: rows ?? null });
}

export function writeTerminalSession(sessionId: string, input: string): Promise<void> {
  return invoke("write_terminal_session", { sessionId, input });
}

export function stopTerminalSession(sessionId: string): Promise<void> {
  return invoke("stop_terminal_session", { sessionId });
}

export function listKanbanBoards(
  profile: ConnectionProfile,
  includeArchived: boolean,
): Promise<KanbanBoardsResponse> {
  return invoke("list_kanban_boards", { profile, includeArchived });
}

export function loadKanbanBoard(
  profile: ConnectionProfile,
  boardSlug: string,
  includeArchived: boolean,
): Promise<KanbanBoard> {
  return invoke("load_kanban_board", { profile, boardSlug, includeArchived });
}

export function loadKanbanTaskDetail(
  profile: ConnectionProfile,
  boardSlug: string,
  taskId: string,
): Promise<KanbanTaskDetail> {
  return invoke("load_kanban_task_detail", { profile, boardSlug, taskId });
}

export function createKanbanBoard(
  profile: ConnectionProfile,
  draft: KanbanBoardDraftPayload,
): Promise<KanbanBoardOperationResponse> {
  return invoke("create_kanban_board", { profile, draft });
}

export function archiveKanbanBoard(
  profile: ConnectionProfile,
  boardSlug: string,
): Promise<KanbanBoardOperationResponse> {
  return invoke("archive_kanban_board", { profile, boardSlug });
}

export function createKanbanTask(
  profile: ConnectionProfile,
  boardSlug: string,
  draft: KanbanTaskDraftPayload,
): Promise<string> {
  return invoke("create_kanban_task", { profile, boardSlug, draft });
}

export function addKanbanComment(
  profile: ConnectionProfile,
  boardSlug: string,
  taskId: string,
  body: string,
): Promise<KanbanOperationResponse> {
  return invoke("add_kanban_comment", { profile, boardSlug, taskId, body });
}

export function updateKanbanTaskFields(
  profile: ConnectionProfile,
  boardSlug: string,
  taskId: string,
  body: string,
  tenant: string,
  priority: number,
  skills: string[],
): Promise<KanbanOperationResponse> {
  return invoke("update_kanban_task_fields", { profile, boardSlug, taskId, body, tenant, priority, skills });
}

export function setKanbanTaskParents(
  profile: ConnectionProfile,
  boardSlug: string,
  taskId: string,
  parentIds: string[],
): Promise<KanbanOperationResponse> {
  return invoke("set_kanban_task_parents", { profile, boardSlug, taskId, parentIds });
}

export function setKanbanTaskChildren(
  profile: ConnectionProfile,
  boardSlug: string,
  taskId: string,
  childIds: string[],
): Promise<KanbanOperationResponse> {
  return invoke("set_kanban_task_children", { profile, boardSlug, taskId, childIds });
}

export function assignKanbanTask(
  profile: ConnectionProfile,
  boardSlug: string,
  taskId: string,
  assignee: string | null,
): Promise<KanbanOperationResponse> {
  return invoke("assign_kanban_task", { profile, boardSlug, taskId, assignee });
}

export function specifyKanbanTask(
  profile: ConnectionProfile,
  boardSlug: string,
  taskId: string,
): Promise<KanbanOperationResponse> {
  return invoke("specify_kanban_task", { profile, boardSlug, taskId });
}

export function blockKanbanTask(
  profile: ConnectionProfile,
  boardSlug: string,
  taskId: string,
  reason: string | null,
): Promise<KanbanOperationResponse> {
  return invoke("block_kanban_task", { profile, boardSlug, taskId, reason });
}

export function unblockKanbanTask(
  profile: ConnectionProfile,
  boardSlug: string,
  taskId: string,
): Promise<KanbanOperationResponse> {
  return invoke("unblock_kanban_task", { profile, boardSlug, taskId });
}

export function completeKanbanTask(
  profile: ConnectionProfile,
  boardSlug: string,
  taskId: string,
  result: string | null,
): Promise<KanbanOperationResponse> {
  return invoke("complete_kanban_task", { profile, boardSlug, taskId, result });
}

export function reclaimKanbanTask(
  profile: ConnectionProfile,
  boardSlug: string,
  taskId: string,
  reason: string | null,
): Promise<KanbanOperationResponse> {
  return invoke("reclaim_kanban_task", { profile, boardSlug, taskId, reason });
}

export function reassignKanbanTask(
  profile: ConnectionProfile,
  boardSlug: string,
  taskId: string,
  assignee: string | null,
  reclaimFirst: boolean,
  reason: string | null,
): Promise<KanbanOperationResponse> {
  return invoke("reassign_kanban_task", { profile, boardSlug, taskId, assignee, reclaimFirst, reason });
}

export function editKanbanTaskResult(
  profile: ConnectionProfile,
  boardSlug: string,
  taskId: string,
  result: string,
  summary: string | null,
  metadataJson: string | null,
): Promise<KanbanOperationResponse> {
  return invoke("edit_kanban_task_result", { profile, boardSlug, taskId, result, summary, metadataJson });
}

export function archiveKanbanTask(
  profile: ConnectionProfile,
  boardSlug: string,
  taskId: string,
): Promise<KanbanOperationResponse> {
  return invoke("archive_kanban_task", { profile, boardSlug, taskId });
}

export function deleteKanbanTask(
  profile: ConnectionProfile,
  boardSlug: string,
  taskId: string,
): Promise<KanbanOperationResponse> {
  return invoke("delete_kanban_task", { profile, boardSlug, taskId });
}

export function setKanbanHomeSubscription(
  profile: ConnectionProfile,
  boardSlug: string,
  taskId: string,
  platform: string,
  subscribed: boolean,
): Promise<KanbanOperationResponse> {
  return invoke("set_kanban_home_subscription", { profile, boardSlug, taskId, platform, subscribed });
}

export function dispatchKanbanNow(
  profile: ConnectionProfile,
  boardSlug: string,
  maxSpawn: number,
): Promise<KanbanDispatchResult | null> {
  return invoke("dispatch_kanban_now", { profile, boardSlug, maxSpawn });
}
