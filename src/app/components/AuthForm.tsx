"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { isSafeAppInput } from "@/lib/input-validation";
import {
  authEmailSchema,
  MAX_PASSWORD_BYTES,
  MIN_PASSWORD_LENGTH,
  passwordByteCount,
  passwordCharacterCount,
  registrationPasswordSchema,
} from "@/lib/auth-validation";

type AuthMode = "login" | "register";

type AuthFormProps = {
  mode: AuthMode;
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const isRegister = mode === "register";
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [requestingReset, setRequestingReset] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [touched, setTouched] = useState({
    firstName: false,
    lastName: false,
    email: false,
    password: false,
    confirmPassword: false,
  });


  const errors = useMemo(() => {
    const validatedEmail = authEmailSchema.safeParse(email);
    const validatedPassword = registrationPasswordSchema.safeParse(password);

    return {
      firstName:
        isRegister && firstName.trim().length === 0
          ? "El nombre es obligatorio."
          : "",
      lastName:
        isRegister && lastName.trim().length === 0
          ? "El apellido es obligatorio."
          : "",
      email:
        email.trim().length === 0
          ? "El correo es obligatorio."
          : !validatedEmail.success
            ? validatedEmail.error.issues[0]?.message ?? "El correo no tiene un formato válido."
            : "",
      password:
        password.length === 0
          ? "La contraseña es obligatoria."
          : isRegister && !validatedPassword.success
            ? validatedPassword.error.issues[0]?.message ?? "Contraseña inválida."
            : passwordByteCount(password) > MAX_PASSWORD_BYTES
              ? `La contraseña no puede superar ${MAX_PASSWORD_BYTES} bytes.`
            : "",
      confirmPassword:
        isRegister && confirmPassword.length === 0
          ? "Debes confirmar la contraseña."
          : isRegister && confirmPassword !== password
            ? "Las contraseñas no coinciden."
            : "",
    };
  }, [confirmPassword, email, firstName, isRegister, lastName, password]);

  const passwordChecks = [
    {
      label: `${MIN_PASSWORD_LENGTH} caracteres como mínimo (obligatorio)`,
      met: passwordCharacterCount(password) >= MIN_PASSWORD_LENGTH,
    },
    { label: "Una mayúscula (opcional)", met: /\p{Lu}/u.test(password) },
    { label: "Un número (opcional)", met: /\p{N}/u.test(password) },
    { label: "Un símbolo (opcional)", met: /[^\p{L}\p{N}\s]/u.test(password) },
  ];

  const showError = (field: keyof typeof errors) =>
    (submitted || touched[field]) && errors[field];

  function updateSafeInput(value: string, setter: (nextValue: string) => void) {
    if (isSafeAppInput(value)) {
      setter(value);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setStatus(null);

    if (Object.values(errors).some(Boolean)) {
      return;
    }

    if (!isRegister) {
      try {
        const response = await fetch("/api/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ correo: email.trim(), contrasena: password }),
        });
        const data = (await response.json()) as {
          status?: "ok" | "error";
          message?: string;
        };

        if (!response.ok || data.status !== "ok") {
          setStatus({
            type: "error",
            message: data.message ?? "Usuario y/o contraseña incorrecta.",
          });
          return;
        }

        localStorage.removeItem("jwt");
        window.dispatchEvent(new Event("mini-gest-auth-change"));
        router.replace("/home");
        router.refresh();
      } catch {
        setStatus({
          type: "error",
          message: "No se pudo conectar con el endpoint de login.",
        });
      }
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("correo", email.trim());
      formData.set("contrasena", password);
      formData.set("nombre", firstName.trim());
      formData.set("apellido", lastName.trim());
      if (profileImage) formData.set("imagen", profileImage);
      const response = await fetch("/api/register", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as {
        status?: "ok" | "error";
        message?: string;
      };

      if (!response.ok || data.status !== "ok") {
        setStatus({
          type: "error",
          message: data.message ?? "No se pudo registrar el usuario.",
        });
        return;
      }

      router.push("/login");
    } catch {
      setStatus({
        type: "error",
        message: "No se pudo conectar con el endpoint de registro.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function requestPasswordReset() {
    const validated = authEmailSchema.safeParse(email);
    if (!validated.success) {
      setStatus({ type: "error", message: "Ingresa un correo válido para recuperar tu contraseña." });
      return;
    }
    setRequestingReset(true);
    setStatus(null);
    try {
      const response = await fetch("/api/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", email: validated.data }),
      });
      if (!response.ok) {
        const result = await response.json() as { message?: string };
        setStatus({ type: "error", message: result.message ?? "No se pudo iniciar la recuperación." });
        return;
      }
      router.push("/reestablecer_contrasena");
    } catch {
      setStatus({ type: "error", message: "No se pudo conectar con el servicio de recuperación." });
    } finally {
      setRequestingReset(false);
    }
  }

  return (
    <section className="auth-shell">
      <div className="auth-panel">
        <p className="auth-kicker">Mini Gest</p>
        <h1>{isRegister ? "Registro" : "Iniciar sesión"}</h1>

        {isRegister ? (
          <p className="auth-return">
            ¿Te arrepentiste? <Link href="/login">Volver a inicio de sesión</Link>
          </p>
        ) : null}

        <form className="auth-form" noValidate onSubmit={handleSubmit}>
          {isRegister ? (
            <>
              <label>
                Nombre
                <input
                  type="text"
                  value={firstName}
                  placeholder="Tu nombre"
                  onBlur={() =>
                    setTouched((state) => ({ ...state, firstName: true }))
                  }
                  onChange={(event) =>
                    updateSafeInput(event.target.value, setFirstName)
                  }
                  aria-invalid={Boolean(showError("firstName"))}
                />
                {showError("firstName") ? <span>{errors.firstName}</span> : null}
              </label>

              <label>
                Apellido
                <input
                  type="text"
                  value={lastName}
                  placeholder="Tu apellido"
                  onBlur={() =>
                    setTouched((state) => ({ ...state, lastName: true }))
                  }
                  onChange={(event) =>
                    updateSafeInput(event.target.value, setLastName)
                  }
                  aria-invalid={Boolean(showError("lastName"))}
                />
                {showError("lastName") ? <span>{errors.lastName}</span> : null}
              </label>
            </>
          ) : null}

          <label>
            Correo
            <input
              type="email"
              value={email}
              maxLength={255}
              autoComplete="email"
              placeholder="correo@dominio.com"
              onBlur={() => setTouched((state) => ({ ...state, email: true }))}
              onChange={(event) => {
                if (!/['"]/.test(event.target.value)) setEmail(event.target.value);
              }}
              aria-invalid={Boolean(showError("email"))}
            />
            {showError("email") ? <span>{errors.email}</span> : null}
          </label>

          <div className="auth-password-block">
            <label>
              Contraseña
              <input
                type="password"
                value={password}
                placeholder={isRegister ? `Al menos ${MIN_PASSWORD_LENGTH} caracteres` : "Tu contraseña"}
                maxLength={128}
                autoComplete={isRegister ? "new-password" : "current-password"}
                onBlur={() =>
                  setTouched((state) => ({ ...state, password: true }))
                }
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={Boolean(showError("password"))}
              />
              {showError("password") ? <span>{errors.password}</span> : null}
            </label>
            {isRegister ? (
              <ul className="auth-password-rules" aria-label="Condiciones de la contraseña">
                {passwordChecks.map((check) => (
                  <li className={check.met ? "is-met" : ""} key={check.label}>
                    {check.met ? "✓" : "○"} {check.label}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {isRegister ? (
            <label>
              Confirmar contraseña
              <input
                type="password"
                value={confirmPassword}
                placeholder="Repite tu contraseña"
                maxLength={128}
                autoComplete="new-password"
                onBlur={() =>
                  setTouched((state) => ({ ...state, confirmPassword: true }))
                }
                onChange={(event) => setConfirmPassword(event.target.value)}
                aria-invalid={Boolean(showError("confirmPassword"))}
              />
              {showError("confirmPassword") ? (
                <span>{errors.confirmPassword}</span>
              ) : null}
            </label>
          ) : null}

          {isRegister ? (
            <label>
              Foto de perfil (opcional)
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  if (file && file.size > 5 * 1024 * 1024) {
                    setStatus({ type: "error", message: "La imagen no puede superar 5 MB." });
                    event.target.value = "";
                    setProfileImage(null);
                    return;
                  }
                  setProfileImage(file);
                  setStatus(null);
                }}
              />
              <small>JPG, PNG, WebP o GIF. Máximo 5 MB.</small>
            </label>
          ) : null}

          <button type="submit" disabled={submitting}>{submitting ? "Registrando..." : isRegister ? "Registrar" : "Ingresar"}</button>
        </form>

        {!isRegister && submitted && (status?.type === "error" || Object.values(errors).some(Boolean)) ? (
          <button className="auth-forgot-link" type="button" onClick={requestPasswordReset} disabled={requestingReset}>
            {requestingReset ? "Enviando código..." : "¿Olvidaste tu contraseña?"}
          </button>
        ) : null}

        {status ? (
          <p className={`auth-status auth-status-${status.type}`}>
            {status.message}
          </p>
        ) : null}

        <p className="auth-switch">
          {isRegister ? "¿Ya tienes cuenta? " : "¿No tienes cuenta? "}
          <Link href={isRegister ? "/login" : "/register"}>
            {isRegister ? "Iniciar sesión" : "Registrarse"}
          </Link>
        </p>
      </div>
    </section>
  );
}
