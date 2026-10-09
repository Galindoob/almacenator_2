CREATE TABLE IF NOT EXISTS "configuracion_usuario" (
  "id_usuario" UUID NOT NULL,
  "tema" VARCHAR(20) NOT NULL DEFAULT 'green',
  "escala_fuente" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "nombre_tienda" VARCHAR(25) NOT NULL DEFAULT 'nombre_tienda',
  "actualizado" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "configuracion_usuario_pkey" PRIMARY KEY ("id_usuario"),
  CONSTRAINT "fk_configuracion_usuario" FOREIGN KEY ("id_usuario")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "configuracion_usuario_tema_check" CHECK ("tema" IN ('green', 'blue', 'orange', 'sky')),
  CONSTRAINT "configuracion_usuario_escala_check" CHECK ("escala_fuente" >= 0.85 AND "escala_fuente" <= 1.2)
);
