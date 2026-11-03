import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";

export const productReportQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mes inválido."),
  productId: z.union([z.literal(""), z.uuid()]).default(""),
});

type ProductTotalsRow = {
  id: string;
  quantity: number;
  revenue: number;
  cost: number;
  sales: number;
};

type DailyRow = {
  date: string;
  quantity: number;
  revenue: number;
  cost: number;
};

type MonthlyRow = {
  month: string;
  quantity: number;
  revenue: number;
  cost: number;
};

function shiftMonth(month: string, offset: number) {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, value - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getProductReport(
  tx: Prisma.TransactionClient,
  query: z.infer<typeof productReportQuerySchema>,
) {
  const start = `${query.month}-01`;
  const end = `${shiftMonth(query.month, 1)}-01`;
  const trendStart = `${shiftMonth(query.month, -5)}-01`;

  const products = await tx.producto.findMany({
      orderBy: { nombre: "asc" },
      select: {
        id: true, nombre: true, contenido: true,
        marca: { select: { nombre: true } },
        categoria: { select: { nombreCategoria: true } },
        unidad: { select: { unidad: true } },
        unidad_medida_productos_unidad_medidaTounidad_medida: { select: { nombre: true } },
      },
    });
  const totals = await tx.$queryRaw<ProductTotalsRow[]>`
      SELECT d.id_producto AS id,
        COALESCE(SUM(d.cantidad), 0)::float8 AS quantity,
        COALESCE(SUM(d.subtotal_venta), 0)::int AS revenue,
        COALESCE(SUM(ROUND(d.costo_adquisicion_actual * d.cantidad)), 0)::int AS cost,
        COUNT(DISTINCT v.id_venta)::int AS sales
      FROM detalle d
      JOIN venta v ON v.id_venta = d.id_venta
      WHERE v.estado = 'completado'
        AND v.fecha_pago >= (${start}::date::timestamp AT TIME ZONE 'America/Santiago')
        AND v.fecha_pago < (${end}::date::timestamp AT TIME ZONE 'America/Santiago')
      GROUP BY d.id_producto
      ORDER BY revenue DESC
    `;

  const selectedId = products.some((product) => product.id === query.productId)
    ? query.productId
    : totals[0]?.id ?? products[0]?.id ?? null;

  const daily = selectedId ? await tx.$queryRaw<DailyRow[]>`
      SELECT to_char(v.fecha_pago AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD') AS date,
        COALESCE(SUM(d.cantidad), 0)::float8 AS quantity,
        COALESCE(SUM(d.subtotal_venta), 0)::int AS revenue,
        COALESCE(SUM(ROUND(d.costo_adquisicion_actual * d.cantidad)), 0)::int AS cost
      FROM detalle d
      JOIN venta v ON v.id_venta = d.id_venta
      WHERE d.id_producto = ${selectedId}::uuid
        AND v.estado = 'completado'
        AND v.fecha_pago >= (${start}::date::timestamp AT TIME ZONE 'America/Santiago')
        AND v.fecha_pago < (${end}::date::timestamp AT TIME ZONE 'America/Santiago')
      GROUP BY date
      ORDER BY date
    ` : [];
  const monthly = selectedId ? await tx.$queryRaw<MonthlyRow[]>`
      SELECT to_char(v.fecha_pago AT TIME ZONE 'America/Santiago', 'YYYY-MM') AS month,
        COALESCE(SUM(d.cantidad), 0)::float8 AS quantity,
        COALESCE(SUM(d.subtotal_venta), 0)::int AS revenue,
        COALESCE(SUM(ROUND(d.costo_adquisicion_actual * d.cantidad)), 0)::int AS cost
      FROM detalle d
      JOIN venta v ON v.id_venta = d.id_venta
      WHERE d.id_producto = ${selectedId}::uuid
        AND v.estado = 'completado'
        AND v.fecha_pago >= (${trendStart}::date::timestamp AT TIME ZONE 'America/Santiago')
        AND v.fecha_pago < (${end}::date::timestamp AT TIME ZONE 'America/Santiago')
      GROUP BY month
      ORDER BY month
    ` : [];

  return { month: query.month, selectedId, products, totals, daily, monthly };
}
