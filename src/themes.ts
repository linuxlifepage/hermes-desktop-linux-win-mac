export const designAppThemeOptions = [
  { id: "blue", label: "DarkBlue", title: "Switch to dark blue theme" },
  { id: "outline", label: "Outline", title: "Switch to outline theme" },
] as const;

export type DesignAppTheme = (typeof designAppThemeOptions)[number]["id"];
export type AppTheme = "dark" | "light" | DesignAppTheme;

export interface AppThemeOption {
  id: AppTheme;
  label: string;
  title: string;
  icon: string;
}

const designAppThemeIds = designAppThemeOptions.map((theme) => theme.id);

export function isDesignAppTheme(value: unknown): value is DesignAppTheme {
  return typeof value === "string" && designAppThemeIds.includes(value as DesignAppTheme);
}

export function appThemeValue(value: unknown): AppTheme | undefined {
  if (value === "dark" || value === "light" || isDesignAppTheme(value)) {
    return value;
  }
  return undefined;
}

export function appThemeOptions(): AppThemeOption[] {
  return [
    { id: "dark", label: "Dark", title: "Switch to dark mode", icon: "moon" },
    { id: "light", label: "Light", title: "Switch to light mode", icon: "sun" },
    ...designAppThemeOptions.map((theme) => ({
      id: theme.id,
      label: theme.label,
      title: theme.title,
      icon: "brush",
    })),
  ];
}

export function designAppThemeLabel(theme: AppTheme) {
  return designAppThemeOption(theme)?.label ?? designAppThemeOptions[0].label;
}

export function designAppThemeOption(theme: AppTheme) {
  if (!isDesignAppTheme(theme)) {
    return null;
  }
  return designAppThemeOptions.find((option) => option.id === theme) ?? null;
}
