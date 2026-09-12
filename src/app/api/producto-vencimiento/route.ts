import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

export const GET = withAuth(async () => {
  try {
    const [productos, groupedLots] = await Promise.all([
      prisma.producto.findMany({
        where: { stock: { gt: 0 } },
        orderBy: { nombre: "asc" },
        select: expiringProductSelect,
      }),
      prisma.instancia_producto.groupBy({
        by: ["id_producto", "fecha_vencimiento"],
        where: {
          productos: {
            stock: { gt: 0 },
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

    return NextResponse.json({
      status: "ok",
      productos: productos.map((producto) => ({
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
