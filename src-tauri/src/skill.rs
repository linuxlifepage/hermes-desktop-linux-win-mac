use crate::connection::remote_hermes_home_path;
use crate::error::{HermesError, Result};
use crate::models::{
    ConnectionProfile, SkillDetail, SkillDetailResponse, SkillListResponse, SkillLocator,
    SkillSummary,
};
use crate::remote_python;
use crate::ssh;
use serde::Serialize;
use std::collections::HashSet;

pub async fn list_skills_inner(profile: ConnectionProfile) -> Result<Vec<SkillSummary>> {
    let payload = EmptySkillRequest {
        hermes_home: remote_hermes_home_path(&profile),
    };
    let body = skill_body(SKILL_LIST_BODY);
    let script = remote_python::wrap_payload(&payload, &body)?;
    let response = ssh::execute_json::<SkillListResponse>(profile.clone(), script).await?;
    let launchable_records = load_launchable_skill_records(profile).await?;
    let allowed = launchable_records
        .into_iter()
        .map(|record| record.launch_identifier())
        .collect::<HashSet<_>>();

    let mut items = response
        .items
        .into_iter()
        .filter(|skill| allowed.contains(&skill.relative_path))
        .collect::<Vec<_>>();
    items.sort_by(|left, right| {
        left.slug
            .to_lowercase()
            .cmp(&right.slug.to_lowercase())
            .then_with(|| {
                left.relative_path
                    .to_lowercase()
                    .cmp(&right.relative_path.to_lowercase())
            })
    });
    Ok(items)
}

pub async fn load_skill_detail_inner(
    profile: ConnectionProfile,
    locator: SkillLocator,
) -> Result<SkillDetail> {
    let payload = SkillDetailRequest {
        source_id: locator.source_id,
        relative_path: locator.relative_path,
        hermes_home: remote_hermes_home_path(&profile),
    };
    let body = skill_body(SKILL_DETAIL_BODY);
    let script = remote_python::wrap_payload(&payload, &body)?;
    let response = ssh::execute_json::<SkillDetailResponse>(profile, script).await?;
    Ok(response.item)
}

pub async fn create_skill_inner(
    profile: ConnectionProfile,
    relative_path: String,
    markdown_content: String,
    create_references_folder: bool,
    create_scripts_folder: bool,
    create_templates_folder: bool,
) -> Result<SkillDetail> {
    let payload = SkillWriteRequest {
        source_id: None,
        relative_path,
        markdown_content,
        expected_content_hash: None,
        create_references_folder,
        create_scripts_folder,
        create_templates_folder,
        hermes_home: remote_hermes_home_path(&profile),
    };
    let body = skill_body(SKILL_WRITE_BODY);
    let script = remote_python::wrap_payload(&payload, &body)?;
    let response = ssh::execute_json::<SkillDetailResponse>(profile, script).await?;
    Ok(response.item)
}

pub async fn update_skill_inner(
    profile: ConnectionProfile,
    locator: SkillLocator,
    markdown_content: String,
    expected_content_hash: String,
    ensure_references_folder: bool,
    ensure_scripts_folder: bool,
    ensure_templates_folder: bool,
) -> Result<SkillDetail> {
    let payload = SkillWriteRequest {
        source_id: Some(locator.source_id),
        relative_path: locator.relative_path,
        markdown_content,
        expected_content_hash: Some(expected_content_hash),
        create_references_folder: ensure_references_folder,
        create_scripts_folder: ensure_scripts_folder,
        create_templates_folder: ensure_templates_folder,
        hermes_home: remote_hermes_home_path(&profile),
    };
    let body = skill_body(SKILL_WRITE_BODY);
    let script = remote_python::wrap_payload(&payload, &body)?;
    let response = ssh::execute_json::<SkillDetailResponse>(profile, script).await?;
    Ok(response.item)
}

async fn load_launchable_skill_records(
    profile: ConnectionProfile,
) -> Result<Vec<LaunchableSkillRecord>> {
    let command = r#"if command -v hermes >/dev/null 2>&1; then HERMES_BIN="$(command -v hermes)"; else printf 'Hermes CLI not found.\n' >&2; exit 127; fi; COLUMNS=240 "$HERMES_BIN" skills list --enabled-only"#;
    let result = ssh::execute(profile, command.to_string(), None).await?;
    if result.exit_code != 0 {
        let raw = [result.stderr.trim(), result.stdout.trim()]
            .into_iter()
            .find(|item| !item.is_empty())
            .unwrap_or("Unable to load launchable skill inventory.");
        return Err(HermesError::Remote(raw.to_string()));
    }
    Ok(parse_launchable_skill_records(&result.stdout))
}

fn parse_launchable_skill_records(output: &str) -> Vec<LaunchableSkillRecord> {
    output.lines().filter_map(parse_launchable_record).collect()
}

fn parse_launchable_record(raw_line: &str) -> Option<LaunchableSkillRecord> {
    let line = raw_line.trim();
    let separator = '\u{2502}';
    if !line.starts_with(separator) || !line.ends_with(separator) {
        return None;
    }
    let columns = line
        .split(separator)
        .skip(1)
        .take(5)
        .map(str::trim)
        .collect::<Vec<_>>();

    if columns.len() != 5
        || columns[0] == "Name"
        || columns[4] != "enabled"
        || columns[0].is_empty()
    {
        return None;
    }

    Some(LaunchableSkillRecord {
        name: columns[0].to_string(),
        category: (!columns[1].is_empty()).then(|| columns[1].to_string()),
    })
}

struct LaunchableSkillRecord {
    name: String,
    category: Option<String>,
}

impl LaunchableSkillRecord {
    fn launch_identifier(self) -> String {
        match self.category {
            Some(category) if !category.trim().is_empty() => format!("{category}/{}", self.name),
            _ => self.name,
        }
    }
}

fn skill_body(body: &str) -> String {
    format!("{SHARED_SKILL_HELPERS}\n{body}")
}

#[derive(Serialize)]
struct EmptySkillRequest {
    hermes_home: String,
}

#[derive(Serialize)]
struct SkillDetailRequest {
    source_id: String,
    relative_path: String,
    hermes_home: String,
}

#[derive(Serialize)]
struct SkillWriteRequest {
    source_id: Option<String>,
    relative_path: String,
    markdown_content: String,
    expected_content_hash: Option<String>,
    create_references_folder: bool,
    create_scripts_folder: bool,
    create_templates_folder: bool,
    hermes_home: String,
}

const SKILL_LIST_BODY: &str = r#"
try:
    items = discover_skill_items()
    print(json.dumps({
        "ok": True,
        "items": items,
    }, ensure_ascii=False))
except Exception as exc:
    fail(f"Unable to read the remote Hermes skill library: {exc}")
"#;

const SKILL_DETAIL_BODY: &str = r#"
try:
    item = build_skill_detail(payload.get("source_id"), payload["relative_path"])
    print(json.dumps({
        "ok": True,
        "item": item,
    }, ensure_ascii=False))
except Exception as exc:
    fail(f"Unable to read the remote Hermes skill detail: {exc}")
"#;

const SKILL_WRITE_BODY: &str = r#"
import tempfile

def write_atomic_utf8(target, content):
    temp_name = None
    directory_fd = None
    content_bytes = content.encode("utf-8")

    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        fd, temp_name = tempfile.mkstemp(
            dir=str(target.parent),
            prefix=f".{target.name}.",
            suffix=".tmp",
        )

        with os.fdopen(fd, "wb") as handle:
            handle.write(content_bytes)
            handle.flush()
            os.fsync(handle.fileno())

        if target.exists():
            os.chmod(temp_name, target.stat().st_mode)

        os.replace(temp_name, target)
        directory_fd = os.open(target.parent, os.O_RDONLY)
        os.fsync(directory_fd)
    finally:
        if directory_fd is not None:
            os.close(directory_fd)
        if temp_name and os.path.exists(temp_name):
            os.unlink(temp_name)

    return hashlib.sha256(content_bytes).hexdigest()

try:
    relative_path = normalize_text(payload.get("relative_path"))
    if relative_path is None:
        fail("The skill path is required.")

    markdown_content = payload.get("markdown_content")
    if not isinstance(markdown_content, str) or not markdown_content.strip():
        fail("SKILL.md content is required.")

    root = local_skills_root()
    root.mkdir(parents=True, exist_ok=True)

    requested_source_id = normalize_text(payload.get("source_id"))
    if requested_source_id is not None:
        source = resolve_skill_source(requested_source_id)
        if source["is_read_only"]:
            fail("External skill directories are read-only in Hermes. Create a local skill with the same path to override it.")

    skill_file, _ = resolve_skill_file("local", relative_path)
    skill_dir = skill_file.parent
    expected_hash = normalize_text(payload.get("expected_content_hash"))

    if expected_hash is None:
        if skill_file.exists():
            fail(f"A skill already exists at {relative_path}.")
    else:
        if not skill_file.exists():
            fail(f"{relative_path} no longer exists. Reload the skill list and try again.")
        if not skill_file.is_file():
            fail(f"{relative_path} does not resolve to a writable SKILL.md file.")

        current_hash = hashlib.sha256(skill_file.read_bytes()).hexdigest()
        if current_hash != expected_hash:
            fail(f"{relative_path} changed on the active host after it was loaded. Reload the skill before saving.")

    if payload.get("create_references_folder"):
        (skill_dir / "references").mkdir(parents=True, exist_ok=True)
    if payload.get("create_scripts_folder"):
        (skill_dir / "scripts").mkdir(parents=True, exist_ok=True)
    if payload.get("create_templates_folder"):
        (skill_dir / "templates").mkdir(parents=True, exist_ok=True)

    write_atomic_utf8(skill_file, markdown_content)
    item = build_skill_detail("local", relative_path)

    print(json.dumps({
        "ok": True,
        "item": item,
    }, ensure_ascii=False))
except Exception as exc:
    fail(f"Unable to save the remote Hermes skill: {exc}")
"#;

const SHARED_SKILL_HELPERS: &str = r##"
import ast
import hashlib
import json
import os
import re

def local_skills_root():
    return resolved_hermes_home() / "skills"

def hermes_config_path():
    return resolved_hermes_home() / "config.yaml"

def normalize_text_list(value):
    if value is None:
        return []
    if isinstance(value, (list, tuple, set)):
        result = []
        for item in value:
            normalized = normalize_text(item)
            if normalized is not None:
                result.append(normalized)
        return result

    normalized = normalize_text(value)
    return [normalized] if normalized is not None else []

def compact_text(value):
    normalized = normalize_text(value)
    if normalized is None:
        return None
    return re.sub(r"\s+", " ", normalized)

def parse_scalar(value):
    stripped = str(value).strip()
    if not stripped or stripped in {"null", "Null", "NULL", "~"}:
        return None
    if (stripped.startswith("'") and stripped.endswith("'")) or (
        stripped.startswith('"') and stripped.endswith('"')
    ):
        try:
            return normalize_text(ast.literal_eval(stripped))
        except Exception:
            return normalize_text(stripped[1:-1])
    return normalize_text(stripped)

def parse_inline_list(value):
    stripped = str(value).strip()
    if not stripped.startswith("[") or not stripped.endswith("]"):
        return None
    try:
        parsed = ast.literal_eval(stripped)
        if isinstance(parsed, list):
            return normalize_text_list(parsed)
    except Exception:
        pass
    inner = stripped[1:-1].strip()
    if not inner:
        return []
    return [item.strip().strip("'\"") for item in inner.split(",") if item.strip()]

def extract_frontmatter(content):
    lines = content.splitlines()
    if not lines or lines[0].strip() != "---":
        return None
    for index in range(1, len(lines)):
        if lines[index].strip() == "---":
            return "\n".join(lines[1:index])
    return None

def fallback_frontmatter_dict(frontmatter_text):
    data = {}
    metadata = {}
    lines = frontmatter_text.splitlines()
    current_parent = None

    for raw_line in lines:
        if not raw_line.strip() or raw_line.lstrip().startswith("#"):
            continue
        indent = len(raw_line) - len(raw_line.lstrip(" "))
        stripped = raw_line.strip()
        if indent == 0 and ":" in stripped:
            key, raw_value = stripped.split(":", 1)
            current_parent = key.strip()
            value = raw_value.strip()
            if not value:
                continue
            inline_list = parse_inline_list(value)
            data[current_parent] = inline_list if inline_list is not None else parse_scalar(value)
        elif current_parent == "metadata" and indent > 0 and ":" in stripped:
            key, raw_value = stripped.split(":", 1)
            value = raw_value.strip()
            inline_list = parse_inline_list(value)
            metadata[key.strip()] = inline_list if inline_list is not None else parse_scalar(value)

    if metadata:
        data["metadata"] = metadata
    return data

def parse_frontmatter(content):
    frontmatter_text = extract_frontmatter(content)
    if frontmatter_text is None:
        return {
            "name": None,
            "description": None,
            "version": None,
            "platforms": [],
            "tags": [],
            "related_skills": [],
        }

    data = None
    try:
        import yaml
        loaded = yaml.safe_load(frontmatter_text)
        if isinstance(loaded, dict):
            data = loaded
    except Exception:
        data = None

    if not isinstance(data, dict):
        data = fallback_frontmatter_dict(frontmatter_text)

    metadata = data.get("metadata")
    if not isinstance(metadata, dict):
        metadata = {}

    hermes_metadata = metadata.get("hermes")
    if not isinstance(hermes_metadata, dict):
        hermes_metadata = {}

    tags = metadata.get("tags")
    if tags is None:
        tags = hermes_metadata.get("tags")

    related_skills = metadata.get("related_skills")
    if related_skills is None:
        related_skills = hermes_metadata.get("related_skills")

    platforms = data.get("platforms")
    if platforms is None:
        platforms = metadata.get("platforms")
    if platforms is None:
        platforms = hermes_metadata.get("platforms")

    return {
        "name": normalize_text(data.get("name")),
        "description": compact_text(data.get("description")),
        "version": normalize_text(data.get("version")),
        "platforms": normalize_text_list(platforms),
        "tags": normalize_text_list(tags),
        "related_skills": normalize_text_list(related_skills),
    }

def fallback_external_dirs(config_text):
    lines = config_text.splitlines()
    external_dirs = []
    in_skills = False
    in_external_dirs = False

    for raw_line in lines:
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        indent = len(raw_line) - len(raw_line.lstrip(" "))
        if indent == 0:
            in_skills = stripped.startswith("skills:")
            in_external_dirs = False
            continue
        if not in_skills:
            continue
        if stripped.startswith("external_dirs:"):
            value = stripped.split(":", 1)[1].strip()
            inline = parse_inline_list(value)
            if inline is not None:
                external_dirs.extend(inline)
            elif value:
                external_dirs.extend(normalize_text_list(value))
            in_external_dirs = True
            continue
        if in_external_dirs and stripped.startswith("- "):
            value = parse_scalar(stripped[2:])
            if value:
                external_dirs.append(value)

    return external_dirs

def configured_external_dirs():
    config_path = hermes_config_path()
    if not config_path.is_file():
        return []
    try:
        config_text = config_path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return []
    try:
        import yaml
        loaded = yaml.safe_load(config_text)
        if isinstance(loaded, dict):
            skills_config = loaded.get("skills")
            if isinstance(skills_config, dict):
                return normalize_text_list(skills_config.get("external_dirs"))
    except Exception:
        pass
    return fallback_external_dirs(config_text)

def resolve_skill_sources():
    home = pathlib.Path.home()
    config_dir = hermes_config_path().parent
    raw_sources = [("local", local_skills_root())]
    for directory in configured_external_dirs():
        candidate = expand_remote_path(directory, home=home, base_dir=config_dir)
        if candidate is not None:
            raw_sources.append(("external", candidate))

    sources = []
    seen_roots = set()
    external_index = 0

    for kind, candidate in raw_sources:
        try:
            resolved_root = candidate.resolve()
        except Exception:
            continue
        if str(resolved_root) in seen_roots:
            continue
        seen_roots.add(str(resolved_root))

        if kind == "local":
            source_id = "local"
            is_read_only = False
        else:
            external_index += 1
            source_id = f"external:{external_index}"
            is_read_only = True

        sources.append({
            "id": source_id,
            "kind": kind,
            "root": resolved_root,
            "root_path": tilde(resolved_root, home),
            "is_read_only": is_read_only,
        })

    return sources

def resolve_skill_source(source_id):
    normalized = normalize_text(source_id) or "local"
    for source in resolve_skill_sources():
        if source["id"] == normalized:
            return source
    fail("The requested skill source is no longer available. Reload the skill list and try again.")

def skill_relative_path(skill_file, root):
    return skill_file.parent.relative_to(root).as_posix()

def skill_category(relative_path):
    if "/" not in relative_path:
        return None
    return relative_path.rsplit("/", 1)[0]

def feature_flags(skill_dir):
    return {
        "has_references": (skill_dir / "references").is_dir(),
        "has_scripts": (skill_dir / "scripts").is_dir(),
        "has_templates": (skill_dir / "templates").is_dir(),
    }

def build_skill_summary(skill_file, source):
    content = skill_file.read_text(encoding="utf-8", errors="replace")
    relative_path = skill_relative_path(skill_file, source["root"])
    category = skill_category(relative_path)
    parsed = parse_frontmatter(content)
    slug = skill_file.parent.name
    flags = feature_flags(skill_file.parent)

    return {
        "id": relative_path,
        "locator": {
            "source_id": source["id"],
            "relative_path": relative_path,
        },
        "source": {
            "id": source["id"],
            "kind": source["kind"],
            "root_path": source["root_path"],
            "is_read_only": source["is_read_only"],
        },
        "slug": slug,
        "category": category,
        "relative_path": relative_path,
        "name": parsed["name"],
        "description": parsed["description"],
        "version": parsed["version"],
        "platforms": parsed["platforms"],
        "tags": parsed["tags"],
        "related_skills": parsed["related_skills"],
        "has_references": flags["has_references"],
        "has_scripts": flags["has_scripts"],
        "has_templates": flags["has_templates"],
    }

def skill_sort_key(item):
    return (
        (item.get("category") or "").casefold(),
        (item.get("name") or item.get("slug") or "").casefold(),
        item.get("relative_path", "").casefold(),
    )

def discover_skill_items():
    items = []
    seen_relative_paths = set()
    for source in resolve_skill_sources():
        root = source["root"]
        if not root.exists() or not root.is_dir():
            continue
        for skill_file in sorted(root.rglob("SKILL.md")):
            if not skill_file.is_file():
                continue
            try:
                item = build_skill_summary(skill_file, source)
            except Exception:
                continue
            relative_path = item["relative_path"]
            if relative_path in seen_relative_paths:
                continue
            seen_relative_paths.add(relative_path)
            items.append(item)
    items.sort(key=skill_sort_key)
    return items

def resolve_skill_file(source_id, relative_path):
    normalized = pathlib.PurePosixPath(relative_path)
    if normalized.is_absolute() or ".." in normalized.parts or not normalized.parts:
        fail("The requested skill path is invalid.")

    source = resolve_skill_source(source_id)
    root = source["root"]
    target = (root / pathlib.Path(*normalized.parts) / "SKILL.md").resolve()

    try:
        target.relative_to(root)
    except ValueError:
        fail("The requested skill path escapes the configured Hermes skill source.")

    return target, source

def build_skill_detail(source_id, relative_path):
    skill_file, source = resolve_skill_file(source_id, relative_path)
    if not skill_file.exists():
        fail(f"No skill exists at {relative_path}.")
    if not skill_file.is_file():
        fail(f"{relative_path} does not resolve to a readable SKILL.md file.")

    content = skill_file.read_text(encoding="utf-8", errors="replace")
    summary = build_skill_summary(skill_file, source)
    summary["markdown_content"] = content
    summary["content_hash"] = hashlib.sha256(skill_file.read_bytes()).hexdigest()
    return summary
"##;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::remote_python::assert_python_payload_compiles;

    #[test]
    fn skill_payloads_compile() {
        assert_python_payload_compiles(
            &EmptySkillRequest {
                hermes_home: "~/.hermes".to_string(),
            },
            &skill_body(SKILL_LIST_BODY),
        );
        assert_python_payload_compiles(
            &SkillDetailRequest {
                source_id: "local".to_string(),
                relative_path: "tauri-smoke/test".to_string(),
                hermes_home: "~/.hermes".to_string(),
            },
            &skill_body(SKILL_DETAIL_BODY),
        );
        assert_python_payload_compiles(
            &SkillWriteRequest {
                source_id: None,
                relative_path: "tauri-smoke/test".to_string(),
                markdown_content: "---\nname: Test\ndescription: Test.\n---\n\n# Test\n"
                    .to_string(),
                expected_content_hash: None,
                create_references_folder: true,
                create_scripts_folder: true,
                create_templates_folder: true,
                hermes_home: "~/.hermes".to_string(),
            },
            &skill_body(SKILL_WRITE_BODY),
        );
    }
}
