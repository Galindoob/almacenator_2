import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authEmailSchema, MAX_PASSWORD_BYTES, passwordByteCount } from "@/lib/auth-validation";

const loginFieldsSchema = z.object({
  correo: z.string(),
  contrasena: z.string(),
});

export async function POST(request: NextRequest) {
  const rawFields = request.headers.get("content-type")?.includes("application/json")
    ? await request.json().catch(() => null)
    : {
        correo: request.headers.get("correo"),
        contrasena: request.headers.get("contrasena"),
      };
  const fields = loginFieldsSchema.safeParse(rawFields);

  if (!fields.success) {
    return NextResponse.json(
      { status: "error", message: "Correo y contraseña son obligatorios." },
      { status: 400 },
    );
  }

  const correo = fields.data.correo.trim();
  const contrasena = fields.data.contrasena;

  if (!correo || !contrasena) {
    return NextResponse.json(
      {
        status: "error",
        message: "Correo y contraseña son obligatorios.",
      },
      { status: 400 },
    );
  }

  const validatedEmail = authEmailSchema.safeParse(correo);
  if (!validatedEmail.success) {
    return NextResponse.json(
      {
        status: "error",
        message: validatedEmail.error.issues[0]?.message ?? "Correo inválido.",
      },
      { status: 400 },
    );
  }

  if (passwordByteCount(contrasena) > MAX_PASSWORD_BYTES) {
    return NextResponse.json(
      { status: "error", message: `La contraseña no puede superar ${MAX_PASSWORD_BYTES} bytes.` },
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
      where: { correo: validatedEmail.data },
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

    return NextResponse.json({
      status: "ok",
      message: "Login correcto.",
      token,
    });
  } catch (error) {
    console.error("Error al iniciar sesión:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Error interno al iniciar sesión.",
      },
      { status: 500 },
    );
  }
}
