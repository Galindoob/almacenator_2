import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({ id: z.uuid(), tipo: z.enum(["ingreso", "egreso"]), monto: z.number().int().positive().max(2147483647) });

export const GET = withAuth(async (request) => {
  try {
    const [actor, cajas, ventas, movimientos] = await Promise.all([
      prisma.user.findUnique({ where: { correo: request.correo }, include: { role: true } }),
      prisma.apertura_caja.findMany({ orderBy: { horario_apertura: "desc" }, include: { users: { select: { nombre: true, apellido: true } } } }),
      prisma.venta.groupBy({ by: ["id_vendedor"], where: { estado: "completado" }, _count: { _all: true }, _sum: { valor_total: true } }),
      prisma.capital_caja.findMany({ orderBy: { fecha: "desc" }, include: { usuario: { select: { nombre: true, apellido: true } } } }),
    ]);
    if (!actor) return NextResponse.json({ message: "Usuario no encontrado." }, { status: 401 });
    const vendedores = await prisma.user.findMany({ where: { id: { in: ventas.map((v) => v.id_vendedor) } }, select: { id: true, nombre: true, apellido: true } });
    const ranking = ventas.map((v) => ({ nombre: (() => { const u = vendedores.find((x) => x.id === v.id_vendedor); return u ? `${u.nombre} ${u.apellido}` : "Usuario"; })(), cantidad: v._count._all, monto: v._sum.valor_total ?? 0 }));
    return NextResponse.json({ cajas, movimientos, abierta: cajas.some((c) => c.horario_cierre === null), puedeEditar: true, ranking }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Error consultando finanzas:", error);
    return NextResponse.json({ message: "No se pudieron cargar las finanzas." }, { status: 500 });
  }
});

export const POST = withAuth(async (request) => {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Ingresa un monto válido." }, { status: 400 });
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(79104001)::text AS locked`;
      const actor = await tx.user.findUnique({ where: { correo: request.correo }, include: { role: true } });
      if (!actor) return { status: 401, message: "Usuario no encontrado." };
      const previous = await tx.capital_caja.findUnique({ where: { id: parsed.data.id } });
      if (previous) return previous.id_usuario === actor.id && previous.tipo === parsed.data.tipo && previous.monto === parsed.data.monto
        ? { status: 200, message: "Movimiento registrado." }
        : { status: 409, message: "Esta operación ya fue utilizada." };
      const open = await tx.apertura_caja.findFirst({ where: { horario_cierre: null }, select: { id_apertura: true } });
      if (open) return { status: 409, message: "Debes cerrar la caja antes de modificar el capital." };
      const latest = await tx.apertura_caja.findFirst({ orderBy: { horario_apertura: "desc" } });
      if (!latest || !latest.horario_cierre) return { status: 409, message: "No hay una caja cerrada para registrar el movimiento." };
      const value = latest.valor_real + (parsed.data.tipo === "ingreso" ? parsed.data.monto : -parsed.data.monto);
      if (value < 0 || value > 2147483647) return { status: 400, message: "El monto excede el saldo disponible o el límite permitido." };
      await tx.apertura_caja.update({ where: { id_apertura: latest.id_apertura }, data: { valor_real: value } });
      await tx.capital_caja.create({ data: { id: parsed.data.id, id_apertura_caja: latest.id_apertura, id_usuario: actor.id, tipo: parsed.data.tipo, monto: parsed.data.monto } });
      return { status: 200, message: "Movimiento registrado." };
    });
    return NextResponse.json({ message: result.message }, { status: result.status });
  } catch (error) {
    console.error("Error registrando capital:", error);
    return NextResponse.json({ message: "No se pudo registrar el movimiento." }, { status: 500 });
  }
});
