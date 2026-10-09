import { NextResponse } from "next/server";
import { getChileCurrentDate } from "@/lib/chile-time";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(
      { status: "ok", fecha: await getChileCurrentDate() },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch {
    return NextResponse.json(
      { status: "error", message: "No se pudo consultar la fecha de Chile." },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
