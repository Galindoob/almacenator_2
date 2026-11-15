import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { alias: { "@": path.resolve("src") }, interopDefault: false });
const { saleShortcutsSchema, defaultSaleShortcuts } = await jiti.import("../src/lib/sale-shortcuts.ts");

test("los atajos predeterminados son válidos y diferentes", () => {
  assert.equal(saleShortcutsSchema.safeParse(defaultSaleShortcuts).success, true);
  assert.equal(saleShortcutsSchema.safeParse({ buscar: "F9", efectivo: "F7", debito: "F3" }).success, true);
});

test("se rechazan teclas duplicadas y teclas que interfieren con escritura o recarga", () => {
  assert.equal(saleShortcutsSchema.safeParse({ buscar: "F2", efectivo: "F2", debito: "F8" }).success, false);
  assert.equal(saleShortcutsSchema.safeParse({ buscar: "1", efectivo: "F4", debito: "F8" }).success, false);
  assert.equal(saleShortcutsSchema.safeParse({ buscar: "F5", efectivo: "F4", debito: "F8" }).success, false);
});
