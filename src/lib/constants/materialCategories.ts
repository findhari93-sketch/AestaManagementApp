export const CATEGORY_TAB_MAPPING: Record<string, string[]> = {
  civil: ["CEM", "STL", "AGG", "BRK"],
  electrical: ["ELC"],
  plumbing: ["PLB"],
  painting: ["PNT", "WPF"],
  doors_windows: ["WOD", "GLS"],
  hardware: ["HRD", "MSC"],
  tiles: ["TIL"],
  pumps: ["PMP"],
  all: [],
};

export const CATEGORY_TABS = [
  { id: "all", label: "All", icon: "📦" },
  { id: "civil", label: "Civil", icon: "🏗️" },
  { id: "electrical", label: "Electrical", icon: "⚡" },
  { id: "plumbing", label: "Plumbing", icon: "🚿" },
  { id: "painting", label: "Painting", icon: "🎨" },
  { id: "doors_windows", label: "Doors & Windows", icon: "🚪" },
  { id: "hardware", label: "Hardware", icon: "🔧" },
  { id: "tiles", label: "Tiles", icon: "🔲" },
  { id: "pumps", label: "Pumps", icon: "⚙️" },
] as const;

export type CategoryTabId = (typeof CATEGORY_TABS)[number]["id"];

/** Section header accent colors per category */
export const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  civil:         { bg: "#e3f2fd", color: "#1565c0" },
  electrical:    { bg: "#f3e5f5", color: "#6a1b9a" },
  plumbing:      { bg: "#e0f2f1", color: "#00695c" },
  painting:      { bg: "#fff3e0", color: "#e65100" },
  doors_windows: { bg: "#fce4ec", color: "#880e4f" },
  hardware:      { bg: "#f3f3f3", color: "#424242" },
  tiles:         { bg: "#e8f5e9", color: "#2e7d32" },
  pumps:         { bg: "#e8eaf6", color: "#283593" },
  general:       { bg: "#fafafa", color: "#555" },
};
