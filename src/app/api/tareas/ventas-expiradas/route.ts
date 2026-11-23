import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { expirePendingSales } from "@/lib/expire-sales";
import { processAutomaticCashClose } from "@/lib/automatic-cash-close";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization") ?? "";
  const expected = secret ? `Bearer ${secret}` : "";
  const a = Buffer.from(supplied); const b = Buffer.from(expected);
  if (!secret || a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  try {
    const cierreCaja = await processAutomaticCashClose();
    const eliminadas = await expirePendingSales();
    return NextResponse.json({ eliminadas, cierreCaja }, { headers: { "Cache-Control": "no-store" } });
  }
  catch (error) { console.error("Error procesando tareas:", error); return NextResponse.json({ message: "No se pudieron procesar las tareas." }, { status: 500 }); }
}
