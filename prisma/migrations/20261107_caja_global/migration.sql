ALTER TABLE "apertura_caja"
  ADD COLUMN "valor_real" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "retiro" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "comentario" VARCHAR(255);

ALTER TABLE "venta" ADD COLUMN "id_apertura_caja" UUID;
ALTER TABLE "venta" ADD CONSTRAINT "venta_id_apertura_caja_fkey"
  FOREIGN KEY ("id_apertura_caja") REFERENCES "apertura_caja"("id_apertura") ON DELETE RESTRICT;
CREATE INDEX "venta_id_apertura_caja_idx" ON "venta" ("id_apertura_caja");

CREATE TABLE "razon_movimiento" (
  "id_razon" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "razon" VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE "movimiento_caja" (
  "id_movimiento" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "id_apertura_caja" UUID NOT NULL REFERENCES "apertura_caja"("id_apertura") ON DELETE RESTRICT,
  "tipo" VARCHAR(20) NOT NULL CHECK ("tipo" IN ('ingreso', 'egreso')),
  "comentario" VARCHAR(255),
  "id_razon" UUID REFERENCES "razon_movimiento"("id_razon") ON DELETE RESTRICT,
  "movimiento" INTEGER NOT NULL CHECK ("movimiento" > 0)
);
CREATE INDEX "movimiento_caja_id_apertura_caja_idx" ON "movimiento_caja" ("id_apertura_caja");

INSERT INTO "razon_movimiento" ("razon") VALUES
  ('Retiro'),
  ('Remuneracion'),
  ('Pago general'),
  ('Pago a proveedor'),
  ('Devolucion a cliente')
ON CONFLICT ("razon") DO NOTHING;
