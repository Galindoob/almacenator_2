import { NextResponse } from "next/server";
import { AuthenticatedRequest, withAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getChileCurrentDate } from "@/lib/chile-time";
import {
  AppInputValidationError,
  assertSafePayloadText,
  unsafeInputMessage,
} from "@/lib/input-validation";

const expiringProductSelect = {
  id: true,
  nombre: true,
  descripcion: true,
  marcaId: true,
  codigoBarra: true,
  categoriaId: true,
  unidadId: true,
  contenido: true,
  unidad_medida: true,
  precioVenta: true,
  stock: true,
  controlaStock: true,
  urlImagen: true,
  costo: true,
  unidad: {
    select: {
      unidad: true,
    },
  },
  marca: {
    select: {
      nombre: true,
    },
  },
  categoria: {
    select: {
      nombreCategoria: true,
    },
  },
  unidad_medida_productos_unidad_medidaTounidad_medida: {
    select: {
      nombre: true,
    },
  },
} as const;

type DeleteLotPayload = {
  productoId?: string;
  fecha_vencimiento?: string;
};

function parseExpirationDate(value: unknown) {
  if (typeof value !== "string" || !value) {
    return null;
  }

  const isoDate = value.slice(0, 10);
  const date = new Date(`${isoDate}T00:00:00.000Z`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function isExpiredOrToday(date: Date, chileToday: string) {
  return date.toISOString().slice(0, 10) <= chileToday;
}

type ProductWithPackaging = {
  id: string;
  empaque: string | null;
  empaque_productos_empaqueToempaque: { nombre_empaque: string } | null;
};

async function attachPackagingToProducts<T extends { id: string }>(
  products: T[],
) {
  if (products.length === 0) {
    return [] as (T & ProductWithPackaging)[];
  }

  const productIds = products.map((product) => product.id);
  const rows = await prisma.$queryRaw<
    {
      id: string;
      empaque: string | null;
      nombre_empaque: string | null;
    }[]
  >`
    SELECT
      p.id_productos::text AS id,
      p.empaque::text AS empaque,
      e.nombre_empaque
    FROM productos p
    LEFT JOIN empaque e ON e.id_empaque = p.empaque
    WHERE p.id_productos = ANY(${productIds}::uuid[])
  `;
  const packagingByProduct = new Map(rows.map((row) => [row.id, row]));

  return products.map((product) => {
    const packaging = packagingByProduct.get(product.id);

    return {
      ...product,
      empaque: packaging?.empaque ?? null,
      empaque_productos_empaqueToempaque: packaging?.nombre_empaque
        ? { nombre_empaque: packaging.nombre_empaque }
        : null,
    };
  });
}

export const GET = withAuth(async () => {
  try {
    const [productos, groupedLots] = await Promise.all([
      prisma.producto.findMany({
        where: { stock: { gt: 0 }, controlaStock: true },
        orderBy: { nombre: "asc" },
        select: expiringProductSelect,
      }),
      prisma.instancia_producto.groupBy({
        by: ["id_producto", "fecha_vencimiento"],
        where: {
          productos: {
            stock: { gt: 0 },
            controlaStock: true,
          },
        },
        _count: {
          id_instancia: true,
        },
        orderBy: [{ id_producto: "asc" }, { fecha_vencimiento: "asc" }],
      }),
    ]);

    const lotsByProduct = new Map<
      string,
      { fecha_vencimiento: Date; cantidad: number }[]
    >();

    for (const lot of groupedLots) {
      const currentLots = lotsByProduct.get(lot.id_producto) ?? [];
      currentLots.push({
        fecha_vencimiento: lot.fecha_vencimiento,
        cantidad: lot._count.id_instancia,
      });
      lotsByProduct.set(lot.id_producto, currentLots);
    }

    const productsWithPackaging = await attachPackagingToProducts(productos);

    return NextResponse.json({
      status: "ok",
      productos: productsWithPackaging.map((producto) => ({
        ...producto,
        lotes: lotsByProduct.get(producto.id) ?? [],
      })),
    });
  } catch (error) {
    console.error("Error cargando productos por vencer:", error);

    return NextResponse.json(
      { status: "error", message: "No se pudieron cargar los productos por vencer." },
      { status: 500 },
    );
  }
});

export const DELETE = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const payload = (await request.json()) as DeleteLotPayload;
    assertSafePayloadText(payload);
    const expirationDate = parseExpirationDate(payload.fecha_vencimiento);

    if (!payload.productoId || !expirationDate) {
      return NextResponse.json(
        { status: "error", message: "Debe enviar el producto y la fecha del lote." },
        { status: 400 },
      );
    }

    let chileToday: string;
    try {
      chileToday = await getChileCurrentDate();
    } catch {
      return NextResponse.json(
        { status: "error", message: "No se pudo consultar la fecha de Chile. Intenta nuevamente." },
        { status: 503 },
      );
    }

    if (!isExpiredOrToday(expirationDate, chileToday)) {
      return NextResponse.json(
        {
          status: "error",
          message: "Solo se pueden eliminar lotes vencidos o que vencen hoy.",
        },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const [producto, lotCount] = await Promise.all([
        tx.producto.findUnique({
          where: { id: payload.productoId },
          select: { id: true, stock: true, controlaStock: true },
        }),
        tx.instancia_producto.count({
          where: {
            id_producto: payload.productoId,
            fecha_vencimiento: expirationDate,
          },
        }),
      ]);

      if (!producto) {
        throw new Error("PRODUCT_NOT_FOUND");
      }

      if (!producto.controlaStock) {
        throw new Error("STOCK_NOT_TRACKED");
      }

      if (lotCount < 1) {
        throw new Error("LOT_NOT_FOUND");
      }

      await tx.instancia_producto.deleteMany({
        where: {
          id_producto: payload.productoId,
          fecha_vencimiento: expirationDate,
        },
      });

      const updatedProduct = await tx.producto.update({
        where: { id: payload.productoId },
        data: {
          stock: Math.max(0, producto.stock - lotCount),
        },
        select: {
          id: true,
          stock: true,
        },
      });

      return { producto: updatedProduct, deletedCount: lotCount };
    });

    return NextResponse.json({
      status: "ok",
      producto: result.producto,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error eliminando lote vencido:", error);

    if (error instanceof AppInputValidationError) {
      return NextResponse.json(
        { status: "error", message: unsafeInputMessage },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
      return NextResponse.json(
        { status: "error", message: "Producto no encontrado." },
        { status: 404 },
      );
    }

    if (error instanceof Error && error.message === "STOCK_NOT_TRACKED") {
      return NextResponse.json(
        { status: "error", message: "Este producto no controla stock." },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message === "LOT_NOT_FOUND") {
      return NextResponse.json(
        { status: "error", message: "No se encontró el lote seleccionado." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { status: "error", message: "No se pudo eliminar el lote." },
      { status: 500 },
    );
  }
});
