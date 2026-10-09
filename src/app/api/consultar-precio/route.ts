import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  AppInputValidationError,
  assertSafeAppInput,
  unsafeInputMessage,
} from "@/lib/input-validation";

export const GET = withAuth(async (request) => {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (!query) {
    return NextResponse.json({ status: "ok", productos: [] });
  }

  try {
    assertSafeAppInput(query);

    const productos = await prisma.producto.findMany({
      where: {
        OR: [
          { nombre: { contains: query, mode: "insensitive" } },
          { codigoBarra: { equals: query } },
          { codigoBarra: { contains: query } },
        ],
      },
      orderBy: { nombre: "asc" },
      take: 20,
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        codigoBarra: true,
        precioVenta: true,
        urlImagen: true,
        contenido: true,
        marca: { select: { nombre: true } },
        categoria: { select: { nombreCategoria: true } },
        empaque_productos_empaqueToempaque: {
          select: { nombre_empaque: true },
        },
        unidad_medida_productos_unidad_medidaTounidad_medida: {
          select: { nombre: true },
        },
      },
    });

    productos.sort((first, second) => {
      const firstExactBarcode = first.codigoBarra === query;
      const secondExactBarcode = second.codigoBarra === query;
      if (firstExactBarcode !== secondExactBarcode) return firstExactBarcode ? -1 : 1;
      const firstExactName = first.nombre.toLocaleLowerCase("es-CL") === query.toLocaleLowerCase("es-CL");
      const secondExactName = second.nombre.toLocaleLowerCase("es-CL") === query.toLocaleLowerCase("es-CL");
      if (firstExactName !== secondExactName) return firstExactName ? -1 : 1;
      return first.nombre.localeCompare(second.nombre, "es-CL");
    });

    return NextResponse.json({ status: "ok", productos });
  } catch (error) {
    if (error instanceof AppInputValidationError) {
      return NextResponse.json(
        { status: "error", message: unsafeInputMessage },
        { status: 400 },
      );
    }

    console.error("Error consultando precio de productos:", error);
    return NextResponse.json(
      { status: "error", message: "No se pudieron consultar los precios." },
      { status: 500 },
    );
  }
});
