"use client";
import { endSession, hasSessionHint } from "@/lib/client-session";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, KeyRound, Maximize2, Minimize2, Moon, Settings2, Sun, UserRound, X } from "lucide-react";
import { Navbar } from "../components/Navbar";
import { usePermissions } from "../components/usePermissions";
import { useSyncRevision } from "../components/SyncProvider";
import { FinanceSettings } from "../components/FinanceSettings";
import {
  useAppearance,
  type AppearancePreferences,
  type ColorTheme,
} from "../components/AppearanceProvider";
import { isSafeAppInput } from "@/lib/input-validation";
import { formatRut, rutSchema } from "@/lib/rut";
import { accountChangeSchema } from "@/lib/account-validation";
import { MIN_PASSWORD_LENGTH, passwordCharacterCount } from "@/lib/auth-validation";

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
  urlImagen: string | null;
  roleId: string;
  rol: string;
};

type RoleOption = { id: string; nombre: string; puedeEditar?: boolean };

const permissionGroups: { title: string; items: { id: string; label: string; requires?: string }[] }[] = [
  {
    title: "Productos",
    items: [
      { id: "productos_ver", label: "Ver sección de productos" },
      { id: "productos_crear", label: "Crear productos", requires: "productos_ver" },
      { id: "productos_editar", label: "Editar producto", requires: "productos_ver" },
      { id: "productos_stock", label: "Agregar stock de productos", requires: "productos_ver" },
      { id: "productos_merma", label: "Hacer merma", requires: "productos_ver" },
      { id: "vencimiento_ver", label: "Ver productos por vencer", requires: "productos_ver" },
      { id: "proveedores_ver", label: "Ver proveedores" },
      { id: "proveedores_editar", label: "Agregar y editar proveedores", requires: "proveedores_ver" },
    ],
  },
  {
    title: "Vistas y otras acciones",
    items: [
      { id: "reportes_ver", label: "Ver reportes" },
      { id: "empresa_usuarios_ver", label: "Ver empresas y usuarios" },
      { id: "precios_ver", label: "Consultar precios" },
      { id: "transacciones_ver", label: "Ver transacciones" },
      { id: "academia_ver", label: "Academia MiniGest" },
      { id: "roles_cambiar", label: "Cambiar roles" },
      { id: "permisos_cambiar", label: "Cambiar permisos de rol" },
      { id: "promociones_crear", label: "Crear promociones" },
    ],
  },
  {
    title: "Ventas",
    items: [
      { id: "caja_abrir_cerrar", label: "Abrir y cerrar cajas" },
      { id: "ventas_crear", label: "Crear venta" },
      { id: "caja_ingreso_egreso", label: "Registrar ingreso y egreso" },
      { id: "caja_sacar_dinero", label: "Sacar dinero de caja" },
    ],
  },
];

type ProfileData = {
  nombre: string;
  correo: string | null;
  rol: string;
  fono: string | null;
  direccion: string | null;
  urlImagen: string | null;
  totalVentas: number;
  totalAperturas: number;
};

const companyFields: {
  key: keyof CompanyData;
  label: string;
  type?: string;
  maxLength: number;
  placeholder?: string;
}[] = [
  { key: "nombre", label: "Nombre o razón social", maxLength: 120 },
  { key: "rut", label: "RUT", maxLength: 12, placeholder: "12.345.678-0" },
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
  const [activeSection, setActiveSection] = useState<"empresa" | "preferencias" | "usuarios" | "perfil" | "ajustes_tienda" | "finanzas">("preferencias");
  const can = usePermissions();
  const {
    colorTheme,
    fontScale,
    interfaceScale,
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
    const token = hasSessionHint();

    if (!token) {
      router.replace("/login");
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);

    fetch("/api/session", {
      headers: {},
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        if (!isActive) return;
        if (response.ok) {
          setIsSessionVerified(true);
          return;
        }
        if (response.status === 401) void endSession();
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
    void endSession();
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
          {can("empresa_usuarios_ver") ? <button
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
          </button> : null}
          <button
            type="button"
            className={activeSection === "preferencias" ? "is-active" : ""}
            aria-current={activeSection === "preferencias" ? "page" : undefined}
            onClick={() => setActiveSection("preferencias")}
          >
            <span className="settings-sidebar-icon" aria-hidden="true">⚙</span>
            Preferencias
          </button>
          {can("empresa_usuarios_ver") ? <button
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
          </button> : null}
          <button
            type="button"
            className={activeSection === "perfil" ? "is-active" : ""}
            aria-current={activeSection === "perfil" ? "page" : undefined}
            onClick={() => {
              clearAppearancePreview();
              setActiveSection("perfil");
            }}
          >
            <span className="settings-sidebar-icon" aria-hidden="true"><UserRound size={20} /></span>
            Perfil
          </button>
          {can("permisos_cambiar") ? <button
            type="button"
            className={activeSection === "ajustes_tienda" ? "is-active" : ""}
            aria-current={activeSection === "ajustes_tienda" ? "page" : undefined}
            onClick={() => {
              clearAppearancePreview();
              setActiveSection("ajustes_tienda");
            }}
          >
            <span className="settings-sidebar-icon" aria-hidden="true"><Settings2 size={20} /></span>
            Ajustes de tienda
          </button> : null}
          {can("caja_sacar_dinero") ? <button type="button" className={activeSection === "finanzas" ? "is-active" : ""} aria-current={activeSection === "finanzas" ? "page" : undefined} onClick={() => { clearAppearancePreview(); setActiveSection("finanzas"); }}>
            <span className="settings-sidebar-icon" aria-hidden="true">$</span>Finanzas
          </button> : null}
        </nav>

        <div className="settings-content">
          {activeSection === "empresa" ? (
            <CompanySettings onSaved={syncSavedStoreName} />
          ) : activeSection === "usuarios" ? (
            <UsersSettings />
          ) : activeSection === "perfil" ? (
            <ProfileSettings />
          ) : activeSection === "finanzas" ? (
            <FinanceSettings />
          ) : activeSection === "ajustes_tienda" ? (
            <StoreSettings />
          ) : (
            <>
              <header className="settings-heading">
                <h1>Preferencias</h1>
              </header>
              <AccountSettings />
              <AppearanceSettings
                key={`${colorTheme}-${fontScale}-${interfaceScale}-${highContrast}-${darkMode}`}
                preferences={{ colorTheme, fontScale, interfaceScale, storeName, highContrast, darkMode }}
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

function AccountSettings() {
  const syncRevision = useSyncRevision();
  const [savedName, setSavedName] = useState("");
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (modalOpen || saving) return;
    const controller = new AbortController();
    fetch("/api/configuracion/cuenta", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as { user?: { nombre: string }; message?: string };
        if (!response.ok || !data.user) throw new Error(data.message ?? "No se pudo cargar tu cuenta.");
        setSavedName(data.user.nombre);
        setName(data.user.nombre);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "No se pudo cargar tu cuenta.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [syncRevision, modalOpen, saving]);

  const closeModal = useCallback(() => {
    if (saving) return;
    setModalOpen(false);
    setName(savedName);
    setCurrentPassword("");
    setNewPassword("");
    setRepeatPassword("");
    setFieldErrors({});
    setError("");
  }, [savedName, saving]);

  useEffect(() => {
    if (!modalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeModal();
    }
    window.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onEscape);
    };
  }, [modalOpen, closeModal]);

  async function saveAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = accountChangeSchema.safeParse({
      nombre: name,
      contrasenaActual: currentPassword,
      nuevaContrasena: newPassword,
      repetirContrasena: repeatPassword,
    });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? "");
        if (!errors[field]) errors[field] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    if (parsed.data.nombre === savedName && !parsed.data.nuevaContrasena) {
      setError("Cambia el nombre o ingresa una nueva contraseña.");
      return;
    }
    setSaving(true);
    setError("");
    setFieldErrors({});
    try {
      const response = await fetch("/api/configuracion/cuenta", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await response.json() as { message?: string; user?: { nombre: string } };
      if (!response.ok || !data.user) throw new Error(data.message ?? "No se pudo actualizar la cuenta.");
      setSavedName(data.user.nombre);
      setName(data.user.nombre);
      setCurrentPassword("");
      setNewPassword("");
      setRepeatPassword("");
      setModalOpen(false);
      setSuccess("Nombre o contraseña actualizados correctamente.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo actualizar la cuenta.");
    } finally {
      setSaving(false);
    }
  }

  const passwordChecks = [
    { label: `${MIN_PASSWORD_LENGTH} caracteres como mínimo (obligatorio)`, met: passwordCharacterCount(newPassword) >= MIN_PASSWORD_LENGTH },
    { label: "Una mayúscula (opcional)", met: /\p{Lu}/u.test(newPassword) },
    { label: "Un número (opcional)", met: /\p{N}/u.test(newPassword) },
    { label: "Un símbolo (opcional)", met: /[^\p{L}\p{N}\s]/u.test(newPassword) },
  ];

  return (
    <>
      <section className="settings-account-section" aria-labelledby="account-settings-title">
        <div>
          <h2 id="account-settings-title"><KeyRound aria-hidden="true" /> Nombre y contraseña</h2>
          <p>{loading ? "Cargando cuenta..." : savedName ? `Cuenta de ${savedName}` : "Administra los datos de tu cuenta."}</p>
        </div>
        <button type="button" onClick={() => { setSuccess(""); setError(""); setModalOpen(true); }} disabled={loading || !savedName}>Cambiar datos</button>
      </section>
      {!modalOpen && error ? <p className="settings-save-error" role="alert">{error}</p> : null}
      {success ? <p className="settings-save-success" role="status">{success}</p> : null}
      {modalOpen ? (
        <div className="settings-account-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
          <section className="settings-account-modal" role="dialog" aria-modal="true" aria-labelledby="account-modal-title">
            <header><div><h2 id="account-modal-title">Cambiar nombre o contraseña</h2><p>Confirma tu contraseña actual para guardar los cambios.</p></div><button type="button" aria-label="Cerrar" onClick={closeModal} disabled={saving}><X aria-hidden="true" /></button></header>
            <form onSubmit={(event) => void saveAccount(event)} noValidate>
              <label>Nombre
                <input autoFocus type="text" autoComplete="given-name" maxLength={25} value={name} aria-invalid={Boolean(fieldErrors.nombre)} onChange={(event) => { if (isSafeAppInput(event.target.value)) setName(event.target.value); setFieldErrors((current) => ({ ...current, nombre: "" })); }} />
                {fieldErrors.nombre ? <small role="alert">{fieldErrors.nombre}</small> : null}
              </label>
              <label>Contraseña actual <span aria-hidden="true">*</span>
                <input type="password" autoComplete="current-password" value={currentPassword} aria-invalid={Boolean(fieldErrors.contrasenaActual)} onChange={(event) => { setCurrentPassword(event.target.value); setFieldErrors((current) => ({ ...current, contrasenaActual: "" })); }} />
                {fieldErrors.contrasenaActual ? <small role="alert">{fieldErrors.contrasenaActual}</small> : null}
              </label>
              <label>Nueva contraseña
                <input type="password" autoComplete="new-password" value={newPassword} aria-invalid={Boolean(fieldErrors.nuevaContrasena)} onChange={(event) => { setNewPassword(event.target.value); setFieldErrors((current) => ({ ...current, nuevaContrasena: "" })); }} placeholder="Déjala vacía si solo cambiarás el nombre" />
                {fieldErrors.nuevaContrasena ? <small role="alert">{fieldErrors.nuevaContrasena}</small> : null}
              </label>
              <ul className="auth-password-rules" aria-label="Condiciones de la nueva contraseña">
                {passwordChecks.map((check) => <li className={check.met ? "is-met" : ""} key={check.label}>{check.met ? "✓" : "○"} {check.label}</li>)}
              </ul>
              <label>Repetir nueva contraseña
                <input type="password" autoComplete="new-password" value={repeatPassword} aria-invalid={Boolean(fieldErrors.repetirContrasena)} onChange={(event) => { setRepeatPassword(event.target.value); setFieldErrors((current) => ({ ...current, repetirContrasena: "" })); }} />
                {fieldErrors.repetirContrasena ? <small role="alert">{fieldErrors.repetirContrasena}</small> : null}
              </label>
              {error ? <p className="settings-save-error" role="alert">{error}</p> : null}
              <footer><button type="button" onClick={closeModal} disabled={saving}>Cancelar</button><button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar cambios"}</button></footer>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}

function ProfileSettings() {
  const syncRevision = useSyncRevision();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [fono, setFono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const profileDirty = Boolean(profile && (fono !== (profile.fono ?? "") || direccion !== (profile.direccion ?? "") || imageFile || removeImage));

  useEffect(() => {
    return () => { if (imagePreview) URL.revokeObjectURL(imagePreview); };
  }, [imagePreview]);

  useEffect(() => {
    if (profileDirty || saving) return;
    const controller = new AbortController();

    fetch("/api/configuracion/perfil", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = (await response.json()) as { perfil?: ProfileData; message?: string };
        if (!response.ok || !result.perfil) {
          throw new Error(result.message ?? "No se pudo cargar el perfil.");
        }
        setProfile(result.perfil);
        setFono(result.perfil.fono ?? "");
        setDireccion(result.perfil.direccion ?? "");
      })
      .catch((loadError) => {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el perfil.");
        }
      });

    return () => controller.abort();
  }, [syncRevision, profileDirty, saving]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || saving) return;
    setError("");
    setSuccess("");
    if (fono.length > 25 || direccion.length > 200 || /['"]/.test(fono + direccion)) {
      setError("Revisa el teléfono y la dirección. No pueden contener comillas.");
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.set("fono", fono);
      formData.set("direccion", direccion);
      if (imageFile) formData.set("imagen", imageFile);
      if (removeImage) formData.set("removeImage", "true");
      const response = await fetch("/api/configuracion/perfil", { method: "PUT", body: formData });
      const result = (await response.json()) as { message?: string; fono?: string | null; direccion?: string | null; urlImagen?: string | null };
      if (!response.ok) throw new Error(result.message ?? "No se pudo guardar el perfil.");
      setProfile({ ...profile, fono: result.fono ?? null, direccion: result.direccion ?? null, urlImagen: result.urlImagen ?? null });
      setImageFile(null);
      setImagePreview(null);
      setRemoveImage(false);
      setSuccess(result.message ?? "Perfil actualizado correctamente.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el perfil.");
    } finally {
      setSaving(false);
    }
  }

  const visibleImage = imagePreview ?? (removeImage ? null : profile?.urlImagen);

  return (
    <>
      <header className="settings-heading">
        <h1>Perfil</h1>
        <p>Datos y actividad de tu cuenta.</p>
      </header>
      {error ? <p className="settings-save-error" role="alert">{error}</p> : null}
      {!profile && !error ? <p role="status">Cargando perfil...</p> : null}
      {profile ? (
        <form className="settings-profile" aria-label="Datos del usuario conectado" onSubmit={saveProfile}>
          <div className="settings-profile-header">
            <div className="settings-profile-photo">
              {visibleImage ? <img src={visibleImage} alt={`Foto de ${profile.nombre}`} /> : (
                <span className="settings-user-avatar is-large" aria-hidden="true">
                  {profile.nombre.split(" ").map((part) => part.charAt(0)).slice(0, 2).join("")}
                </span>
              )}
            </div>
            <div>
              <h2>{profile.nombre}</h2>
              <span>{profile.rol}</span>
            </div>
          </div>
          <div className="settings-profile-image-actions">
            <label>Editar foto <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              if (file && file.size > 5 * 1024 * 1024) { setError("La imagen no puede superar 5 MB."); event.target.value = ""; return; }
              setImageFile(file);
              setImagePreview(file ? URL.createObjectURL(file) : null);
              if (file) setRemoveImage(false);
              setError("");
            }} /></label>
            {visibleImage ? <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); setRemoveImage(true); }}>Quitar foto</button> : null}
          </div>
          <dl className="settings-profile-fields">
            <div><dt>Nombre</dt><dd>{profile.nombre}</dd></div>
            <div><dt>Correo</dt><dd>{profile.correo ?? "Sin correo registrado"}</dd></div>
            <div><dt>Rol</dt><dd>{profile.rol}</dd></div>
          </dl>
          <div className="settings-profile-edit-fields">
            <label>Teléfono <input type="tel" value={fono} maxLength={25} placeholder="+569..." onChange={(event) => setFono(event.target.value)} /></label>
            <label>Dirección <input type="text" value={direccion} maxLength={200} placeholder="Dirección" onChange={(event) => setDireccion(event.target.value)} /></label>
          </div>
          <div className="settings-profile-stats">
            <div><span>Ventas completadas</span><strong>{profile.totalVentas}</strong></div>
            <div><span>Aperturas de caja</span><strong>{profile.totalAperturas}</strong></div>
          </div>
          {error ? <p className="settings-save-error" role="alert">{error}</p> : null}
          {success ? <p className="settings-save-success" role="status">{success}</p> : null}
          <div className="settings-company-actions"><button type="submit" className="settings-save-button" disabled={saving}>{saving ? "Guardando..." : "Guardar cambios"}</button></div>
        </form>
      ) : null}
    </>
  );
}

function StoreSettings() {
  const syncRevision = useSyncRevision();
  const [roles, setRoles] = useState<RoleOption[] | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<Record<string, string[]>>({});
  const [savedPermissions, setSavedPermissions] = useState<Record<string, string[]>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [ownPermissions, setOwnPermissions] = useState<string[]>([]);
  const [isMasterActor, setIsMasterActor] = useState(false);
  const permissionsDirty = JSON.stringify(selectedPermissions) !== JSON.stringify(savedPermissions);

  useEffect(() => {
    if (permissionsDirty || saving) return;
    const controller = new AbortController();
    fetch("/api/configuracion/permisos", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as { roles?: (RoleOption & { permisos: string[] })[]; puedeEditar?: boolean; permisosPropios?: string[]; esMaster?: boolean; message?: string };
        if (!response.ok || !data.roles) throw new Error(data.message ?? "No se pudieron cargar los roles.");
        const order: Record<string, number> = { master: 0, admin: 1, cajero: 2, usuario: 3 };
        setRoles([...data.roles].sort((a, b) => (order[a.nombre.toLowerCase()] ?? 99) - (order[b.nombre.toLowerCase()] ?? 99)));
        setSelectedPermissions(Object.fromEntries(data.roles.map((role) => [role.id, role.permisos])));
        setSavedPermissions(Object.fromEntries(data.roles.map((role) => [role.id, role.permisos])));
        setCanEdit(Boolean(data.puedeEditar));
        setOwnPermissions(data.permisosPropios ?? []);
        setIsMasterActor(Boolean(data.esMaster));
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "No se pudieron cargar los roles.");
      });
    return () => controller.abort();
  }, [syncRevision, permissionsDirty, saving]);

  const checked = selectedPermissions[selectedRoleId] ?? [];
  const isMaster = roles?.find((role) => role.id === selectedRoleId)?.nombre.toLowerCase() === "master";
  const canEditRole = canEdit && Boolean(roles?.find((role) => role.id === selectedRoleId)?.puedeEditar) && (isMasterActor || checked.every((id) => ownPermissions.includes(id)));

  async function savePermissions() {
    if (!selectedRoleId || saving || !canEditRole || isMaster) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/configuracion/permisos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roleId: selectedRoleId, permisos: checked }) });
      const data = await response.json() as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "No se pudieron guardar los permisos.");
      setSavedPermissions((current) => ({ ...current, [selectedRoleId]: checked }));
      setSuccess(data.message ?? "Permisos guardados correctamente.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron guardar los permisos.");
    } finally { setSaving(false); }
  }

  function togglePermission(permissionId: string, enabled: boolean) {
    setSuccess("");
    setSelectedPermissions((current) => {
      const next = new Set(current[selectedRoleId] ?? []);
      if (enabled) next.add(permissionId);
      else {
        next.delete(permissionId);
        for (const group of permissionGroups) {
          for (const permission of group.items) {
            if (permission.requires === permissionId) next.delete(permission.id);
          }
        }
      }
      return { ...current, [selectedRoleId]: [...next] };
    });
  }

  return (
    <>
      <header className="settings-heading">
        <h1>Ajustes de tienda</h1>
      </header>
      <section className="settings-permissions" aria-labelledby="settings-permissions-title">
        <h2 id="settings-permissions-title">Permisos de rol</h2>
        <p>Selecciona un rol para consultar sus permisos guardados.</p>
        {error ? <p className="settings-save-error" role="alert">{error}</p> : null}
        {success ? <p className="settings-save-success" role="status">{success}</p> : null}
        <label className="settings-permissions-role">Rol
          <select value={selectedRoleId} onChange={(event) => { setSelectedPermissions(savedPermissions); setSelectedRoleId(event.target.value); setError(""); setSuccess(""); }} disabled={!roles || saving}>
            <option value="">Selecciona un rol</option>
            {roles?.map((role) => <option key={role.id} value={role.id}>{role.nombre}</option>)}
          </select>
        </label>
        {selectedRoleId ? (
          <>
          {isMaster ? <p>Master siempre tiene todos los permisos.</p> : !canEditRole ? <p>No puedes editar los permisos de este rol.</p> : null}
          <div className="settings-permission-groups">
            {permissionGroups.map((group) => (
              <fieldset key={group.title}>
                <legend>{group.title}</legend>
                {group.items.map((permission) => {
                  const disabled = Boolean(isMaster || !canEditRole || saving || (!isMasterActor && !ownPermissions.includes(permission.id)) || (permission.requires && !checked.includes(permission.requires)));
                  return (
                    <label key={permission.id} className={disabled ? "is-disabled" : ""}>
                      <input
                        type="checkbox"
                        checked={checked.includes(permission.id)}
                        disabled={disabled}
                        onChange={(event) => togglePermission(permission.id, event.target.checked)}
                      />
                      <span>{permission.label}</span>
                    </label>
                  );
                })}
              </fieldset>
            ))}
          </div>
          {canEditRole && !isMaster ? <div className="settings-company-actions"><button type="button" className="settings-save-button" disabled={saving} onClick={savePermissions}>{saving ? "Guardando..." : "Guardar cambios"}</button></div> : null}
          </>
        ) : <p className="settings-permissions-empty">Selecciona un rol para ver sus permisos.</p>}
      </section>
    </>
  );
}

function UsersSettings() {
  const syncRevision = useSyncRevision();
  const [users, setUsers] = useState<AccountUser[] | null>(null);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [canManageRoles, setCanManageRoles] = useState(false);
  const [actorRole, setActorRole] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [savingRole, setSavingRole] = useState(false);
  const [roleDraft, setRoleDraft] = useState<{ userId: string; roleId: string } | null>(null);

  useEffect(() => {
    if (roleDraft || savingRole) return;
    const controller = new AbortController();

    fetch("/api/configuracion/usuarios", {
      headers: {},
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json()) as { users?: AccountUser[]; roles?: RoleOption[]; canManageRoles?: boolean; actorRole?: string | null; message?: string };
        if (!response.ok || !result.users) {
          throw new Error(result.message ?? "No se pudieron cargar los usuarios.");
        }
        setUsers(result.users);
        setRoles(result.roles ?? []);
        setCanManageRoles(Boolean(result.canManageRoles));
        setActorRole(result.actorRole ?? null);
        setSelectedId((current) => result.users?.some((user) => user.id === current) ? current : result.users?.[0]?.id ?? null);
      })
      .catch((loadError) => {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los usuarios.");
        }
      });

    return () => controller.abort();
  }, [syncRevision, roleDraft, savingRole]);

  const selectedUser = users?.find((user) => user.id === selectedId);
  const hierarchy: Record<string, number> = { usuario: 0, cajero: 1, admin: 2, master: 3 };
  const actorLevel = hierarchy[actorRole ?? ""] ?? -1;
  const canEditSelectedRole = Boolean(canManageRoles && selectedUser && (hierarchy[selectedUser.rol] ?? -1) >= 0 && actorLevel > (hierarchy[selectedUser.rol] ?? -1));
  const availableRoles = roles.filter((role) => {
    if (!canEditSelectedRole) return role.id === selectedUser?.roleId;
    return (hierarchy[role.nombre] ?? -1) >= 0 && (hierarchy[role.nombre] ?? -1) < actorLevel;
  });
  const roleCounts = users?.reduce<Record<string, number>>((counts, user) => {
    counts[user.rol] = (counts[user.rol] ?? 0) + 1;
    return counts;
  }, {});

  async function changeRole(userId: string, roleId: string) {
    if (!canManageRoles || savingRole) return;
    setSavingRole(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/configuracion/usuarios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, roleId }),
      });
      const data = await response.json() as { message?: string; roleId?: string; rol?: string };
      if (!response.ok || !data.roleId || !data.rol) throw new Error(data.message ?? "No se pudo cambiar el rol.");
      setUsers((current) => current?.map((user) => user.id === userId ? { ...user, roleId: data.roleId!, rol: data.rol! } : user) ?? null);
      setRoleDraft(null);
      setSuccess(data.message ?? "Rol actualizado correctamente.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo cambiar el rol.");
    } finally {
      setSavingRole(false);
    }
  }

  return (
    <>
      <header className="settings-heading">
        <h1>Usuarios</h1>
      </header>
      {error ? <p className="settings-save-error" role="alert">{error}</p> : null}
      {success ? <p className="settings-save-success" role="status">{success}</p> : null}
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
                    onClick={() => { setSelectedId(user.id); setRoleDraft(null); setSuccess(""); setError(""); }}
                  >
                    <span className="settings-user-avatar" aria-hidden="true">
                      {user.urlImagen ? <img src={user.urlImagen} alt="" /> : <>{user.nombre.charAt(0)}{user.apellido.charAt(0)}</>}
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
                  <div className="settings-user-detail-header">
                    <span className="settings-user-avatar is-large" aria-hidden="true">
                      {selectedUser.urlImagen ? <img src={selectedUser.urlImagen} alt="" /> : <>{selectedUser.nombre.charAt(0)}{selectedUser.apellido.charAt(0)}</>}
                    </span>
                    <div>
                      <h2>{selectedUser.nombre} {selectedUser.apellido}</h2>
                      <span className="settings-user-detail-role">{selectedUser.rol}</span>
                    </div>
                  </div>
                  <dl>
                    <div><dt>Nombre</dt><dd>{selectedUser.nombre}</dd></div>
                    <div><dt>Apellido</dt><dd>{selectedUser.apellido}</dd></div>
                    <div><dt>Rol</dt><dd>
                      <select
                        className="settings-user-role-select"
                        aria-label={`Rol de ${selectedUser.nombre} ${selectedUser.apellido}`}
                        value={roleDraft?.userId === selectedUser.id ? roleDraft.roleId : selectedUser.roleId}
                        disabled={!canEditSelectedRole || savingRole}
                        onChange={(event) => { setRoleDraft({ userId: selectedUser.id, roleId: event.target.value }); setSuccess(""); setError(""); }}
                      >
                        {availableRoles.map((role) => <option key={role.id} value={role.id}>{role.nombre}</option>)}
                      </select>
                    </dd></div>
                  </dl>
                  {canEditSelectedRole ? <div className="settings-company-actions"><button type="button" className="settings-save-button" disabled={savingRole || roleDraft?.userId !== selectedUser.id || roleDraft.roleId === selectedUser.roleId} onClick={() => { if (roleDraft?.userId === selectedUser.id) void changeRole(selectedUser.id, roleDraft.roleId); }}>{savingRole ? "Guardando..." : "Guardar rol"}</button></div> : null}
                  {!canManageRoles ? <p className="settings-role-notice">No tienes permiso para cambiar roles.</p> : null}
                  {canManageRoles && selectedUser.rol === "master" ? <p className="settings-role-notice">El rol master es único y no se puede cambiar.</p> : null}
                  {actorRole === "admin" && !canEditSelectedRole && selectedUser.rol !== "master" ? <p className="settings-role-notice">Admin solo puede alternar entre usuario y cajero.</p> : null}
                </section>
              ) : null}
            </div>
          )}
        </>
      ) : null}
    </>
  );
}
function CompanySettings({ onSaved }: { onSaved: (name: string) => void }) {
  const syncRevision = useSyncRevision();
  const [saved, setSaved] = useState<CompanyData | null>(null);
  const [draft, setDraft] = useState<CompanyData | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const companyDirty = Boolean(saved && draft && JSON.stringify(saved) !== JSON.stringify(draft));

  useEffect(() => {
    if (companyDirty || saving) return;
    const controller = new AbortController();

    fetch("/api/configuracion/empresa", {
      headers: {},
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
  }, [syncRevision, companyDirty, saving]);

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
    const validatedRut = rutSchema.safeParse(normalized.rut);
    if (!validatedRut.success) {
      setError(validatedRut.error.issues[0]?.message ?? "Ingresa un RUT válido.");
      return;
    }
    normalized.rut = validatedRut.data;

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/configuracion/empresa", {
        method: "PUT",
        headers: {
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
      onSaved(result.company.nombreFantasia);
      setSuccess("Datos de empresa guardados.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudieron guardar los datos.");
    } finally {
      setSaving(false);
    }
  }

  const hasChanges = saved && draft && JSON.stringify(saved) !== JSON.stringify(draft);
  const rutValidation = draft ? rutSchema.safeParse(draft.rut) : null;
  const rutError = rutValidation && !rutValidation.success
    ? rutValidation.error.issues[0]?.message
    : "";

  return (
    <>
      <header className="settings-heading">
        <h1>Información de la empresa</h1>
      </header>
      {draft ? (
        <form className="settings-company-form" onSubmit={(event) => void saveCompany(event)}>
          {companyFields.map((field) => (
            <label className="settings-company-field" key={field.key}>
              <span>{field.label}{field.key === "nombreFantasia" || field.key === "rut" ? " *" : ""}</span>
              <input
                type={field.type ?? "text"}
                value={draft[field.key]}
                maxLength={field.maxLength}
                placeholder={field.placeholder}
                required={field.key === "nombreFantasia" || field.key === "rut"}
                disabled={field.key === "nombre"}
                aria-invalid={field.key === "rut" && Boolean(rutError)}
                aria-describedby={field.key === "rut" && rutError ? "company-rut-error" : undefined}
                onChange={(event) => updateField(field.key, event.target.value)}
                onBlur={() => {
                  if (field.key === "rut" && draft.rut) updateField("rut", formatRut(draft.rut));
                }}
              />
              {field.key === "rut" && rutError ? (
                <small id="company-rut-error" className="settings-company-field-error" role="alert">
                  {rutError}
                </small>
              ) : null}
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
  onPreview: (theme: ColorTheme, scale: number, interfaceScale: number) => void;
  onCancel: () => void;
  onSave: (preferences: AppearancePreferences) => Promise<void>;
}) {
  const [theme, setTheme] = useState(preferences.colorTheme);
  const [scale, setScale] = useState(preferences.fontScale);
  const [interfaceScale, setInterfaceScale] = useState(preferences.interfaceScale);
  const [highContrast, setHighContrast] = useState(preferences.highContrast);
  const [darkMode, setDarkMode] = useState(preferences.darkMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const hasChanges = theme !== preferences.colorTheme || scale !== preferences.fontScale || interfaceScale !== preferences.interfaceScale || highContrast !== preferences.highContrast || darkMode !== preferences.darkMode;

  useEffect(() => () => onCancel(), [onCancel]);

  function updateDraft(nextTheme: ColorTheme, nextScale: number, nextHighContrast: boolean, nextInterfaceScale = interfaceScale) {
    setTheme(nextTheme);
    setScale(nextScale);
    setHighContrast(nextHighContrast);
    setInterfaceScale(nextInterfaceScale);
    onPreview(nextTheme, nextScale, nextInterfaceScale);
    setError("");
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      await onSave({ ...preferences, colorTheme: theme, fontScale: scale, interfaceScale, highContrast, darkMode });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setTheme(preferences.colorTheme);
    setScale(preferences.fontScale);
    setInterfaceScale(preferences.interfaceScale);
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

      <section className="settings-section" aria-labelledby="interface-scale-heading">
        <div className="settings-section-heading">
          <h2 id="interface-scale-heading">Tamaño de la interfaz</h2>
          <output htmlFor="interface-scale" className="settings-scale-output">
            {Math.round(interfaceScale * 100)}%
          </output>
        </div>
        <div className="settings-slider-row">
          <Minimize2 size={18} aria-hidden="true" />
          <input
            id="interface-scale"
            type="range"
            min="0.8"
            max="1.2"
            step="0.05"
            value={interfaceScale}
            onChange={(event) => updateDraft(theme, scale, highContrast, Number(event.target.value))}
            aria-labelledby="interface-scale-heading"
            aria-valuetext={`${Math.round(interfaceScale * 100)}%`}
          />
          <Maximize2 size={24} aria-hidden="true" />
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
