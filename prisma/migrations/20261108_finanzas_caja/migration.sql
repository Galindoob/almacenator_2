ALTER TABLE "apertura_caja" DROP COLUMN "retiro";

CREATE TABLE "capital_caja" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "id_apertura_caja" UUID NOT NULL,
  "id_usuario" UUID NOT NULL,
  "tipo" VARCHAR(20) NOT NULL CHECK ("tipo" IN ('ingreso', 'egreso')),
  "monto" INTEGER NOT NULL CHECK ("monto" > 0),
  "fecha" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  FOREIGN KEY ("id_apertura_caja") REFERENCES "apertura_caja"("id_apertura") ON DELETE RESTRICT,
  FOREIGN KEY ("id_usuario") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE INDEX "capital_caja_id_apertura_caja_idx" ON "capital_caja"("id_apertura_caja");
