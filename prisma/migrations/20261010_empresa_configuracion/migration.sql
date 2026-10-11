ALTER TABLE "configuracion_usuario"
  ADD COLUMN "empresa_rut" VARCHAR(12),
  ADD COLUMN "empresa_nombre" VARCHAR(120),
  ADD COLUMN "empresa_giro" VARCHAR(120),
  ADD COLUMN "empresa_actividad" VARCHAR(120),
  ADD COLUMN "empresa_email" VARCHAR(255),
  ADD COLUMN "empresa_telefono" VARCHAR(50),
  ADD COLUMN "empresa_direccion" VARCHAR(200),
  ADD COLUMN "empresa_comuna" VARCHAR(100);
