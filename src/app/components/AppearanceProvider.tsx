"use client";

import {
  createContext,
  type ReactNode,
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
};

type AppearanceContextValue = AppearancePreferences & {
  previewAppearance: (theme: ColorTheme, scale: number) => void;
  clearAppearancePreview: () => void;
  savePreferences: (preferences: AppearancePreferences) => Promise<void>;
  setStoreName: (name: string) => Promise<void>;
  resetThemeForLogout: () => void;
};

const STORAGE_KEY = "almacenator-appearance";
const DEFAULT_PREFERENCES: AppearancePreferences = {
  colorTheme: "green",
  fontScale: 1,
  storeName: "nombre_tienda",
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function subscribeToAppearance(onChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY || event.key === null) onChange();
  }

  window.addEventListener("storage", handleStorage);
  window.addEventListener("almacenator-appearance-change", onChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener("almacenator-appearance-change", onChange);
  };
}

function getAppearanceSnapshot() {
  return localStorage.getItem(STORAGE_KEY);
}

function writePreferences(preferences: AppearancePreferences) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
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

    return { colorTheme, fontScale, storeName };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [preview, setPreview] = useState<Pick<AppearancePreferences, "colorTheme" | "fontScale"> | null>(null);
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
      if (!token) return;

      try {
        const response = await fetch("/api/configuracion", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!response.ok) return;

        const result = (await response.json()) as {
          saved: boolean;
          preferences: AppearancePreferences;
        };

        if (!result.saved) {
          const localPreferences = localStorage.getItem(STORAGE_KEY);
          if (localPreferences) {
            const migrated = parsePreferences(localPreferences);
            const saveResponse = await fetch("/api/configuracion", {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(migrated),
            });
            if (saveResponse.ok) {
              const saved = (await saveResponse.json()) as { preferences: AppearancePreferences };
              writePreferences(saved.preferences);
              return;
            }
          }
        }

        writePreferences(result.preferences);
      } catch {
        // Keep the last local preferences available while the API is unreachable.
      }
    }

    void loadPreferences();
    window.addEventListener("mini-gest-auth-change", loadPreferences);
    return () => window.removeEventListener("mini-gest-auth-change", loadPreferences);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.colorTheme = preview?.colorTheme ?? preferences.colorTheme;
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

    setPreview(null);
    writePreferences(result.preferences);
  }

  const value: AppearanceContextValue = {
    ...preferences,
    previewAppearance: (colorTheme, fontScale) =>
      setPreview({ colorTheme, fontScale: Math.min(1.2, Math.max(0.85, fontScale)) }),
    clearAppearancePreview: () => setPreview(null),
    savePreferences,
    setStoreName: (storeName) => savePreferences({ ...preferences, storeName }),
    resetThemeForLogout: () => {
      setPreview(null);
      writePreferences({ ...preferences, colorTheme: DEFAULT_PREFERENCES.colorTheme });
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
