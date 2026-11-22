import assert from "node:assert/strict";
import { test } from "node:test";
import { createJiti } from "jiti";
const { deleteProvider } = await createJiti(import.meta.url).import("../src/lib/delete-provider.ts");

function fixture(products, exists = true) {
  const state = { detached: false, deleted: false };
  return { state, tx: {
    $queryRaw: async () => exists ? [{ id_proveedor: "provider" }] : [],
    producto: { findMany: async () => products, updateMany: async ({ data }) => { assert.equal(data.id_proveedor, null); state.detached = true; } },
    proveedores: { delete: async () => { state.deleted = true; } },
  } };
}
test("elimina el proveedor y desvincula los productos confirmados", async () => {
  const f = fixture([{ id: "one", nombre: "Uno" }, { id: "two", nombre: "Dos" }]);
  assert.equal((await deleteProvider(f.tx, "provider", ["one", "two"])).status, "deleted");
  assert.deepEqual(f.state, { detached: true, deleted: true });
});
test("exige confirmar la lista actual si los productos cambiaron", async () => {
  const products = [{ id: "one", nombre: "Uno" }, { id: "two", nombre: "Dos" }];
  const f = fixture(products);
  assert.deepEqual(await deleteProvider(f.tx, "provider", ["one"]), { status: "changed", products });
  assert.deepEqual(f.state, { detached: false, deleted: false });
});
test("permite eliminar un proveedor sin productos", async () => {
  const f = fixture([]);
  assert.equal((await deleteProvider(f.tx, "provider", [])).status, "deleted");
});
