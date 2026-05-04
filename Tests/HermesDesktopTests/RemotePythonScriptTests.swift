import Foundation
import Testing
@testable import HermesDesktop

struct RemotePythonScriptTests {
    @Test
    func readonlySQLiteHelperFallsBackForWalDatabaseWithoutWritableSidecars() throws {
        let script = try RemotePythonScript.wrap([String: String](), body:
            """
            import shutil
            import tempfile

            root = pathlib.Path(tempfile.mkdtemp())
            db_path = root / "kanban.db"
            writer = sqlite3.connect(db_path)
            writer.execute("PRAGMA journal_mode=WAL")
            writer.execute("CREATE TABLE tasks(id TEXT PRIMARY KEY)")
            writer.execute("INSERT INTO tasks VALUES (?)", ("T1",))
            writer.commit()
            writer.close()

            os.chmod(root, 0o555)
            try:
                connection = connect_sqlite_readonly(db_path)
                count = connection.execute("SELECT COUNT(*) FROM tasks").fetchone()[0]
                connection.close()
            finally:
                os.chmod(root, 0o755)
                shutil.rmtree(root, ignore_errors=True)

            print(json.dumps({"ok": True, "count": count}, ensure_ascii=False))
            """
        )

        let temporaryDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(
            at: temporaryDirectory,
            withIntermediateDirectories: true
        )
        defer {
            try? FileManager.default.removeItem(at: temporaryDirectory)
        }

        let scriptURL = temporaryDirectory.appendingPathComponent("readonly-sqlite-helper.py")
        try script.write(to: scriptURL, atomically: true, encoding: .utf8)

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = ["python3", scriptURL.path]

        let outputPipe = Pipe()
        let errorPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = errorPipe

        try process.run()
        process.waitUntilExit()

        let output = String(
            data: outputPipe.fileHandleForReading.readDataToEndOfFile(),
            encoding: .utf8
        ) ?? ""
        let error = String(
            data: errorPipe.fileHandleForReading.readDataToEndOfFile(),
            encoding: .utf8
        ) ?? ""

        #expect(process.terminationStatus == 0)
        #expect(error.isEmpty)
        #expect(output.contains("\"count\": 1"))
    }
}
