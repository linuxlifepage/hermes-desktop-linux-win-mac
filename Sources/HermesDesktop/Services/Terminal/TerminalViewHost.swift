import AppKit
import Foundation
@preconcurrency import SwiftTerm

@MainActor
final class TerminalViewHost: NSObject, LocalProcessTerminalViewDelegate {
    private let hostView = TerminalHostView()
    private var startedLaunchToken: UUID?
    private var pendingLaunchRequest: TerminalLaunchRequest?
    private var appliedAppearance: TerminalThemeAppearance?
    private var onProcessStart: (() -> Void)?
    private var onTitleChange: ((String) -> Void)?
    private var onDirectoryChange: ((String?) -> Void)?
    private var onProcessExit: ((Int32?) -> Void)?
    private var traceSession: TerminalTraceSession?

    override init() {
        super.init()
        hostView.terminalView.processDelegate = self
    }

    func setEventHandlers(
        onProcessStart: @escaping () -> Void,
        onTitleChange: @escaping (String) -> Void,
        onDirectoryChange: @escaping (String?) -> Void,
        onProcessExit: @escaping (Int32?) -> Void
    ) {
        self.onProcessStart = onProcessStart
        self.onTitleChange = onTitleChange
        self.onDirectoryChange = onDirectoryChange
        self.onProcessExit = onProcessExit
    }

    func mount(
        in container: TerminalMountContainerView,
        request: TerminalLaunchRequest,
        appearance: TerminalThemeAppearance,
        isActive: Bool
    ) {
        container.onLayout = { [weak self, weak container] in
            guard let container else { return }
            self?.mountedContainerDidLayout(container)
        }
        container.mount(hostView)
        applyAppearance(appearance)
        setActive(isActive)
        traceSession?.record(
            "mount",
            terminalView: hostView.terminalView,
            hostView: hostView,
            note: isActive ? "active" : "inactive"
        )
        scheduleStartIfNeeded(for: request)
    }

    func unmount(from container: TerminalMountContainerView) {
        traceSession?.record("unmount", terminalView: hostView.terminalView, hostView: hostView)
        container.onLayout = nil
        container.unmountHostedView()
    }

    nonisolated func terminate() {
        performSelector(onMainThread: #selector(terminateOnMainThread), with: nil, waitUntilDone: false)
    }

    nonisolated func sizeChanged(source: LocalProcessTerminalView, newCols: Int, newRows: Int) {
        Task { @MainActor [weak self] in
            guard let self else { return }
            traceSession?.record(
                "pty-size-changed",
                terminalView: hostView.terminalView,
                hostView: hostView,
                reportedCols: newCols,
                reportedRows: newRows
            )
        }
    }

    nonisolated func setTerminalTitle(source: LocalProcessTerminalView, title: String) {
        Task { @MainActor [weak self] in
            guard let self else { return }
            traceSession?.record(
                "terminal-title",
                terminalView: hostView.terminalView,
                hostView: hostView,
                note: title
            )
            onTitleChange?(title)
        }
    }

    nonisolated func hostCurrentDirectoryUpdate(source: TerminalView, directory: String?) {
        Task { @MainActor [weak self] in
            guard let self else { return }
            traceSession?.record(
                "current-directory",
                terminalView: hostView.terminalView,
                hostView: hostView,
                note: directory
            )
            onDirectoryChange?(directory)
        }
    }

    nonisolated func processTerminated(source: TerminalView, exitCode: Int32?) {
        Task { @MainActor [weak self] in
            guard let self else { return }
            traceSession?.record(
                "process-terminated",
                terminalView: hostView.terminalView,
                hostView: hostView,
                note: exitCode.map(String.init) ?? "nil"
            )
            onProcessExit?(exitCode)
        }
    }

    private func scheduleStartIfNeeded(for request: TerminalLaunchRequest) {
        let launchToken = request.launchToken
        guard startedLaunchToken != launchToken else { return }
        if traceSession == nil {
            traceSession = TerminalTraceSession.make(launchToken: launchToken)
            traceSession?.record("trace-created", terminalView: hostView.terminalView, hostView: hostView)
        }
        pendingLaunchRequest = request
        startPendingLaunchIfReady()
    }

    private func mountedContainerDidLayout(_ container: TerminalMountContainerView) {
        guard hostView.superview === container else { return }
        hostView.synchronizeTerminalLayout(maintainingScrollToEnd: true)
        traceSession?.record("container-layout", terminalView: hostView.terminalView, hostView: hostView)
        startPendingLaunchIfReady()
    }

    private func startPendingLaunchIfReady() {
        guard let request = pendingLaunchRequest else { return }
        guard startedLaunchToken != request.launchToken else {
            pendingLaunchRequest = nil
            return
        }
        guard !hostView.isHidden, hostView.hasUsableTerminalFrame else { return }

        hostView.synchronizeTerminalLayout(maintainingScrollToEnd: true)
        traceSession?.record("pending-launch-ready", terminalView: hostView.terminalView, hostView: hostView)
        pendingLaunchRequest = nil
        startIfNeeded(for: request)
    }

    private func startIfNeeded(for request: TerminalLaunchRequest) {
        guard startedLaunchToken != request.launchToken else { return }
        startedLaunchToken = request.launchToken
        if let traceSession {
            hostView.terminalView.setHostLogging(directory: traceSession.rawHostOutputURL.path)
            traceSession.record(
                "trace-enabled",
                terminalView: hostView.terminalView,
                hostView: hostView,
                note: traceSession.rootURL.path
            )
        }

        let environment = [
            "TERM=xterm-256color",
            "COLORTERM=truecolor"
        ]

        traceSession?.record("start-process", terminalView: hostView.terminalView, hostView: hostView)
        hostView.terminalView.startProcess(
            executable: "/usr/bin/ssh",
            args: request.sshArguments,
            environment: environment,
            execName: "ssh"
        )
        onProcessStart?()
    }

    private func applyAppearance(_ appearance: TerminalThemeAppearance) {
        guard appliedAppearance != appearance else { return }
        appliedAppearance = appearance
        hostView.apply(appearance: appearance)
    }

    private func setActive(_ isActive: Bool) {
        hostView.isHidden = !isActive
        if !isActive {
            traceSession?.record("set-inactive", terminalView: hostView.terminalView, hostView: hostView)
            hostView.window?.makeFirstResponder(nil)
        } else {
            hostView.synchronizeTerminalLayout(maintainingScrollToEnd: true)
            traceSession?.record("set-active", terminalView: hostView.terminalView, hostView: hostView)
            startPendingLaunchIfReady()
        }
    }

    @MainActor
    @objc
    private func terminateOnMainThread() {
        traceSession?.record("terminate", terminalView: hostView.terminalView, hostView: hostView)
        hostView.terminalView.setHostLogging(directory: nil)
        pendingLaunchRequest = nil
        startedLaunchToken = nil
        hostView.terminalView.terminate()
        traceSession = nil
    }
}

struct TerminalLaunchRequest {
    let sshArguments: [String]
    let launchToken: UUID
}

final class TerminalMountContainerView: NSView {
    private weak var hostedView: NSView?
    private var hostedConstraints: [NSLayoutConstraint] = []
    var onLayout: (() -> Void)?

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
    }

    convenience init() {
        self.init(frame: .zero)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func layout() {
        super.layout()
        onLayout?()
    }

    func mount(_ view: NSView) {
        if hostedView === view, view.superview === self {
            return
        }

        unmountHostedView()
        if let previousContainer = view.superview as? TerminalMountContainerView,
           previousContainer !== self {
            previousContainer.releaseHostedViewReference(ifMatching: view)
        }
        view.removeFromSuperview()
        view.translatesAutoresizingMaskIntoConstraints = false
        addSubview(view)
        hostedView = view
        hostedConstraints = [
            view.leadingAnchor.constraint(equalTo: leadingAnchor),
            view.trailingAnchor.constraint(equalTo: trailingAnchor),
            view.topAnchor.constraint(equalTo: topAnchor),
            view.bottomAnchor.constraint(equalTo: bottomAnchor)
        ]
        NSLayoutConstraint.activate(hostedConstraints)
        needsLayout = true
    }

    func unmountHostedView() {
        NSLayoutConstraint.deactivate(hostedConstraints)
        hostedConstraints.removeAll(keepingCapacity: false)
        if hostedView?.superview === self {
            hostedView?.removeFromSuperview()
        }
        hostedView = nil
    }

    private func releaseHostedViewReference(ifMatching view: NSView) {
        guard hostedView === view else { return }
        NSLayoutConstraint.deactivate(hostedConstraints)
        hostedConstraints.removeAll(keepingCapacity: false)
        hostedView = nil
    }
}

final class TerminalHostView: NSView {
    let terminalView = LocalProcessTerminalView(frame: .zero)

    var hasUsableTerminalFrame: Bool {
        bounds.width >= 80 && bounds.height >= 40
    }

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        wantsLayer = true
        layer?.masksToBounds = true

        terminalView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(terminalView)

        NSLayoutConstraint.activate([
            terminalView.leadingAnchor.constraint(equalTo: leadingAnchor),
            terminalView.trailingAnchor.constraint(equalTo: trailingAnchor),
            terminalView.topAnchor.constraint(equalTo: topAnchor),
            terminalView.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    func synchronizeTerminalLayout(maintainingScrollToEnd: Bool) {
        guard hasUsableTerminalFrame else { return }
        layoutSubtreeIfNeeded()
        terminalView.layoutSubtreeIfNeeded()
        terminalView.synchronizeSizeWithFrame(maintainingScrollToEnd: maintainingScrollToEnd)
    }

    func apply(appearance: TerminalThemeAppearance) {
        let backgroundColor = appearance.backgroundColor.nsColor
        let foregroundColor = appearance.foregroundColor.nsColor

        layer?.backgroundColor = backgroundColor.cgColor
        terminalView.nativeBackgroundColor = backgroundColor
        terminalView.nativeForegroundColor = foregroundColor
        terminalView.selectedTextBackgroundColor = foregroundColor.withAlphaComponent(0.28)
        terminalView.caretColor = foregroundColor
        terminalView.caretTextColor = backgroundColor
        terminalView.installColors(appearance.ansiPalette.map(Self.makeTerminalColor(from:)))
    }

    private static func makeTerminalColor(from themeColor: TerminalThemeColor) -> SwiftTerm.Color {
        let color = themeColor.nsColor.usingColorSpace(.deviceRGB) ?? .black
        return SwiftTerm.Color(
            red: UInt16(color.redComponent * 65535),
            green: UInt16(color.greenComponent * 65535),
            blue: UInt16(color.blueComponent * 65535)
        )
    }
}
