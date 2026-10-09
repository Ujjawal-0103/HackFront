"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "traceback-theme-preference";

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Always initialize with 'light' to ensure first-time visitors receive light mode (TH-01, TH-04)
  const [theme, setThemeState] = useState<ThemeMode>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      // Only set to dark if explicitly stored as 'dark'
      if (stored === "dark") {
        setThemeState("dark");
        document.documentElement.setAttribute("data-theme", "dark");
      } else {
        // Fallback to light mode on missing or invalid value (TH-04, TH-07)
        setThemeState("light");
        document.documentElement.setAttribute("data-theme", "light");
      }
    } catch {
      // In restricted environments where localStorage is blocked
      setThemeState("light");
    }
    setMounted(true);
  }, []);

  const setTheme = (mode: ThemeMode) => {
    const validMode: ThemeMode = mode === "dark" ? "dark" : "light";
    setThemeState(validMode);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, validMode);
    } catch {
      // Silently catch quota or permission errors
    }
    document.documentElement.setAttribute("data-theme", validMode);
  };

  const toggleTheme = () => {
    const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
