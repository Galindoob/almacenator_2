import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { alias: { "@": path.resolve("src") }, interopDefault: false });
const { getChileCurrentDate } = await jiti.import("../src/lib/chile-time.ts");

test("utiliza la fecha devuelta por la base de datos", async () => {
  const clock = { $queryRaw: async () => [{ fecha: "2026-11-24" }] };
  assert.equal(await getChileCurrentDate(clock), "2026-11-24");
});

test("rechaza resultados de fecha inválidos y errores de conexión", async () => {
  await assert.rejects(getChileCurrentDate({ $queryRaw: async () => [{ fecha: "24-11-2026" }] }), /fecha de Chile inválida/);
  await assert.rejects(getChileCurrentDate({ $queryRaw: async () => [] }), /fecha de Chile inválida/);
  await assert.rejects(getChileCurrentDate({ $queryRaw: async () => { throw new Error("sin conexión"); } }), /sin conexión/);
});

const pglite = await import("@electric-sql/pglite").catch(() => null);
test("calcula el cambio de día chileno en verano e invierno", { skip: !pglite && "Requiere PGlite para la prueba SQL" }, async () => {
  const db = await pglite.PGlite.create();
  try {
    const dateAt = async (instant) => getChileCurrentDate({
      $queryRaw: async (strings) => {
        // Substitute only the database clock with a fixed instant; keep the production SQL.
        const sql = strings.join("").replace("clock_timestamp()", `$1::timestamptz`);
        return (await db.query(sql, [instant])).rows;
      },
    });
    assert.equal(await dateAt("2026-11-24T02:59:59Z"), "2026-11-23");
    assert.equal(await dateAt("2026-11-24T03:00:00Z"), "2026-11-24");
    assert.equal(await dateAt("2026-06-15T03:59:59Z"), "2026-06-14");
    assert.equal(await dateAt("2026-06-15T04:00:00Z"), "2026-06-15");
  } finally {
    await db.close();
  }
});
