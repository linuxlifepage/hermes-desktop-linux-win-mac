use crate::connection::{
    effective_target, remote_hermes_home_path, remote_shell_bootstrap_command,
    resolved_hermes_profile_name, workspace_scope_fingerprint,
};
use crate::error::{HermesError, Result};
use crate::models::{ConnectionProfile, TerminalCommandResult};
use crate::ssh;
use chrono::Utc;
use serde::Serialize;
use std::collections::HashMap;
#[cfg(unix)]
use std::fs::File;
use std::io::{Read, Write};
#[cfg(unix)]
use std::os::fd::{AsRawFd, FromRawFd};
#[cfg(not(unix))]
use std::process::ChildStdin;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Condvar, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

pub const TERMINAL_EVENT_NAME: &str = "terminal-session-event";
const BRACKETED_PASTE_ENABLE_SEQUENCE: &str = "\x1b[?2004h";
const INITIAL_INPUT_READINESS_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Clone, Default)]
pub struct TerminalState {
    sessions: Arc<Mutex<HashMap<String, TerminalProcess>>>,
}

#[derive(Clone)]
struct TerminalProcess {
    child: Arc<Mutex<Child>>,
    stdin: Arc<Mutex<TerminalInput>>,
    resize: TerminalResizeHandle,
}

struct TerminalSpawn {
    process: TerminalProcess,
    stdout: Box<dyn Read + Send>,
    stderr: Option<Box<dyn Read + Send>>,
}

enum TerminalInput {
    #[cfg(not(unix))]
    Pipe(ChildStdin),
    #[cfg(unix)]
    Pty(File),
}

impl Write for TerminalInput {
    fn write(&mut self, buffer: &[u8]) -> std::io::Result<usize> {
        match self {
            #[cfg(not(unix))]
            TerminalInput::Pipe(stdin) => stdin.write(buffer),
            #[cfg(unix)]
            TerminalInput::Pty(master) => master.write(buffer),
        }
    }

    fn flush(&mut self) -> std::io::Result<()> {
        match self {
            #[cfg(not(unix))]
            TerminalInput::Pipe(stdin) => stdin.flush(),
            #[cfg(unix)]
            TerminalInput::Pty(master) => master.flush(),
        }
    }
}

#[derive(Clone)]
enum TerminalResizeHandle {
    #[cfg(unix)]
    Pty(Arc<Mutex<File>>),
    #[cfg(not(unix))]
    Unsupported,
}

#[derive(Clone, Default)]
struct InitialInputGate {
    inner: Arc<(Mutex<InitialInputGateState>, Condvar)>,
}

#[derive(Default)]
struct InitialInputGateState {
    bracketed_paste_ready: bool,
    tail: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSessionInfo {
    pub id: String,
    pub title: String,
    pub profile_id: String,
    pub profile_label: String,
    pub hermes_profile_name: String,
    pub destination: String,
    pub workspace_scope_fingerprint: String,
    pub hermes_home_path: String,
    pub startup_command_line: Option<String>,
    pub initial_input: Option<String>,
    pub started_at: chrono::DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSessionEvent {
    pub session_id: String,
    pub kind: TerminalSessionEventKind,
    pub data: Option<String>,
    pub exit_code: Option<i32>,
    pub timestamp: chrono::DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum TerminalSessionEventKind {
    Started,
    Stdout,
    Stderr,
    InitialInputSent,
    Exit,
    Error,
}

pub async fn run_terminal_command_inner(
    profile: ConnectionProfile,
    command_line: String,
) -> Result<TerminalCommandResult> {
    let trimmed = command_line.trim().to_string();
    if trimmed.is_empty() {
        return Err(HermesError::Validation(
            "Terminal command is required.".to_string(),
        ));
    }

    let started_at = Utc::now();
    let result = ssh::execute(profile, trimmed.clone(), None).await?;
    let ended_at = Utc::now();
    Ok(TerminalCommandResult {
        command_line: trimmed,
        stdout: result.stdout,
        stderr: result.stderr,
        exit_code: result.exit_code,
        started_at,
        ended_at,
    })
}

pub fn start_terminal_session_inner(
    app: AppHandle,
    state: &TerminalState,
    profile: ConnectionProfile,
    startup_command_line: Option<String>,
    initial_input: Option<String>,
    cols: Option<u16>,
    rows: Option<u16>,
) -> Result<TerminalSessionInfo> {
    let session_id = Uuid::new_v4().to_string();
    let normalized_startup = startup_command_line
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let normalized_initial_input = initial_input
        .map(|value| value.trim_end_matches(['\r', '\n']).to_string())
        .filter(|value| !value.is_empty());
    let mut remote_command =
        remote_shell_bootstrap_command(&profile, normalized_startup.as_deref());
    if let (Some(c), Some(r)) = (cols, rows) {
        remote_command = format!("stty cols {} rows {} 2>/dev/null; {}", c, r, remote_command);
    }
    let arguments = ssh::shell_arguments(&profile, Some(remote_command), true);
    let spawn = spawn_interactive_ssh(arguments, cols, rows)?;
    let process = spawn.process.clone();

    state
        .sessions
        .lock()
        .map_err(|_| HermesError::Launch("Terminal session state is poisoned.".to_string()))?
        .insert(session_id.clone(), process.clone());

    let initial_input_gate = normalized_initial_input
        .as_ref()
        .map(|_| InitialInputGate::default());

    spawn_terminal_reader(
        app.clone(),
        session_id.clone(),
        TerminalSessionEventKind::Stdout,
        spawn.stdout,
        initial_input_gate.clone(),
    );
    if let Some(stderr) = spawn.stderr {
        spawn_terminal_reader(
            app.clone(),
            session_id.clone(),
            TerminalSessionEventKind::Stderr,
            stderr,
            initial_input_gate.clone(),
        );
    }
    spawn_terminal_waiter(
        app.clone(),
        state.sessions.clone(),
        session_id.clone(),
        process.child,
    );

    if let Some(input) = normalized_initial_input.clone() {
        spawn_initial_input_sender(
            app.clone(),
            session_id.clone(),
            process.stdin.clone(),
            input,
            initial_input_gate,
        );
    }

    emit_terminal_event(
        &app,
        TerminalSessionEvent {
            session_id: session_id.clone(),
            kind: TerminalSessionEventKind::Started,
            data: None,
            exit_code: None,
            timestamp: Utc::now(),
        },
    );

    Ok(TerminalSessionInfo {
        id: session_id,
        title: terminal_title(&profile, normalized_startup.as_deref()),
        profile_id: profile.id.to_string(),
        profile_label: profile.label.clone(),
        hermes_profile_name: resolved_hermes_profile_name(&profile),
        destination: terminal_destination(&profile),
        workspace_scope_fingerprint: workspace_scope_fingerprint(&profile),
        hermes_home_path: remote_hermes_home_path(&profile),
        startup_command_line: normalized_startup,
        initial_input: normalized_initial_input,
        started_at: Utc::now(),
    })
}

pub fn write_terminal_session_inner(
    state: &TerminalState,
    session_id: String,
    input: String,
) -> Result<()> {
    let process = state
        .sessions
        .lock()
        .map_err(|_| HermesError::Launch("Terminal session state is poisoned.".to_string()))?
        .get(&session_id)
        .cloned()
        .ok_or_else(|| HermesError::Validation("Terminal session is not running.".to_string()))?;

    let mut stdin = process
        .stdin
        .lock()
        .map_err(|_| HermesError::Launch("Terminal stdin is not available.".to_string()))?;
    stdin.write_all(input.as_bytes())?;
    stdin.flush()?;
    Ok(())
}

pub fn stop_terminal_session_inner(state: &TerminalState, session_id: String) -> Result<()> {
    let process = state
        .sessions
        .lock()
        .map_err(|_| HermesError::Launch("Terminal session state is poisoned.".to_string()))?
        .remove(&session_id);

    if let Some(process) = process {
        if let Ok(mut child) = process.child.lock() {
            let _ = child.kill();
        }
    }

    Ok(())
}

pub fn resize_terminal_session_inner(
    state: &TerminalState,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<()> {
    let cols = terminal_size_value(cols, 2);
    let rows = terminal_size_value(rows, 1);
    let process = state
        .sessions
        .lock()
        .map_err(|_| HermesError::Launch("Terminal session state is poisoned.".to_string()))?
        .get(&session_id)
        .cloned()
        .ok_or_else(|| HermesError::Validation("Terminal session is not running.".to_string()))?;

    resize_terminal_process(&process, cols, rows)
}

fn spawn_interactive_ssh(
    arguments: Vec<String>,
    cols: Option<u16>,
    rows: Option<u16>,
) -> Result<TerminalSpawn> {
    #[cfg(unix)]
    {
        spawn_interactive_ssh_with_pty(arguments, cols, rows)
    }
    #[cfg(not(unix))]
    {
        spawn_interactive_ssh_with_pipes(arguments)
    }
}

#[cfg(unix)]
fn spawn_interactive_ssh_with_pty(
    arguments: Vec<String>,
    cols: Option<u16>,
    rows: Option<u16>,
) -> Result<TerminalSpawn> {
    let (master, slave) = open_pty(cols, rows)?;
    let stdin = slave
        .try_clone()
        .map_err(|error| HermesError::Launch(error.to_string()))?;
    let stdout = slave
        .try_clone()
        .map_err(|error| HermesError::Launch(error.to_string()))?;
    let stderr = slave;
    let child = Command::new("ssh")
        .args(arguments)
        .env("TERM", "xterm-256color")
        .env("COLORTERM", "truecolor")
        .stdin(Stdio::from(stdin))
        .stdout(Stdio::from(stdout))
        .stderr(Stdio::from(stderr))
        .spawn()
        .map_err(|error| HermesError::Launch(error.to_string()))?;

    let master_writer = master
        .try_clone()
        .map_err(|error| HermesError::Launch(error.to_string()))?;
    let master_resizer = master
        .try_clone()
        .map_err(|error| HermesError::Launch(error.to_string()))?;
    let child = Arc::new(Mutex::new(child));
    Ok(TerminalSpawn {
        process: TerminalProcess {
            child,
            stdin: Arc::new(Mutex::new(TerminalInput::Pty(master_writer))),
            resize: TerminalResizeHandle::Pty(Arc::new(Mutex::new(master_resizer))),
        },
        stdout: Box::new(master),
        stderr: None,
    })
}

#[cfg(not(unix))]
fn spawn_interactive_ssh_with_pipes(arguments: Vec<String>) -> Result<TerminalSpawn> {
    let mut child = Command::new("ssh")
        .args(arguments)
        .env("TERM", "xterm-256color")
        .env("COLORTERM", "truecolor")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| HermesError::Launch(error.to_string()))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| HermesError::Launch("Failed to open terminal stdout.".to_string()))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| HermesError::Launch("Failed to open terminal stderr.".to_string()))?;
    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| HermesError::Launch("Failed to open terminal stdin.".to_string()))?;

    Ok(TerminalSpawn {
        process: TerminalProcess {
            child: Arc::new(Mutex::new(child)),
            stdin: Arc::new(Mutex::new(TerminalInput::Pipe(stdin))),
            resize: TerminalResizeHandle::Unsupported,
        },
        stdout: Box::new(stdout),
        stderr: Some(Box::new(stderr)),
    })
}

#[cfg(unix)]
fn open_pty(cols: Option<u16>, rows: Option<u16>) -> Result<(File, File)> {
    let mut master_fd = -1;
    let mut slave_fd = -1;
    let mut winsize = libc::winsize {
        ws_row: rows.unwrap_or(24),
        ws_col: cols.unwrap_or(80),
        ws_xpixel: 0,
        ws_ypixel: 0,
    };
    let result = unsafe {
        libc::openpty(
            &mut master_fd,
            &mut slave_fd,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            &mut winsize,
        )
    };
    if result == -1 {
        return Err(HermesError::Launch(
            std::io::Error::last_os_error().to_string(),
        ));
    }
    let master = unsafe { File::from_raw_fd(master_fd) };
    let slave = unsafe { File::from_raw_fd(slave_fd) };
    Ok((master, slave))
}

fn resize_terminal_process(process: &TerminalProcess, cols: u16, rows: u16) -> Result<()> {
    match &process.resize {
        #[cfg(unix)]
        TerminalResizeHandle::Pty(master) => {
            let master = master
                .lock()
                .map_err(|_| HermesError::Launch("Terminal PTY state is poisoned.".to_string()))?;
            set_pty_size(&master, cols, rows)?;
            if let Ok(child) = process.child.lock() {
                let pid = child.id() as libc::pid_t;
                unsafe {
                    libc::kill(pid, libc::SIGWINCH);
                }
            }
            Ok(())
        }
        #[cfg(not(unix))]
        TerminalResizeHandle::Unsupported => Ok(()),
    }
}

#[cfg(unix)]
fn set_pty_size(master: &File, cols: u16, rows: u16) -> Result<()> {
    let winsize = libc::winsize {
        ws_row: rows,
        ws_col: cols,
        ws_xpixel: 0,
        ws_ypixel: 0,
    };
    let result = unsafe { libc::ioctl(master.as_raw_fd(), libc::TIOCSWINSZ, &winsize) };
    if result == -1 {
        return Err(HermesError::Launch(
            std::io::Error::last_os_error().to_string(),
        ));
    }
    Ok(())
}

fn terminal_size_value(value: u16, minimum: u16) -> u16 {
    value.max(minimum)
}

fn spawn_terminal_reader<R>(
    app: AppHandle,
    session_id: String,
    kind: TerminalSessionEventKind,
    mut reader: R,
    initial_input_gate: Option<InitialInputGate>,
) where
    R: Read + Send + 'static,
{
    thread::spawn(move || {
        let mut buffer = [0_u8; 4096];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(count) => {
                    let data = String::from_utf8_lossy(&buffer[..count]).to_string();
                    if let Some(gate) = &initial_input_gate {
                        gate.observe(&data);
                    }
                    emit_terminal_event(
                        &app,
                        TerminalSessionEvent {
                            session_id: session_id.clone(),
                            kind: kind.clone(),
                            data: Some(data),
                            exit_code: None,
                            timestamp: Utc::now(),
                        },
                    );
                }
                Err(error) => {
                    if is_terminal_reader_eof(&error) {
                        break;
                    }
                    emit_terminal_event(
                        &app,
                        TerminalSessionEvent {
                            session_id: session_id.clone(),
                            kind: TerminalSessionEventKind::Error,
                            data: Some(error.to_string()),
                            exit_code: None,
                            timestamp: Utc::now(),
                        },
                    );
                    break;
                }
            }
        }
    });
}

fn is_terminal_reader_eof(error: &std::io::Error) -> bool {
    #[cfg(unix)]
    {
        error.raw_os_error() == Some(libc::EIO)
    }
    #[cfg(not(unix))]
    {
        let _ = error;
        false
    }
}

fn spawn_terminal_waiter(
    app: AppHandle,
    sessions: Arc<Mutex<HashMap<String, TerminalProcess>>>,
    session_id: String,
    child: Arc<Mutex<Child>>,
) {
    thread::spawn(move || loop {
        let status = {
            match child.lock() {
                Ok(mut child) => child.try_wait(),
                Err(_) => {
                    emit_terminal_event(
                        &app,
                        TerminalSessionEvent {
                            session_id: session_id.clone(),
                            kind: TerminalSessionEventKind::Error,
                            data: Some("Terminal process state is poisoned.".to_string()),
                            exit_code: None,
                            timestamp: Utc::now(),
                        },
                    );
                    break;
                }
            }
        };

        match status {
            Ok(Some(status)) => {
                if let Ok(mut sessions) = sessions.lock() {
                    sessions.remove(&session_id);
                }
                emit_terminal_event(
                    &app,
                    TerminalSessionEvent {
                        session_id,
                        kind: TerminalSessionEventKind::Exit,
                        data: None,
                        exit_code: Some(status.code().unwrap_or(-1)),
                        timestamp: Utc::now(),
                    },
                );
                break;
            }
            Ok(None) => thread::sleep(Duration::from_millis(100)),
            Err(error) => {
                if let Ok(mut sessions) = sessions.lock() {
                    sessions.remove(&session_id);
                }
                emit_terminal_event(
                    &app,
                    TerminalSessionEvent {
                        session_id: session_id.clone(),
                        kind: TerminalSessionEventKind::Error,
                        data: Some(error.to_string()),
                        exit_code: None,
                        timestamp: Utc::now(),
                    },
                );
                break;
            }
        }
    });
}

fn spawn_initial_input_sender(
    app: AppHandle,
    session_id: String,
    stdin: Arc<Mutex<TerminalInput>>,
    input: String,
    initial_input_gate: Option<InitialInputGate>,
) {
    thread::spawn(move || {
        let bracketed_paste_ready = initial_input_gate
            .as_ref()
            .map(|gate| gate.wait_for_bracketed_paste(INITIAL_INPUT_READINESS_TIMEOUT))
            .unwrap_or(false);
        let payload = bracketed_paste_submission(&input);
        let result = stdin
            .lock()
            .map_err(|_| "Terminal stdin is not available.".to_string())
            .and_then(|mut stdin| {
                stdin
                    .write_all(&payload)
                    .and_then(|_| stdin.flush())
                    .map_err(|error| error.to_string())
            });

        match result {
            Ok(()) => emit_terminal_event(
                &app,
                TerminalSessionEvent {
                    session_id,
                    kind: TerminalSessionEventKind::InitialInputSent,
                    data: Some(
                        if bracketed_paste_ready {
                            "bracketed_paste_mode_ready"
                        } else {
                            "bracketed_paste_mode_timeout"
                        }
                        .to_string(),
                    ),
                    exit_code: None,
                    timestamp: Utc::now(),
                },
            ),
            Err(error) => emit_terminal_event(
                &app,
                TerminalSessionEvent {
                    session_id,
                    kind: TerminalSessionEventKind::Error,
                    data: Some(error),
                    exit_code: None,
                    timestamp: Utc::now(),
                },
            ),
        }
    });
}

impl InitialInputGate {
    fn observe(&self, data: &str) {
        let (lock, condvar) = &*self.inner;
        let Ok(mut state) = lock.lock() else {
            return;
        };
        if state.bracketed_paste_ready {
            return;
        }

        let combined = format!("{}{}", state.tail, data);
        if combined.contains(BRACKETED_PASTE_ENABLE_SEQUENCE) {
            state.bracketed_paste_ready = true;
            condvar.notify_all();
            return;
        }

        state.tail = trailing_chars(&combined, BRACKETED_PASTE_ENABLE_SEQUENCE.len() - 1);
    }

    fn wait_for_bracketed_paste(&self, timeout: Duration) -> bool {
        let (lock, condvar) = &*self.inner;
        let Ok(mut state) = lock.lock() else {
            return false;
        };
        let deadline = Instant::now() + timeout;
        while !state.bracketed_paste_ready {
            let Some(remaining) = deadline.checked_duration_since(Instant::now()) else {
                break;
            };
            if remaining.is_zero() {
                break;
            }
            match condvar.wait_timeout(state, remaining) {
                Ok((next_state, result)) => {
                    state = next_state;
                    if result.timed_out() {
                        break;
                    }
                }
                Err(_) => return false,
            }
        }
        state.bracketed_paste_ready
    }
}

fn trailing_chars(value: &str, max_chars: usize) -> String {
    let mut chars = value.chars().rev().take(max_chars).collect::<Vec<_>>();
    chars.reverse();
    chars.into_iter().collect()
}

fn emit_terminal_event(app: &AppHandle, event: TerminalSessionEvent) {
    let _ = app.emit(TERMINAL_EVENT_NAME, event);
}

fn bracketed_paste_submission(input: &str) -> Vec<u8> {
    let mut payload = Vec::new();
    payload.extend_from_slice(b"\x1b[200~");
    payload.extend_from_slice(input.as_bytes());
    payload.extend_from_slice(b"\x1b[201~\r");
    payload
}

fn terminal_title(profile: &ConnectionProfile, startup_command_line: Option<&str>) -> String {
    if let Some(command_line) = startup_command_line {
        if command_line.contains("--resume") {
            return format!("{} · resume", profile.label);
        }
        if command_line.contains(" chat") || command_line.ends_with("chat") {
            return format!("{} · chat", profile.label);
        }
    }
    format!("{} · shell", profile.label)
}

fn terminal_destination(profile: &ConnectionProfile) -> String {
    let target = effective_target(profile);
    if profile.ssh_user.trim().is_empty() {
        target
    } else {
        format!("{}@{target}", profile.ssh_user.trim())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::ConnectionProfile;

    #[test]
    fn bracketed_paste_submission_preserves_blank_lines_and_submits_once() {
        let prompt = "Check repository\n\ninspect open issues.";

        let payload = bracketed_paste_submission(prompt);

        assert!(payload.starts_with(b"\x1b[200~"));
        assert!(payload.ends_with(b"\x1b[201~\r"));
        assert_eq!(
            std::str::from_utf8(&payload[6..payload.len() - 7]).expect("utf8 prompt"),
            prompt
        );
        assert_eq!(payload.iter().filter(|byte| **byte == b'\r').count(), 1);
    }

    #[test]
    fn bracketed_paste_submission_preserves_long_prompt_without_truncation() {
        let prompt = (0..4_000)
            .map(|index| format!("segment-{index}-abcdefghij"))
            .collect::<Vec<_>>()
            .join(" ");

        let payload = bracketed_paste_submission(&prompt);
        let extracted = std::str::from_utf8(&payload[6..payload.len() - 7]).expect("utf8 prompt");

        assert_eq!(extracted, prompt);
        assert!(extracted.ends_with("segment-3999-abcdefghij"));
    }

    #[test]
    fn initial_input_gate_detects_split_bracketed_paste_sequence() {
        let gate = InitialInputGate::default();

        gate.observe("\x1b[?20");
        assert!(!gate.wait_for_bracketed_paste(Duration::from_millis(1)));
        gate.observe("04h");

        assert!(gate.wait_for_bracketed_paste(Duration::from_millis(1)));
    }

    #[test]
    fn trailing_chars_handles_short_and_long_values() {
        assert_eq!(trailing_chars("abc", 8), "abc");
        assert_eq!(trailing_chars("abcdef", 3), "def");
    }

    #[test]
    fn terminal_size_value_clamps_to_minimum() {
        assert_eq!(terminal_size_value(0, 2), 2);
        assert_eq!(terminal_size_value(1, 2), 2);
        assert_eq!(terminal_size_value(120, 2), 120);
    }

    #[test]
    fn terminal_titles_reflect_startup_intent() {
        let profile = profile("Prod", "prod-box", "alice");

        assert_eq!(terminal_title(&profile, None), "Prod · shell");
        assert_eq!(
            terminal_title(&profile, Some("hermes --resume session-1")),
            "Prod · resume"
        );
        assert_eq!(terminal_title(&profile, Some("hermes chat")), "Prod · chat");
    }

    #[test]
    fn terminal_destination_uses_user_and_effective_target() {
        assert_eq!(
            terminal_destination(&profile("Prod", "prod-box", "alice")),
            "alice@prod-box"
        );
        assert_eq!(
            terminal_destination(&profile("Prod", "prod-box", "")),
            "prod-box"
        );
    }

    fn profile(label: &str, alias: &str, user: &str) -> ConnectionProfile {
        let mut profile = ConnectionProfile::default();
        profile.label = label.to_string();
        profile.ssh_alias = alias.to_string();
        profile.ssh_host = "ignored.example.com".to_string();
        profile.ssh_user = user.to_string();
        profile
    }
}
