import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const correo = request.headers.get("correo")?.trim() ?? "";
  const contrasena = request.headers.get("contrasena") ?? "";

  if (!correo || !contrasena) {
    return NextResponse.json(
      {
        status: "error",
        message: "Correo y contraseña son obligatorios.",
      },
      { status: 400 },
    );
  }

  if (!emailPattern.test(correo)) {
    return NextResponse.json(
      {
        status: "error",
        message: "El correo no tiene un formato válido.",
      },
      { status: 400 },
    );
  }

  const secretKey = process.env.SECRET_KEY;

  if (!secretKey) {
    return NextResponse.json(
      {
        status: "error",
        message: "SECRET_KEY no está configurado.",
      },
      { status: 500 },
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { correo },
      include: { role: true },
    });

    const isPasswordValid = user
      ? await bcrypt.compare(contrasena, user.contrasena)
      : false;

    if (!user || !isPasswordValid) {
      return NextResponse.json(
        {
          status: "error",
          message: "Usuario y/o contraseña incorrecta.",
        },
        { status: 401 },
      );
    }

    const token = jwt.sign(
      {
        nombre: user.nombre,
        apellido: user.apellido,
        correo: user.correo,
        rol: user.role.role,
      },
      secretKey,
      { expiresIn: "8h" },
    );

    console.log("JWT login:", token);

    return NextResponse.json({
      status: "ok",
      message: "Login correcto.",
      token,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error interno al iniciar sesión.";

    return NextResponse.json(
      {
        status: "error",
        message: `Error interno de Neon: ${message}`,
      },
      { status: 500 },
    );
  }
}
