import type { Prisma } from "@/generated/prisma/client";
import { canDeactivateAccount } from "@/lib/user-management";

export async function deactivateUser(tx: Prisma.TransactionClient, actorEmail: string, targetId: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(79104001)::text AS locked`;
  const actor = await tx.user.findUnique({ where: { correo: actorEmail }, include: { role: true } });
  const target = await tx.user.findUnique({ where: { id: targetId }, include: { role: true } });
  if (!actor?.activo || !["admin", "master"].includes(actor.role.role.toLowerCase())) return { status: 403, message: "Solo admin y master pueden eliminar cuentas." };
  if (!target?.activo) return { status: 404, message: "La cuenta no está disponible." };
  if (!canDeactivateAccount(actor.id, actor.role.role, target.id, target.role.role)) return { status: 403, message: "Solo puedes eliminar cuentas con un rol inferior al tuyo. La cuenta master está protegida." };
  const [pending, openCash] = await Promise.all([
    tx.venta.count({ where: { id_vendedor: target.id, estado: "pendiente" } }),
    tx.apertura_caja.findFirst({ where: { id_usuario_apertura: target.id, horario_cierre: null }, select: { id_apertura: true } }),
  ]);
  if (pending || openCash) return { status: 409, message: "La cuenta tiene ventas pendientes o una caja abierta. Resuélvelas antes de eliminarla." };
  const updated = await tx.user.updateMany({ where: { id: target.id, roleid: target.roleid, activo: true }, data: { activo: false } });
  if (updated.count !== 1) return { status: 409, message: "La cuenta cambió. Actualiza la lista e inténtalo nuevamente." };
  await tx.passwordReset.deleteMany({ where: { userId: target.id } });
  return { status: 200, message: "Cuenta eliminada correctamente. Se conservó su historial." };
}
