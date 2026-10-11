import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { executeSaleCommand, saleCommandSchema, saleInclude, SaleError } from "@/lib/sales";

export const GET = withAuth(async (request) => {
  const user = await prisma.user.findUnique({ where: { correo: request.correo }, select: { id: true } });
  if (!user) return NextResponse.json({ message: "Usuario no encontrado." }, { status: 401 });
  const ventas = await prisma.venta.findMany({
    where: { id_vendedor: user.id, estado: "pendiente" },
    orderBy: { fecha_de_creacion: "asc" }, include: saleInclude,
  });
  return NextResponse.json({ status: "ok", ventas }, { headers: { "Cache-Control": "no-store" } });
});

export const POST = withAuth(async (request) => {
  try {
    const parsed = saleCommandSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Datos invalidos." }, { status: 400 });
    const user = await prisma.user.findUnique({ where: { correo: request.correo }, select: { id: true } });
    if (!user) return NextResponse.json({ message: "Usuario no encontrado." }, { status: 401 });
    const venta = await prisma.$transaction((tx) => executeSaleCommand(tx, user.id, parsed.data), { timeout: 30000 });
    return NextResponse.json({ status: "ok", venta });
  } catch (error) {
    if (error instanceof SaleError) return NextResponse.json({ message: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return NextResponse.json({ message: "Solicitud invalida." }, { status: 400 });
    console.error("Error procesando venta:", error);
    return NextResponse.json({ message: "No se pudo procesar la venta. Puedes reintentar sin duplicar el cobro." }, { status: 500 });
  }
});
