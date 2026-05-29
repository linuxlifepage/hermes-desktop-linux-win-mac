export function loadPersistedJson<T>(
  key: string,
  sanitize: (record: Record<string, unknown>) => T,
  fallback: T,
): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw);
    return isPlainRecord(parsed) ? sanitize(parsed) : fallback;
  } catch {
    return fallback;
  }
}

export function savePersistedJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // UI state persistence is a convenience; storage failures should not interrupt the app.
  }
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function nullableStringValue(value: unknown) {
  if (value === null) {
    return null;
  }
  return stringValue(value);
}

export function stringValue(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }
  return value.slice(0, 4000);
}

export function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

export function colorValue(value: unknown) {
  const color = stringValue(value);
  return color && /^#[0-9a-f]{3,8}$/i.test(color) ? color : undefined;
}
