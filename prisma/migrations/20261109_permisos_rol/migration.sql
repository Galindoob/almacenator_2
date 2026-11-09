CREATE TABLE "permiso" ("id" VARCHAR(80) PRIMARY KEY);
CREATE TABLE "rol_permiso" (
  "id_rol" UUID NOT NULL REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "id_permiso" VARCHAR(80) NOT NULL REFERENCES "permiso"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "habilitado" BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY ("id_rol", "id_permiso")
);
INSERT INTO "permiso" ("id") VALUES
 ('productos_ver'), ('productos_crear'), ('productos_stock'), ('productos_merma'),
 ('proveedores_ver'), ('proveedores_editar'), ('reportes_ver'), ('empresa_usuarios_ver'),
 ('precios_ver'), ('transacciones_ver'), ('academia_ver'), ('vencimiento_ver'),
 ('roles_cambiar'), ('promociones_crear'), ('caja_abrir_cerrar'), ('ventas_crear'),
 ('caja_ingreso_egreso'), ('caja_sacar_dinero');
INSERT INTO "rol_permiso" ("id_rol", "id_permiso", "habilitado")
SELECT r."id", p."id", lower(r."role") = 'master' FROM "role" r CROSS JOIN "permiso" p;
