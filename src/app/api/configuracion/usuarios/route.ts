import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { getUserPermissions, roleLevel } from "@/lib/permissions";
import { deactivateUser } from "@/lib/deactivate-user";

const roleChangeSchema = z.object({
  userId: z.uuid(),
  roleId: z.uuid(),
});


export const GET = withAuth(async (request) => {
  try {
    const [users, roles, currentUser] = await Promise.all([
      prisma.user.findMany({
      where: { activo: true },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        url_imagen: true,
        roleid: true,
        role: { select: { role: true } },
      },
      orderBy: [{ nombre: "asc" }, { apellido: "asc" }],
      }),
      prisma.role.findMany({ select: { id: true, role: true }, orderBy: { role: "asc" } }),
      getUserPermissions(request.correo),
    ]);

    return NextResponse.json({
      roles: roles.map((role) => ({ id: role.id, nombre: role.role })),
      canManageRoles: currentUser?.has("roles_cambiar") ?? false,
      actorRole: currentUser?.role ?? null,
      actorId: currentUser?.user.id ?? null,
      users: users.map((user) => ({
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        urlImagen: user.url_imagen,
        roleId: user.roleid,
        rol: user.role.role,
      })),
    });
  } catch (error) {
    console.error("Error al consultar usuarios:", error);
    return NextResponse.json({ message: "No se pudieron cargar los usuarios." }, { status: 500 });
  }
});

export const DELETE = withAuth(async (request) => {
  const parsed = z.object({ userId: z.uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Selecciona una cuenta válida." }, { status: 400 });
  try {
    const result = await prisma.$transaction((tx) => deactivateUser(tx, request.correo, parsed.data.userId));
    return NextResponse.json({ message: result.message }, { status: result.status });
  } catch (error) {
    console.error("Error eliminando cuenta:", error);
    return NextResponse.json({ message: "No se pudo eliminar la cuenta." }, { status: 500 });
  }
});

export const PATCH = withAuth(async (request) => {
  const parsed = roleChangeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Selecciona un usuario y un rol válidos." }, { status: 400 });

  try {
    const [actor, target, nextRole] = await Promise.all([
      getUserPermissions(request.correo),
      prisma.user.findUnique({ where: { id: parsed.data.userId }, include: { role: true } }),
      prisma.role.findUnique({ where: { id: parsed.data.roleId } }),
    ]);
    if (!actor || !actor.has("roles_cambiar")) {
      return NextResponse.json({ message: "No tienes permisos para cambiar roles." }, { status: 403 });
    }
    if (!target?.activo || !nextRole) return NextResponse.json({ message: "Usuario o rol no encontrado." }, { status: 404 });
    if (target.role.role === "master" || nextRole.role === "master") {
      return NextResponse.json({ message: "El rol master es único y no se puede mover ni asignar desde esta vista." }, { status: 403 });
    }
    if (roleLevel(target.role.role) < 0 || roleLevel(nextRole.role) < 0 || roleLevel(actor.role) <= roleLevel(target.role.role) || roleLevel(actor.role) <= roleLevel(nextRole.role)) {
      return NextResponse.json({ message: "Solo puedes cambiar entre roles inferiores al tuyo." }, { status: 403 });
    }
    if (target.roleid === nextRole.id) return NextResponse.json({ message: "El usuario ya tiene ese rol." }, { status: 400 });

    const updated = await prisma.user.updateMany({
      where: { id: target.id, roleid: target.roleid, activo: true },
      data: { roleid: nextRole.id },
    });
    if (updated.count !== 1) {
      return NextResponse.json({ message: "El rol del usuario cambió. Actualiza la página e inténtalo nuevamente." }, { status: 409 });
    }
    return NextResponse.json({ message: "Rol actualizado correctamente.", roleId: nextRole.id, rol: nextRole.role });
  } catch (error) {
    console.error("Error actualizando rol de usuario:", error);
    return NextResponse.json({ message: "No se pudo actualizar el rol." }, { status: 500 });
  }
});
