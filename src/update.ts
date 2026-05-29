export const hermesDesktopLatestReleaseUrl =
  "https://api.github.com/repos/linuxlifepage/hermes-desktop-linux-win-mac/releases/latest";

export interface AvailableUpdate {
  currentVersion: string;
  tagName: string;
  htmlUrl: string;
  name: string | null;
  body: string | null;
  assets: ReleaseAsset[];
  latestVersion: string;
  resolvedName: string;
  releaseNotesPreview: string | null;
}

export interface ReleaseAsset {
  name: string;
  browserDownloadUrl: string;
  size: number | null;
}

interface GitHubReleaseResponse {
  tag_name: string;
  html_url: string;
  name?: string | null;
  body?: string | null;
  assets?: Array<{
    name?: string | null;
    browser_download_url?: string | null;
    size?: number | null;
  }>;
}

export async function checkForHermesDesktopUpdate(currentVersion: string): Promise<AvailableUpdate | null> {
  const response = await fetch(hermesDesktopLatestReleaseUrl, {
    method: "GET",
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub returned HTTP ${response.status} while checking the latest Hermes Desktop release.`);
  }

  const release = (await response.json()) as GitHubReleaseResponse;
  if (!isVersionNewer(release.tag_name, currentVersion)) {
    return null;
  }

  const latestVersion = normalizedDisplayVersion(release.tag_name);
  const resolvedName = release.name?.trim() || release.tag_name;
  const body = release.body ?? null;
  return {
    currentVersion: normalizedDisplayVersion(currentVersion),
    tagName: release.tag_name,
    htmlUrl: release.html_url,
    name: release.name ?? null,
    body,
    assets: releaseAssets(release.assets),
    latestVersion,
    resolvedName,
    releaseNotesPreview: releaseNotesPreview(body),
  };
}

export function isVersionNewer(candidate: string, current: string) {
  const candidateComponents = numericVersionComponents(candidate);
  const currentComponents = numericVersionComponents(current);
  const componentCount = Math.max(candidateComponents.length, currentComponents.length);

  for (let index = 0; index < componentCount; index += 1) {
    const candidateValue = candidateComponents[index] ?? 0;
    const currentValue = currentComponents[index] ?? 0;
    if (candidateValue > currentValue) {
      return true;
    }
    if (candidateValue < currentValue) {
      return false;
    }
  }

  return false;
}

export function normalizedDisplayVersion(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith("v") || trimmed.startsWith("V") ? trimmed.slice(1) : trimmed;
}

function numericVersionComponents(value: string) {
  return normalizedDisplayVersion(value)
    .split(/\D+/)
    .filter(Boolean)
    .map((component) => Number.parseInt(component, 10))
    .filter(Number.isFinite);
}

function releaseNotesPreview(body: string | null) {
  const trimmed = body?.trim() ?? "";
  if (!trimmed) {
    return null;
  }
  if (trimmed.length <= 700) {
    return trimmed;
  }
  return `${trimmed.slice(0, 700)}...`;
}

function releaseAssets(assets: GitHubReleaseResponse["assets"]): ReleaseAsset[] {
  return (assets ?? [])
    .map((asset) => ({
      name: asset.name?.trim() ?? "",
      browserDownloadUrl: asset.browser_download_url?.trim() ?? "",
      size: typeof asset.size === "number" && Number.isFinite(asset.size) ? asset.size : null,
    }))
    .filter((asset) => asset.name && asset.browserDownloadUrl);
}
