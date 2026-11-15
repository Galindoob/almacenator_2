import assert from "node:assert/strict";
import { test } from "node:test";
import { createJiti } from "jiti";

const { readApiJson } = await createJiti(import.meta.url).import("../src/lib/api-response.ts");

test("conserva las respuestas JSON y sus mensajes de error", async () => {
  assert.deepEqual(await readApiJson(Response.json({ message: "No tienes permiso." }, { status: 403 })), { message: "No tienes permiso." });
});

test("muestra un mensaje claro cuando una ruta devuelve HTML 404", async () => {
  const response = new Response("<!DOCTYPE html><html></html>", { status: 404, headers: { "Content-Type": "text/html" } });
  await assert.rejects(readApiJson(response), /reinicia el servidor/i);
});

test("maneja HTML de error y JSON mal formado sin exponer errores de sintaxis", async () => {
  await assert.rejects(readApiJson(new Response("<!DOCTYPE html>", { status: 500, headers: { "Content-Type": "text/html" } })), /respuesta inesperada \(500\)/);
  await assert.rejects(readApiJson(new Response("{", { headers: { "Content-Type": "application/json" } })), /No se pudo leer/);
});
