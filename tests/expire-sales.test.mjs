import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { createJiti } from "jiti";

process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";
const { expireSalesInTransaction } = await createJiti(import.meta.url, { alias: { "@": path.resolve("src") }, interopDefault: false }).import("../src/lib/expire-sales.ts");
test("libera reservas y elimina solo ventas vencidas sin pagos", async () => {
  const cutoff = new Date("2026-01-01T12:00:00Z");
  let where; const state = { released: 0, stock: 0, details: 0, deleted: 0 };
  const tx = {
    $queryRaw: async (strings) => strings.join("").includes("INTERVAL") ? [{ cutoff }] : [],
    venta: { findMany: async (args) => { where = args.where; return [{ id_venta: "sale", detalles: [{ id_detalle: "detail", id_producto: "product" }] }]; }, delete: async () => { state.deleted++; } },
    instancia_producto: { updateMany: async () => { state.released += 2; return { count: 2 }; } },
    producto: { update: async ({ data }) => { state.stock += data.stock.increment; } },
    detalle: { deleteMany: async () => { state.details++; } },
  };
  assert.equal(await expireSalesInTransaction(tx), 1);
  assert.equal(where.estado, "pendiente"); assert.deepEqual(where.pagos, { none: {} }); assert.equal(where.ultima_actividad.lte, cutoff);
  assert.deepEqual(state, { released: 2, stock: 2, details: 1, deleted: 1 });
});
