import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/auth";

export const GET = withAuth(async () => {
  try {
    const productos = await prisma.producto.findMany({
      orderBy: { nombre: "asc" },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        stock: true,
        costo: true,
        precioVenta: true,
        urlImagen: true,
        unidad: {
          select: {
            unidad: true,
          },
        },
        categoria: {
          select: {
            nombreCategoria: true,
          },
        },
      },
    });

    return NextResponse.json({ status: "ok", productos });
  } catch (error) {
    console.error("Error cargando productos:", error);

    return NextResponse.json(
      { status: "error", message: "No se pudieron cargar los productos." },
      { status: 500 },
    );
  }
});
