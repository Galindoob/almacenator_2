import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/auth";
import type {
  ProductoUncheckedCreateInput,
  ProductoUncheckedUpdateInput,
} from "@/generated/prisma/models/Producto";

type ProductPayload = {
  id?: string;
  nombre?: string;
  descripcion?: string | null;
  marcaId?: string;
  marcaNombre?: string;
  codigoBarra?: string | null;
  categoriaId?: string;
  unidadId?: string;
  contenido?: number | null;
  unidad_medida?: string | null;
  precioVenta?: number;
  stock?: number;
  fechaVencimiento?: string | Date | null;
  urlImagen?: string | null;
  costo?: number;
};

const productSelect = {
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
  fechaVencimiento: true,
  urlImagen: true,
  costo: true,
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
  unidad_medida_productos_unidad_medidaTounidad_medida: {
    select: {
      nombre: true,
    },
  },
} as const;

function buildProductCreateData(
  product: ProductPayload,
): ProductoUncheckedCreateInput {
  return {
    nombre: product.nombre ?? "",
    descripcion: product.descripcion,
    marcaId: product.marcaId ?? "",
    codigoBarra: product.codigoBarra,
    categoriaId: product.categoriaId ?? "",
    unidadId: product.unidadId ?? "",
    contenido:
      typeof product.contenido === "number"
        ? Math.round(product.contenido)
        : product.contenido,
    unidad_medida: product.unidad_medida,
    precioVenta:
      typeof product.precioVenta === "number"
        ? Math.round(product.precioVenta)
        : 0,
    stock: typeof product.stock === "number" ? Math.round(product.stock) : undefined,
    fechaVencimiento:
      product.fechaVencimiento === undefined
        ? undefined
        : product.fechaVencimiento
          ? new Date(product.fechaVencimiento)
          : null,
    urlImagen: product.urlImagen,
    costo: typeof product.costo === "number" ? Math.round(product.costo) : undefined,
  };
}

function buildProductUpdateData(
  product: ProductPayload,
): ProductoUncheckedUpdateInput {
  return {
    nombre: product.nombre,
    descripcion: product.descripcion,
    marcaId: product.marcaId,
    codigoBarra: product.codigoBarra,
    categoriaId: product.categoriaId,
    unidadId: product.unidadId,
    contenido:
      typeof product.contenido === "number"
        ? Math.round(product.contenido)
        : product.contenido,
    unidad_medida: product.unidad_medida,
    precioVenta:
      typeof product.precioVenta === "number"
        ? Math.round(product.precioVenta)
        : undefined,
    stock: typeof product.stock === "number" ? Math.round(product.stock) : undefined,
    fechaVencimiento:
      product.fechaVencimiento === undefined
        ? undefined
        : product.fechaVencimiento
          ? new Date(product.fechaVencimiento)
          : null,
    urlImagen: product.urlImagen,
    costo: typeof product.costo === "number" ? Math.round(product.costo) : undefined,
  };
}

function isPrismaError(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

export const GET = withAuth(async () => {
  try {
    const [productos, marcas, categorias, unidades, unidadesMedida] =
      await Promise.all([
        prisma.producto.findMany({
          orderBy: { nombre: "asc" },
          select: productSelect,
        }),
        prisma.marca.findMany({
          orderBy: { nombre: "asc" },
          select: { id: true, nombre: true },
        }),
        prisma.categoria.findMany({
          orderBy: { nombreCategoria: "asc" },
          select: { id: true, nombreCategoria: true },
        }),
        prisma.unidad.findMany({
          orderBy: { unidad: "asc" },
          select: { id: true, unidad: true },
        }),
        prisma.unidad_medida.findMany({
          orderBy: { nombre: "asc" },
          select: { id: true, nombre: true },
        }),
      ]);

    return NextResponse.json({
      status: "ok",
      productos,
      opciones: {
        marcas,
        categorias,
        unidades,
        unidadesMedida,
      },
    });
  } catch (error) {
    console.error("Error cargando productos:", error);

    return NextResponse.json(
      { status: "error", message: "No se pudieron cargar los productos." },
      { status: 500 },
    );
  }
});

export const POST = withAuth(async (request) => {
  try {
    const product = (await request.json()) as ProductPayload;
    const marcaNombre = product.marcaNombre?.trim();

    if (
      !product.nombre ||
      (!product.marcaId && !marcaNombre) ||
      !product.categoriaId ||
      !product.unidadId ||
      typeof product.precioVenta !== "number"
    ) {
      return NextResponse.json(
        {
          status: "error",
          message: "Faltan datos obligatorios para crear el producto.",
        },
        { status: 400 },
      );
    }

    if (marcaNombre) {
      const marca = await prisma.marca.upsert({
        where: { nombre: marcaNombre },
        create: { nombre: marcaNombre },
        update: {},
        select: { id: true },
      });
      product.marcaId = marca.id;
    }

    const createdProduct = await prisma.producto.create({
      data: buildProductCreateData(product),
      select: productSelect,
    });

    return NextResponse.json({ status: "ok", producto: createdProduct });
  } catch (error) {
    console.error("Error creando producto:", error);

    if (isPrismaError(error, "P2002")) {
      return NextResponse.json(
        { status: "error", message: "Ya existe un producto con datos únicos repetidos." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { status: "error", message: "No se pudo crear el producto." },
      { status: 500 },
    );
  }
});

export const PUT = withAuth(async (request) => {
  try {
    const product = (await request.json()) as ProductPayload;

    if (!product.id) {
      return NextResponse.json(
        { status: "error", message: "Debe enviar el id del producto." },
        { status: 400 },
      );
    }

    const updatedProduct = await prisma.producto.update({
      where: { id: product.id },
      data: buildProductUpdateData(product),
      select: productSelect,
    });

    return NextResponse.json({ status: "ok", producto: updatedProduct });
  } catch (error) {
    console.error("Error actualizando producto:", error);

    if (isPrismaError(error, "P2025")) {
      return NextResponse.json(
        { status: "error", message: "El producto no existe." },
        { status: 404 },
      );
    }

    if (isPrismaError(error, "P2002")) {
      return NextResponse.json(
        { status: "error", message: "Ya existe un producto con datos únicos repetidos." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { status: "error", message: "No se pudo actualizar el producto." },
      { status: 500 },
    );
  }
});

export const PATCH = PUT;

export const DELETE = withAuth(async (request) => {
  try {
    const { id } = (await request.json()) as { id?: string };

    if (!id) {
      return NextResponse.json(
        { status: "error", message: "Debe enviar el id del producto." },
        { status: 400 },
      );
    }

    await prisma.producto.delete({ where: { id } });

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Error eliminando producto:", error);

    if (isPrismaError(error, "P2025")) {
      return NextResponse.json(
        { status: "error", message: "El producto no existe." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { status: "error", message: "No se pudo eliminar el producto." },
      { status: 500 },
    );
  }
});
