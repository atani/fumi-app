export interface ColorThemeVariant {
  accent: string;
  accentHover: string;
  accentLight: string;
}

export interface ColorTheme {
  id: string;
  name: string;
  /** Representative color shown in the picker (light variant accent) */
  swatch: string;
  light: ColorThemeVariant;
  dark: ColorThemeVariant;
}

export const COLOR_THEMES: ColorTheme[] = [
  {
    id: "indigo",
    name: "Indigo",
    swatch: "#4f46e5",
    light: { accent: "#4f46e5", accentHover: "#4338ca", accentLight: "#eef2ff" },
    dark: { accent: "#818cf8", accentHover: "#6366f1", accentLight: "#1e1b4b" },
  },
  {
    id: "rose",
    name: "Rose",
    swatch: "#e11d48",
    light: { accent: "#e11d48", accentHover: "#be123c", accentLight: "#fff1f2" },
    dark: { accent: "#fb7185", accentHover: "#f43f5e", accentLight: "#4c0519" },
  },
  {
    id: "emerald",
    name: "Emerald",
    swatch: "#059669",
    light: { accent: "#059669", accentHover: "#047857", accentLight: "#ecfdf5" },
    dark: { accent: "#34d399", accentHover: "#10b981", accentLight: "#022c22" },
  },
  {
    id: "amber",
    name: "Amber",
    swatch: "#d97706",
    light: { accent: "#d97706", accentHover: "#b45309", accentLight: "#fffbeb" },
    dark: { accent: "#fbbf24", accentHover: "#f59e0b", accentLight: "#451a03" },
  },
  {
    id: "sky",
    name: "Sky",
    swatch: "#0284c7",
    light: { accent: "#0284c7", accentHover: "#0369a1", accentLight: "#f0f9ff" },
    dark: { accent: "#38bdf8", accentHover: "#0ea5e9", accentLight: "#082f49" },
  },
  {
    id: "violet",
    name: "Violet",
    swatch: "#7c3aed",
    light: { accent: "#7c3aed", accentHover: "#6d28d9", accentLight: "#f5f3ff" },
    dark: { accent: "#a78bfa", accentHover: "#8b5cf6", accentLight: "#2e1065" },
  },
  {
    id: "orange",
    name: "Orange",
    swatch: "#ea580c",
    light: { accent: "#ea580c", accentHover: "#c2410c", accentLight: "#fff7ed" },
    dark: { accent: "#fb923c", accentHover: "#f97316", accentLight: "#431407" },
  },
  {
    id: "slate",
    name: "Slate",
    swatch: "#475569",
    light: { accent: "#475569", accentHover: "#334155", accentLight: "#f8fafc" },
    dark: { accent: "#94a3b8", accentHover: "#64748b", accentLight: "#0f172a" },
  },
];

export const DEFAULT_COLOR_THEME = "indigo";
