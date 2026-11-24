import type { Prisma } from "@/generated/prisma/client";

type DatabaseClock = Pick<Prisma.TransactionClient, "$queryRaw">;

export async function getChileCurrentDate(database?: DatabaseClock) {
  // Use the database clock rather than the cashier's computer or a third-party API.
  const clock = database ?? (await import("@/lib/db")).prisma;
  const [result] = await clock.$queryRaw<{ fecha: string }[]>`
    SELECT to_char(clock_timestamp() AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD') AS fecha
  `;

  if (!result || !/^\d{4}-\d{2}-\d{2}$/.test(result.fecha)) {
    throw new Error("La base de datos devolvió una fecha de Chile inválida.");
  }

  return result.fecha;
}
