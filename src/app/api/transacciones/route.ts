import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listTransactions, transactionQuerySchema } from "@/lib/transactions";
import { ensureSaleReceipt } from "@/lib/sale-receipt";

export const GET = withAuth(async (request) => {
  const parsed = transactionQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Filtros invalidos." }, { status: 400 });
  try {
    const missingReceipts = await prisma.venta.findMany({
      where: { estado: "completado", recibo: null },
      orderBy: { fecha_pago: "desc" },
      take: 3,
      select: { id_venta: true },
    });
    const receiptAttempts = await Promise.allSettled(
      missingReceipts.map((sale) => ensureSaleReceipt(sale.id_venta)),
    );
    for (const attempt of receiptAttempts) {
      if (attempt.status === "rejected") console.error("No se pudo regenerar un recibo pendiente:", attempt.reason);
    }
    const result = await prisma.$transaction((tx) => listTransactions(tx, parsed.data), { isolationLevel: "RepeatableRead" });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Error consultando transacciones:", error);
    return NextResponse.json({ message: "No se pudieron cargar las transacciones." }, { status: 500 });
  }
});
