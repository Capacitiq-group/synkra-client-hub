import { Moon, Sun } from "lucide-react";
import { useThemeStore } from "@/stores/theme";

export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-9 w-full items-center justify-center gap-2 rounded-sm border text-xs transition-colors"
      style={{
        borderColor: "var(--border-default)",
        backgroundColor: "var(--bg-elevated)",
        color: "var(--text-secondary)",
      }}
    >
      {theme === "dark" ? <Moon size={14} /> : <Sun size={14} />}
      <span>{theme === "dark" ? "Dark" : "Light"} mode</span>
    </button>
  );
}
