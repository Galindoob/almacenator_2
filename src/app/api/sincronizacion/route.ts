import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { expirePendingSales } from "@/lib/expire-sales";

export const GET = withAuth(async () => {
  try {
    await expirePendingSales();
    const rows = await prisma.$queryRaw<{ revision: string }[]>`SELECT pg_current_snapshot()::text AS revision`;
    return NextResponse.json({ revision: rows[0].revision }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Error verificando cambios:", error);
    return NextResponse.json({ message: "No se pudieron consultar los cambios." }, { status: 503 });
  }
});
