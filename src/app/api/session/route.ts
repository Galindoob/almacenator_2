import { NextResponse } from "next/server";
import { AuthenticatedRequest, withAuth } from "@/lib/auth";
import { getUserPermissions } from "@/lib/permissions";
import { prisma } from "@/lib/db";

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const access = await getUserPermissions(request.correo);
  if (!access) return NextResponse.json({ message: "Usuario no encontrado." }, { status: 401 });
  const permissions = access.role === "master" ? await prisma.permiso.findMany({ select: { id: true } }) : null;
  return NextResponse.json({
    status: "ok",
    user: {
      nombre: request.nombre,
      apellido: request.apellido,
      correo: request.correo,
      rol: access.role,
      role: access.role,
      permisos: permissions ? permissions.map((permission) => permission.id) : [...access.permissions].filter(access.has),
    },
  });
});
