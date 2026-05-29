use std::ffi::OsString;
use std::fs::{self, File};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use crate::connection::{remote_hermes_home_shell_expression, remote_service_command};
use crate::error::{HermesError, Result};
use crate::models::ConnectionProfile;
use crate::ssh;
use chrono::{SecondsFormat, Utc};

pub fn save_local_export_inner(file_name: String, contents: String) -> Result<String> {
    let downloads = downloads_dir()?;
    fs::create_dir_all(&downloads)?;
    let safe_name = sanitize_file_name(&file_name)?;
    let path = available_export_path(&downloads, &safe_name);
    fs::write(&path, contents.as_bytes())?;
    Ok(path.display().to_string())
}

pub async fn save_hermes_directory_backup_inner(profile: ConnectionProfile) -> Result<String> {
    tauri::async_runtime::spawn_blocking(move || save_hermes_directory_backup_blocking(profile))
        .await
        .map_err(|error| HermesError::Launch(error.to_string()))?
}

fn save_hermes_directory_backup_blocking(profile: ConnectionProfile) -> Result<String> {
    let downloads = downloads_dir()?;
    fs::create_dir_all(&downloads)?;
    let safe_name = sanitize_file_name(&hermes_directory_backup_file_name(&profile))?;
    let path = available_export_path(&downloads, &safe_name);
    let file = File::create(&path)?;
    let command_line = remote_hermes_directory_archive_command(&profile);
    let remote_command = remote_service_command(&profile, &command_line);
    let arguments = ssh::shell_arguments(&profile, Some(remote_command), false);

    let output = Command::new("ssh")
        .args(arguments)
        .stdin(Stdio::null())
        .stdout(Stdio::from(file))
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| HermesError::Launch(error.to_string()))?
        .wait_with_output()?;

    if !output.status.success() {
        let _ = fs::remove_file(&path);
        return Err(HermesError::Remote(remote_archive_error(&output.stderr)));
    }

    Ok(path.display().to_string())
}

fn hermes_directory_backup_file_name(profile: &ConnectionProfile) -> String {
    let stamp = Utc::now()
        .to_rfc3339_opts(SecondsFormat::Millis, true)
        .replace([':', '.'], "-");
    format!("hermes-full-backup-{}-{stamp}.tar.gz", profile.label)
}

fn remote_hermes_directory_archive_command(profile: &ConnectionProfile) -> String {
    let backup_dir = if profile.custom_hermes_home_path.is_some() {
        remote_hermes_home_shell_expression(profile)
    } else {
        "$HOME/.hermes".to_string()
    };
    format!(
        r#"set -eu
HERMES_BACKUP_DIR="{backup_dir}"
if [ ! -d "$HERMES_BACKUP_DIR" ]; then
  printf 'Hermes directory not found: %s\n' "$HERMES_BACKUP_DIR" >&2
  exit 2
fi
parent=$(dirname "$HERMES_BACKUP_DIR")
base=$(basename "$HERMES_BACKUP_DIR")
stamp=$(date +%s)
tmp="${{TMPDIR:-/tmp}}/hermes-desktop-backup-${{stamp}}-$$.tar.gz"
err="${{tmp}}.err"
cleanup() {{
  rm -f "$tmp" "$err"
}}
trap cleanup EXIT HUP INT TERM
cd "$parent"
if tar -czf "$tmp" "$base" 2>"$err"; then
  :
else
  code=$?
  cat "$err" >&2 || true
  if [ "$code" -gt 1 ]; then
    exit "$code"
  fi
fi
cat "$tmp"
"#
    )
}

fn remote_archive_error(stderr: &[u8]) -> String {
    let message = String::from_utf8_lossy(stderr).trim().to_string();
    if message.is_empty() {
        return "Remote Hermes directory backup failed.".to_string();
    }
    message
}

fn downloads_dir() -> Result<PathBuf> {
    if let Some(path) = std::env::var_os("XDG_DOWNLOAD_DIR")
        .map(PathBuf::from)
        .filter(|path| path.is_absolute())
    {
        return Ok(path);
    }

    if let Some(home) = home_dir() {
        return Ok(home.join("Downloads"));
    }

    std::env::current_dir().map_err(HermesError::from)
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

fn sanitize_file_name(file_name: &str) -> Result<String> {
    let candidate = file_name
        .chars()
        .map(|character| match character {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '-',
            character if character.is_control() => '-',
            character => character,
        })
        .collect::<String>()
        .trim_matches(['.', ' ', '-'])
        .to_string();

    if candidate.is_empty() {
        return Err(HermesError::Validation(
            "Export file name cannot be empty.".to_string(),
        ));
    }

    Ok(candidate)
}

fn available_export_path(directory: &Path, file_name: &str) -> PathBuf {
    let initial = directory.join(file_name);
    if !initial.exists() {
        return initial;
    }

    let path = Path::new(file_name);
    let stem = path
        .file_stem()
        .map(OsString::from)
        .unwrap_or_else(|| OsString::from("export"));
    let extension = path.extension().map(OsString::from);

    for index in 1..10_000 {
        let mut candidate = stem.clone();
        candidate.push(format!("-{index}"));
        if let Some(extension) = &extension {
            candidate.push(".");
            candidate.push(extension);
        }
        let path = directory.join(candidate);
        if !path.exists() {
            return path;
        }
    }

    directory.join(file_name)
}

#[cfg(test)]
mod tests {
    use super::{remote_hermes_directory_archive_command, sanitize_file_name};
    use crate::models::ConnectionProfile;

    #[test]
    fn local_export_file_name_rejects_paths_and_control_chars() {
        let sanitized = sanitize_file_name("../bad:name\n.json").unwrap();
        assert_eq!(sanitized, "bad-name-.json");
    }

    #[test]
    fn full_backup_archives_root_hermes_directory_and_cleans_remote_temp_file() {
        let mut profile = ConnectionProfile::default();
        profile.label = "Test Host".to_string();

        let command = remote_hermes_directory_archive_command(&profile);

        assert!(command.contains(r#"HERMES_BACKUP_DIR="$HOME/.hermes""#));
        assert!(command.contains(r#"tar -czf "$tmp" "$base""#));
        assert!(command.contains("cat \"$tmp\""));
        assert!(command.contains("trap cleanup EXIT HUP INT TERM"));
        assert!(command.contains("rm -f \"$tmp\" \"$err\""));
    }
}
