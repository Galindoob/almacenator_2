import assert from "node:assert/strict";
import { test } from "node:test";
import { createJiti } from "jiti";
import path from "node:path";

const { canDeactivateAccount } = await createJiti(import.meta.url).import("../src/lib/user-management.ts");
const { deactivateUser } = await createJiti(import.meta.url, { alias: { "@": path.resolve("src") } }).import("../src/lib/deactivate-user.ts");

test("admin elimina usuarios y cajeros; master también puede eliminar admin", () => {
  for (const role of ["usuario", "cajero"]) assert.equal(canDeactivateAccount("a", "admin", "b", role), true);
  assert.equal(canDeactivateAccount("a", "master", "b", "admin"), true);
});

test("protege master, roles iguales o superiores y la propia cuenta", () => {
  assert.equal(canDeactivateAccount("a", "admin", "b", "admin"), false);
  assert.equal(canDeactivateAccount("a", "admin", "b", "master"), false);
  assert.equal(canDeactivateAccount("a", "master", "b", "master"), false);
  assert.equal(canDeactivateAccount("a", "master", "a", "usuario"), false);
  assert.equal(canDeactivateAccount("a", "cajero", "b", "usuario"), false);
  assert.equal(canDeactivateAccount("a", "master", "b", "desconocido"), false);
});

function mockTransaction({ actorRole = "admin", targetRole = "cajero", pending = 0, open = false } = {}) {
  const state = { active: true, resetDeleted: false };
  const actor = { id: "actor", activo: true, role: { role: actorRole } };
  const target = { id: "target", roleid: "role", activo: true, role: { role: targetRole } };
  return { state, tx: {
    $queryRaw: async () => [],
    user: { findUnique: async ({ where }) => where.correo ? actor : target, updateMany: async () => { state.active = false; return { count: 1 }; } },
    venta: { count: async () => pending },
    apertura_caja: { findFirst: async () => open ? { id_apertura: "open" } : null },
    passwordReset: { deleteMany: async () => { state.resetDeleted = true; } },
  } };
}

test("desactiva una cuenta autorizada y anula sus solicitudes de recuperación", async () => {
  const { tx, state } = mockTransaction();
  assert.equal((await deactivateUser(tx, "actor@example.com", "target")).status, 200);
  assert.equal(state.active, false);
  assert.equal(state.resetDeleted, true);
});

test("no desactiva cuentas con ventas pendientes ni con caja abierta", async () => {
  for (const options of [{ pending: 1 }, { open: true }]) {
    const { tx, state } = mockTransaction(options);
    assert.equal((await deactivateUser(tx, "actor@example.com", "target")).status, 409);
    assert.equal(state.active, true);
    assert.equal(state.resetDeleted, false);
  }
});

test("el servidor rechaza a un cajero o a un admin que intenta eliminar a master", async () => {
  for (const options of [{ actorRole: "cajero" }, { targetRole: "master" }]) {
    const { tx, state } = mockTransaction(options);
    assert.equal((await deactivateUser(tx, "actor@example.com", "target")).status, 403);
    assert.equal(state.active, true);
  }
});
