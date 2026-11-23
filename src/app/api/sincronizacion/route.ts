import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { expirePendingSales } from "@/lib/expire-sales";
import { processAutomaticCashClose } from "@/lib/automatic-cash-close";

export const GET = withAuth(async () => {
  try {
    const automaticClose = await processAutomaticCashClose();
    await expirePendingSales();
    const rows = await prisma.$queryRaw<{ revision: string }[]>`SELECT pg_current_snapshot()::text AS revision`;
    return NextResponse.json({ revision: rows[0].revision, cierreAutomaticoPendiente: automaticClose.status === "blocked" ? automaticClose.pendingPaid : 0 }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Error verificando cambios:", error);
    return NextResponse.json({ message: "No se pudieron consultar los cambios." }, { status: 503 });
  }
});
