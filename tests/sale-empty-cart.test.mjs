import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { alias: { "@": path.resolve("src") }, interopDefault: false });
const { executeSaleCommand } = await jiti.import("../src/lib/sales.ts");

function fixture({ secondProduct = false, paid = false, controlled = true } = {}) {
  const first = { id_detalle: "detail-1", id_producto: "product-1", cantidad: 2, precio_actual: 1000, subtotal_venta: 2000 };
  const second = { id_detalle: "detail-2", id_producto: "product-2", cantidad: 1, precio_actual: 1000, subtotal_venta: 1000 };
  const sale = { id_venta: "sale-1", id_apertura_caja: "cash-1", estado: "pendiente", revision: 1, detalles: secondProduct ? [first, second] : [first], pagos: paid ? [{}] : [] };
  const state = { sale, stock: 3, reserved: controlled ? ["instance-1", "instance-2"] : [], removed: false };
  const tx = {
    $queryRaw: async () => [],
    apertura_caja: { findFirst: async () => ({ id_apertura: "cash-1" }) },
    venta: {
      findFirst: async () => ({ ...sale, detalles: [...sale.detalles] }),
      findUniqueOrThrow: async () => sale,
      update: async ({ data }) => { sale.valor_total = data.valor_total; sale.revision++; },
      delete: async () => { state.removed = true; },
    },
    producto: {
      findUnique: async () => ({ id: "product-1", controlaStock: controlled, stock: state.stock, precioVenta: 1000, costo: 500 }),
      update: async ({ data }) => { state.stock -= data.stock.decrement; },
    },
    promociones: { findUnique: async () => null },
    detalle: {
      findUnique: async () => sale.detalles.find((detail) => detail.id_producto === "product-1") ?? null,
      delete: async () => { sale.detalles = sale.detalles.filter((detail) => detail.id_producto !== "product-1"); },
      aggregate: async () => ({ _sum: { subtotal_venta: sale.detalles.reduce((sum, detail) => sum + detail.subtotal_venta, 0) } }),
    },
    instancia_producto: {
      findMany: async ({ take }) => state.reserved.slice(0, take).map((id) => ({ id_instancia: id })),
      updateMany: async () => { state.reserved = []; },
    },
  };
  const command = { action: "item", saleId: sale.id_venta, revision: sale.revision, productId: "product-1", quantity: 0 };
  return { tx, state, command };
}

test("al quitar el último producto se elimina la venta y se libera el stock", async () => {
  const { tx, state, command } = fixture();
  assert.equal(await executeSaleCommand(tx, "user-1", command), null);
  assert.equal(state.removed, true);
  assert.equal(state.stock, 5);
  assert.deepEqual(state.reserved, []);
});

test("al quitar un producto con otros en el carrito se conserva la venta", async () => {
  const { tx, state, command } = fixture({ secondProduct: true });
  const result = await executeSaleCommand(tx, "user-1", command);
  assert.equal(state.removed, false);
  assert.equal(result.detalles.length, 1);
  assert.equal(result.valor_total, 1000);
  assert.equal(state.stock, 5);
});

test("quitar el último producto por peso no modifica stock", async () => {
  const { tx, state, command } = fixture({ controlled: false });
  assert.equal(await executeSaleCommand(tx, "user-1", command), null);
  assert.equal(state.removed, true);
  assert.equal(state.stock, 3);
});

test("una venta con pagos o una revisión antigua no puede eliminarse", async () => {
  const paid = fixture({ paid: true });
  await assert.rejects(executeSaleCommand(paid.tx, "user-1", paid.command), /pagos registrados/);
  assert.equal(paid.state.removed, false);
  const stale = fixture();
  await assert.rejects(executeSaleCommand(stale.tx, "user-1", { ...stale.command, revision: 0 }), /otra ventana/);
  assert.equal(stale.state.removed, false);
});
