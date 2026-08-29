import { NextResponse } from "next/server";
import { AuthenticatedRequest, withAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

type MovementPayload = {
  producto?: string;
  cantidad?: number;
  stock_restante?: number;
  costo_sin_iva?: number;
  costo_con_iva?: number;
  comentario?: string | null;
  tipo?: number;
};

function toRoundedNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : null;
}

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const productId = request.nextUrl.searchParams.get("producto");

  if (!productId) {
    return NextResponse.json(
      { status: "error", message: "Debe enviar el producto." },
      { status: 400 },
    );
  }

  try {
    const movements = await prisma.movimiento_de_stock.findMany({
      where: { producto: productId },
      orderBy: { fecha: "desc" },
      select: {
        id: true,
        fecha: true,
        costo_sin_iva: true,
        costo_con_iva: true,
        cantidad: true,
        stock_restante: true,
        comentario: true,
        tipo: true,
        users: {
          select: {
            nombre: true,
            apellido: true,
          },
        },
      },
    });

    return NextResponse.json({ status: "ok", movimientos: movements });
  } catch (error) {
    console.error("Error cargando movimientos de stock:", error);

    return NextResponse.json(
      { status: "error", message: "No se pudieron cargar los movimientos." },
      { status: 500 },
    );
  }
});

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const payload = (await request.json()) as MovementPayload;
    const cantidad = toRoundedNumber(payload.cantidad);
    const stockRestante = toRoundedNumber(payload.stock_restante);
    const costoSinIva = toRoundedNumber(payload.costo_sin_iva);
    const costoConIva = toRoundedNumber(payload.costo_con_iva);
    const tipo = toRoundedNumber(payload.tipo);

    if (
      !payload.producto ||
      cantidad === null ||
      cantidad < 1 ||
      stockRestante === null ||
      stockRestante < 0 ||
      costoSinIva === null ||
      costoConIva === null ||
      tipo === null ||
      ![1, 2, 3].includes(tipo)
    ) {
      return NextResponse.json(
        { status: "error", message: "Datos de movimiento inválidos." },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { correo: request.correo },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { status: "error", message: "Usuario no encontrado." },
        { status: 404 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const movement = await tx.movimiento_de_stock.create({
        data: {
          fecha: new Date(),
          costo_sin_iva: costoSinIva,
          costo_con_iva: costoConIva,
          cantidad,
          stock_restante: stockRestante,
          usuario: user.id,
          producto: payload.producto ?? "",
          comentario: payload.comentario?.trim() || null,
          tipo,
        },
        select: {
          id: true,
          fecha: true,
          costo_sin_iva: true,
          costo_con_iva: true,
          cantidad: true,
          stock_restante: true,
          comentario: true,
          tipo: true,
          users: {
            select: {
              nombre: true,
              apellido: true,
            },
          },
        },
      });

      const producto = await tx.producto.update({
        where: { id: payload.producto },
        data: { stock: stockRestante },
        select: {
          id: true,
          stock: true,
        },
      });

      return { movement, producto };
    });

    return NextResponse.json({
      status: "ok",
      movimiento: result.movement,
      producto: result.producto,
    });
  } catch (error) {
    console.error("Error registrando movimiento de stock:", error);

    return NextResponse.json(
      { status: "error", message: "No se pudo registrar el movimiento." },
      { status: 500 },
    );
  }
});
