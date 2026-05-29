use crate::error::{HermesError, Result};
use crate::models::{AppSnapshot, ConnectionProfile};
use crate::storage::{
    load_connections, load_preferences, load_snapshot, save_connections, save_preferences,
    AppStorage,
};
use chrono::Utc;
use uuid::Uuid;

pub fn list_connections_inner(storage: &AppStorage) -> Result<Vec<ConnectionProfile>> {
    load_connections(storage)
}

pub fn save_connection_inner(
    storage: &AppStorage,
    profile: ConnectionProfile,
) -> Result<ConnectionProfile> {
    let normalized = normalize_profile(profile)?;
    let mut connections = load_connections(storage)?;

    if let Some(existing) = connections.iter_mut().find(|item| item.id == normalized.id) {
        *existing = normalized.clone();
    } else {
        connections.push(normalized.clone());
    }

    connections.sort_by(|left, right| left.label.to_lowercase().cmp(&right.label.to_lowercase()));
    save_connections(storage, &connections)?;
    Ok(normalized)
}

pub fn delete_connection_inner(storage: &AppStorage, id: &str) -> Result<()> {
    let mut connections = load_connections(storage)?;
    connections.retain(|connection| connection.id.to_string() != id);
    save_connections(storage, &connections)?;

    let mut preferences = load_preferences(storage)?;
    if preferences.active_connection_id.as_deref() == Some(id) {
        preferences.active_connection_id = None;
        save_preferences(storage, &preferences)?;
    }

    Ok(())
}

pub fn set_active_connection_inner(
    storage: &AppStorage,
    id: Option<String>,
) -> Result<AppSnapshot> {
    if let Some(ref id_value) = id {
        Uuid::parse_str(id_value).map_err(|_| {
            HermesError::Validation("The connection id is not a valid UUID.".to_string())
        })?;
        let exists = load_connections(storage)?
            .iter()
            .any(|connection| connection.id.to_string() == *id_value);
        if !exists {
            return Err(HermesError::Validation(
                "The selected connection does not exist.".to_string(),
            ));
        }
    }

    let mut preferences = load_preferences(storage)?;
    preferences.active_connection_id = id;
    save_preferences(storage, &preferences)?;
    load_snapshot(storage)
}

pub fn normalize_profile(mut profile: ConnectionProfile) -> Result<ConnectionProfile> {
    profile.label = profile.label.trim().to_string();
    profile.ssh_alias = profile.ssh_alias.trim().to_string();
    profile.ssh_host = profile.ssh_host.trim().to_string();
    profile.ssh_user = profile.ssh_user.trim().to_string();
    profile.ssh_password = profile.ssh_password.filter(|password| !password.is_empty());
    profile.hermes_profile = normalize_optional(profile.hermes_profile);
    profile.custom_hermes_home_path = normalize_custom_hermes_home(profile.custom_hermes_home_path);

    if profile.label.is_empty() {
        return Err(HermesError::Validation("Name is required.".to_string()));
    }
    validate_ssh_argument(optional_non_empty(&profile.ssh_alias), "SSH alias")?;
    validate_ssh_argument(optional_non_empty(&profile.ssh_host), "Host")?;
    validate_ssh_argument(optional_non_empty(&profile.ssh_user), "SSH user")?;

    if effective_target(&profile).is_empty() {
        return Err(HermesError::Validation(
            "Add an SSH alias or host.".to_string(),
        ));
    }
    if profile.hermes_profile.is_some() && profile.custom_hermes_home_path.is_some() {
        return Err(HermesError::Validation(
            "Choose either a Hermes profile or a custom Hermes home path.".to_string(),
        ));
    }
    if let Some(ref hermes_profile) = profile.hermes_profile {
        if hermes_profile.contains('/') || hermes_profile == "." || hermes_profile == ".." {
            return Err(HermesError::Validation(
                "Hermes profile must be a profile name, not a path.".to_string(),
            ));
        }
        if contains_control_character(hermes_profile) {
            return Err(HermesError::Validation(
                "Hermes profile contains unsupported control characters.".to_string(),
            ));
        }
    }
    if let Some(ref custom_home) = profile.custom_hermes_home_path {
        if contains_control_character(custom_home) {
            return Err(HermesError::Validation(
                "Custom Hermes home contains unsupported control characters.".to_string(),
            ));
        }
        if !(custom_home == "~" || custom_home.starts_with("~/") || custom_home.starts_with('/')) {
            return Err(HermesError::Validation(
                "Custom Hermes home must start with `~/` or `/`.".to_string(),
            ));
        }
    }

    if profile.ssh_port == Some(0) {
        profile.ssh_port = None;
    }
    profile.updated_at = Utc::now();
    Ok(profile)
}

pub fn effective_target(profile: &ConnectionProfile) -> String {
    if !profile.ssh_alias.trim().is_empty() {
        return profile.ssh_alias.trim().to_string();
    }
    profile.ssh_host.trim().to_string()
}

pub fn resolved_hermes_profile_name(profile: &ConnectionProfile) -> String {
    if let Some(custom_home) = profile.custom_hermes_home_path.as_deref() {
        return custom_home
            .trim_end_matches('/')
            .rsplit('/')
            .next()
            .filter(|value| !value.is_empty())
            .unwrap_or(custom_home)
            .to_string();
    }
    profile
        .hermes_profile
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("default")
        .to_string()
}

pub fn remote_hermes_home_path(profile: &ConnectionProfile) -> String {
    if let Some(custom_home) = profile.custom_hermes_home_path.as_deref() {
        return custom_home.to_string();
    }
    if let Some(hermes_profile) = profile.hermes_profile.as_deref() {
        return format!("~/.hermes/profiles/{hermes_profile}");
    }
    "~/.hermes".to_string()
}

pub fn workspace_scope_fingerprint(profile: &ConnectionProfile) -> String {
    [
        effective_target(profile),
        profile.ssh_user.trim().to_string(),
        profile
            .ssh_port
            .map(|port| port.to_string())
            .unwrap_or_default(),
        remote_hermes_home_path(profile),
    ]
    .join("|")
}

pub fn remote_hermes_home_shell_expression(profile: &ConnectionProfile) -> String {
    if let Some(custom_home) = profile.custom_hermes_home_path.as_deref() {
        if custom_home == "~" {
            return "$HOME".to_string();
        }
        if let Some(suffix) = custom_home.strip_prefix("~/") {
            return format!("$HOME/{}", escape_for_double_quoted_shell(suffix));
        }
        return escape_for_double_quoted_shell(custom_home);
    }
    if let Some(hermes_profile) = profile.hermes_profile.as_deref() {
        return format!(
            "$HOME/.hermes/profiles/{}",
            escape_for_double_quoted_shell(hermes_profile)
        );
    }
    "$HOME/.hermes".to_string()
}

pub fn remote_hermes_search_path_shell_expression(profile: &ConnectionProfile) -> String {
    let hermes_home = remote_hermes_home_shell_expression(profile);
    let entries = [
        format!("{hermes_home}/hermes-agent/venv/bin"),
        "$HOME/.local/bin".to_string(),
        "$HOME/.hermes/hermes-agent/venv/bin".to_string(),
        "$HOME/.cargo/bin".to_string(),
        "/opt/homebrew/bin".to_string(),
        "/usr/local/bin".to_string(),
        "$PATH".to_string(),
    ];

    let mut ordered = Vec::new();
    for entry in entries {
        if !ordered.contains(&entry) {
            ordered.push(entry);
        }
    }
    ordered.join(":")
}

pub fn remote_service_command(profile: &ConnectionProfile, command_line: &str) -> String {
    let export_command = format!(
        "export HERMES_HOME=\"{}\"",
        remote_hermes_home_shell_expression(profile)
    );
    let path_command = format!(
        "export PATH=\"{}\"",
        remote_hermes_search_path_shell_expression(profile)
    );
    let escaped_command = escape_for_double_quoted_shell(command_line);
    let inner_command =
        format!("{export_command}; {path_command}; exec /bin/sh -c \"{escaped_command}\"");
    format!(
        "exec /bin/sh -c \"{}\"",
        escape_for_outer_double_quoted_shell(&inner_command)
    )
}

pub fn remote_shell_bootstrap_command(
    profile: &ConnectionProfile,
    startup_command_line: Option<&str>,
) -> String {
    let export_command = format!(
        "export HERMES_HOME=\"{}\"",
        remote_hermes_home_shell_expression(profile)
    );
    let path_command = format!(
        "export PATH=\"{}\"",
        remote_hermes_search_path_shell_expression(profile)
    );
    let shell = r#""${SHELL:-/bin/sh}""#;

    let inner_command = if let Some(command_line) = startup_command_line
        .map(str::trim)
        .filter(|command_line| !command_line.is_empty())
    {
        let startup_sequence = format!(
            "{command_line}; hermes_bootstrap_exit_code=$?; if [ \"$hermes_bootstrap_exit_code\" -ne 0 ]; then printf '\\n[Hermes Desktop] Startup command exited with status %s.\\n' \"$hermes_bootstrap_exit_code\"; fi; exec {shell} -l"
        );
        let escaped_startup = escape_for_double_quoted_shell(&startup_sequence);
        format!("{export_command}; {path_command}; exec {shell} -lc \"{escaped_startup}\"")
    } else {
        format!("{export_command}; {path_command}; exec {shell} -l")
    };

    format!(
        "exec /bin/sh -c \"{}\"",
        escape_for_outer_double_quoted_shell(&inner_command)
    )
}

fn normalize_optional(value: Option<String>) -> Option<String> {
    value
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
        .filter(|item| item.to_lowercase() != "default")
}

pub fn remote_hermes_command_line(_profile: &ConnectionProfile, arguments: &[String]) -> String {
    let prefix = r#"if [ -x "$HERMES_HOME/hermes-agent/venv/bin/hermes" ]; then HERMES_BIN="$HERMES_HOME/hermes-agent/venv/bin/hermes"; elif [ -x "$HOME/.local/bin/hermes" ]; then HERMES_BIN="$HOME/.local/bin/hermes"; elif [ -x "$HOME/.hermes/hermes-agent/venv/bin/hermes" ]; then HERMES_BIN="$HOME/.hermes/hermes-agent/venv/bin/hermes"; elif command -v hermes >/dev/null 2>&1; then HERMES_BIN="$(command -v hermes)"; else printf 'Hermes CLI not found.\n' >&2; exit 127; fi; "$HERMES_BIN""#;
    if arguments.is_empty() {
        return prefix.to_string();
    }
    format!(
        "{prefix} {}",
        arguments
            .iter()
            .map(|argument| shell_quote(argument))
            .collect::<Vec<_>>()
            .join(" ")
    )
}

pub fn shell_quote(value: &str) -> String {
    if value.is_empty() {
        return "''".to_string();
    }
    if value
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || "-_./:=@".contains(character))
    {
        return value.to_string();
    }
    format!("'{}'", value.replace('\'', "'\\''"))
}

fn normalize_custom_hermes_home(value: Option<String>) -> Option<String> {
    normalize_optional(value).map(|mut item| {
        if item == "~/" {
            return "~".to_string();
        }
        while item.len() > 1 && item.ends_with('/') {
            item.pop();
        }
        item
    })
}

fn optional_non_empty(value: &str) -> Option<&str> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}

fn validate_ssh_argument(value: Option<&str>, field_name: &str) -> Result<()> {
    let Some(value) = value else {
        return Ok(());
    };
    if value.starts_with('-') {
        return Err(HermesError::Validation(format!(
            "{field_name} cannot start with a dash."
        )));
    }
    if value
        .chars()
        .any(|character| character.is_whitespace() || character.is_control())
    {
        return Err(HermesError::Validation(format!(
            "{field_name} cannot contain whitespace or control characters."
        )));
    }
    Ok(())
}

fn contains_control_character(value: &str) -> bool {
    value.chars().any(char::is_control)
}

pub fn escape_for_double_quoted_shell(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('$', "\\$")
        .replace('`', "\\`")
}

fn escape_for_outer_double_quoted_shell(value: &str) -> String {
    escape_for_double_quoted_shell(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::ConnectionProfile;

    #[test]
    fn normalize_profile_trims_and_uses_alias_as_target() {
        let mut profile = ConnectionProfile::default();
        profile.label = "  Home  ".to_string();
        profile.ssh_alias = "  hermes-home  ".to_string();
        profile.ssh_host = "ignored.example.com".to_string();
        profile.ssh_port = Some(0);
        profile.ssh_user = "  alice  ".to_string();
        profile.hermes_profile = Some(" default ".to_string());

        let normalized = normalize_profile(profile).expect("profile should normalize");

        assert_eq!(normalized.label, "Home");
        assert_eq!(normalized.ssh_alias, "hermes-home");
        assert_eq!(normalized.ssh_user, "alice");
        assert_eq!(normalized.ssh_port, None);
        assert_eq!(normalized.hermes_profile, None);
        assert_eq!(effective_target(&normalized), "hermes-home");
        assert_eq!(resolved_hermes_profile_name(&normalized), "default");
        assert_eq!(remote_hermes_home_path(&normalized), "~/.hermes");
    }

    #[test]
    fn named_profile_changes_workspace_scope_without_changing_target() {
        let mut base = ConnectionProfile::default();
        base.label = "Research Host".to_string();
        base.ssh_alias = "hermes-home".to_string();
        base.ssh_user = "alice".to_string();
        base.ssh_port = Some(2222);
        let base = normalize_profile(base).expect("base profile should normalize");

        let mut scoped = base.clone();
        scoped.hermes_profile = Some("researcher".to_string());
        let scoped = normalize_profile(scoped).expect("scoped profile should normalize");

        assert_eq!(effective_target(&base), effective_target(&scoped));
        assert_ne!(
            workspace_scope_fingerprint(&base),
            workspace_scope_fingerprint(&scoped)
        );
        assert_eq!(resolved_hermes_profile_name(&scoped), "researcher");
        assert_eq!(
            remote_hermes_home_path(&scoped),
            "~/.hermes/profiles/researcher"
        );
    }

    #[test]
    fn custom_hermes_home_is_trimmed_and_overrides_profile_home() {
        let mut profile = ConnectionProfile::default();
        profile.label = "Container".to_string();
        profile.ssh_host = "example.com".to_string();
        profile.custom_hermes_home_path = Some("  ~/.hermes-work/  ".to_string());

        let normalized = normalize_profile(profile).expect("profile should normalize");

        assert_eq!(
            normalized.custom_hermes_home_path.as_deref(),
            Some("~/.hermes-work")
        );
        assert_eq!(resolved_hermes_profile_name(&normalized), ".hermes-work");
        assert_eq!(remote_hermes_home_path(&normalized), "~/.hermes-work");
        assert!(remote_shell_bootstrap_command(&normalized, None).contains("$HOME/.hermes-work"));
    }

    #[test]
    fn rejects_unsafe_ssh_arguments_and_profile_paths() {
        let mut dashed_host = ConnectionProfile::default();
        dashed_host.label = "Unsafe".to_string();
        dashed_host.ssh_host = "-oProxyCommand=sh".to_string();

        let mut spaced_user = ConnectionProfile::default();
        spaced_user.label = "Unsafe".to_string();
        spaced_user.ssh_host = "example.com".to_string();
        spaced_user.ssh_user = "alice bob".to_string();

        let mut profile_path = ConnectionProfile::default();
        profile_path.label = "Unsafe".to_string();
        profile_path.ssh_host = "example.com".to_string();
        profile_path.hermes_profile = Some("../prod".to_string());

        assert!(normalize_profile(dashed_host)
            .unwrap_err()
            .to_string()
            .contains("Host cannot start with a dash"));
        assert!(normalize_profile(spaced_user)
            .unwrap_err()
            .to_string()
            .contains("SSH user cannot contain whitespace"));
        assert!(normalize_profile(profile_path)
            .unwrap_err()
            .to_string()
            .contains("Hermes profile must be a profile name"));
    }

    #[test]
    fn shell_quote_preserves_safe_arguments_and_quotes_single_quotes() {
        assert_eq!(shell_quote("hermes"), "hermes");
        assert_eq!(shell_quote("telegram:-100123"), "telegram:-100123");
        assert_eq!(shell_quote("hello world"), "'hello world'");
        assert_eq!(shell_quote("can't"), "'can'\\''t'");
    }

    #[test]
    fn remote_service_command_escapes_shell_expansion_in_profile_name() {
        let mut profile = ConnectionProfile::default();
        profile.label = "Quoted".to_string();
        profile.ssh_host = "example.com".to_string();
        profile.hermes_profile = Some("research$HOME`whoami`".to_string());
        let normalized = normalize_profile(profile).expect("profile should normalize");

        let command = remote_service_command(&normalized, r#"printf "$HERMES_HOME""#);

        assert!(command.contains(r#"research\\\$HOME\\\`whoami\\\`"#));
        assert!(command.contains("printf"));
        assert!(command.contains("HERMES_HOME"));
        assert!(!command.contains(r#"printf "$HERMES_HOME""#));
    }
}
