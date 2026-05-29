import type { AppSnapshot } from "../types";

export interface HermesBackupPayload {
  kind: "hermes-desktop-backup";
  version: string;
  exportedAt: string;
  snapshot: AppSnapshot;
  uiState: unknown;
}

export interface ProfilesExportPayload {
  kind: "hermes-desktop-profiles";
  exportedAt: string;
  connections: AppSnapshot["connections"];
  workflows: AppSnapshot["preferences"]["workflows"];
}

export function createHermesBackupPayload(version: string, snapshot: AppSnapshot, uiState: unknown): HermesBackupPayload {
  return {
    kind: "hermes-desktop-backup",
    version,
    exportedAt: new Date().toISOString(),
    snapshot,
    uiState,
  };
}

export function createProfilesExportPayload(snapshot: AppSnapshot): ProfilesExportPayload {
  return {
    kind: "hermes-desktop-profiles",
    exportedAt: new Date().toISOString(),
    connections: snapshot.connections,
    workflows: snapshot.preferences.workflows,
  };
}

export function exportedJsonText(payload: unknown) {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function timestampedFilename(prefix: string, extension: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}-${stamp}.${extension}`;
}
