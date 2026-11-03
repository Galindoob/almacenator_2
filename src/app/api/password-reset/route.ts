import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authEmailSchema, registrationPasswordSchema } from "@/lib/auth-validation";
import {
  RESET_COOKIE, RESET_LIFETIME_SECONDS, hashResetCode, isSameOrigin,
  maskEmail, matchesResetCode, newResetCode, readResetIntent, sendResetEmail, signResetIntent,
} from "@/lib/password-reset";

const startSchema = z.object({ action: z.literal("start"), email: authEmailSchema });
const verifySchema = z.object({ action: z.literal("verify"), code: z.string().regex(/^\d{6}$/) });
const completeSchema = z.object({
  action: z.literal("complete"),
  password: registrationPasswordSchema,
  confirmation: z.string(),
}).refine((value) => value.password === value.confirmation, {
  path: ["confirmation"], message: "Las contraseñas no coinciden.",
});

function resetCookie(response: NextResponse, value: string) {
  response.cookies.set(RESET_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: RESET_LIFETIME_SECONDS,
  });
}

function error(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

function intentFrom(request: NextRequest) {
  return readResetIntent(request.cookies.get(RESET_COOKIE)?.value);
}

export async function GET(request: NextRequest) {
  const intent = intentFrom(request);
  if (!intent) return error("La solicitud de recuperación expiró.", 401);
  const reset = await prisma.passwordReset.findUnique({ where: { id: intent.id } });
  return NextResponse.json({ maskedEmail: maskEmail(intent.email), verified: Boolean(reset?.verifiedAt && !reset.usedAt && reset.expiresAt > new Date()) });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return error("Solicitud no permitida.", 403);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return error("Datos inválidos.", 400);

  if (body.action === "start") {
    const parsed = startSchema.safeParse(body);
    if (!parsed.success) return error(parsed.error.issues[0]?.message ?? "Correo inválido.", 400);
    if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) {
      return error("El envío de correos aún no está configurado.", 503);
    }
    const email = parsed.data.email;
    const user = await prisma.user.findUnique({ where: { correo: email }, select: { id: true } });
    let id: string = randomUUID();
    if (user) {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const minuteAgo = new Date(Date.now() - 60 * 1000);
      const [hourCount, recent] = await Promise.all([
        prisma.passwordReset.count({ where: { userId: user.id, createdAt: { gte: hourAgo } } }),
        prisma.passwordReset.findFirst({ where: { userId: user.id, createdAt: { gte: minuteAgo }, usedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } }),
      ]);
      if (recent) {
        id = recent.id;
      } else if (hourCount < 3) {
        const code = newResetCode();
        const reset = await prisma.passwordReset.create({
          data: { id, userId: user.id, codeHash: hashResetCode(id, code), expiresAt: new Date(Date.now() + RESET_LIFETIME_SECONDS * 1000) },
        });
        id = reset.id;
        try {
          await sendResetEmail(email, code);
        } catch {
          await prisma.passwordReset.delete({ where: { id } });
          return error("No se pudo enviar el correo. Revisa la configuración del servicio e inténtalo de nuevo.", 503);
        }
      } else {
        const active = await prisma.passwordReset.findFirst({
          where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: "desc" }, select: { id: true },
        });
        if (active) id = active.id;
      }
    }
    const response = NextResponse.json({ maskedEmail: maskEmail(email) });
    resetCookie(response, signResetIntent(id, email));
    return response;
  }

  const intent = intentFrom(request);
  if (!intent) return error("La solicitud de recuperación expiró. Vuelve al inicio de sesión.", 401);
  const reset = await prisma.passwordReset.findUnique({ where: { id: intent.id }, include: { user: { select: { correo: true } } } });
  if (!reset || reset.user.correo !== intent.email || reset.usedAt || reset.expiresAt <= new Date()) {
    return error("El código expiró o no es válido.", 400);
  }

  if (body.action === "verify") {
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) return error("Ingresa un código de seis dígitos.", 400);
    if (reset.attempts >= 5) return error("Demasiados intentos. Solicita un código nuevo.", 429);
    if (!matchesResetCode(reset.id, parsed.data.code, reset.codeHash)) {
      await prisma.passwordReset.updateMany({ where: { id: reset.id, attempts: { lt: 5 }, verifiedAt: null }, data: { attempts: { increment: 1 } } });
      return error("Código incorrecto o expirado.", 400);
    }
    await prisma.passwordReset.updateMany({ where: { id: reset.id, attempts: { lt: 5 }, verifiedAt: null, usedAt: null }, data: { verifiedAt: new Date() } });
    return NextResponse.json({ verified: true });
  }

  if (body.action === "complete") {
    const parsed = completeSchema.safeParse(body);
    if (!parsed.success) return error(parsed.error.issues[0]?.message ?? "Contraseña inválida.", 400);
    if (!reset.verifiedAt || reset.attempts >= 5) return error("Primero verifica el código.", 403);
    const hash = await bcrypt.hash(parsed.data.password, 10);
    const updated = await prisma.$transaction(async (transaction) => {
      const claimed = await transaction.passwordReset.updateMany({
        where: { id: reset.id, usedAt: null, verifiedAt: { not: null }, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) return false;
      await transaction.user.update({ where: { id: reset.userId }, data: { contrasena: hash } });
      await transaction.passwordReset.updateMany({ where: { userId: reset.userId, usedAt: null }, data: { usedAt: new Date() } });
      return true;
    });
    if (!updated) return error("La solicitud de recuperación ya se usó o expiró.", 409);
    const response = NextResponse.json({ status: "ok" });
    response.cookies.delete(RESET_COOKIE);
    response.cookies.delete("minigest_login");
    response.cookies.delete("minigest_session_hint");
    return response;
  }
  return error("Acción inválida.", 400);
}
