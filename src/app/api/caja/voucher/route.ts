import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const previewSchema = z.object({
  enCaja: z.number().int().nonnegative().max(2147483647),
  comentario: z.string().max(255).refine((value) => !/['"]/.test(value), "El comentario no puede contener comillas."),
});

export const POST = withAuth(async (request) => {
  const parsed = previewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });

  try {
    const user = await prisma.user.findUnique({ where: { correo: request.correo }, select: { id: true, nombre: true, apellido: true } });
    if (!user) return NextResponse.json({ message: "Usuario no encontrado." }, { status: 404 });

    const cashRegister = await prisma.apertura_caja.findFirst({
      where: { horario_cierre: null },
      include: {
        users: { select: { nombre: true, apellido: true } },
        movimientos: { orderBy: { fecha_movimiento: "asc" }, include: { razon_detalle: true } },
      },
    });
    if (!cashRegister) return NextResponse.json({ message: "No hay una caja abierta." }, { status: 404 });
    if (cashRegister.id_usuario_apertura !== user.id) {
      return NextResponse.json({ message: "Solo quien abrió la caja puede ver el cierre." }, { status: 403 });
    }

    const [company, totalVentas, clock] = await Promise.all([
      prisma.empresa.findFirst({ select: { nombreFantasia: true, rut: true } }),
      prisma.venta.count({ where: { id_apertura_caja: cashRegister.id_apertura, estado: "completado" } }),
      prisma.$queryRaw<{ ahora: Date }[]>`SELECT NOW() AS ahora`,
    ]);

    return NextResponse.json({
      titulo: "Comprobante cierre de caja",
      tienda: company?.nombreFantasia ?? "Mini Gest",
      rut: company?.rut ?? "",
      fechaApertura: cashRegister.horario_apertura,
      fechaCierre: clock[0].ahora,
      responsable: `${cashRegister.users.nombre} ${cashRegister.users.apellido}`,
      firmante: `${user.nombre} ${user.apellido}`,
      ventas: {
        efectivo: cashRegister.venta_efectivo,
        debito: cashRegister.venta_debito,
        credito: cashRegister.venta_credito,
        transferencia: cashRegister.venta_transferencia,
        total: totalVentas,
      },
      montos: {
        apertura: cashRegister.saldo_apertura,
        efectivo: cashRegister.total_efectivo,
        debito: cashRegister.total_debito,
        credito: cashRegister.total_credito,
        transferencia: cashRegister.total_transferencia,
        totalVentas: cashRegister.total,
        esperado: cashRegister.saldo_esperado,
        enCaja: parsed.data.enCaja,
        diferencia: parsed.data.enCaja - cashRegister.saldo_esperado,
      },
      movimientos: cashRegister.movimientos.map((movement) => ({
        id: movement.id_movimiento,
        fecha: movement.fecha_movimiento,
        tipo: movement.tipo,
        razon: movement.razon_detalle?.razon ?? null,
        comentario: movement.comentario,
        monto: movement.movimiento,
      })),
      comentario: parsed.data.comentario.trim() || null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Error generando vista previa del cierre:", error);
    return NextResponse.json({ message: "No se pudo generar el detalle del cierre." }, { status: 500 });
  }
});
