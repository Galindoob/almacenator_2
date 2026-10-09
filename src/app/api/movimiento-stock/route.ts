import { NextResponse } from "next/server";
import { AuthenticatedRequest, withAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getChileCurrentDate } from "@/lib/chile-time";
import {
  AppInputValidationError,
  assertSafePayloadText,
  unsafeInputMessage,
} from "@/lib/input-validation";

type MovementPayload = {
  producto?: string;
  cantidad?: number;
  stock_restante?: number;
  costo_sin_iva?: number;
  costo_con_iva?: number;
  comentario?: string | null;
  tipo?: number;
  fecha_vencimiento?: string | null;
};

function toRoundedNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : null;
}

function parseExpirationDate(value: unknown) {
  if (typeof value !== "string" || !value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isFutureDate(date: Date, chileToday: string) {
  return date.toISOString().slice(0, 10) > chileToday;
}

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const productId = request.nextUrl.searchParams.get("producto");

  try {
    assertSafePayloadText(productId);
  } catch (error) {
    if (error instanceof AppInputValidationError) {
      return NextResponse.json(
        { status: "error", message: unsafeInputMessage },
        { status: 400 },
      );
    }
  }

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
    assertSafePayloadText(payload);
    const cantidad = toRoundedNumber(payload.cantidad);
    const stockRestante = toRoundedNumber(payload.stock_restante);
    const costoSinIva = toRoundedNumber(payload.costo_sin_iva);
    const costoConIva = toRoundedNumber(payload.costo_con_iva);
    const tipo = toRoundedNumber(payload.tipo);
    const expirationDate = parseExpirationDate(payload.fecha_vencimiento);

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

    let chileToday: string | null = null;
    if (tipo === 2) {
      try {
        chileToday = await getChileCurrentDate();
      } catch {
        return NextResponse.json(
          { status: "error", message: "No se pudo consultar la fecha de Chile. Intenta nuevamente." },
          { status: 503 },
        );
      }
    }

    if (
      tipo === 2 &&
      (!expirationDate || !chileToday || !isFutureDate(expirationDate, chileToday))
    ) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "Debe enviar una fecha de vencimiento futura para el lote.",
        },
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
      if (tipo === 1) {
        const instancesToDelete = await tx.instancia_producto.findMany({
          where: { id_producto: payload.producto },
          orderBy: { fecha_vencimiento: "asc" },
          take: cantidad,
          select: { id_instancia: true },
        });

        if (instancesToDelete.length < cantidad) {
          throw new Error("No hay suficientes instancias para descontar la merma.");
        }

        await tx.instancia_producto.deleteMany({
          where: {
            id_instancia: {
              in: instancesToDelete.map((instance) => instance.id_instancia),
            },
          },
        });
      }

      if (tipo === 2 && expirationDate) {
        await tx.instancia_producto.createMany({
          data: Array.from({ length: cantidad }, () => ({
            id_producto: payload.producto ?? "",
            fecha_vencimiento: expirationDate,
          })),
        });
      }

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

    if (error instanceof AppInputValidationError) {
      return NextResponse.json(
        { status: "error", message: unsafeInputMessage },
        { status: 400 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "No hay suficientes instancias para descontar la merma."
    ) {
      return NextResponse.json(
        { status: "error", message: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { status: "error", message: "No se pudo registrar el movimiento." },
      { status: 500 },
    );
  }
});
