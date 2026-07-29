import bcrypt from "bcryptjs";
import { Prisma } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const correo = request.headers.get("correo")?.trim() ?? "";
  const contrasena = request.headers.get("contrasena") ?? "";
  const nombre = request.headers.get("nombre")?.trim() ?? "";
  const apellido = request.headers.get("apellido")?.trim() ?? "";

  if (!nombre || !apellido || !correo || !contrasena) {
    return NextResponse.json(
      { message: "Nombre, apellido, correo y contraseña son obligatorios." },
      { status: 400 },
    );
  }

  if (!emailPattern.test(correo)) {
    return NextResponse.json(
      { message: "El correo no tiene un formato válido." },
      { status: 400 },
    );
  }

  if (contrasena.length < 5 || contrasena.length > 12) {
    return NextResponse.json(
      { message: "La clave debe tener mínimo 5 y máximo 12 caracteres." },
      { status: 400 },
    );
  }

  try {
    const hashedPassword = await bcrypt.hash(contrasena, 10);

    await prisma.user.create({
      data: {
        nombre,
        apellido,
        correo,
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
