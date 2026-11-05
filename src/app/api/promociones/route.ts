import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isSafeAppInput, isSafeDescriptionInput } from "@/lib/input-validation";
import { Prisma } from "@/generated/prisma/client";

const schema = z.object({
  tipo: z.enum(["descuento", "yapa", "combo"]),
  nombre: z.string().trim().min(1).refine(isSafeAppInput, "El nombre no puede incluir comillas ni superar 60 caracteres."),
  descripcion: z.string().trim().refine(isSafeDescriptionInput, "La descripción no puede incluir comillas ni superar 200 caracteres.").default(""),
  productos: z.array(z.uuid()).min(1).max(200),
  descuento: z.number().min(0.01).max(100).optional(),
  cantidadLlevar: z.number().int().min(1).max(100000).optional(),
  cantidadRegalo: z.number().int().min(1).max(100000).optional(),
  combo: z.number().int().min(1).max(100000).optional(),
  precioCombo: z.number().int().min(1).max(2147483647).optional(),
}).superRefine((value, context) => {
  if (value.tipo === "descuento" && value.descuento === undefined) context.addIssue({ code: "custom", path: ["descuento"], message: "Ingresa un descuento entre 0 y 100." });
  if (value.tipo === "yapa" && (!value.cantidadLlevar || !value.cantidadRegalo)) context.addIssue({ code: "custom", message: "Ingresa las cantidades de compra y regalo." });
  if (value.tipo === "combo" && (!value.combo || value.precioCombo === undefined)) context.addIssue({ code: "custom", message: "Ingresa la cantidad y el precio del combo." });
  if (value.tipo === "combo" && value.productos.length !== 1) context.addIssue({ code: "custom", path: ["productos"], message: "El combo debe incluir un solo producto." });
});

const include = { producto: { select: {
  id: true, nombre: true, codigoBarra: true, costo: true, precioVenta: true, urlImagen: true,
  marca: { select: { nombre: true } },
} }, tipo_promocion: { select: { tipo: true } } };

export const GET = withAuth(async (request) => {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (id !== null) {
      const parsedId = z.uuid().safeParse(id);
      if (!parsedId.success) return NextResponse.json({ message: "ID de promoción inválida." }, { status: 400 });
      const promocion = await prisma.promociones.findUnique({ where: { id_promocion: parsedId.data }, include });
      if (!promocion) return NextResponse.json({ message: "Promoción no encontrada." }, { status: 404 });
      return NextResponse.json({ promocion }, { headers: { "Cache-Control": "no-store" } });
    }
    const [promociones, tipos] = await Promise.all([
      prisma.promociones.findMany({ include, orderBy: [{ nombre_promocion: "asc" }, { producto: { nombre: "asc" } }] }),
      prisma.tipo_promocion.findMany({ select: { id_tipo_promocion: true, tipo: true }, orderBy: { tipo: "asc" } }),
    ]);
    return NextResponse.json({ promociones, tipos }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Error consultando promociones:", error);
    return NextResponse.json({ message: "No se pudieron cargar las promociones." }, { status: 500 });
  }
});

export const PUT = withAuth(async (request) => {
  try {
    const body: unknown = await request.json();
    const parsedId = z.object({ id: z.uuid() }).safeParse(body);
    const parsed = schema.safeParse(body);
    if (!parsedId.success || !parsed.success) {
      return NextResponse.json({ message: !parsed.success ? parsed.error.issues[0]?.message : "ID de promoción inválida." }, { status: 400 });
    }
    const data = parsed.data;
    if (data.productos.length !== 1) return NextResponse.json({ message: "Selecciona un solo producto para editar esta promoción." }, { status: 400 });
    const type = await prisma.tipo_promocion.findUnique({ where: { tipo: data.tipo } });
    if (!type) return NextResponse.json({ message: "Tipo de promoción no disponible." }, { status: 400 });
    const product = await prisma.producto.findUnique({ where: { id: data.productos[0] }, select: { precioVenta: true } });
    if (!product) return NextResponse.json({ message: "Producto no encontrado." }, { status: 404 });
    if (data.tipo === "combo" && data.precioCombo! > product.precioVenta * data.combo!) {
      return NextResponse.json({ message: "El precio del combo no puede superar el precio normal de las unidades." }, { status: 400 });
    }
    const existing = await prisma.promociones.findUnique({ where: { id_promocion: parsedId.data.id }, select: { id_promocion: true } });
    if (!existing) return NextResponse.json({ message: "Promoción no encontrada." }, { status: 404 });
    const otherPromotion = await prisma.promociones.findFirst({
      where: { id_productos: data.productos[0], id_promocion: { not: parsedId.data.id } },
      select: { id_promocion: true },
    });
    if (otherPromotion) return NextResponse.json({ message: "Este producto ya tiene una promoción." }, { status: 409 });
    const promocion = await prisma.promociones.update({
      where: { id_promocion: parsedId.data.id },
      data: {
        id_tipo_promocion: type.id_tipo_promocion,
        nombre_promocion: data.nombre,
        descripcion: data.descripcion,
        id_productos: data.productos[0],
        descuento: data.tipo === "descuento" ? data.descuento : null,
        cantidad_llevar: data.tipo === "yapa" ? data.cantidadLlevar : null,
        cantidad_regalo: data.tipo === "yapa" ? data.cantidadRegalo : null,
        combo: data.tipo === "combo" ? data.combo : null,
        precio_combo: data.tipo === "combo" ? data.precioCombo : null,
      },
      include,
    });
    return NextResponse.json({ promocion }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ message: "Este producto ya tiene una promoción." }, { status: 409 });
    }
    console.error("Error editando promoción:", error);
    return NextResponse.json({ message: "No se pudo editar la promoción." }, { status: 500 });
  }
});

export const POST = withAuth(async (request) => {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Datos de promoción inválidos." }, { status: 400 });
    const data = parsed.data;
    const productIds = [...new Set(data.productos)];
    const type = await prisma.tipo_promocion.findUnique({ where: { tipo: data.tipo } });
    if (!type) return NextResponse.json({ message: "Tipo de promoción no disponible." }, { status: 400 });
    const products = await prisma.producto.findMany({ where: { id: { in: productIds } }, select: { id: true, precioVenta: true } });
    if (products.length !== productIds.length) return NextResponse.json({ message: "Uno o más productos ya no están disponibles." }, { status: 400 });
    const existingPromotion = await prisma.promociones.findFirst({
      where: { id_productos: { in: productIds } }, select: { id_promocion: true },
    });
    if (existingPromotion) return NextResponse.json({ message: "Uno de los productos seleccionados ya tiene una promoción." }, { status: 409 });
    if (data.tipo === "combo" && products.some((product) => data.precioCombo! > product.precioVenta * data.combo!)) {
      return NextResponse.json({ message: "El precio del combo no puede superar el precio normal de las unidades." }, { status: 400 });
    }
    const created = await prisma.$transaction(productIds.map((id) => prisma.promociones.create({
      data: {
        id_tipo_promocion: type.id_tipo_promocion,
        nombre_promocion: data.nombre,
        descripcion: data.descripcion,
        id_productos: id,
        descuento: data.tipo === "descuento" ? data.descuento : null,
        cantidad_llevar: data.tipo === "yapa" ? data.cantidadLlevar : null,
        cantidad_regalo: data.tipo === "yapa" ? data.cantidadRegalo : null,
        combo: data.tipo === "combo" ? data.combo : null,
        precio_combo: data.tipo === "combo" ? data.precioCombo : null,
      }, include,
    })));
    return NextResponse.json({ promociones: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ message: "Uno de los productos seleccionados ya tiene una promoción." }, { status: 409 });
    }
    console.error("Error creando promoción:", error);
    return NextResponse.json({ message: "No se pudo crear la promoción." }, { status: 500 });
  }
});

export const DELETE = withAuth(async (request) => {
  const parsed = z.object({ id: z.uuid() }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Promoción inválida." }, { status: 400 });
  try {
    await prisma.promociones.delete({ where: { id_promocion: parsed.data.id } });
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Error eliminando promoción:", error);
    return NextResponse.json({ message: "No se pudo eliminar la promoción." }, { status: 500 });
  }
});
