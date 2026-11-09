import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const movementSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("ingreso"),
    key: z.uuid(),
    movimiento: z.number().int().positive().max(2147483647),
    comentario: z.string().max(255).refine((value) => !/['"]/.test(value), "El comentario no puede contener comillas."),
  }),
  z.object({
    tipo: z.literal("egreso"),
    key: z.uuid(),
    movimiento: z.number().int().positive().max(2147483647),
    id_razon: z.uuid(),
    comentario: z.string().max(255).refine((value) => !/['"]/.test(value), "El comentario no puede contener comillas."),
  }),
]);

export const GET = withAuth(async (request) => {
  try {
    const [user, open, reasons] = await Promise.all([
      prisma.user.findUnique({ where: { correo: request.correo }, select: { id: true } }),
      prisma.apertura_caja.findFirst({ where: { horario_cierre: null }, select: { id_apertura: true } }),
      prisma.razon_movimiento.findMany({ orderBy: { razon: "asc" }, select: { id_razon: true, razon: true } }),
    ]);
    if (!user) return NextResponse.json({ message: "Usuario no encontrado." }, { status: 401 });
    return NextResponse.json({ abierta: Boolean(open), razones: reasons }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Error consultando movimientos de caja:", error);
    return NextResponse.json({ message: "No se pudo consultar la caja." }, { status: 500 });
  }
});

export const POST = withAuth(async (request) => {
  const parsed = movementSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });

  try {
    const user = await prisma.user.findUnique({ where: { correo: request.correo }, select: { id: true } });
    if (!user) return NextResponse.json({ message: "Usuario no encontrado." }, { status: 401 });
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(79104001)::text AS locked`;
      const replay = await tx.movimiento_caja.findUnique({ where: { id_movimiento: parsed.data.key } });
      if (replay) {
        const sameMovement = replay.tipo === parsed.data.tipo && replay.movimiento === parsed.data.movimiento &&
          (replay.comentario ?? "") === parsed.data.comentario.trim() &&
          replay.id_razon === (parsed.data.tipo === "egreso" ? parsed.data.id_razon : null);
        if (!sameMovement) return { status: 409 as const, message: "Esta operación ya se registró con otros datos." };
        return { status: 201 as const, movement: replay };
      }
      const open = await tx.apertura_caja.findFirst({ where: { horario_cierre: null } });
      if (!open) return { status: 409 as const, message: "Abre una caja antes de registrar movimientos." };

      const { tipo, movimiento } = parsed.data;
      const reason = tipo === "egreso"
        ? await tx.razon_movimiento.findUnique({ where: { id_razon: parsed.data.id_razon } })
        : null;
      if (tipo === "egreso" && !reason) return { status: 400 as const, message: "Selecciona un tipo de egreso válido." };

      const delta = tipo === "ingreso" ? movimiento : -movimiento;
      const nextExpected = open.saldo_esperado + delta;
      if (nextExpected < 0) {
        return { status: 409 as const, message: "El egreso supera el efectivo disponible en caja." };
      }
      if (nextExpected > 2147483647) {
        return { status: 400 as const, message: "El monto supera el límite permitido." };
      }

      const movement = await tx.movimiento_caja.create({ data: {
        id_movimiento: parsed.data.key,
        id_apertura_caja: open.id_apertura,
        tipo,
        movimiento,
        id_razon: reason?.id_razon ?? null,
        comentario: parsed.data.comentario.trim() || null,
      } });
      const cashRegister = await tx.apertura_caja.update({
        where: { id_apertura: open.id_apertura },
        data: {
          saldo_esperado: nextExpected,
        },
        select: { saldo_esperado: true, valor_real: true },
      });
      return { status: 201 as const, movement, cashRegister };
    });

    if (result.status !== 201) return NextResponse.json({ message: result.message }, { status: result.status });
    return NextResponse.json({ status: "ok", movimiento: result.movement }, { status: 201 });
  } catch (error) {
    console.error("Error registrando movimiento de caja:", error);
    return NextResponse.json({ message: "No se pudo registrar el movimiento de caja." }, { status: 500 });
  }
});
