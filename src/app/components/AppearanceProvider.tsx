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
import { usePathname } from "next/navigation";
import { useSyncRevision } from "./SyncProvider";

export type ColorTheme = "green" | "blue" | "orange" | "sky";

export type AppearancePreferences = {
  colorTheme: ColorTheme;
  fontScale: number;
  interfaceScale: number;
  storeName: string;
  highContrast: boolean;
  darkMode: boolean;
};

type AppearanceContextValue = AppearancePreferences & {
  previewAppearance: (theme: ColorTheme, scale: number, interfaceScale: number) => void;
  clearAppearancePreview: () => void;
  savePreferences: (preferences: AppearancePreferences) => Promise<void>;
  setStoreName: (name: string) => Promise<void>;
  syncSavedStoreName: (name: string) => void;
  resetThemeForLogout: () => void;
};

const STORAGE_KEY = "almacenator-appearance";
const DEFAULT_PREFERENCES: AppearancePreferences = {
  colorTheme: "green",
  fontScale: 1,
  interfaceScale: 1,
  storeName: "Carpediem",
  highContrast: false,
  darkMode: false,
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function subscribeToAppearance(onChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY || event.key === null) onChange();
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
  return localStorage.getItem(STORAGE_KEY);
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
    const interfaceScale =
      typeof parsed.interfaceScale === "number" && Number.isFinite(parsed.interfaceScale)
        ? Math.min(1.2, Math.max(0.8, parsed.interfaceScale))
        : 1;

    return { colorTheme, fontScale, interfaceScale, storeName, highContrast, darkMode };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const syncRevision = useSyncRevision();
  const pathname = usePathname();
  const [preview, setPreview] = useState<Pick<AppearancePreferences, "colorTheme" | "fontScale" | "interfaceScale"> | null>(null);
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
      try {
        const response = await fetch("/api/configuracion", {
          headers: {},
          cache: "no-store",
        });
        if (!response.ok) {
          if (response.status === 401) clearCachedPreferences();
          return;
        }

        const result = (await response.json()) as { preferences: AppearancePreferences };
        writePreferences(result.preferences);
      } catch {
        // Keep the current user's cached preferences while the API is unreachable.
      }
    }

    if (!pathname.startsWith("/configuracion") || syncRevision === 0) void loadPreferences();
    function handleAuthChange() {
      setPreview(null);
      clearCachedPreferences();
      void loadPreferences();
    }
    window.addEventListener("mini-gest-auth-change", handleAuthChange);
    return () => {
      window.removeEventListener("mini-gest-auth-change", handleAuthChange);
    };
  }, [syncRevision, pathname]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.colorTheme = preview?.colorTheme ?? preferences.colorTheme;
    root.dataset.highContrast = String(preferences.highContrast);
    root.dataset.appearanceMode = preferences.darkMode ? "dark" : "light";
    root.style.setProperty("--app-font-scale", String(preview?.fontScale ?? preferences.fontScale));
    root.style.setProperty("--app-interface-scale", String(preview?.interfaceScale ?? preferences.interfaceScale));
  }, [preferences, preview]);

  async function savePreferences(nextPreferences: AppearancePreferences) {
    const response = await fetch("/api/configuracion", {
      method: "PUT",
      headers: {
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

    setPreview(null);
    writePreferences(result.preferences);
  }

  const value: AppearanceContextValue = {
    ...preferences,
    previewAppearance: (colorTheme, fontScale, interfaceScale) =>
      setPreview({
        colorTheme,
        fontScale: Math.min(1.2, Math.max(0.85, fontScale)),
        interfaceScale: Math.min(1.2, Math.max(0.8, interfaceScale)),
      }),
    clearAppearancePreview,
    savePreferences,
    setStoreName: (storeName) => savePreferences({ ...preferences, storeName }),
    syncSavedStoreName: (storeName) => {
      writePreferences({ ...parsePreferences(localStorage.getItem(STORAGE_KEY)), storeName });
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
