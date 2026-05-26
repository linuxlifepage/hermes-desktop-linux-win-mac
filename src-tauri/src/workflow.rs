use crate::connection::{remote_hermes_command_line, shell_quote, workspace_scope_fingerprint};
use crate::error::{HermesError, Result};
use crate::models::{
    ConnectionProfile, WorkflowDraftPayload, WorkflowLaunchPreview, WorkflowPreset,
    WorkflowSkillReference,
};
use crate::storage::{load_preferences, save_preferences, AppStorage};
use chrono::Utc;
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

pub fn list_workflows_inner(
    storage: &AppStorage,
    profile: ConnectionProfile,
) -> Result<Vec<WorkflowPreset>> {
    let scope = workspace_scope_fingerprint(&profile);
    let mut workflows = load_preferences(storage)?
        .workflows
        .into_iter()
        .filter(|workflow| workflow.workspace_scope_fingerprint == scope)
        .collect::<Vec<_>>();
    workflows.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
    Ok(workflows)
}

pub fn create_workflow_inner(
    storage: &AppStorage,
    profile: ConnectionProfile,
    draft: WorkflowDraftPayload,
) -> Result<WorkflowPreset> {
    validate_draft(&draft)?;
    let now = Utc::now();
    let workflow = WorkflowPreset {
        id: Uuid::new_v4(),
        workspace_scope_fingerprint: workspace_scope_fingerprint(&profile),
        name: draft.name.trim().to_string(),
        prompt: draft.prompt.trim().to_string(),
        assigned_skills: normalized_skill_references(draft.assigned_skills),
        created_at: now,
        updated_at: now,
    };

    let mut preferences = load_preferences(storage)?;
    preferences.workflows.push(workflow.clone());
    save_preferences(storage, &preferences)?;
    Ok(workflow)
}

pub fn update_workflow_inner(
    storage: &AppStorage,
    profile: ConnectionProfile,
    workflow_id: String,
    draft: WorkflowDraftPayload,
) -> Result<WorkflowPreset> {
    validate_draft(&draft)?;
    let parsed_id = parse_workflow_id(&workflow_id)?;
    let scope = workspace_scope_fingerprint(&profile);
    let mut preferences = load_preferences(storage)?;
    let workflow = preferences
        .workflows
        .iter_mut()
        .find(|workflow| workflow.id == parsed_id && workflow.workspace_scope_fingerprint == scope)
        .ok_or_else(|| HermesError::Validation("The workflow does not exist.".to_string()))?;

    workflow.name = draft.name.trim().to_string();
    workflow.prompt = draft.prompt.trim().to_string();
    workflow.assigned_skills = normalized_skill_references(draft.assigned_skills);
    workflow.updated_at = Utc::now();
    let updated = workflow.clone();
    save_preferences(storage, &preferences)?;
    Ok(updated)
}

pub fn delete_workflow_inner(
    storage: &AppStorage,
    profile: ConnectionProfile,
    workflow_id: String,
) -> Result<Vec<WorkflowPreset>> {
    let parsed_id = parse_workflow_id(&workflow_id)?;
    let scope = workspace_scope_fingerprint(&profile);
    let mut preferences = load_preferences(storage)?;
    preferences.workflows.retain(|workflow| {
        !(workflow.id == parsed_id && workflow.workspace_scope_fingerprint == scope)
    });
    save_preferences(storage, &preferences)?;
    list_workflows_inner(storage, profile)
}

pub fn workflow_launch_preview_inner(
    storage: &AppStorage,
    profile: ConnectionProfile,
    workflow_id: String,
) -> Result<WorkflowLaunchPreview> {
    let parsed_id = parse_workflow_id(&workflow_id)?;
    let scope = workspace_scope_fingerprint(&profile);
    let workflow = load_preferences(storage)?
        .workflows
        .into_iter()
        .find(|workflow| workflow.id == parsed_id && workflow.workspace_scope_fingerprint == scope)
        .ok_or_else(|| HermesError::Validation("The workflow does not exist.".to_string()))?;

    let arguments = workflow_arguments(&profile, &workflow);
    let command_line = hermes_cli_preview_command(&arguments);
    let startup_command_line = remote_hermes_command_line(&profile, &arguments);
    let chat_arguments = workflow_chat_arguments(&profile);
    let chat_command_line = hermes_cli_preview_command(&chat_arguments);
    let chat_startup_command_line = remote_hermes_command_line(&profile, &chat_arguments);
    Ok(WorkflowLaunchPreview {
        command_line,
        startup_command_line,
        initial_input: normalize_prompt_for_launch(&workflow.prompt),
        arguments,
        chat_command_line,
        chat_startup_command_line,
        chat_initial_input: workflow_chat_initial_input(&workflow),
        chat_arguments,
    })
}

fn validate_draft(draft: &WorkflowDraftPayload) -> Result<()> {
    if draft.name.trim().is_empty() {
        return Err(HermesError::Validation(
            "Workflow name is required.".to_string(),
        ));
    }
    if draft.prompt.trim().is_empty() {
        return Err(HermesError::Validation(
            "Workflow prompt is required.".to_string(),
        ));
    }
    Ok(())
}

fn parse_workflow_id(id: &str) -> Result<Uuid> {
    Uuid::parse_str(id)
        .map_err(|_| HermesError::Validation("The workflow id is not a valid UUID.".to_string()))
}

fn normalized_skill_references(
    references: Vec<WorkflowSkillReference>,
) -> Vec<WorkflowSkillReference> {
    let mut latest_by_path = HashMap::<String, WorkflowSkillReference>::new();
    for mut reference in references {
        reference.relative_path = reference.relative_path.trim().to_string();
        reference.slug = reference.slug.trim().to_string();
        reference.name = reference
            .name
            .map(|name| name.trim().to_string())
            .filter(|name| !name.is_empty());
        if reference.relative_path.is_empty() {
            continue;
        }
        if reference.slug.is_empty() {
            reference.slug = reference
                .relative_path
                .rsplit('/')
                .next()
                .unwrap_or(&reference.relative_path)
                .to_string();
        }
        latest_by_path.insert(reference.relative_path.clone(), reference);
    }

    let mut result = latest_by_path.into_values().collect::<Vec<_>>();
    result.sort_by(|left, right| {
        left.slug
            .to_lowercase()
            .cmp(&right.slug.to_lowercase())
            .then_with(|| {
                left.relative_path
                    .to_lowercase()
                    .cmp(&right.relative_path.to_lowercase())
            })
    });
    result
}

fn workflow_arguments(profile: &ConnectionProfile, workflow: &WorkflowPreset) -> Vec<String> {
    let mut values = Vec::new();
    if profile.custom_hermes_home_path.is_none() {
        if let Some(profile_name) = profile.hermes_profile.as_ref() {
            if !profile_name.trim().is_empty() {
                values.extend(["--profile".to_string(), profile_name.trim().to_string()]);
            }
        }
    }

    let mut seen = HashSet::new();
    for skill in &workflow.assigned_skills {
        let relative_path = skill.relative_path.trim();
        if relative_path.is_empty() || !seen.insert(relative_path.to_string()) {
            continue;
        }
        values.extend(["--skills".to_string(), relative_path.to_string()]);
    }
    values.push("chat".to_string());
    values
}

fn workflow_chat_arguments(profile: &ConnectionProfile) -> Vec<String> {
    let mut values = Vec::new();
    if profile.custom_hermes_home_path.is_none() {
        if let Some(profile_name) = profile.hermes_profile.as_ref() {
            if !profile_name.trim().is_empty() {
                values.extend(["--profile".to_string(), profile_name.trim().to_string()]);
            }
        }
    }
    values.push("--tui".to_string());
    values
}

fn hermes_cli_preview_command(arguments: &[String]) -> String {
    if arguments.is_empty() {
        return "hermes".to_string();
    }
    format!(
        "hermes {}",
        arguments
            .iter()
            .map(|argument| shell_quote(argument))
            .collect::<Vec<_>>()
            .join(" ")
    )
}

fn workflow_chat_initial_input(workflow: &WorkflowPreset) -> String {
    let mut lines = workflow
        .assigned_skills
        .iter()
        .map(|skill| skill.slug.trim())
        .filter(|slug| !slug.is_empty())
        .map(|slug| format!("/{slug}"))
        .collect::<Vec<_>>();
    let prompt = normalize_prompt_for_launch(&workflow.prompt);
    if !prompt.is_empty() {
        lines.push(prompt);
    }
    lines.join("\n")
}

fn normalize_prompt_for_launch(prompt: &str) -> String {
    prompt
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn workflow_fixture() -> WorkflowPreset {
        WorkflowPreset {
            id: Uuid::new_v4(),
            workspace_scope_fingerprint: "scope".to_string(),
            name: "Release audit".to_string(),
            prompt: "  Check release notes.\n\nSummarize risk.  ".to_string(),
            assigned_skills: vec![
                WorkflowSkillReference {
                    relative_path: "ops/release".to_string(),
                    slug: "release".to_string(),
                    name: Some("Release".to_string()),
                },
                WorkflowSkillReference {
                    relative_path: "ops/security".to_string(),
                    slug: "security".to_string(),
                    name: Some("Security".to_string()),
                },
            ],
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    #[test]
    fn workflow_chat_launch_uses_tui_and_slash_skill_prelude() {
        let profile = ConnectionProfile {
            hermes_profile: Some("staging".to_string()),
            ..ConnectionProfile::default()
        };
        let workflow = workflow_fixture();

        assert_eq!(
            workflow_chat_arguments(&profile),
            vec![
                "--profile".to_string(),
                "staging".to_string(),
                "--tui".to_string()
            ]
        );
        assert_eq!(
            workflow_chat_initial_input(&workflow),
            "/release\n/security\nCheck release notes. Summarize risk."
        );
    }

    #[test]
    fn workflow_launch_omits_profile_when_custom_home_is_used() {
        let profile = ConnectionProfile {
            hermes_profile: Some("staging".to_string()),
            custom_hermes_home_path: Some("~/.hermes".to_string()),
            ..ConnectionProfile::default()
        };
        let workflow = workflow_fixture();

        assert_eq!(
            workflow_arguments(&profile, &workflow),
            vec![
                "--skills".to_string(),
                "ops/release".to_string(),
                "--skills".to_string(),
                "ops/security".to_string(),
                "chat".to_string()
            ]
        );
        assert_eq!(workflow_chat_arguments(&profile), vec!["--tui".to_string()]);
    }
}
