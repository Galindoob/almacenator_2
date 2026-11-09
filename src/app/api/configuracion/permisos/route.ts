import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUserPermissions, roleLevel } from "@/lib/permissions";

const updateSchema = z.object({ roleId: z.uuid(), permisos: z.array(z.string().max(80)).max(200) });
const dependencies: Record<string, string> = {
  productos_crear: "productos_ver", productos_editar: "productos_ver", productos_stock: "productos_ver", productos_merma: "productos_ver", vencimiento_ver: "productos_ver", proveedores_editar: "proveedores_ver",
};

export const GET = withAuth(async (request) => {
  try {
    const actor = await getUserPermissions(request.correo);
    if (!actor) return NextResponse.json({ message: "Usuario no encontrado." }, { status: 401 });
    if (!actor.has("permisos_cambiar")) return NextResponse.json({ message: "No tienes permiso para consultar los permisos de roles." }, { status: 403 });
    const roles = await prisma.role.findMany({ orderBy: { role: "asc" }, include: { permisos: { where: { habilitado: true }, select: { permisoId: true } } } });
    return NextResponse.json({ roles: roles.map((role) => ({ id: role.id, nombre: role.role, permisos: role.permisos.map((p) => p.permisoId), puedeEditar: roleLevel(role.role) >= 0 && roleLevel(role.role) < roleLevel(actor.role) })), puedeEditar: actor.has("permisos_cambiar"), permisosPropios: [...actor.permissions], esMaster: actor.role === "master" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Error consultando permisos:", error);
    return NextResponse.json({ message: "No se pudieron cargar los permisos." }, { status: 500 });
  }
});

export const PUT = withAuth(async (request) => {
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Datos de permisos inválidos." }, { status: 400 });
  try {
    const actor = await getUserPermissions(request.correo);
    if (!actor || !actor.has("permisos_cambiar")) return NextResponse.json({ message: "No tienes permiso para editar permisos." }, { status: 403 });
    const role = await prisma.role.findUnique({ where: { id: parsed.data.roleId } });
    if (!role) return NextResponse.json({ message: "Rol no encontrado." }, { status: 404 });
    if (role.role.toLowerCase() === "master") return NextResponse.json({ message: "Los permisos de master siempre están habilitados." }, { status: 403 });
    if (roleLevel(role.role) < 0 || roleLevel(role.role) >= roleLevel(actor.role)) return NextResponse.json({ message: "Solo puedes editar permisos de roles inferiores al tuyo." }, { status: 403 });
    const selected = new Set(parsed.data.permisos);
    if (actor.role !== "master") {
      const current = await prisma.rolPermiso.findMany({ where: { roleId: role.id, habilitado: true }, select: { permisoId: true } });
      if ([...selected].some((id) => !actor.has(id)) || current.some((p) => !actor.has(p.permisoId))) return NextResponse.json({ message: "No puedes modificar permisos que tu rol no posee." }, { status: 403 });
    }
    const catalog = await prisma.permiso.findMany({ select: { id: true } });
    const valid = new Set(catalog.map((p) => p.id));
    if ([...selected].some((id) => !valid.has(id))) return NextResponse.json({ message: "Hay permisos que no existen." }, { status: 400 });
    if (Object.entries(dependencies).some(([child, parent]) => selected.has(child) && !selected.has(parent))) return NextResponse.json({ message: "Falta un permiso requerido para la selección." }, { status: 400 });
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${role.id}))::text AS locked`;
      for (const permission of catalog) {
        await tx.rolPermiso.upsert({ where: { roleId_permisoId: { roleId: role.id, permisoId: permission.id } }, create: { roleId: role.id, permisoId: permission.id, habilitado: selected.has(permission.id) }, update: { habilitado: selected.has(permission.id) } });
      }
    });
    return NextResponse.json({ message: "Permisos guardados correctamente." });
  } catch (error) {
    console.error("Error guardando permisos:", error);
    return NextResponse.json({ message: "No se pudieron guardar los permisos." }, { status: 500 });
  }
});
