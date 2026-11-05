"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  MIN_PASSWORD_LENGTH,
  passwordCharacterCount, registrationPasswordSchema,
} from "@/lib/auth-validation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [maskedEmail, setMaskedEmail] = useState("");
  const [verified, setVerified] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/password-reset", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) { router.replace("/login"); return; }
        const result = await response.json() as { maskedEmail: string; verified: boolean };
        setMaskedEmail(result.maskedEmail);
        setVerified(result.verified);
        setLoading(false);
      })
      .catch(() => { if (!controller.signal.aborted) setError("No se pudo cargar la recuperación."); });
    return () => controller.abort();
  }, [router]);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) { setError("Ingresa los seis dígitos del código."); return; }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/password-reset", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", code }),
      });
      if (!response.ok) {
        const result = await response.json() as { message?: string };
        setError(result.message ?? "No se pudo verificar el código.");
        return;
      }
      setVerified(true);
    } catch { setError("No se pudo verificar el código."); }
    finally { setBusy(false); }
  }

  async function complete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validated = registrationPasswordSchema.safeParse(password);
    if (!validated.success) { setError(validated.error.issues[0]?.message ?? "Contraseña inválida."); return; }
    if (password !== confirmation) { setError("Las contraseñas no coinciden."); return; }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/password-reset", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", password, confirmation }),
      });
      if (!response.ok) {
        const result = await response.json() as { message?: string };
        setError(result.message ?? "No se pudo cambiar la contraseña.");
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch { setError("No se pudo cambiar la contraseña."); }
    finally { setBusy(false); }
  }

  const checks = [
    { label: `${MIN_PASSWORD_LENGTH} caracteres como mínimo`, met: passwordCharacterCount(password) >= MIN_PASSWORD_LENGTH },
    { label: "Una mayúscula (opcional)", met: /\p{Lu}/u.test(password) },
    { label: "Un número (opcional)", met: /\p{N}/u.test(password) },
    { label: "Un símbolo (opcional)", met: /[^\p{L}\p{N}\s]/u.test(password) },
  ];

  return (
    <section className="auth-shell">
      <div className="auth-panel">
        <p className="auth-kicker">Mini Gest</p>
        <h1>Restablecer contraseña</h1>
        {loading ? <p>Verificando solicitud...</p> : (
          <>
            <p className="auth-reset-intro">Si existe una cuenta, enviamos un código a <strong>{maskedEmail}</strong>. Revisa tu correo; vence en 10 minutos.</p>
            {!verified ? (
              <form className="auth-form" onSubmit={verify}>
                <label>Código de seis dígitos
                  <input inputMode="numeric" autoComplete="one-time-code" value={code} maxLength={6}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" />
                </label>
                <button type="submit" disabled={busy || code.length !== 6}>Verificar código</button>
              </form>
            ) : (
              <form className="auth-form" onSubmit={complete}>
                <label>Nueva contraseña
                  <input type="password" autoComplete="new-password" value={password} maxLength={128}
                    onChange={(event) => setPassword(event.target.value)} />
                </label>
                <ul className="auth-password-rules" aria-label="Condiciones de la contraseña">
                  {checks.map((check) => <li key={check.label} className={check.met ? "is-met" : ""}>{check.met ? "✓" : "○"} {check.label}</li>)}
                </ul>
                <label>Repetir contraseña
                  <input type="password" autoComplete="new-password" value={confirmation} maxLength={128}
                    onChange={(event) => setConfirmation(event.target.value)} />
                </label>
                <button type="submit" disabled={busy || !password || !confirmation}>Guardar contraseña</button>
              </form>
            )}
          </>
        )}
        {error ? <p className="auth-status auth-status-error" role="alert">{error}</p> : null}
      </div>
    </section>
  );
}
