import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { alias: { "@": path.resolve("src") }, interopDefault: false });
const { executeSaleCommand } = await jiti.import("../src/lib/sales.ts");

function fixture({ promotion = false, role = "cajero", permissions = [], paid = false } = {}) {
  const detail = { id_detalle: "detail", id_producto: "product", cantidad: 3, precio_actual: 1000, subtotal_venta: 3000 };
  const sale = { id_venta: "sale", id_apertura_caja: "cash", estado: "pendiente", revision: 1, detalles: [detail], pagos: paid ? [{}] : [] };
  const state = { catalogPrice: 1000, total: 3000 };
  const tx = {
    $queryRaw: async () => [],
    apertura_caja: { findFirst: async () => ({ id_apertura: "cash" }) },
    venta: { findFirst: async () => sale, findUniqueOrThrow: async () => sale, update: async ({ data }) => { state.total = data.valor_total; sale.revision++; } },
    promociones: { findUnique: async () => promotion ? { id_promocion: "promo" } : null },
    user: { findUnique: async () => ({ activo: true, role: { role, permisos: permissions.map((permisoId) => ({ permisoId })) } }) },
    producto: { update: async ({ data }) => { state.catalogPrice = data.precioVenta; } },
    detalle: { update: async ({ data }) => Object.assign(detail, data), aggregate: async () => ({ _sum: { subtotal_venta: detail.subtotal_venta } }) },
  };
  return { tx, sale, detail, state, command: { action: "price", saleId: "sale", revision: 1, productId: "product", price: 1200, permanent: false } };
}

test("cambia solo la venta y recalcula el subtotal", async () => {
  const f = fixture(); await executeSaleCommand(f.tx, "seller", f.command);
  assert.equal(f.detail.precio_actual, 1200); assert.equal(f.detail.subtotal_venta, 3600);
  assert.equal(f.state.total, 3600); assert.equal(f.state.catalogPrice, 1000);
});
test("el precio permanente requiere permisos y cambia el catálogo", async () => {
  const denied = fixture(); await assert.rejects(executeSaleCommand(denied.tx, "seller", { ...denied.command, permanent: true }), /permiso/);
  const allowed = fixture({ permissions: ["productos_ver", "productos_editar"] });
  await executeSaleCommand(allowed.tx, "seller", { ...allowed.command, permanent: true });
  assert.equal(allowed.state.catalogPrice, 1200); assert.equal(allowed.state.total, 3600);
});
test("bloquea cambios con promoción o pagos", async () => {
  for (const options of [{ promotion: true }, { paid: true }]) {
    const f = fixture(options); await assert.rejects(executeSaleCommand(f.tx, "seller", f.command));
    assert.equal(f.state.total, 3000); assert.equal(f.state.catalogPrice, 1000);
  }
});
