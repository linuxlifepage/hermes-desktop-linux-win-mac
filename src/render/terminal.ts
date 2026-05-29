export type TerminalThemeStyle = "graphite" | "evergreen" | "dusk" | "paper" | "aubergine" | "porcelain" | "custom";

export interface TerminalThemePreset {
  id: TerminalThemeStyle;
  name: string;
  background: string;
  foreground: string;
  muted: string;
  border: string;
}

export const terminalThemePresets: TerminalThemePreset[] = [
  { id: "graphite", name: "Graphite", background: "#0e0e0e", foreground: "#f0f0f0", muted: "#777777", border: "#252525" },
  { id: "evergreen", name: "Evergreen", background: "#0F1714", foreground: "#DBE8E1", muted: "#8FA79A", border: "#29443A" },
  { id: "dusk", name: "Dusk", background: "#101726", foreground: "#DDE7F7", muted: "#95A8C4", border: "#2C3B5A" },
  { id: "paper", name: "Paper", background: "#F5F1E8", foreground: "#2F3743", muted: "#687282", border: "#D3CAB9" },
  { id: "aubergine", name: "Aubergine", background: "#17111F", foreground: "#EFE7FF", muted: "#AA9ABA", border: "#3C304E" },
  { id: "porcelain", name: "Porcelain", background: "#F7F9FC", foreground: "#253040", muted: "#637084", border: "#D7DFEA" },
  { id: "custom", name: "Custom", background: "#0e0e0e", foreground: "#f0f0f0", muted: "#777777", border: "#252525" },
];

export function terminalThemeStyleValue(value: unknown): TerminalThemeStyle | undefined {
  return terminalThemePresets.some((preset) => preset.id === value) ? (value as TerminalThemeStyle) : undefined;
}

export function resolveTerminalTheme(
  style: TerminalThemeStyle,
  customBackground: string,
  customForeground: string,
) {
  const preset = terminalThemePresets.find((item) => item.id === style) ?? terminalThemePresets[0];
  if (style !== "custom") {
    return preset;
  }
  return {
    ...preset,
    background: customBackground,
    foreground: customForeground,
  };
}

export function terminalThemeStyleAttribute(theme: TerminalThemePreset) {
  return `--terminal-bg:${escapeStyleValue(theme.background)};--terminal-fg:${escapeStyleValue(theme.foreground)};--terminal-muted:${escapeStyleValue(theme.muted)};--terminal-border:${escapeStyleValue(theme.border)};`;
}

export function xtermThemeForPreset(theme: TerminalThemePreset) {
  const baseTheme = {
    background: theme.background,
    foreground: theme.foreground,
    cursor: theme.foreground,
    selectionBackground: `${theme.foreground}44`,
  };
  if (theme.id === "paper" || theme.id === "porcelain") {
    return {
      ...baseTheme,
      black: "#1f2933",
      red: "#b42318",
      green: "#0f7b3a",
      yellow: "#8a6200",
      blue: "#1d4ed8",
      magenta: "#8b3db4",
      cyan: "#0f766e",
      white: "#f8fafc",
      brightBlack: "#667085",
      brightRed: "#d92d20",
      brightGreen: "#16a34a",
      brightYellow: "#a16207",
      brightBlue: "#2563eb",
      brightMagenta: "#a855f7",
      brightCyan: "#0891b2",
      brightWhite: "#ffffff",
    };
  }
  return {
    ...baseTheme,
    black: "#050505",
    red: "#ff5f57",
    green: "#5af78e",
    yellow: "#f3f99d",
    blue: "#57c7ff",
    magenta: "#ff6ac1",
    cyan: "#9aedfe",
    white: "#f1f1f1",
    brightBlack: "#686868",
    brightRed: "#ff5f57",
    brightGreen: "#5af78e",
    brightYellow: "#f3f99d",
    brightBlue: "#57c7ff",
    brightMagenta: "#ff6ac1",
    brightCyan: "#9aedfe",
    brightWhite: "#ffffff",
  };
}

function escapeStyleValue(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}
