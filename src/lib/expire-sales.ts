import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export async function expireSalesInTransaction(tx: Prisma.TransactionClient) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(79104001)::text AS locked`;
  const [{ cutoff }] = await tx.$queryRaw<{ cutoff: Date }[]>`SELECT NOW() - INTERVAL '1 hour' AS cutoff`;
  const sales = await tx.venta.findMany({ where: { estado: "pendiente", ultima_actividad: { lte: cutoff }, pagos: { none: {} } }, include: { detalles: true }, orderBy: { ultima_actividad: "asc" }, take: 100 });
  for (const sale of sales) {
    for (const productId of [...new Set(sale.detalles.map((item) => item.id_producto))].sort()) {
      await tx.$queryRaw`SELECT id_productos FROM productos WHERE id_productos = ${productId}::uuid FOR UPDATE`;
    }
    for (const detail of sale.detalles) {
      const released = await tx.instancia_producto.updateMany({ where: { id_detalle_reserva: detail.id_detalle }, data: { id_detalle_reserva: null } });
      if (released.count) await tx.producto.update({ where: { id: detail.id_producto }, data: { stock: { increment: released.count } } });
    }
    await tx.detalle.deleteMany({ where: { id_venta: sale.id_venta } });
    await tx.venta.delete({ where: { id_venta: sale.id_venta } });
  }
  return sales.length;
}

export async function expirePendingSales() {
  const [result] = await prisma.$queryRaw<{ has_expired: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM venta v WHERE v.estado = 'pendiente'
      AND v.ultima_actividad <= NOW() - INTERVAL '1 hour'
      AND NOT EXISTS (SELECT 1 FROM pagos p WHERE p.id_venta = v.id_venta)
    ) AS has_expired
  `;
  if (!result.has_expired) return 0;
  return prisma.$transaction(expireSalesInTransaction, { timeout: 30000 });
}
