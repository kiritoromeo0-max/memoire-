"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";

type Theme = "light" | "dark" | "system";
const getServerThemeSnapshot = (): Theme => "light";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const themeSubscribers = new Set<() => void>();
let inMemoryTheme: Theme = "light";

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

function getThemeSnapshot(): Theme {
  try {
    const savedTheme = window.localStorage.getItem("theme");
    if (isTheme(savedTheme)) {
      inMemoryTheme = savedTheme;
      return savedTheme;
    }
  } catch (error) {
    console.error("[theme] Impossible de lire le thème enregistré", error);
  }
  return inMemoryTheme;
}

function subscribeToTheme(onChange: () => void) {
  themeSubscribers.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== "theme" && event.key !== null) return;
    inMemoryTheme = isTheme(event.newValue) ? event.newValue : "light";
    onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    themeSubscribers.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function saveTheme(theme: Theme) {
  inMemoryTheme = theme;
  try {
    window.localStorage.setItem("theme", theme);
  } catch (error) {
    console.error("[theme] Impossible d'enregistrer le thème", error);
  }
  themeSubscribers.forEach((onChange) => onChange());
}

export function Providers({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerThemeSnapshot);
  const setTheme = useCallback((nextTheme: Theme) => saveTheme(nextTheme), []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolvedTheme = theme === "system" ? (mediaQuery.matches ? "dark" : "light") : theme;
      document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
      document.documentElement.style.colorScheme = resolvedTheme;
    };
    applyTheme();
    mediaQuery.addEventListener("change", applyTheme);
    return () => mediaQuery.removeEventListener("change", applyTheme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme doit être utilisé dans Providers.");
  return context;
}
