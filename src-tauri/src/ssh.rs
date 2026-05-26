use crate::connection::{effective_target, remote_service_command};
use crate::error::{HermesError, Result};
use crate::models::ConnectionProfile;
use std::io::Write;
use std::process::{Command, Stdio};

#[derive(Debug)]
pub struct SshCommandResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

pub async fn execute_json<T>(profile: ConnectionProfile, python_script: String) -> Result<T>
where
    T: serde::de::DeserializeOwned + Send + 'static,
{
    let result = execute(
        profile.clone(),
        "python3 -".to_string(),
        Some(python_script.into_bytes()),
    )
    .await?;
    validate_success(&result, Some(&profile))?;
    let value = serde_json::from_str::<T>(&result.stdout).map_err(|error| {
        HermesError::InvalidJson(format!(
            "{error}\n\nstdout:\n{}\n\nstderr:\n{}",
            result.stdout, result.stderr
        ))
    })?;
    Ok(value)
}

pub async fn execute(
    profile: ConnectionProfile,
    command_line: String,
    standard_input: Option<Vec<u8>>,
) -> Result<SshCommandResult> {
    tauri::async_runtime::spawn_blocking(move || {
        let remote_command = remote_service_command(&profile, &command_line);
        let arguments = shell_arguments(&profile, Some(remote_command), false);
        run_ssh(arguments, standard_input)
    })
    .await
    .map_err(|error| HermesError::Launch(error.to_string()))?
}

fn run_ssh(arguments: Vec<String>, standard_input: Option<Vec<u8>>) -> Result<SshCommandResult> {
    let mut child = Command::new("ssh")
        .args(arguments)
        .stdin(if standard_input.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| HermesError::Launch(error.to_string()))?;

    if let Some(input) = standard_input {
        let mut stdin = child
            .stdin
            .take()
            .ok_or_else(|| HermesError::Launch("Failed to open ssh stdin.".to_string()))?;
        stdin.write_all(&input)?;
    }

    let output = child.wait_with_output()?;
    Ok(SshCommandResult {
        stdout: String::from_utf8(output.stdout).map_err(|_| HermesError::InvalidUtf8)?,
        stderr: String::from_utf8(output.stderr).map_err(|_| HermesError::InvalidUtf8)?,
        exit_code: output.status.code().unwrap_or(-1),
    })
}

pub fn shell_arguments(
    profile: &ConnectionProfile,
    remote_command: Option<String>,
    allocate_tty: bool,
) -> Vec<String> {
    let mut arguments = vec![
        "-o".to_string(),
        "BatchMode=yes".to_string(),
        "-o".to_string(),
        "ConnectTimeout=10".to_string(),
        "-o".to_string(),
        "ServerAliveInterval=15".to_string(),
        "-o".to_string(),
        "ServerAliveCountMax=3".to_string(),
    ];

    arguments.push(if allocate_tty { "-tt" } else { "-T" }.to_string());

    if let Some(port) = profile.ssh_port {
        arguments.extend(["-p".to_string(), port.to_string()]);
    }

    arguments.push("--".to_string());
    arguments.push(destination(profile));

    if let Some(remote_command) = remote_command {
        arguments.push(remote_command);
    }

    arguments
}

fn destination(profile: &ConnectionProfile) -> String {
    let target = effective_target(profile);
    if profile.ssh_user.trim().is_empty() {
        target
    } else {
        format!("{}@{target}", profile.ssh_user.trim())
    }
}

fn validate_success(result: &SshCommandResult, profile: Option<&ConnectionProfile>) -> Result<()> {
    if result.exit_code == 0 {
        return Ok(());
    }
    Err(HermesError::Remote(describe_remote_failure(
        result, profile,
    )))
}

fn describe_remote_failure(
    result: &SshCommandResult,
    profile: Option<&ConnectionProfile>,
) -> String {
    if let Some(structured) = structured_remote_error(&result.stdout) {
        return structured;
    }
    if let Some(structured) = structured_remote_error(&result.stderr) {
        return structured;
    }

    let raw = [result.stderr.trim(), result.stdout.trim()]
        .into_iter()
        .find(|item| !item.is_empty())
        .unwrap_or("");
    let lowered = raw.to_lowercase();
    let target = profile.map(effective_target).unwrap_or_default();

    if lowered.contains("permission denied") {
        return "SSH authentication failed. Verify the key, SSH agent, and user for this SSH target.".to_string();
    }
    if lowered.contains("host key verification failed") {
        return "SSH host key verification failed. Connect once in a terminal or update known_hosts before retrying."
            .to_string();
    }
    if lowered.contains("remote host identification has changed") {
        return "The SSH host key changed for this target. Refresh the entry in known_hosts before retrying."
            .to_string();
    }
    if lowered.contains("could not resolve hostname")
        || lowered.contains("name or service not known")
    {
        return "The SSH target could not be resolved. Check the alias, hostname, IP address, or SSH config entry in this profile."
            .to_string();
    }
    if lowered.contains("connection refused") {
        if is_loopback_target(&target) {
            return "The SSH server on this computer refused the connection. If you are connecting to localhost, make sure SSH access is enabled and retry."
                .to_string();
        }
        return "The SSH server refused the connection. Confirm that SSH is enabled and reachable on the target host."
            .to_string();
    }
    if lowered.contains("operation timed out") || lowered.contains("connection timed out") {
        if is_loopback_target(&target) {
            return "The SSH connection to this computer timed out. If you are testing localhost, verify that SSH access is enabled and retry."
                .to_string();
        }
        return "The SSH connection timed out. Check that the target host is reachable and that your SSH route is correct."
            .to_string();
    }
    if lowered.contains("no route to host") || lowered.contains("network is unreachable") {
        return "The SSH target is unreachable. Check the hostname, IP address, VPN, or local network path and retry."
            .to_string();
    }
    if lowered.contains("python3: command not found")
        || lowered.contains("command not found: python3")
        || lowered.contains("python3: not found")
        || lowered.contains("unknown command: python3")
        || lowered.contains("env: python3: no such file or directory")
    {
        return "SSH succeeded, but python3 is not available in the remote non-interactive SSH shell PATH. Install python3 or expose it in the SSH shell environment before retrying."
            .to_string();
    }

    if !raw.is_empty() {
        return raw.to_string();
    }
    format!("SSH command failed with exit code {}.", result.exit_code)
}

fn structured_remote_error(output: &str) -> Option<String> {
    let value = serde_json::from_str::<serde_json::Value>(output).ok()?;
    if value.get("ok").and_then(serde_json::Value::as_bool) == Some(false) {
        return value
            .get("error")
            .and_then(serde_json::Value::as_str)
            .map(str::to_string);
    }
    None
}

fn is_loopback_target(target: &str) -> bool {
    let normalized = target.trim().to_lowercase();
    matches!(
        normalized.as_str(),
        "localhost" | "127.0.0.1" | "::1" | "0:0:0:0:0:0:0:1"
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::ConnectionProfile;

    #[test]
    fn shell_arguments_use_explicit_destination_port_and_remote_command() {
        let profile = profile("prod-box", "ignored.example.com", "alice", Some(2222));

        let arguments = shell_arguments(&profile, Some("python3 -".to_string()), false);

        assert!(arguments.contains(&"-T".to_string()));
        assert!(arguments.contains(&"-p".to_string()));
        assert!(arguments.contains(&"2222".to_string()));
        assert!(arguments.contains(&"--".to_string()));
        assert!(arguments.contains(&"alice@prod-box".to_string()));
        assert_eq!(arguments.last().map(String::as_str), Some("python3 -"));
    }

    #[test]
    fn shell_arguments_allocate_tty_for_interactive_sessions() {
        let profile = profile("", "example.com", "", None);

        let arguments = shell_arguments(&profile, None, true);

        assert!(arguments.contains(&"-tt".to_string()));
        assert!(!arguments.contains(&"-T".to_string()));
        assert_eq!(arguments.last().map(String::as_str), Some("example.com"));
    }

    #[test]
    fn remote_failure_prefers_structured_error_payload() {
        let result = SshCommandResult {
            stdout: r#"{"ok": false, "error": "Hermes store unavailable"}"#.to_string(),
            stderr: "Permission denied".to_string(),
            exit_code: 1,
        };

        assert_eq!(
            describe_remote_failure(&result, None),
            "Hermes store unavailable"
        );
    }

    #[test]
    fn remote_failure_maps_common_ssh_errors() {
        let profile = profile("", "localhost", "", None);
        let result = SshCommandResult {
            stdout: String::new(),
            stderr: "ssh: connect to host localhost port 22: Connection refused".to_string(),
            exit_code: 255,
        };

        let message = describe_remote_failure(&result, Some(&profile));

        assert!(message.contains("this computer refused the connection"));
    }

    #[test]
    fn remote_failure_mentions_non_interactive_python_path() {
        let profile = profile("", "example.com", "", None);
        let result = SshCommandResult {
            stdout: String::new(),
            stderr: "zsh:1: command not found: python3".to_string(),
            exit_code: 127,
        };

        let message = describe_remote_failure(&result, Some(&profile));

        assert!(message.contains("non-interactive SSH shell PATH"));
        assert!(message.contains("python3"));
    }

    fn profile(alias: &str, host: &str, user: &str, port: Option<u16>) -> ConnectionProfile {
        let mut profile = ConnectionProfile::default();
        profile.label = "Prod".to_string();
        profile.ssh_alias = alias.to_string();
        profile.ssh_host = host.to_string();
        profile.ssh_user = user.to_string();
        profile.ssh_port = port;
        profile
    }
}
