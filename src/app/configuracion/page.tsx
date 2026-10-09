"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Navbar } from "../components/Navbar";
import {
  useAppearance,
  type AppearancePreferences,
  type ColorTheme,
} from "../components/AppearanceProvider";
import { isSafeAppInput } from "@/lib/input-validation";

const themes: { id: ColorTheme; label: string; color: string }[] = [
  { id: "green", label: "Verde", color: "#008b76" },
  { id: "blue", label: "Azul", color: "#1f58b0" },
  { id: "orange", label: "Naranjo", color: "#b84a10" },
  { id: "sky", label: "Celeste", color: "#007f9e" },
];

export default function ConfiguracionPage() {
  const router = useRouter();
  const [isSessionVerified, setIsSessionVerified] = useState(false);
  const {
    colorTheme,
    fontScale,
    storeName,
    setStoreName,
    previewAppearance,
    clearAppearancePreview,
    savePreferences,
  } = useAppearance();

  useEffect(() => {
    let isActive = true;
    const token = localStorage.getItem("jwt");

    if (!token) {
      router.replace("/login");
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);

    fetch("/api/session", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        if (!isActive) return;
        if (response.ok) {
          setIsSessionVerified(true);
          return;
        }
        if (response.status === 401) localStorage.removeItem("jwt");
        router.replace("/login");
      })
      .catch(() => {
        if (isActive) router.replace("/login");
      })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      isActive = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [router]);

  function handleLogout() {
    localStorage.removeItem("jwt");
    router.replace("/login");
  }

  if (!isSessionVerified) {
    return (
      <main className="settings-shell">
        <p className="price-lookup-feedback" role="status" aria-live="polite">
          Verificando sesión...
        </p>
      </main>
    );
  }

  return (
    <main className="settings-shell">
      <Navbar onLogout={handleLogout} />
      <section className="settings-content">
        <header className="settings-heading">
          <h1>Configuración</h1>
          <p>Personaliza la apariencia de Mini Gest.</p>
        </header>

        <StoreNameSetting
          key={storeName}
          storeName={storeName}
          onSave={setStoreName}
        />

        <AppearanceSettings
          key={`${colorTheme}-${fontScale}`}
          preferences={{ colorTheme, fontScale, storeName }}
          onPreview={previewAppearance}
          onCancel={clearAppearancePreview}
          onSave={savePreferences}
        />
      </section>
    </main>
  );
}

function AppearanceSettings({
  preferences,
  onPreview,
  onCancel,
  onSave,
}: {
  preferences: AppearancePreferences;
  onPreview: (theme: ColorTheme, scale: number) => void;
  onCancel: () => void;
  onSave: (preferences: AppearancePreferences) => Promise<void>;
}) {
  const [theme, setTheme] = useState(preferences.colorTheme);
  const [scale, setScale] = useState(preferences.fontScale);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const hasChanges = theme !== preferences.colorTheme || scale !== preferences.fontScale;

  function updateDraft(nextTheme: ColorTheme, nextScale: number) {
    setTheme(nextTheme);
    setScale(nextScale);
    onPreview(nextTheme, nextScale);
    setError("");
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      await onSave({ ...preferences, colorTheme: theme, fontScale: scale });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setTheme(preferences.colorTheme);
    setScale(preferences.fontScale);
    setError("");
    onCancel();
  }

  return (
    <>
      <section className="settings-section" aria-labelledby="font-scale-heading">
        <div className="settings-section-heading">
          <div>
            <h2 id="font-scale-heading">Tamaño de letra</h2>
            <p>Ajusta el texto en todas las vistas.</p>
          </div>
          <output htmlFor="font-scale" className="settings-scale-output">
            {Math.round(scale * 100)}%
          </output>
        </div>
        <div className="settings-slider-row">
          <span aria-hidden="true">A</span>
          <input
            id="font-scale"
            type="range"
            min="0.85"
            max="1.2"
            step="0.05"
            value={scale}
            onChange={(event) => updateDraft(theme, Number(event.target.value))}
            aria-label="Tamaño global de letra"
          />
          <strong aria-hidden="true">A</strong>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="color-theme-heading">
        <div className="settings-section-heading">
          <div>
            <h2 id="color-theme-heading">Tema de colores</h2>
            <p>Elige el color principal de la interfaz.</p>
          </div>
        </div>
        <div className="settings-theme-options" role="group" aria-label="Tema de colores">
          {themes.map((option) => (
            <button
              className={`settings-theme-option${theme === option.id ? " is-selected" : ""}`}
              key={option.id}
              type="button"
              aria-pressed={theme === option.id}
              onClick={() => updateDraft(option.id, scale)}
            >
              <span
                className="settings-theme-swatch"
                style={{ backgroundColor: option.color }}
                aria-hidden="true"
              />
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {hasChanges ? (
        <div className="settings-actions">
          <p className="settings-save-error" role="alert">{error}</p>
          <button type="button" disabled={saving} onClick={cancel}>
            Cancelar
          </button>
          <button className="settings-save-button" type="button" disabled={saving} onClick={save}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      ) : null}
    </>
  );
}

function StoreNameSetting({
  storeName,
  onSave,
}: {
  storeName: string;
  onSave: (name: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(storeName);
  const normalizedDraft = draft.trim();
  const isValid =
    normalizedDraft.length > 0 &&
    normalizedDraft.length <= 25 &&
    isSafeAppInput(normalizedDraft);
  const hasChanges = normalizedDraft !== storeName;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function saveName() {
    setSaving(true);
    setError("");
    try {
      await onSave(normalizedDraft);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="settings-section" aria-labelledby="store-name-heading">
      <h2 id="store-name-heading" className="settings-name-title">
        Nombre de la tienda
      </h2>
      <div className="settings-store-preview" aria-live="polite">
        <strong>{normalizedDraft || "nombre_tienda"}</strong>
      </div>
      <label className="settings-name-label" htmlFor="store-name-input">
        Nombre de la tienda
        <input
          id="store-name-input"
          type="text"
          maxLength={25}
          value={draft}
          onChange={(event) => {
            const value = event.target.value;
            if (value.length <= 25 && isSafeAppInput(value)) setDraft(value);
          }}
          placeholder="Escribe el nombre de tu tienda"
          required
        />
      </label>
      <div className="settings-name-actions">
        <button
          className="settings-name-save"
          type="button"
          onClick={() => void saveName()}
          disabled={!isValid || !hasChanges || saving}
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
        <button
          className="settings-name-cancel"
          type="button"
          disabled={!hasChanges || saving}
          onClick={() => setDraft(storeName)}
        >
          Cancelar
        </button>
      </div>
      {error ? <p className="settings-save-error" role="alert">{error}</p> : null}
    </section>
  );
}
