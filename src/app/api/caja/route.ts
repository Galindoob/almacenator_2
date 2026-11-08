import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const closingSchema = z.object({
  saldo_cierre: z.number().int().nonnegative().max(2147483647),
  comentario: z.string().max(255).refine((value) => !/['"]/.test(value), "El comentario no puede contener comillas.").optional(),
});

const cashInclude = { users: true } as const;
type CashRecord = Prisma.apertura_cajaGetPayload<{ include: typeof cashInclude }>;

function serializeCashRegister(cashRegister: CashRecord) {
  return {
    id_apertura: cashRegister.id_apertura,
    id_usuario_apertura: cashRegister.id_usuario_apertura,
    horario_apertura: cashRegister.horario_apertura,
    horario_cierre: cashRegister.horario_cierre,
    saldo_apertura: cashRegister.saldo_apertura,
    saldo_cierre: cashRegister.saldo_cierre,
    saldo_esperado: cashRegister.saldo_esperado,
    diferencia: cashRegister.diferencia,
    valor_real: cashRegister.valor_real,
    retiro: cashRegister.retiro,
    comentario: cashRegister.comentario,
    venta_debito: cashRegister.venta_debito,
    venta_credito: cashRegister.venta_credito,
    venta_efectivo: cashRegister.venta_efectivo,
    venta_transferencia: cashRegister.venta_transferencia,
    total_debito: cashRegister.total_debito,
    total_credito: cashRegister.total_credito,
    total_efectivo: cashRegister.total_efectivo,
    total_transferencia: cashRegister.total_transferencia,
    total: cashRegister.total,
    usuario: { nombre: cashRegister.users.nombre, apellido: cashRegister.users.apellido },
  };
}

export const GET = withAuth(async (request) => {
  try {
    const user = await prisma.user.findUnique({ where: { correo: request.correo }, select: { id: true } });
    if (!user) return NextResponse.json({ message: "Usuario no encontrado." }, { status: 404 });

    const open = await prisma.apertura_caja.findFirst({ where: { horario_cierre: null }, include: cashInclude, orderBy: { horario_apertura: "desc" } });
    const previous = open ? null : await prisma.apertura_caja.findFirst({ where: { horario_cierre: { not: null } }, orderBy: { horario_cierre: "desc" }, select: { valor_real: true } });
    const ventasPendientes = open ? await prisma.venta.count({ where: { id_apertura_caja: open.id_apertura, estado: "pendiente" } }) : 0;
    const ventasCompletadas = open ? await prisma.venta.count({ where: { id_apertura_caja: open.id_apertura, estado: "completado" } }) : 0;

    return NextResponse.json({
      status: "ok",
      abierta: Boolean(open),
      caja: open ? serializeCashRegister(open) : null,
      puedeCerrar: Boolean(open && open.id_usuario_apertura === user.id),
      ventasPendientes,
      ventasCompletadas,
      saldoDisponible: previous?.valor_real ?? null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Error consultando caja:", error);
    return NextResponse.json({ message: "No se pudo consultar la caja." }, { status: 500 });
  }
});

export const POST = withAuth(async (request) => {
  try {
    const user = await prisma.user.findUnique({ where: { correo: request.correo }, select: { id: true } });
    if (!user) return NextResponse.json({ message: "Usuario no encontrado." }, { status: 404 });

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(79104001)::text AS locked`;
      const open = await tx.apertura_caja.findFirst({ where: { horario_cierre: null }, include: cashInclude });
      if (open) return { status: 409 as const, message: "Ya hay una caja abierta.", caja: serializeCashRegister(open) };

      const previous = await tx.apertura_caja.findFirst({ where: { horario_cierre: { not: null } }, orderBy: { horario_cierre: "desc" }, select: { valor_real: true } });
      if (!previous) return { status: 409 as const, message: "Caja vacía, comunicarse con administración." };

      const created = await tx.apertura_caja.create({
        data: {
          id_usuario_apertura: user.id,
          saldo_apertura: previous.valor_real,
          saldo_esperado: previous.valor_real,
          valor_real: previous.valor_real,
          saldo_cierre: null,
          diferencia: null,
          comentario: null,
          retiro: 0,
        },
        include: cashInclude,
      });
      return { status: 201 as const, caja: serializeCashRegister(created) };
    });

    if (result.status === 409) return NextResponse.json({ status: "error", message: result.message, caja: result.caja }, { status: 409 });
    return NextResponse.json({ status: "ok", caja: result.caja }, { status: 201 });
  } catch (error) {
    console.error("Error abriendo caja:", error);
    return NextResponse.json({ message: "No se pudo abrir la caja." }, { status: 500 });
  }
});

export const PATCH = withAuth(async (request) => {
  const parsed = closingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Datos de cierre inválidos." }, { status: 400 });

  try {
    const user = await prisma.user.findUnique({ where: { correo: request.correo }, select: { id: true } });
    if (!user) return NextResponse.json({ message: "Usuario no encontrado." }, { status: 404 });

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(79104001)::text AS locked`;
      const open = await tx.apertura_caja.findFirst({ where: { horario_cierre: null } });
      if (!open) return { status: 404 as const, message: "No hay una caja abierta." };
      if (open.id_usuario_apertura !== user.id) return { status: 403 as const, message: "Solo quien abrió la caja puede cerrarla." };

      const pending = await tx.venta.count({ where: { id_apertura_caja: open.id_apertura, estado: "pendiente" } });
      if (pending > 0) return { status: 409 as const, message: `Hay ${pending} ${pending === 1 ? "venta pendiente" : "ventas pendientes"}. Termínalas o elimínalas antes de cerrar la caja.` };

      const closingAmount = parsed.data.saldo_cierre;
      const difference = closingAmount - open.saldo_esperado;
      const comment = parsed.data.comentario?.trim() || null;
      const [closed] = await tx.$queryRaw<{ horario_cierre: Date }[]>`
        UPDATE apertura_caja SET
          horario_cierre = NOW(),
          saldo_cierre = ${closingAmount},
          valor_real = ${closingAmount},
          diferencia = ${difference},
          comentario = ${comment}
        WHERE id_apertura = ${open.id_apertura}::uuid AND horario_cierre IS NULL
        RETURNING horario_cierre
      `;
      await tx.historia_caja.create({ data: {
        fecha_registro: closed.horario_cierre,
        diferencia: difference,
        saldo_apertura: open.saldo_apertura,
        saldo_cierre: closingAmount,
      } });
      return { status: 200 as const, horario_cierre: closed.horario_cierre, diferencia: difference };
    });

    if (result.status !== 200) return NextResponse.json({ status: "error", message: result.message }, { status: result.status });
    return NextResponse.json({ status: "ok", horario_cierre: result.horario_cierre, diferencia: result.diferencia });
  } catch (error) {
    console.error("Error cerrando caja:", error);
    return NextResponse.json({ message: "No se pudo cerrar la caja." }, { status: 500 });
  }
});
