"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

type AuthMode = "login" | "register";

type AuthFormProps = {
  mode: AuthMode;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthForm({ mode }: AuthFormProps) {
  const isRegister = mode === "register";
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
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
        email.length === 0
          ? "El correo es obligatorio."
          : !emailPattern.test(email)
            ? "El correo debe respetar el formato ejemplo@dominio.com."
            : "",
      password:
        password.length === 0
          ? "La contraseña es obligatoria."
          : password.length < 5 || password.length > 12
            ? "La clave debe tener mínimo 5 y máximo 12 caracteres."
            : "",
      confirmPassword:
        isRegister && confirmPassword.length === 0
          ? "Debes confirmar la contraseña."
          : isRegister && confirmPassword !== password
            ? "Las contraseñas no coinciden."
            : "",
    };
  }, [confirmPassword, email, firstName, isRegister, lastName, password]);

  const showError = (field: keyof typeof errors) =>
    (submitted || touched[field]) && errors[field];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setStatus(null);

    if (Object.values(errors).some(Boolean)) {
      return;
    }

    if (!isRegister) {
      setStatus({
        type: "success",
        message: "Formulario de login validado correctamente.",
      });
      return;
    }

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          correo: email,
          contrasena: password,
          nombre: firstName.trim(),
          apellido: lastName.trim(),
        },
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setStatus({
          type: "error",
          message: data.message ?? "No se pudo registrar el usuario.",
        });
        return;
      }

      setStatus({
        type: "success",
        message: data.message ?? "Usuario registrado correctamente.",
      });
    } catch {
      setStatus({
        type: "error",
        message: "No se pudo conectar con el endpoint de registro.",
      });
    }
  }

  return (
    <section className="auth-shell">
      <div className="auth-panel">
        <p className="auth-kicker">Almacenator 2.0</p>
        <h1>{isRegister ? "Registro" : "Iniciar sesión"}</h1>

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
                  onChange={(event) => setFirstName(event.target.value)}
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
                  onChange={(event) => setLastName(event.target.value)}
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
              placeholder="correo@dominio.com"
              onBlur={() => setTouched((state) => ({ ...state, email: true }))}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(showError("email"))}
            />
            {showError("email") ? <span>{errors.email}</span> : null}
          </label>

          <label>
            Contraseña
            <input
              type="password"
              value={password}
              placeholder="5 a 12 caracteres"
              minLength={5}
              maxLength={12}
              onBlur={() =>
                setTouched((state) => ({ ...state, password: true }))
              }
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(showError("password"))}
            />
            {showError("password") ? <span>{errors.password}</span> : null}
          </label>

          {isRegister ? (
            <label>
              Confirmar contraseña
              <input
                type="password"
                value={confirmPassword}
                placeholder="Repite tu contraseña"
                minLength={5}
                maxLength={12}
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

          <button type="submit">{isRegister ? "Registrar" : "Ingresar"}</button>
        </form>

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
