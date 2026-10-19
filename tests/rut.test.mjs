import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { alias: { "@": path.resolve("src") } });
const { formatRut, rutSchema } = await jiti.import("../src/lib/rut.ts");

test("normaliza y valida un RUT chileno", () => {
  assert.equal(formatRut("202753353"), "20.275.335-3");
  assert.equal(rutSchema.parse("202753353"), "20.275.335-3");
  assert.equal(rutSchema.parse("20.275.335-3"), "20.275.335-3");
});

test("rechaza largos, caracteres y dígitos verificadores inválidos", () => {
  assert.equal(rutSchema.safeParse("12345-6").success, false);
  assert.equal(rutSchema.safeParse("20.275.335-4").success, false);
  assert.equal(rutSchema.safeParse("20A2753353").success, false);
  assert.equal(rutSchema.safeParse("1234567890123").success, false);
});
