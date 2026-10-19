import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";

export const reportQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mes inválido."),
  paymentMethod: z.union([z.literal(""), z.uuid()]).default(""),
});

type DailyReportRow = {
  date: string;
  sales: number;
  total: number;
  margin: number;
};

function nextMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return monthNumber === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(monthNumber + 1).padStart(2, "0")}-01`;
}

async function getDailyReport(
  tx: Prisma.TransactionClient,
  startDate: string,
  endDate: string,
  paymentMethod: string,
) {
  const paymentFilter = paymentMethod
    ? Prisma.sql`AND EXISTS (
        SELECT 1 FROM pagos p
        WHERE p.id_venta = v.id_venta AND p.id_medio_pago = ${paymentMethod}::uuid
      )`
    : Prisma.empty;

  return tx.$queryRaw<DailyReportRow[]>`
    WITH sale_metrics AS (
      SELECT
        v.id_venta,
        to_char(v.fecha_pago AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD') AS date,
        SUM(d.subtotal_venta)::int AS total,
        SUM(d.subtotal_venta - ROUND(d.costo_adquisicion_actual * d.cantidad))::int AS margin
      FROM venta v
      JOIN detalle d ON d.id_venta = v.id_venta
      WHERE v.estado = 'completado'
        AND v.fecha_pago IS NOT NULL
        AND v.fecha_pago >= (${startDate}::date::timestamp AT TIME ZONE 'America/Santiago')
        AND v.fecha_pago < (${endDate}::date::timestamp AT TIME ZONE 'America/Santiago')
        ${paymentFilter}
      GROUP BY v.id_venta, v.fecha_pago
    )
    SELECT
      date,
      COUNT(*)::int AS sales,
      COALESCE(SUM(total), 0)::int AS total,
      COALESCE(SUM(margin), 0)::int AS margin
    FROM sale_metrics
    GROUP BY date
    ORDER BY date
  `;
}

function summarize(rows: DailyReportRow[]) {
  return rows.reduce(
    (summary, row) => ({
      sales: summary.sales + row.sales,
      total: summary.total + row.total,
      margin: summary.margin + row.margin,
    }),
    { sales: 0, total: 0, margin: 0 },
  );
}

export async function getInstantReport(
  tx: Prisma.TransactionClient,
  query: z.infer<typeof reportQuerySchema>,
) {
  const [todayRow] = await tx.$queryRaw<{ date: string }[]>`
    SELECT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD') AS date
  `;
  const [tomorrowRow] = await tx.$queryRaw<{ date: string }[]>`
    SELECT to_char(
      (CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date + 1,
      'YYYY-MM-DD'
    ) AS date
  `;

  const [periodDays, todayDays, paymentMethods] = await Promise.all([
    getDailyReport(tx, `${query.month}-01`, nextMonth(query.month), query.paymentMethod),
    getDailyReport(tx, todayRow.date, tomorrowRow.date, query.paymentMethod),
    tx.medio_pago.findMany({
      select: { id_medio: true, medio_de_pago: true },
      orderBy: { medio_de_pago: "asc" },
    }),
  ]);

  return {
    today: todayRow.date,
    days: periodDays,
    todaySummary: summarize(todayDays),
    periodSummary: summarize(periodDays),
    paymentMethods,
  };
}
