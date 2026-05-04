import Foundation

final class KanbanBrowserService: @unchecked Sendable {
    private let sshTransport: SSHTransport

    init(sshTransport: SSHTransport) {
        self.sshTransport = sshTransport
    }

    func loadBoard(connection: ConnectionProfile, includeArchived: Bool) async throws -> KanbanBoard {
        let script = try RemotePythonScript.wrap(
            KanbanBoardRequest(
                kanbanHome: connection.remoteKanbanHomePath,
                includeArchived: includeArchived
            ),
            body: boardBody
        )

        return try await sshTransport.executeJSON(
            on: connection,
            pythonScript: script,
            responseType: KanbanBoardResponse.self
        ).board
    }

    func loadTaskDetail(connection: ConnectionProfile, taskID: String) async throws -> KanbanTaskDetail {
        let script = try RemotePythonScript.wrap(
            KanbanTaskDetailRequest(
                kanbanHome: connection.remoteKanbanHomePath,
                taskID: taskID
            ),
            body: taskDetailBody
        )

        return try await sshTransport.executeJSON(
            on: connection,
            pythonScript: script,
            responseType: KanbanTaskDetailResponse.self
        ).detail
    }

    func createTask(connection: ConnectionProfile, draft: KanbanTaskDraft) async throws -> String {
        let response = try await performMutation(
            connection: connection,
            request: KanbanMutationRequest(
                kanbanHome: connection.remoteKanbanHomePath,
                author: connection.resolvedHermesProfileName,
                action: "create",
                taskID: nil,
                title: draft.normalizedTitle,
                body: draft.normalizedBody,
                assignee: draft.normalizedAssignee,
                priority: draft.priority,
                tenant: draft.normalizedTenant,
                skills: draft.skills,
                triage: draft.startsInTriage,
                text: nil,
                result: nil,
                maxSpawn: nil
            )
        )

        guard let taskID = response.taskID else {
            throw SSHTransportError.invalidResponse("The remote Kanban create operation did not return a task ID.")
        }

        return taskID
    }

    func addComment(connection: ConnectionProfile, taskID: String, body: String) async throws {
        _ = try await performMutation(
            connection: connection,
            request: KanbanMutationRequest(
                kanbanHome: connection.remoteKanbanHomePath,
                author: connection.resolvedHermesProfileName,
                action: "comment",
                taskID: taskID,
                title: nil,
                body: nil,
                assignee: nil,
                priority: nil,
                tenant: nil,
                skills: nil,
                triage: nil,
                text: body,
                result: nil,
                maxSpawn: nil
            )
        )
    }

    func assignTask(connection: ConnectionProfile, taskID: String, assignee: String?) async throws {
        _ = try await performMutation(
            connection: connection,
            request: KanbanMutationRequest(
                kanbanHome: connection.remoteKanbanHomePath,
                author: connection.resolvedHermesProfileName,
                action: "assign",
                taskID: taskID,
                title: nil,
                body: nil,
                assignee: assignee,
                priority: nil,
                tenant: nil,
                skills: nil,
                triage: nil,
                text: nil,
                result: nil,
                maxSpawn: nil
            )
        )
    }

    func blockTask(connection: ConnectionProfile, taskID: String, reason: String?) async throws {
        _ = try await performMutation(
            connection: connection,
            request: KanbanMutationRequest(
                kanbanHome: connection.remoteKanbanHomePath,
                author: connection.resolvedHermesProfileName,
                action: "block",
                taskID: taskID,
                title: nil,
                body: nil,
                assignee: nil,
                priority: nil,
                tenant: nil,
                skills: nil,
                triage: nil,
                text: reason,
                result: nil,
                maxSpawn: nil
            )
        )
    }

    func unblockTask(connection: ConnectionProfile, taskID: String) async throws {
        _ = try await performMutation(
            connection: connection,
            request: KanbanMutationRequest(
                kanbanHome: connection.remoteKanbanHomePath,
                author: connection.resolvedHermesProfileName,
                action: "unblock",
                taskID: taskID,
                title: nil,
                body: nil,
                assignee: nil,
                priority: nil,
                tenant: nil,
                skills: nil,
                triage: nil,
                text: nil,
                result: nil,
                maxSpawn: nil
            )
        )
    }

    func completeTask(connection: ConnectionProfile, taskID: String, result: String?) async throws {
        _ = try await performMutation(
            connection: connection,
            request: KanbanMutationRequest(
                kanbanHome: connection.remoteKanbanHomePath,
                author: connection.resolvedHermesProfileName,
                action: "complete",
                taskID: taskID,
                title: nil,
                body: nil,
                assignee: nil,
                priority: nil,
                tenant: nil,
                skills: nil,
                triage: nil,
                text: nil,
                result: result,
                maxSpawn: nil
            )
        )
    }

    func archiveTask(connection: ConnectionProfile, taskID: String) async throws {
        _ = try await performMutation(
            connection: connection,
            request: KanbanMutationRequest(
                kanbanHome: connection.remoteKanbanHomePath,
                author: connection.resolvedHermesProfileName,
                action: "archive",
                taskID: taskID,
                title: nil,
                body: nil,
                assignee: nil,
                priority: nil,
                tenant: nil,
                skills: nil,
                triage: nil,
                text: nil,
                result: nil,
                maxSpawn: nil
            )
        )
    }

    func deleteTask(connection: ConnectionProfile, taskID: String) async throws {
        _ = try await performMutation(
            connection: connection,
            request: KanbanMutationRequest(
                kanbanHome: connection.remoteKanbanHomePath,
                author: connection.resolvedHermesProfileName,
                action: "delete",
                taskID: taskID,
                title: nil,
                body: nil,
                assignee: nil,
                priority: nil,
                tenant: nil,
                skills: nil,
                triage: nil,
                text: nil,
                result: nil,
                maxSpawn: nil
            )
        )
    }

    func dispatchNow(connection: ConnectionProfile, maxSpawn: Int = 8) async throws -> KanbanDispatchResult? {
        try await performMutation(
            connection: connection,
            request: KanbanMutationRequest(
                kanbanHome: connection.remoteKanbanHomePath,
                author: connection.resolvedHermesProfileName,
                action: "dispatch",
                taskID: nil,
                title: nil,
                body: nil,
                assignee: nil,
                priority: nil,
                tenant: nil,
                skills: nil,
                triage: nil,
                text: nil,
                result: nil,
                maxSpawn: maxSpawn
            )
        ).dispatch
    }

    private func performMutation(
        connection: ConnectionProfile,
        request: KanbanMutationRequest
    ) async throws -> KanbanOperationResponse {
        let script = try RemotePythonScript.wrap(request, body: mutationBody)
        return try await sshTransport.executeJSON(
            on: connection,
            pythonScript: script,
            responseType: KanbanOperationResponse.self
        )
    }

    private var boardBody: String {
        kanbanPythonHelpers + """

        try:
            board = load_board(include_archived=bool(payload.get("include_archived")))
            print(json.dumps({
                "ok": True,
                "board": board,
            }, ensure_ascii=False))
        except Exception as exc:
            fail(f"Unable to load the remote Hermes Kanban board: {exc}")
        """
    }

    private var taskDetailBody: String {
        kanbanPythonHelpers + """

        try:
            task_id = normalize_text(payload.get("task_id"))
            if not task_id:
                fail("The Kanban task ID is required.")
            detail = load_task_detail(task_id)
            if detail is None:
                fail(f"No such Kanban task: {task_id}")
            print(json.dumps({
                "ok": True,
                "detail": detail,
            }, ensure_ascii=False))
        except Exception as exc:
            fail(f"Unable to load the remote Kanban task: {exc}")
        """
    }

    private var mutationBody: String {
        kanbanPythonHelpers + """

        def mutation_result(message=None, task_id=None, dispatch=None):
            detail = load_task_detail(task_id) if task_id else None
            print(json.dumps({
                "ok": True,
                "message": message,
                "task_id": task_id,
                "detail": detail,
                "dispatch": dispatch,
            }, ensure_ascii=False))

        def perform_with_module(action, task_id, author):
            kb = import_kanban_module(required=True)
            db_path = kanban_db_path()
            if action == "delete" and not db_path.exists():
                fail(f"No such Kanban task: {task_id}")
            os.environ["HERMES_HOME"] = str(kanban_home_path())
            with kb.connect(db_path) as conn:
                if action == "create":
                    title = normalize_text(payload.get("title"))
                    if not title:
                        fail("Task title is required.")
                    created_id = kb.create_task(
                        conn,
                        title=title,
                        body=normalize_text(payload.get("body")),
                        assignee=normalize_text(payload.get("assignee")),
                        created_by=author,
                        tenant=normalize_text(payload.get("tenant")),
                        priority=int(payload.get("priority") or 0),
                        triage=bool(payload.get("triage")),
                        skills=payload.get("skills") or None,
                    )
                    return ("Kanban task created.", created_id, None)

                if not task_id and action != "dispatch":
                    fail("The Kanban task ID is required.")

                if action == "comment":
                    text = normalize_text(payload.get("text"))
                    if not text:
                        fail("Comment text is required.")
                    kb.add_comment(conn, task_id, author, text)
                    return ("Comment added.", task_id, None)

                if action == "assign":
                    assignee = normalize_text(payload.get("assignee"))
                    if not kb.assign_task(conn, task_id, assignee):
                        fail(f"No such Kanban task: {task_id}")
                    return ("Task assigned.", task_id, None)

                if action == "block":
                    reason = normalize_text(payload.get("text"))
                    if reason:
                        kb.add_comment(conn, task_id, author, f"BLOCKED: {reason}")
                    if not kb.block_task(conn, task_id, reason=reason):
                        fail(f"Cannot block Kanban task: {task_id}")
                    return ("Task blocked.", task_id, None)

                if action == "unblock":
                    if not kb.unblock_task(conn, task_id):
                        fail(f"Cannot unblock Kanban task: {task_id}")
                    return ("Task unblocked.", task_id, None)

                if action == "complete":
                    result = normalize_text(payload.get("result"))
                    if not kb.complete_task(conn, task_id, result=result, summary=result):
                        fail(f"Cannot complete Kanban task: {task_id}")
                    return ("Task completed.", task_id, None)

                if action == "archive":
                    if not kb.archive_task(conn, task_id):
                        fail(f"Cannot archive Kanban task: {task_id}")
                    return ("Task archived.", task_id, None)

                if action == "delete":
                    if not delete_task_rows(conn, task_id, author):
                        fail(f"No such Kanban task: {task_id}")
                    try:
                        kb.recompute_ready(conn)
                    except Exception:
                        pass
                    return ("Task deleted.", None, None)

                if action == "dispatch":
                    res = kb.dispatch_once(
                        conn,
                        max_spawn=int(payload.get("max_spawn") or 8),
                    )
                    dispatch = {
                        "reclaimed": int(getattr(res, "reclaimed", 0) or 0),
                        "crashed": list(getattr(res, "crashed", []) or []),
                        "timed_out": list(getattr(res, "timed_out", []) or []),
                        "auto_blocked": list(getattr(res, "auto_blocked", []) or []),
                        "promoted": int(getattr(res, "promoted", 0) or 0),
                        "spawned": [
                            {"task_id": tid, "assignee": who, "workspace": ws}
                            for (tid, who, ws) in list(getattr(res, "spawned", []) or [])
                        ],
                        "skipped_unassigned": list(getattr(res, "skipped_unassigned", []) or []),
                    }
                    return ("Dispatcher nudged.", None, dispatch)

            fail(f"Unsupported Kanban action: {action}")

        def perform_with_cli(action, task_id, author):
            if action == "create":
                title = normalize_text(payload.get("title"))
                if not title:
                    fail("Task title is required.")
                args = ["kanban", "create", "--json", "--created-by", author]
                body = normalize_text(payload.get("body"))
                if body:
                    args.extend(["--body", body])
                assignee = normalize_text(payload.get("assignee"))
                if assignee:
                    args.extend(["--assignee", assignee])
                tenant = normalize_text(payload.get("tenant"))
                if tenant:
                    args.extend(["--tenant", tenant])
                priority = int(payload.get("priority") or 0)
                if priority:
                    args.extend(["--priority", str(priority)])
                if bool(payload.get("triage")):
                    args.append("--triage")
                for skill in payload.get("skills") or []:
                    skill_text = normalize_text(skill)
                    if skill_text:
                        args.extend(["--skill", skill_text])
                args.append(title)
                data = run_hermes_cli(args, expect_json=True)
                return ("Kanban task created.", data.get("id"), None)

            if not task_id and action != "dispatch":
                fail("The Kanban task ID is required.")

            if action == "comment":
                text = normalize_text(payload.get("text"))
                if not text:
                    fail("Comment text is required.")
                run_hermes_cli(["kanban", "comment", "--author", author, task_id, text])
                return ("Comment added.", task_id, None)

            if action == "assign":
                assignee = normalize_text(payload.get("assignee")) or "none"
                run_hermes_cli(["kanban", "assign", task_id, assignee])
                return ("Task assigned.", task_id, None)

            if action == "block":
                reason = normalize_text(payload.get("text"))
                args = ["kanban", "block", task_id]
                if reason:
                    args.append(reason)
                run_hermes_cli(args)
                return ("Task blocked.", task_id, None)

            if action == "unblock":
                run_hermes_cli(["kanban", "unblock", task_id])
                return ("Task unblocked.", task_id, None)

            if action == "complete":
                args = ["kanban", "complete", task_id]
                result = normalize_text(payload.get("result"))
                if result:
                    args.extend(["--result", result])
                run_hermes_cli(args)
                return ("Task completed.", task_id, None)

            if action == "archive":
                run_hermes_cli(["kanban", "archive", task_id])
                return ("Task archived.", task_id, None)

            if action == "delete":
                db_path = kanban_db_path()
                if not db_path.exists():
                    fail(f"No such Kanban task: {task_id}")
                conn = sqlite3.connect(db_path)
                conn.row_factory = sqlite3.Row
                try:
                    if not delete_task_rows(conn, task_id, author):
                        fail(f"No such Kanban task: {task_id}")
                    recompute_ready_rows(conn)
                finally:
                    conn.close()
                return ("Task deleted.", None, None)

            if action == "dispatch":
                data = run_hermes_cli(
                    ["kanban", "dispatch", "--max", str(int(payload.get("max_spawn") or 8)), "--json"],
                    expect_json=True,
                )
                return ("Dispatcher nudged.", None, data)

            fail(f"Unsupported Kanban action: {action}")

        try:
            action = normalize_text(payload.get("action"))
            if not action:
                fail("The Kanban action is required.")
            task_id = normalize_text(payload.get("task_id"))
            author = normalize_text(payload.get("author")) or "desktop"

            try:
                message, affected_task_id, dispatch = perform_with_module(action, task_id, author)
            except ImportError:
                message, affected_task_id, dispatch = perform_with_cli(action, task_id, author)

            mutation_result(message=message, task_id=affected_task_id, dispatch=dispatch)
        except Exception as exc:
            fail(f"Unable to update the remote Kanban board: {exc}")
        """
    }

    private var kanbanPythonHelpers: String {
        """
        import json
        import os
        import pathlib
        import shutil
        import sqlite3
        import subprocess
        import sys

        def kanban_home_path():
            home = pathlib.Path.home()
            requested = expand_remote_path(payload.get("kanban_home") or "~/.hermes", home)
            return requested or (home / ".hermes")

        def kanban_db_path():
            return kanban_home_path() / "kanban.db"

        def find_hermes_binary():
            candidate = shutil.which("hermes")
            if candidate:
                return candidate
            fallback = pathlib.Path.home() / ".local" / "bin" / "hermes"
            if fallback.exists() and os.access(fallback, os.X_OK):
                return str(fallback)
            venv_fallback = pathlib.Path.home() / ".hermes" / "hermes-agent" / "venv" / "bin" / "hermes"
            if venv_fallback.exists() and os.access(venv_fallback, os.X_OK):
                return str(venv_fallback)
            return None

        def run_hermes_cli(args, expect_json=False):
            hermes_binary = find_hermes_binary()
            if hermes_binary is None:
                fail("Hermes CLI was not found on the active host.")
            home = pathlib.Path.home()
            env = os.environ.copy()
            env["HERMES_HOME"] = str(kanban_home_path())
            path_entries = [
                str(home / ".local" / "bin"),
                str(home / ".hermes" / "hermes-agent" / "venv" / "bin"),
                str(home / ".cargo" / "bin"),
                "/opt/homebrew/bin",
                "/usr/local/bin",
                env.get("PATH", ""),
            ]
            env["PATH"] = os.pathsep.join([entry for entry in path_entries if entry])
            completed = subprocess.run(
                [hermes_binary] + list(args),
                capture_output=True,
                text=True,
                env=env,
            )
            if completed.returncode != 0:
                message = (completed.stderr or completed.stdout or "Hermes Kanban command failed.").strip()
                fail(message)
            output = (completed.stdout or "").strip()
            if not expect_json:
                return output
            try:
                return json.loads(output or "{}")
            except Exception as exc:
                fail(f"Hermes Kanban command returned invalid JSON: {exc}")

        def import_kanban_module(required=False):
            os.environ["HERMES_HOME"] = str(kanban_home_path())
            try:
                import hermes_cli.kanban_db as kb
                return kb
            except Exception as exc:
                if required:
                    raise ImportError(str(exc))
                return None

        def dispatcher_status():
            os.environ["HERMES_HOME"] = str(kanban_home_path())
            try:
                import hermes_cli.kanban as kanban_cli
                running, message = kanban_cli._check_dispatcher_presence()
                return {
                    "running": bool(running),
                    "message": message or None,
                }
            except Exception:
                return {
                    "running": None,
                    "message": None,
                }

        def table_exists(conn, table_name):
            row = conn.execute(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?",
                (table_name,),
            ).fetchone()
            return row is not None

        def table_columns(conn, table_name):
            try:
                return {row["name"] for row in conn.execute(f"PRAGMA table_info({quote_ident(table_name)})")}
            except Exception:
                return set()

        def int_value(value, default=None):
            if value is None:
                return default
            try:
                return int(value)
            except Exception:
                return default

        def parse_json_object(value):
            if value is None:
                return None
            if isinstance(value, dict):
                return value
            try:
                parsed = json.loads(value)
                return parsed if isinstance(parsed, dict) else None
            except Exception:
                return None

        def parse_json_list(value):
            if value is None:
                return []
            if isinstance(value, list):
                return [str(item) for item in value if item]
            try:
                parsed = json.loads(value)
                if isinstance(parsed, list):
                    return [str(item) for item in parsed if item]
            except Exception:
                pass
            return []

        def task_object_to_dict(task, conn=None):
            task_id = getattr(task, "id", "")
            parent_ids = []
            child_ids = []
            comment_count = 0
            event_count = 0
            run_count = 0
            latest_event_at = None
            if conn is not None and task_id:
                parent_ids = link_ids(conn, task_id, parents=True)
                child_ids = link_ids(conn, task_id, parents=False)
                comment_count = count_rows(conn, "task_comments", "task_id", task_id)
                event_count = count_rows(conn, "task_events", "task_id", task_id)
                run_count = count_rows(conn, "task_runs", "task_id", task_id)
                latest_event_at = latest_event_timestamp(conn, task_id)
            return {
                "id": task_id,
                "title": getattr(task, "title", None),
                "body": getattr(task, "body", None),
                "assignee": getattr(task, "assignee", None),
                "status": getattr(task, "status", "unknown"),
                "priority": int_value(getattr(task, "priority", 0), 0),
                "created_by": getattr(task, "created_by", None),
                "created_at": int_value(getattr(task, "created_at", None)),
                "started_at": int_value(getattr(task, "started_at", None)),
                "completed_at": int_value(getattr(task, "completed_at", None)),
                "workspace_kind": getattr(task, "workspace_kind", "scratch"),
                "workspace_path": getattr(task, "workspace_path", None),
                "tenant": getattr(task, "tenant", None),
                "result": getattr(task, "result", None),
                "skills": parse_json_list(getattr(task, "skills", None)) if not isinstance(getattr(task, "skills", None), list) else getattr(task, "skills", []),
                "spawn_failures": int_value(getattr(task, "spawn_failures", 0), 0),
                "worker_pid": int_value(getattr(task, "worker_pid", None)),
                "last_spawn_error": getattr(task, "last_spawn_error", None),
                "max_runtime_seconds": int_value(getattr(task, "max_runtime_seconds", None)),
                "last_heartbeat_at": int_value(getattr(task, "last_heartbeat_at", None)),
                "current_run_id": int_value(getattr(task, "current_run_id", None)),
                "parent_ids": parent_ids,
                "child_ids": child_ids,
                "progress": progress_for_task(conn, task_id),
                "comment_count": comment_count,
                "event_count": event_count,
                "run_count": run_count,
                "latest_event_at": latest_event_at,
            }

        def task_row_to_dict(row, conn=None):
            keys = set(row.keys())
            def get(name, default=None):
                return row[name] if name in keys else default
            task_id = get("id", "")
            return {
                "id": task_id,
                "title": get("title"),
                "body": get("body"),
                "assignee": get("assignee"),
                "status": get("status", "unknown"),
                "priority": int_value(get("priority"), 0),
                "created_by": get("created_by"),
                "created_at": int_value(get("created_at")),
                "started_at": int_value(get("started_at")),
                "completed_at": int_value(get("completed_at")),
                "workspace_kind": get("workspace_kind", "scratch"),
                "workspace_path": get("workspace_path"),
                "tenant": get("tenant"),
                "result": get("result"),
                "skills": parse_json_list(get("skills")),
                "spawn_failures": int_value(get("spawn_failures"), 0),
                "worker_pid": int_value(get("worker_pid")),
                "last_spawn_error": get("last_spawn_error"),
                "max_runtime_seconds": int_value(get("max_runtime_seconds")),
                "last_heartbeat_at": int_value(get("last_heartbeat_at")),
                "current_run_id": int_value(get("current_run_id")),
                "parent_ids": link_ids(conn, task_id, parents=True) if conn else [],
                "child_ids": link_ids(conn, task_id, parents=False) if conn else [],
                "progress": progress_for_task(conn, task_id),
                "comment_count": count_rows(conn, "task_comments", "task_id", task_id) if conn else 0,
                "event_count": count_rows(conn, "task_events", "task_id", task_id) if conn else 0,
                "run_count": count_rows(conn, "task_runs", "task_id", task_id) if conn else 0,
                "latest_event_at": latest_event_timestamp(conn, task_id) if conn else None,
            }

        def count_rows(conn, table, column, value):
            if not conn or not table_exists(conn, table):
                return 0
            row = conn.execute(
                f"SELECT COUNT(*) AS n FROM {quote_ident(table)} WHERE {quote_ident(column)} = ?",
                (value,),
            ).fetchone()
            return int(row["n"] or 0) if row else 0

        def delete_task_rows(conn, task_id, author):
            if not conn or not task_id or not table_exists(conn, "tasks"):
                return False
            try:
                conn.execute("BEGIN IMMEDIATE")
                row = conn.execute("SELECT id FROM tasks WHERE id = ?", (task_id,)).fetchone()
                if row is None:
                    conn.rollback()
                    return False

                if table_exists(conn, "task_links"):
                    conn.execute(
                        "DELETE FROM task_links WHERE parent_id = ? OR child_id = ?",
                        (task_id, task_id),
                    )
                if table_exists(conn, "task_comments"):
                    conn.execute("DELETE FROM task_comments WHERE task_id = ?", (task_id,))
                if table_exists(conn, "task_events"):
                    conn.execute("DELETE FROM task_events WHERE task_id = ?", (task_id,))
                if table_exists(conn, "task_runs"):
                    conn.execute("DELETE FROM task_runs WHERE task_id = ?", (task_id,))
                if table_exists(conn, "kanban_notify_subs"):
                    conn.execute("DELETE FROM kanban_notify_subs WHERE task_id = ?", (task_id,))

                cur = conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
                conn.commit()
                return cur.rowcount == 1
            except Exception:
                try:
                    conn.rollback()
                except Exception:
                    pass
                raise

        def recompute_ready_rows(conn):
            if not conn or not table_exists(conn, "tasks") or not table_exists(conn, "task_links"):
                return 0
            import time
            promoted = 0
            try:
                conn.execute("BEGIN IMMEDIATE")
                todo_rows = conn.execute("SELECT id FROM tasks WHERE status = 'todo'").fetchall()
                for row in todo_rows:
                    task_id = row["id"]
                    parents = conn.execute(
                        "SELECT t.status FROM tasks t "
                        "JOIN task_links l ON l.parent_id = t.id "
                        "WHERE l.child_id = ?",
                        (task_id,),
                    ).fetchall()
                    if all(parent["status"] == "done" for parent in parents):
                        cur = conn.execute(
                            "UPDATE tasks SET status = 'ready' WHERE id = ? AND status = 'todo'",
                            (task_id,),
                        )
                        if cur.rowcount == 1:
                            if table_exists(conn, "task_events"):
                                conn.execute(
                                    "INSERT INTO task_events (task_id, kind, payload, created_at) "
                                    "VALUES (?, 'promoted', NULL, ?)",
                                    (task_id, int(time.time())),
                                )
                            promoted += 1
                conn.commit()
                return promoted
            except Exception:
                try:
                    conn.rollback()
                except Exception:
                    pass
                raise

        def link_ids(conn, task_id, parents):
            if not conn or not table_exists(conn, "task_links"):
                return []
            column = "parent_id" if parents else "child_id"
            where_column = "child_id" if parents else "parent_id"
            rows = conn.execute(
                f"SELECT {quote_ident(column)} AS id FROM task_links WHERE {quote_ident(where_column)} = ? ORDER BY {quote_ident(column)}",
                (task_id,),
            ).fetchall()
            return [row["id"] for row in rows]

        def progress_for_task(conn, task_id):
            if not conn or not table_exists(conn, "task_links") or not table_exists(conn, "tasks"):
                return None
            row = conn.execute(
                "SELECT COUNT(*) AS total, "
                "SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS done "
                "FROM task_links l JOIN tasks t ON t.id = l.child_id "
                "WHERE l.parent_id = ?",
                (task_id,),
            ).fetchone()
            total = int(row["total"] or 0) if row else 0
            if total <= 0:
                return None
            return {
                "done": int(row["done"] or 0),
                "total": total,
            }

        def latest_event_timestamp(conn, task_id):
            if not conn or not table_exists(conn, "task_events"):
                return None
            row = conn.execute(
                "SELECT created_at FROM task_events WHERE task_id = ? ORDER BY created_at DESC, id DESC LIMIT 1",
                (task_id,),
            ).fetchone()
            return int_value(row["created_at"]) if row else None

        def latest_event_id(conn):
            if not conn or not table_exists(conn, "task_events"):
                return None
            row = conn.execute("SELECT MAX(id) AS id FROM task_events").fetchone()
            return int_value(row["id"]) if row else None

        def direct_tasks(conn, include_archived):
            if not table_exists(conn, "tasks"):
                return []
            query = "SELECT * FROM tasks"
            if not include_archived:
                query += " WHERE status != 'archived'"
            query += " ORDER BY priority DESC, created_at ASC"
            return [task_row_to_dict(row, conn) for row in conn.execute(query).fetchall()]

        def direct_assignees(conn):
            names = set()
            counts = {}
            if table_exists(conn, "tasks"):
                for row in conn.execute(
                    "SELECT assignee, status, COUNT(*) AS n FROM tasks "
                    "WHERE status != 'archived' AND assignee IS NOT NULL "
                    "GROUP BY assignee, status"
                ).fetchall():
                    name = row["assignee"]
                    names.add(name)
                    counts.setdefault(name, {})[row["status"]] = int(row["n"] or 0)
            profiles_dir = pathlib.Path.home() / ".hermes" / "profiles"
            on_disk = set()
            if profiles_dir.exists():
                for item in sorted(profiles_dir.iterdir()):
                    if item.is_dir() and (item / "config.yaml").exists():
                        on_disk.add(item.name)
                        names.add(item.name)
            return [
                {"name": name, "on_disk": name in on_disk, "counts": counts.get(name, {})}
                for name in sorted(names)
            ]

        def direct_stats(conn):
            import time
            by_status = {}
            by_assignee = {}
            oldest_ready = None
            if table_exists(conn, "tasks"):
                for row in conn.execute(
                    "SELECT status, COUNT(*) AS n FROM tasks "
                    "WHERE status != 'archived' GROUP BY status"
                ).fetchall():
                    by_status[row["status"]] = int(row["n"] or 0)
                for row in conn.execute(
                    "SELECT assignee, status, COUNT(*) AS n FROM tasks "
                    "WHERE status != 'archived' AND assignee IS NOT NULL "
                    "GROUP BY assignee, status"
                ).fetchall():
                    by_assignee.setdefault(row["assignee"], {})[row["status"]] = int(row["n"] or 0)
                ready = conn.execute(
                    "SELECT MIN(created_at) AS created_at FROM tasks WHERE status = 'ready'"
                ).fetchone()
                if ready and ready["created_at"] is not None:
                    oldest_ready = max(0, int(time.time()) - int(ready["created_at"]))
            return {
                "by_status": by_status,
                "by_assignee": by_assignee,
                "oldest_ready_age_seconds": oldest_ready,
                "now": int(time.time()),
            }

        def direct_tenants(conn):
            if not conn or not table_exists(conn, "tasks"):
                return []
            rows = conn.execute(
                "SELECT DISTINCT tenant FROM tasks "
                "WHERE tenant IS NOT NULL ORDER BY tenant"
            ).fetchall()
            return [row["tenant"] for row in rows]

        def load_board(include_archived=False):
            db_path = kanban_db_path()
            has_cli = find_hermes_binary() is not None
            kb = import_kanban_module(required=False)
            has_module = kb is not None
            base = {
                "database_path": tilde(db_path, pathlib.Path.home()),
                "host_wide": True,
                "is_initialized": db_path.exists(),
                "has_kanban_module": has_module,
                "has_hermes_cli": has_cli,
                "dispatcher": dispatcher_status(),
                "latest_event_id": None,
                "tasks": [],
                "assignees": [],
                "tenants": [],
                "stats": None,
            }
            if not db_path.exists():
                return base

            conn = None
            try:
                if kb is not None:
                    conn = kb.connect(db_path)
                    tasks = [
                        task_object_to_dict(task, conn)
                        for task in kb.list_tasks(conn, include_archived=include_archived)
                    ]
                    try:
                        assignees = kb.known_assignees(conn)
                    except Exception:
                        assignees = direct_assignees(conn)
                    try:
                        stats = kb.board_stats(conn)
                    except Exception:
                        stats = direct_stats(conn)
                else:
                    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
                    conn.row_factory = sqlite3.Row
                    tasks = direct_tasks(conn, include_archived)
                    assignees = direct_assignees(conn)
                    stats = direct_stats(conn)
                base.update({
                    "tasks": tasks,
                    "assignees": assignees,
                    "tenants": direct_tenants(conn),
                    "stats": stats,
                    "latest_event_id": latest_event_id(conn),
                })
                return base
            finally:
                if conn is not None:
                    conn.close()

        def comment_to_dict(comment):
            return {
                "id": int_value(getattr(comment, "id", 0), 0),
                "task_id": getattr(comment, "task_id", ""),
                "author": getattr(comment, "author", ""),
                "body": getattr(comment, "body", ""),
                "created_at": int_value(getattr(comment, "created_at", 0), 0),
            }

        def event_to_dict(event):
            return {
                "id": int_value(getattr(event, "id", 0), 0),
                "task_id": getattr(event, "task_id", ""),
                "kind": getattr(event, "kind", ""),
                "payload": getattr(event, "payload", None),
                "created_at": int_value(getattr(event, "created_at", 0), 0),
                "run_id": int_value(getattr(event, "run_id", None)),
            }

        def run_to_dict(run):
            return {
                "id": int_value(getattr(run, "id", 0), 0),
                "task_id": getattr(run, "task_id", ""),
                "profile": getattr(run, "profile", None),
                "step_key": getattr(run, "step_key", None),
                "status": getattr(run, "status", ""),
                "outcome": getattr(run, "outcome", None),
                "summary": getattr(run, "summary", None),
                "error": getattr(run, "error", None),
                "metadata": getattr(run, "metadata", None),
                "worker_pid": int_value(getattr(run, "worker_pid", None)),
                "started_at": int_value(getattr(run, "started_at", 0), 0),
                "ended_at": int_value(getattr(run, "ended_at", None)),
            }

        def load_task_detail(task_id):
            db_path = kanban_db_path()
            if not db_path.exists():
                return None
            kb = import_kanban_module(required=False)
            conn = None
            try:
                if kb is not None:
                    conn = kb.connect(db_path)
                    task = kb.get_task(conn, task_id)
                    if task is None:
                        return None
                    parent_ids = kb.parent_ids(conn, task_id)
                    child_ids = kb.child_ids(conn, task_id)
                    comments = [comment_to_dict(item) for item in kb.list_comments(conn, task_id)]
                    events = [event_to_dict(item) for item in kb.list_events(conn, task_id)]
                    runs = [run_to_dict(item) for item in kb.list_runs(conn, task_id)]
                    worker_log = None
                    try:
                        worker_log = kb.read_worker_log(task_id, tail_bytes=65536)
                    except Exception:
                        worker_log = None
                    return {
                        "task": task_object_to_dict(task, conn),
                        "parent_ids": parent_ids,
                        "child_ids": child_ids,
                        "comments": comments,
                        "events": events,
                        "runs": runs,
                        "worker_log": worker_log,
                    }

                conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
                conn.row_factory = sqlite3.Row
                if not table_exists(conn, "tasks"):
                    return None
                row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
                if row is None:
                    return None
                comments = []
                if table_exists(conn, "task_comments"):
                    comments = [
                        {
                            "id": int_value(item["id"], 0),
                            "task_id": item["task_id"],
                            "author": item["author"],
                            "body": item["body"],
                            "created_at": int_value(item["created_at"], 0),
                        }
                        for item in conn.execute(
                            "SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at ASC, id ASC",
                            (task_id,),
                        ).fetchall()
                    ]
                events = []
                if table_exists(conn, "task_events"):
                    for item in conn.execute(
                        "SELECT * FROM task_events WHERE task_id = ? ORDER BY created_at ASC, id ASC",
                        (task_id,),
                    ).fetchall():
                        events.append({
                            "id": int_value(item["id"], 0),
                            "task_id": item["task_id"],
                            "kind": item["kind"],
                            "payload": parse_json_object(item["payload"]),
                            "created_at": int_value(item["created_at"], 0),
                            "run_id": int_value(item["run_id"]) if "run_id" in item.keys() else None,
                        })
                runs = []
                if table_exists(conn, "task_runs"):
                    for item in conn.execute(
                        "SELECT * FROM task_runs WHERE task_id = ? ORDER BY started_at ASC, id ASC",
                        (task_id,),
                    ).fetchall():
                        runs.append({
                            "id": int_value(item["id"], 0),
                            "task_id": item["task_id"],
                            "profile": item["profile"],
                            "step_key": item["step_key"],
                            "status": item["status"],
                            "outcome": item["outcome"],
                            "summary": item["summary"],
                            "error": item["error"],
                            "metadata": parse_json_object(item["metadata"]),
                            "worker_pid": int_value(item["worker_pid"]),
                            "started_at": int_value(item["started_at"], 0),
                            "ended_at": int_value(item["ended_at"]),
                        })
                log_path = kanban_home_path() / "kanban" / "logs" / f"{task_id}.log"
                worker_log = None
                if log_path.exists():
                    try:
                        data = log_path.read_bytes()[-65536:]
                        worker_log = data.decode("utf-8", errors="replace")
                    except Exception:
                        worker_log = None
                return {
                    "task": task_row_to_dict(row, conn),
                    "parent_ids": link_ids(conn, task_id, parents=True),
                    "child_ids": link_ids(conn, task_id, parents=False),
                    "comments": comments,
                    "events": events,
                    "runs": runs,
                    "worker_log": worker_log,
                }
            finally:
                if conn is not None:
                    conn.close()
        """
    }
}

private struct KanbanBoardRequest: Encodable {
    let kanbanHome: String
    let includeArchived: Bool

    enum CodingKeys: String, CodingKey {
        case kanbanHome = "kanban_home"
        case includeArchived = "include_archived"
    }
}

private struct KanbanTaskDetailRequest: Encodable {
    let kanbanHome: String
    let taskID: String

    enum CodingKeys: String, CodingKey {
        case kanbanHome = "kanban_home"
        case taskID = "task_id"
    }
}

private struct KanbanMutationRequest: Encodable {
    let kanbanHome: String
    let author: String
    let action: String
    let taskID: String?
    let title: String?
    let body: String?
    let assignee: String?
    let priority: Int?
    let tenant: String?
    let skills: [String]?
    let triage: Bool?
    let text: String?
    let result: String?
    let maxSpawn: Int?

    enum CodingKeys: String, CodingKey {
        case kanbanHome = "kanban_home"
        case author
        case action
        case taskID = "task_id"
        case title
        case body
        case assignee
        case priority
        case tenant
        case skills
        case triage
        case text
        case result
        case maxSpawn = "max_spawn"
    }
}
