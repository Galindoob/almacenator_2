import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUserPermissions } from "@/lib/permissions";

const schema = z.object({ id: z.uuid(), codigo: z.string().regex(/^\d{4,30}$/, "El código debe tener entre 4 y 30 dígitos.").or(z.literal("")) });
export const PUT = withAuth(async (request) => {
  const access = await getUserPermissions(request.correo);
  if (!access?.has("productos_editar")) return NextResponse.json({ message: "No tienes permiso para editar productos." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "El código debe tener entre 4 y 30 dígitos, o estar vacío." }, { status: 400 });
  try {
    if (parsed.data.codigo) {
      const duplicate = await prisma.producto.findFirst({ where: { id: { not: parsed.data.id }, OR: [{ codigoInterno: parsed.data.codigo }, { codigoBarra: parsed.data.codigo }] }, select: { id: true } });
      if (duplicate) return NextResponse.json({ message: "Este código ya pertenece a otro producto." }, { status: 409 });
    }
    const updated = await prisma.producto.updateMany({ where: { id: parsed.data.id, OR: [{ codigoBarra: null }, { codigoBarra: "" }] }, data: { codigoInterno: parsed.data.codigo || null } });
    if (!updated.count) return NextResponse.json({ message: "El producto no existe o ya tiene un código de barras." }, { status: 409 });
    const product = await prisma.producto.findUnique({ where: { id: parsed.data.id }, select: { id: true, codigoInterno: true } });
    return NextResponse.json({ producto: product });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return NextResponse.json({ message: "Este código ya pertenece a otro producto." }, { status: 409 });
    console.error("Error guardando código interno:", error);
    return NextResponse.json({ message: "No se pudo guardar el código. Comprueba que no esté en uso." }, { status: 500 });
  }
});
