"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, Moon, Sun } from "lucide-react";
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

type CompanyData = {
  rut: string;
  nombre: string;
  nombreFantasia: string;
  giro: string;
  actividad: string;
  email: string;
  telefono: string;
  direccion: string;
  comuna: string;
};

type AccountUser = {
  id: string;
  nombre: string;
  apellido: string;
  rol: string;
};

const companyFields: {
  key: keyof CompanyData;
  label: string;
  type?: string;
  maxLength: number;
  placeholder?: string;
}[] = [
  { key: "rut", label: "RUT", maxLength: 12, placeholder: "12345678-9" },
  { key: "nombre", label: "Nombre o razón social", maxLength: 120 },
  { key: "nombreFantasia", label: "Nombre de fantasía", maxLength: 25 },
  { key: "giro", label: "Giro", maxLength: 120 },
  { key: "actividad", label: "Actividad", maxLength: 120 },
  { key: "email", label: "Email", type: "email", maxLength: 255 },
  { key: "telefono", label: "Teléfono", type: "tel", maxLength: 50, placeholder: "+569" },
  { key: "direccion", label: "Dirección", maxLength: 200 },
  { key: "comuna", label: "Comuna", maxLength: 100 },
];

export default function ConfiguracionPage() {
  const router = useRouter();
  const [isSessionVerified, setIsSessionVerified] = useState(false);
  const [activeSection, setActiveSection] = useState<"empresa" | "preferencias" | "usuarios">("empresa");
  const {
    colorTheme,
    fontScale,
    storeName,
    highContrast,
    darkMode,
    syncSavedStoreName,
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
      <section className="settings-workspace" aria-label="Configuración">
        <nav className="settings-sidebar" aria-label="Secciones de configuración">
          <button
            type="button"
            className={activeSection === "empresa" ? "is-active" : ""}
            aria-current={activeSection === "empresa" ? "page" : undefined}
            onClick={() => {
              clearAppearancePreview();
              setActiveSection("empresa");
            }}
          >
            <span className="settings-sidebar-icon" aria-hidden="true">▣</span>
            Empresa
          </button>
          <button
            type="button"
            className={activeSection === "preferencias" ? "is-active" : ""}
            aria-current={activeSection === "preferencias" ? "page" : undefined}
            onClick={() => setActiveSection("preferencias")}
          >
            <span className="settings-sidebar-icon" aria-hidden="true">⚙</span>
            Preferencias
          </button>
          <button
            type="button"
            className={activeSection === "usuarios" ? "is-active" : ""}
            aria-current={activeSection === "usuarios" ? "page" : undefined}
            onClick={() => {
              clearAppearancePreview();
              setActiveSection("usuarios");
            }}
          >
            <span className="settings-sidebar-icon" aria-hidden="true">U</span>
            Usuarios
          </button>
        </nav>

        <div className="settings-content">
          {activeSection === "empresa" ? (
            <CompanySettings onSaved={syncSavedStoreName} />
          ) : activeSection === "usuarios" ? (
            <UsersSettings />
          ) : (
            <>
              <header className="settings-heading">
                <h1>Preferencias</h1>
              </header>
              <AppearanceSettings
                key={`${colorTheme}-${fontScale}-${highContrast}-${darkMode}`}
                preferences={{ colorTheme, fontScale, storeName, highContrast, darkMode }}
                onPreview={previewAppearance}
                onCancel={clearAppearancePreview}
                onSave={savePreferences}
              />
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function UsersSettings() {
  const [users, setUsers] = useState<AccountUser[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const token = localStorage.getItem("jwt");

    fetch("/api/configuracion/usuarios", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json()) as { users?: AccountUser[]; message?: string };
        if (!response.ok || !result.users) {
          throw new Error(result.message ?? "No se pudieron cargar los usuarios.");
        }
        setUsers(result.users);
        setSelectedId(result.users[0]?.id ?? null);
      })
      .catch((loadError) => {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los usuarios.");
        }
      });

    return () => controller.abort();
  }, []);

  const selectedUser = users?.find((user) => user.id === selectedId);
  const roleCounts = users?.reduce<Record<string, number>>((counts, user) => {
    counts[user.rol] = (counts[user.rol] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <>
      <header className="settings-heading">
        <h1>Usuarios</h1>
      </header>
      {error ? <p className="settings-save-error" role="alert">{error}</p> : null}
      {!users && !error ? <p role="status">Cargando usuarios...</p> : null}
      {users ? (
        <>
          <div className="settings-users-summary">
            <strong>{users.length} {users.length === 1 ? "usuario" : "usuarios"}</strong>
            {Object.entries(roleCounts ?? {}).map(([role, count]) => (
              <span key={role}>{role}: {count}</span>
            ))}
          </div>
          {users.length === 0 ? (
            <p className="settings-users-empty">No hay usuarios registrados.</p>
          ) : (
            <div className="settings-users-layout">
              <div className="settings-users-list" aria-label="Cuentas registradas">
                {users.map((user) => (
                  <button
                    className={selectedId === user.id ? "is-selected" : ""}
                    key={user.id}
                    type="button"
                    aria-pressed={selectedId === user.id}
                    onClick={() => setSelectedId(user.id)}
                  >
                    <span className="settings-user-avatar" aria-hidden="true">
                      {user.nombre.charAt(0)}{user.apellido.charAt(0)}
                    </span>
                    <span className="settings-user-list-text">
                      <strong>{user.nombre} {user.apellido}</strong>
                      <small>{user.rol}</small>
                    </span>
                  </button>
                ))}
              </div>
              {selectedUser ? (
                <section className="settings-user-detail" aria-label={`Datos de ${selectedUser.nombre} ${selectedUser.apellido}`}>
                  <span className="settings-user-avatar is-large" aria-hidden="true">
                    {selectedUser.nombre.charAt(0)}{selectedUser.apellido.charAt(0)}
                  </span>
                  <h2>{selectedUser.nombre} {selectedUser.apellido}</h2>
                  <dl>
                    <div><dt>Nombre</dt><dd>{selectedUser.nombre}</dd></div>
                    <div><dt>Apellido</dt><dd>{selectedUser.apellido}</dd></div>
                    <div><dt>Rol</dt><dd>{selectedUser.rol}</dd></div>
                  </dl>
                </section>
              ) : null}
            </div>
          )}
        </>
      ) : null}
    </>
  );
}
function CompanySettings({ onSaved }: { onSaved: (name: string, token: string) => void }) {
  const [saved, setSaved] = useState<CompanyData | null>(null);
  const [draft, setDraft] = useState<CompanyData | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const token = localStorage.getItem("jwt");

    fetch("/api/configuracion/empresa", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json()) as { company?: CompanyData; message?: string };
        if (!response.ok || !result.company) {
          throw new Error(result.message ?? "No se pudieron cargar los datos de empresa.");
        }
        setSaved(result.company);
        setDraft(result.company);
      })
      .catch((loadError) => {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los datos.");
        }
      });

    return () => controller.abort();
  }, []);

  function updateField(key: keyof CompanyData, value: string) {
    if (/['"]/.test(value)) return;
    setDraft((current) => current ? { ...current, [key]: value } : current);
    setError("");
    setSuccess("");
  }

  async function saveCompany(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;

    const normalized = Object.fromEntries(
      Object.entries(draft).map(([key, value]) => [key, value.trim()]),
    ) as CompanyData;
    if (!normalized.nombreFantasia || !isSafeAppInput(normalized.nombreFantasia)) {
      setError("Ingresa un nombre de fantasía válido, de hasta 25 caracteres.");
      return;
    }
    if (normalized.rut && !/^(?:\d{1,8}|\d{1,2}(?:\.\d{3}){2})-[\dkK]$/.test(normalized.rut)) {
      setError("Ingresa un RUT con formato 12345678-9.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const token = localStorage.getItem("jwt");
      const response = await fetch("/api/configuracion/empresa", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(normalized),
      });
      const result = (await response.json()) as { company?: CompanyData; message?: string };
      if (!response.ok || !result.company) {
        throw new Error(result.message ?? "No se pudieron guardar los datos de empresa.");
      }
      setSaved(result.company);
      setDraft(result.company);
      if (token) onSaved(result.company.nombreFantasia, token);
      setSuccess("Datos de empresa guardados.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudieron guardar los datos.");
    } finally {
      setSaving(false);
    }
  }

  const hasChanges = saved && draft && JSON.stringify(saved) !== JSON.stringify(draft);

  return (
    <>
      <header className="settings-heading">
        <h1>Información de la empresa</h1>
      </header>
      {draft ? (
        <form className="settings-company-form" onSubmit={(event) => void saveCompany(event)}>
          {companyFields.map((field) => (
            <label className="settings-company-field" key={field.key}>
              <span>{field.label}{field.key === "nombreFantasia" ? " *" : ""}</span>
              <input
                type={field.type ?? "text"}
                value={draft[field.key]}
                maxLength={field.maxLength}
                placeholder={field.placeholder}
                required={field.key === "nombreFantasia"}
                onChange={(event) => updateField(field.key, event.target.value)}
              />
            </label>
          ))}
          <div className="settings-company-actions">
            <button
              type="button"
              onClick={() => {
                setDraft(saved);
                setError("");
                setSuccess("");
              }}
              disabled={!hasChanges || saving}
            >
              Cancelar
            </button>
            <button className="settings-save-button" type="submit" disabled={!hasChanges || saving}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      ) : !error ? (
        <p className="settings-company-loading" role="status">Cargando datos de empresa...</p>
      ) : null}
      {error ? <p className="settings-save-error" role="alert">{error}</p> : null}
      {success ? <p className="settings-save-success" role="status">{success}</p> : null}
    </>
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
  const [highContrast, setHighContrast] = useState(preferences.highContrast);
  const [darkMode, setDarkMode] = useState(preferences.darkMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const hasChanges = theme !== preferences.colorTheme || scale !== preferences.fontScale || highContrast !== preferences.highContrast || darkMode !== preferences.darkMode;

  useEffect(() => () => onCancel(), [onCancel]);

  function updateDraft(nextTheme: ColorTheme, nextScale: number, nextHighContrast: boolean) {
    setTheme(nextTheme);
    setScale(nextScale);
    setHighContrast(nextHighContrast);
    onPreview(nextTheme, nextScale);
    setError("");
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      await onSave({ ...preferences, colorTheme: theme, fontScale: scale, highContrast, darkMode });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setTheme(preferences.colorTheme);
    setScale(preferences.fontScale);
    setHighContrast(preferences.highContrast);
    setDarkMode(preferences.darkMode);
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
            onChange={(event) => updateDraft(theme, Number(event.target.value), highContrast)}
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
              onClick={() => updateDraft(option.id, scale, highContrast)}
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

      <section className="settings-section" aria-labelledby="high-contrast-heading">
        <div className="settings-contrast-row">
          <div className="settings-section-heading">
            <div>
              <h2 id="high-contrast-heading">Alto contraste</h2>
              <p>Texto, bordes y controles más definidos.</p>
            </div>
          </div>
          <label className="settings-contrast-switch">
            <input
              type="checkbox"
              role="switch"
              checked={highContrast}
              onChange={(event) => updateDraft(theme, scale, event.target.checked)}
              aria-labelledby="high-contrast-heading"
            />
            <span aria-hidden="true" />
          </label>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="appearance-mode-heading">
        <div className="settings-section-heading">
          <h2 id="appearance-mode-heading">Modo de apariencia</h2>
        </div>
        <div className="settings-mode-options" role="group" aria-label="Modo de apariencia">
          <button
            className={`settings-mode-option${!darkMode ? " is-selected" : ""}`}
            type="button"
            aria-pressed={!darkMode}
            onClick={() => { setDarkMode(false); setError(""); }}
          >
            <Sun size={20} aria-hidden="true" /> Modo claro
            <Check className="settings-mode-check" size={18} aria-hidden="true" />
          </button>
          <button
            className={`settings-mode-option${darkMode ? " is-selected" : ""}`}
            type="button"
            aria-pressed={darkMode}
            onClick={() => { setDarkMode(true); setError(""); }}
          >
            <Moon size={20} aria-hidden="true" /> Modo oscuro
            <Check className="settings-mode-check" size={18} aria-hidden="true" />
          </button>
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
