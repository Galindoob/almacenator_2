CREATE TABLE "tipo_promocion" (
  "id_tipo_promocion" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tipo" VARCHAR(50) NOT NULL,
  CONSTRAINT "tipo_promocion_pkey" PRIMARY KEY ("id_tipo_promocion")
);
CREATE UNIQUE INDEX "tipo_promocion_tipo_key" ON "tipo_promocion"("tipo");

CREATE TABLE "promociones" (
  "id_promocion" UUID NOT NULL DEFAULT gen_random_uuid(),
  "id_tipo_promocion" UUID NOT NULL,
  "nombre_promocion" VARCHAR(150) NOT NULL,
  "descripcion" VARCHAR(500) NOT NULL,
  "id_productos" UUID NOT NULL,
  "descuento" DOUBLE PRECISION,
  "cantidad_llevar" INTEGER,
  "cantidad_regalo" INTEGER,
  "combo" INTEGER,
  "precio_combo" INTEGER,
  CONSTRAINT "promociones_pkey" PRIMARY KEY ("id_promocion"),
  CONSTRAINT "promociones_tipo_fk" FOREIGN KEY ("id_tipo_promocion") REFERENCES "tipo_promocion"("id_tipo_promocion") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "promociones_producto_fk" FOREIGN KEY ("id_productos") REFERENCES "productos"("id_productos") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "promociones_tipo_idx" ON "promociones"("id_tipo_promocion");
CREATE INDEX "promociones_producto_idx" ON "promociones"("id_productos");
INSERT INTO "tipo_promocion" ("tipo") VALUES ('combo'), ('yapa'), ('descuento') ON CONFLICT ("tipo") DO NOTHING;
