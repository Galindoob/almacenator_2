import bcrypt from "bcryptjs";
import { Prisma } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authEmailSchema, registrationPasswordSchema } from "@/lib/auth-validation";
import {
  AppInputValidationError,
  assertSafePayloadText,
  unsafeInputMessage,
} from "@/lib/input-validation";

const registrationFieldsSchema = z.object({
  correo: z.string(),
  contrasena: z.string(),
  nombre: z.string(),
  apellido: z.string(),
});

export async function POST(request: NextRequest) {
  const rawFields = request.headers.get("content-type")?.includes("application/json")
    ? await request.json().catch(() => null)
    : {
        correo: request.headers.get("correo"),
        contrasena: request.headers.get("contrasena"),
        nombre: request.headers.get("nombre"),
        apellido: request.headers.get("apellido"),
      };
  const fields = registrationFieldsSchema.safeParse(rawFields);

  if (!fields.success) {
    return NextResponse.json(
      { status: "error", message: "Completa todos los datos de registro." },
      { status: 400 },
    );
  }

  const correo = fields.data.correo.trim();
  const contrasena = fields.data.contrasena;
  const nombre = fields.data.nombre.trim();
  const apellido = fields.data.apellido.trim();

  try {
    assertSafePayloadText({ nombre, apellido });
  } catch (error) {
    if (error instanceof AppInputValidationError) {
      return NextResponse.json(
        { status: "error", message: unsafeInputMessage },
        { status: 400 },
      );
    }
  }

  if (!nombre || !apellido || !correo || !contrasena) {
    return NextResponse.json(
      { status: "error", message: "Nombre, apellido, correo y contraseña son obligatorios." },
      { status: 400 },
    );
  }

  const validatedEmail = authEmailSchema.safeParse(correo);
  if (!validatedEmail.success) {
    return NextResponse.json(
      { status: "error", message: validatedEmail.error.issues[0]?.message ?? "Correo inválido." },
      { status: 400 },
    );
  }

  const validatedPassword = registrationPasswordSchema.safeParse(contrasena);
  if (!validatedPassword.success) {
    return NextResponse.json(
      { status: "error", message: validatedPassword.error.issues[0]?.message ?? "Contraseña inválida." },
      { status: 400 },
    );
  }

  try {
    const hashedPassword = await bcrypt.hash(contrasena, 10);

    await prisma.user.create({
      data: {
        nombre,
        apellido,
        correo: validatedEmail.data,
        contrasena: hashedPassword,
      },
    });

    return NextResponse.json(
      { status: "ok", message: "Usuario registrado correctamente." },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          status: "error",
          message: "El correo ya está registrado.",
        },
        { status: 409 },
      );
    }

    const message =
      error instanceof Error ? error.message : "Error al registrar usuario.";

    if (
      message.toLowerCase().includes("duplicate") ||
      message.toLowerCase().includes("unique")
    ) {
      return NextResponse.json(
        {
          status: "error",
          message: "El correo ya está registrado.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        status: "error",
        message: `Error interno de Neon: ${message}`,
      },
      { status: 500 },
    );
  }
}
