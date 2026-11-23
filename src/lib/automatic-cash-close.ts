import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;
export type AutomaticCashCloseResult =
  | { status: "not_due" }
  | { status: "blocked"; pendingPaid: number }
  | { status: "closed"; cancelledSales: number };

// PostgreSQL's clock, not a cashier's computer, determines the local business day.
export async function isCashPastDeadline(tx: Tx, cashId: string) {
  const [row] = await tx.$queryRaw<{ due: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM apertura_caja
      WHERE id_apertura = ${cashId}::uuid AND horario_cierre IS NULL
        AND (horario_apertura AT TIME ZONE 'America/Santiago')::date
            < (clock_timestamp() AT TIME ZONE 'America/Santiago')::date
    ) AS due
  `;
  return row.due;
}

export async function closeOverdueCashInTransaction(tx: Tx): Promise<AutomaticCashCloseResult> {
  // The same lock is held by sales, cash movements, and manual closing.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(79104001)::text AS locked`;
  const cash = await tx.apertura_caja.findFirst({ where: { horario_cierre: null } });
  if (!cash || !(await isCashPastDeadline(tx, cash.id_apertura))) return { status: "not_due" };

  const where = { id_apertura_caja: cash.id_apertura, estado: "pendiente" };
  const pendingPaid = await tx.venta.count({ where: { ...where, pagos: { some: {} } } });
  if (pendingPaid) return { status: "blocked", pendingPaid };

  const pending = await tx.venta.findMany({ where: { ...where, pagos: { none: {} } }, include: { detalles: true } });
  // Acquire product locks in a stable order before releasing the inventory reservations.
  const productIds = [...new Set(pending.flatMap((sale) => sale.detalles.map((detail) => detail.id_producto)))].sort();
  for (const productId of productIds) {
    await tx.$queryRaw`SELECT id_productos FROM productos WHERE id_productos = ${productId}::uuid FOR UPDATE`;
  }
  for (const sale of pending) {
    for (const detail of sale.detalles) {
      const released = await tx.instancia_producto.updateMany({ where: { id_detalle_reserva: detail.id_detalle }, data: { id_detalle_reserva: null } });
      if (released.count) await tx.producto.update({ where: { id: detail.id_producto }, data: { stock: { increment: released.count } } });
    }
    await tx.detalle.deleteMany({ where: { id_venta: sale.id_venta } });
    await tx.venta.delete({ where: { id_venta: sale.id_venta } });
  }

  // saldo_cierre and diferencia remain unknown until a physical count is made.
  await tx.$executeRaw`
    UPDATE apertura_caja SET horario_cierre = clock_timestamp(), cierre_automatico = true,
      id_usuario_cierre = NULL, saldo_cierre = NULL, diferencia = NULL,
      valor_real = saldo_esperado
    WHERE id_apertura = ${cash.id_apertura}::uuid AND horario_cierre IS NULL
  `;
  return { status: "closed", cancelledSales: pending.length };
}

export async function processAutomaticCashClose(): Promise<AutomaticCashCloseResult> {
  const { prisma } = await import("@/lib/db");
  // Most requests do not need to take the cash register lock.
  const [row] = await prisma.$queryRaw<{ due: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM apertura_caja WHERE horario_cierre IS NULL
        AND (horario_apertura AT TIME ZONE 'America/Santiago')::date
            < (clock_timestamp() AT TIME ZONE 'America/Santiago')::date
    ) AS due
  `;
  if (!row.due) return { status: "not_due" };
  return prisma.$transaction(closeOverdueCashInTransaction, { timeout: 60000 });
}
