import Combine
import Foundation

@MainActor
final class ConnectionStore: ObservableObject {
    @Published private(set) var connections: [ConnectionProfile] = []
    @Published private(set) var persistenceError: String?
    @Published var lastConnectionID: UUID? {
        didSet {
            savePreferences()
        }
    }
    @Published var terminalTheme: TerminalThemePreference = .defaultValue {
        didSet {
            savePreferences()
        }
    }
    @Published var automaticallyChecksForUpdates = true {
        didSet {
            savePreferences()
        }
    }
    @Published var lastAutomaticUpdateCheckAt: Date? {
        didSet {
            savePreferences()
        }
    }
    @Published private(set) var workspaceFileBookmarks: [WorkspaceFileBookmark] = [] {
        didSet {
            savePreferences()
        }
    }
    @Published private(set) var pinnedSessions: [PinnedSession] = [] {
        didSet {
            savePreferences()
        }
    }

    private let paths: AppPaths
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private let privateFileAttributes: [FileAttributeKey: Any] = [
        .posixPermissions: NSNumber(value: Int16(0o600))
    ]

    init(paths: AppPaths) {
        self.paths = paths
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        load()
    }

    func upsert(_ connection: ConnectionProfile) {
        let normalized = connection.updated()
        if let index = connections.firstIndex(where: { $0.id == normalized.id }) {
            connections[index] = normalized
        } else {
            connections.append(normalized)
        }
        connections.sort { $0.label.localizedCaseInsensitiveCompare($1.label) == .orderedAscending }
        saveConnections()
    }

    func delete(_ connection: ConnectionProfile) {
        connections.removeAll(where: { $0.id == connection.id })
        if lastConnectionID == connection.id {
            lastConnectionID = nil
        }
        saveConnections()
    }

    func bookmarks(for workspaceScopeFingerprint: String) -> [WorkspaceFileBookmark] {
        workspaceFileBookmarks
            .filter { $0.workspaceScopeFingerprint == workspaceScopeFingerprint }
            .sorted { lhs, rhs in
                lhs.displayTitle.localizedCaseInsensitiveCompare(rhs.displayTitle) == .orderedAscending
            }
    }

    @discardableResult
    func upsertWorkspaceFileBookmark(
        remotePath: String,
        title: String? = nil,
        workspaceScopeFingerprint: String
    ) -> WorkspaceFileBookmark? {
        let normalizedPath = remotePath.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedPath.isEmpty else { return nil }

        let normalizedTitle = title?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty

        if let index = workspaceFileBookmarks.firstIndex(where: {
            $0.workspaceScopeFingerprint == workspaceScopeFingerprint &&
                $0.remotePath == normalizedPath
        }) {
            var bookmark = workspaceFileBookmarks[index]
            bookmark.title = normalizedTitle ?? bookmark.title
            bookmark.updatedAt = Date()
            workspaceFileBookmarks[index] = bookmark
            return bookmark
        }

        let bookmark = WorkspaceFileBookmark(
            workspaceScopeFingerprint: workspaceScopeFingerprint,
            remotePath: normalizedPath,
            title: normalizedTitle
        )
        workspaceFileBookmarks.append(bookmark)
        return bookmark
    }

    func removeWorkspaceFileBookmark(id: UUID) {
        workspaceFileBookmarks.removeAll { $0.id == id }
    }

    func pinnedSessions(for workspaceScopeFingerprint: String) -> [PinnedSession] {
        pinnedSessions
            .filter { $0.workspaceScopeFingerprint == workspaceScopeFingerprint }
            .sorted { lhs, rhs in
                lhs.createdAt > rhs.createdAt
            }
    }

    func isSessionPinned(id: String, workspaceScopeFingerprint: String) -> Bool {
        pinnedSessions.contains {
            $0.workspaceScopeFingerprint == workspaceScopeFingerprint &&
                $0.id == id
        }
    }

    func upsertPinnedSession(_ session: SessionSummary, workspaceScopeFingerprint: String) {
        if let index = pinnedSessions.firstIndex(where: {
            $0.workspaceScopeFingerprint == workspaceScopeFingerprint &&
                $0.id == session.id
        }) {
            var pinnedSession = pinnedSessions[index]
            pinnedSession.title = session.title
            pinnedSession.model = session.model
            pinnedSession.startedAt = session.startedAt
            pinnedSession.lastActive = session.lastActive
            pinnedSession.messageCount = session.messageCount
            pinnedSession.preview = session.preview
            pinnedSession.updatedAt = Date()
            pinnedSessions[index] = pinnedSession
            return
        }

        pinnedSessions.append(
            PinnedSession(
                session: session,
                workspaceScopeFingerprint: workspaceScopeFingerprint
            )
        )
    }

    func removePinnedSession(id: String, workspaceScopeFingerprint: String) {
        pinnedSessions.removeAll {
            $0.workspaceScopeFingerprint == workspaceScopeFingerprint &&
                $0.id == id
        }
    }

    private func load() {
        loadConnections()
        loadPreferences()
    }

    private func saveConnections() {
        do {
            let data = try encoder.encode(connections)
            try data.write(to: paths.connectionsURL, options: [.atomic])
            try fileManagerSetPrivatePermissions(at: paths.connectionsURL)
        } catch {
            reportPersistenceError(
                "Unable to save saved hosts to \(paths.connectionsURL.lastPathComponent): \(error.localizedDescription)"
            )
        }
        savePreferences()
    }

    private func savePreferences() {
        let preferences = AppPreferences(
            lastConnectionID: lastConnectionID,
            terminalTheme: terminalTheme,
            automaticallyChecksForUpdates: automaticallyChecksForUpdates,
            lastAutomaticUpdateCheckAt: lastAutomaticUpdateCheckAt,
            workspaceFileBookmarks: workspaceFileBookmarks,
            pinnedSessions: pinnedSessions
        )

        do {
            let data = try encoder.encode(preferences)
            try data.write(to: paths.preferencesURL, options: [.atomic])
            try fileManagerSetPrivatePermissions(at: paths.preferencesURL)
        } catch {
            reportPersistenceError(
                "Unable to save app preferences to \(paths.preferencesURL.lastPathComponent): \(error.localizedDescription)"
            )
        }
    }

    private func loadConnections() {
        do {
            let data = try Data(contentsOf: paths.connectionsURL)
            connections = try decoder.decode([ConnectionProfile].self, from: data)
            try? fileManagerSetPrivatePermissions(at: paths.connectionsURL)
        } catch let error as CocoaError where error.code == .fileReadNoSuchFile {
            connections = []
        } catch {
            connections = []
            reportPersistenceError(
                "Unable to load saved hosts from \(paths.connectionsURL.lastPathComponent): \(error.localizedDescription)"
            )
        }
    }

    private func loadPreferences() {
        do {
            let data = try Data(contentsOf: paths.preferencesURL)
            let decoded = try decoder.decode(AppPreferences.self, from: data)
            lastConnectionID = decoded.lastConnectionID
            terminalTheme = decoded.terminalTheme ?? .defaultValue
            automaticallyChecksForUpdates = decoded.automaticallyChecksForUpdates ?? true
            lastAutomaticUpdateCheckAt = decoded.lastAutomaticUpdateCheckAt
            workspaceFileBookmarks = decoded.workspaceFileBookmarks ?? []
            pinnedSessions = decoded.pinnedSessions ?? []
            try? fileManagerSetPrivatePermissions(at: paths.preferencesURL)
        } catch let error as CocoaError where error.code == .fileReadNoSuchFile {
            lastConnectionID = nil
            terminalTheme = .defaultValue
            automaticallyChecksForUpdates = true
            lastAutomaticUpdateCheckAt = nil
            workspaceFileBookmarks = []
            pinnedSessions = []
        } catch {
            lastConnectionID = nil
            terminalTheme = .defaultValue
            automaticallyChecksForUpdates = true
            lastAutomaticUpdateCheckAt = nil
            workspaceFileBookmarks = []
            pinnedSessions = []
            reportPersistenceError(
                "Unable to load app preferences from \(paths.preferencesURL.lastPathComponent): \(error.localizedDescription)"
            )
        }
    }

    private func reportPersistenceError(_ message: String) {
        persistenceError = message
    }

    private func fileManagerSetPrivatePermissions(at url: URL) throws {
        try paths.fileManager.setAttributes(privateFileAttributes, ofItemAtPath: url.path)
    }
}

private struct AppPreferences: Codable {
    var lastConnectionID: UUID?
    var terminalTheme: TerminalThemePreference?
    var automaticallyChecksForUpdates: Bool?
    var lastAutomaticUpdateCheckAt: Date?
    var workspaceFileBookmarks: [WorkspaceFileBookmark]?
    var pinnedSessions: [PinnedSession]?
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}
