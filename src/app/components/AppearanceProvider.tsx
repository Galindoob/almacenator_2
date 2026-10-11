"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { isSafeAppInput } from "@/lib/input-validation";

export type ColorTheme = "green" | "blue" | "orange" | "sky";

export type AppearancePreferences = {
  colorTheme: ColorTheme;
  fontScale: number;
  storeName: string;
  highContrast: boolean;
  darkMode: boolean;
};

type AppearanceContextValue = AppearancePreferences & {
  previewAppearance: (theme: ColorTheme, scale: number) => void;
  clearAppearancePreview: () => void;
  savePreferences: (preferences: AppearancePreferences) => Promise<void>;
  setStoreName: (name: string) => Promise<void>;
  syncSavedStoreName: (name: string, token: string) => void;
  resetThemeForLogout: () => void;
};

const STORAGE_KEY = "almacenator-appearance";
const DEFAULT_PREFERENCES: AppearancePreferences = {
  colorTheme: "green",
  fontScale: 1,
  storeName: "nombre_tienda",
  highContrast: false,
  darkMode: false,
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function subscribeToAppearance(onChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY || event.key === "jwt" || event.key === null) onChange();
  }

  window.addEventListener("storage", handleStorage);
  window.addEventListener("almacenator-appearance-change", onChange);
  window.addEventListener("mini-gest-auth-change", onChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener("almacenator-appearance-change", onChange);
    window.removeEventListener("mini-gest-auth-change", onChange);
  };
}

function getAppearanceSnapshot() {
  return localStorage.getItem("jwt") ? localStorage.getItem(STORAGE_KEY) : null;
}

function writePreferences(preferences: AppearancePreferences) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  window.dispatchEvent(new Event("almacenator-appearance-change"));
}

function clearCachedPreferences() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("almacenator-appearance-change"));
}

function parsePreferences(value: string | null): AppearancePreferences {
  if (!value) return DEFAULT_PREFERENCES;

  try {
    const parsed = JSON.parse(value) as Partial<AppearancePreferences>;
    const colorTheme: ColorTheme =
      parsed.colorTheme === "blue" ||
      parsed.colorTheme === "orange" ||
      parsed.colorTheme === "sky"
        ? parsed.colorTheme
        : "green";
    const fontScale =
      typeof parsed.fontScale === "number" && Number.isFinite(parsed.fontScale)
        ? Math.min(1.2, Math.max(0.85, parsed.fontScale))
        : 1;
    const storeName =
      typeof parsed.storeName === "string" &&
      parsed.storeName.length <= 25 &&
      isSafeAppInput(parsed.storeName)
        ? parsed.storeName
        : DEFAULT_PREFERENCES.storeName;
    const highContrast = parsed.highContrast === true;
    const darkMode = parsed.darkMode === true;

    return { colorTheme, fontScale, storeName, highContrast, darkMode };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [preview, setPreview] = useState<Pick<AppearancePreferences, "colorTheme" | "fontScale"> | null>(null);
  const clearAppearancePreview = useCallback(() => setPreview(null), []);
  const storedPreferences = useSyncExternalStore(
    subscribeToAppearance,
    getAppearanceSnapshot,
    () => null,
  );
  const preferences = useMemo(
    () => parsePreferences(storedPreferences),
    [storedPreferences],
  );

  useEffect(() => {
    async function loadPreferences() {
      const token = localStorage.getItem("jwt");
      if (!token) {
        if (localStorage.getItem(STORAGE_KEY)) clearCachedPreferences();
        return;
      }

      try {
        const response = await fetch("/api/configuracion", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!response.ok) return;

        const result = (await response.json()) as { preferences: AppearancePreferences };
        if (localStorage.getItem("jwt") === token) writePreferences(result.preferences);
      } catch {
        // Keep the current user's cached preferences while the API is unreachable.
      }
    }

    void loadPreferences();
    function handleAuthChange() {
      setPreview(null);
      clearCachedPreferences();
      void loadPreferences();
    }
    function handleStorageAuthChange(event: StorageEvent) {
      if (event.key === "jwt") handleAuthChange();
    }
    window.addEventListener("mini-gest-auth-change", handleAuthChange);
    window.addEventListener("storage", handleStorageAuthChange);
    return () => {
      window.removeEventListener("mini-gest-auth-change", handleAuthChange);
      window.removeEventListener("storage", handleStorageAuthChange);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.colorTheme = preview?.colorTheme ?? preferences.colorTheme;
    root.dataset.highContrast = String(preferences.highContrast);
    root.dataset.appearanceMode = preferences.darkMode ? "dark" : "light";
    root.style.setProperty("--app-font-scale", String(preview?.fontScale ?? preferences.fontScale));
  }, [preferences, preview]);

  async function savePreferences(nextPreferences: AppearancePreferences) {
    const token = localStorage.getItem("jwt");
    if (!token) throw new Error("Inicia sesión para guardar tus preferencias.");

    const response = await fetch("/api/configuracion", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(nextPreferences),
    });
    const result = (await response.json()) as {
      message?: string;
      preferences?: AppearancePreferences;
    };
    if (!response.ok || !result.preferences) {
      throw new Error(result.message ?? "No se pudieron guardar las preferencias.");
    }

    if (localStorage.getItem("jwt") === token) {
      setPreview(null);
      writePreferences(result.preferences);
    }
  }

  const value: AppearanceContextValue = {
    ...preferences,
    previewAppearance: (colorTheme, fontScale) =>
      setPreview({ colorTheme, fontScale: Math.min(1.2, Math.max(0.85, fontScale)) }),
    clearAppearancePreview,
    savePreferences,
    setStoreName: (storeName) => savePreferences({ ...preferences, storeName }),
    syncSavedStoreName: (storeName, token) => {
      if (localStorage.getItem("jwt") === token) {
        writePreferences({ ...parsePreferences(localStorage.getItem(STORAGE_KEY)), storeName });
      }
    },
    resetThemeForLogout: () => {
      setPreview(null);
      clearCachedPreferences();
    },
  };

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) {
    throw new Error("useAppearance debe usarse dentro de AppearanceProvider.");
  }
  return context;
}
