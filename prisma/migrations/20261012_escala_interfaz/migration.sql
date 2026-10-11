ALTER TABLE "configuracion_usuario"
ADD COLUMN "escala_interfaz" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD CONSTRAINT "configuracion_usuario_escala_interfaz_check"
CHECK ("escala_interfaz" >= 0.8 AND "escala_interfaz" <= 1.2);
