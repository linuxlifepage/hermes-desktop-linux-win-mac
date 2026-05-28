import "./styles.css";
import "@xterm/xterm/css/xterm.css";
import { listen } from "@tauri-apps/api/event";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal as XTerm } from "@xterm/xterm";
import packageJson from "../package.json";
import {
  appSnapshot,
  addKanbanComment,
  archiveKanbanBoard,
  archiveKanbanTask,
  assignKanbanTask,
  blockKanbanTask,
  completeKanbanTask,
  createCronJob,
  createKanbanBoard,
  createKanbanTask,
  createSkill,
  createWorkflow,
  deleteConnection,
  deleteKanbanTask,
  deleteRemoteSession,
  deleteWorkflow,
  discoverConnection,
  dispatchKanbanNow,
  editKanbanTaskResult,
  listKanbanBoards,
  listCronJobs,
  listRemoteDirectory,
  listSessions,
  listPinnedSessions,
  listSkills,
  listWorkflows,
  loadKanbanBoard,
  loadKanbanTaskDetail,
  listWorkspaceFileBookmarks,
  loadSkillDetail,
  loadUsage,
  loadSessionTranscript,
  markAutomaticUpdateCheck,
  pinSession,
  pauseCronJob,
  readWorkspaceFile,
  reclaimKanbanTask,
  removeCronJob,
  removeWorkspaceFileBookmark,
  reassignKanbanTask,
  resumeCronJob,
  resizeTerminalSession,
  runCronJobNow,
  runTerminalCommand,
  saveConnection,
  saveWorkspaceFile,
  sendSessionMessage,
  setActiveConnection,
  setAppLocale,
  setAutomaticUpdateChecks,
  setKanbanHomeSubscription,
  setKanbanTaskChildren,
  setKanbanTaskParents,
  sessionResumeCommand,
  sessionResumeStartupCommand,
  sessionTuiStartupCommand,
  startTerminalSession,
  stopTerminalSession,
  specifyKanbanTask,
  testConnection,
  unpinSession,
  unblockKanbanTask,
  updateCronJob,
  updateKanbanTaskFields,
  updateSkill,
  updateWorkflow,
  upsertWorkspaceFileBookmark,
  writeTerminalSession,
  workflowLaunchPreview,
} from "./api";
import type {
  AppSnapshot,
  ConnectionProfile,
  CronJob,
  CronJobDraftPayload,
  FileEditorDocument,
  KanbanBoard,
  KanbanBoardDraftPayload,
  KanbanBoardsResponse,
  KanbanDispatchResult,
  KanbanTask,
  KanbanTaskDetail,
  KanbanTaskDraftPayload,
  RemoteDiscovery,
  RemoteDirectoryEntry,
  RemoteDirectoryListing,
  SectionId,
  SessionMessage,
  SessionSummary,
  SessionTimestamp,
  PinnedSession,
  SkillDetail,
  SkillSummary,
  TerminalCommandResult,
  TerminalSessionEvent,
  TerminalSessionInfo,
  UsageProfileSlice,
  UsageSummary,
  WorkflowDraftPayload,
  WorkflowLaunchPreview,
  WorkflowPreset,
  WorkflowSkillReference,
  WorkspaceFileBookmark,
  WorkspaceFileReference,
} from "./types";
import {
  appLocales,
  browserLocale,
  currentLocale,
  localizeElement,
  setLocale,
  t,
  tf,
} from "./i18n";
import type { AppLocale } from "./i18n";
import { checkForHermesDesktopUpdate, normalizedDisplayVersion } from "./update";
import type { AvailableUpdate } from "./update";

const sections: Array<{ id: SectionId; title: string; icon: string }> = [
  { id: "connections", title: "Connections", icon: "network" },
  { id: "overview", title: "Overview", icon: "pulse" },
  { id: "sessions", title: "Sessions", icon: "chat" },
  { id: "workflows", title: "Workflows", icon: "bookmark" },
  { id: "cronjobs", title: "Cron Jobs", icon: "calendar" },
  { id: "kanban", title: "Kanban", icon: "columns" },
  { id: "files", title: "Files", icon: "file" },
  { id: "usage", title: "Usage", icon: "chart" },
  { id: "skills", title: "Skills", icon: "book" },
  { id: "terminal", title: "Terminal", icon: "terminal" },
];

const sectionKeyboardShortcuts: Record<string, SectionId> = {
  "1": "connections",
  "2": "overview",
  "3": "sessions",
  "4": "workflows",
  "5": "cronjobs",
  "6": "kanban",
  "7": "files",
  "8": "usage",
  "9": "skills",
  "0": "terminal",
};

interface AppState {
  snapshot: AppSnapshot;
  selectedSection: SectionId;
  selectedConnectionId: string | null;
  overview: RemoteDiscovery | null;
  status: string | null;
  error: string | null;
  isBusy: boolean;
  availableUpdate: AvailableUpdate | null;
  updateCheckError: string | null;
  isCheckingForUpdates: boolean;
  hasPerformedAutomaticUpdateCheck: boolean;
  appTheme: AppTheme;
  editor: ConnectionProfile | null;
  isEditingNewConnection: boolean;
  sessions: SessionSummary[];
  pinnedSessions: PinnedSession[];
  sessionTotalCount: number;
  sessionOffset: number;
  sessionQuery: string;
  selectedSessionId: string | null;
  sessionMessages: SessionMessage[];
  sessionsLoaded: boolean;
  isLoadingSessions: boolean;
  isLoadingSessionDetail: boolean;
  isSendingSessionMessage: boolean;
  sessionPrompt: string;
  autoApproveCommands: boolean;
  sessionDetailMode: "transcript" | "chat";
  sessionScrollOffsets: Record<string, number>;
  resumeCommand: string | null;
  resumeStartupCommand: string | null;
  workflows: WorkflowPreset[];
  selectedWorkflowId: string | null;
  workflowQuery: string;
  workflowsLoaded: boolean;
  workflowsError: string | null;
  isLoadingWorkflows: boolean;
  isSavingWorkflow: boolean;
  isOperatingOnWorkflow: boolean;
  workflowEditorMode: "view" | "create" | "edit";
  workflowDraft: WorkflowDraftForm;
  workflowLaunchPreview: WorkflowLaunchPreview | null;
  terminalCommand: string;
  terminalHistory: TerminalCommandResult[];
  terminalError: string | null;
  isRunningTerminalCommand: boolean;
  terminalTabs: TerminalLiveTab[];
  selectedTerminalTabId: string | null;
  terminalThemeStyle: TerminalThemeStyle;
  terminalCustomBackground: string;
  terminalCustomForeground: string;
  workspaceFileBookmarks: WorkspaceFileBookmark[];
  selectedWorkspaceFileId: string;
  fileDocuments: Record<string, FileEditorDocument>;
  fileBrowserPath: string;
  fileBrowserListing: RemoteDirectoryListing | null;
  fileBrowserError: string | null;
  isLoadingFileBrowser: boolean;
  isFileBrowserOpen: boolean;
  usageSummary: UsageSummary | null;
  usageProfileBreakdown: UsageProfileSlice[] | null;
  usageError: string | null;
  isLoadingUsage: boolean;
  skills: SkillSummary[];
  selectedSkillId: string | null;
  selectedSkillDetail: SkillDetail | null;
  skillQuery: string;
  skillsLoaded: boolean;
  skillsError: string | null;
  isLoadingSkills: boolean;
  isLoadingSkillDetail: boolean;
  isSavingSkill: boolean;
  skillEditorMode: "view" | "edit" | "create";
  skillDraftContent: string;
  newSkillPath: string;
  createSkillReferences: boolean;
  createSkillScripts: boolean;
  createSkillTemplates: boolean;
  cronJobs: CronJob[];
  selectedCronJobId: string | null;
  cronQuery: string;
  cronFilter: CronJobFilter;
  cronJobsLoaded: boolean;
  cronJobsError: string | null;
  isLoadingCronJobs: boolean;
  isOperatingOnCronJob: boolean;
  cronEditorMode: CronEditorMode;
  cronDraft: CronJobDraftForm;
  kanbanBoards: KanbanBoardsResponse | null;
  kanbanBoard: KanbanBoard | null;
  selectedKanbanBoardSlug: string;
  selectedKanbanTaskId: string | null;
  selectedKanbanTaskDetail: KanbanTaskDetail | null;
  kanbanQuery: string;
  kanbanLoaded: boolean;
  kanbanError: string | null;
  includeArchivedKanbanTasks: boolean;
  isLoadingKanbanBoards: boolean;
  isLoadingKanbanBoard: boolean;
  isLoadingKanbanTaskDetail: boolean;
  isOperatingOnKanbanTask: boolean;
  isOperatingOnKanbanBoard: boolean;
  isDispatchingKanban: boolean;
  kanbanTaskEditorMode: "view" | "create" | "edit";
  kanbanTaskDraft: KanbanTaskDraftForm;
  kanbanBoardEditorOpen: boolean;
  kanbanBoardDraft: KanbanBoardDraftForm;
  kanbanCommentDraft: string;
  kanbanActionDraft: string;
  kanbanParentIdsDraft: string;
  kanbanChildIdsDraft: string;
  kanbanRecoveryReasonDraft: string;
  kanbanRecoveryAssigneeDraft: string;
  kanbanRecoveryResultDraft: string;
  kanbanRecoverySummaryDraft: string;
  kanbanRecoveryMetadataDraft: string;
  kanbanReclaimBeforeReassign: boolean;
}

type CronJobFilter = "all" | "active" | "paused";
type CronEditorMode = "view" | "create" | "edit";
type TerminalTabStatus = "starting" | "running" | "exited" | "error";
type TerminalThemeStyle = "graphite" | "evergreen" | "dusk" | "paper" | "aubergine" | "porcelain" | "custom";
const designAppThemeOptions = [
  { id: "blue", label: "DarkBlue", title: "Switch to dark blue theme" },
  { id: "outline", label: "Outline", title: "Switch to outline theme" },
] as const;
type DesignAppTheme = (typeof designAppThemeOptions)[number]["id"];
const designAppThemeIds = designAppThemeOptions.map((theme) => theme.id);
type AppTheme = "dark" | "light" | DesignAppTheme;

interface TerminalLiveTab extends TerminalSessionInfo {
  output: string;
  stderrOutput: string;
  status: TerminalTabStatus;
  exitCode: number | null;
  inputDraft: string;
  initialInputSent: boolean;
  lastEventAt: string | null;
}

interface TerminalRenderer {
  terminal: XTerm;
  fitAddon: FitAddon;
  tabId: string;
  container: HTMLElement | null;
  disposeDataHandler: { dispose: () => void };
  writtenLength: number;
  syncedCols: number;
  syncedRows: number;
  resizeObserver?: ResizeObserver;
}

interface CronJobDraftForm {
  name: string;
  prompt: string;
  script: string;
  workdir: string;
  noAgent: boolean;
  schedule: string;
  skillsText: string;
  model: string;
  provider: string;
  baseUrl: string;
  deliver: string;
  timezone: string;
}

interface WorkflowDraftForm {
  name: string;
  prompt: string;
  selectedSkills: WorkflowSkillReference[];
}

interface KanbanTaskDraftForm {
  title: string;
  body: string;
  assignee: string;
  priority: string;
  tenant: string;
  skillsText: string;
  maxRetriesText: string;
  parentIdsText: string;
  startsInTriage: boolean;
}

interface KanbanBoardDraftForm {
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  switchAfterCreate: boolean;
}

interface PersistedAppUiState {
  selectedSection?: SectionId;
  selectedConnectionId?: string | null;
  appTheme?: AppTheme;
  selectedSessionId?: string | null;
  sessionQuery?: string;
  sessionDetailMode?: "transcript" | "chat";
  autoApproveCommands?: boolean;
  selectedWorkflowId?: string | null;
  workflowQuery?: string;
  terminalCommand?: string;
  terminalThemeStyle?: TerminalThemeStyle;
  terminalCustomBackground?: string;
  terminalCustomForeground?: string;
  selectedWorkspaceFileId?: string;
  fileBrowserPath?: string;
  isFileBrowserOpen?: boolean;
  selectedSkillId?: string | null;
  skillQuery?: string;
  selectedCronJobId?: string | null;
  cronQuery?: string;
  cronFilter?: CronJobFilter;
  selectedKanbanBoardSlug?: string;
  selectedKanbanTaskId?: string | null;
  kanbanQuery?: string;
  includeArchivedKanbanTasks?: boolean;
}

const sessionPageSize = 50;
const maxEditableFileBytes = 10 * 1_000_000;
const automaticUpdateCheckIntervalMs = 24 * 60 * 60 * 1000;
const appVersion = packageJson.version;
const persistedUiStateKey = "hermes-desktop:tauri-ui-state:v1";

const emptySnapshot: AppSnapshot = {
  connections: [],
  preferences: {
    activeConnectionId: null,
    appLocale: null,
    automaticallyChecksForUpdates: true,
    lastAutomaticUpdateCheckAt: null,
    pinnedSessions: [],
    workspaceFileBookmarks: [],
    workflows: [],
  },
};

let state: AppState = {
  snapshot: emptySnapshot,
  selectedSection: "connections",
  selectedConnectionId: null,
  overview: null,
  status: null,
  error: null,
  isBusy: false,
  availableUpdate: null,
  updateCheckError: null,
  isCheckingForUpdates: false,
  hasPerformedAutomaticUpdateCheck: false,
  appTheme: "dark",
  editor: null,
  isEditingNewConnection: false,
  sessions: [],
  pinnedSessions: [],
  sessionTotalCount: 0,
  sessionOffset: 0,
  sessionQuery: "",
  selectedSessionId: null,
  sessionMessages: [],
  sessionsLoaded: false,
  isLoadingSessions: false,
  isLoadingSessionDetail: false,
  isSendingSessionMessage: false,
  sessionPrompt: "",
  autoApproveCommands: false,
  sessionDetailMode: "transcript",
  sessionScrollOffsets: {},
  resumeCommand: null,
  resumeStartupCommand: null,
  workflows: [],
  selectedWorkflowId: null,
  workflowQuery: "",
  workflowsLoaded: false,
  workflowsError: null,
  isLoadingWorkflows: false,
  isSavingWorkflow: false,
  isOperatingOnWorkflow: false,
  workflowEditorMode: "view",
  workflowDraft: emptyWorkflowDraft(),
  workflowLaunchPreview: null,
  terminalCommand: "pwd && hermes --version",
  terminalHistory: [],
  terminalError: null,
  isRunningTerminalCommand: false,
  terminalTabs: [],
  selectedTerminalTabId: null,
  terminalThemeStyle: "graphite",
  terminalCustomBackground: "#12161D",
  terminalCustomForeground: "#E7ECF3",
  workspaceFileBookmarks: [],
  selectedWorkspaceFileId: "canonical:memory",
  fileDocuments: {},
  fileBrowserPath: "",
  fileBrowserListing: null,
  fileBrowserError: null,
  isLoadingFileBrowser: false,
  isFileBrowserOpen: false,
  usageSummary: null,
  usageProfileBreakdown: null,
  usageError: null,
  isLoadingUsage: false,
  skills: [],
  selectedSkillId: null,
  selectedSkillDetail: null,
  skillQuery: "",
  skillsLoaded: false,
  skillsError: null,
  isLoadingSkills: false,
  isLoadingSkillDetail: false,
  isSavingSkill: false,
  skillEditorMode: "view",
  skillDraftContent: "",
  newSkillPath: "",
  createSkillReferences: false,
  createSkillScripts: false,
  createSkillTemplates: false,
  cronJobs: [],
  selectedCronJobId: null,
  cronQuery: "",
  cronFilter: "all",
  cronJobsLoaded: false,
  cronJobsError: null,
  isLoadingCronJobs: false,
  isOperatingOnCronJob: false,
  cronEditorMode: "view",
  cronDraft: emptyCronDraft(),
  kanbanBoards: null,
  kanbanBoard: null,
  selectedKanbanBoardSlug: "default",
  selectedKanbanTaskId: null,
  selectedKanbanTaskDetail: null,
  kanbanQuery: "",
  kanbanLoaded: false,
  kanbanError: null,
  includeArchivedKanbanTasks: false,
  isLoadingKanbanBoards: false,
  isLoadingKanbanBoard: false,
  isLoadingKanbanTaskDetail: false,
  isOperatingOnKanbanTask: false,
  isOperatingOnKanbanBoard: false,
  isDispatchingKanban: false,
  kanbanTaskEditorMode: "view",
  kanbanTaskDraft: emptyKanbanTaskDraft(),
  kanbanBoardEditorOpen: false,
  kanbanBoardDraft: emptyKanbanBoardDraft(),
  kanbanCommentDraft: "",
  kanbanActionDraft: "",
  kanbanParentIdsDraft: "",
  kanbanChildIdsDraft: "",
  kanbanRecoveryReasonDraft: "",
  kanbanRecoveryAssigneeDraft: "",
  kanbanRecoveryResultDraft: "",
  kanbanRecoverySummaryDraft: "",
  kanbanRecoveryMetadataDraft: "",
  kanbanReclaimBeforeReassign: true,
};

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (!appRoot) {
  throw new Error("Missing #app root");
}
const app = appRoot;
const terminalRenderers = new Map<string, TerminalRenderer>();

void listen<TerminalSessionEvent>("terminal-session-event", (event) => {
  handleTerminalSessionEvent(event.payload);
});

window.addEventListener("resize", () => {
  const tab = selectedTerminalTab();
  const renderer = tab ? terminalRenderers.get(tab.id) : null;
  if (!renderer) {
    return;
  }
  fitAndSyncTerminalSize(renderer);
});

window.addEventListener("keydown", (event) => {
  void handleGlobalShortcut(event);
});

void boot();

async function boot() {
  setBusy(true, t("Loading workspace"));
  try {
    const snapshot = await appSnapshot();
    const persistedUiState = loadPersistedUiState();
    const selectedConnectionId = restoredSelectedConnectionId(snapshot, persistedUiState);
    const selectedConnection = selectedConnectionId
      ? snapshot.connections.find((connection) => connection.id === selectedConnectionId)
      : null;
    setLocale(snapshot.preferences.appLocale ?? browserLocale());
    state = {
      ...state,
      snapshot,
      selectedConnectionId,
      selectedSection: restoredSelectedSection(snapshot, persistedUiState),
      editor: selectedConnection ?? snapshot.connections[0] ?? newConnection(),
      isEditingNewConnection: snapshot.connections.length === 0,
      workspaceFileBookmarks: snapshot.preferences.workspaceFileBookmarks ?? [],
      ...restoredUiStatePatch(persistedUiState),
      error: null,
    };
    render();

    const active = activeConnection();
    if (active) {
      await refreshPinnedSessions(active);
      await refreshWorkspaceFileBookmarks(active);
      await refreshOverview(active);
    } else {
      state = { ...state, status: null };
    }
    void checkForUpdatesAtLaunch();
  } catch (error) {
    setError(error);
  } finally {
    setBusy(false);
  }
}

function render() {
  applyAppTheme();
  const active = activeConnection();
  const visibleSections = active ? sections : sections.filter((section) => section.id === "connections");
  const nextTheme: AppTheme = state.appTheme === "light" ? "dark" : "light";
  const isDesignTheme = isDesignAppTheme(state.appTheme);
  const nextDesignTheme = nextDesignAppTheme(state.appTheme);
  const designThemeTitle = nextDesignTheme === "dark" ? "Switch to dark mode" : designAppThemeTitle(nextDesignTheme);
  const designThemeLabel = isDesignTheme ? designAppThemeLabel(state.appTheme) : designAppThemeLabel(nextDesignTheme);

  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">H</div>
          <div>
            <strong>Hermes Desktop</strong>
            <span>Tauri Preview</span>
          </div>
        </div>

        ${active ? workspaceCard(active) : `<div class="empty-workspace">No active Hermes host</div>`}

        <nav class="nav-list" aria-label="Sections">
          ${visibleSections
            .map(
              (section) => `
                <button class="nav-item ${state.selectedSection === section.id ? "active" : ""}" data-section="${section.id}">
                  <span class="nav-icon">${icon(section.icon)}</span>
                  <span>${section.title}</span>
                </button>
              `,
            )
            .join("")}
        </nav>
      </aside>

      <main class="content">
        <header class="topbar">
          <div>
            <h1>${escapeHtml(sectionTitle(state.selectedSection))}</h1>
            <p>${escapeHtml(active ? activeDestination(active) : "Create or select an SSH profile to start.")}</p>
          </div>
          <div class="topbar-actions">
            <select class="locale-select" data-locale-select title="Language" aria-label="Language">
              ${localeOptions()}
            </select>
            <button class="secondary-button theme-toggle" data-action="toggle-theme" title="${state.appTheme === "light" ? "Switch to dark mode" : "Switch to light mode"}" aria-label="${state.appTheme === "light" ? "Switch to dark mode" : "Switch to light mode"}">
              ${icon(state.appTheme === "light" ? "moon" : "sun")}<span>${nextTheme === "light" ? "Light" : "Dark"}</span>
            </button>
            <button class="secondary-button theme-toggle design-theme-toggle ${isDesignTheme ? "active" : ""}" data-action="cycle-design-theme" title="${escapeAttribute(designThemeTitle)}" aria-label="${escapeAttribute(designThemeTitle)}" aria-pressed="${isDesignTheme ? "true" : "false"}">
              ${icon("brush")}<span>${escapeHtml(designThemeLabel)}</span>
            </button>
            <button class="secondary-button" data-action="check-updates" title="Check for updates" ${state.isCheckingForUpdates ? "disabled" : ""}>${icon("refresh")}<span>${state.isCheckingForUpdates ? "Checking" : "Updates"}</span></button>
            ${
              active
                ? `<button class="icon-button" data-action="refresh" title="Refresh">${icon("refresh")}</button>`
                : ""
            }
            <button class="primary-button" data-action="new-connection">${icon("plus")}<span>Connection</span></button>
          </div>
        </header>

        ${state.error ? appBanner(state.error, "error", "clear-error") : ""}
        ${state.updateCheckError ? appBanner(state.updateCheckError, "error", "clear-update-error") : ""}
        ${state.status ? appBanner(state.status, "status", "clear-status") : ""}
        ${state.availableUpdate ? updateBanner(state.availableUpdate) : ""}

        <section class="section-body">
          ${activeContent()}
        </section>
      </main>
    </div>
  `;

  localizeElement(app);
  bindEvents();
  mountTerminalRenderer();
  savePersistedUiState();
}

function loadPersistedUiState(): PersistedAppUiState {
  try {
    const raw = window.localStorage.getItem(persistedUiStateKey);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return isPlainRecord(parsed) ? sanitizePersistedUiState(parsed) : {};
  } catch {
    return {};
  }
}

function savePersistedUiState() {
  try {
    window.localStorage.setItem(persistedUiStateKey, JSON.stringify(persistedUiStateFromState()));
  } catch {
    // UI state persistence is a convenience; storage failures should not interrupt the app.
  }
}

function persistedUiStateFromState(): PersistedAppUiState {
  return {
    selectedSection: state.selectedSection,
    selectedConnectionId: state.selectedConnectionId,
    appTheme: state.appTheme,
    selectedSessionId: state.selectedSessionId,
    sessionQuery: state.sessionQuery,
    sessionDetailMode: state.sessionDetailMode,
    autoApproveCommands: state.autoApproveCommands,
    selectedWorkflowId: state.selectedWorkflowId,
    workflowQuery: state.workflowQuery,
    terminalCommand: state.terminalCommand,
    terminalThemeStyle: state.terminalThemeStyle,
    terminalCustomBackground: state.terminalCustomBackground,
    terminalCustomForeground: state.terminalCustomForeground,
    selectedWorkspaceFileId: state.selectedWorkspaceFileId,
    fileBrowserPath: state.fileBrowserPath,
    isFileBrowserOpen: state.isFileBrowserOpen,
    selectedSkillId: state.selectedSkillId,
    skillQuery: state.skillQuery,
    selectedCronJobId: state.selectedCronJobId,
    cronQuery: state.cronQuery,
    cronFilter: state.cronFilter,
    selectedKanbanBoardSlug: state.selectedKanbanBoardSlug,
    selectedKanbanTaskId: state.selectedKanbanTaskId,
    kanbanQuery: state.kanbanQuery,
    includeArchivedKanbanTasks: state.includeArchivedKanbanTasks,
  };
}

function restoredSelectedConnectionId(snapshot: AppSnapshot, persisted: PersistedAppUiState) {
  const persistedConnectionId = existingConnectionId(snapshot, persisted.selectedConnectionId);
  if (persistedConnectionId) {
    return persistedConnectionId;
  }
  const activeConnectionId = existingConnectionId(snapshot, snapshot.preferences.activeConnectionId);
  if (activeConnectionId) {
    return activeConnectionId;
  }
  return snapshot.connections[0]?.id ?? null;
}

function restoredSelectedSection(snapshot: AppSnapshot, persisted: PersistedAppUiState): SectionId {
  const activeConnectionId = existingConnectionId(snapshot, snapshot.preferences.activeConnectionId);
  if (!activeConnectionId) {
    return "connections";
  }
  return persisted.selectedSection ?? "overview";
}

function restoredUiStatePatch(persisted: PersistedAppUiState): Partial<AppState> {
  return {
    sessionQuery: persisted.sessionQuery ?? "",
    selectedSessionId: persisted.selectedSessionId ?? null,
    sessionDetailMode: persisted.sessionDetailMode ?? "transcript",
    autoApproveCommands: persisted.autoApproveCommands ?? false,
    appTheme: persisted.appTheme ?? "dark",
    selectedWorkflowId: persisted.selectedWorkflowId ?? null,
    workflowQuery: persisted.workflowQuery ?? "",
    terminalCommand: persisted.terminalCommand ?? "pwd && hermes --version",
    terminalThemeStyle: persisted.terminalThemeStyle ?? "graphite",
    terminalCustomBackground: persisted.terminalCustomBackground ?? "#12161D",
    terminalCustomForeground: persisted.terminalCustomForeground ?? "#E7ECF3",
    selectedWorkspaceFileId: persisted.selectedWorkspaceFileId ?? "canonical:memory",
    fileBrowserPath: persisted.fileBrowserPath ?? "",
    isFileBrowserOpen: persisted.isFileBrowserOpen ?? false,
    selectedSkillId: persisted.selectedSkillId ?? null,
    skillQuery: persisted.skillQuery ?? "",
    selectedCronJobId: persisted.selectedCronJobId ?? null,
    cronQuery: persisted.cronQuery ?? "",
    cronFilter: persisted.cronFilter ?? "all",
    selectedKanbanBoardSlug: persisted.selectedKanbanBoardSlug ?? "default",
    selectedKanbanTaskId: persisted.selectedKanbanTaskId ?? null,
    kanbanQuery: persisted.kanbanQuery ?? "",
    includeArchivedKanbanTasks: persisted.includeArchivedKanbanTasks ?? false,
  };
}

function sanitizePersistedUiState(record: Record<string, unknown>): PersistedAppUiState {
  return {
    selectedSection: sectionIdValue(record.selectedSection),
    selectedConnectionId: nullableStringValue(record.selectedConnectionId),
    appTheme: appThemeValue(record.appTheme),
    selectedSessionId: nullableStringValue(record.selectedSessionId),
    sessionQuery: stringValue(record.sessionQuery),
    sessionDetailMode: record.sessionDetailMode === "chat" ? "chat" : record.sessionDetailMode === "transcript" ? "transcript" : undefined,
    autoApproveCommands: booleanValue(record.autoApproveCommands),
    selectedWorkflowId: nullableStringValue(record.selectedWorkflowId),
    workflowQuery: stringValue(record.workflowQuery),
    terminalCommand: stringValue(record.terminalCommand),
    terminalThemeStyle: terminalThemeStyleValue(record.terminalThemeStyle),
    terminalCustomBackground: colorValue(record.terminalCustomBackground),
    terminalCustomForeground: colorValue(record.terminalCustomForeground),
    selectedWorkspaceFileId: stringValue(record.selectedWorkspaceFileId),
    fileBrowserPath: stringValue(record.fileBrowserPath),
    isFileBrowserOpen: booleanValue(record.isFileBrowserOpen),
    selectedSkillId: nullableStringValue(record.selectedSkillId),
    skillQuery: stringValue(record.skillQuery),
    selectedCronJobId: nullableStringValue(record.selectedCronJobId),
    cronQuery: stringValue(record.cronQuery),
    cronFilter: cronFilterValue(record.cronFilter),
    selectedKanbanBoardSlug: stringValue(record.selectedKanbanBoardSlug),
    selectedKanbanTaskId: nullableStringValue(record.selectedKanbanTaskId),
    kanbanQuery: stringValue(record.kanbanQuery),
    includeArchivedKanbanTasks: booleanValue(record.includeArchivedKanbanTasks),
  };
}

function existingConnectionId(snapshot: AppSnapshot, value: string | null | undefined) {
  return value && snapshot.connections.some((connection) => connection.id === value) ? value : null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function nullableStringValue(value: unknown) {
  if (value === null) {
    return null;
  }
  return stringValue(value);
}

function stringValue(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }
  return value.slice(0, 4000);
}

function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function sectionIdValue(value: unknown): SectionId | undefined {
  return typeof value === "string" && sections.some((section) => section.id === value) ? value as SectionId : undefined;
}

function cronFilterValue(value: unknown): CronJobFilter | undefined {
  return value === "all" || value === "active" || value === "paused" ? value : undefined;
}

function terminalThemeStyleValue(value: unknown): TerminalThemeStyle | undefined {
  return value === "graphite" ||
    value === "evergreen" ||
    value === "dusk" ||
    value === "paper" ||
    value === "aubergine" ||
    value === "porcelain" ||
    value === "custom"
    ? value
    : undefined;
}

function appThemeValue(value: unknown): AppTheme | undefined {
  if (value === "dark" || value === "light" || isDesignAppTheme(value)) {
    return value;
  }
  return undefined;
}

function applyAppTheme() {
  document.documentElement.dataset.theme = state.appTheme;
}

function isDesignAppTheme(value: unknown): value is DesignAppTheme {
  return typeof value === "string" && designAppThemeIds.includes(value as DesignAppTheme);
}

function nextDesignAppTheme(currentTheme: AppTheme): AppTheme {
  if (!isDesignAppTheme(currentTheme)) {
    return designAppThemeIds[0];
  }
  const currentIndex = designAppThemeIds.indexOf(currentTheme);
  return designAppThemeIds[currentIndex + 1] ?? "dark";
}

function designAppThemeLabel(theme: AppTheme) {
  return designAppThemeOption(theme)?.label ?? designAppThemeOptions[0].label;
}

function designAppThemeTitle(theme: AppTheme) {
  return designAppThemeOption(theme)?.title ?? designAppThemeOptions[0].title;
}

function designAppThemeOption(theme: AppTheme) {
  if (!isDesignAppTheme(theme)) {
    return null;
  }
  return designAppThemeOptions.find((option) => option.id === theme) ?? null;
}

function colorValue(value: unknown) {
  const color = stringValue(value);
  return color && /^#[0-9a-f]{3,8}$/i.test(color) ? color : undefined;
}

function workspaceCard(connection: ConnectionProfile) {
  const profileName = connection.customHermesHomePath
    ? lastPathComponent(connection.customHermesHomePath)
    : connection.hermesProfile || "default";
  return `
    <section class="workspace-card">
      <span>Hermes Profile</span>
      <strong>${escapeHtml(profileName)}</strong>
      <small>${escapeHtml(connection.label)}</small>
      <small>${escapeHtml(activeDestination(connection))}</small>
    </section>
  `;
}

function updateBanner(update: AvailableUpdate) {
  return `
    <section class="update-banner">
      <div class="update-banner-main">
        <strong>Hermes Desktop ${escapeHtml(update.latestVersion)} is available</strong>
        <span>You are running ${escapeHtml(update.currentVersion)}. ${escapeHtml(update.resolvedName)}</span>
        ${
          update.releaseNotesPreview
            ? `<pre>${escapeHtml(update.releaseNotesPreview)}</pre>`
            : `<span>Open the GitHub release to download the latest Hermes Desktop build.</span>`
        }
      </div>
      <div class="update-banner-actions">
        <label class="checkbox-label compact"><input type="checkbox" data-auto-update-checks ${state.snapshot.preferences.automaticallyChecksForUpdates ? "checked" : ""} /><span>Auto checks</span></label>
        <button class="primary-button" data-action="open-update-release">${icon("link")}<span>Open Release</span></button>
        <button class="secondary-button" data-action="dismiss-update">${icon("undo")}<span>${t("Dismiss")}</span></button>
      </div>
    </section>
  `;
}

function appBanner(message: string, kind: "error" | "status", dismissAction: string) {
  const className = kind === "error" ? "banner error" : "banner";
  const role = kind === "error" ? "alert" : "status";
  return `
    <div class="${className}" role="${role}">
      <span>${escapeHtml(message)}</span>
      <button class="icon-button small" data-action="${dismissAction}" title="${t("Dismiss")}" aria-label="${t("Dismiss")}">${icon("close")}</button>
    </div>
  `;
}

function localeOptions() {
  const selected = currentLocale();
  return appLocales
    .map((locale) => `<option value="${locale.id}" ${locale.id === selected ? "selected" : ""}>${escapeHtml(locale.label)}</option>`)
    .join("");
}

function activeContent() {
  switch (state.selectedSection) {
    case "connections":
      return connectionsView();
    case "overview":
      return overviewView();
    case "sessions":
      return sessionsView();
    case "workflows":
      return workflowsView();
    case "files":
      return filesView();
    case "usage":
      return usageView();
    case "skills":
      return skillsView();
    case "cronjobs":
      return cronJobsView();
    case "kanban":
      return kanbanView();
    case "terminal":
      return terminalView();
    default:
      return placeholderView(state.selectedSection);
  }
}

function connectionsView() {
  return `
    <div class="connections-layout">
      <section class="list-panel">
        <div class="panel-heading">
          <h2>Saved Hosts</h2>
          <button class="icon-button small" data-action="new-connection" title="New connection">${icon("plus")}</button>
        </div>
        <div class="connection-list">
          ${
            state.snapshot.connections.length === 0
              ? `<div class="empty-state">No connections saved yet.</div>`
              : state.snapshot.connections
                  .map(
                    (connection) => `
                      <button class="connection-row ${connection.id === state.selectedConnectionId ? "active" : ""}" data-connection="${connection.id}">
                        <strong>${escapeHtml(connection.label)}</strong>
                        <span>${escapeHtml(activeDestination(connection))}</span>
                      </button>
                    `,
                  )
                  .join("")
          }
        </div>
      </section>

      <section class="detail-panel">
        ${connectionEditor()}
      </section>
    </div>
  `;
}

function connectionEditor() {
  const profile = state.editor ?? newConnection();
  return `
    <form class="connection-form">
      <div class="panel-heading">
        <h2>${state.isEditingNewConnection ? "New Connection" : "Connection"}</h2>
        ${
          !state.isEditingNewConnection
            ? `<button class="danger-button" type="button" data-action="delete-connection">${icon("trash")}<span>Delete</span></button>`
            : ""
        }
      </div>

      <label>
        <span>Name</span>
        <input name="label" value="${escapeAttribute(profile.label)}" autocomplete="off" required />
      </label>

      <div class="form-grid">
        <label>
          <span>SSH alias</span>
          <input name="sshAlias" value="${escapeAttribute(profile.sshAlias)}" autocomplete="off" />
        </label>
        <label>
          <span>Host or IP</span>
          <input name="sshHost" value="${escapeAttribute(profile.sshHost)}" autocomplete="off" />
        </label>
      </div>

      <div class="form-grid">
        <label>
          <span>User</span>
          <input name="sshUser" value="${escapeAttribute(profile.sshUser)}" autocomplete="username" />
        </label>
        <label>
          <span>Port</span>
          <input name="sshPort" value="${escapeAttribute(profile.sshPort?.toString() ?? "")}" inputmode="numeric" />
        </label>
      </div>

      <div class="form-grid">
        <label>
          <span>Hermes profile</span>
          <input name="hermesProfile" value="${escapeAttribute(profile.hermesProfile ?? "")}" placeholder="default" autocomplete="off" />
        </label>
        <label>
          <span>Custom Hermes home</span>
          <input name="customHermesHomePath" value="${escapeAttribute(profile.customHermesHomePath ?? "")}" placeholder="~/.hermes" autocomplete="off" />
        </label>
      </div>

      <div class="form-actions">
        <button class="secondary-button" type="button" data-action="test-editor" ${state.isBusy ? "disabled" : ""}>${icon("activity")}<span>Test</span></button>
        <button class="primary-button" type="submit" ${state.isBusy ? "disabled" : ""}>${icon("save")}<span>Save</span></button>
        ${
          !state.isEditingNewConnection
            ? `<button class="secondary-button" type="button" data-action="use-connection" ${state.isBusy ? "disabled" : ""}>${icon("check")}<span>Use Host</span></button>`
            : ""
        }
      </div>
    </form>
  `;
}

function overviewView() {
  const active = activeConnection();
  if (!active) {
    return `<div class="empty-state">Select a connection first.</div>`;
  }
  if (!state.overview) {
    return `
      <div class="empty-state large">
        <strong>No remote discovery loaded</strong>
        <button class="primary-button" data-action="refresh">${icon("refresh")}<span>Discover Host</span></button>
      </div>
    `;
  }

  const overview = state.overview;
  return `
    <div class="overview-grid">
      <section class="summary-panel">
        <h2>Remote Workspace</h2>
        <dl>
          <div><dt>Home</dt><dd>${escapeHtml(overview.remote_home)}</dd></div>
          <div><dt>Hermes Home</dt><dd>${escapeHtml(overview.hermes_home)}</dd></div>
          <div><dt>Active Profile</dt><dd>${escapeHtml(overview.active_profile.name)}</dd></div>
          <div><dt>Session Store</dt><dd>${escapeHtml(overview.session_store?.path ?? "Not found")}</dd></div>
        </dl>
      </section>

      <section class="summary-panel">
        <h2>Tracked Files</h2>
        ${pathStatus("USER.md", overview.paths.user, overview.exists.user)}
        ${pathStatus("MEMORY.md", overview.paths.memory, overview.exists.memory)}
        ${pathStatus("SOUL.md", overview.paths.soul, overview.exists.soul)}
        ${pathStatus("Cron jobs", overview.paths.cron_jobs, overview.exists.cron_jobs)}
      </section>

      <section class="summary-panel">
        <h2>Profiles</h2>
        <div class="profile-list">
          ${overview.available_profiles
            .map(
              (profile) => `
                <div class="profile-row">
                  <strong>${escapeHtml(profile.name)}</strong>
                  <span>${escapeHtml(profile.path)}</span>
                  <em>${profile.exists ? "available" : "missing"}</em>
                </div>
              `,
            )
            .join("")}
        </div>
      </section>

      <section class="summary-panel">
        <h2>Kanban</h2>
        ${kanbanStatus(overview)}
      </section>
    </div>
  `;
}

function sessionsView() {
  const selected = selectedSession();
  const hasMore = state.sessions.length < state.sessionTotalCount;
  const pinned = pinnedSessionSummaries();
  const unpinned = state.sessions.filter((session) => !isSessionPinned(session.id));
  return `
    <div class="sessions-layout">
      <section class="list-panel sessions-list-panel">
        <form class="session-search" data-session-search>
          <input name="sessionQuery" value="${escapeAttribute(state.sessionQuery)}" placeholder="Search sessions" autocomplete="off" />
          <button class="secondary-button" type="submit" ${state.isLoadingSessions ? "disabled" : ""}>${icon("search")}<span>Search</span></button>
        </form>

        <div class="panel-heading session-count-row">
          <h2>${state.sessionTotalCount ? `${state.sessions.length} of ${state.sessionTotalCount}` : "Sessions"}</h2>
          <div class="form-actions">
            <button class="primary-button" data-action="new-session-chat" ${state.isSendingSessionMessage ? "disabled" : ""}>${icon("terminal")}<span>${t("New Chat")}</span></button>
            <button class="icon-button small" data-action="reload-sessions" title="Reload sessions" ${state.isLoadingSessions ? "disabled" : ""}>${icon("refresh")}</button>
          </div>
        </div>

        <div class="session-list">
          ${
            state.isLoadingSessions && state.sessions.length === 0 && pinned.length === 0
              ? `<div class="empty-state">Loading sessions...</div>`
              : state.sessions.length === 0 && pinned.length === 0
                ? `<div class="empty-state">No sessions loaded.</div>`
                : `${pinned.length ? `<div class="session-group-label">Pinned</div>${pinned.map(sessionRow).join("")}` : ""}${unpinned.length ? `<div class="session-group-label">Recent</div>${unpinned.map(sessionRow).join("")}` : ""}`
          }
        </div>

        ${
          hasMore
            ? `<button class="secondary-button load-more" data-action="load-more-sessions" ${state.isLoadingSessions ? "disabled" : ""}>${icon("plus")}<span>Load More</span></button>`
            : ""
        }
      </section>

      <section class="detail-panel session-detail-panel">
        ${
          selected
            ? sessionDetailView(selected)
            : `<div class="empty-state large"><strong>Select a session</strong><span>Choose a session from the list to inspect its transcript.</span></div>`
        }
      </section>
    </div>
  `;
}

function sessionRow(session: SessionSummary) {
  const title = resolvedSessionTitle(session);
  const isActive = session.id === state.selectedSessionId;
  const dateText = formatTimestamp(session.last_active ?? session.started_at);
  const model = displayModel(session.model);
  const match = session.search_match?.snippet;
  return `
    <button class="session-row ${isActive ? "active" : ""}" data-session="${escapeAttribute(session.id)}">
      <span class="session-row-main">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(dateText || session.id)}</span>
      </span>
      <span class="session-row-meta">
        ${model ? `<em>${escapeHtml(model)}</em>` : ""}
        ${typeof session.message_count === "number" ? `<em>${session.message_count} messages</em>` : ""}
      </span>
      ${
        match
          ? `<span class="session-match">${escapeHtml(match)}</span>`
          : session.preview
            ? `<span class="session-preview">${escapeHtml(session.preview)}</span>`
            : ""
      }
    </button>
  `;
}

function sessionDetailView(session: SessionSummary) {
  const isPinned = isSessionPinned(session.id);
  return `
    <div class="session-detail-header">
      <div>
        <h2>${escapeHtml(resolvedSessionTitle(session))}</h2>
        <p>${escapeHtml(session.id)}</p>
      </div>
      <div class="form-actions">
        <button class="secondary-button" data-action="toggle-session-pin">${icon(isPinned ? "pinOff" : "pin")}<span>${isPinned ? "Unpin" : "Pin"}</span></button>
        <button class="secondary-button" data-action="show-resume-command">${icon("terminal")}<span>Resume</span></button>
        <button class="primary-button" data-action="resume-session-terminal">${icon("terminal")}<span>Open Terminal</span></button>
        <button class="secondary-button" data-action="reload-session-detail" ${state.isLoadingSessionDetail ? "disabled" : ""}>${icon("refresh")}<span>Reload</span></button>
        <button class="danger-button" data-action="delete-session" ${state.isBusy ? "disabled" : ""}>${icon("trash")}<span>Delete</span></button>
      </div>
    </div>

    <div class="mode-tabs">
      <button class="${state.sessionDetailMode === "transcript" ? "active" : ""}" data-session-mode="transcript">Transcript</button>
      <button class="${state.sessionDetailMode === "chat" ? "active" : ""}" data-session-mode="chat">Chat</button>
    </div>

    <div class="session-detail-meta">
      ${session.model ? `<span>${escapeHtml(session.model)}</span>` : ""}
      ${formatTimestamp(session.started_at) ? `<span>Started ${escapeHtml(formatTimestamp(session.started_at))}</span>` : ""}
      ${formatTimestamp(session.last_active) ? `<span>Active ${escapeHtml(formatTimestamp(session.last_active))}</span>` : ""}
      ${typeof session.message_count === "number" ? `<span>${session.message_count} messages</span>` : ""}
    </div>

    ${resumeCommandView()}

    ${
      state.sessionDetailMode === "chat"
        ? chatComposerView()
        : ""
    }

    <div class="message-list">
      ${
        state.isLoadingSessionDetail && state.sessionMessages.length === 0
          ? `<div class="empty-state">Loading transcript...</div>`
          : state.sessionMessages.length === 0
            ? `<div class="empty-state">No transcript messages found.</div>`
            : state.sessionMessages.map(messageView).join("")
      }
    </div>
  `;
}

function resumeCommandView() {
  if (!state.resumeCommand) {
    return "";
  }
  return `
    <div class="resume-command">
      <strong>Terminal resume command</strong>
      <code>${escapeHtml(state.resumeCommand)}</code>
      ${state.resumeStartupCommand ? `<details><summary>SSH startup command</summary><pre>${escapeHtml(state.resumeStartupCommand)}</pre></details>` : ""}
    </div>
  `;
}

function chatComposerView() {
  return `
    <form class="chat-composer" data-chat-composer>
      <textarea name="prompt" rows="4" placeholder="Send a prompt to this Hermes session" ${state.isSendingSessionMessage ? "disabled" : ""}>${escapeHtml(state.sessionPrompt)}</textarea>
      <div class="chat-composer-actions">
        <label class="checkbox-label">
          <input type="checkbox" name="autoApproveCommands" ${state.autoApproveCommands ? "checked" : ""} ${state.isSendingSessionMessage ? "disabled" : ""} />
          <span>Auto-approve commands</span>
        </label>
        <button class="primary-button" type="submit" ${state.isSendingSessionMessage ? "disabled" : ""}>${icon("send")}<span>${state.isSendingSessionMessage ? "Sending" : "Send"}</span></button>
      </div>
    </form>
  `;
}

function messageView(message: SessionMessage) {
  const role = normalizeRole(message.role);
  const timestamp = formatTimestamp(message.timestamp);
  const metadata = metadataPreview(message.metadata);
  return `
    <article class="message-card ${role.className}">
      <header>
        <strong>${escapeHtml(role.title)}</strong>
        ${timestamp ? `<span>${escapeHtml(timestamp)}</span>` : ""}
      </header>
      <pre>${escapeHtml(stripTerminalArtifacts(message.content ?? ""))}</pre>
      ${metadata ? `<details><summary>Metadata</summary><pre>${escapeHtml(metadata)}</pre></details>` : ""}
    </article>
  `;
}

function workflowsView() {
  const filtered = filteredWorkflows();
  const selected = selectedWorkflow();
  const workflowListTitle = state.workflows.length
    ? tf("Saved Workflows (%@ of %@)", filtered.length, state.workflows.length)
    : t("Saved Workflows");
  return `
    <div class="workflows-layout">
      <section class="list-panel workflows-list-panel">
        <form class="workflow-search" data-workflow-search>
          <input name="workflowQuery" value="${escapeAttribute(state.workflowQuery)}" placeholder="${escapeAttribute(t("Search workflows"))}" autocomplete="off" />
          <button class="secondary-button" type="submit" ${state.isLoadingWorkflows ? "disabled" : ""}>${icon("search")}<span>${t("Search")}</span></button>
        </form>

        <div class="panel-heading">
          <h2>${escapeHtml(workflowListTitle)}</h2>
          <div class="form-actions">
            <button class="icon-button small" data-action="reload-workflows" title="${escapeAttribute(t("Refresh Workflows"))}" ${state.isLoadingWorkflows ? "disabled" : ""}>${icon("refresh")}</button>
            <button class="icon-button small" data-action="new-workflow" title="${escapeAttribute(t("New Workflow"))}">${icon("plus")}</button>
          </div>
        </div>

        ${state.workflowsError ? `<div class="banner error">${escapeHtml(state.workflowsError)}</div>` : ""}

        <div class="workflow-list">
          ${
            state.isLoadingWorkflows && state.workflows.length === 0
              ? `<div class="empty-state">${t("Loading workflows...")}</div>`
              : filtered.length === 0
                ? `<div class="empty-state">${state.workflowQuery ? t("No matching workflows.") : t("No workflows saved.")}</div>`
                : filtered.map(workflowRow).join("")
          }
        </div>
      </section>

      <section class="detail-panel workflow-detail-panel">
        ${
          state.workflowEditorMode === "create" || state.workflowEditorMode === "edit"
            ? workflowEditorView()
            : selected
              ? workflowDetailView(selected)
              : `<div class="empty-state large"><strong>${t("Select a workflow")}</strong><span>${t("Choose a preset or create a new one for this host/profile.")}</span></div>`
        }
      </section>
    </div>
  `;
}

function workflowRow(workflow: WorkflowPreset) {
  const active = workflow.id === state.selectedWorkflowId;
  const missing = workflowMissingSkillRefs(workflow);
  return `
    <button class="workflow-row ${active ? "active" : ""}" data-workflow="${escapeAttribute(workflow.id)}">
      <span class="workflow-row-main">
        <strong>${escapeHtml(workflow.name)}</strong>
        <em class="${missing.length ? "warning" : "active"}">${missing.length ? t("Missing skills") : t("Runnable")}</em>
      </span>
      <small>${escapeHtml(workflowPromptPreview(workflow.prompt))}</small>
      <span class="workflow-row-meta">
        <em>${escapeHtml(tf("%@ skills", workflow.assignedSkills.length))}</em>
        ${workflow.assignedSkills.slice(0, 2).map((skill) => `<em>${escapeHtml(workflowSkillName(skill))}</em>`).join("")}
        ${workflow.assignedSkills.length > 2 ? `<em>+${workflow.assignedSkills.length - 2}</em>` : ""}
      </span>
    </button>
  `;
}

function workflowDetailView(workflow: WorkflowPreset) {
  const resolved = workflowResolvedSkillRefs(workflow);
  const missing = workflowMissingSkillRefs(workflow);
  return `
    <div class="workflow-detail-header">
      <div>
        <h2>${escapeHtml(workflow.name)}</h2>
        <p>${escapeHtml(workflow.id)}</p>
      </div>
      <div class="form-actions">
        <button class="primary-button" data-action="preview-workflow-launch" ${missing.length || state.isOperatingOnWorkflow ? "disabled" : ""}>${icon("terminal")}<span>${t("Launch Command")}</span></button>
        <button class="primary-button" data-action="launch-workflow-terminal" ${missing.length || state.isOperatingOnWorkflow ? "disabled" : ""}>${icon("terminal")}<span>${t("Run Terminal")}</span></button>
        <button class="primary-button" data-action="launch-workflow-chat" ${missing.length || state.isOperatingOnWorkflow ? "disabled" : ""}>${icon("chat")}<span>${t("Run Chat")}</span></button>
        <button class="secondary-button" data-action="edit-workflow">${icon("save")}<span>${t("Edit")}</span></button>
        <button class="danger-button" data-action="delete-workflow">${icon("trash")}<span>${t("Remove")}</span></button>
      </div>
    </div>

    ${missing.length ? `<div class="banner">${escapeHtml(tf("This workflow references skills that are unavailable on the active host/profile: %@", missing.map((skill) => skill.relativePath).join(", ")))}</div>` : ""}
    ${state.skillsError && state.skills.length === 0 ? `<div class="banner">${escapeHtml(state.skillsError)}</div>` : ""}

    <section class="summary-panel workflow-panel">
      <h2>${t("Prompt")}</h2>
      <pre class="cron-pre">${escapeHtml(workflow.prompt)}</pre>
    </section>

    <section class="summary-panel workflow-panel">
      <h2>${t("Assigned Skills")}</h2>
      ${
        workflow.assignedSkills.length
          ? `<div class="workflow-skill-list">
              ${resolved.map((skill) => workflowSkillItem(skill, "Available")).join("")}
              ${missing.map((skill) => workflowSkillItem(skill, "Missing")).join("")}
            </div>`
          : `<div class="empty-state">${t("No skills assigned.")}</div>`
      }
    </section>

    ${workflowLaunchPreviewView()}
  `;
}

function workflowLaunchPreviewView() {
  const preview = state.workflowLaunchPreview;
  if (!preview) {
    return "";
  }
  return `
    <section class="summary-panel workflow-panel">
      <h2>${t("Terminal Launch Command")}</h2>
      <pre class="cron-pre">${escapeHtml(preview.commandLine)}</pre>
      <h2>${t("Terminal Initial Input")}</h2>
      <pre class="cron-pre">${escapeHtml(preview.initialInput || t("(empty)"))}</pre>
      <details>
        <summary>${t("Terminal SSH startup command")}</summary>
        <pre class="cron-pre">${escapeHtml(preview.startupCommandLine)}</pre>
      </details>
      <h2>${t("Chat Launch Command")}</h2>
      <pre class="cron-pre">${escapeHtml(preview.chatCommandLine)}</pre>
      <h2>${t("Chat Initial Input")}</h2>
      <pre class="cron-pre">${escapeHtml(preview.chatInitialInput || t("(empty)"))}</pre>
      <details>
        <summary>${t("Chat SSH startup command")}</summary>
        <pre class="cron-pre">${escapeHtml(preview.chatStartupCommandLine)}</pre>
      </details>
    </section>
  `;
}

function workflowEditorView() {
  const isCreate = state.workflowEditorMode === "create";
  const draft = state.workflowDraft;
  const missing = workflowDraftMissingSkillRefs(draft);
  return `
    <form class="workflow-form" data-workflow-editor>
      <div class="workflow-detail-header">
        <div>
          <h2>${isCreate ? t("New Workflow") : t("Edit Workflow")}</h2>
          <p>${t("Local preset for the active host/profile")}</p>
        </div>
        <div class="form-actions">
          <button class="secondary-button" type="button" data-action="cancel-workflow-edit" ${state.isSavingWorkflow ? "disabled" : ""}>${icon("undo")}<span>${t("Cancel")}</span></button>
          <button class="primary-button" type="submit" ${state.isSavingWorkflow ? "disabled" : ""}>${icon("save")}<span>${isCreate ? t("Create") : t("Save")}</span></button>
        </div>
      </div>

      <section class="summary-panel workflow-panel">
        <h2>${t("Workflow Details")}</h2>
        <label><span>${t("Name")}</span><input name="name" value="${escapeAttribute(draft.name)}" placeholder="${escapeAttribute(t("Nightly release audit"))}" autocomplete="off" /></label>
        <label><span>${t("Prompt")}</span><textarea name="prompt" rows="10">${escapeHtml(draft.prompt)}</textarea></label>
      </section>

      <section class="summary-panel workflow-panel">
        <h2>${t("Assigned Skills")}</h2>
        ${
          state.isLoadingSkills && state.skills.length === 0
            ? `<div class="empty-state">${t("Loading skills...")}</div>`
            : state.skills.length === 0
              ? `<div class="empty-state">${escapeHtml(state.skillsError ?? t("No discovered skills available."))}</div>`
              : `<div class="workflow-skill-picker">${state.skills.map(workflowSkillToggle).join("")}</div>`
        }
        ${
          missing.length
            ? `<div class="workflow-missing-list">
                ${missing.map((skill) => `
                  <div class="workflow-missing-row">
                    <span><strong>${escapeHtml(workflowSkillName(skill))}</strong><small>${escapeHtml(skill.relativePath)}</small></span>
                    <button class="secondary-button" type="button" data-workflow-remove-skill="${escapeAttribute(skill.relativePath)}">${icon("trash")}<span>${t("Remove")}</span></button>
                  </div>
                `).join("")}
              </div>`
            : ""
        }
      </section>
    </form>
  `;
}

function workflowSkillToggle(skill: SkillSummary) {
  const selected = state.workflowDraft.selectedSkills.some((reference) => reference.relativePath === skill.relative_path);
  return `
    <label class="workflow-skill-toggle">
      <input type="checkbox" data-workflow-skill="${escapeAttribute(skill.relative_path)}" ${selected ? "checked" : ""} />
      <span>
        <strong>${escapeHtml(resolvedSkillName(skill))}</strong>
        <small>${escapeHtml(skill.relative_path)}</small>
        ${skill.description ? `<em>${escapeHtml(skill.description)}</em>` : ""}
      </span>
    </label>
  `;
}

function workflowSkillItem(skill: WorkflowSkillReference, stateLabel: "Available" | "Missing") {
  return `
    <div class="workflow-skill-item ${stateLabel === "Missing" ? "missing" : ""}">
      <strong>${escapeHtml(workflowSkillName(skill))}</strong>
      <span>${escapeHtml(skill.relativePath)}</span>
      <em>${t(stateLabel)}</em>
    </div>
  `;
}

function terminalView() {
  const active = activeConnection();
  if (!active) {
    return `
      <section class="summary-panel terminal-panel">
        <div class="empty-state large">
          <strong>${t("Select a connection first")}</strong>
          <span>${t("Terminal tabs run on the active Hermes host over SSH.")}</span>
        </div>
      </section>
    `;
  }
  const selectedTab = selectedTerminalTab();
  const theme = terminalTheme();
  return `
    <div class="terminal-workspace" style="${terminalThemeStyleAttribute(theme)}">
      <section class="terminal-toolbar">
        <div class="terminal-tab-strip">
          ${
            state.terminalTabs.length
              ? state.terminalTabs.map(terminalTabButton).join("")
              : `<div class="terminal-empty-tabs">${t("No terminal tabs")}</div>`
          }
        </div>
        <div class="terminal-toolbar-actions">
          <button class="primary-button" data-action="new-terminal-tab">${icon("plus")}<span>${t("New Tab")}</span></button>
          <select data-terminal-theme title="${escapeAttribute(t("Terminal theme"))}">
            ${terminalThemeOptions()}
          </select>
        </div>
      </section>

      ${terminalInlineStatus(selectedTab)}

      <section class="terminal-live-panel">
        ${
          selectedTab
            ? terminalLiveTabView(selectedTab)
            : `<div class="empty-state large"><strong>${t("No terminal tab")}</strong><span>${t("Create a tab to start Hermes Chat TUI.")}</span></div>`
        }
      </section>

      <details class="terminal-command-runner">
        <summary>${t("Command Runner")}</summary>
        <section class="summary-panel terminal-panel">
          <div class="terminal-header">
            <div>
              <h2>${t("Run Once")}</h2>
              <p>${escapeHtml(activeDestination(active))} · ${escapeHtml(remoteHermesHomePath(active))}</p>
            </div>
            <button class="secondary-button" data-action="clear-terminal-history" ${state.terminalHistory.length ? "" : "disabled"}>${icon("trash")}<span>${t("Clear")}</span></button>
          </div>

          ${state.terminalError ? `<div class="banner error">${escapeHtml(state.terminalError)}</div>` : ""}

          <form class="terminal-form" data-terminal-form>
            <textarea name="terminalCommand" rows="4" spellcheck="false" ${state.isRunningTerminalCommand ? "disabled" : ""}>${escapeHtml(state.terminalCommand)}</textarea>
            <div class="terminal-actions">
              <button class="primary-button" type="submit" ${state.isRunningTerminalCommand ? "disabled" : ""}>${icon("terminal")}<span>${state.isRunningTerminalCommand ? t("Running") : t("Run Command")}</span></button>
              <button class="secondary-button" type="button" data-terminal-template="hermes --version">${t("Hermes Version")}</button>
              <button class="secondary-button" type="button" data-terminal-template="pwd && ls -la">${t("List Directory")}</button>
              <button class="secondary-button" type="button" data-terminal-template="hermes chat">${t("Hermes Chat")}</button>
            </div>
          </form>
        </section>

        <section class="terminal-output">
          ${
            state.terminalHistory.length
              ? state.terminalHistory.map(terminalResultView).join("")
              : `<div class="empty-state large"><strong>${t("No command output yet")}</strong><span>${t("Run a one-shot command to capture stdout, stderr, and exit code.")}</span></div>`
          }
        </section>
      </details>
    </div>
  `;
}

function terminalInlineStatus(tab: TerminalLiveTab | null) {
  if (!tab) {
    return "";
  }
  if (tab.status === "starting") {
    return `<div class="inline-status terminal-inline-status">${icon("refresh")}<span>${t("Starting terminal session...")}</span></div>`;
  }
  if (tab.initialInput && !tab.initialInputSent) {
    return `<div class="inline-status terminal-inline-status">${icon("activity")}<span>${t("Initial input pending")}</span></div>`;
  }
  return "";
}

function terminalTabButton(tab: TerminalLiveTab) {
  const active = tab.id === state.selectedTerminalTabId;
  const statusLabel = tab.status === "exited" && tab.exitCode !== null ? `exit ${tab.exitCode}` : tab.status;
  return `
    <div class="terminal-tab-chip ${active ? "active" : ""} ${tab.status}" data-terminal-tab-row="${escapeAttribute(tab.id)}">
      <button type="button" data-terminal-tab="${escapeAttribute(tab.id)}">
        <strong>${escapeHtml(tab.title)}</strong>
        <span>${escapeHtml(tab.hermesProfileName)} · ${escapeHtml(statusLabel)}</span>
      </button>
      <button class="terminal-tab-close" type="button" data-terminal-close="${escapeAttribute(tab.id)}" title="Close tab">${icon("trash")}</button>
    </div>
  `;
}

function terminalLiveTabView(tab: TerminalLiveTab) {
  const isRunning = tab.status === "starting" || tab.status === "running";
  return `
    <div class="terminal-live-header">
      <div>
        <h2>${escapeHtml(tab.title)}</h2>
        <p>${escapeHtml(tab.destination)} · ${escapeHtml(tab.hermesHomePath)}</p>
      </div>
      <div class="terminal-live-actions">
        ${
          tab.exitCode !== null
            ? `<span class="terminal-status ${tab.exitCode === 0 ? "ok" : "failed"}">exit ${tab.exitCode}</span>`
            : `<span class="terminal-status ${tab.status}">${escapeHtml(tab.status)}</span>`
        }
        <button class="secondary-button" data-action="reconnect-terminal-tab">${icon("refresh")}<span>${t("Reconnect")}</span></button>
        <button class="secondary-button" data-action="stop-terminal-tab" ${isRunning ? "" : "disabled"}>${icon("pause")}<span>${t("Stop")}</span></button>
      </div>
    </div>

    ${tab.startupCommandLine ? `<details class="terminal-startup"><summary>${t("Startup command")}</summary><pre>${escapeHtml(tab.startupCommandLine)}</pre></details>` : ""}
    ${tab.initialInput ? `<div class="terminal-initial-input"><span>${tab.initialInputSent ? t("Initial input sent") : t("Initial input pending")}</span><button class="secondary-button" data-action="paste-terminal-initial-input">${icon("send")}<span>${t("Paste Again")}</span></button></div>` : ""}

    <div class="terminal-screen" data-terminal-screen data-terminal-xterm="${escapeAttribute(tab.id)}">
      <pre class="terminal-fallback">${escapeHtml(terminalDisplayOutput(tab))}</pre>
    </div>

    <form class="terminal-input-row" data-terminal-input-form>
      <input name="terminalInput" autocomplete="off" spellcheck="false" value="${escapeAttribute(tab.inputDraft)}" placeholder="${escapeAttribute(t("Type a command or raw input"))}" ${isRunning ? "" : "disabled"} />
      <button class="primary-button" type="submit" ${isRunning ? "" : "disabled"}>${icon("send")}<span>${t("Send")}</span></button>
      <button class="secondary-button" type="button" data-terminal-control="enter" ${isRunning ? "" : "disabled"}>Enter</button>
      <button class="secondary-button" type="button" data-terminal-control="ctrl-c" ${isRunning ? "" : "disabled"}>Ctrl-C</button>
      <button class="secondary-button" type="button" data-action="clear-terminal-output">${icon("trash")}<span>${t("Clear")}</span></button>
    </form>
  `;
}

function terminalResultView(result: TerminalCommandResult) {
  const ok = result.exitCode === 0;
  return `
    <article class="terminal-result ${ok ? "ok" : "failed"}">
      <header>
        <div>
          <strong>${escapeHtml(result.commandLine)}</strong>
          <span>${escapeHtml(formatTimestamp(result.startedAt))} · exit ${result.exitCode}</span>
        </div>
        <button class="secondary-button" data-terminal-rerun="${escapeAttribute(result.commandLine)}">${icon("refresh")}<span>${t("Rerun")}</span></button>
      </header>
      ${result.stdout.trim() ? `<pre>${escapeHtml(stripTerminalArtifacts(result.stdout))}</pre>` : ""}
      ${result.stderr.trim() ? `<pre class="terminal-stderr">${escapeHtml(stripTerminalArtifacts(result.stderr))}</pre>` : ""}
      ${!result.stdout.trim() && !result.stderr.trim() ? `<div class="empty-state">${t("Command produced no output.")}</div>` : ""}
    </article>
  `;
}

function terminalThemeOptions() {
  return terminalThemePresets
    .map((preset) => `<option value="${preset.id}" ${state.terminalThemeStyle === preset.id ? "selected" : ""}>${escapeHtml(preset.name)}</option>`)
    .join("");
}

function terminalThemeStyleAttribute(theme: TerminalThemePreset) {
  return `--terminal-bg:${escapeAttribute(theme.background)};--terminal-fg:${escapeAttribute(theme.foreground)};--terminal-muted:${escapeAttribute(theme.muted)};--terminal-border:${escapeAttribute(theme.border)};`;
}

function terminalDisplayOutput(tab: TerminalLiveTab) {
  const output = stripTerminalArtifacts(tab.output);
  if (output.trim()) {
    return output;
  }
  if (tab.status === "starting") {
    return t("Starting SSH terminal session...");
  }
  if (tab.status === "exited") {
    return tf("Terminal exited with code %@.", tab.exitCode ?? -1);
  }
  return t("Connected. Waiting for terminal output...");
}

interface TerminalThemePreset {
  id: TerminalThemeStyle;
  name: string;
  background: string;
  foreground: string;
  muted: string;
  border: string;
}

const terminalThemePresets: TerminalThemePreset[] = [
  { id: "graphite", name: "Graphite", background: "#0e0e0e", foreground: "#f0f0f0", muted: "#777777", border: "#252525" },
  { id: "evergreen", name: "Evergreen", background: "#0F1714", foreground: "#DBE8E1", muted: "#8FA79A", border: "#29443A" },
  { id: "dusk", name: "Dusk", background: "#101726", foreground: "#DDE7F7", muted: "#95A8C4", border: "#2C3B5A" },
  { id: "paper", name: "Paper", background: "#F5F1E8", foreground: "#2F3743", muted: "#687282", border: "#D3CAB9" },
  { id: "aubergine", name: "Aubergine", background: "#17111F", foreground: "#EFE7FF", muted: "#AA9ABA", border: "#3C304E" },
  { id: "porcelain", name: "Porcelain", background: "#F7F9FC", foreground: "#253040", muted: "#637084", border: "#D7DFEA" },
  { id: "custom", name: "Custom", background: "#0e0e0e", foreground: "#f0f0f0", muted: "#777777", border: "#252525" },
];

function terminalTheme() {
  const preset = terminalThemePresets.find((item) => item.id === state.terminalThemeStyle) ?? terminalThemePresets[0];
  if (state.terminalThemeStyle !== "custom") {
    return preset;
  }
  return {
    ...preset,
    background: state.terminalCustomBackground,
    foreground: state.terminalCustomForeground,
  };
}

function selectedTerminalTab() {
  return state.terminalTabs.find((tab) => tab.id === state.selectedTerminalTabId) ?? state.terminalTabs.at(-1) ?? null;
}

function terminalTabFromInfo(info: TerminalSessionInfo): TerminalLiveTab {
  return {
    ...info,
    output: "",
    stderrOutput: "",
    status: "starting",
    exitCode: null,
    inputDraft: "",
    initialInputSent: false,
    lastEventAt: null,
  };
}

function terminalBracketedPaste(value: string) {
  return `\x1b[200~${value}\x1b[201~\r`;
}

function mountTerminalRenderer() {
  if (state.selectedSection !== "terminal") {
    return;
  }
  const tab = selectedTerminalTab();
  const container = app.querySelector<HTMLElement>("[data-terminal-xterm]");
  if (!tab || !container) {
    return;
  }

  let renderer = terminalRenderers.get(tab.id);
  if (renderer && renderer.container && !renderer.container.isConnected) {
    disposeTerminalRenderer(tab.id);
    renderer = undefined;
  }
  if (!renderer) {
    renderer = createTerminalRenderer(tab);
    terminalRenderers.set(tab.id, renderer);
  }
  if (renderer.container !== container) {
    container.innerHTML = "";
    container.classList.add("xterm-mounted");
    renderer.terminal.open(container);
    renderer.container = container;

    if (renderer.resizeObserver) {
      renderer.resizeObserver.disconnect();
    }

    const observer = new ResizeObserver(() => {
      if (renderer && renderer.container && renderer.container.clientWidth > 0) {
        fitAndSyncTerminalSize(renderer);
      }
    });
    observer.observe(container);
    renderer.resizeObserver = observer;
  }
  renderer.terminal.options.theme = xtermTheme();
  if (renderer.writtenLength < tab.output.length) {
    renderer.terminal.write(tab.output.slice(renderer.writtenLength));
    renderer.writtenLength = tab.output.length;
  }
  requestAnimationFrame(() => {
    if (renderer) {
      fitAndSyncTerminalSize(renderer);
    }
  });
}

function createTerminalRenderer(tab: TerminalLiveTab): TerminalRenderer {
  const terminal = new XTerm({
    convertEol: true,
    cursorBlink: true,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    fontSize: 13,
    lineHeight: 1.2,
    scrollback: 10000,
    theme: xtermTheme(),
  });
  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  const disposeDataHandler = terminal.onData((data) => {
    const filtered = stripTerminalGeneratedResponses(data);
    if (filtered) {
      void sendTerminalInput(tab.id, filtered);
    }
  });
  return {
    terminal,
    fitAddon,
    tabId: tab.id,
    container: null,
    disposeDataHandler,
    writtenLength: 0,
    syncedCols: 0,
    syncedRows: 0,
  };
}

function fitAndSyncTerminalSize(renderer: TerminalRenderer) {
  try {
    renderer.fitAddon.fit();
  } catch {
    // Fitting is best-effort because hidden panels can report zero geometry.
    return;
  }
  syncTerminalSize(renderer);
}

function syncTerminalSize(renderer: TerminalRenderer) {
  const cols = renderer.terminal.cols;
  const rows = renderer.terminal.rows;
  if (!Number.isFinite(cols) || !Number.isFinite(rows) || cols < 2 || rows < 1) {
    return;
  }
  if (renderer.syncedCols === cols && renderer.syncedRows === rows) {
    return;
  }
  renderer.syncedCols = cols;
  renderer.syncedRows = rows;
  void resizeTerminalSession(renderer.tabId, cols, rows).catch(() => {
    // Resize races are expected when a terminal exits while the panel is resizing.
  });
}

function writeTerminalRendererData(tabId: string, data: string) {
  const renderer = terminalRenderers.get(tabId);
  if (!renderer) {
    return;
  }
  renderer.terminal.write(data);
  renderer.writtenLength += data.length;
}

function disposeTerminalRenderer(tabId: string) {
  const renderer = terminalRenderers.get(tabId);
  if (!renderer) {
    return;
  }
  if (renderer.resizeObserver) {
    renderer.resizeObserver.disconnect();
  }
  renderer.disposeDataHandler.dispose();
  renderer.terminal.dispose();
  terminalRenderers.delete(tabId);
}

function disposeAllTerminalRenderers() {
  for (const tabId of [...terminalRenderers.keys()]) {
    disposeTerminalRenderer(tabId);
  }
}

function xtermTheme() {
  const theme = terminalTheme();
  const baseTheme = {
    background: theme.background,
    foreground: theme.foreground,
    cursor: theme.foreground,
    selectionBackground: `${theme.foreground}44`,
  };
  if (theme.id === "paper" || theme.id === "porcelain") {
    return {
      ...baseTheme,
      black: "#1f2933",
      red: "#b42318",
      green: "#0f7b3a",
      yellow: "#8a6200",
      blue: "#1d4ed8",
      magenta: "#8b3db4",
      cyan: "#0f766e",
      white: "#f8fafc",
      brightBlack: "#667085",
      brightRed: "#d92d20",
      brightGreen: "#16a34a",
      brightYellow: "#a16207",
      brightBlue: "#2563eb",
      brightMagenta: "#a855f7",
      brightCyan: "#0891b2",
      brightWhite: "#ffffff",
    };
  }
  return {
    ...baseTheme,
    black: "#111111",
    red: "#ff7b72",
    green: "#83d58d",
    yellow: "#d4e815",
    blue: "#8ab4ff",
    magenta: "#d2a8ff",
    cyan: "#7dd3fc",
    white: "#f0f0f0",
    brightBlack: "#777777",
    brightRed: "#ffa198",
    brightGreen: "#a7f3b7",
    brightYellow: "#f2e85c",
    brightBlue: "#a7c7ff",
    brightMagenta: "#e4c8ff",
    brightCyan: "#a5f3fc",
    brightWhite: "#ffffff",
  };
}

function filesView() {
  const selected = selectedWorkspaceFileReference();
  const doc = selected ? workspaceFileDocument(selected) : null;
  const canonical = canonicalWorkspaceFileReferences();
  const bookmarkGroups = workspaceFileBookmarkGroups();
  return `
    <div class="files-layout">
      <section class="list-panel files-list-panel">
        <div class="panel-heading">
          <h2>Library</h2>
          <button class="secondary-button" data-action="toggle-file-browser">${icon("plus")}<span>Add File</span></button>
        </div>

        ${state.isFileBrowserOpen ? fileBrowserView() : ""}

        <div class="file-group">
          <div class="session-group-label">Canonical</div>
          ${canonical.map(fileRow).join("")}
        </div>

        <div class="file-group">
          <div class="session-group-label">Bookmarks</div>
          ${
            bookmarkGroups.length === 0
              ? `<div class="empty-state">No remote files added yet.</div>`
              : bookmarkGroups.map(bookmarkGroupView).join("")
          }
        </div>
      </section>

      <section class="detail-panel file-editor-panel">
        ${
          selected
            ? fileEditorView(selected, doc)
            : `<div class="empty-state large"><strong>No file selected</strong><span>Choose a file from the library.</span></div>`
        }
      </section>
    </div>
  `;
}

function bookmarkGroupView(group: { id: string; title: string; directoryPath: string; references: WorkspaceFileReference[] }) {
  return `
    <div class="bookmark-group">
      <div class="bookmark-group-heading">
        <strong>${escapeHtml(group.title)}</strong>
        <span>${escapeHtml(group.directoryPath)}</span>
      </div>
      ${group.references.map(fileRow).join("")}
    </div>
  `;
}

function fileRow(reference: WorkspaceFileReference) {
  const isActive = reference.id === selectedWorkspaceFileReference()?.id;
  const doc = state.fileDocuments[reference.id];
  return `
    <button class="file-row ${isActive ? "active" : ""}" data-file="${escapeAttribute(reference.id)}">
      <span class="file-row-main">
        <strong>${escapeHtml(reference.title)}</strong>
        ${doc?.content !== doc?.originalContent ? `<em>Unsaved</em>` : ""}
      </span>
      <span>${escapeHtml(reference.subtitle)}</span>
    </button>
  `;
}

function fileEditorView(reference: WorkspaceFileReference, document: FileEditorDocument | null) {
  const isDirty = document ? document.content !== document.originalContent : false;
  const hasLoaded = document?.hasLoaded === true;
  const isLoading = document?.isLoading === true;
  return `
    <div class="file-editor-header">
      <div>
        <h2>${escapeHtml(reference.title)}</h2>
        <p>${escapeHtml(reference.remotePath)}</p>
      </div>
      <div class="form-actions">
        ${isDirty ? `<span class="dirty-pill">Unsaved</span>` : document?.lastSavedAt ? `<span class="saved-pill">Saved ${escapeHtml(formatRelativeTime(document.lastSavedAt))}</span>` : ""}
        <button class="secondary-button" data-action="reload-workspace-file" ${isLoading ? "disabled" : ""}>${icon("refresh")}<span>Reload</span></button>
        <button class="primary-button" data-action="save-workspace-file" ${!hasLoaded || isLoading ? "disabled" : ""}>${icon("save")}<span>Save</span></button>
        ${isDirty ? `<button class="secondary-button" data-action="discard-workspace-file">${icon("undo")}<span>Discard</span></button>` : ""}
        ${reference.bookmarkId ? `<button class="danger-button" data-action="remove-selected-file-bookmark">${icon("trash")}<span>Remove</span></button>` : ""}
      </div>
    </div>

    ${document?.errorMessage ? `<div class="banner error">${escapeHtml(document.errorMessage)}</div>` : ""}

    <div class="file-editor-meta">
      <span>${hasLoaded ? "Loaded" : "Not loaded"}</span>
      ${document?.remoteContentHash ? `<span>${escapeHtml(document.remoteContentHash.slice(0, 12))}</span>` : ""}
    </div>

    <textarea class="file-textarea" data-file-content spellcheck="false" ${isLoading || !hasLoaded ? "disabled" : ""}>${escapeHtml(document?.content ?? "")}</textarea>
  `;
}

function fileBrowserView() {
  const listing = state.fileBrowserListing;
  return `
    <section class="file-browser">
      <form class="file-browser-form" data-file-browser-form>
        <input name="fileBrowserPath" value="${escapeAttribute(state.fileBrowserPath || workspaceFileBrowserDefaultPath())}" placeholder="Remote path" autocomplete="off" />
        <button class="secondary-button" type="submit" ${state.isLoadingFileBrowser ? "disabled" : ""}>${icon("arrowRight")}<span>Go</span></button>
      </form>
      <div class="file-browser-actions">
        <button class="secondary-button" data-action="browse-hermes-home" ${state.isLoadingFileBrowser ? "disabled" : ""}>${icon("home")}<span>Hermes</span></button>
        <button class="secondary-button" data-action="browse-home" ${state.isLoadingFileBrowser ? "disabled" : ""}>${icon("user")}<span>Home</span></button>
        ${
          listing?.parent_display_path
            ? `<button class="secondary-button" data-action="browse-up" ${state.isLoadingFileBrowser ? "disabled" : ""}>${icon("arrowUp")}<span>Up</span></button>`
            : ""
        }
        <button class="secondary-button" data-action="add-browser-path">${icon("plus")}<span>Add Path</span></button>
      </div>
      ${state.fileBrowserError ? `<div class="browser-error">${escapeHtml(state.fileBrowserError)}</div>` : ""}
      ${
        state.isLoadingFileBrowser && !listing
          ? `<div class="empty-state">Loading remote files...</div>`
          : listing
            ? `<div class="browser-list">${listing.entries.map(browserEntryRow).join("")}</div><small class="browser-count">${listing.is_truncated ? `Showing ${listing.entries.length} of ${listing.total_entry_count}` : `${listing.total_entry_count} items`}</small>`
            : `<div class="empty-state">Enter a remote path to browse files.</div>`
      }
    </section>
  `;
}

function browserEntryRow(entry: RemoteDirectoryEntry) {
  const canOpenDirectory = entry.kind === "directory" && entry.is_readable;
  const tooLarge = isDirectoryEntryTooLarge(entry);
  const canBookmark = entry.kind === "file" && entry.is_readable && !tooLarge;
  const alreadyBookmarked = isWorkspaceFileBookmarked(entry.display_path);
  return `
    <div class="browser-row">
      <div>
        <strong>${escapeHtml(entry.name)}</strong>
        <span>${escapeHtml(browserEntryMetadata(entry))}</span>
      </div>
      ${
        canOpenDirectory
          ? `<button class="secondary-button" data-browse-path="${escapeAttribute(entry.display_path)}">${icon("folder")}<span>Open</span></button>`
          : tooLarge
            ? `<em>Too large</em>`
            : alreadyBookmarked
              ? `<em>Added</em>`
              : canBookmark
                ? `<button class="secondary-button" data-add-bookmark="${escapeAttribute(entry.display_path)}">${icon("plus")}<span>Add</span></button>`
                : `<em>${escapeHtml(entry.kind)}</em>`
      }
    </div>
  `;
}

function usageView() {
  if (state.isLoadingUsage && !state.usageSummary) {
    return `<section class="summary-panel usage-loading"><div class="empty-state large"><strong>Loading usage totals...</strong></div></section>`;
  }
  if (state.usageError && !state.usageSummary) {
    return `
      <section class="summary-panel">
        <div class="empty-state large">
          <strong>Unable to load usage</strong>
          <span>${escapeHtml(state.usageError)}</span>
          <button class="secondary-button" data-action="reload-usage">${icon("refresh")}<span>Retry</span></button>
        </div>
      </section>
    `;
  }
  if (!state.usageSummary) {
    return `
      <section class="summary-panel">
        <div class="empty-state large">
          <strong>No usage loaded</strong>
          <button class="primary-button" data-action="reload-usage">${icon("refresh")}<span>Load Usage</span></button>
        </div>
      </section>
    `;
  }
  if (state.usageSummary.state !== "available") {
    return `
      <section class="summary-panel">
        <div class="empty-state large">
          <strong>Usage unavailable</strong>
          <span>${escapeHtml(state.usageSummary.message ?? "No readable Hermes session database is currently available for the active host.")}</span>
          <button class="secondary-button" data-action="reload-usage">${icon("refresh")}<span>Reload</span></button>
        </div>
      </section>
    `;
  }

  const summary = state.usageSummary;
  return `
    <div class="usage-layout">
      <div class="usage-toolbar">
        <div>
          <h2>Active Profile</h2>
          <p>${escapeHtml(resolvedHermesProfileName(activeConnection()!))} · ${escapeHtml(summary.database_path ?? "No database path")}</p>
        </div>
        <button class="secondary-button" data-action="reload-usage" ${state.isLoadingUsage ? "disabled" : ""}>${icon("refresh")}<span>${state.isLoadingUsage ? "Loading" : "Reload"}</span></button>
      </div>

      ${summary.message ? `<div class="banner">${escapeHtml(summary.message)}</div>` : ""}

      <div class="usage-metric-grid">
        ${usageMetricCard("Input Tokens", summary.input_tokens, "usage-red")}
        ${usageMetricCard("Output Tokens", summary.output_tokens, "usage-yellow")}
      </div>

      <section class="summary-panel usage-panel">
        <div class="panel-heading">
          <h2>Active Profile Input/Output</h2>
        </div>
        <div class="usage-mini-grid">
          ${usageMiniStat("Stored Sessions", formatUsageNumber(summary.session_count))}
          ${usageMiniStat("Input + Output", formatUsageNumber(usageTotalTokens(summary)))}
          ${usageMiniStat("Avg. per Session", formatUsageNumber(usageAverageTokens(summary)))}
          ${usageMiniStat("All Categories", formatUsageNumber(usageAllTokens(summary)))}
        </div>
        ${usageStackedBar(summary)}
        <div class="usage-share-row">
          ${usageSharePill("Input", summary.input_tokens, usageTotalTokens(summary), "usage-red")}
          ${usageSharePill("Output", summary.output_tokens, usageTotalTokens(summary), "usage-yellow")}
          ${usageSharePill("Cache", usageCacheTokens(summary), usageAllTokens(summary), "usage-blue")}
          ${usageSharePill("Reasoning", summary.reasoning_tokens, usageAllTokens(summary), "usage-green")}
        </div>
      </section>

      ${usageProfileBreakdownView()}

      <div class="usage-two-column">
        ${topSessionsPanel(summary)}
        ${topModelsPanel(summary)}
      </div>

      ${recentUsagePanel(summary)}
    </div>
  `;
}

function usageMetricCard(title: string, value: number, className: string) {
  return `
    <section class="usage-metric-card ${className}">
      <span>${escapeHtml(title)}</span>
      <strong>${escapeHtml(formatUsageNumber(value))}</strong>
      <div></div>
    </section>
  `;
}

function usageMiniStat(title: string, value: string) {
  return `
    <div class="usage-mini-stat">
      <span>${escapeHtml(title)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function usageSharePill(title: string, value: number, total: number, className: string) {
  return `
    <div class="usage-share-pill">
      <span class="usage-dot ${className}"></span>
      <strong>${escapeHtml(title)}</strong>
      <em>${escapeHtml(formatPercent(total > 0 ? value / total : 0))}</em>
      <span>${escapeHtml(shortUsageNumber(value))}</span>
    </div>
  `;
}

function usageStackedBar(summary: UsageSummary) {
  const total = Math.max(usageAllTokens(summary), 1);
  const segments = [
    { className: "usage-red", value: summary.input_tokens },
    { className: "usage-yellow", value: summary.output_tokens },
    { className: "usage-blue", value: usageCacheTokens(summary) },
    { className: "usage-green", value: summary.reasoning_tokens },
  ];
  return `
    <div class="usage-stacked-bar">
      ${segments
        .map((segment) => `<span class="${segment.className}" style="width:${Math.max(segment.value > 0 ? 2 : 0, (segment.value / total) * 100)}%"></span>`)
        .join("")}
    </div>
  `;
}

function usageProfileBreakdownView() {
  const profiles = state.usageProfileBreakdown;
  if (!profiles || profiles.length <= 1) {
    return "";
  }
  const readable = profiles.filter((profile) => profile.state === "available");
  const total = readable.reduce((sum, profile) => sum + usageProfileAllTokens(profile), 0);
  if (readable.length < 2 || total <= 0) {
    return `
      <section class="summary-panel usage-panel">
        <div class="panel-heading"><h2>All Profiles Token Breakdown</h2></div>
        <div class="empty-state">At least two profiles need readable usage data before the cross-profile breakdown becomes meaningful.</div>
      </section>
    `;
  }
  const activeProfileTotal = usageProfileAllTokens(readable.find((profile) => profile.isActiveProfile) ?? null);
  return `
    <section class="summary-panel usage-panel">
      <div class="panel-heading"><h2>All Profiles Token Breakdown</h2></div>
      <div class="usage-mini-grid">
        ${usageMiniStat("Readable Profiles", formatUsageNumber(readable.length))}
        ${usageMiniStat("Host-wide All Categories", formatUsageNumber(total))}
        ${usageMiniStat("Active Profile Share", formatPercent(activeProfileTotal / Math.max(total, 1)))}
      </div>
      <div class="usage-profile-list">
        ${readable.map((profile) => usageProfileRow(profile, total)).join("")}
      </div>
      ${
        profiles.some((profile) => profile.state !== "available")
          ? `<small class="usage-note">Unavailable profiles are excluded: ${escapeHtml(profiles.filter((profile) => profile.state !== "available").map((profile) => profile.profileName).join(", "))}.</small>`
          : ""
      }
    </section>
  `;
}

function usageProfileRow(profile: UsageProfileSlice, total: number) {
  const profileTotal = usageProfileAllTokens(profile);
  return `
    <div class="usage-profile-row">
      <div>
        <strong>${escapeHtml(profile.profileName)}${profile.isActiveProfile ? " · Active" : ""}</strong>
        <span>${escapeHtml(profile.hermesHomePath)}</span>
      </div>
      <div class="usage-profile-meter"><span style="width:${Math.max(2, (profileTotal / Math.max(total, 1)) * 100)}%"></span></div>
      <em>${escapeHtml(formatUsageNumber(profileTotal))} · ${escapeHtml(formatPercent(total > 0 ? profileTotal / total : 0))}</em>
    </div>
  `;
}

function topSessionsPanel(summary: UsageSummary) {
  const sessions = summary.top_sessions.slice(0, 5);
  return `
    <section class="summary-panel usage-panel">
      <div class="panel-heading"><h2>Top 5 Sessions by Input/Output</h2></div>
      <div class="usage-ranking-list">
        ${
          sessions.length
            ? sessions.map((session, index) => usageSessionRow(session, index + 1)).join("")
            : [1, 2, 3, 4, 5].map((rank) => usagePlaceholderRow(rank, rank === 1 ? topSessionsEmptyTitle(summary) : "No session usage yet")).join("")
        }
      </div>
    </section>
  `;
}

function topModelsPanel(summary: UsageSummary) {
  const models = summary.top_models.slice(0, 5);
  return `
    <section class="summary-panel usage-panel">
      <div class="panel-heading"><h2>Top 5 Models by Input/Output</h2></div>
      <div class="usage-ranking-list">
        ${
          models.length
            ? models.map((model, index) => usageModelRow(model, index + 1)).join("")
            : [1, 2, 3, 4, 5].map((rank) => usagePlaceholderRow(rank, rank === 1 ? topModelsEmptyTitle(summary) : "No model usage yet")).join("")
        }
      </div>
    </section>
  `;
}

function usageSessionRow(session: UsageSummary["top_sessions"][number], rank: number) {
  return `
    <div class="usage-ranking-row">
      <span>${rank}</span>
      <div>
        <strong>${escapeHtml(session.title || session.id)}</strong>
        ${session.title && session.title !== session.id ? `<small>${escapeHtml(session.id)}</small>` : ""}
      </div>
      <em>${escapeHtml(formatUsageNumber(session.total_tokens))}</em>
    </div>
  `;
}

function usageModelRow(model: UsageSummary["top_models"][number], rank: number) {
  const meta = [
    model.billing_provider ?? "-",
    `${formatUsageNumber(model.session_count)} sessions`,
    model.cache_reasoning_tokens > 0 ? `+${shortUsageNumber(model.cache_reasoning_tokens)} cache/reasoning` : "",
  ].filter(Boolean).join(" · ");
  return `
    <div class="usage-ranking-row">
      <span>${rank}</span>
      <div>
        <strong>${escapeHtml(model.model)}</strong>
        <small>${escapeHtml(meta)}</small>
      </div>
      <em>${escapeHtml(formatUsageNumber(model.total_tokens))}<small>${escapeHtml(formatUsd(model.estimated_cost_usd))}</small></em>
    </div>
  `;
}

function usagePlaceholderRow(rank: number, title: string) {
  return `
    <div class="usage-ranking-row placeholder-row">
      <span>${rank}</span>
      <div><strong>${escapeHtml(title)}</strong></div>
      <em>-</em>
    </div>
  `;
}

function recentUsagePanel(summary: UsageSummary) {
  if (summary.recent_sessions.length === 0) {
    return `
      <section class="summary-panel usage-panel">
        <div class="panel-heading"><h2>Recent Session History</h2></div>
        <div class="empty-state">Recent session usage will appear here once Hermes has stored session data.</div>
      </section>
    `;
  }
  const maxTokens = Math.max(...summary.recent_sessions.map((session) => session.total_tokens), 1);
  return `
    <section class="summary-panel usage-panel">
      <div class="panel-heading"><h2>Recent Session History</h2></div>
      <div class="usage-history-chart">
        ${summary.recent_sessions
          .map((session) => `<span title="${escapeAttribute(`${session.title ?? session.id}: ${formatUsageNumber(session.total_tokens)}`)}" style="height:${Math.max(4, (session.total_tokens / maxTokens) * 100)}%"></span>`)
          .join("")}
      </div>
      <div class="usage-chart-legend">
        <span>Older on the left, newer on the right</span>
        <strong>Peak ${escapeHtml(shortUsageNumber(maxTokens))}</strong>
      </div>
    </section>
  `;
}

function topModelsEmptyTitle(summary: UsageSummary) {
  return summary.missing_columns.includes("model") ? "Model data unavailable" : "No tracked models yet";
}

function topSessionsEmptyTitle(summary: UsageSummary) {
  return summary.session_count === 0 ? "No stored sessions yet" : "No ranked sessions available";
}

function skillsView() {
  const filtered = filteredSkills();
  const selected = selectedSkillSummary();
  return `
    <div class="skills-layout">
      <section class="list-panel skills-list-panel">
        <form class="skill-search" data-skill-search>
          <input name="skillQuery" value="${escapeAttribute(state.skillQuery)}" placeholder="Search skills" autocomplete="off" />
          <button class="secondary-button" type="submit" ${state.isLoadingSkills ? "disabled" : ""}>${icon("search")}<span>Search</span></button>
        </form>

        <div class="panel-heading">
          <h2>${state.skills.length ? `Discovered Skills (${filtered.length} of ${state.skills.length})` : "Discovered Skills"}</h2>
          <div class="form-actions">
            <button class="icon-button small" data-action="reload-skills" title="Refresh Skills" ${state.isLoadingSkills ? "disabled" : ""}>${icon("refresh")}</button>
            <button class="icon-button small" data-action="new-skill" title="New Skill">${icon("plus")}</button>
          </div>
        </div>

        <div class="skill-list">
          ${
            state.isLoadingSkills && state.skills.length === 0
              ? `<div class="empty-state">Loading skills...</div>`
              : state.skillsError && state.skills.length === 0
                ? `<div class="empty-state">${escapeHtml(state.skillsError)}</div>`
                : filtered.length === 0
                  ? `<div class="empty-state">${state.skillQuery ? "No matching skills." : "No skills found."}</div>`
                  : filtered.map(skillRow).join("")
          }
        </div>
      </section>

      <section class="detail-panel skill-detail-panel">
        ${
          state.skillEditorMode === "create"
            ? skillEditorView(null)
            : selected
              ? skillDetailView()
              : `<div class="empty-state large"><strong>Select a skill</strong><span>Choose a skill to inspect its metadata and SKILL.md content.</span></div>`
        }
      </section>
    </div>
  `;
}

function skillRow(skill: SkillSummary) {
  const isActive = skill.id === state.selectedSkillId;
  return `
    <button class="skill-row ${isActive ? "active" : ""}" data-skill="${escapeAttribute(skill.id)}">
      <span class="skill-row-main">
        <strong>${escapeHtml(resolvedSkillName(skill))}</strong>
        <em>${escapeHtml(skill.source.kind === "local" ? "Local" : "External")}</em>
      </span>
      <span>${escapeHtml(skill.relative_path)}</span>
      ${skill.description ? `<small>${escapeHtml(skill.description)}</small>` : ""}
      <span class="skill-chip-row">${skillFeatureChips(skill).join("")}</span>
    </button>
  `;
}

function skillDetailView() {
  if (state.isLoadingSkillDetail && !state.selectedSkillDetail) {
    return `<div class="empty-state large"><strong>Loading skill detail...</strong></div>`;
  }
  const detail = state.selectedSkillDetail;
  if (!detail) {
    return `<div class="empty-state large"><strong>Unable to load skill detail</strong><span>${escapeHtml(state.skillsError ?? "Reload the skill and try again.")}</span></div>`;
  }
  if (state.skillEditorMode === "edit") {
    return skillEditorView(detail);
  }
  return `
    <div class="skill-detail-header">
      <div>
        <h2>${escapeHtml(resolvedSkillName(detail))}</h2>
        <p>${escapeHtml(skillFilePath(detail))}</p>
      </div>
      <div class="form-actions">
        <button class="secondary-button" data-action="reload-skills" ${state.isLoadingSkills ? "disabled" : ""}>${icon("refresh")}<span>Reload</span></button>
        ${
          detail.source.is_read_only
            ? `<span class="saved-pill">Read-only</span>`
            : `<button class="primary-button" data-action="edit-skill">${icon("save")}<span>Edit</span></button>`
        }
      </div>
    </div>

    <div class="skill-meta-grid">
      ${skillMiniStat("Source", detail.source.kind === "local" ? "Local" : "External")}
      ${skillMiniStat("Path", detail.relative_path)}
      ${skillMiniStat("Version", detail.version ?? "-")}
      ${skillMiniStat("Assets", skillAssetSummary(detail))}
    </div>

    ${
      detail.description
        ? `<section class="summary-panel skill-panel"><h2>Description</h2><p>${escapeHtml(detail.description)}</p></section>`
        : ""
    }

    <section class="summary-panel skill-panel">
      <h2>Frontmatter</h2>
      <div class="skill-chip-cloud">
        ${[...detail.platforms.map((item) => `Platform: ${item}`), ...detail.tags.map((item) => `Tag: ${item}`), ...detail.related_skills.map((item) => `Related: ${item}`)]
          .map((item) => `<span>${escapeHtml(item)}</span>`)
          .join("") || `<span>No optional metadata</span>`}
      </div>
    </section>

    <section class="summary-panel skill-panel">
      <h2>SKILL.md</h2>
      <pre class="skill-markdown-view">${escapeHtml(detail.markdown_content)}</pre>
    </section>
  `;
}

function skillEditorView(detail: SkillDetail | null) {
  const isCreate = state.skillEditorMode === "create";
  return `
    <div class="skill-detail-header">
      <div>
        <h2>${isCreate ? "New Skill" : `Edit ${escapeHtml(resolvedSkillName(detail!))}`}</h2>
        <p>${isCreate ? "Create a local SKILL.md under the active Hermes profile." : escapeHtml(skillFilePath(detail!))}</p>
      </div>
      <div class="form-actions">
        <button class="secondary-button" data-action="cancel-skill-edit" ${state.isSavingSkill ? "disabled" : ""}>${icon("undo")}<span>Cancel</span></button>
        <button class="primary-button" data-action="save-skill" ${state.isSavingSkill ? "disabled" : ""}>${icon("save")}<span>${state.isSavingSkill ? "Saving" : isCreate ? "Create" : "Save"}</span></button>
      </div>
    </div>

    ${
      isCreate
        ? `<label class="skill-path-field"><span>Relative path</span><input data-new-skill-path value="${escapeAttribute(state.newSkillPath)}" placeholder="category/skill-slug" autocomplete="off" /></label>`
        : ""
    }

    <div class="skill-folder-options">
      ${skillFolderCheckbox("references", "References", state.createSkillReferences || Boolean(detail?.has_references))}
      ${skillFolderCheckbox("scripts", "Scripts", state.createSkillScripts || Boolean(detail?.has_scripts))}
      ${skillFolderCheckbox("templates", "Templates", state.createSkillTemplates || Boolean(detail?.has_templates))}
    </div>

    <textarea class="skill-textarea" data-skill-draft spellcheck="false" ${state.isSavingSkill ? "disabled" : ""}>${escapeHtml(state.skillDraftContent)}</textarea>
  `;
}

function skillFolderCheckbox(id: "references" | "scripts" | "templates", label: string, checked: boolean) {
  return `
    <label class="checkbox-label">
      <input type="checkbox" data-skill-folder="${id}" ${checked ? "checked" : ""} />
      <span>${escapeHtml(label)}</span>
    </label>
  `;
}

function cronJobsView() {
  const filtered = filteredCronJobs();
  const selected = selectedCronJob();
  return `
    <div class="cron-layout">
      <section class="list-panel cron-list-panel">
        <form class="cron-search" data-cron-search>
          <input name="cronQuery" value="${escapeAttribute(state.cronQuery)}" placeholder="Search cron jobs" autocomplete="off" />
          <button class="secondary-button" type="submit" ${state.isLoadingCronJobs ? "disabled" : ""}>${icon("search")}<span>Search</span></button>
        </form>

        <div class="cron-filter-row">
          ${cronFilterButton("all", "All")}
          ${cronFilterButton("active", "Active")}
          ${cronFilterButton("paused", "Paused")}
        </div>

        <div class="panel-heading">
          <h2>${state.cronJobs.length ? `Cron Jobs (${filtered.length} of ${state.cronJobs.length})` : "Cron Jobs"}</h2>
          <div class="form-actions">
            <button class="icon-button small" data-action="reload-cron-jobs" title="Refresh Cron Jobs" ${state.isLoadingCronJobs ? "disabled" : ""}>${icon("refresh")}</button>
            <button class="icon-button small" data-action="new-cron-job" title="New Cron Job">${icon("plus")}</button>
          </div>
        </div>

        <div class="cron-list">
          ${
            state.isLoadingCronJobs && state.cronJobs.length === 0
              ? `<div class="empty-state">Loading cron jobs...</div>`
              : state.cronJobsError && state.cronJobs.length === 0
                ? `<div class="empty-state">${escapeHtml(state.cronJobsError)}</div>`
                : filtered.length === 0
                  ? `<div class="empty-state">${state.cronQuery ? "No matching cron jobs." : "No cron jobs found."}</div>`
                  : filtered.map(cronJobRow).join("")
          }
        </div>
      </section>

      <section class="detail-panel cron-detail-panel">
        ${
          state.cronEditorMode === "create" || state.cronEditorMode === "edit"
            ? cronEditorView()
            : selected
              ? cronJobDetailView(selected)
              : `<div class="empty-state large"><strong>Select a cron job</strong><span>Choose a scheduled Hermes job or create a new one.</span></div>`
        }
      </section>
    </div>
  `;
}

function cronFilterButton(filter: CronJobFilter, label: string) {
  return `<button class="${state.cronFilter === filter ? "active" : ""}" data-cron-filter="${filter}" type="button">${escapeHtml(label)}</button>`;
}

function cronJobRow(job: CronJob) {
  const active = job.id === state.selectedCronJobId;
  return `
    <button class="cron-row ${active ? "active" : ""}" data-cron-job="${escapeAttribute(job.id)}">
      <span class="cron-row-main">
        <strong>${escapeHtml(cronJobTitle(job))}</strong>
        <em class="${cronStatusClass(job)}">${escapeHtml(cronStatusTitle(job))}</em>
      </span>
      <span>${escapeHtml(job.id)}</span>
      <small>${escapeHtml(cronJobPreview(job))}</small>
      <span class="cron-row-meta">
        <em>${escapeHtml(cronScheduleTitle(job))}</em>
        ${job.next_run_at ? `<em>Next ${escapeHtml(formatTimestamp(job.next_run_at))}</em>` : ""}
        ${job.last_run_at ? `<em>Last ${escapeHtml(formatTimestamp(job.last_run_at))}</em>` : ""}
      </span>
    </button>
  `;
}

function cronJobDetailView(job: CronJob) {
  return `
    <div class="cron-detail-header">
      <div>
        <h2>${escapeHtml(cronJobTitle(job))}</h2>
        <p>${escapeHtml(job.id)}</p>
      </div>
      <div class="form-actions">
        <button class="primary-button" data-action="edit-cron-job" ${state.isOperatingOnCronJob ? "disabled" : ""}>${icon("save")}<span>Edit</span></button>
        <button class="secondary-button" data-action="run-cron-job" ${state.isOperatingOnCronJob ? "disabled" : ""}>${icon("activity")}<span>Run</span></button>
        <button class="secondary-button" data-action="toggle-cron-pause" ${state.isOperatingOnCronJob ? "disabled" : ""}>${icon(jobIsPaused(job) ? "check" : "pause")}<span>${jobIsPaused(job) ? "Resume" : "Pause"}</span></button>
        <button class="danger-button" data-action="remove-cron-job" ${state.isOperatingOnCronJob ? "disabled" : ""}>${icon("trash")}<span>Remove</span></button>
      </div>
    </div>

    <div class="cron-meta-grid">
      ${cronMiniStat("State", cronStatusTitle(job))}
      ${cronMiniStat("Mode", job.no_agent ? "Script Only" : "Agent")}
      ${cronMiniStat("Schedule", cronScheduleTitle(job))}
      ${cronMiniStat("Delivery", job.delivery_target ?? "-")}
    </div>

    ${
      job.last_error
        ? `<section class="summary-panel cron-panel"><h2>Last Error</h2><pre class="cron-pre error-text">${escapeHtml(job.last_error)}</pre></section>`
        : ""
    }

    <section class="summary-panel cron-panel">
      <h2>Execution</h2>
      <dl>
        ${cronDetailRow("Created", formatTimestamp(job.created_at))}
        ${cronDetailRow("Next run", formatTimestamp(job.next_run_at))}
        ${cronDetailRow("Last run", formatTimestamp(job.last_run_at))}
        ${cronDetailRow("Last status", job.last_status ?? "")}
        ${cronDetailRow("Timezone", job.schedule?.timezone ?? "")}
        ${cronDetailRow("Model", displayModel(job.model) ?? "")}
        ${cronDetailRow("Provider", job.provider ?? "")}
        ${cronDetailRow("Base URL", job.base_url ?? "")}
        ${cronDetailRow("Origin", cronOriginTitle(job))}
        ${cronDetailRow("Delivery error", job.last_delivery_error ?? "")}
      </dl>
    </section>

    ${
      job.skills.length
        ? `<section class="summary-panel cron-panel"><h2>Skills</h2><div class="skill-chip-cloud">${job.skills.map((skill) => `<span>${escapeHtml(skill)}</span>`).join("")}</div></section>`
        : ""
    }

    <section class="summary-panel cron-panel">
      <h2>${job.no_agent ? "Script" : "Prompt"}</h2>
      ${
        job.no_agent
          ? `<dl>${cronDetailRow("Script", job.script ?? "")}${cronDetailRow("Workdir", job.workdir ?? "")}</dl>`
          : `<pre class="cron-pre">${escapeHtml(job.prompt.trim() || "No prompt payload saved for this job.")}</pre>`
      }
    </section>
  `;
}

function cronEditorView() {
  const isCreate = state.cronEditorMode === "create";
  const draft = state.cronDraft;
  return `
    <form class="cron-form" data-cron-editor>
      <div class="cron-detail-header">
        <div>
          <h2>${isCreate ? "New Cron Job" : "Edit Cron Job"}</h2>
          <p>${escapeHtml(cronJobsRemotePath())}</p>
        </div>
        <div class="form-actions">
          <button class="secondary-button" type="button" data-action="cancel-cron-edit" ${state.isOperatingOnCronJob ? "disabled" : ""}>${icon("undo")}<span>Cancel</span></button>
          <button class="primary-button" type="submit" ${state.isOperatingOnCronJob ? "disabled" : ""}>${icon("save")}<span>${state.isOperatingOnCronJob ? "Saving" : isCreate ? "Create" : "Save"}</span></button>
        </div>
      </div>

      <section class="summary-panel cron-panel">
        <h2>Basics</h2>
        <div class="form-grid">
          <label><span>Title</span><input name="name" value="${escapeAttribute(draft.name)}" autocomplete="off" /></label>
          <label><span>Schedule</span><input name="schedule" value="${escapeAttribute(draft.schedule)}" placeholder="0 9 * * *" autocomplete="off" /></label>
        </div>
        <div class="form-grid">
          <label><span>Timezone</span><input name="timezone" value="${escapeAttribute(draft.timezone)}" placeholder="UTC" autocomplete="off" /></label>
          <label><span>Delivery</span><input name="deliver" value="${escapeAttribute(draft.deliver)}" placeholder="local" autocomplete="off" /></label>
        </div>
        <label class="checkbox-label cron-script-toggle">
          <input name="noAgent" type="checkbox" ${draft.noAgent ? "checked" : ""} />
          <span>Script-only job</span>
        </label>
      </section>

      <section class="summary-panel cron-panel">
        <h2>Payload</h2>
        <label><span>Prompt</span><textarea name="prompt" rows="7" spellcheck="false">${escapeHtml(draft.prompt)}</textarea></label>
        <div class="form-grid">
          <label><span>Script path</span><input name="script" value="${escapeAttribute(draft.script)}" autocomplete="off" /></label>
          <label><span>Workdir</span><input name="workdir" value="${escapeAttribute(draft.workdir)}" autocomplete="off" /></label>
        </div>
      </section>

      <section class="summary-panel cron-panel">
        <h2>Options</h2>
        <label><span>Skills</span><input name="skillsText" value="${escapeAttribute(draft.skillsText)}" placeholder="skill-one, category/skill-two" autocomplete="off" /></label>
        <div class="form-grid">
          <label><span>Model</span><input name="model" value="${escapeAttribute(draft.model)}" autocomplete="off" /></label>
          <label><span>Provider</span><input name="provider" value="${escapeAttribute(draft.provider)}" autocomplete="off" /></label>
        </div>
        <label><span>Base URL</span><input name="baseUrl" value="${escapeAttribute(draft.baseUrl)}" autocomplete="off" /></label>
      </section>
    </form>
  `;
}

function cronDetailRow(label: string, value: string) {
  if (!value) {
    return "";
  }
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function cronMiniStat(title: string, value: string) {
  return `
    <div class="usage-mini-stat">
      <span>${escapeHtml(title)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function kanbanView() {
  const tasks = filteredKanbanTasks();
  const selected = selectedKanbanTask();
  return `
    <div class="kanban-layout">
      <section class="list-panel kanban-list-panel">
        <div class="kanban-toolbar">
          <select data-kanban-board ${state.isLoadingKanbanBoards || state.isLoadingKanbanBoard ? "disabled" : ""}>
            ${kanbanBoardOptions()}
          </select>
          <button class="icon-button small" data-action="reload-kanban" title="Refresh Kanban" ${state.isLoadingKanbanBoard ? "disabled" : ""}>${icon("refresh")}</button>
          <button class="icon-button small" data-action="new-kanban-board" title="New Kanban board">${icon("plus")}</button>
        </div>

        ${state.kanbanBoardEditorOpen ? kanbanBoardEditorView() : ""}

        <form class="kanban-search" data-kanban-search>
          <input name="kanbanQuery" value="${escapeAttribute(state.kanbanQuery)}" placeholder="Search tasks" autocomplete="off" />
          <button class="secondary-button" type="submit" ${state.isLoadingKanbanBoard ? "disabled" : ""}>${icon("search")}<span>Search</span></button>
        </form>

        <div class="kanban-list-actions">
          <label class="checkbox-label">
            <input type="checkbox" data-kanban-include-archived ${state.includeArchivedKanbanTasks ? "checked" : ""} />
            <span>Archived</span>
          </label>
          <button class="secondary-button" data-action="new-kanban-task">${icon("plus")}<span>Task</span></button>
          <button class="secondary-button" data-action="dispatch-kanban" ${state.isDispatchingKanban ? "disabled" : ""}>${icon("activity")}<span>Dispatch</span></button>
          ${state.selectedKanbanBoardSlug !== "default" ? `<button class="danger-button" data-action="archive-kanban-board" ${state.isOperatingOnKanbanBoard ? "disabled" : ""}>${icon("trash")}<span>Archive Board</span></button>` : ""}
        </div>

        ${state.kanbanError ? `<div class="banner error">${escapeHtml(state.kanbanError)}</div>` : ""}
        ${state.kanbanBoard?.warning ? `<div class="banner">${escapeHtml(state.kanbanBoard.warning)}</div>` : ""}
        ${kanbanInlineStatus()}

        <div class="kanban-column-stack">
          ${
            state.isLoadingKanbanBoard && !state.kanbanBoard
              ? `<div class="empty-state">Loading Kanban board...</div>`
              : !state.kanbanBoard?.is_initialized
                ? kanbanEmptyBoardView()
                : kanbanStatusColumns(tasks)
          }
        </div>
      </section>

      <section class="detail-panel kanban-detail-panel">
        ${
          state.kanbanTaskEditorMode === "create" || state.kanbanTaskEditorMode === "edit"
            ? kanbanTaskEditorView()
            : selected
              ? kanbanTaskDetailView(selected)
              : `<div class="empty-state large"><strong>Select a Kanban task</strong><span>Choose a task or create a new one.</span></div>`
        }
      </section>
    </div>
  `;
}

function kanbanInlineStatus() {
  if (state.isLoadingKanbanBoards || state.isLoadingKanbanBoard) {
    return `<div class="inline-status">${icon("refresh")}<span>Loading Kanban...</span></div>`;
  }
  if (state.isOperatingOnKanbanBoard) {
    return `<div class="inline-status">${icon("activity")}<span>Saving Kanban board...</span></div>`;
  }
  if (state.isDispatchingKanban) {
    return `<div class="inline-status">${icon("activity")}<span>Dispatching Kanban...</span></div>`;
  }
  if (state.isOperatingOnKanbanTask) {
    return `<div class="inline-status">${icon("activity")}<span>Saving Kanban task...</span></div>`;
  }
  return "";
}

function kanbanBoardOptions() {
  const boards = state.kanbanBoards?.boards ?? [];
  const selected = state.selectedKanbanBoardSlug;
  const items = boards.length ? boards : [{ slug: "default", name: "Default", archived: false, total: null }] as Array<Pick<KanbanBoardsResponse["boards"][number], "slug" | "name" | "archived" | "total">>;
  return items
    .map((board) => `<option value="${escapeAttribute(board.slug)}" ${board.slug === selected ? "selected" : ""}>${escapeHtml(kanbanBoardTitle(board))}${board.archived ? " (archived)" : ""}${typeof board.total === "number" ? ` · ${board.total}` : ""}</option>`)
    .join("");
}

function kanbanBoardEditorView() {
  const draft = state.kanbanBoardDraft;
  return `
    <form class="kanban-board-form" data-kanban-board-editor>
      <div class="form-grid">
        <label><span>Slug</span><input name="slug" value="${escapeAttribute(draft.slug)}" placeholder="project-alpha" autocomplete="off" /></label>
        <label><span>Name</span><input name="name" value="${escapeAttribute(draft.name)}" placeholder="Project Alpha" autocomplete="off" /></label>
      </div>
      <label><span>Description</span><input name="description" value="${escapeAttribute(draft.description)}" autocomplete="off" /></label>
      <div class="form-grid">
        <label><span>Icon</span><input name="icon" value="${escapeAttribute(draft.icon)}" autocomplete="off" /></label>
        <label><span>Color</span><input name="color" value="${escapeAttribute(draft.color)}" autocomplete="off" /></label>
      </div>
      <div class="kanban-list-actions">
        <label class="checkbox-label"><input name="switchAfterCreate" type="checkbox" ${draft.switchAfterCreate ? "checked" : ""} /><span>Switch after create</span></label>
        <button class="secondary-button" type="button" data-action="cancel-kanban-board-edit">${icon("undo")}<span>Cancel</span></button>
        <button class="primary-button" type="submit" ${state.isOperatingOnKanbanBoard ? "disabled" : ""}>${icon("save")}<span>Create Board</span></button>
      </div>
    </form>
  `;
}

function kanbanEmptyBoardView() {
  return `
    <div class="empty-state large">
      <strong>No Kanban board yet</strong>
      <span>${escapeHtml(state.kanbanBoard?.database_path ?? "~/.hermes/kanban.db")}</span>
      <button class="primary-button" data-action="new-kanban-task">${icon("plus")}<span>Create Task</span></button>
    </div>
  `;
}

function kanbanStatusColumns(tasks: KanbanTask[]) {
  return kanbanVisibleStatuses(tasks)
    .map((status) => {
      const bucket = tasks.filter((task) => normalizeKanbanStatus(task.status) === status);
      return `
        <section class="kanban-status-column">
          <header><strong>${escapeHtml(kanbanStatusTitle(status))}</strong><span>${bucket.length}</span></header>
          <div class="kanban-task-list">
            ${
              bucket.length
                ? bucket.map(kanbanTaskRow).join("")
                : `<div class="empty-state">No tasks.</div>`
            }
          </div>
        </section>
      `;
    })
    .join("");
}

function kanbanTaskRow(task: KanbanTask) {
  const active = task.id === state.selectedKanbanTaskId;
  return `
    <button class="kanban-task-row ${active ? "active" : ""}" data-kanban-task="${escapeAttribute(task.id)}">
      <span class="kanban-task-row-main">
        <strong>${escapeHtml(kanbanTaskTitle(task))}</strong>
        <em>${escapeHtml(kanbanPriorityLabel(task.priority))}</em>
      </span>
      <small>${escapeHtml(kanbanTaskPreview(task))}</small>
      <span class="kanban-task-meta">
        ${task.assignee ? `<em>${escapeHtml(task.assignee)}</em>` : ""}
        ${task.tenant ? `<em>${escapeHtml(task.tenant)}</em>` : ""}
        ${task.comment_count ? `<em>${task.comment_count} comments</em>` : ""}
        ${task.warnings?.count ? `<em class="danger">${task.warnings.count} warnings</em>` : ""}
      </span>
    </button>
  `;
}

function kanbanTaskDetailView(task: KanbanTask) {
  const detail = state.selectedKanbanTaskDetail;
  const fullTask = detail?.task ?? task;
  return `
    <div class="kanban-detail-header">
      <div>
        <h2>${escapeHtml(kanbanTaskTitle(fullTask))}</h2>
        <p>${escapeHtml(fullTask.id)}</p>
      </div>
      <div class="form-actions">
        <button class="secondary-button" data-action="edit-kanban-task">${icon("save")}<span>Edit</span></button>
        ${kanbanTaskActionButtons(fullTask)}
      </div>
    </div>

    <div class="kanban-meta-grid">
      ${cronMiniStat("Status", kanbanStatusTitle(fullTask.status))}
      ${cronMiniStat("Priority", kanbanPriorityLabel(fullTask.priority))}
      ${cronMiniStat("Assignee", fullTask.assignee ?? "-")}
      ${cronMiniStat("Created", formatTimestamp(fullTask.created_at))}
    </div>

    <section class="summary-panel kanban-panel">
      <h2>Task</h2>
      <pre class="cron-pre">${escapeHtml(fullTask.body?.trim() || "No task body.")}</pre>
      ${fullTask.skills.length ? `<div class="skill-chip-cloud">${fullTask.skills.map((skill) => `<span>${escapeHtml(skill)}</span>`).join("")}</div>` : ""}
    </section>

    ${fullTask.result ? `<section class="summary-panel kanban-panel"><h2>Result</h2><pre class="cron-pre">${escapeHtml(fullTask.result)}</pre></section>` : ""}
    ${fullTask.last_spawn_error ? `<section class="summary-panel kanban-panel"><h2>Last Spawn Error</h2><pre class="cron-pre error-text">${escapeHtml(fullTask.last_spawn_error)}</pre></section>` : ""}

    ${kanbanTaskDependenciesView(fullTask, detail)}
    ${kanbanTaskRecoveryView(fullTask)}
    ${kanbanHomeChannelsView(detail)}

    <section class="summary-panel kanban-panel">
      <h2>Quick Action</h2>
      <form class="kanban-action-form" data-kanban-action-form>
        <input name="actionText" value="${escapeAttribute(state.kanbanActionDraft)}" placeholder="Assignee, block reason, or completion result" autocomplete="off" />
        <button class="secondary-button" type="button" data-action="assign-kanban-task">${icon("user")}<span>Assign</span></button>
      </form>
    </section>

    <section class="summary-panel kanban-panel">
      <h2>Comment</h2>
      <form class="kanban-comment-form" data-kanban-comment-form>
        <textarea name="comment" rows="3">${escapeHtml(state.kanbanCommentDraft)}</textarea>
        <button class="primary-button" type="submit" ${state.isOperatingOnKanbanTask ? "disabled" : ""}>${icon("send")}<span>Add Comment</span></button>
      </form>
    </section>

    ${state.isLoadingKanbanTaskDetail && !detail ? `<div class="empty-state">Loading task detail...</div>` : kanbanTaskHistoryView(detail)}
  `;
}

function kanbanTaskDependenciesView(task: KanbanTask, detail: KanbanTaskDetail | null) {
  const parentIds = detail?.parent_ids ?? task.parent_ids;
  const childIds = detail?.child_ids ?? task.child_ids;
  const parentDraft = state.kanbanParentIdsDraft || parentIds.join(", ");
  const childDraft = state.kanbanChildIdsDraft || childIds.join(", ");
  return `
    <section class="summary-panel kanban-panel">
      <h2>Dependencies</h2>
      <form class="kanban-links-form" data-kanban-links-form>
        <label><span>Parent IDs</span><input name="parentIds" value="${escapeAttribute(parentDraft)}" autocomplete="off" /></label>
        <button class="secondary-button" type="button" data-action="save-kanban-parents" ${state.isOperatingOnKanbanTask ? "disabled" : ""}>${icon("link")}<span>Save Parents</span></button>
        <label><span>Child IDs</span><input name="childIds" value="${escapeAttribute(childDraft)}" autocomplete="off" /></label>
        <button class="secondary-button" type="button" data-action="save-kanban-children" ${state.isOperatingOnKanbanTask ? "disabled" : ""}>${icon("link")}<span>Save Children</span></button>
      </form>
    </section>
  `;
}

function kanbanTaskRecoveryView(task: KanbanTask) {
  const resultDraft = state.kanbanRecoveryResultDraft || task.result || "";
  return `
    <section class="summary-panel kanban-panel">
      <h2>Recovery</h2>
      <form class="kanban-recovery-form" data-kanban-recovery-form>
        <div class="kanban-list-actions">
          <button class="secondary-button" type="button" data-action="specify-kanban-task" ${state.isOperatingOnKanbanTask ? "disabled" : ""}>${icon("activity")}<span>Specify</span></button>
        </div>
        <label><span>Reason</span><input name="reason" value="${escapeAttribute(state.kanbanRecoveryReasonDraft)}" autocomplete="off" /></label>
        <div class="kanban-list-actions">
          <button class="secondary-button" type="button" data-action="reclaim-kanban-task" ${state.isOperatingOnKanbanTask ? "disabled" : ""}>${icon("undo")}<span>Reclaim</span></button>
        </div>
        <div class="form-grid">
          <label><span>Assignee</span><input name="assignee" value="${escapeAttribute(state.kanbanRecoveryAssigneeDraft)}" autocomplete="off" /></label>
          <label class="checkbox-label"><input name="reclaimFirst" type="checkbox" ${state.kanbanReclaimBeforeReassign ? "checked" : ""} /><span>Reclaim first</span></label>
        </div>
        <button class="secondary-button" type="button" data-action="reassign-kanban-task" ${state.isOperatingOnKanbanTask ? "disabled" : ""}>${icon("user")}<span>Reassign</span></button>
        <label><span>Result</span><textarea name="result" rows="5">${escapeHtml(resultDraft)}</textarea></label>
        <label><span>Summary</span><input name="summary" value="${escapeAttribute(state.kanbanRecoverySummaryDraft)}" autocomplete="off" /></label>
        <label><span>Metadata JSON</span><textarea name="metadata" rows="4">${escapeHtml(state.kanbanRecoveryMetadataDraft)}</textarea></label>
        <button class="secondary-button" type="button" data-action="edit-kanban-result" ${state.isOperatingOnKanbanTask ? "disabled" : ""}>${icon("save")}<span>Edit Result</span></button>
      </form>
    </section>
  `;
}

function kanbanHomeChannelsView(detail: KanbanTaskDetail | null) {
  if (!detail || !detail.home_channels.length) {
    return "";
  }
  return `
    <section class="summary-panel kanban-panel">
      <h2>Home Channels</h2>
      <div class="kanban-home-list">
        ${detail.home_channels.map((home) => `
          <div class="kanban-home-row">
            <div>
              <strong>${escapeHtml(home.name || home.platform)}</strong>
              <span>${escapeHtml([home.platform, home.chat_id, home.thread_id].filter(Boolean).join(" · "))}</span>
            </div>
            <button class="${home.subscribed ? "danger-button" : "secondary-button"}" type="button" data-kanban-home-platform="${escapeAttribute(home.platform)}" data-kanban-home-subscribed="${home.subscribed ? "true" : "false"}" ${state.isOperatingOnKanbanTask ? "disabled" : ""}>
              ${home.subscribed ? icon("trash") : icon("plus")}<span>${home.subscribed ? "Unsubscribe" : "Subscribe"}</span>
            </button>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function kanbanTaskActionButtons(task: KanbanTask) {
  const disabled = state.isOperatingOnKanbanTask ? "disabled" : "";
  return `
    ${
      normalizeKanbanStatus(task.status) === "blocked"
        ? `<button class="secondary-button" data-action="unblock-kanban-task" ${disabled}>${icon("check")}<span>Unblock</span></button>`
        : `<button class="secondary-button" data-action="block-kanban-task" ${disabled}>${icon("pause")}<span>Block</span></button>`
    }
    <button class="secondary-button" data-action="complete-kanban-task" ${disabled}>${icon("check")}<span>Complete</span></button>
    <button class="secondary-button" data-action="archive-kanban-task" ${disabled}>${icon("folder")}<span>Archive</span></button>
    <button class="danger-button" data-action="delete-kanban-task" ${disabled}>${icon("trash")}<span>Delete</span></button>
  `;
}

function kanbanTaskHistoryView(detail: KanbanTaskDetail | null) {
  if (!detail) {
    return `<div class="empty-state">No task detail loaded.</div>`;
  }
  return `
    <div class="kanban-history-grid">
      <section class="summary-panel kanban-panel">
        <h2>Comments</h2>
        ${
          detail.comments.length
            ? detail.comments.map((comment) => `<article class="kanban-history-row"><strong>${escapeHtml(comment.author)}</strong><span>${escapeHtml(formatTimestamp(comment.created_at))}</span><p>${escapeHtml(comment.body)}</p></article>`).join("")
            : `<div class="empty-state">No comments.</div>`
        }
      </section>
      <section class="summary-panel kanban-panel">
        <h2>Events</h2>
        ${
          detail.events.length
            ? detail.events.slice(-10).map((event) => `<article class="kanban-history-row"><strong>${escapeHtml(event.kind)}</strong><span>${escapeHtml(formatTimestamp(event.created_at))}</span>${event.payload ? `<pre>${escapeHtml(JSON.stringify(event.payload, null, 2))}</pre>` : ""}</article>`).join("")
            : `<div class="empty-state">No events.</div>`
        }
      </section>
    </div>
    ${
      detail.worker_log
        ? `<section class="summary-panel kanban-panel"><h2>Worker Log</h2><pre class="cron-pre">${escapeHtml(stripTerminalArtifacts(detail.worker_log))}</pre></section>`
        : ""
    }
  `;
}

function kanbanTaskEditorView() {
  const isCreate = state.kanbanTaskEditorMode === "create";
  const draft = state.kanbanTaskDraft;
  return `
    <form class="kanban-task-form" data-kanban-task-editor>
      <div class="kanban-detail-header">
        <div>
          <h2>${isCreate ? "New Kanban Task" : "Edit Kanban Task"}</h2>
          <p>${escapeHtml(state.selectedKanbanBoardSlug)}</p>
        </div>
        <div class="form-actions">
          <button class="secondary-button" type="button" data-action="cancel-kanban-task-edit">${icon("undo")}<span>Cancel</span></button>
          <button class="primary-button" type="submit" ${state.isOperatingOnKanbanTask ? "disabled" : ""}>${icon("save")}<span>${isCreate ? "Create" : "Save"}</span></button>
        </div>
      </div>
      <section class="summary-panel kanban-panel">
        <h2>Basics</h2>
        <label><span>Title</span><input name="title" value="${escapeAttribute(draft.title)}" autocomplete="off" /></label>
        <label><span>Body</span><textarea name="body" rows="8">${escapeHtml(draft.body)}</textarea></label>
        <div class="form-grid">
          <label><span>Assignee</span><input name="assignee" value="${escapeAttribute(draft.assignee)}" autocomplete="off" /></label>
          <label><span>Priority</span><input name="priority" value="${escapeAttribute(draft.priority)}" inputmode="numeric" /></label>
        </div>
        <div class="form-grid">
          <label><span>Tenant</span><input name="tenant" value="${escapeAttribute(draft.tenant)}" autocomplete="off" /></label>
          <label><span>Max retries</span><input name="maxRetriesText" value="${escapeAttribute(draft.maxRetriesText)}" inputmode="numeric" /></label>
        </div>
        <label><span>Skills</span><input name="skillsText" value="${escapeAttribute(draft.skillsText)}" placeholder="skill-one, category/skill-two" autocomplete="off" /></label>
        <label><span>Parent IDs</span><input name="parentIdsText" value="${escapeAttribute(draft.parentIdsText)}" autocomplete="off" ${isCreate ? "" : "disabled"} /></label>
        <label class="checkbox-label"><input name="startsInTriage" type="checkbox" ${draft.startsInTriage ? "checked" : ""} ${isCreate ? "" : "disabled"} /><span>Start in triage</span></label>
      </section>
    </form>
  `;
}

function placeholderView(section: SectionId) {
  const titles: Record<SectionId, string> = {
    connections: "Connections",
    overview: "Overview",
    sessions: "Sessions",
    workflows: "Workflows",
    cronjobs: "Cron Jobs",
    kanban: "Kanban",
    files: "Files",
    usage: "Usage",
    skills: "Skills",
    terminal: "Terminal",
  };
  return `
    <div class="placeholder">
      <h2>${escapeHtml(titles[section])}</h2>
      <p>This section is not available in the current app state. Select an active connection or refresh the workspace.</p>
      <button class="secondary-button" data-section="connections">${icon("network")}<span>Open Connections</span></button>
    </div>
  `;
}

function pathStatus(label: string, path: string, exists: boolean) {
  return `
    <div class="path-row">
      <span class="${exists ? "status-ok" : "status-missing"}"></span>
      <div>
        <strong>${escapeHtml(label)}</strong>
        <small>${escapeHtml(path)}</small>
      </div>
    </div>
  `;
}

function kanbanStatus(overview: RemoteDiscovery) {
  if (!overview.kanban) {
    return `<div class="empty-state">Kanban discovery unavailable.</div>`;
  }

  const dispatcher = overview.kanban.dispatcher?.running;
  return `
    <dl>
      <div><dt>Database</dt><dd>${escapeHtml(overview.kanban.database_path)}</dd></div>
      <div><dt>Database exists</dt><dd>${overview.kanban.exists ? "Yes" : "No"}</dd></div>
      <div><dt>Hermes CLI</dt><dd>${overview.kanban.has_hermes_cli ? "Found" : "Missing"}</dd></div>
      <div><dt>Kanban module</dt><dd>${overview.kanban.has_kanban_module ? "Found" : "Missing"}</dd></div>
      <div><dt>Dispatcher</dt><dd>${dispatcher === null || dispatcher === undefined ? "Unknown" : dispatcher ? "Running" : "Stopped"}</dd></div>
    </dl>
  `;
}

async function selectSection(section: SectionId) {
  if (!isSectionAvailable(section)) {
    state = {
      ...state,
      selectedSection: "connections",
      status: t("Create or select an SSH profile to start."),
      error: null,
    };
    render();
    return;
  }
  if (state.selectedSection === section) {
    if (section === "connections" && !activeConnection()) {
      state = {
        ...state,
        status: t("Create or select an SSH profile to start."),
        error: null,
      };
      render();
      return;
    }
    await ensureSectionLoaded(section);
    return;
  }
  if (state.selectedSection === "files" && section !== "files" && hasDirtyWorkspaceFiles()) {
    const confirmed = window.confirm(t("Discard unsaved Workspace Files edits before leaving Files?"));
    if (!confirmed) {
      return;
    }
    discardAllWorkspaceFileEdits();
  }
  state = { ...state, selectedSection: section, error: null, status: null };
  render();
  await ensureSectionLoaded(section);
}

async function ensureSectionLoaded(section: SectionId) {
  if (section === "sessions") {
    await ensureSessionsLoaded();
  }
  if (section === "workflows") {
    await ensureWorkflowsLoaded();
  }
  if (section === "files") {
    await ensureFilesLoaded();
  }
  if (section === "usage") {
    await ensureUsageLoaded();
  }
  if (section === "skills") {
    await ensureSkillsLoaded();
  }
  if (section === "cronjobs") {
    await ensureCronJobsLoaded();
  }
  if (section === "kanban") {
    await ensureKanbanLoaded();
  }
  if (section === "terminal" && state.terminalTabs.length === 0) {
    await openHermesChatTerminalTab({ switchToTerminal: true });
  }
}

async function handleGlobalShortcut(event: KeyboardEvent) {
  if (event.defaultPrevented || event.repeat || event.isComposing || !usesCommandModifier(event)) {
    return;
  }

  const key = event.key.toLowerCase();
  if (isEditableShortcutTarget(event.target) && event.ctrlKey && event.altKey && !event.metaKey) {
    return;
  }

  if (!event.altKey && !event.shiftKey) {
    const section = sectionKeyboardShortcuts[key];
    if (section) {
      event.preventDefault();
      await selectSection(section);
      return;
    }
  }

  if (key === "n" && event.shiftKey && !event.altKey) {
    event.preventDefault();
    beginNewConnectionEditor();
    return;
  }

  if (key === "n" && event.altKey && !event.shiftKey) {
    event.preventDefault();
    await startNewSessionChatFromCommand();
    return;
  }

  if (key === "t" && event.altKey && !event.shiftKey) {
    event.preventDefault();
    await openHermesChatTerminalTab({ switchToTerminal: true });
    return;
  }

  if (key === "r" && !event.altKey && !event.shiftKey) {
    event.preventDefault();
    if (canRefreshCurrentSection()) {
      await refreshCurrentView();
    }
    return;
  }

  if (key === "f" && !event.altKey && !event.shiftKey) {
    event.preventDefault();
    focusSearchInCurrentSection();
    return;
  }

  if (key === "s" && !event.altKey && !event.shiftKey) {
    event.preventDefault();
    if (canSaveCurrentWorkspaceFile()) {
      await saveSelectedWorkspaceFile();
    }
  }
}

function usesCommandModifier(event: KeyboardEvent) {
  return event.metaKey || event.ctrlKey;
}

function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }
  const editable = target.closest("[contenteditable='true']");
  if (editable) {
    return true;
  }
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "select" || tagName === "textarea";
}

function canRefreshCurrentSection() {
  if (!activeConnection()) {
    return false;
  }
  if (state.selectedSection === "overview") {
    return !state.isBusy;
  }
  if (state.selectedSection === "sessions") {
    return !state.isLoadingSessions;
  }
  if (state.selectedSection === "workflows") {
    return !state.isLoadingWorkflows;
  }
  if (state.selectedSection === "cronjobs") {
    return !state.isLoadingCronJobs;
  }
  if (state.selectedSection === "kanban") {
    return !state.isLoadingKanbanBoard && !state.isLoadingKanbanBoards;
  }
  if (state.selectedSection === "usage") {
    return !state.isLoadingUsage;
  }
  if (state.selectedSection === "skills") {
    return !state.isLoadingSkills;
  }
  return false;
}

function canSaveCurrentWorkspaceFile() {
  if (state.selectedSection !== "files") {
    return false;
  }
  const reference = selectedWorkspaceFileReference();
  const document = reference ? state.fileDocuments[reference.id] : null;
  return Boolean(document?.hasLoaded && !document.isLoading && document.content !== document.originalContent);
}

function canFocusSearchCurrentSection() {
  return Boolean(activeConnection() && searchFocusSelectorForSection(state.selectedSection));
}

function focusSearchInCurrentSection() {
  if (!canFocusSearchCurrentSection()) {
    return;
  }
  const selector = searchFocusSelectorForSection(state.selectedSection);
  if (!selector) {
    return;
  }
  requestAnimationFrame(() => {
    const field = app.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
    if (!field) {
      return;
    }
    field.focus();
    field.select();
  });
}

function searchFocusSelectorForSection(section: SectionId) {
  const selectors: Partial<Record<SectionId, string>> = {
    sessions: "[data-session-search] input[name='sessionQuery']",
    workflows: "[data-workflow-search] input[name='workflowQuery']",
    cronjobs: "[data-cron-search] input[name='cronQuery']",
    kanban: "[data-kanban-search] input[name='kanbanQuery']",
    skills: "[data-skill-search] input[name='skillQuery']",
  };
  return selectors[section] ?? null;
}

function beginNewConnectionEditor() {
  state = {
    ...state,
    selectedSection: "connections",
    selectedConnectionId: null,
    editor: newConnection(),
    isEditingNewConnection: true,
    error: null,
    status: null,
  };
  render();
}

async function startNewSessionChatFromCommand() {
  const active = activeConnection();
  if (!active || state.isSendingSessionMessage) {
    return;
  }

  await selectSection("sessions");
  if (state.selectedSection !== "sessions") {
    return;
  }

  state = {
    ...state,
    selectedSessionId: null,
    sessionMessages: [],
    sessionPrompt: "",
    sessionDetailMode: "chat",
    resumeCommand: null,
    resumeStartupCommand: null,
    status: t("Opening session in Terminal"),
    error: null,
  };
  render();

  try {
    const startupCommandLine = await sessionTuiStartupCommand(active, null);
    await openTerminalTab({
      startupCommandLine,
      title: `${active.label} · chat`,
      switchToTerminal: true,
    });
  } catch (error) {
    setError(error);
  }
}

function isSectionAvailable(section: SectionId) {
  return section === "connections" || Boolean(activeConnection());
}

function bindEvents() {
  app.querySelectorAll<HTMLButtonElement>("[data-section]").forEach((button) => {
    button.addEventListener("click", () => {
      const section = sectionIdValue(button.dataset.section);
      if (section) {
        void selectSection(section);
      }
    });
  });

  app.querySelectorAll<HTMLButtonElement>("[data-connection]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.connection;
      const connection = state.snapshot.connections.find((item) => item.id === id);
      if (!connection) {
        return;
      }
      state = {
        ...state,
        selectedConnectionId: id ?? null,
        editor: structuredClone(connection),
        isEditingNewConnection: false,
        error: null,
        status: null,
      };
      render();
    });
  });

  app.querySelectorAll<HTMLButtonElement>("[data-session]").forEach((button) => {
    button.addEventListener("click", () => {
      const sessionId = button.dataset.session;
      if (!sessionId) {
        return;
      }
      state = {
        ...state,
        selectedSessionId: sessionId,
        sessionMessages: [],
        error: null,
        status: null,
      };
      render();
      void loadSelectedSessionTranscript();
    });
  });

  app.querySelectorAll<HTMLButtonElement>("[data-session-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.sessionMode === "chat" ? "chat" : "transcript";
      state = { ...state, sessionDetailMode: mode, resumeCommand: null, resumeStartupCommand: null };
      render();
    });
  });

  app.querySelector<HTMLFormElement>("[data-workflow-search]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    state = { ...state, workflowQuery: String(data.get("workflowQuery") ?? "").trim() };
    render();
  });

  app.querySelectorAll<HTMLButtonElement>("[data-workflow]").forEach((button) => {
    button.addEventListener("click", () => {
      const workflowId = button.dataset.workflow;
      if (workflowId) {
        selectWorkflow(workflowId);
      }
    });
  });

  app.querySelector<HTMLFormElement>("[data-workflow-editor]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void saveWorkflowDraft();
  });

  app.querySelector<HTMLFormElement>("[data-terminal-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    state = { ...state, terminalCommand: String(data.get("terminalCommand") ?? "") };
    void runActiveTerminalCommand();
  });

  app.querySelector<HTMLTextAreaElement>("[name='terminalCommand']")?.addEventListener("input", (event) => {
    const textarea = event.currentTarget as HTMLTextAreaElement;
    state = { ...state, terminalCommand: textarea.value };
  });

  app.querySelectorAll<HTMLButtonElement>("[data-terminal-template]").forEach((button) => {
    button.addEventListener("click", () => {
      state = { ...state, terminalCommand: button.dataset.terminalTemplate ?? state.terminalCommand };
      render();
    });
  });

  app.querySelectorAll<HTMLButtonElement>("[data-terminal-rerun]").forEach((button) => {
    button.addEventListener("click", () => {
      const commandLine = button.dataset.terminalRerun;
      if (!commandLine) {
        return;
      }
      state = { ...state, terminalCommand: commandLine };
      void runActiveTerminalCommand();
    });
  });

  app.querySelectorAll<HTMLButtonElement>("[data-terminal-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const tabId = button.dataset.terminalTab;
      if (tabId) {
        state = { ...state, selectedTerminalTabId: tabId };
        render();
        scrollTerminalToBottom();
      }
    });
  });

  app.querySelectorAll<HTMLButtonElement>("[data-terminal-close]").forEach((button) => {
    button.addEventListener("click", () => {
      const tabId = button.dataset.terminalClose;
      if (tabId) {
        void closeTerminalTab(tabId);
      }
    });
  });

  app.querySelector<HTMLSelectElement>("[data-terminal-theme]")?.addEventListener("change", (event) => {
    const select = event.currentTarget as HTMLSelectElement;
    const nextTheme = terminalThemePresets.some((preset) => preset.id === select.value)
      ? (select.value as TerminalThemeStyle)
      : "graphite";
    state = { ...state, terminalThemeStyle: nextTheme };
    render();
    scrollTerminalToBottom();
  });

  app.querySelector<HTMLFormElement>("[data-terminal-input-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const tab = selectedTerminalTab();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const input = String(data.get("terminalInput") ?? "");
    if (!tab || !input) {
      return;
    }
    if (isTerminalControlNoise(input)) {
      state = {
        ...state,
        terminalError: t("Terminal control sequence ignored."),
        terminalTabs: state.terminalTabs.map((item) => (item.id === tab.id ? { ...item, inputDraft: "" } : item)),
      };
      render();
      return;
    }
    form.reset();
    const inputElement = form.elements.namedItem("terminalInput");
    if (inputElement instanceof HTMLInputElement) {
      inputElement.value = "";
    }
    updateTerminalTab(tab.id, { inputDraft: "" }, false);
    void sendTerminalInput(tab.id, `${input}\r`);
  });

  app.querySelector<HTMLInputElement>("[name='terminalInput']")?.addEventListener("input", (event) => {
    const tab = selectedTerminalTab();
    if (!tab) {
      return;
    }
    updateTerminalTab(tab.id, { inputDraft: (event.currentTarget as HTMLInputElement).value }, false);
  });

  app.querySelectorAll<HTMLButtonElement>("[data-terminal-control]").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = selectedTerminalTab();
      if (!tab) {
        return;
      }
      const control = button.dataset.terminalControl;
      if (control === "enter") {
        void sendTerminalInput(tab.id, "\r");
      }
      if (control === "ctrl-c") {
        void sendTerminalInput(tab.id, "\x03");
      }
    });
  });

  app.querySelectorAll<HTMLInputElement>("[data-workflow-skill]").forEach((input) => {
    input.addEventListener("change", () => {
      const relativePath = input.dataset.workflowSkill;
      if (relativePath) {
        toggleWorkflowDraftSkill(relativePath, input.checked);
      }
    });
  });

  app.querySelectorAll<HTMLButtonElement>("[data-workflow-remove-skill]").forEach((button) => {
    button.addEventListener("click", () => {
      const relativePath = button.dataset.workflowRemoveSkill;
      if (relativePath) {
        removeWorkflowDraftSkill(relativePath);
      }
    });
  });

  app.querySelectorAll<HTMLButtonElement>("[data-file]").forEach((button) => {
    button.addEventListener("click", () => {
      const fileId = button.dataset.file;
      if (fileId) {
        void selectWorkspaceFile(fileId);
      }
    });
  });

  app.querySelector<HTMLFormElement>(".connection-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void saveEditor();
  });

  app.querySelector<HTMLFormElement>("[data-session-search]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    state = {
      ...state,
      sessionQuery: String(data.get("sessionQuery") ?? "").trim(),
    };
    void loadSessionsPage({ reset: true });
  });

  app.querySelector<HTMLFormElement>("[data-chat-composer]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    state = {
      ...state,
      sessionPrompt: String(data.get("prompt") ?? ""),
      autoApproveCommands: data.get("autoApproveCommands") === "on",
    };
    void sendSelectedSessionMessage();
  });

  app.querySelector<HTMLFormElement>("[data-file-browser-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    void browseWorkspaceDirectory(String(data.get("fileBrowserPath") ?? ""));
  });

  app.querySelector<HTMLTextAreaElement>("[data-file-content]")?.addEventListener("input", (event) => {
    const textarea = event.currentTarget as HTMLTextAreaElement;
    updateWorkspaceFileContent(textarea.value);
  });

  app.querySelector<HTMLFormElement>("[data-skill-search]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    state = { ...state, skillQuery: String(data.get("skillQuery") ?? "").trim() };
    render();
  });

  app.querySelector<HTMLFormElement>("[data-cron-search]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    state = { ...state, cronQuery: String(data.get("cronQuery") ?? "").trim() };
    render();
  });

  app.querySelectorAll<HTMLButtonElement>("[data-cron-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.cronFilter as CronJobFilter | undefined;
      if (filter) {
        state = { ...state, cronFilter: filter };
        render();
      }
    });
  });

  app.querySelectorAll<HTMLButtonElement>("[data-cron-job]").forEach((button) => {
    button.addEventListener("click", () => {
      const jobId = button.dataset.cronJob;
      if (!jobId) {
        return;
      }
      state = {
        ...state,
        selectedCronJobId: jobId,
        cronEditorMode: "view",
        cronDraft: emptyCronDraft(),
        cronJobsError: null,
        status: null,
        error: null,
      };
      render();
    });
  });

  app.querySelector<HTMLFormElement>("[data-cron-editor]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void saveCronDraft();
  });

  app.querySelector<HTMLSelectElement>("[data-kanban-board]")?.addEventListener("change", (event) => {
    const select = event.currentTarget as HTMLSelectElement;
    void selectKanbanBoard(select.value || "default");
  });

  app.querySelector<HTMLInputElement>("[data-kanban-include-archived]")?.addEventListener("change", (event) => {
    const input = event.currentTarget as HTMLInputElement;
    state = { ...state, includeArchivedKanbanTasks: input.checked };
    void loadKanbanPage({ resetBoards: false });
  });

  app.querySelector<HTMLFormElement>("[data-kanban-search]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    state = { ...state, kanbanQuery: String(data.get("kanbanQuery") ?? "").trim() };
    render();
  });

  app.querySelectorAll<HTMLButtonElement>("[data-kanban-task]").forEach((button) => {
    button.addEventListener("click", () => {
      const taskId = button.dataset.kanbanTask;
      if (taskId) {
        void selectKanbanTask(taskId);
      }
    });
  });

  app.querySelector<HTMLFormElement>("[data-kanban-task-editor]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void saveKanbanTaskDraft();
  });

  app.querySelector<HTMLFormElement>("[data-kanban-board-editor]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void saveKanbanBoardDraft();
  });

  app.querySelector<HTMLFormElement>("[data-kanban-comment-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    state = { ...state, kanbanCommentDraft: String(data.get("comment") ?? "") };
    void addSelectedKanbanComment();
  });

  app.querySelector<HTMLFormElement>("[data-kanban-action-form]")?.addEventListener("input", (event) => {
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    state = { ...state, kanbanActionDraft: String(data.get("actionText") ?? "") };
  });

  app.querySelector<HTMLFormElement>("[data-kanban-links-form]")?.addEventListener("input", (event) => {
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    state = {
      ...state,
      kanbanParentIdsDraft: String(data.get("parentIds") ?? ""),
      kanbanChildIdsDraft: String(data.get("childIds") ?? ""),
    };
  });

  app.querySelector<HTMLFormElement>("[data-kanban-recovery-form]")?.addEventListener("input", (event) => {
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    state = {
      ...state,
      kanbanRecoveryReasonDraft: String(data.get("reason") ?? ""),
      kanbanRecoveryAssigneeDraft: String(data.get("assignee") ?? ""),
      kanbanRecoveryResultDraft: String(data.get("result") ?? ""),
      kanbanRecoverySummaryDraft: String(data.get("summary") ?? ""),
      kanbanRecoveryMetadataDraft: String(data.get("metadata") ?? ""),
      kanbanReclaimBeforeReassign: data.get("reclaimFirst") === "on",
    };
  });

  app.querySelector<HTMLFormElement>("[data-kanban-recovery-form]")?.addEventListener("change", (event) => {
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    state = { ...state, kanbanReclaimBeforeReassign: data.get("reclaimFirst") === "on" };
  });

  app.querySelectorAll<HTMLButtonElement>("[data-kanban-home-platform]").forEach((button) => {
    button.addEventListener("click", () => {
      const platform = button.dataset.kanbanHomePlatform;
      if (!platform) {
        return;
      }
      void toggleSelectedKanbanHomeSubscription(platform, button.dataset.kanbanHomeSubscribed !== "true");
    });
  });

  app.querySelectorAll<HTMLButtonElement>("[data-skill]").forEach((button) => {
    button.addEventListener("click", () => {
      const skillId = button.dataset.skill;
      const summary = state.skills.find((skill) => skill.id === skillId);
      if (summary) {
        void selectSkill(summary);
      }
    });
  });

  app.querySelector<HTMLTextAreaElement>("[data-skill-draft]")?.addEventListener("input", (event) => {
    const textarea = event.currentTarget as HTMLTextAreaElement;
    state = { ...state, skillDraftContent: textarea.value };
  });

  app.querySelector<HTMLInputElement>("[data-new-skill-path]")?.addEventListener("input", (event) => {
    const input = event.currentTarget as HTMLInputElement;
    state = { ...state, newSkillPath: input.value };
  });

  app.querySelectorAll<HTMLInputElement>("[data-skill-folder]").forEach((input) => {
    input.addEventListener("change", () => {
      state = {
        ...state,
        createSkillReferences:
          app.querySelector<HTMLInputElement>("[data-skill-folder='references']")?.checked ?? state.createSkillReferences,
        createSkillScripts:
          app.querySelector<HTMLInputElement>("[data-skill-folder='scripts']")?.checked ?? state.createSkillScripts,
        createSkillTemplates:
          app.querySelector<HTMLInputElement>("[data-skill-folder='templates']")?.checked ?? state.createSkillTemplates,
      };
    });
  });

  app.querySelector<HTMLInputElement>("[data-auto-update-checks]")?.addEventListener("change", (event) => {
    const input = event.currentTarget as HTMLInputElement;
    void updateAutomaticUpdateChecks(input.checked);
  });

  app.querySelector<HTMLSelectElement>("[data-locale-select]")?.addEventListener("change", (event) => {
    const select = event.currentTarget as HTMLSelectElement;
    void updateAppLocale(select.value as AppLocale);
  });

  app.querySelectorAll<HTMLButtonElement>("[data-browse-path]").forEach((button) => {
    button.addEventListener("click", () => {
      const path = button.dataset.browsePath;
      if (path) {
        void browseWorkspaceDirectory(path);
      }
    });
  });

  app.querySelectorAll<HTMLButtonElement>("[data-add-bookmark]").forEach((button) => {
    button.addEventListener("click", () => {
      const path = button.dataset.addBookmark;
      if (path) {
        void addWorkspaceFileBookmark(path, false);
      }
    });
  });

  const detailPanel = app.querySelector<HTMLElement>(".session-detail-panel");
  if (detailPanel && state.selectedSessionId) {
    const sessionId = state.selectedSessionId;
    requestAnimationFrame(() => {
      detailPanel.scrollTop = state.sessionScrollOffsets[sessionId] ?? detailPanel.scrollTop;
    });
    detailPanel.addEventListener("scroll", () => {
      state.sessionScrollOffsets[sessionId] = detailPanel.scrollTop;
    });
  }

  app.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (action === "new-connection") {
        beginNewConnectionEditor();
      }
      if (action === "new-session-chat") {
        void startNewSessionChatFromCommand();
      }
      if (action === "refresh") {
        void refreshCurrentView();
      }
      if (action === "check-updates") {
        void checkForUpdatesFromCommand();
      }
      if (action === "toggle-theme") {
        toggleAppTheme();
      }
      if (action === "cycle-design-theme") {
        cycleDesignAppTheme();
      }
      if (action === "clear-error") {
        state = { ...state, error: null };
        render();
      }
      if (action === "clear-update-error") {
        state = { ...state, updateCheckError: null };
        render();
      }
      if (action === "clear-status") {
        state = { ...state, status: null };
        render();
      }
      if (action === "dismiss-update") {
        state = { ...state, availableUpdate: null, updateCheckError: null, status: null };
        render();
      }
      if (action === "open-update-release" && state.availableUpdate) {
        const update = state.availableUpdate;
        window.open(update.htmlUrl, "_blank", "noopener,noreferrer");
        state = { ...state, availableUpdate: null, status: tf("Opening Hermes Desktop %@ release.", update.latestVersion) };
        render();
      }
      if (action === "test-editor") {
        void testEditor();
      }
      if (action === "use-connection") {
        void useSelectedConnection();
      }
      if (action === "delete-connection") {
        void removeSelectedConnection();
      }
      if (action === "reload-sessions") {
        void loadSessionsPage({ reset: true });
      }
      if (action === "load-more-sessions") {
        void loadSessionsPage({ reset: false });
      }
      if (action === "reload-session-detail") {
        void loadSelectedSessionTranscript();
      }
      if (action === "delete-session") {
        void removeSelectedSession();
      }
      if (action === "toggle-session-pin") {
        void toggleSelectedSessionPin();
      }
      if (action === "show-resume-command") {
        void showSelectedSessionResumeCommand();
      }
      if (action === "reload-workflows") {
        void loadWorkflowsPage({ reset: true });
      }
      if (action === "new-workflow") {
        beginCreateWorkflow();
      }
      if (action === "cancel-workflow-edit") {
        cancelWorkflowEditing();
      }
      if (action === "edit-workflow") {
        beginEditWorkflow();
      }
      if (action === "delete-workflow") {
        void removeSelectedWorkflow();
      }
      if (action === "preview-workflow-launch") {
        void loadSelectedWorkflowLaunchPreview();
      }
      if (action === "launch-workflow-terminal") {
        void launchSelectedWorkflowInTerminal();
      }
      if (action === "launch-workflow-chat") {
        void launchSelectedWorkflowInChat();
      }
      if (action === "resume-session-terminal") {
        void resumeSelectedSessionInTerminal();
      }
      if (action === "new-terminal-tab") {
        void openHermesChatTerminalTab({ switchToTerminal: true });
      }
      if (action === "reconnect-terminal-tab") {
        void reconnectSelectedTerminalTab();
      }
      if (action === "stop-terminal-tab") {
        const tab = selectedTerminalTab();
        if (tab) {
          void stopTerminalSession(tab.id);
          updateTerminalTab(tab.id, { status: "exited", exitCode: tab.exitCode ?? -1 });
        }
      }
      if (action === "clear-terminal-output") {
        const tab = selectedTerminalTab();
        if (tab) {
          const renderer = terminalRenderers.get(tab.id);
          renderer?.terminal.clear();
          if (renderer) {
            renderer.writtenLength = 0;
          }
          updateTerminalTab(tab.id, { output: "", stderrOutput: "" });
        }
      }
      if (action === "paste-terminal-initial-input") {
        const tab = selectedTerminalTab();
        if (tab?.initialInput) {
          void sendTerminalInput(tab.id, terminalBracketedPaste(tab.initialInput));
        }
      }
      if (action === "clear-terminal-history") {
        state = { ...state, terminalHistory: [], terminalError: null, status: t("Terminal output cleared.") };
        render();
      }
      if (action === "toggle-file-browser") {
        state = { ...state, isFileBrowserOpen: !state.isFileBrowserOpen };
        render();
        if (state.isFileBrowserOpen && !state.fileBrowserListing) {
          void browseWorkspaceDirectory(workspaceFileBrowserDefaultPath());
        }
      }
      if (action === "browse-hermes-home") {
        void browseWorkspaceDirectory(workspaceFileBrowserDefaultPath());
      }
      if (action === "browse-home") {
        void browseWorkspaceDirectory("~");
      }
      if (action === "browse-up" && state.fileBrowserListing?.parent_display_path) {
        void browseWorkspaceDirectory(state.fileBrowserListing.parent_display_path);
      }
      if (action === "add-browser-path") {
        const input = app.querySelector<HTMLInputElement>("[name='fileBrowserPath']");
        void addWorkspaceFileBookmark(input?.value ?? state.fileBrowserPath, false);
      }
      if (action === "reload-workspace-file") {
        void reloadSelectedWorkspaceFile();
      }
      if (action === "save-workspace-file") {
        void saveSelectedWorkspaceFile();
      }
      if (action === "discard-workspace-file") {
        discardSelectedWorkspaceFile();
      }
      if (action === "remove-selected-file-bookmark") {
        void removeSelectedWorkspaceFileBookmark();
      }
      if (action === "reload-usage") {
        void loadUsageSummary({ forceRefresh: true });
      }
      if (action === "reload-skills") {
        void loadSkillsPage({ reset: true });
      }
      if (action === "new-skill") {
        beginCreateSkill();
      }
      if (action === "cancel-skill-edit") {
        cancelSkillEditing();
      }
      if (action === "edit-skill") {
        beginEditSkill();
      }
      if (action === "save-skill") {
        void saveSkillDraft();
      }
      if (action === "reload-cron-jobs") {
        void loadCronJobsPage({ reset: true });
      }
      if (action === "new-cron-job") {
        beginCreateCronJob();
      }
      if (action === "cancel-cron-edit") {
        cancelCronEditing();
      }
      if (action === "edit-cron-job") {
        beginEditCronJob();
      }
      if (action === "run-cron-job") {
        void runSelectedCronJobNow();
      }
      if (action === "toggle-cron-pause") {
        void toggleSelectedCronJobPause();
      }
      if (action === "remove-cron-job") {
        void removeSelectedCronJob();
      }
      if (action === "reload-kanban") {
        void loadKanbanPage({ resetBoards: true });
      }
      if (action === "new-kanban-board") {
        beginCreateKanbanBoard();
      }
      if (action === "cancel-kanban-board-edit") {
        state = { ...state, kanbanBoardEditorOpen: false, kanbanBoardDraft: emptyKanbanBoardDraft() };
        render();
      }
      if (action === "new-kanban-task") {
        beginCreateKanbanTask();
      }
      if (action === "cancel-kanban-task-edit") {
        cancelKanbanTaskEditing();
      }
      if (action === "edit-kanban-task") {
        beginEditKanbanTask();
      }
      if (action === "assign-kanban-task") {
        void assignSelectedKanbanTask();
      }
      if (action === "save-kanban-parents") {
        void saveSelectedKanbanParents();
      }
      if (action === "save-kanban-children") {
        void saveSelectedKanbanChildren();
      }
      if (action === "specify-kanban-task") {
        void operateSelectedKanbanTask(t("Specifying Kanban task"), (active, boardSlug, task) =>
          specifyKanbanTask(active, boardSlug, task.id),
        );
      }
      if (action === "reclaim-kanban-task") {
        void reclaimSelectedKanbanTask();
      }
      if (action === "reassign-kanban-task") {
        void reassignSelectedKanbanTask();
      }
      if (action === "edit-kanban-result") {
        void editSelectedKanbanResult();
      }
      if (action === "block-kanban-task") {
        void blockSelectedKanbanTask();
      }
      if (action === "unblock-kanban-task") {
        void operateSelectedKanbanTask(t("Unblocking Kanban task"), (active, boardSlug, task) =>
          unblockKanbanTask(active, boardSlug, task.id),
        );
      }
      if (action === "complete-kanban-task") {
        void completeSelectedKanbanTask();
      }
      if (action === "archive-kanban-task") {
        void operateSelectedKanbanTask(t("Archiving Kanban task"), (active, boardSlug, task) =>
          archiveKanbanTask(active, boardSlug, task.id),
        );
      }
      if (action === "delete-kanban-task") {
        void deleteSelectedKanbanTask();
      }
      if (action === "dispatch-kanban") {
        void dispatchSelectedKanbanBoard();
      }
      if (action === "archive-kanban-board") {
        void archiveSelectedKanbanBoard();
      }
    });
  });
}

async function saveEditor() {
  const form = app.querySelector<HTMLFormElement>(".connection-form");
  if (!form) {
    return;
  }
  setBusy(true, t("Saving connection"));
  try {
    const profile = readProfileForm(form);
    const saved = await saveConnection(profile);
    const existing = state.snapshot.connections.filter((connection) => connection.id !== saved.id);
    const connections = [...existing, saved].sort((left, right) => left.label.localeCompare(right.label));
    state = {
      ...state,
      snapshot: { ...state.snapshot, connections },
      selectedConnectionId: saved.id,
      editor: structuredClone(saved),
      isEditingNewConnection: false,
      error: null,
      status: t("Connection saved."),
    };
    render();
  } catch (error) {
    setError(error);
  } finally {
    setBusy(false);
  }
}

async function testEditor() {
  const form = app.querySelector<HTMLFormElement>(".connection-form");
  if (!form) {
    return;
  }
  let profile: ConnectionProfile;
  try {
    profile = readProfileForm(form);
  } catch (error) {
    setError(error);
    return;
  }
  state = { ...state, editor: profile, selectedConnectionId: state.isEditingNewConnection ? null : profile.id };
  setBusy(true, t("Testing SSH connection"));
  try {
    const discovery = await testConnection(profile);
    state = {
      ...state,
      selectedConnectionId: state.isEditingNewConnection ? null : profile.id,
      editor: profile,
      overview: discovery,
      status: tf("SSH OK: %@", discovery.hermes_home),
      error: null,
    };
    render();
  } catch (error) {
    setError(error);
  } finally {
    setBusy(false);
  }
}

async function useSelectedConnection() {
  const id = state.editor?.id ?? state.selectedConnectionId;
  if (!id) {
    return;
  }
  if (hasDirtyWorkspaceFiles()) {
    const confirmed = window.confirm(t("Discard unsaved Workspace Files edits before switching the active host?"));
    if (!confirmed) {
      return;
    }
    discardAllWorkspaceFileEdits();
  }
  await stopAllTerminalTabs();
  setBusy(true, t("Selecting host"));
  try {
    const snapshot = await setActiveConnection(id);
    const active = snapshot.connections.find((connection) => connection.id === id) ?? null;
    state = {
      ...state,
      snapshot,
      selectedConnectionId: id,
      selectedSection: active ? "overview" : "connections",
      editor: active ? structuredClone(active) : state.editor,
      isEditingNewConnection: false,
      sessions: [],
      sessionTotalCount: 0,
      sessionOffset: 0,
      selectedSessionId: null,
      sessionMessages: [],
      sessionsLoaded: false,
      workflows: [],
      selectedWorkflowId: null,
      workflowsLoaded: false,
      workflowsError: null,
      isLoadingWorkflows: false,
      isSavingWorkflow: false,
      isOperatingOnWorkflow: false,
      workflowEditorMode: "view",
      workflowDraft: emptyWorkflowDraft(),
      workflowLaunchPreview: null,
      terminalCommand: "pwd && hermes --version",
      terminalHistory: [],
      terminalError: null,
      isRunningTerminalCommand: false,
      terminalTabs: [],
      selectedTerminalTabId: null,
      workspaceFileBookmarks: [],
      selectedWorkspaceFileId: "canonical:memory",
      fileDocuments: {},
      fileBrowserListing: null,
      fileBrowserError: null,
      fileBrowserPath: "",
      isFileBrowserOpen: false,
      usageSummary: null,
      usageProfileBreakdown: null,
      usageError: null,
      isLoadingUsage: false,
      skills: [],
      selectedSkillId: null,
      selectedSkillDetail: null,
      skillsLoaded: false,
      skillsError: null,
      isLoadingSkills: false,
      isLoadingSkillDetail: false,
      isSavingSkill: false,
      skillEditorMode: "view",
      skillDraftContent: "",
      newSkillPath: "",
      cronJobs: [],
      selectedCronJobId: null,
      cronJobsLoaded: false,
      cronJobsError: null,
      isLoadingCronJobs: false,
      isOperatingOnCronJob: false,
      cronEditorMode: "view",
      cronDraft: emptyCronDraft(),
      kanbanBoards: null,
      kanbanBoard: null,
      selectedKanbanBoardSlug: "default",
      selectedKanbanTaskId: null,
      selectedKanbanTaskDetail: null,
      kanbanLoaded: false,
      kanbanError: null,
      isLoadingKanbanBoards: false,
      isLoadingKanbanBoard: false,
      isLoadingKanbanTaskDetail: false,
      isOperatingOnKanbanTask: false,
      isOperatingOnKanbanBoard: false,
      isDispatchingKanban: false,
      kanbanTaskEditorMode: "view",
      kanbanTaskDraft: emptyKanbanTaskDraft(),
      kanbanBoardEditorOpen: false,
      kanbanBoardDraft: emptyKanbanBoardDraft(),
      kanbanCommentDraft: "",
      kanbanActionDraft: "",
      kanbanParentIdsDraft: "",
      kanbanChildIdsDraft: "",
      kanbanRecoveryReasonDraft: "",
      kanbanRecoveryAssigneeDraft: "",
      kanbanRecoveryResultDraft: "",
      kanbanRecoverySummaryDraft: "",
      kanbanRecoveryMetadataDraft: "",
      kanbanReclaimBeforeReassign: true,
      status: active ? t("Active host selected.") : null,
      error: null,
    };
    render();
    if (active) {
      await refreshWorkspaceFileBookmarks(active);
      await refreshOverview(active);
    }
  } catch (error) {
    setError(error);
  } finally {
    setBusy(false);
  }
}

async function removeSelectedConnection() {
  const profile = state.editor;
  if (!profile) {
    return;
  }
  const confirmed = window.confirm(tf('Delete connection "%@"?', profile.label));
  if (!confirmed) {
    return;
  }
  await stopTerminalTabsForProfile(profile.id);
  setBusy(true, t("Deleting connection"));
  try {
    await deleteConnection(profile.id);
    const connections = state.snapshot.connections.filter((connection) => connection.id !== profile.id);
    const nextActive =
      state.snapshot.preferences.activeConnectionId === profile.id
        ? null
        : state.snapshot.preferences.activeConnectionId;
    state = {
      ...state,
      snapshot: {
        ...state.snapshot,
        connections,
        preferences: { ...state.snapshot.preferences, activeConnectionId: nextActive },
      },
      selectedConnectionId: nextActive,
      selectedSection: nextActive ? state.selectedSection : "connections",
      editor: connections[0] ? structuredClone(connections[0]) : newConnection(),
      isEditingNewConnection: connections.length === 0,
      overview: nextActive ? state.overview : null,
      sessions: nextActive ? state.sessions : [],
      sessionTotalCount: nextActive ? state.sessionTotalCount : 0,
      sessionOffset: nextActive ? state.sessionOffset : 0,
      selectedSessionId: nextActive ? state.selectedSessionId : null,
      sessionMessages: nextActive ? state.sessionMessages : [],
      sessionsLoaded: nextActive ? state.sessionsLoaded : false,
      workflows: nextActive ? state.workflows : [],
      selectedWorkflowId: nextActive ? state.selectedWorkflowId : null,
      workflowsLoaded: nextActive ? state.workflowsLoaded : false,
      workflowsError: nextActive ? state.workflowsError : null,
      isLoadingWorkflows: nextActive ? state.isLoadingWorkflows : false,
      isSavingWorkflow: nextActive ? state.isSavingWorkflow : false,
      isOperatingOnWorkflow: nextActive ? state.isOperatingOnWorkflow : false,
      workflowEditorMode: nextActive ? state.workflowEditorMode : "view",
      workflowDraft: nextActive ? state.workflowDraft : emptyWorkflowDraft(),
      workflowLaunchPreview: nextActive ? state.workflowLaunchPreview : null,
      terminalCommand: nextActive ? state.terminalCommand : "pwd && hermes --version",
      terminalHistory: nextActive ? state.terminalHistory : [],
      terminalError: nextActive ? state.terminalError : null,
      isRunningTerminalCommand: nextActive ? state.isRunningTerminalCommand : false,
      terminalTabs: nextActive ? state.terminalTabs.filter((tab) => tab.profileId !== profile.id) : [],
      selectedTerminalTabId: nextActive
        ? state.terminalTabs.filter((tab) => tab.profileId !== profile.id).at(-1)?.id ?? null
        : null,
      workspaceFileBookmarks: nextActive ? state.workspaceFileBookmarks : [],
      selectedWorkspaceFileId: nextActive ? state.selectedWorkspaceFileId : "canonical:memory",
      fileDocuments: nextActive ? state.fileDocuments : {},
      fileBrowserListing: nextActive ? state.fileBrowserListing : null,
      fileBrowserError: nextActive ? state.fileBrowserError : null,
      fileBrowserPath: nextActive ? state.fileBrowserPath : "",
      isFileBrowserOpen: nextActive ? state.isFileBrowserOpen : false,
      usageSummary: nextActive ? state.usageSummary : null,
      usageProfileBreakdown: nextActive ? state.usageProfileBreakdown : null,
      usageError: nextActive ? state.usageError : null,
      isLoadingUsage: nextActive ? state.isLoadingUsage : false,
      skills: nextActive ? state.skills : [],
      selectedSkillId: nextActive ? state.selectedSkillId : null,
      selectedSkillDetail: nextActive ? state.selectedSkillDetail : null,
      skillsLoaded: nextActive ? state.skillsLoaded : false,
      skillsError: nextActive ? state.skillsError : null,
      isLoadingSkills: nextActive ? state.isLoadingSkills : false,
      isLoadingSkillDetail: nextActive ? state.isLoadingSkillDetail : false,
      isSavingSkill: nextActive ? state.isSavingSkill : false,
      skillEditorMode: nextActive ? state.skillEditorMode : "view",
      skillDraftContent: nextActive ? state.skillDraftContent : "",
      newSkillPath: nextActive ? state.newSkillPath : "",
      cronJobs: nextActive ? state.cronJobs : [],
      selectedCronJobId: nextActive ? state.selectedCronJobId : null,
      cronJobsLoaded: nextActive ? state.cronJobsLoaded : false,
      cronJobsError: nextActive ? state.cronJobsError : null,
      isLoadingCronJobs: nextActive ? state.isLoadingCronJobs : false,
      isOperatingOnCronJob: nextActive ? state.isOperatingOnCronJob : false,
      cronEditorMode: nextActive ? state.cronEditorMode : "view",
      cronDraft: nextActive ? state.cronDraft : emptyCronDraft(),
      kanbanBoards: nextActive ? state.kanbanBoards : null,
      kanbanBoard: nextActive ? state.kanbanBoard : null,
      selectedKanbanBoardSlug: nextActive ? state.selectedKanbanBoardSlug : "default",
      selectedKanbanTaskId: nextActive ? state.selectedKanbanTaskId : null,
      selectedKanbanTaskDetail: nextActive ? state.selectedKanbanTaskDetail : null,
      kanbanLoaded: nextActive ? state.kanbanLoaded : false,
      kanbanError: nextActive ? state.kanbanError : null,
      isLoadingKanbanBoards: nextActive ? state.isLoadingKanbanBoards : false,
      isLoadingKanbanBoard: nextActive ? state.isLoadingKanbanBoard : false,
      isLoadingKanbanTaskDetail: nextActive ? state.isLoadingKanbanTaskDetail : false,
      isOperatingOnKanbanTask: nextActive ? state.isOperatingOnKanbanTask : false,
      isOperatingOnKanbanBoard: nextActive ? state.isOperatingOnKanbanBoard : false,
      isDispatchingKanban: nextActive ? state.isDispatchingKanban : false,
      kanbanTaskEditorMode: nextActive ? state.kanbanTaskEditorMode : "view",
      kanbanTaskDraft: nextActive ? state.kanbanTaskDraft : emptyKanbanTaskDraft(),
      kanbanBoardEditorOpen: nextActive ? state.kanbanBoardEditorOpen : false,
      kanbanBoardDraft: nextActive ? state.kanbanBoardDraft : emptyKanbanBoardDraft(),
      kanbanCommentDraft: nextActive ? state.kanbanCommentDraft : "",
      kanbanActionDraft: nextActive ? state.kanbanActionDraft : "",
      kanbanParentIdsDraft: nextActive ? state.kanbanParentIdsDraft : "",
      kanbanChildIdsDraft: nextActive ? state.kanbanChildIdsDraft : "",
      kanbanRecoveryReasonDraft: nextActive ? state.kanbanRecoveryReasonDraft : "",
      kanbanRecoveryAssigneeDraft: nextActive ? state.kanbanRecoveryAssigneeDraft : "",
      kanbanRecoveryResultDraft: nextActive ? state.kanbanRecoveryResultDraft : "",
      kanbanRecoverySummaryDraft: nextActive ? state.kanbanRecoverySummaryDraft : "",
      kanbanRecoveryMetadataDraft: nextActive ? state.kanbanRecoveryMetadataDraft : "",
      kanbanReclaimBeforeReassign: nextActive ? state.kanbanReclaimBeforeReassign : true,
      status: t("Connection deleted."),
      error: null,
    };
    render();
  } catch (error) {
    setError(error);
  } finally {
    setBusy(false);
  }
}

async function refreshOverview(profile: ConnectionProfile) {
  setBusy(true, t("Refreshing remote workspace"));
  try {
    const overview = await discoverConnection(profile);
    state = {
      ...state,
      overview,
      status: tf("Connected to %@", overview.hermes_home),
      error: null,
    };
    render();
  } catch (error) {
    setError(error);
  } finally {
    setBusy(false);
  }
}

async function refreshCurrentView() {
  const active = activeConnection();
  if (!active) {
    return;
  }
  if (state.selectedSection === "sessions") {
    await refreshPinnedSessions(active);
    await loadSessionsPage({ reset: true });
    return;
  }
  if (state.selectedSection === "workflows") {
    await loadWorkflowsPage({ reset: true });
    return;
  }
  if (state.selectedSection === "files") {
    await refreshWorkspaceFileBookmarks(active);
    await reloadSelectedWorkspaceFile(false);
    return;
  }
  if (state.selectedSection === "usage") {
    await loadUsageSummary({ forceRefresh: true });
    return;
  }
  if (state.selectedSection === "skills") {
    await loadSkillsPage({ reset: true });
    return;
  }
  if (state.selectedSection === "cronjobs") {
    await loadCronJobsPage({ reset: true });
    return;
  }
  if (state.selectedSection === "kanban") {
    await loadKanbanPage({ resetBoards: true });
    return;
  }
  await refreshOverview(active);
}

async function checkForUpdatesAtLaunch() {
  if (!state.snapshot.preferences.automaticallyChecksForUpdates) {
    return;
  }
  if (state.hasPerformedAutomaticUpdateCheck || !shouldRunAutomaticUpdateCheck()) {
    return;
  }
  state = { ...state, hasPerformedAutomaticUpdateCheck: true };
  const didCompleteCheck = await checkForUpdates(false);
  if (didCompleteCheck) {
    try {
      const snapshot = await markAutomaticUpdateCheck();
      state = { ...state, snapshot };
      render();
    } catch {
      // A failed timestamp write should not surface as an update-check failure.
    }
  }
}

async function checkForUpdatesFromCommand() {
  await checkForUpdates(true);
}

async function checkForUpdates(presentsCurrentResult: boolean) {
  if (state.isCheckingForUpdates) {
    return false;
  }

  state = {
    ...state,
    isCheckingForUpdates: true,
    updateCheckError: null,
    status: presentsCurrentResult ? t("Checking for Hermes Desktop updates...") : state.status,
  };
  render();

  try {
    const update = await checkForHermesDesktopUpdate(appVersion);
    state = {
      ...state,
      availableUpdate: update,
      isCheckingForUpdates: false,
      updateCheckError: null,
      status: update
        ? tf("Hermes Desktop update available: %@", update.latestVersion)
        : presentsCurrentResult
          ? tf("Hermes Desktop %@ is up to date.", normalizedDisplayVersion(appVersion))
          : state.status,
    };
    render();
    return true;
  } catch (error) {
    state = {
      ...state,
      isCheckingForUpdates: false,
      updateCheckError: presentsCurrentResult ? errorMessage(error) : null,
      status: presentsCurrentResult ? null : state.status,
    };
    render();
    return false;
  }
}

async function updateAutomaticUpdateChecks(enabled: boolean) {
  try {
    const snapshot = await setAutomaticUpdateChecks(enabled);
    state = {
      ...state,
      snapshot,
      status: t(enabled ? "Automatic update checks enabled." : "Automatic update checks disabled."),
      updateCheckError: null,
    };
    render();
  } catch (error) {
    setError(error);
  }
}

async function updateAppLocale(locale: AppLocale) {
  setLocale(locale);
  try {
    const snapshot = await setAppLocale(locale);
    state = {
      ...state,
      snapshot,
      status: t("Language updated."),
      error: null,
    };
    render();
  } catch (error) {
    setError(error);
  }
}

function toggleAppTheme() {
  const appTheme: AppTheme = state.appTheme === "light" ? "dark" : "light";
  state = {
    ...state,
    appTheme,
    status: t("Theme updated."),
    error: null,
  };
  render();
  scrollTerminalToBottom();
}

function cycleDesignAppTheme() {
  const appTheme = nextDesignAppTheme(state.appTheme);
  state = {
    ...state,
    appTheme,
    status: t("Theme updated."),
    error: null,
  };
  render();
  scrollTerminalToBottom();
}

function shouldRunAutomaticUpdateCheck() {
  const lastCheck = state.snapshot.preferences.lastAutomaticUpdateCheckAt;
  if (!lastCheck) {
    return true;
  }
  const timestamp = Date.parse(lastCheck);
  if (!Number.isFinite(timestamp)) {
    return true;
  }
  return Date.now() - timestamp >= automaticUpdateCheckIntervalMs;
}

async function ensureSessionsLoaded() {
  if (state.sessionsLoaded || state.isLoadingSessions) {
    return;
  }
  const active = activeConnection();
  if (active) {
    await refreshPinnedSessions(active);
  }
  await loadSessionsPage({ reset: true });
}

async function ensureWorkflowsLoaded() {
  if (state.workflowsLoaded || state.isLoadingWorkflows) {
    return;
  }
  await loadWorkflowsPage({ reset: true });
}

async function refreshPinnedSessions(profile: ConnectionProfile) {
  try {
    const pinnedSessions = await listPinnedSessions(profile);
    state = { ...state, pinnedSessions };
    render();
  } catch (error) {
    setError(error);
  }
}

async function ensureFilesLoaded() {
  const active = activeConnection();
  if (!active) {
    return;
  }
  await refreshWorkspaceFileBookmarks(active);
  const reference = selectedWorkspaceFileReference();
  if (reference) {
    await loadWorkspaceFile(reference);
  }
}

async function ensureUsageLoaded() {
  if (state.usageSummary || state.usageError || state.isLoadingUsage) {
    return;
  }
  await loadUsageSummary({ forceRefresh: false });
}

async function ensureSkillsLoaded() {
  if (state.skillsLoaded || state.isLoadingSkills) {
    return;
  }
  await loadSkillsPage({ reset: true });
}

async function ensureCronJobsLoaded() {
  if (state.cronJobsLoaded || state.isLoadingCronJobs) {
    return;
  }
  await loadCronJobsPage({ reset: true });
}

async function ensureKanbanLoaded() {
  if (state.kanbanLoaded || state.isLoadingKanbanBoard || state.isLoadingKanbanBoards) {
    return;
  }
  await loadKanbanPage({ resetBoards: true });
}

async function loadUsageSummary({ forceRefresh }: { forceRefresh: boolean }) {
  const active = activeConnection();
  if (!active || state.isLoadingUsage) {
    return;
  }
  if (!forceRefresh && (state.usageSummary || state.usageError)) {
    return;
  }

  state = {
    ...state,
    isLoadingUsage: true,
    usageError: null,
    status: t("Loading usage totals"),
    error: null,
  };
  render();

  try {
    const summary = await loadUsage(active, state.overview?.session_store ?? null);
    const usageProfileBreakdown =
      state.overview && state.overview.available_profiles.length > 1
        ? await loadUsageProfileBreakdown(active, summary, state.overview.available_profiles)
        : null;
    state = {
      ...state,
      usageSummary: summary,
      usageProfileBreakdown,
      isLoadingUsage: false,
      usageError: null,
      status: t(summary.state === "available" ? "Usage totals loaded." : "Usage unavailable."),
      error: null,
    };
    render();
  } catch (error) {
    state = {
      ...state,
      usageSummary: null,
      usageProfileBreakdown: null,
      usageError: error instanceof Error ? error.message : String(error),
      isLoadingUsage: false,
    };
    setError(error);
  }
}

async function loadUsageProfileBreakdown(
  active: ConnectionProfile,
  activeSummary: UsageSummary,
  discoveredProfiles: RemoteDiscovery["available_profiles"],
): Promise<UsageProfileSlice[]> {
  const activeProfileName = resolvedHermesProfileName(active);
  const slices: UsageProfileSlice[] = [];
  for (const profile of discoveredProfiles) {
    if (profile.name === activeProfileName) {
      slices.push(usageProfileSlice(profile.name, profile.path, activeSummary, true));
      continue;
    }

    try {
      const scopedProfile = connectionForHermesProfile(active, profile.name);
      const summary = await loadUsage(scopedProfile, null);
      slices.push(usageProfileSlice(profile.name, profile.path, summary, false));
    } catch (error) {
      slices.push({
        profileName: profile.name,
        hermesHomePath: profile.path,
        state: "unavailable",
        sessionCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        reasoningTokens: 0,
        databasePath: null,
        message: error instanceof Error ? error.message : String(error),
        isActiveProfile: profile.name === activeProfileName,
      });
    }
  }
  return slices;
}

function usageProfileSlice(
  profileName: string,
  hermesHomePath: string,
  summary: UsageSummary,
  isActiveProfile: boolean,
): UsageProfileSlice {
  return {
    profileName,
    hermesHomePath,
    state: summary.state,
    sessionCount: summary.session_count,
    inputTokens: summary.input_tokens,
    outputTokens: summary.output_tokens,
    cacheReadTokens: summary.cache_read_tokens,
    cacheWriteTokens: summary.cache_write_tokens,
    reasoningTokens: summary.reasoning_tokens,
    databasePath: summary.database_path,
    message: summary.message,
    isActiveProfile,
  };
}

function connectionForHermesProfile(profile: ConnectionProfile, profileName: string): ConnectionProfile {
  return {
    ...profile,
    hermesProfile: profileName.toLowerCase() === "default" ? null : profileName,
    customHermesHomePath: null,
  };
}

async function loadWorkflowsPage({ reset }: { reset: boolean }) {
  const active = activeConnection();
  if (!active || state.isLoadingWorkflows) {
    return;
  }

  state = {
    ...state,
    isLoadingWorkflows: true,
    workflowsError: null,
    status: t("Loading workflows"),
    error: null,
  };
  render();

  try {
    const workflows = await listWorkflows(active);
    let skills = state.skills;
    let skillsLoaded = state.skillsLoaded;
    let skillsError = state.skillsError;
    if (!state.skillsLoaded && !state.isLoadingSkills) {
      try {
        skills = await listSkills(active);
        skillsLoaded = true;
        skillsError = null;
      } catch (error) {
        skillsError = error instanceof Error ? error.message : String(error);
      }
    }
    const selectedWorkflowId =
      state.selectedWorkflowId && workflows.some((workflow) => workflow.id === state.selectedWorkflowId)
        ? state.selectedWorkflowId
        : workflows[0]?.id ?? null;
    state = {
      ...state,
      workflows,
      selectedWorkflowId,
      workflowsLoaded: true,
      workflowsError: null,
      isLoadingWorkflows: false,
      workflowEditorMode: reset ? "view" : state.workflowEditorMode,
      workflowDraft: reset ? emptyWorkflowDraft() : state.workflowDraft,
      workflowLaunchPreview: reset ? null : state.workflowLaunchPreview,
      skills,
      skillsLoaded,
      skillsError,
      status: tf("Loaded %@ workflows.", workflows.length),
      error: null,
    };
    render();
  } catch (error) {
    state = {
      ...state,
      isLoadingWorkflows: false,
      workflowsError: error instanceof Error ? error.message : String(error),
    };
    setError(error);
  }
}

function selectWorkflow(workflowId: string) {
  state = {
    ...state,
    selectedWorkflowId: workflowId,
    workflowEditorMode: "view",
    workflowDraft: emptyWorkflowDraft(),
    workflowLaunchPreview: null,
    workflowsError: null,
    status: null,
    error: null,
  };
  render();
}

function beginCreateWorkflow() {
  state = {
    ...state,
    selectedWorkflowId: null,
    workflowEditorMode: "create",
    workflowDraft: emptyWorkflowDraft(),
    workflowLaunchPreview: null,
    workflowsError: null,
    status: null,
    error: null,
  };
  render();
}

function beginEditWorkflow() {
  const workflow = selectedWorkflow();
  if (!workflow) {
    return;
  }
  state = {
    ...state,
    workflowEditorMode: "edit",
    workflowDraft: workflowDraftFromWorkflow(workflow),
    workflowLaunchPreview: null,
    workflowsError: null,
    status: null,
    error: null,
  };
  render();
}

function cancelWorkflowEditing() {
  state = {
    ...state,
    workflowEditorMode: "view",
    workflowDraft: emptyWorkflowDraft(),
    workflowsError: null,
  };
  render();
}

async function saveWorkflowDraft() {
  const active = activeConnection();
  const form = app.querySelector<HTMLFormElement>("[data-workflow-editor]");
  if (!active || !form || state.isSavingWorkflow) {
    return;
  }
  const draft = readWorkflowDraft(form);
  const validationError = workflowDraftValidationError(draft);
  if (validationError) {
    state = { ...state, workflowDraft: draft, workflowsError: validationError };
    setError(validationError);
    return;
  }

  const editingWorkflowId = state.workflowEditorMode === "edit" ? state.selectedWorkflowId : null;
  state = {
    ...state,
    workflowDraft: draft,
    isSavingWorkflow: true,
    workflowsError: null,
    status: t(state.workflowEditorMode === "create" ? "Creating workflow" : "Saving workflow"),
    error: null,
  };
  render();

  try {
    const saved =
      state.workflowEditorMode === "create"
        ? await createWorkflow(active, workflowDraftPayload(draft))
        : editingWorkflowId
          ? await updateWorkflow(active, editingWorkflowId, workflowDraftPayload(draft))
          : null;
    if (!saved) {
      throw new Error(t("Select a workflow before saving."));
    }
    const workflows = await listWorkflows(active);
    state = {
      ...state,
      workflows,
      selectedWorkflowId: saved.id,
      workflowsLoaded: true,
      isSavingWorkflow: false,
      workflowEditorMode: "view",
      workflowDraft: emptyWorkflowDraft(),
      workflowLaunchPreview: null,
      workflowsError: null,
      status: tf("%@ saved.", saved.name),
      error: null,
    };
    render();
  } catch (error) {
    state = { ...state, isSavingWorkflow: false };
    setError(error);
  }
}

async function removeSelectedWorkflow() {
  const active = activeConnection();
  const workflow = selectedWorkflow();
  if (!active || !workflow || state.isOperatingOnWorkflow) {
    return;
  }
  const confirmed = window.confirm(tf('Remove workflow "%@"?', workflow.name));
  if (!confirmed) {
    return;
  }
  state = { ...state, isOperatingOnWorkflow: true, status: t("Removing workflow"), error: null };
  render();
  try {
    const workflows = await deleteWorkflow(active, workflow.id);
    state = {
      ...state,
      workflows,
      selectedWorkflowId: workflows[0]?.id ?? null,
      isOperatingOnWorkflow: false,
      workflowEditorMode: "view",
      workflowDraft: emptyWorkflowDraft(),
      workflowLaunchPreview: null,
      workflowsError: null,
      status: t("Workflow removed."),
      error: null,
    };
    render();
  } catch (error) {
    state = { ...state, isOperatingOnWorkflow: false };
    setError(error);
  }
}

async function loadSelectedWorkflowLaunchPreview() {
  const active = activeConnection();
  const workflow = selectedWorkflow();
  if (!active || !workflow || state.isOperatingOnWorkflow) {
    return;
  }
  if (workflowMissingSkillRefs(workflow).length) {
    setError(t("Workflow cannot run while assigned skills are unavailable on this host/profile."));
    return;
  }
  state = { ...state, isOperatingOnWorkflow: true, status: t("Preparing workflow launch command"), error: null };
  render();
  try {
    const preview = await workflowLaunchPreview(active, workflow.id);
    state = {
      ...state,
      workflowLaunchPreview: preview,
      isOperatingOnWorkflow: false,
      status: t("Workflow launch command prepared."),
      error: null,
    };
    render();
  } catch (error) {
    state = { ...state, isOperatingOnWorkflow: false };
    setError(error);
  }
}

async function launchSelectedWorkflowInTerminal() {
  const active = activeConnection();
  const workflow = selectedWorkflow();
  if (!active || !workflow || state.isOperatingOnWorkflow) {
    return;
  }
  if (workflowMissingSkillRefs(workflow).length) {
    setError(t("Workflow cannot run while assigned skills are unavailable on this host/profile."));
    return;
  }
  state = { ...state, isOperatingOnWorkflow: true, status: t("Opening workflow in Terminal"), error: null };
  render();
  try {
    const preview = await workflowLaunchPreview(active, workflow.id);
    await openTerminalTab({
      startupCommandLine: preview.startupCommandLine,
      initialInput: preview.initialInput,
      title: `${workflow.name} · workflow`,
      switchToTerminal: true,
    });
    state = {
      ...state,
      workflowLaunchPreview: preview,
      isOperatingOnWorkflow: false,
      status: tf("Opening %@ in Terminal.", workflow.name),
      error: null,
    };
    render();
    scrollTerminalToBottom();
  } catch (error) {
    state = { ...state, isOperatingOnWorkflow: false };
    setError(error);
  }
}

async function launchSelectedWorkflowInChat() {
  const active = activeConnection();
  const workflow = selectedWorkflow();
  if (!active || !workflow || state.isOperatingOnWorkflow) {
    return;
  }
  if (workflowMissingSkillRefs(workflow).length) {
    setError(t("Workflow cannot run while assigned skills are unavailable on this host/profile."));
    return;
  }
  state = { ...state, isOperatingOnWorkflow: true, status: t("Opening workflow in Chat"), error: null };
  render();
  try {
    const preview = await workflowLaunchPreview(active, workflow.id);
    await openTerminalTab({
      startupCommandLine: preview.chatStartupCommandLine,
      initialInput: preview.chatInitialInput,
      title: `${workflow.name} · chat`,
      switchToTerminal: true,
    });
    state = {
      ...state,
      workflowLaunchPreview: preview,
      isOperatingOnWorkflow: false,
      status: tf("Opening %@ in Chat.", workflow.name),
      error: null,
    };
    render();
    scrollTerminalToBottom();
  } catch (error) {
    state = { ...state, isOperatingOnWorkflow: false };
    setError(error);
  }
}

async function resumeSelectedSessionInTerminal() {
  const active = activeConnection();
  const session = selectedSession();
  if (!active || !session) {
    return;
  }
  state = { ...state, status: t("Opening session in Terminal"), error: null };
  render();
  try {
    const startupCommandLine = await sessionResumeStartupCommand(active, session.id);
    await openTerminalTab({
      startupCommandLine,
      title: `${resolvedSessionTitle(session)} · session`,
      switchToTerminal: true,
    });
    state = { ...state, resumeStartupCommand: startupCommandLine, status: tf("Opening %@ in Terminal.", resolvedSessionTitle(session)), error: null };
    render();
    scrollTerminalToBottom();
  } catch (error) {
    setError(error);
  }
}

async function openHermesChatTerminalTab(options: { switchToTerminal?: boolean } = {}) {
  const active = activeConnection();
  if (!active) {
    return;
  }
  try {
    const startupCommandLine = await sessionTuiStartupCommand(active, null);
    await openTerminalTab({
      startupCommandLine,
      title: `${active.label} · chat`,
      switchToTerminal: options.switchToTerminal ?? true,
    });
  } catch (error) {
    setError(error);
  }
}

async function openTerminalTab(options: {
  startupCommandLine?: string | null;
  initialInput?: string | null;
  title?: string;
  switchToTerminal?: boolean;
} = {}) {
  const active = activeConnection();
  if (!active) {
    return;
  }

  // Pre-switch if requested so the container renders and can be measured
  const shouldSwitch = options.switchToTerminal ?? false;
  state = {
    ...state,
    selectedSection: shouldSwitch ? "terminal" : state.selectedSection,
    status: t("Starting terminal session"),
    error: null,
  };
  render();

  let cols = 80;
  let rows = 24;
  const panel = app.querySelector(".terminal-live-panel") || app.querySelector(".content");
  if (panel) {
    const width = panel.clientWidth - 40; // subtract padding
    const height = panel.clientHeight - 120; // subtract header and input row
    if (width > 0 && height > 0) {
      cols = Math.max(40, Math.floor(width / 8)); // 8px font width estimate
      rows = Math.max(10, Math.floor(height / 16)); // 16px font height estimate
    }
  }

  try {
    const info = await startTerminalSession(
      active,
      options.startupCommandLine ?? null,
      options.initialInput ?? null,
      cols,
      rows,
    );
    const tab = terminalTabFromInfo({
      ...info,
      title: options.title ?? info.title,
    });
    state = {
      ...state,
      terminalTabs: [...state.terminalTabs, tab],
      selectedTerminalTabId: tab.id,
      status: t("Terminal tab opened."),
      error: null,
    };
    render();
    scrollTerminalToBottom();
  } catch (error) {
    setError(error);
  }
}

async function reconnectSelectedTerminalTab() {
  const tab = selectedTerminalTab();
  if (!tab) {
    return;
  }
  await openTerminalTab({
    startupCommandLine: tab.startupCommandLine,
    initialInput: tab.initialInput,
    title: tab.title,
  });
}

async function closeTerminalTab(tabId: string) {
  const tab = state.terminalTabs.find((item) => item.id === tabId);
  if (tab && (tab.status === "starting" || tab.status === "running")) {
    try {
      await stopTerminalSession(tab.id);
    } catch {
      // The process may already have exited; closing the UI tab should still proceed.
    }
  }
  const tabs = state.terminalTabs.filter((item) => item.id !== tabId);
  const selectedTerminalTabId =
    state.selectedTerminalTabId === tabId ? tabs.at(-1)?.id ?? null : state.selectedTerminalTabId;
  disposeTerminalRenderer(tabId);
  state = { ...state, terminalTabs: tabs, selectedTerminalTabId, status: t("Terminal tab closed.") };
  render();
}

async function stopAllTerminalTabs() {
  const runningTabs = state.terminalTabs.filter((tab) => tab.status === "starting" || tab.status === "running");
  await Promise.allSettled(runningTabs.map((tab) => stopTerminalSession(tab.id)));
  disposeAllTerminalRenderers();
}

async function stopTerminalTabsForProfile(profileId: string) {
  const runningTabs = state.terminalTabs.filter(
    (tab) => tab.profileId === profileId && (tab.status === "starting" || tab.status === "running"),
  );
  await Promise.allSettled(runningTabs.map((tab) => stopTerminalSession(tab.id)));
  for (const tab of state.terminalTabs.filter((item) => item.profileId === profileId)) {
    disposeTerminalRenderer(tab.id);
  }
}

async function sendTerminalInput(tabId: string, input: string) {
  try {
    await writeTerminalSession(tabId, input);
  } catch (error) {
    updateTerminalTab(tabId, { status: "error" });
    setError(error);
  }
}

function handleTerminalSessionEvent(event: TerminalSessionEvent) {
  const tab = state.terminalTabs.find((item) => item.id === event.sessionId);
  if (!tab) {
    return;
  }

  const patch: Partial<TerminalLiveTab> = { lastEventAt: event.timestamp };
  let shouldRender = true;
  if (event.kind === "stdout" || event.kind === "stderr") {
    const data = stripTerminalGeneratedResponses(event.data ?? "");
    patch.output = `${tab.output}${data}`;
    if (event.kind === "stderr") {
      patch.stderrOutput = `${tab.stderrOutput}${data}`;
    }
    patch.status = "running";
    shouldRender = false;
    writeTerminalRendererData(event.sessionId, data);
  }
  if (event.kind === "started") {
    patch.status = "running";
  }
  if (event.kind === "initialInputSent") {
    patch.initialInputSent = true;
  }
  if (event.kind === "exit") {
    patch.status = "exited";
    patch.exitCode = event.exitCode ?? -1;
  }
  if (event.kind === "error") {
    patch.status = "error";
    patch.output = `${tab.output}\n[Hermes Desktop] ${event.data ?? "Terminal error"}\n`;
  }

  updateTerminalTab(event.sessionId, patch, shouldRender);
  scrollTerminalToBottom();
}

function updateTerminalTab(tabId: string, patch: Partial<TerminalLiveTab>, shouldRender = true) {
  state = {
    ...state,
    terminalTabs: state.terminalTabs.map((tab) => (tab.id === tabId ? { ...tab, ...patch } : tab)),
  };
  if (shouldRender) {
    render();
  }
}

function scrollTerminalToBottom() {
  requestAnimationFrame(() => {
    const screen = app.querySelector<HTMLElement>("[data-terminal-screen]");
    if (screen) {
      screen.scrollTop = screen.scrollHeight;
    }
  });
}

async function runActiveTerminalCommand() {
  const active = activeConnection();
  const commandLine = state.terminalCommand.trim();
  if (!active || state.isRunningTerminalCommand) {
    return;
  }
  if (!commandLine) {
    state = { ...state, terminalError: t("Terminal command is required.") };
    render();
    return;
  }

  state = {
    ...state,
    terminalCommand: commandLine,
    terminalError: null,
    isRunningTerminalCommand: true,
    status: t("Running terminal command"),
    error: null,
  };
  render();

  try {
    const result = await runTerminalCommand(active, commandLine);
    state = {
      ...state,
      terminalHistory: [result, ...state.terminalHistory].slice(0, 50),
      terminalError: null,
      isRunningTerminalCommand: false,
      status: tf("Terminal command exited with code %@.", result.exitCode),
      error: null,
    };
    render();
  } catch (error) {
    state = {
      ...state,
      terminalError: error instanceof Error ? error.message : String(error),
      isRunningTerminalCommand: false,
    };
    setError(error);
  }
}

function toggleWorkflowDraftSkill(relativePath: string, isSelected: boolean) {
  const skill = state.skills.find((item) => item.relative_path === relativePath);
  if (!skill) {
    return;
  }
  const draft = currentWorkflowDraft();
  const reference = workflowReferenceFromSkill(skill);
  const selectedSkills = isSelected
    ? uniqueWorkflowSkillReferences([...draft.selectedSkills, reference])
    : draft.selectedSkills.filter((item) => item.relativePath !== relativePath);
  state = {
    ...state,
    workflowDraft: { ...draft, selectedSkills },
  };
  render();
}

function removeWorkflowDraftSkill(relativePath: string) {
  const draft = currentWorkflowDraft();
  state = {
    ...state,
    workflowDraft: {
      ...draft,
      selectedSkills: draft.selectedSkills.filter((item) => item.relativePath !== relativePath),
    },
  };
  render();
}

async function loadSkillsPage({ reset }: { reset: boolean }) {
  const active = activeConnection();
  if (!active || state.isLoadingSkills) {
    return;
  }

  state = {
    ...state,
    isLoadingSkills: true,
    skillsError: null,
    status: t("Loading skills"),
    error: null,
  };
  render();

  try {
    const skills = await listSkills(active);
    const selectedSkillId =
      state.selectedSkillId && skills.some((skill) => skill.id === state.selectedSkillId)
        ? state.selectedSkillId
        : skills[0]?.id ?? null;
    state = {
      ...state,
      skills,
      selectedSkillId,
      selectedSkillDetail: reset ? null : state.selectedSkillDetail,
      skillsLoaded: true,
      isLoadingSkills: false,
      skillsError: null,
      status: tf("Loaded %@ skills.", skills.length),
      error: null,
    };
    render();

    const selected = skills.find((skill) => skill.id === selectedSkillId);
    if (selected) {
      await loadSelectedSkillDetail(selected);
    }
  } catch (error) {
    state = {
      ...state,
      isLoadingSkills: false,
      skillsError: error instanceof Error ? error.message : String(error),
    };
    setError(error);
  }
}

async function selectSkill(summary: SkillSummary) {
  if (summary.id === state.selectedSkillId && state.selectedSkillDetail) {
    return;
  }
  if (isSkillDraftDirty()) {
    const confirmed = window.confirm(t("Discard unsaved skill edits?"));
    if (!confirmed) {
      return;
    }
  }
  state = {
    ...state,
    selectedSkillId: summary.id,
    selectedSkillDetail: null,
    skillEditorMode: "view",
    skillDraftContent: "",
    skillsError: null,
    status: null,
    error: null,
  };
  render();
  await loadSelectedSkillDetail(summary);
}

async function loadSelectedSkillDetail(summary: SkillSummary) {
  const active = activeConnection();
  if (!active) {
    return;
  }
  state = {
    ...state,
    selectedSkillId: summary.id,
    isLoadingSkillDetail: true,
    skillsError: null,
    error: null,
    status: t("Loading skill detail"),
  };
  render();
  try {
    const detail = await loadSkillDetail(active, summary.locator);
    if (state.selectedSkillId !== summary.id) {
      return;
    }
    state = {
      ...state,
      selectedSkillDetail: detail,
      isLoadingSkillDetail: false,
      skillEditorMode: "view",
      skillDraftContent: "",
      status: tf("Loaded %@.", resolvedSkillName(detail)),
      error: null,
    };
    render();
  } catch (error) {
    state = {
      ...state,
      selectedSkillDetail: null,
      isLoadingSkillDetail: false,
      skillsError: error instanceof Error ? error.message : String(error),
    };
    setError(error);
  }
}

function beginCreateSkill() {
  if (isSkillDraftDirty()) {
    const confirmed = window.confirm(t("Discard unsaved skill edits?"));
    if (!confirmed) {
      return;
    }
  }
  state = {
    ...state,
    selectedSkillId: null,
    selectedSkillDetail: null,
    skillEditorMode: "create",
    skillDraftContent: defaultSkillMarkdown(),
    newSkillPath: "",
    createSkillReferences: false,
    createSkillScripts: false,
    createSkillTemplates: false,
    status: null,
    error: null,
  };
  render();
}

function beginEditSkill() {
  const detail = state.selectedSkillDetail;
  if (!detail || detail.source.is_read_only) {
    return;
  }
  state = {
    ...state,
    skillEditorMode: "edit",
    skillDraftContent: detail.markdown_content,
    createSkillReferences: detail.has_references,
    createSkillScripts: detail.has_scripts,
    createSkillTemplates: detail.has_templates,
    status: null,
    error: null,
  };
  render();
}

function cancelSkillEditing() {
  state = {
    ...state,
    skillEditorMode: "view",
    skillDraftContent: "",
    newSkillPath: "",
    createSkillReferences: false,
    createSkillScripts: false,
    createSkillTemplates: false,
  };
  render();
}

async function saveSkillDraft() {
  const active = activeConnection();
  if (!active || state.isSavingSkill) {
    return;
  }
  const markdownContent =
    app.querySelector<HTMLTextAreaElement>("[data-skill-draft]")?.value ?? state.skillDraftContent;
  const references =
    app.querySelector<HTMLInputElement>("[data-skill-folder='references']")?.checked ?? state.createSkillReferences;
  const scripts =
    app.querySelector<HTMLInputElement>("[data-skill-folder='scripts']")?.checked ?? state.createSkillScripts;
  const templates =
    app.querySelector<HTMLInputElement>("[data-skill-folder='templates']")?.checked ?? state.createSkillTemplates;
  const relativePath =
    app.querySelector<HTMLInputElement>("[data-new-skill-path]")?.value.trim() ?? state.newSkillPath.trim();

  state = {
    ...state,
    isSavingSkill: true,
    skillDraftContent: markdownContent,
    newSkillPath: relativePath,
    createSkillReferences: references,
    createSkillScripts: scripts,
    createSkillTemplates: templates,
    status: t(state.skillEditorMode === "create" ? "Creating skill" : "Saving skill"),
    error: null,
  };
  render();

  try {
    const detail =
      state.skillEditorMode === "create"
        ? await createSkill(active, relativePath, markdownContent, references, scripts, templates)
        : state.selectedSkillDetail
          ? await updateSkill(
              active,
              state.selectedSkillDetail.locator,
              markdownContent,
              state.selectedSkillDetail.content_hash,
              references,
              scripts,
              templates,
            )
          : null;
    if (!detail) {
      throw new Error(t("Select a skill before saving."));
    }
    const skills = await listSkills(active);
    state = {
      ...state,
      skills,
      selectedSkillId: detail.id,
      selectedSkillDetail: detail,
      skillsLoaded: true,
      isSavingSkill: false,
      skillEditorMode: "view",
      skillDraftContent: "",
      newSkillPath: "",
      status: tf("%@ saved.", resolvedSkillName(detail)),
      error: null,
    };
    render();
  } catch (error) {
    state = { ...state, isSavingSkill: false };
    setError(error);
  }
}

function isSkillDraftDirty() {
  if (state.skillEditorMode === "create") {
    return state.skillDraftContent.trim() !== defaultSkillMarkdown().trim() || Boolean(state.newSkillPath.trim());
  }
  if (state.skillEditorMode === "edit" && state.selectedSkillDetail) {
    return state.skillDraftContent !== state.selectedSkillDetail.markdown_content;
  }
  return false;
}

async function loadCronJobsPage({ reset }: { reset: boolean }) {
  const active = activeConnection();
  if (!active || state.isLoadingCronJobs) {
    return;
  }

  state = {
    ...state,
    isLoadingCronJobs: true,
    cronJobsError: null,
    status: t("Loading cron jobs"),
    error: null,
  };
  render();

  try {
    const cronJobs = await listCronJobs(active);
    const selectedCronJobId =
      state.selectedCronJobId && cronJobs.some((job) => job.id === state.selectedCronJobId)
        ? state.selectedCronJobId
        : cronJobs[0]?.id ?? null;
    state = {
      ...state,
      cronJobs,
      selectedCronJobId,
      cronJobsLoaded: true,
      isLoadingCronJobs: false,
      cronJobsError: null,
      cronEditorMode: reset ? "view" : state.cronEditorMode,
      cronDraft: reset ? emptyCronDraft() : state.cronDraft,
      status: tf("Loaded %@ cron jobs.", cronJobs.length),
      error: null,
    };
    render();
  } catch (error) {
    state = {
      ...state,
      isLoadingCronJobs: false,
      cronJobsError: error instanceof Error ? error.message : String(error),
    };
    setError(error);
  }
}

function beginCreateCronJob() {
  state = {
    ...state,
    selectedCronJobId: null,
    cronEditorMode: "create",
    cronDraft: emptyCronDraft(),
    cronJobsError: null,
    status: null,
    error: null,
  };
  render();
}

function beginEditCronJob() {
  const job = selectedCronJob();
  if (!job) {
    return;
  }
  state = {
    ...state,
    cronEditorMode: "edit",
    cronDraft: cronDraftFromJob(job),
    cronJobsError: null,
    status: null,
    error: null,
  };
  render();
}

function cancelCronEditing() {
  state = {
    ...state,
    cronEditorMode: "view",
    cronDraft: emptyCronDraft(),
    cronJobsError: null,
  };
  render();
}

async function saveCronDraft() {
  const active = activeConnection();
  if (!active || state.isOperatingOnCronJob) {
    return;
  }
  const form = app.querySelector<HTMLFormElement>("[data-cron-editor]");
  const draftForm = form ? readCronDraftForm(form) : state.cronDraft;
  const validationError = cronDraftValidationError(draftForm);
  if (validationError) {
    state = { ...state, cronDraft: draftForm, cronJobsError: validationError };
    setError(validationError);
    return;
  }

  const payload = cronDraftPayload(draftForm);
  const editingJobId = state.cronEditorMode === "edit" ? state.selectedCronJobId : null;
  state = {
    ...state,
    cronDraft: draftForm,
    isOperatingOnCronJob: true,
    status: t(state.cronEditorMode === "create" ? "Creating cron job" : "Saving cron job"),
    error: null,
  };
  render();

  try {
    const savedJobId =
      state.cronEditorMode === "create"
        ? await createCronJob(active, payload)
        : editingJobId
          ? await updateCronJob(active, editingJobId, payload)
          : "";
    const cronJobs = await listCronJobs(active);
    state = {
      ...state,
      cronJobs,
      selectedCronJobId: savedJobId || editingJobId || (cronJobs[0]?.id ?? null),
      cronJobsLoaded: true,
      isOperatingOnCronJob: false,
      cronEditorMode: "view",
      cronDraft: emptyCronDraft(),
      cronJobsError: null,
      status: t("Cron job saved."),
      error: null,
    };
    render();
  } catch (error) {
    state = { ...state, isOperatingOnCronJob: false };
    setError(error);
  }
}

async function runSelectedCronJobNow() {
  await operateOnSelectedCronJob(t("Running cron job"), async (active, job) => {
    await runCronJobNow(active, job.id);
    return t("Cron job started.");
  });
}

async function toggleSelectedCronJobPause() {
  await operateOnSelectedCronJob(t(jobIsPaused(selectedCronJob()) ? "Resuming cron job" : "Pausing cron job"), async (active, job) => {
    if (jobIsPaused(job)) {
      await resumeCronJob(active, job.id);
      return t("Cron job resumed.");
    }
    await pauseCronJob(active, job.id);
    return t("Cron job paused.");
  });
}

async function removeSelectedCronJob() {
  const job = selectedCronJob();
  if (!job) {
    return;
  }
  const confirmed = window.confirm(tf('Remove cron job "%@"?', cronJobTitle(job)));
  if (!confirmed) {
    return;
  }
  await operateOnSelectedCronJob(t("Removing cron job"), async (active, selected) => {
    await removeCronJob(active, selected.id);
    return t("Cron job removed.");
  });
}

async function operateOnSelectedCronJob(
  progressMessage: string,
  operation: (profile: ConnectionProfile, job: CronJob) => Promise<string>,
) {
  const active = activeConnection();
  const job = selectedCronJob();
  if (!active || !job || state.isOperatingOnCronJob) {
    return;
  }
  state = { ...state, isOperatingOnCronJob: true, status: progressMessage, error: null };
  render();
  try {
    const status = await operation(active, job);
    const cronJobs = await listCronJobs(active);
    const selectedCronJobId = cronJobs.some((item) => item.id === job.id) ? job.id : cronJobs[0]?.id ?? null;
    state = {
      ...state,
      cronJobs,
      selectedCronJobId,
      cronJobsLoaded: true,
      isOperatingOnCronJob: false,
      cronEditorMode: "view",
      cronDraft: emptyCronDraft(),
      cronJobsError: null,
      status,
      error: null,
    };
    render();
  } catch (error) {
    state = { ...state, isOperatingOnCronJob: false };
    setError(error);
  }
}

async function loadKanbanPage({ resetBoards }: { resetBoards: boolean }) {
  const active = activeConnection();
  if (!active || state.isLoadingKanbanBoard || state.isLoadingKanbanBoards) {
    return;
  }
  state = {
    ...state,
    isLoadingKanbanBoards: resetBoards,
    isLoadingKanbanBoard: true,
    kanbanError: null,
    status: t("Loading Kanban"),
    error: null,
  };
  render();

  try {
    const boards = resetBoards
      ? await listKanbanBoards(active, state.includeArchivedKanbanTasks)
      : state.kanbanBoards ?? await listKanbanBoards(active, state.includeArchivedKanbanTasks);
    const selectedKanbanBoardSlug =
      state.selectedKanbanBoardSlug && boards.boards.some((board) => board.slug === state.selectedKanbanBoardSlug)
        ? state.selectedKanbanBoardSlug
        : boards.current || boards.boards[0]?.slug || "default";
    const board = await loadKanbanBoard(active, selectedKanbanBoardSlug, state.includeArchivedKanbanTasks);
    const selectedKanbanTaskId =
      state.selectedKanbanTaskId && board.tasks.some((task) => task.id === state.selectedKanbanTaskId)
        ? state.selectedKanbanTaskId
        : board.tasks[0]?.id ?? null;
    state = {
      ...state,
      kanbanBoards: boards,
      kanbanBoard: board,
      selectedKanbanBoardSlug,
      selectedKanbanTaskId,
      selectedKanbanTaskDetail: null,
      kanbanLoaded: true,
      isLoadingKanbanBoards: false,
      isLoadingKanbanBoard: false,
      kanbanError: null,
      status: tf("Loaded %@ Kanban tasks.", board.tasks.length),
      error: null,
    };
    render();
    if (selectedKanbanTaskId) {
      await loadSelectedKanbanTaskDetail();
    }
  } catch (error) {
    state = {
      ...state,
      isLoadingKanbanBoards: false,
      isLoadingKanbanBoard: false,
      kanbanError: error instanceof Error ? error.message : String(error),
    };
    setError(error);
  }
}

async function selectKanbanBoard(boardSlug: string) {
  if (!boardSlug || boardSlug === state.selectedKanbanBoardSlug) {
    return;
  }
  state = {
    ...state,
    selectedKanbanBoardSlug: boardSlug,
    selectedKanbanTaskId: null,
    selectedKanbanTaskDetail: null,
    kanbanTaskEditorMode: "view",
    kanbanTaskDraft: emptyKanbanTaskDraft(),
    kanbanParentIdsDraft: "",
    kanbanChildIdsDraft: "",
    kanbanRecoveryReasonDraft: "",
    kanbanRecoveryAssigneeDraft: "",
    kanbanRecoveryResultDraft: "",
    kanbanRecoverySummaryDraft: "",
    kanbanRecoveryMetadataDraft: "",
    kanbanReclaimBeforeReassign: true,
  };
  await loadKanbanPage({ resetBoards: false });
}

async function selectKanbanTask(taskId: string) {
  const task = state.kanbanBoard?.tasks.find((item) => item.id === taskId) ?? null;
  state = {
    ...state,
    selectedKanbanTaskId: taskId,
    selectedKanbanTaskDetail: null,
    kanbanTaskEditorMode: "view",
    kanbanCommentDraft: "",
    kanbanActionDraft: task?.assignee ?? "",
    kanbanParentIdsDraft: task?.parent_ids.join(", ") ?? "",
    kanbanChildIdsDraft: task?.child_ids.join(", ") ?? "",
    kanbanRecoveryReasonDraft: "",
    kanbanRecoveryAssigneeDraft: task?.assignee ?? "",
    kanbanRecoveryResultDraft: task?.result ?? "",
    kanbanRecoverySummaryDraft: "",
    kanbanRecoveryMetadataDraft: "",
    kanbanReclaimBeforeReassign: true,
    status: null,
    error: null,
  };
  render();
  await loadSelectedKanbanTaskDetail();
}

async function loadSelectedKanbanTaskDetail() {
  const active = activeConnection();
  const taskId = state.selectedKanbanTaskId;
  if (!active || !taskId) {
    return;
  }
  state = { ...state, isLoadingKanbanTaskDetail: true, status: t("Loading Kanban task"), error: null };
  render();
  try {
    const detail = await loadKanbanTaskDetail(active, state.selectedKanbanBoardSlug, taskId);
    if (state.selectedKanbanTaskId !== taskId) {
      return;
    }
    state = {
      ...state,
      selectedKanbanTaskDetail: detail,
      isLoadingKanbanTaskDetail: false,
      kanbanActionDraft: detail.task.assignee ?? "",
      kanbanParentIdsDraft: detail.parent_ids.join(", "),
      kanbanChildIdsDraft: detail.child_ids.join(", "),
      kanbanRecoveryAssigneeDraft: detail.task.assignee ?? "",
      kanbanRecoveryResultDraft: detail.task.result ?? "",
      status: tf("Loaded %@.", kanbanTaskTitle(detail.task)),
      error: null,
    };
    render();
  } catch (error) {
    state = { ...state, isLoadingKanbanTaskDetail: false };
    setError(error);
  }
}

function beginCreateKanbanBoard() {
  state = {
    ...state,
    kanbanBoardEditorOpen: true,
    kanbanBoardDraft: emptyKanbanBoardDraft(),
    status: null,
    error: null,
  };
  render();
}

async function saveKanbanBoardDraft() {
  const active = activeConnection();
  const form = app.querySelector<HTMLFormElement>("[data-kanban-board-editor]");
  if (!active || !form || state.isOperatingOnKanbanBoard) {
    return;
  }
  const draft = readKanbanBoardDraft(form);
  const validationError = kanbanBoardDraftValidationError(draft);
  if (validationError) {
    setError(validationError);
    return;
  }
  state = { ...state, kanbanBoardDraft: draft, isOperatingOnKanbanBoard: true, status: t("Creating Kanban board"), error: null };
  render();
  try {
    const response = await createKanbanBoard(active, kanbanBoardDraftPayload(draft));
    state = {
      ...state,
      selectedKanbanBoardSlug: response.board?.slug ?? draft.slug.trim().toLowerCase(),
      kanbanBoardEditorOpen: false,
      kanbanBoardDraft: emptyKanbanBoardDraft(),
      isOperatingOnKanbanBoard: false,
      status: t("Kanban board created."),
      error: null,
    };
    render();
    await loadKanbanPage({ resetBoards: true });
  } catch (error) {
    state = { ...state, isOperatingOnKanbanBoard: false };
    setError(error);
  }
}

function beginCreateKanbanTask() {
  state = {
    ...state,
    selectedKanbanTaskId: null,
    selectedKanbanTaskDetail: null,
    kanbanTaskEditorMode: "create",
    kanbanTaskDraft: emptyKanbanTaskDraft(),
    kanbanParentIdsDraft: "",
    kanbanChildIdsDraft: "",
    kanbanRecoveryReasonDraft: "",
    kanbanRecoveryAssigneeDraft: "",
    kanbanRecoveryResultDraft: "",
    kanbanRecoverySummaryDraft: "",
    kanbanRecoveryMetadataDraft: "",
    kanbanReclaimBeforeReassign: true,
    status: null,
    error: null,
  };
  render();
}

function beginEditKanbanTask() {
  const task = selectedKanbanTask();
  if (!task) {
    return;
  }
  state = {
    ...state,
    kanbanTaskEditorMode: "edit",
    kanbanTaskDraft: kanbanTaskDraftFromTask(task),
    kanbanParentIdsDraft: task.parent_ids.join(", "),
    kanbanChildIdsDraft: task.child_ids.join(", "),
    kanbanRecoveryAssigneeDraft: task.assignee ?? "",
    kanbanRecoveryResultDraft: task.result ?? "",
    status: null,
    error: null,
  };
  render();
}

function cancelKanbanTaskEditing() {
  state = {
    ...state,
    kanbanTaskEditorMode: "view",
    kanbanTaskDraft: emptyKanbanTaskDraft(),
  };
  render();
}

async function saveKanbanTaskDraft() {
  const active = activeConnection();
  const form = app.querySelector<HTMLFormElement>("[data-kanban-task-editor]");
  if (!active || !form || state.isOperatingOnKanbanTask) {
    return;
  }
  const draft = readKanbanTaskDraft(form);
  const validationError = kanbanTaskDraftValidationError(draft, state.kanbanTaskEditorMode);
  if (validationError) {
    setError(validationError);
    return;
  }
  state = { ...state, kanbanTaskDraft: draft, isOperatingOnKanbanTask: true, status: t("Saving Kanban task"), error: null };
  render();
  try {
    const selected = selectedKanbanTask();
    const taskId =
      state.kanbanTaskEditorMode === "create"
        ? await createKanbanTask(active, state.selectedKanbanBoardSlug, kanbanTaskDraftPayload(draft))
        : selected
          ? (await updateKanbanTaskFields(
              active,
              state.selectedKanbanBoardSlug,
              selected.id,
              draft.body.trim(),
              draft.tenant.trim(),
              Number(draft.priority || "0"),
              splitCommaList(draft.skillsText),
            ), selected.id)
          : null;
    state = {
      ...state,
      selectedKanbanTaskId: taskId,
      kanbanTaskEditorMode: "view",
      kanbanTaskDraft: emptyKanbanTaskDraft(),
      isOperatingOnKanbanTask: false,
      status: t("Kanban task saved."),
      error: null,
    };
    render();
    await loadKanbanPage({ resetBoards: true });
  } catch (error) {
    state = { ...state, isOperatingOnKanbanTask: false };
    setError(error);
  }
}

async function addSelectedKanbanComment() {
  const body = state.kanbanCommentDraft.trim();
  if (!body) {
    setError(t("Comment text is required."));
    return;
  }
  await operateSelectedKanbanTask(t("Adding Kanban comment"), (active, boardSlug, task) =>
    addKanbanComment(active, boardSlug, task.id, body),
  );
  state = { ...state, kanbanCommentDraft: "" };
}

async function assignSelectedKanbanTask() {
  const assignee = state.kanbanActionDraft.trim() || null;
  await operateSelectedKanbanTask(t("Assigning Kanban task"), (active, boardSlug, task) =>
    assignKanbanTask(active, boardSlug, task.id, assignee),
  );
}

async function saveSelectedKanbanParents() {
  const { parentIds, childIds } = readKanbanLinkDrafts();
  state = { ...state, kanbanParentIdsDraft: parentIds, kanbanChildIdsDraft: childIds };
  await operateSelectedKanbanTask(t("Saving Kanban parents"), (active, boardSlug, task) =>
    setKanbanTaskParents(active, boardSlug, task.id, splitIdList(parentIds)),
  );
}

async function saveSelectedKanbanChildren() {
  const { parentIds, childIds } = readKanbanLinkDrafts();
  state = { ...state, kanbanParentIdsDraft: parentIds, kanbanChildIdsDraft: childIds };
  await operateSelectedKanbanTask(t("Saving Kanban children"), (active, boardSlug, task) =>
    setKanbanTaskChildren(active, boardSlug, task.id, splitIdList(childIds)),
  );
}

async function blockSelectedKanbanTask() {
  const reason = state.kanbanActionDraft.trim() || null;
  await operateSelectedKanbanTask(t("Blocking Kanban task"), (active, boardSlug, task) =>
    blockKanbanTask(active, boardSlug, task.id, reason),
  );
}

async function completeSelectedKanbanTask() {
  const result = state.kanbanActionDraft.trim() || null;
  await operateSelectedKanbanTask(t("Completing Kanban task"), (active, boardSlug, task) =>
    completeKanbanTask(active, boardSlug, task.id, result),
  );
}

async function reclaimSelectedKanbanTask() {
  const draft = readKanbanRecoveryDraft();
  state = { ...state, ...draft };
  await operateSelectedKanbanTask(t("Reclaiming Kanban task"), (active, boardSlug, task) =>
    reclaimKanbanTask(active, boardSlug, task.id, optionalText(draft.kanbanRecoveryReasonDraft)),
  );
}

async function reassignSelectedKanbanTask() {
  const draft = readKanbanRecoveryDraft();
  state = { ...state, ...draft };
  await operateSelectedKanbanTask(t("Reassigning Kanban task"), (active, boardSlug, task) =>
    reassignKanbanTask(
      active,
      boardSlug,
      task.id,
      optionalText(draft.kanbanRecoveryAssigneeDraft),
      draft.kanbanReclaimBeforeReassign,
      optionalText(draft.kanbanRecoveryReasonDraft),
    ),
  );
}

async function editSelectedKanbanResult() {
  const draft = readKanbanRecoveryDraft();
  const result = draft.kanbanRecoveryResultDraft.trim();
  if (!result) {
    setError(t("Recovery result is required."));
    return;
  }
  const metadataJson = draft.kanbanRecoveryMetadataDraft.trim();
  if (metadataJson) {
    try {
      const parsed = JSON.parse(metadataJson);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
        setError(t("Recovery metadata must be a JSON object."));
        return;
      }
    } catch (error) {
      setError(error);
      return;
    }
  }
  state = { ...state, ...draft };
  await operateSelectedKanbanTask(t("Editing Kanban result"), (active, boardSlug, task) =>
    editKanbanTaskResult(
      active,
      boardSlug,
      task.id,
      result,
      optionalText(draft.kanbanRecoverySummaryDraft),
      optionalText(draft.kanbanRecoveryMetadataDraft),
    ),
  );
}

async function toggleSelectedKanbanHomeSubscription(platform: string, subscribed: boolean) {
  await operateSelectedKanbanTask(t("Updating Kanban home subscription"), (active, boardSlug, task) =>
    setKanbanHomeSubscription(active, boardSlug, task.id, platform, subscribed),
  );
}

async function deleteSelectedKanbanTask() {
  const task = selectedKanbanTask();
  if (!task) {
    return;
  }
  const confirmed = window.confirm(tf('Delete Kanban task "%@"?', kanbanTaskTitle(task)));
  if (!confirmed) {
    return;
  }
  await operateSelectedKanbanTask(t("Deleting Kanban task"), (active, boardSlug, selected) =>
    deleteKanbanTask(active, boardSlug, selected.id),
  );
}

async function operateSelectedKanbanTask(
  progressMessage: string,
  operation: (profile: ConnectionProfile, boardSlug: string, task: KanbanTask) => Promise<unknown>,
) {
  const active = activeConnection();
  const task = selectedKanbanTask();
  if (!active || !task || state.isOperatingOnKanbanTask) {
    return;
  }
  state = { ...state, isOperatingOnKanbanTask: true, status: progressMessage, error: null };
  render();
  try {
    await operation(active, state.selectedKanbanBoardSlug, task);
    state = { ...state, isOperatingOnKanbanTask: false, status: t("Kanban task updated."), error: null };
    render();
    await loadKanbanPage({ resetBoards: true });
  } catch (error) {
    state = { ...state, isOperatingOnKanbanTask: false };
    setError(error);
  }
}

async function dispatchSelectedKanbanBoard() {
  const active = activeConnection();
  if (!active || state.isDispatchingKanban) {
    return;
  }
  state = { ...state, isDispatchingKanban: true, status: t("Nudging Kanban dispatcher"), error: null };
  render();
  try {
    const result = await dispatchKanbanNow(active, state.selectedKanbanBoardSlug, 8);
    state = {
      ...state,
      isDispatchingKanban: false,
      status: kanbanDispatchStatus(result),
      error: null,
    };
    render();
    await loadKanbanPage({ resetBoards: true });
  } catch (error) {
    state = { ...state, isDispatchingKanban: false };
    setError(error);
  }
}

async function archiveSelectedKanbanBoard() {
  const active = activeConnection();
  const boardSlug = state.selectedKanbanBoardSlug;
  if (!active || boardSlug === "default" || state.isOperatingOnKanbanBoard) {
    return;
  }
  const confirmed = window.confirm(tf('Archive Kanban board "%@"?', boardSlug));
  if (!confirmed) {
    return;
  }
  state = { ...state, isOperatingOnKanbanBoard: true, status: t("Archiving Kanban board"), error: null };
  render();
  try {
    await archiveKanbanBoard(active, boardSlug);
    state = {
      ...state,
      selectedKanbanBoardSlug: "default",
      selectedKanbanTaskId: null,
      selectedKanbanTaskDetail: null,
      isOperatingOnKanbanBoard: false,
      status: t("Kanban board archived."),
      error: null,
    };
    render();
    await loadKanbanPage({ resetBoards: true });
  } catch (error) {
    state = { ...state, isOperatingOnKanbanBoard: false };
    setError(error);
  }
}

async function refreshWorkspaceFileBookmarks(profile: ConnectionProfile) {
  try {
    const workspaceFileBookmarks = await listWorkspaceFileBookmarks(profile);
    state = { ...state, workspaceFileBookmarks };
    render();
  } catch (error) {
    setError(error);
  }
}

async function loadWorkspaceFile(reference: WorkspaceFileReference, forceReload = false) {
  const active = activeConnection();
  if (!active) {
    return;
  }

  const existing = workspaceFileDocument(reference);
  if (existing.hasLoaded && !forceReload) {
    state = {
      ...state,
      fileDocuments: { ...state.fileDocuments, [reference.id]: existing },
    };
    render();
    return;
  }

  const loadingDocument: FileEditorDocument = {
    ...existing,
    isLoading: true,
    errorMessage: null,
  };
  state = {
    ...state,
    fileDocuments: { ...state.fileDocuments, [reference.id]: loadingDocument },
    status: t("Loading remote file"),
    error: null,
  };
  render();

  try {
    const snapshot = await readWorkspaceFile(active, reference.remotePath);
    const document: FileEditorDocument = {
      ...loadingDocument,
      content: snapshot.content,
      originalContent: snapshot.content,
      remoteContentHash: snapshot.content_hash,
      lastSavedAt: null,
      isLoading: false,
      errorMessage: null,
      hasLoaded: true,
    };
    state = {
      ...state,
      fileDocuments: { ...state.fileDocuments, [reference.id]: document },
      status: tf("Loaded %@.", reference.title),
      error: null,
    };
    render();
  } catch (error) {
    const document: FileEditorDocument = {
      ...loadingDocument,
      isLoading: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
    state = {
      ...state,
      fileDocuments: { ...state.fileDocuments, [reference.id]: document },
    };
    setError(error);
  }
}

async function selectWorkspaceFile(fileId: string) {
  const reference = workspaceFileReferences().find((item) => item.id === fileId);
  if (!reference || reference.id === selectedWorkspaceFileReference()?.id) {
    return;
  }

  const current = selectedWorkspaceFileReference();
  const currentDocument = current ? state.fileDocuments[current.id] : null;
  if (currentDocument && currentDocument.content !== currentDocument.originalContent) {
    const confirmed = window.confirm(t("Discard unsaved edits in the current file?"));
    if (!confirmed) {
      return;
    }
    state = {
      ...state,
      fileDocuments: {
        ...state.fileDocuments,
        [currentDocument.fileId]: {
          ...currentDocument,
          content: currentDocument.originalContent,
        },
      },
    };
  }

  state = {
    ...state,
    selectedWorkspaceFileId: reference.id,
    status: null,
    error: null,
  };
  render();
  await loadWorkspaceFile(reference);
}

async function reloadSelectedWorkspaceFile(force = false) {
  const reference = selectedWorkspaceFileReference();
  if (!reference) {
    return;
  }
  const document = state.fileDocuments[reference.id];
  if (!force && document && document.content !== document.originalContent) {
    const confirmed = window.confirm(t("Reload from remote and discard local edits?"));
    if (!confirmed) {
      return;
    }
  }
  await loadWorkspaceFile(reference, true);
}

async function saveSelectedWorkspaceFile() {
  const active = activeConnection();
  const reference = selectedWorkspaceFileReference();
  if (!active || !reference) {
    return;
  }
  const document = workspaceFileDocument(reference);
  if (!document.hasLoaded || !document.remoteContentHash) {
    const errorMessage = t("Reload the file before saving.");
    state = {
      ...state,
      fileDocuments: {
        ...state.fileDocuments,
        [reference.id]: { ...document, errorMessage },
      },
      status: errorMessage,
    };
    render();
    return;
  }

  state = {
    ...state,
    fileDocuments: {
      ...state.fileDocuments,
      [reference.id]: { ...document, isLoading: true, errorMessage: null },
    },
    status: t("Saving remote file"),
    error: null,
  };
  render();

  try {
    const current = state.fileDocuments[reference.id];
    const result = await saveWorkspaceFile(
      active,
      reference.remotePath,
      current.content,
      current.remoteContentHash,
    );
    const saved: FileEditorDocument = {
      ...current,
      originalContent: current.content,
      remoteContentHash: result.content_hash,
      lastSavedAt: new Date().toISOString(),
      isLoading: false,
      errorMessage: null,
      hasLoaded: true,
    };
    state = {
      ...state,
      fileDocuments: { ...state.fileDocuments, [reference.id]: saved },
      status: tf("%@ saved.", reference.title),
      error: null,
    };
    render();
  } catch (error) {
    const current = state.fileDocuments[reference.id] ?? document;
    state = {
      ...state,
      fileDocuments: {
        ...state.fileDocuments,
        [reference.id]: {
          ...current,
          isLoading: false,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      },
    };
    setError(error);
  }
}

function updateWorkspaceFileContent(content: string) {
  const reference = selectedWorkspaceFileReference();
  if (!reference) {
    return;
  }
  const document = workspaceFileDocument(reference);
  state = {
    ...state,
    fileDocuments: {
      ...state.fileDocuments,
      [reference.id]: {
        ...document,
        content,
      },
    },
  };
}

function discardSelectedWorkspaceFile() {
  const reference = selectedWorkspaceFileReference();
  if (!reference) {
    return;
  }
  const document = workspaceFileDocument(reference);
  state = {
    ...state,
    fileDocuments: {
      ...state.fileDocuments,
      [reference.id]: {
        ...document,
        content: document.originalContent,
      },
    },
    status: t("Local edits discarded."),
  };
  render();
}

function hasDirtyWorkspaceFiles() {
  return Object.values(state.fileDocuments).some((document) => document.content !== document.originalContent);
}

function discardAllWorkspaceFileEdits() {
  const fileDocuments = Object.fromEntries(
    Object.entries(state.fileDocuments).map(([id, document]) => [
      id,
      {
        ...document,
        content: document.originalContent,
      },
    ]),
  ) as Record<string, FileEditorDocument>;
  state = { ...state, fileDocuments };
}

async function browseWorkspaceDirectory(path: string) {
  const active = activeConnection();
  if (!active) {
    return;
  }
  const remotePath = path.trim() || workspaceFileBrowserDefaultPath();
  state = {
    ...state,
    isFileBrowserOpen: true,
    isLoadingFileBrowser: true,
    fileBrowserPath: remotePath,
    fileBrowserError: null,
    status: t("Browsing remote files"),
    error: null,
  };
  render();

  try {
    const listing = await listRemoteDirectory(active, remotePath, state.overview?.hermes_home ?? remoteHermesHomePath(active));
    state = {
      ...state,
      fileBrowserPath: listing.display_path,
      fileBrowserListing: listing,
      isLoadingFileBrowser: false,
      fileBrowserError: null,
      status: tf("%@ remote items.", listing.total_entry_count),
      error: null,
    };
    render();
  } catch (error) {
    state = {
      ...state,
      isLoadingFileBrowser: false,
      fileBrowserError: error instanceof Error ? error.message : String(error),
    };
    setError(error);
  }
}

async function addWorkspaceFileBookmark(remotePath: string, selectAfterAdd: boolean) {
  const active = activeConnection();
  const normalizedPath = remotePath.trim();
  if (!active || !normalizedPath) {
    return;
  }
  try {
    const workspaceFileBookmarks = await upsertWorkspaceFileBookmark(active, normalizedPath, null);
    const nextBookmark = workspaceFileBookmarks.find((bookmark) => bookmark.remotePath === normalizedPath);
    state = {
      ...state,
      workspaceFileBookmarks,
      selectedWorkspaceFileId: selectAfterAdd && nextBookmark ? `bookmark:${nextBookmark.id}` : state.selectedWorkspaceFileId,
      status: tf("%@ added to Workspace Files.", displayTitleForRemotePath(normalizedPath)),
      error: null,
    };
    render();
    if (selectAfterAdd && nextBookmark) {
      const reference = selectedWorkspaceFileReference();
      if (reference) {
        await loadWorkspaceFile(reference);
      }
    }
  } catch (error) {
    setError(error);
  }
}

async function removeSelectedWorkspaceFileBookmark() {
  const active = activeConnection();
  const reference = selectedWorkspaceFileReference();
  if (!active || !reference?.bookmarkId) {
    return;
  }
  const confirmed = window.confirm(tf('Remove bookmark "%@"? The remote file stays untouched.', reference.title));
  if (!confirmed) {
    return;
  }
  try {
    const workspaceFileBookmarks = await removeWorkspaceFileBookmark(active, reference.bookmarkId);
    const fileDocuments = { ...state.fileDocuments };
    delete fileDocuments[reference.id];
    state = {
      ...state,
      workspaceFileBookmarks,
      fileDocuments,
      selectedWorkspaceFileId: "canonical:memory",
      status: t("Bookmark removed."),
      error: null,
    };
    render();
    const next = selectedWorkspaceFileReference();
    if (next) {
      await loadWorkspaceFile(next);
    }
  } catch (error) {
    setError(error);
  }
}

async function loadSessionsPage({ reset }: { reset: boolean }) {
  const active = activeConnection();
  if (!active) {
    return;
  }
  const offset = reset ? 0 : state.sessionOffset;
  state = {
    ...state,
    isLoadingSessions: true,
    status: t(reset ? "Loading sessions" : "Loading more sessions"),
    error: null,
    sessions: reset ? [] : state.sessions,
    sessionMessages: reset ? [] : state.sessionMessages,
    selectedSessionId: reset ? null : state.selectedSessionId,
  };
  render();
  try {
    const page = await listSessions(active, offset, sessionPageSize, state.sessionQuery);
    const sessions = reset ? page.items : [...state.sessions, ...page.items];
    const visibleSessionIds = new Set([...pinnedSessionSummaries(), ...sessions].map((session) => session.id));
    const selectedSessionId =
      state.selectedSessionId && visibleSessionIds.has(state.selectedSessionId)
        ? state.selectedSessionId
        : pinnedSessionSummaries()[0]?.id ?? sessions[0]?.id ?? null;
    state = {
      ...state,
      sessions,
      sessionTotalCount: page.total_count,
      sessionOffset: sessions.length,
      selectedSessionId,
      sessionsLoaded: true,
      isLoadingSessions: false,
      resumeCommand: null,
      resumeStartupCommand: null,
      status: tf("Loaded %@ of %@ sessions.", sessions.length, page.total_count),
      error: null,
    };
    render();
    if (selectedSessionId && state.sessionMessages.length === 0) {
      await loadSelectedSessionTranscript();
    }
  } catch (error) {
    state = { ...state, isLoadingSessions: false };
    setError(error);
  }
}

async function loadSelectedSessionTranscript() {
  const active = activeConnection();
  const sessionId = state.selectedSessionId;
  if (!active || !sessionId) {
    return;
  }
  state = {
    ...state,
    isLoadingSessionDetail: true,
    status: t("Loading transcript"),
    error: null,
  };
  render();
  try {
    const messages = await loadSessionTranscript(active, sessionId);
    state = {
      ...state,
      sessionMessages: messages,
      isLoadingSessionDetail: false,
      status: tf("Loaded %@ transcript messages.", messages.length),
      error: null,
    };
    render();
  } catch (error) {
    state = { ...state, isLoadingSessionDetail: false };
    setError(error);
  }
}

async function sendSelectedSessionMessage() {
  const active = activeConnection();
  const sessionId = state.selectedSessionId;
  const prompt = state.sessionPrompt.trim();
  if (!active || !sessionId || !prompt || state.isSendingSessionMessage) {
    return;
  }

  state = {
    ...state,
    isSendingSessionMessage: true,
    sessionPrompt: prompt,
    status: t("Sending prompt to Hermes"),
    error: null,
  };
  render();

  try {
    await sendSessionMessage(active, sessionId, prompt, state.autoApproveCommands);
    state = {
      ...state,
      isSendingSessionMessage: false,
      sessionPrompt: "",
      status: t("Prompt sent."),
      error: null,
    };
    render();
    await loadSelectedSessionTranscript();
    await loadSessionsPage({ reset: true });
  } catch (error) {
    state = { ...state, isSendingSessionMessage: false };
    setError(error);
  }
}

async function toggleSelectedSessionPin() {
  const active = activeConnection();
  const session = selectedSession();
  if (!active || !session) {
    return;
  }

  try {
    const wasPinned = isSessionPinned(session.id);
    const pinnedSessions = wasPinned ? await unpinSession(active, session.id) : await pinSession(active, session);
    state = {
      ...state,
      pinnedSessions,
      status: t(wasPinned ? "Session unpinned." : "Session pinned."),
      error: null,
    };
    render();
  } catch (error) {
    setError(error);
  }
}

async function showSelectedSessionResumeCommand() {
  const active = activeConnection();
  const session = selectedSession();
  if (!active || !session) {
    return;
  }

  try {
    const [resumeCommand, resumeStartupCommand] = await Promise.all([
      sessionResumeCommand(active, session.id),
      sessionResumeStartupCommand(active, session.id),
    ]);
    state = {
      ...state,
      resumeCommand,
      resumeStartupCommand,
      status: t("Terminal resume command prepared."),
      error: null,
    };
    render();
  } catch (error) {
    setError(error);
  }
}

async function removeSelectedSession() {
  const active = activeConnection();
  const session = selectedSession();
  if (!active || !session) {
    return;
  }
  const confirmed = window.confirm(tf('Delete remote session "%@"?', resolvedSessionTitle(session)));
  if (!confirmed) {
    return;
  }
  setBusy(true, t("Deleting session"));
  try {
    await deleteRemoteSession(active, session.id, state.overview?.session_store ?? null);
    const sessions = state.sessions.filter((item) => item.id !== session.id);
    const pinnedSessions = state.pinnedSessions.filter((item) => item.id !== session.id);
    const nextSelectedSessionId = state.sessionQuery.trim()
      ? sessions[0]?.id ?? null
      : pinnedSessions[0]?.id ?? sessions[0]?.id ?? null;
    state = {
      ...state,
      sessions,
      pinnedSessions,
      sessionTotalCount: Math.max(0, state.sessionTotalCount - 1),
      sessionOffset: sessions.length,
      selectedSessionId: nextSelectedSessionId,
      sessionMessages: [],
      resumeCommand: null,
      resumeStartupCommand: null,
      status: t("Session deleted."),
      error: null,
    };
    render();
    if (state.selectedSessionId) {
      await loadSelectedSessionTranscript();
    }
  } catch (error) {
    setError(error);
  } finally {
    setBusy(false);
  }
}

function readProfileForm(form: HTMLFormElement): ConnectionProfile {
  const data = new FormData(form);
  const profile = state.editor ?? newConnection();
  const portValue = String(data.get("sshPort") ?? "").trim();
  if (portValue && !/^\d+$/.test(portValue)) {
    throw new Error(t("Port must be a positive number."));
  }
  if (portValue && Number(portValue) > 65535) {
    throw new Error(t("Port must be 65535 or lower."));
  }
  return {
    ...profile,
    label: String(data.get("label") ?? ""),
    sshAlias: String(data.get("sshAlias") ?? ""),
    sshHost: String(data.get("sshHost") ?? ""),
    sshPort: portValue ? Number(portValue) : null,
    sshUser: String(data.get("sshUser") ?? ""),
    hermesProfile: optionalString(data.get("hermesProfile")),
    customHermesHomePath: optionalString(data.get("customHermesHomePath")),
  };
}

function newConnection(): ConnectionProfile {
  const createdAt = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    label: "",
    sshAlias: "",
    sshHost: "",
    sshPort: null,
    sshUser: "",
    hermesProfile: null,
    customHermesHomePath: null,
    createdAt,
    updatedAt: createdAt,
    lastConnectedAt: null,
  };
}

function activeConnection(): ConnectionProfile | null {
  const id = state.snapshot.preferences.activeConnectionId;
  return state.snapshot.connections.find((connection) => connection.id === id) ?? null;
}

function selectedSession(): SessionSummary | null {
  return allVisibleSessions().find((session) => session.id === state.selectedSessionId) ?? null;
}

function selectedWorkflow(): WorkflowPreset | null {
  return state.workflows.find((workflow) => workflow.id === state.selectedWorkflowId) ?? null;
}

function selectedCronJob(): CronJob | null {
  return state.cronJobs.find((job) => job.id === state.selectedCronJobId) ?? null;
}

function selectedKanbanTask(): KanbanTask | null {
  return state.kanbanBoard?.tasks.find((task) => task.id === state.selectedKanbanTaskId) ?? null;
}

function filteredKanbanTasks() {
  const query = state.kanbanQuery.trim().toLowerCase();
  const tasks = state.kanbanBoard?.tasks ?? [];
  if (!query) {
    return tasks;
  }
  return tasks.filter((task) =>
    [
      task.id,
      kanbanTaskTitle(task),
      task.body ?? "",
      task.assignee ?? "",
      task.status,
      task.tenant ?? "",
      task.result ?? "",
      task.workspace_path ?? "",
      task.created_by ?? "",
      ...task.skills,
      ...task.parent_ids,
      ...task.child_ids,
    ].some((value) => value.toLowerCase().includes(query)),
  );
}

function filteredWorkflows() {
  const query = state.workflowQuery.trim().toLowerCase();
  if (!query) {
    return state.workflows;
  }
  return state.workflows.filter((workflow) =>
    [
      workflow.name,
      workflow.prompt,
      ...workflow.assignedSkills.map((skill) => skill.relativePath),
      ...workflow.assignedSkills.map(workflowSkillName),
    ].some((value) => value.toLowerCase().includes(query)),
  );
}

function emptyWorkflowDraft(): WorkflowDraftForm {
  return {
    name: "",
    prompt: "",
    selectedSkills: [],
  };
}

function workflowDraftFromWorkflow(workflow: WorkflowPreset): WorkflowDraftForm {
  return {
    name: workflow.name,
    prompt: workflow.prompt,
    selectedSkills: workflow.assignedSkills,
  };
}

function currentWorkflowDraft(): WorkflowDraftForm {
  const form = app.querySelector<HTMLFormElement>("[data-workflow-editor]");
  return form ? readWorkflowDraft(form) : state.workflowDraft;
}

function readWorkflowDraft(form: HTMLFormElement): WorkflowDraftForm {
  const data = new FormData(form);
  return {
    ...state.workflowDraft,
    name: String(data.get("name") ?? ""),
    prompt: String(data.get("prompt") ?? ""),
    selectedSkills: uniqueWorkflowSkillReferences(state.workflowDraft.selectedSkills),
  };
}

function workflowDraftPayload(draft: WorkflowDraftForm): WorkflowDraftPayload {
  return {
    name: draft.name.trim(),
    prompt: draft.prompt.trim(),
    assignedSkills: uniqueWorkflowSkillReferences(draft.selectedSkills),
  };
}

function workflowDraftValidationError(draft: WorkflowDraftForm) {
  if (!draft.name.trim()) {
    return "Workflow name is required.";
  }
  if (!draft.prompt.trim()) {
    return "Workflow prompt is required.";
  }
  return null;
}

function workflowReferenceFromSkill(skill: SkillSummary): WorkflowSkillReference {
  return {
    relativePath: skill.relative_path,
    slug: skill.slug,
    name: skill.name,
  };
}

function uniqueWorkflowSkillReferences(references: WorkflowSkillReference[]) {
  const byPath = new Map<string, WorkflowSkillReference>();
  for (const reference of references) {
    const relativePath = reference.relativePath.trim();
    if (!relativePath) {
      continue;
    }
    byPath.set(relativePath, {
      relativePath,
      slug: reference.slug.trim() || lastPathComponent(relativePath),
      name: optionalText(reference.name ?? ""),
    });
  }
  return [...byPath.values()].sort((left, right) => {
    const slugCompare = left.slug.localeCompare(right.slug, undefined, { sensitivity: "base" });
    return slugCompare || left.relativePath.localeCompare(right.relativePath, undefined, { sensitivity: "base" });
  });
}

function workflowResolvedSkillRefs(workflow: WorkflowPreset) {
  const byPath = new Map(state.skills.map((skill) => [skill.relative_path, workflowReferenceFromSkill(skill)]));
  return workflow.assignedSkills.map((skill) => byPath.get(skill.relativePath)).filter(Boolean) as WorkflowSkillReference[];
}

function workflowMissingSkillRefs(workflow: WorkflowPreset) {
  const available = new Set(state.skills.map((skill) => skill.relative_path));
  return workflow.assignedSkills.filter((skill) => !available.has(skill.relativePath));
}

function workflowDraftMissingSkillRefs(draft: WorkflowDraftForm) {
  const available = new Set(state.skills.map((skill) => skill.relative_path));
  return draft.selectedSkills.filter((skill) => !available.has(skill.relativePath));
}

function workflowSkillName(skill: WorkflowSkillReference) {
  return skill.name?.trim() || skill.slug || skill.relativePath;
}

function workflowPromptPreview(prompt: string) {
  const compact = prompt.trim().replace(/\s+/g, " ");
  return compact.length > 140 ? `${compact.slice(0, 140)}...` : compact;
}

function emptyKanbanTaskDraft(): KanbanTaskDraftForm {
  return {
    title: "",
    body: "",
    assignee: "",
    priority: "0",
    tenant: "",
    skillsText: "",
    maxRetriesText: "",
    parentIdsText: "",
    startsInTriage: false,
  };
}

function emptyKanbanBoardDraft(): KanbanBoardDraftForm {
  return {
    slug: "",
    name: "",
    description: "",
    icon: "",
    color: "",
    switchAfterCreate: true,
  };
}

function kanbanTaskDraftFromTask(task: KanbanTask): KanbanTaskDraftForm {
  return {
    title: kanbanTaskTitle(task),
    body: task.body ?? "",
    assignee: task.assignee ?? "",
    priority: String(task.priority ?? 0),
    tenant: task.tenant ?? "",
    skillsText: task.skills.join(", "),
    maxRetriesText: task.max_retries ? String(task.max_retries) : "",
    parentIdsText: task.parent_ids.join(", "),
    startsInTriage: normalizeKanbanStatus(task.status) === "triage",
  };
}

function readKanbanTaskDraft(form: HTMLFormElement): KanbanTaskDraftForm {
  const data = new FormData(form);
  return {
    title: String(data.get("title") ?? ""),
    body: String(data.get("body") ?? ""),
    assignee: String(data.get("assignee") ?? ""),
    priority: String(data.get("priority") ?? "0"),
    tenant: String(data.get("tenant") ?? ""),
    skillsText: String(data.get("skillsText") ?? ""),
    maxRetriesText: String(data.get("maxRetriesText") ?? ""),
    parentIdsText: String(data.get("parentIdsText") ?? ""),
    startsInTriage: data.get("startsInTriage") === "on",
  };
}

function readKanbanLinkDrafts() {
  const form = app.querySelector<HTMLFormElement>("[data-kanban-links-form]");
  if (!form) {
    return {
      parentIds: state.kanbanParentIdsDraft,
      childIds: state.kanbanChildIdsDraft,
    };
  }
  const data = new FormData(form);
  return {
    parentIds: String(data.get("parentIds") ?? ""),
    childIds: String(data.get("childIds") ?? ""),
  };
}

function readKanbanRecoveryDraft() {
  const form = app.querySelector<HTMLFormElement>("[data-kanban-recovery-form]");
  if (!form) {
    return {
      kanbanRecoveryReasonDraft: state.kanbanRecoveryReasonDraft,
      kanbanRecoveryAssigneeDraft: state.kanbanRecoveryAssigneeDraft,
      kanbanRecoveryResultDraft: state.kanbanRecoveryResultDraft,
      kanbanRecoverySummaryDraft: state.kanbanRecoverySummaryDraft,
      kanbanRecoveryMetadataDraft: state.kanbanRecoveryMetadataDraft,
      kanbanReclaimBeforeReassign: state.kanbanReclaimBeforeReassign,
    };
  }
  const data = new FormData(form);
  return {
    kanbanRecoveryReasonDraft: String(data.get("reason") ?? ""),
    kanbanRecoveryAssigneeDraft: String(data.get("assignee") ?? ""),
    kanbanRecoveryResultDraft: String(data.get("result") ?? ""),
    kanbanRecoverySummaryDraft: String(data.get("summary") ?? ""),
    kanbanRecoveryMetadataDraft: String(data.get("metadata") ?? ""),
    kanbanReclaimBeforeReassign: data.get("reclaimFirst") === "on",
  };
}

function readKanbanBoardDraft(form: HTMLFormElement): KanbanBoardDraftForm {
  const data = new FormData(form);
  return {
    slug: String(data.get("slug") ?? ""),
    name: String(data.get("name") ?? ""),
    description: String(data.get("description") ?? ""),
    icon: String(data.get("icon") ?? ""),
    color: String(data.get("color") ?? ""),
    switchAfterCreate: data.get("switchAfterCreate") === "on",
  };
}

function kanbanTaskDraftPayload(draft: KanbanTaskDraftForm): KanbanTaskDraftPayload {
  return {
    title: draft.title.trim(),
    body: optionalText(draft.body),
    assignee: optionalText(draft.assignee),
    priority: Number(draft.priority.trim() || "0"),
    tenant: optionalText(draft.tenant),
    skills: splitCommaList(draft.skillsText),
    triage: draft.startsInTriage,
    max_retries: draft.maxRetriesText.trim() ? Number(draft.maxRetriesText.trim()) : null,
    parent_ids: splitIdList(draft.parentIdsText),
  };
}

function kanbanBoardDraftPayload(draft: KanbanBoardDraftForm): KanbanBoardDraftPayload {
  return {
    slug: draft.slug.trim().toLowerCase(),
    name: optionalText(draft.name),
    description: optionalText(draft.description),
    icon: optionalText(draft.icon),
    color: optionalText(draft.color),
    switch_after_create: draft.switchAfterCreate,
  };
}

function kanbanTaskDraftValidationError(draft: KanbanTaskDraftForm, mode: "view" | "create" | "edit") {
  if (mode === "create" && !draft.title.trim()) {
    return "Task title is required.";
  }
  if (!/^-?\d+$/.test(draft.priority.trim() || "0")) {
    return "Priority must be a whole number.";
  }
  const maxRetries = draft.maxRetriesText.trim();
  if (maxRetries && (!/^\d+$/.test(maxRetries) || Number(maxRetries) < 1)) {
    return "Max retries must be a whole number greater than 0.";
  }
  return null;
}

function kanbanBoardDraftValidationError(draft: KanbanBoardDraftForm) {
  const slug = draft.slug.trim().toLowerCase();
  if (!slug) {
    return "Board slug is required.";
  }
  if (!/^[a-z0-9][a-z0-9\-_]{0,63}$/.test(slug)) {
    return "Board slug must be 1-64 lowercase letters, numbers, hyphens, or underscores.";
  }
  return null;
}

function kanbanTaskTitle(task: KanbanTask) {
  return task.title?.trim() || task.id;
}

function kanbanTaskPreview(task: KanbanTask) {
  const compact = (task.body ?? "").trim().replace(/\s+/g, " ");
  if (!compact) {
    return task.result?.trim() || task.id;
  }
  return compact.length > 130 ? `${compact.slice(0, 130)}...` : compact;
}

function kanbanBoardTitle(board: Pick<KanbanProjectLike, "slug" | "name">) {
  return board.name?.trim() || titleCase(board.slug.replaceAll("_", "-").replaceAll("-", " "));
}

type KanbanProjectLike = { slug: string; name: string | null };

function kanbanPriorityLabel(priority: number) {
  if (priority > 0) {
    return `P+${priority}`;
  }
  return `P${priority}`;
}

function normalizeKanbanStatus(status: string) {
  return status.trim().toLowerCase() || "unknown";
}

function kanbanVisibleStatuses(tasks: KanbanTask[]) {
  const base = ["triage", "todo", "ready", "running", "blocked", "done"];
  if (state.includeArchivedKanbanTasks || tasks.some((task) => normalizeKanbanStatus(task.status) === "archived")) {
    base.push("archived");
  }
  for (const task of tasks) {
    const status = normalizeKanbanStatus(task.status);
    if (!base.includes(status)) {
      base.push(status);
    }
  }
  return base;
}

function kanbanStatusTitle(status: string) {
  const normalized = normalizeKanbanStatus(status);
  const known: Record<string, string> = {
    triage: "Triage",
    todo: "Todo",
    ready: "Ready",
    running: "Running",
    blocked: "Blocked",
    done: "Done",
    archived: "Archived",
  };
  return known[normalized] ?? titleCase(normalized.replaceAll("_", " "));
}

function splitCommaList(value: string) {
  return uniqueStrings(value.split(",").map((item) => item.trim()).filter(Boolean));
}

function splitIdList(value: string) {
  return uniqueStrings(value.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean));
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  return result;
}

function kanbanDispatchStatus(result: KanbanDispatchResult | null) {
  if (!result) {
    return "Kanban dispatcher nudged.";
  }
  return `Kanban dispatch: ${result.spawned.length} spawned, ${result.promoted} promoted.`;
}

function filteredCronJobs() {
  const query = state.cronQuery.trim().toLowerCase();
  return state.cronJobs.filter((job) => {
    if (state.cronFilter === "active" && !jobIsActive(job)) {
      return false;
    }
    if (state.cronFilter === "paused" && !jobIsPaused(job)) {
      return false;
    }
    if (!query) {
      return true;
    }
    return [
      job.id,
      cronJobTitle(job),
      job.prompt,
      cronScheduleTitle(job),
      job.model ?? "",
      job.provider ?? "",
      job.base_url ?? "",
      job.delivery_target ?? "",
      job.script ?? "",
      job.workdir ?? "",
      job.no_agent ? "script" : "agent",
      ...job.skills,
    ].some((value) => value.toLowerCase().includes(query));
  });
}

function emptyCronDraft(): CronJobDraftForm {
  return {
    name: "",
    prompt: "",
    script: "",
    workdir: "",
    noAgent: false,
    schedule: "0 9 * * *",
    skillsText: "",
    model: "",
    provider: "",
    baseUrl: "",
    deliver: "local",
    timezone: "",
  };
}

function cronDraftFromJob(job: CronJob): CronJobDraftForm {
  return {
    name: cronJobTitle(job),
    prompt: job.prompt.trim() || job.prompt,
    script: job.script?.trim() ?? "",
    workdir: job.workdir?.trim() ?? "",
    noAgent: job.no_agent,
    schedule: cronRawSchedule(job),
    skillsText: job.skills.join(", "),
    model: job.model ?? "",
    provider: job.provider ?? "",
    baseUrl: job.base_url ?? "",
    deliver: job.delivery_target ?? "local",
    timezone: job.schedule?.timezone ?? "",
  };
}

function readCronDraftForm(form: HTMLFormElement): CronJobDraftForm {
  const data = new FormData(form);
  return {
    name: String(data.get("name") ?? ""),
    prompt: String(data.get("prompt") ?? ""),
    script: String(data.get("script") ?? ""),
    workdir: String(data.get("workdir") ?? ""),
    noAgent: data.get("noAgent") === "on",
    schedule: String(data.get("schedule") ?? ""),
    skillsText: String(data.get("skillsText") ?? ""),
    model: String(data.get("model") ?? ""),
    provider: String(data.get("provider") ?? ""),
    baseUrl: String(data.get("baseUrl") ?? ""),
    deliver: String(data.get("deliver") ?? ""),
    timezone: String(data.get("timezone") ?? ""),
  };
}

function cronDraftPayload(draft: CronJobDraftForm): CronJobDraftPayload {
  return {
    name: draft.name.trim(),
    prompt: draft.prompt.trim(),
    script: optionalText(draft.script),
    workdir: optionalText(draft.workdir),
    no_agent: draft.noAgent,
    schedule: draft.schedule.trim(),
    skills: draft.skillsText
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean),
    model: optionalText(draft.model),
    provider: optionalText(draft.provider),
    base_url: optionalText(draft.baseUrl),
    deliver: optionalText(draft.deliver),
    timezone: optionalText(draft.timezone),
  };
}

function cronDraftValidationError(draft: CronJobDraftForm) {
  if (!draft.name.trim()) {
    return "A cron job title is required.";
  }
  if (draft.noAgent && !draft.script.trim()) {
    return "A script path is required for script-only jobs.";
  }
  if (!draft.noAgent && !draft.prompt.trim()) {
    return "A prompt is required.";
  }
  if (!draft.schedule.trim()) {
    return "A valid schedule is required.";
  }
  if (!draft.deliver.trim()) {
    return "A delivery target is required.";
  }
  return null;
}

function cronJobTitle(job: CronJob) {
  return job.name.trim() || job.id;
}

function cronJobPreview(job: CronJob) {
  if (job.no_agent) {
    return job.script?.trim() ? `Script-only watchdog: ${job.script.trim()}` : "Script-only watchdog";
  }
  const compact = job.prompt.trim().replace(/\s+/g, " ");
  if (!compact) {
    return "No prompt payload saved for this job.";
  }
  return compact.length > 140 ? `${compact.slice(0, 140)}...` : compact;
}

function cronRawSchedule(job: CronJob) {
  return job.schedule?.expr?.trim() || job.schedule_display.trim();
}

function cronScheduleTitle(job: CronJob) {
  return cronHumanSchedule(cronRawSchedule(job)) || cronRawSchedule(job) || "No schedule metadata";
}

function cronHumanSchedule(expression: string) {
  const trimmed = expression.trim();
  if (!trimmed) {
    return "";
  }
  if (/^\d+[mhd]$/i.test(trimmed)) {
    return `Once in ${durationText(trimmed)}`;
  }
  const everyMatch = /^every\s+(\d+[mhd])$/i.exec(trimmed);
  if (everyMatch) {
    return `Every ${durationText(everyMatch[1])}`;
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) {
    return "";
  }
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  if (hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*" && /^\d+$/.test(minute)) {
    return `Every hour at :${minute.padStart(2, "0")}`;
  }
  if (!/^\d+$/.test(minute) || !/^\d+$/.test(hour)) {
    return "";
  }
  const time = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
  if (dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return `Every day at ${time}`;
  }
  if (dayOfMonth === "*" && month === "*" && dayOfWeek === "1-5") {
    return `Every weekday at ${time}`;
  }
  if (dayOfMonth === "*" && month === "*" && dayOfWeek !== "*") {
    return `Every ${dayOfWeek} at ${time}`;
  }
  if (month === "*" && dayOfWeek === "*") {
    return `On day ${dayOfMonth} of every month at ${time}`;
  }
  return "";
}

function durationText(value: string) {
  const amount = Number(value.slice(0, -1));
  const unit = value.slice(-1).toLowerCase();
  if (unit === "m") {
    return `${amount} ${amount === 1 ? "minute" : "minutes"}`;
  }
  if (unit === "h") {
    return `${amount} ${amount === 1 ? "hour" : "hours"}`;
  }
  return `${amount} ${amount === 1 ? "day" : "days"}`;
}

function jobIsPaused(job: CronJob | null) {
  if (!job) {
    return false;
  }
  return job.state.trim().toLowerCase() === "paused" || job.enabled === false;
}

function jobIsActive(job: CronJob) {
  const stateValue = job.state.trim().toLowerCase();
  return job.enabled !== false && (stateValue === "scheduled" || stateValue === "running");
}

function cronStatusTitle(job: CronJob) {
  const stateValue = job.state.trim().toLowerCase();
  if (stateValue === "scheduled") {
    return job.enabled ? "Active" : "Paused";
  }
  if (stateValue === "paused") {
    return "Paused";
  }
  if (stateValue === "running") {
    return "Running";
  }
  if (stateValue === "failed") {
    return "Failed";
  }
  if (stateValue === "error") {
    return "Error";
  }
  return stateValue ? titleCase(stateValue.replaceAll("_", " ")) : job.enabled ? "Active" : "Paused";
}

function cronStatusClass(job: CronJob) {
  const stateValue = job.state.trim().toLowerCase();
  if (stateValue === "failed" || stateValue === "error") {
    return "danger";
  }
  if (stateValue === "running") {
    return "running";
  }
  if (jobIsPaused(job)) {
    return "paused";
  }
  return "active";
}

function cronOriginTitle(job: CronJob) {
  return job.origin?.label ?? job.origin?.source ?? job.origin?.kind ?? "";
}

function cronJobsRemotePath() {
  const active = activeConnection();
  return state.overview?.paths.cron_jobs ?? `${active ? remoteHermesHomePath(active) : "~/.hermes"}/cron/jobs.json`;
}

function workspaceFileReferences(): WorkspaceFileReference[] {
  return [...canonicalWorkspaceFileReferences(), ...bookmarkedWorkspaceFileReferences()];
}

function canonicalWorkspaceFileReferences(): WorkspaceFileReference[] {
  const active = activeConnection();
  if (!active) {
    return [];
  }
  const hermesHome = remoteHermesHomePath(active);
  const files: Array<{
    trackedFile: "user" | "memory" | "soul";
    title: string;
    remotePath: string;
  }> = [
    {
      trackedFile: "user",
      title: "USER.md",
      remotePath: state.overview?.paths.user ?? `${hermesHome}/memories/USER.md`,
    },
    {
      trackedFile: "memory",
      title: "MEMORY.md",
      remotePath: state.overview?.paths.memory ?? `${hermesHome}/memories/MEMORY.md`,
    },
    {
      trackedFile: "soul",
      title: "SOUL.md",
      remotePath: state.overview?.paths.soul ?? `${hermesHome}/SOUL.md`,
    },
  ];

  return files.map((file) => ({
    id: `canonical:${file.trackedFile}`,
    title: file.title,
    subtitle: file.remotePath,
    remotePath: file.remotePath,
    kind: "canonical",
    trackedFile: file.trackedFile,
    bookmarkId: null,
  }));
}

function bookmarkedWorkspaceFileReferences(): WorkspaceFileReference[] {
  return state.workspaceFileBookmarks.map((bookmark) => ({
    id: `bookmark:${bookmark.id}`,
    title: bookmark.title?.trim() || displayTitleForRemotePath(bookmark.remotePath),
    subtitle: bookmark.remotePath,
    remotePath: bookmark.remotePath,
    kind: "bookmark",
    trackedFile: null,
    bookmarkId: bookmark.id,
  }));
}

function selectedWorkspaceFileReference(): WorkspaceFileReference | null {
  const references = workspaceFileReferences();
  return references.find((reference) => reference.id === state.selectedWorkspaceFileId) ?? references[0] ?? null;
}

function workspaceFileDocument(reference: WorkspaceFileReference): FileEditorDocument {
  const existing = state.fileDocuments[reference.id];
  if (existing) {
    return {
      ...existing,
      title: reference.title,
      remotePath: reference.remotePath,
    };
  }
  return {
    fileId: reference.id,
    title: reference.title,
    remotePath: reference.remotePath,
    content: "",
    originalContent: "",
    remoteContentHash: null,
    isLoading: false,
    errorMessage: null,
    lastSavedAt: null,
    hasLoaded: false,
  };
}

function workspaceFileBookmarkGroups(): Array<{
  id: string;
  title: string;
  directoryPath: string;
  references: WorkspaceFileReference[];
}> {
  const grouped = new Map<string, WorkspaceFileReference[]>();
  for (const reference of bookmarkedWorkspaceFileReferences()) {
    const directoryPath = parentDirectoryPath(reference.remotePath);
    grouped.set(directoryPath, [...(grouped.get(directoryPath) ?? []), reference]);
  }
  return [...grouped.entries()]
    .map(([directoryPath, references]) => ({
      id: directoryPath,
      title: displayTitleForDirectoryPath(directoryPath),
      directoryPath,
      references: references.sort(compareWorkspaceFileReferences),
    }))
    .sort((left, right) => left.directoryPath.localeCompare(right.directoryPath, undefined, { sensitivity: "accent" }));
}

function compareWorkspaceFileReferences(left: WorkspaceFileReference, right: WorkspaceFileReference) {
  return (
    left.title.localeCompare(right.title, undefined, { sensitivity: "accent" }) ||
    left.remotePath.localeCompare(right.remotePath, undefined, { sensitivity: "accent" }) ||
    left.id.localeCompare(right.id)
  );
}

function parentDirectoryPath(remotePath: string) {
  const normalized = trimTrailingSlashes(remotePath.trim());
  if (!normalized) {
    return ".";
  }
  if (normalized === "/") {
    return "/";
  }
  const slashIndex = normalized.lastIndexOf("/");
  if (slashIndex < 0) {
    return ".";
  }
  if (slashIndex === 0) {
    return "/";
  }
  return normalized.slice(0, slashIndex);
}

function displayTitleForDirectoryPath(directoryPath: string) {
  const normalized = trimTrailingSlashes(directoryPath.trim());
  if (!normalized) {
    return ".";
  }
  if (normalized === "/") {
    return "/";
  }
  return normalized.split("/").filter(Boolean).at(-1) ?? normalized;
}

function displayTitleForRemotePath(remotePath: string) {
  const trimmed = remotePath.trim();
  if (!trimmed) {
    return "Untitled file";
  }
  const normalized = trimTrailingSlashes(trimmed);
  return normalized.split("/").filter(Boolean).at(-1) ?? normalized;
}

function trimTrailingSlashes(path: string) {
  let result = path;
  while (result.length > 1 && result.endsWith("/")) {
    result = result.slice(0, -1);
  }
  return result;
}

function workspaceFileBrowserDefaultPath() {
  const active = activeConnection();
  return state.overview?.hermes_home ?? (active ? remoteHermesHomePath(active) : "~");
}

function remoteHermesHomePath(connection: ConnectionProfile) {
  if (connection.customHermesHomePath) {
    return connection.customHermesHomePath;
  }
  if (connection.hermesProfile) {
    return `~/.hermes/profiles/${connection.hermesProfile}`;
  }
  return "~/.hermes";
}

function isWorkspaceFileBookmarked(remotePath: string) {
  return state.workspaceFileBookmarks.some((bookmark) => bookmark.remotePath === remotePath);
}

function isDirectoryEntryTooLarge(entry: RemoteDirectoryEntry) {
  return entry.kind === "file" && typeof entry.size === "number" && entry.size > maxEditableFileBytes;
}

function browserEntryMetadata(entry: RemoteDirectoryEntry) {
  const parts: string[] = [];
  if (entry.kind === "directory") {
    parts.push("Folder");
  } else if (entry.kind === "file") {
    parts.push(typeof entry.size === "number" ? formatBytes(entry.size) : "File");
  } else if (entry.kind === "symlink") {
    parts.push("Link");
  } else {
    parts.push("Other");
  }
  if (entry.is_symlink && entry.kind !== "symlink") {
    parts.push("Link");
  }
  if (typeof entry.modified_at === "number") {
    parts.push(new Date(entry.modified_at * 1000).toLocaleString());
  }
  if (!entry.is_readable) {
    parts.push("No read access");
  }
  return parts.join(" / ");
}

function formatBytes(value: number) {
  if (value < 1000) {
    return `${value} B`;
  }
  const units = ["KB", "MB", "GB", "TB"];
  let amount = value / 1000;
  let index = 0;
  while (amount >= 1000 && index < units.length - 1) {
    amount /= 1000;
    index += 1;
  }
  return `${amount.toFixed(amount >= 10 ? 0 : 1)} ${units[index]}`;
}

function formatRelativeTime(value: string) {
  return new Date(value).toLocaleTimeString();
}

function usageTotalTokens(summary: UsageSummary) {
  return summary.input_tokens + summary.output_tokens;
}

function usageCacheTokens(summary: UsageSummary) {
  return summary.cache_read_tokens + summary.cache_write_tokens;
}

function usageAllTokens(summary: UsageSummary) {
  return usageTotalTokens(summary) + usageCacheTokens(summary) + summary.reasoning_tokens;
}

function usageAverageTokens(summary: UsageSummary) {
  return summary.session_count > 0 ? Math.round(usageTotalTokens(summary) / summary.session_count) : 0;
}

function usageProfileAllTokens(profile: UsageProfileSlice | null) {
  if (!profile) {
    return 0;
  }
  return (
    profile.inputTokens +
    profile.outputTokens +
    profile.cacheReadTokens +
    profile.cacheWriteTokens +
    profile.reasoningTokens
  );
}

function formatUsageNumber(value: number) {
  return new Intl.NumberFormat().format(Math.trunc(value));
}

function shortUsageNumber(value: number) {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (absolute >= 1_000_000_000) {
    return `${sign}${compactDecimal(absolute / 1_000_000_000)}B`;
  }
  if (absolute >= 1_000_000) {
    return `${sign}${compactDecimal(absolute / 1_000_000)}M`;
  }
  if (absolute >= 1_000) {
    return `${sign}${compactDecimal(absolute / 1_000)}K`;
  }
  return formatUsageNumber(value);
}

function compactDecimal(value: number) {
  return value.toFixed(1).replace(/\.0$/, "");
}

function formatPercent(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatUsd(value: number) {
  const absolute = Math.abs(value);
  const digits = absolute === 0 ? 2 : absolute < 0.01 ? 6 : absolute < 1 ? 4 : 2;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function filteredSkills() {
  const query = state.skillQuery.trim().toLowerCase();
  if (!query) {
    return state.skills;
  }
  return state.skills.filter((skill) =>
    [
      resolvedSkillName(skill),
      skill.relative_path,
      skill.category ?? "",
      skill.description ?? "",
      skill.source.kind,
      ...skill.platforms,
      ...skill.tags,
      ...skill.related_skills,
    ].some((value) => value.toLowerCase().includes(query)),
  );
}

function selectedSkillSummary() {
  return state.skills.find((skill) => skill.id === state.selectedSkillId) ?? null;
}

function resolvedSkillName(skill: SkillSummary | SkillDetail) {
  return skill.name?.trim() || skill.slug || skill.relative_path;
}

function skillFeatureChips(skill: SkillSummary | SkillDetail) {
  const chips = [
    skill.category ? `<span>${escapeHtml(skill.category)}</span>` : "",
    skill.version ? `<span>v${escapeHtml(skill.version)}</span>` : "",
    skill.has_references ? "<span>References</span>" : "",
    skill.has_scripts ? "<span>Scripts</span>" : "",
    skill.has_templates ? "<span>Templates</span>" : "",
  ].filter(Boolean);
  return chips.length ? chips : ["<span>No assets</span>"];
}

function skillMiniStat(title: string, value: string) {
  return `
    <div class="usage-mini-stat">
      <span>${escapeHtml(title)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function skillAssetSummary(skill: SkillSummary | SkillDetail) {
  const assets = [
    skill.has_references ? "references" : "",
    skill.has_scripts ? "scripts" : "",
    skill.has_templates ? "templates" : "",
  ].filter(Boolean);
  return assets.length ? assets.join(", ") : "none";
}

function skillFilePath(skill: SkillSummary | SkillDetail) {
  return `${skill.source.root_path}/${skill.relative_path}/SKILL.md`;
}

function defaultSkillMarkdown() {
  return `---
name: "New Skill"
description: "Describe when Hermes should use this skill."
---

# Overview

Describe when this skill should be used and what it helps Hermes do.

## Workflow

- Step 1
- Step 2
- Step 3

## Notes

Add any guardrails, references, or implementation details that matter.
`;
}

function allVisibleSessions(): SessionSummary[] {
  const pinned = pinnedSessionSummaries();
  const pinnedIds = new Set(pinned.map((session) => session.id));
  return [...pinned, ...state.sessions.filter((session) => !pinnedIds.has(session.id))];
}

function pinnedSessionSummaries(): SessionSummary[] {
  if (state.sessionQuery.trim()) {
    return [];
  }
  return state.pinnedSessions.map((session) => ({
    id: session.id,
    title: session.title,
    model: session.model,
    parent_session_id: session.parentSessionId,
    started_at: session.startedAt,
    last_active: session.lastActive,
    message_count: session.messageCount,
    preview: session.preview,
    search_match: null,
  }));
}

function isSessionPinned(sessionId: string) {
  return state.pinnedSessions.some((session) => session.id === sessionId);
}

function setBusy(isBusy: boolean, status: string | null = null) {
  state = { ...state, isBusy, status: status ?? state.status };
  render();
}

function setError(error: unknown) {
  state = {
    ...state,
    error: errorMessage(error),
    status: null,
  };
  render();
}

function errorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  return friendlyErrorMessage(raw);
}

function friendlyErrorMessage(message: string) {
  const text = message.trim().replace(/^Error:\s*/i, "");
  if (!text) {
    return t("Unknown error.");
  }
  if (/^(failed to fetch|load failed|networkerror)/i.test(text)) {
    return t("Network request failed. Check your connection and try again.");
  }
  return text;
}

function optionalString(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function optionalText(value: string): string | null {
  const text = value.trim();
  return text ? text : null;
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function activeDestination(connection: ConnectionProfile) {
  const target = connection.sshAlias || connection.sshHost;
  return connection.sshUser ? `${connection.sshUser}@${target}` : target;
}

function resolvedHermesProfileName(connection: ConnectionProfile) {
  if (connection.customHermesHomePath) {
    return lastPathComponent(connection.customHermesHomePath);
  }
  return connection.hermesProfile || "default";
}

function resolvedSessionTitle(session: SessionSummary) {
  const title = session.title?.trim();
  return title || session.id;
}

function displayModel(model: string | null) {
  if (!model) {
    return null;
  }
  const trimmed = model.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length <= 34) {
    return trimmed;
  }
  return `${trimmed.slice(0, 16)}...${trimmed.slice(-12)}`;
}

function formatTimestamp(value: SessionTimestamp | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  let date: Date | null = null;
  if (typeof value === "number") {
    date = new Date(value * 1000);
  } else if (typeof value === "string") {
    const numeric = Number(value);
    date = Number.isFinite(numeric) && value.trim() !== "" ? new Date(numeric * 1000) : new Date(value);
  }
  if (!date || Number.isNaN(date.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeRole(role: string | null) {
  const normalized = (role ?? "event").trim().toLowerCase();
  if (normalized === "assistant") {
    return { title: "Agent", className: "assistant" };
  }
  if (normalized === "user") {
    return { title: "User", className: "user" };
  }
  if (normalized === "system") {
    return { title: "System", className: "system" };
  }
  const toolRoles = new Set(["function", "function_call", "function_result", "tool", "tool_call", "tool_result"]);
  if (toolRoles.has(normalized)) {
    return { title: "Tool", className: "tool" };
  }
  return { title: normalized ? normalized.replaceAll("_", " ") : "Event", className: "event" };
}

function metadataPreview(metadata: Record<string, unknown> | null) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return "";
  }
  return JSON.stringify(metadata, null, 2);
}

function stripTerminalArtifacts(value: string) {
  return stripTerminalGeneratedResponses(value)
    .replace(/\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)/g, "")
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/(?:\d{1,3}m;?){2,}/gm, "")
    .replace(/(?:\d{1,3};){1,8}\d{1,3}m/gm, "");
}

function stripTerminalGeneratedResponses(value: string) {
  return value
    .replace(/\x1B\](?:10|11|12);[^\x07\x1B]*(?:\x07|\x1B\\)?/g, "")
    .replace(/\](?:10|11|12);rgb:[0-9a-f/]+/gi, "");
}

function isTerminalControlNoise(value: string) {
  return /\x1B\](?:10|11|12);/i.test(value) || /\](?:10|11|12);rgb:/i.test(value);
}

function lastPathComponent(path: string) {
  const trimmed = path.replace(/\/+$/g, "");
  return trimmed.split("/").filter(Boolean).at(-1) ?? path;
}

function sectionTitle(section: SectionId) {
  return t(sections.find((item) => item.id === section)?.title ?? "Hermes Desktop");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value);
}

function icon(name: string) {
  const icons: Record<string, string> = {
    activity: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
    arrowRight: `<svg class="icon-svg" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>`,
    arrowUp: `<svg class="icon-svg" viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>`,
    book: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
    bookmark: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
    brush: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M18.37 2.63a2.12 2.12 0 0 1 3 3l-9.62 9.62-3.18.63.63-3.18 9.62-9.62z"/><path d="M9.5 14.5c-1.5 0-3 1-3 3 0 1.3-1 2.5-2.5 2.5 1.6 1 4.6 1 6.3-.8 1.3-1.3 1.2-3.5-.8-4.7z"/></svg>`,
    calendar: `<svg class="icon-svg" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    chart: `<svg class="icon-svg" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
    check: `<svg class="icon-svg" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`,
    chat: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    close: `<svg class="icon-svg" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    columns: `<svg class="icon-svg" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`,
    file: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`,
    folder: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
    home: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    link: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
    moon: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
    network: `<svg class="icon-svg" viewBox="0 0 24 24"><rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M12 8v8"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/></svg>`,
    pause: `<svg class="icon-svg" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`,
    pin: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
    pinOff: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M18.42 12.87L12 21.65l-6.42-8.78A8 8 0 0 1 16 3.1"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`,
    plus: `<svg class="icon-svg" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    pulse: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
    refresh: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
    save: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
    search: `<svg class="icon-svg" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    send: `<svg class="icon-svg" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
    sun: `<svg class="icon-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
    terminal: `<svg class="icon-svg" viewBox="0 0 24 24"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
    trash: `<svg class="icon-svg" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
    undo: `<svg class="icon-svg" viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`,
    user: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  };
  return `<span aria-hidden="true" style="display: inline-flex; align-items: center; justify-content: center;">${icons[name] ?? "*"}</span>`;
}
