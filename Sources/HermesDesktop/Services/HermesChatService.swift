import Foundation

final class HermesChatService: @unchecked Sendable {
    private let sshTransport: SSHTransport

    init(sshTransport: SSHTransport) {
        self.sshTransport = sshTransport
    }

    func sendMessage(
        _ prompt: String,
        sessionID: String?,
        connection: ConnectionProfile,
        autoApproveCommands: Bool
    ) async throws -> HermesChatTurnResult {
        let invocation = HermesChatInvocation(
            sessionID: sessionID,
            prompt: prompt,
            autoApproveCommands: autoApproveCommands
        )
        let script = try RemotePythonScript.wrap(
            HermesChatRequest(
                hermesHome: connection.remoteHermesHomePath,
                sessionID: sessionID,
                timeoutSeconds: 1800,
                arguments: invocation.arguments
            ),
            body: chatBody
        )

        return try await sshTransport.executeJSON(
            on: connection,
            pythonScript: script,
            responseType: HermesChatTurnResult.self
        )
    }

    private var chatBody: String {
        """
        import os
        import shutil
        import subprocess

        def compact_output(stdout, stderr, exit_code):
            merged = "\\n".join([
                stringify(stderr).strip() if stringify(stderr) else "",
                stringify(stdout).strip() if stringify(stdout) else "",
            ]).strip()
            if not merged:
                return f"Hermes chat exited with code {exit_code}."
            if len(merged) <= 4000:
                return merged
            return merged[-4000:]

        def compact_text(value, limit=12000):
            text = stringify(value)
            if text is None or len(text) <= limit:
                return text
            return text[-limit:]

        def looks_like_approval_request(text):
            lowered = (text or "").lower()
            approval_markers = [
                "approve",
                "approval",
                "deny",
                "requires confirmation",
                "requires approval",
                "command approval",
                "do you want to proceed",
                "allow command",
            ]
            return any(marker in lowered for marker in approval_markers)

        def approval_error(message):
            return (
                "Hermes requested command approval during this turn. "
                "Retry with Auto-approve commands enabled for this turn, or continue in Terminal if you want to review each approval manually."
                + ("\\n\\n" + message if message else "")
            )

        try:
            hermes_home = resolved_hermes_home()
            home = pathlib.Path.home()
            env = os.environ.copy()
            env["HERMES_HOME"] = str(hermes_home)
            env.setdefault("NO_COLOR", "1")
            env.setdefault("TERM", "dumb")

            path_entries = [
                str(home / ".local" / "bin"),
                str(home / ".hermes" / "hermes-agent" / "venv" / "bin"),
                str(home / ".cargo" / "bin"),
                "/opt/homebrew/bin",
                "/usr/local/bin",
                env.get("PATH", ""),
            ]
            env["PATH"] = os.pathsep.join([entry for entry in path_entries if entry])

            hermes_path = shutil.which("hermes", path=env["PATH"])
            if hermes_path is None:
                fail("Hermes CLI was not found in the remote SSH environment. Verify that `hermes` is installed and available on PATH for non-interactive SSH commands.")

            arguments = payload.get("arguments") or []
            if not isinstance(arguments, list) or not all(isinstance(item, str) for item in arguments):
                fail("Invalid Hermes chat invocation.")

            timeout_seconds = int(payload.get("timeout_seconds") or 1800)

            try:
                completed = subprocess.run(
                    [hermes_path] + arguments,
                    cwd=str(home),
                    env=env,
                    text=True,
                    stdin=subprocess.DEVNULL,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    timeout=timeout_seconds,
                )
            except subprocess.TimeoutExpired as exc:
                partial = compact_output(exc.stdout, exc.stderr, 124)
                if looks_like_approval_request(partial):
                    fail(approval_error(partial))
                fail(
                    "Hermes did not finish within the allotted time. The turn was stopped so the app would not remain blocked indefinitely."
                    + ("\\n\\n" + partial if partial else "")
                )

            if completed.returncode != 0:
                message = compact_output(completed.stdout, completed.stderr, completed.returncode)
                if looks_like_approval_request(message):
                    fail(approval_error(message))
                fail(message)

            print(json.dumps({
                "ok": True,
                "session_id": payload.get("session_id"),
                "stdout": compact_text(completed.stdout),
                "stderr": compact_text(completed.stderr),
            }, ensure_ascii=False))
        except Exception as exc:
            fail(f"Unable to run Hermes chat over SSH: {exc}")
        """
    }
}

private struct HermesChatRequest: Encodable {
    let hermesHome: String
    let sessionID: String?
    let timeoutSeconds: Int
    let arguments: [String]

    enum CodingKeys: String, CodingKey {
        case hermesHome = "hermes_home"
        case sessionID = "session_id"
        case timeoutSeconds = "timeout_seconds"
        case arguments
    }
}
