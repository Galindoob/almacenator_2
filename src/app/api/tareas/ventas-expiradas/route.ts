import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { expirePendingSales } from "@/lib/expire-sales";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization") ?? "";
  const expected = secret ? `Bearer ${secret}` : "";
  const a = Buffer.from(supplied); const b = Buffer.from(expected);
  if (!secret || a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  try { return NextResponse.json({ eliminadas: await expirePendingSales() }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { console.error("Error expirando ventas:", error); return NextResponse.json({ message: "No se pudieron procesar las ventas." }, { status: 500 }); }
}
