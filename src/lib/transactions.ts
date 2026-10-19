import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";

const optionalDate = z.union([z.literal(""), z.iso.date()]).default("");
export const transactionQuerySchema = z.object({
  saleNumber: z.string().regex(/^\d*$/).max(25).default(""),
  startDate: optionalDate,
  endDate: optionalDate,
  status: z.enum(["", "pendiente", "completado", "pagado", "reservado"]).default(""),
  paymentMethod: z.union([z.literal(""), z.uuid()]).default(""),
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize: z.coerce.number().pipe(z.union([z.literal(10), z.literal(25), z.literal(50)])).default(10),
}).refine((query) => !query.startDate || !query.endDate || query.startDate <= query.endDate, {
  message: "La fecha de termino debe ser igual o posterior a la de inicio.",
});

type TransactionRow = {
  id_venta: string;
  num_venta: number;
  estado: string;
  fecha_de_creacion: Date;
  fecha_pago: Date | null;
  valor_total: number;
  recibo: string | null;
  cajero: string;
  pagos: { id_pago: string; id_medio_pago: string; medio_de_pago: string; pago: number }[];
};

export async function listTransactions(tx: Prisma.TransactionClient, query: z.infer<typeof transactionQuerySchema>) {
  const filters: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (query.saleNumber) filters.push(Prisma.sql`v.num_venta::text LIKE ${`%${query.saleNumber}%`}`);
  // Interpret calendar bounds in Chile, including DST, without using the browser's timezone.
  if (query.startDate) filters.push(Prisma.sql`v.fecha_de_creacion >= (${query.startDate}::date::timestamp AT TIME ZONE 'America/Santiago')`);
  if (query.endDate) filters.push(Prisma.sql`v.fecha_de_creacion < ((${query.endDate}::date + 1)::timestamp AT TIME ZONE 'America/Santiago')`);
  if (query.status) filters.push(Prisma.sql`v.estado = ${query.status}`);
  if (query.paymentMethod) filters.push(Prisma.sql`EXISTS (
    SELECT 1 FROM pagos p WHERE p.id_venta = v.id_venta AND p.id_medio_pago = ${query.paymentMethod}::uuid
  )`);
  const where = Prisma.join(filters, " AND ");
  const [count] = await tx.$queryRaw<{ total: number }[]>`SELECT COUNT(*)::int AS total FROM venta v WHERE ${where}`;
  const total = count.total;
  const pages = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, pages);
  const transactions = await tx.$queryRaw<TransactionRow[]>`
    SELECT v.id_venta, v.num_venta, v.estado, v.fecha_de_creacion, v.fecha_pago, v.valor_total, v.recibo,
      concat_ws(' ', u.nombre, u.apellido) AS cajero,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id_pago', p.id_pago, 'id_medio_pago', p.id_medio_pago,
          'medio_de_pago', m.medio_de_pago, 'pago', p.pago
        ) ORDER BY m.medio_de_pago, p.id_pago)
        FROM pagos p JOIN medio_pago m ON m.id_medio = p.id_medio_pago
        WHERE p.id_venta = v.id_venta
      ), '[]'::jsonb) AS pagos
    FROM venta v JOIN users u ON u.id = v.id_vendedor
    WHERE ${where}
    ORDER BY v.fecha_de_creacion DESC, v.num_venta DESC
    LIMIT ${query.pageSize} OFFSET ${(page - 1) * query.pageSize}
  `;
  return { transactions, total, page, pages, pageSize: query.pageSize };
}
