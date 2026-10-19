import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { roundCashAmount } from "@/lib/cash-rounding";

const money = z.number().int().min(0).max(2147483647);
const quantity = z.number().finite().min(0).max(999999).refine(
  (value) => Math.abs(value * 1000 - Math.round(value * 1000)) < 0.000001,
  "La cantidad admite hasta tres decimales.",
);
const existing = { saleId: z.uuid(), revision: z.number().int().nonnegative() };
export const saleCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), key: z.uuid(), productId: z.uuid(), quantity: quantity.refine((v) => v > 0) }),
  z.object({ action: z.literal("item"), ...existing, productId: z.uuid(), quantity }),
  z.object({ action: z.literal("cancel"), ...existing }),
  z.object({ action: z.literal("pay"), ...existing, key: z.uuid(), methodId: z.uuid(), amount: money.optional() }),
]);
export type SaleCommand = z.infer<typeof saleCommandSchema>;
type Tx = Prisma.TransactionClient;
export class SaleError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}

export const saleInclude = {
  detalles: {
    orderBy: { id_detalle: "asc" },
    include: { producto: { include: {
      marca: true, unidad: true, categoria: true, proveedores: true,
      empaque_productos_empaqueToempaque: true,
      unidad_medida_productos_unidad_medidaTounidad_medida: true,
    } } },
  },
  pagos: { include: { medio_pago: true } },
} satisfies Prisma.ventaInclude;

async function readSale(tx: Tx, id: string) {
  return tx.venta.findUniqueOrThrow({ where: { id_venta: id }, include: saleInclude });
}

function validMoney(value: number) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 2147483647) {
    throw new SaleError("El monto supera el limite permitido.", 400);
  }
  return value;
}

export function calculatePayment(total: number, alreadyPaid: number, amount: number, cash: boolean, onlyCash: boolean) {
  const originalDue = total - alreadyPaid;
  const rounded = cash ? roundCashAmount(originalDue) : { total: originalDue, adjustment: 0 };
  const due = rounded.total;
  if (!Number.isSafeInteger(amount) || originalDue <= 0 || amount < 0 ||
      (amount === 0 && due > 0) || (!cash && amount !== due)) {
    throw new SaleError("El monto del cobro no es valido.", 400);
  }
  if (cash && amount % 10 !== 0) throw new SaleError("Monto ingresado debe terminar en 0.", 400);
  if (amount > due && (!cash || !onlyCash)) {
    throw new SaleError("Esta venta no admite un pago mayor al saldo pendiente.", 400);
  }
  const completed = amount >= due;
  return { completed, change: Math.max(0, amount - due), adjustment: completed ? rounded.adjustment : 0 };
}

async function lockProducts(tx: Tx, ids: string[]) {
  for (const id of [...new Set(ids)].sort()) {
    await tx.$queryRaw`SELECT id_productos FROM productos WHERE id_productos = ${id}::uuid FOR UPDATE`;
  }
}

async function setItem(tx: Tx, saleId: string, productId: string, amount: number) {
  await lockProducts(tx, [productId]);
  const product = await tx.producto.findUnique({ where: { id: productId } });
  if (!product) throw new SaleError("Producto no encontrado.", 404);
  if (product.controlaStock && !Number.isInteger(amount)) {
    throw new SaleError("Los productos por unidad requieren cantidades enteras.", 400);
  }
  let detail = await tx.detalle.findUnique({ where: { id_venta_id_producto: { id_venta: saleId, id_producto: productId } } });
  const previous = Number(detail?.cantidad ?? 0);
  const delta = amount - previous;
  if (product.controlaStock && delta > product.stock) throw new SaleError("No hay stock suficiente.");
  if (!detail && amount === 0) return;
  if (!detail) {
    detail = await tx.detalle.create({ data: {
      id_venta: saleId, id_producto: productId, cantidad: amount,
      precio_actual: product.precioVenta, costo_adquisicion_actual: product.costo,
      subtotal_venta: validMoney(Math.round(product.precioVenta * amount)),
    } });
  }
  if (product.controlaStock && delta !== 0) {
    const reserving = delta > 0;
    const instances = await tx.instancia_producto.findMany({
      where: { id_producto: productId, id_detalle_reserva: reserving ? null : detail.id_detalle },
      orderBy: [{ fecha_vencimiento: reserving ? "asc" : "desc" }, { id_instancia: "asc" }],
      take: Math.abs(delta), select: { id_instancia: true },
    });
    if (instances.length !== Math.abs(delta)) throw new SaleError("El stock y los lotes no coinciden. Revisa el inventario.");
    await tx.instancia_producto.updateMany({
      where: { id_instancia: { in: instances.map((i) => i.id_instancia) } },
      data: { id_detalle_reserva: reserving ? detail.id_detalle : null },
    });
    await tx.producto.update({ where: { id: productId }, data: { stock: { decrement: delta } } });
  }
  if (amount === 0) {
    await tx.detalle.delete({ where: { id_detalle: detail.id_detalle } });
  } else {
    await tx.detalle.update({ where: { id_detalle: detail.id_detalle }, data: {
      cantidad: amount, subtotal_venta: validMoney(Math.round(detail.precio_actual * amount)),
    } });
  }
  const sum = await tx.detalle.aggregate({ where: { id_venta: saleId }, _sum: { subtotal_venta: true } });
  await tx.venta.update({ where: { id_venta: saleId }, data: {
    valor_total: validMoney(sum._sum.subtotal_venta ?? 0), revision: { increment: 1 },
  } });
}

// The user lock serializes creation/counting and payment retries across browser tabs.
// Product locks are also used by inventory endpoints to protect reserved lots.
export async function executeSaleCommand(tx: Tx, userId: string, command: SaleCommand) {
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
  if (command.action === "create") {
    const replay = await tx.venta.findUnique({ where: { clave_cliente: command.key } });
    if (replay) {
      if (replay.id_vendedor !== userId) throw new SaleError("Operacion no disponible.");
      return readSale(tx, replay.id_venta);
    }
    if (await tx.venta.count({ where: { id_vendedor: userId, estado: "pendiente" } }) >= 5) {
      throw new SaleError("Solo puedes mantener cinco ventas pendientes al mismo tiempo.");
    }
    const sale = await tx.venta.create({ data: {
      id_vendedor: userId, clave_cliente: command.key, estado: "pendiente", valor_total: 0,
    } });
    await setItem(tx, sale.id_venta, command.productId, command.quantity);
    return readSale(tx, sale.id_venta);
  }

  const sale = await tx.venta.findFirst({ where: { id_venta: command.saleId, id_vendedor: userId }, include: { pagos: { include: { medio_pago: true } }, detalles: true } });
  if (!sale) throw new SaleError("Venta no encontrada.", 404);
  if (command.action === "pay") {
    const replay = await tx.pagos.findUnique({ where: { clave_operacion: command.key } });
    if (replay) {
      if (replay.id_venta !== sale.id_venta || replay.id_medio_pago !== command.methodId ||
          (command.amount !== undefined && replay.pago !== command.amount)) throw new SaleError("Operacion duplicada con datos diferentes.");
      return readSale(tx, sale.id_venta);
    }
  }
  if (sale.estado !== "pendiente") throw new SaleError("La venta ya esta cerrada.");
  if (sale.revision !== command.revision) throw new SaleError("La venta cambio en otra ventana. Se actualizaran sus datos; revisalos antes de continuar.");
  if (command.action !== "pay" && sale.pagos.length) throw new SaleError("No puedes modificar ni eliminar una venta con pagos registrados.");

  if (command.action === "item") {
    await setItem(tx, sale.id_venta, command.productId, command.quantity);
    return readSale(tx, sale.id_venta);
  }
  await lockProducts(tx, sale.detalles.map((d) => d.id_producto));
  if (command.action === "cancel") {
    for (const detail of sale.detalles) {
      const released = await tx.instancia_producto.updateMany({ where: { id_detalle_reserva: detail.id_detalle }, data: { id_detalle_reserva: null } });
      if (released.count) await tx.producto.update({ where: { id: detail.id_producto }, data: { stock: { increment: released.count } } });
    }
    await tx.detalle.deleteMany({ where: { id_venta: sale.id_venta } });
    await tx.venta.delete({ where: { id_venta: sale.id_venta } });
    return null;
  }

  const method = await tx.medio_pago.findUnique({ where: { id_medio: command.methodId } });
  if (!method) throw new SaleError("Metodo de pago no encontrado.", 400);
  const total = validMoney(sale.detalles.reduce((sum, d) => sum + d.subtotal_venta, 0));
  const paid = sale.pagos.reduce((sum, p) => sum + p.pago, 0);
  const cash = method.medio_de_pago.toLowerCase().trim() === "efectivo";
  const amount = cash ? command.amount : total - paid;
  if (amount === undefined) throw new SaleError("Ingresa el monto recibido.", 400);
  const { completed, change, adjustment } = calculatePayment(total, paid, validMoney(amount), cash,
    sale.pagos.every((p) => p.medio_pago.medio_de_pago.toLowerCase().trim() === "efectivo"));
  await tx.pagos.create({ data: { id_venta: sale.id_venta, id_medio_pago: method.id_medio, pago: amount, clave_operacion: command.key } });
  if (completed) {
    for (const detail of sale.detalles) {
      const product = await tx.producto.findUniqueOrThrow({ where: { id: detail.id_producto } });
      if (!product.controlaStock) continue;
      const consumed = await tx.instancia_producto.deleteMany({ where: { id_detalle_reserva: detail.id_detalle } });
      if (consumed.count !== Number(detail.cantidad)) throw new SaleError("La reserva del producto no coincide con la venta.");
      // Stock was already deducted when reserving; completion only consumes the instances.
      await tx.movimiento_de_stock.create({ data: {
        producto: product.id, usuario: userId, tipo: 3, cantidad: consumed.count,
        stock_restante: product.stock, costo_sin_iva: detail.costo_adquisicion_actual,
        costo_con_iva: Math.round(detail.costo_adquisicion_actual * 1.19),
        comentario: `Venta ${sale.num_venta}`,
      } });
    }
  }
  await tx.venta.update({ where: { id_venta: sale.id_venta }, data: {
    valor_total: validMoney(total + adjustment), redondeo: adjustment, estado: completed ? "completado" : "pendiente",
    fecha_pago: completed ? new Date() : null, vuelto: change, revision: { increment: 1 },
  } });
  return readSale(tx, sale.id_venta);
}
