CREATE TABLE "medio_pago" (
  "id_medio" UUID NOT NULL DEFAULT gen_random_uuid(),
  "medio_de_pago" VARCHAR(50) NOT NULL,
  CONSTRAINT "medio_pago_pkey" PRIMARY KEY ("id_medio"),
  CONSTRAINT "medio_pago_medio_de_pago_key" UNIQUE ("medio_de_pago")
);

INSERT INTO "medio_pago" ("medio_de_pago")
VALUES ('debito'), ('credito'), ('efectivo'), ('trasnferencia')
ON CONFLICT ("medio_de_pago") DO NOTHING;
