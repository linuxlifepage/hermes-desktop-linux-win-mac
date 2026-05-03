import AppKit
import Foundation
@preconcurrency import SwiftTerm

@MainActor
final class TerminalTraceSession {
    let rootURL: URL
    let rawHostOutputURL: URL

    private let eventsURL: URL
    private let eventsHandle: FileHandle?
    private let encoder = JSONEncoder()

    static func make(launchToken: UUID) -> TerminalTraceSession? {
        guard let configuredPath = ProcessInfo.processInfo.environment["HERMES_TERMINAL_TRACE_DIR"]?
            .trimmingCharacters(in: .whitespacesAndNewlines),
              !configuredPath.isEmpty
        else {
            return nil
        }

        let expandedPath = (configuredPath as NSString).expandingTildeInPath
        let baseURL = URL(fileURLWithPath: expandedPath, isDirectory: true)
        let timestamp = Self.makeDirectoryTimestamp()
        let shortToken = String(launchToken.uuidString.prefix(8))
        let rootURL = baseURL.appendingPathComponent(
            "terminal-\(timestamp)-\(shortToken)",
            isDirectory: true
        )

        return TerminalTraceSession(rootURL: rootURL)
    }

    init?(rootURL: URL) {
        self.rootURL = rootURL
        self.rawHostOutputURL = rootURL.appendingPathComponent("raw-host-output", isDirectory: true)
        self.eventsURL = rootURL.appendingPathComponent("events.jsonl")

        do {
            try FileManager.default.createDirectory(
                at: rawHostOutputURL,
                withIntermediateDirectories: true
            )
            FileManager.default.createFile(atPath: eventsURL.path, contents: nil)
            self.eventsHandle = try FileHandle(forWritingTo: eventsURL)
        } catch {
            return nil
        }
    }

    deinit {
        try? eventsHandle?.close()
    }

    func record(
        _ name: String,
        terminalView: LocalProcessTerminalView,
        hostView: NSView?,
        reportedCols: Int? = nil,
        reportedRows: Int? = nil,
        note: String? = nil
    ) {
        let terminal = terminalView.getTerminal()
        let cursor = terminal.getCursorLocation()
        let event = TerminalTraceEvent(
            timestamp: Self.makeEventTimestamp(),
            name: name,
            reportedCols: reportedCols,
            reportedRows: reportedRows,
            terminalCols: terminal.cols,
            terminalRows: terminal.rows,
            cursorX: cursor.x,
            cursorY: cursor.y,
            topVisibleRow: terminal.getTopVisibleRow(),
            isScrolledToEnd: terminalView.isScrolledToTerminalEnd,
            terminalFrameWidth: Double(terminalView.frame.width),
            terminalFrameHeight: Double(terminalView.frame.height),
            hostBoundsWidth: hostView.map { Double($0.bounds.width) },
            hostBoundsHeight: hostView.map { Double($0.bounds.height) },
            note: note
        )

        guard let data = try? encoder.encode(event) else { return }
        eventsHandle?.seekToEndOfFile()
        eventsHandle?.write(data)
        eventsHandle?.write(Data([0x0a]))
    }

    private static func makeDirectoryTimestamp() -> String {
        makeEventTimestamp()
            .replacingOccurrences(of: ":", with: "-")
            .replacingOccurrences(of: ".", with: "-")
    }

    private static func makeEventTimestamp() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: Date())
    }
}

private struct TerminalTraceEvent: Encodable {
    let timestamp: String
    let name: String
    let reportedCols: Int?
    let reportedRows: Int?
    let terminalCols: Int
    let terminalRows: Int
    let cursorX: Int
    let cursorY: Int
    let topVisibleRow: Int
    let isScrolledToEnd: Bool
    let terminalFrameWidth: Double
    let terminalFrameHeight: Double
    let hostBoundsWidth: Double?
    let hostBoundsHeight: Double?
    let note: String?
}
