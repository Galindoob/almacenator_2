import { prisma } from "@/lib/db";

const levels: Record<string, number> = { usuario: 0, cajero: 1, admin: 2, master: 3 };
const prerequisites: Record<string, string> = { productos_crear: "productos_ver", productos_editar: "productos_ver", productos_stock: "productos_ver", productos_merma: "productos_ver", vencimiento_ver: "productos_ver", proveedores_editar: "proveedores_ver" };
export function roleLevel(role: string) { return levels[role.toLowerCase()] ?? -1; }

export async function getUserPermissions(correo: string) {
  const user = await prisma.user.findUnique({ where: { correo }, include: { role: { include: { permisos: { where: { habilitado: true }, select: { permisoId: true } } } } } });
  if (!user) return null;
  const role = user.role.role.toLowerCase();
  const permissions = new Set(user.role.permisos.map((permission) => permission.permisoId));
  return { user, role, permissions, has: (permission: string) => role === "master" || (permissions.has(permission) && (!prerequisites[permission] || permissions.has(prerequisites[permission]))) };
}
