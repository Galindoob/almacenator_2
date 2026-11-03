import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";
import type { NextRequest } from "next/server";

export const RESET_COOKIE = "reestablecer";
export const RESET_LIFETIME_SECONDS = 10 * 60;

type ResetIntent = { purpose: "password-reset"; id: string; email: string };

function resetSecret() {
  if (!process.env.SECRET_KEY) throw new Error("SECRET_KEY no está configurado.");
  return createHmac("sha256", process.env.SECRET_KEY).update("minigest-password-reset-v1").digest("hex");
}

export function signResetIntent(id: string, email: string) {
  return jwt.sign({ purpose: "password-reset", id, email }, resetSecret(), {
    expiresIn: RESET_LIFETIME_SECONDS,
  });
}

export function readResetIntent(token: string | undefined): ResetIntent | null {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, resetSecret());
    if (typeof decoded === "string" || decoded.purpose !== "password-reset" ||
        typeof decoded.id !== "string" || typeof decoded.email !== "string") return null;
    return { purpose: "password-reset", id: decoded.id, email: decoded.email };
  } catch {
    return null;
  }
}

export function newResetCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashResetCode(id: string, code: string) {
  return createHmac("sha256", resetSecret()).update(`${id}:${code}`).digest("hex");
}

export function matchesResetCode(id: string, code: string, expected: string) {
  const calculated = Buffer.from(hashResetCode(id, code), "hex");
  const stored = Buffer.from(expected, "hex");
  return calculated.length === stored.length && timingSafeEqual(calculated, stored);
}

export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}${"*".repeat(Math.max(3, Math.min(local.length - 1, 5)))}@${domain}`;
}

export function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export async function sendResetEmail(to: string, code: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) throw new Error("Configura RESEND_API_KEY y RESEND_FROM para enviar correos.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Código para restablecer tu contraseña de Mini Gest",
      text: `Tu código de recuperación es ${code}. Vence en 10 minutos. Si no solicitaste este cambio, ignora este mensaje.`,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("El servicio de correo rechazó el envío.");
}
