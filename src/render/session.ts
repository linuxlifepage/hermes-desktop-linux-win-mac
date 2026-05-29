import type { SessionMessage, SessionSummary } from "../types";

interface SessionTranscriptExportOptions {
  title: string;
  formatTimestamp: (value: SessionMessage["timestamp"] | SessionSummary["started_at"]) => string;
}

export function sessionTranscriptMarkdown(
  session: SessionSummary,
  messages: SessionMessage[],
  options: SessionTranscriptExportOptions,
) {
  const lines = [
    `# ${options.title}`,
    "",
    `- Session: ${session.id}`,
    session.model ? `- Model: ${session.model}` : "",
    options.formatTimestamp(session.started_at) ? `- Started: ${options.formatTimestamp(session.started_at)}` : "",
    options.formatTimestamp(session.last_active) ? `- Last active: ${options.formatTimestamp(session.last_active)}` : "",
    typeof session.message_count === "number" ? `- Messages: ${session.message_count}` : "",
    "",
  ].filter(Boolean);

  for (const message of messages) {
    const role = transcriptRoleTitle(message.role);
    const timestamp = options.formatTimestamp(message.timestamp);
    lines.push(`## ${role}${timestamp ? ` · ${timestamp}` : ""}`, "");
    lines.push(message.content?.trim() || "_Empty message_", "");
    if (message.metadata && Object.keys(message.metadata).length > 0) {
      lines.push("<details><summary>Metadata</summary>", "", "```json", JSON.stringify(message.metadata, null, 2), "```", "", "</details>", "");
    }
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export function sessionTranscriptText(
  session: SessionSummary,
  messages: SessionMessage[],
  options: SessionTranscriptExportOptions,
) {
  const lines = [
    options.title,
    `Session: ${session.id}`,
    session.model ? `Model: ${session.model}` : "",
    options.formatTimestamp(session.started_at) ? `Started: ${options.formatTimestamp(session.started_at)}` : "",
    options.formatTimestamp(session.last_active) ? `Last active: ${options.formatTimestamp(session.last_active)}` : "",
    "",
  ].filter(Boolean);

  for (const message of messages) {
    const role = transcriptRoleTitle(message.role);
    const timestamp = options.formatTimestamp(message.timestamp);
    lines.push(`[${role}${timestamp ? ` · ${timestamp}` : ""}]`);
    lines.push(message.content?.trim() || "");
    if (message.metadata && Object.keys(message.metadata).length > 0) {
      lines.push(`Metadata: ${JSON.stringify(message.metadata)}`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function transcriptRoleTitle(role: string | null) {
  const normalized = (role ?? "event").trim().toLowerCase();
  if (normalized === "assistant") {
    return "Agent";
  }
  if (normalized === "user") {
    return "User";
  }
  if (normalized === "system") {
    return "System";
  }
  if (["function", "function_call", "function_result", "tool", "tool_call", "tool_result"].includes(normalized)) {
    return "Tool";
  }
  return normalized ? normalized.replaceAll("_", " ") : "Event";
}
