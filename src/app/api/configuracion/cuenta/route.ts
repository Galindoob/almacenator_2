import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/auth";
import { accountChangeSchema } from "@/lib/account-validation";

export const GET = withAuth(async (request) => {
  const user = await prisma.user.findUnique({
    where: { correo: request.correo },
    select: { nombre: true, apellido: true, correo: true },
  });
  if (!user) return NextResponse.json({ message: "Usuario no encontrado." }, { status: 404 });
  return NextResponse.json({ user });
});

export const PUT = withAuth(async (request) => {
  const parsed = accountChangeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Revisa los datos ingresados." }, { status: 400 });
  }
  const secretKey = process.env.SECRET_KEY;
  if (!secretKey) return NextResponse.json({ message: "No se pudo actualizar la cuenta." }, { status: 500 });

  try {
    const user = await prisma.user.findUnique({
      where: { correo: request.correo },
      include: { role: true },
    });
    if (!user) return NextResponse.json({ message: "Usuario no encontrado." }, { status: 404 });
    const { nombre, contrasenaActual, nuevaContrasena } = parsed.data;
    if (!await bcrypt.compare(contrasenaActual, user.contrasena)) {
      return NextResponse.json({ message: "La contraseña actual es incorrecta." }, { status: 403 });
    }
    if (nombre === user.nombre && !nuevaContrasena) {
      return NextResponse.json({ message: "No hay cambios para guardar." }, { status: 400 });
    }
    if (nuevaContrasena && nuevaContrasena === contrasenaActual) {
      return NextResponse.json({ message: "La nueva contraseña debe ser distinta de la actual." }, { status: 400 });
    }

    const changed = await prisma.user.updateMany({
      where: { id: user.id, contrasena: user.contrasena },
      data: {
        nombre,
        ...(nuevaContrasena ? { contrasena: await bcrypt.hash(nuevaContrasena, 10) } : {}),
      },
    });
    if (changed.count !== 1) {
      return NextResponse.json({ message: "La cuenta cambió mientras guardabas. Inténtalo de nuevo." }, { status: 409 });
    }

    const token = jwt.sign({ nombre, apellido: user.apellido, correo: user.correo, rol: user.role.role }, secretKey, { expiresIn: "8h" });
    const response = NextResponse.json({ message: "Cuenta actualizada correctamente.", user: { nombre, apellido: user.apellido, correo: user.correo } });
    response.cookies.set("minigest_login", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    return response;
  } catch (error) {
    console.error("Error al actualizar la cuenta:", error);
    return NextResponse.json({ message: "No se pudo actualizar la cuenta." }, { status: 500 });
  }
});
