import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getInstantReport, reportQuerySchema } from "@/lib/reports";

export const GET = withAuth(async (request) => {
  const parsed = reportQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Filtros inválidos." },
      { status: 400 },
    );
  }

  try {
    const report = await prisma.$transaction(
      (tx) => getInstantReport(tx, parsed.data),
      { isolationLevel: "RepeatableRead" },
    );
    return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Error generando reporte instantáneo:", error);
    return NextResponse.json({ message: "No se pudo generar el reporte." }, { status: 500 });
  }
});
