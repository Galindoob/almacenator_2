import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { alias: { "@": path.resolve("src") }, interopDefault: false });
const { canCloseCashRegister, hasCashClosingPrivilege } = await jiti.import("../src/lib/cash-authorization.ts");

test("quien abrió la caja puede cerrarla", () => {
  assert.equal(canCloseCashRegister("opener", "cajero", "opener"), true);
  assert.equal(canCloseCashRegister("opener", "usuario", "opener"), true);
});

test("admin y master pueden cerrar una caja abierta por otra persona", () => {
  for (const role of ["admin", "master"]) {
    assert.equal(hasCashClosingPrivilege(role), true);
    assert.equal(canCloseCashRegister("other", role, "opener"), true);
  }
});

test("otros cajeros y usuarios no pueden cerrar la caja", () => {
  for (const role of ["cajero", "usuario", "desconocido"]) {
    assert.equal(hasCashClosingPrivilege(role), false);
    assert.equal(canCloseCashRegister("other", role, "opener"), false);
  }
});
