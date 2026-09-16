import { NextResponse } from "next/server";
import { AuthenticatedRequest, withAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

type UserRow = {
  id: string;
  nombre: string;
  apellido: string;
};

type CashRegisterRow = {
  id_apertura: string;
  id_usuario_apertura: string;
  horario_apertura: Date;
  horario_cierre: Date | null;
  saldo_apertura: number;
  saldo_cierre: number | null;
  diferencia: number | null;
  saldo_esperado: number;
  total_debito: number;
  total_credito: number;
  total_transferencia: number;
  usuario_nombre: string;
  usuario_apellido: string;
};

function toPositiveAmount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : null;
}

async function getAuthenticatedUser(correo: string) {
  const [user] = await prisma.$queryRaw<UserRow[]>`
    SELECT id::text, nombre, apellido
    FROM users
    WHERE correo = ${correo}
    LIMIT 1
  `;

  return user ?? null;
}

async function getOpenCashRegister(userId: string) {
  const [cashRegister] = await prisma.$queryRaw<CashRegisterRow[]>`
    SELECT
      a.id_apertura::text,
      a.id_usuario_apertura::text,
      a.horario_apertura,
      a.horario_cierre,
      a.saldo_apertura,
      a.saldo_cierre,
      a.diferencia,
      a.saldo_esperado,
      a.total_debito,
      a.total_credito,
      a.total_transferencia,
      u.nombre AS usuario_nombre,
      u.apellido AS usuario_apellido
    FROM apertura_caja a
    JOIN users u ON u.id = a.id_usuario_apertura
    WHERE a.id_usuario_apertura = ${userId}::uuid
      AND a.horario_cierre IS NULL
    ORDER BY a.horario_apertura DESC
    LIMIT 1
  `;

  return cashRegister ?? null;
}

function serializeCashRegister(cashRegister: CashRegisterRow | null) {
  if (!cashRegister) {
    return null;
  }

  return {
    id_apertura: cashRegister.id_apertura,
    id_usuario_apertura: cashRegister.id_usuario_apertura,
    horario_apertura: cashRegister.horario_apertura,
    horario_cierre: cashRegister.horario_cierre,
    saldo_apertura: cashRegister.saldo_apertura,
    saldo_cierre: cashRegister.saldo_cierre,
    diferencia: cashRegister.diferencia,
    saldo_esperado: cashRegister.saldo_esperado,
    total_debito: cashRegister.total_debito,
    total_credito: cashRegister.total_credito,
    total_transferencia: cashRegister.total_transferencia,
    usuario: {
      nombre: cashRegister.usuario_nombre,
      apellido: cashRegister.usuario_apellido,
    },
  };
}

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const user = await getAuthenticatedUser(request.correo);

    if (!user) {
      return NextResponse.json(
        { status: "error", message: "Usuario no encontrado." },
        { status: 404 },
      );
    }

    const cashRegister = await getOpenCashRegister(user.id);

    return NextResponse.json({
      status: "ok",
      abierta: Boolean(cashRegister),
      caja: serializeCashRegister(cashRegister),
    });
  } catch (error) {
    console.error("Error consultando caja:", error);

    return NextResponse.json(
      { status: "error", message: "No se pudo consultar la caja." },
      { status: 500 },
    );
  }
});

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const payload = (await request.json()) as { monto?: number };
    const amount = toPositiveAmount(payload.monto);

    if (amount === null) {
      return NextResponse.json(
        { status: "error", message: "Debe ingresar un monto válido." },
        { status: 400 },
      );
    }

    const user = await getAuthenticatedUser(request.correo);

    if (!user) {
      return NextResponse.json(
        { status: "error", message: "Usuario no encontrado." },
        { status: 404 },
      );
    }

    const existingOpenCashRegister = await getOpenCashRegister(user.id);

    if (existingOpenCashRegister) {
      return NextResponse.json({
        status: "ok",
        caja: serializeCashRegister(existingOpenCashRegister),
      });
    }

    const [createdCashRegister] = await prisma.$queryRaw<CashRegisterRow[]>`
      INSERT INTO apertura_caja (
        id_usuario_apertura,
        horario_apertura,
        horario_cierre,
        saldo_apertura,
        saldo_cierre,
        diferencia,
        saldo_esperado
      )
      VALUES (
        ${user.id}::uuid,
        NOW(),
        NULL,
        ${amount},
        NULL,
        NULL,
        ${amount}
      )
      RETURNING
        id_apertura::text,
        id_usuario_apertura::text,
        horario_apertura,
        horario_cierre,
        saldo_apertura,
        saldo_cierre,
        diferencia,
        saldo_esperado,
        total_debito,
        total_credito,
        total_transferencia,
        ${user.nombre}::text AS usuario_nombre,
        ${user.apellido}::text AS usuario_apellido
    `;

    return NextResponse.json({
      status: "ok",
      caja: serializeCashRegister(createdCashRegister),
    });
  } catch (error) {
    console.error("Error abriendo caja:", error);

    return NextResponse.json(
      { status: "error", message: "No se pudo abrir la caja." },
      { status: 500 },
    );
  }
});

export const PATCH = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const payload = (await request.json()) as { saldo_cierre?: number };
    const closingAmount = toPositiveAmount(payload.saldo_cierre);

    if (closingAmount === null) {
      return NextResponse.json(
        { status: "error", message: "Debe ingresar el monto en caja." },
        { status: 400 },
      );
    }

    const user = await getAuthenticatedUser(request.correo);

    if (!user) {
      return NextResponse.json(
        { status: "error", message: "Usuario no encontrado." },
        { status: 404 },
      );
    }

    const cashRegister = await getOpenCashRegister(user.id);

    if (!cashRegister) {
      return NextResponse.json(
        { status: "error", message: "No hay una caja abierta para cerrar." },
        { status: 404 },
      );
    }

    const difference = closingAmount - cashRegister.saldo_apertura;

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE apertura_caja
        SET
          horario_cierre = NOW(),
          saldo_cierre = ${closingAmount},
          diferencia = ${difference}
        WHERE id_apertura = ${cashRegister.id_apertura}::uuid
      `;

      await tx.$executeRaw`
        INSERT INTO historia_caja (
          fecha_registro,
          diferencia,
          saldo_apertura,
          saldo_cierre
        )
        VALUES (
          NOW(),
          ${difference},
          ${cashRegister.saldo_apertura},
          ${closingAmount}
        )
      `;
    });

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Error cerrando caja:", error);

    return NextResponse.json(
      { status: "error", message: "No se pudo cerrar la caja." },
      { status: 500 },
    );
  }
});
